

/**
 * 调用 langGraph 的时候
 *
 * 1. 创建流程图
 * 2. 添加处理节点（流程）
 * 3. 添加固定连线（开始走）
 * 4. 分支连线 （根据条件走什么流）
*/
// 条件路由
/**
 * 1. 判断用户输入，进行分类
 *  投诉 | 订单 | 价格 | 聊天
 * 2. langGraph 的工作流节点
 * 3. 开始连线
 * 4. 根据之前分类去执行某一个工作流
 * 
 * StateGraph: 创建流程图
 * addNode：添加处理节点
 * addEdge: 添加固定连线
 * addConditionEdges: 添加条件分支连线
 * compile: 编译执行
 * 
 * 
 * 1. 定义输出格式
 * 2. 定义流程
 * 3. 添加连线
 * 
*/
import { Annotation, END, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import { Router } from "express"; 
import { asyncRoutes } from "../shared/async-route.js";

import { threadInputSchema } from '../shared/validation.js';

import { classifyTicket } from '../ai/structured.js';

import { getChatModel } from '../ai/models.js';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

import { formateObject, formateConveration } from '../ai/tools.js';

export const langgraphRouter = Router();

// 1. 定义输出格式
const RouterState = Annotation.Root({
  input: Annotation(),
  router: Annotation(),
  output: Annotation(),
});

// 2. 定义流程
/**
 * 0. 分类
 * 1. 投诉
 * 2. 订单
 * 3. 价格
 * 4. 聊天
 * 
*/
const routerGraph = new StateGraph(RouterState)
  .addNode("classify", async(state) => ({
    // classifyTicket -> { intent: 'complaint | chat | order | pricing' }
    router: classifyTicket(state.input).intent,
  }))
  .addNode("order", async(state) => ({
    output: `订单处理节点：我会帮你查询订单，物流或退款，原始问题${state.input}`
  }))
  .addNode("complaint", async(state) => ({
    output: `投诉处理节点：优先级高，会进行人工处理，原始问题${state.input}`
  }))
  .addNode("pricing", async(state) => ({
    output: `价格询问节点：解释价格，原始问题${state.input}`
  }))
  .addNode("chat", async(state) => ({
    output: `闲聊节点：普通对话，不进入业务流程，原始问题${state.input}`
  }))
  .addEdge(START, 'classify')
  .addConditionalEdges('classify', (state) => state.router,{
    order: 'order',
    complaint: 'complaint',
    pricing: 'pricing',
    chat: 'chat'
  })
  .addEdge('order', END)
  .addEdge('complaint', END)
  .addEdge('pricing', END)
  .addEdge('chat', END)
  .compile();


langgraphRouter.post(
  '/workflow/router',
  asyncRoutes(async (req, res) => {
    // 限制用户输入
    const body = threadInputSchema.parse(req.body);
    const result = await routerGraph.invoke({input: body.input})
    res.json({
      ok: true,
      data: result
    })
  })
)
/**
 * 1. 清理一下文本格式（清除空格）
 * 2. 总结一下用户输入的文本（ai 总结）
 * 3. 给用户输入的文本打标签 （complaint|order|pricing|chat）
 * 
 * 
 * 步骤；
 * 1. 定义输出格式
 * 2. 定义流程
 * 3. 定义执行
*/
// 1. 定义输出格式
const workflowState = Annotation.Root({
  input: Annotation(),
  cleaned: Annotation(),
  summary: Annotation(),
  tag: Annotation(),
});

// 2. 定义流程
const summarizeGraph = new StateGraph(workflowState)
  .addNode('clean', async (state) => ({
    cleaned: state.input.replace(/\s+/g," ").trim(),
  }))
  .addNode('summarize', async (state) => {
    // 调用大模型
    const result = await getChatModel().invoke([
      new SystemMessage("用一句简单的话总结这段文字"),
      new HumanMessage(state.cleaned)
    ]);
    return { summary: String(result.content) }
  })
  .addNode('tag_text', async (state) => ({
    tag: classifyTicket(state.cleaned).intent,
  }))
  .addEdge(START, 'clean')
  .addEdge('clean', 'summarize')
  .addEdge('summarize', 'tag_text')
  .addEdge('tag_text', END)
  .compile();

// 线性工作流
langgraphRouter.post(
  '/workflow/summarize',
  asyncRoutes(async (req, res) => {
    const body = threadInputSchema.parse(req.body);
    const result = await summarizeGraph.invoke({input: body.input});

    res.json({
      ok: true,
      data: {
        output: formateObject(result)
      }
    })
  })
)

/**
 * 1. 定义格式
 * 2. 定义节点
 * 3. 执行
 * 
 * memorySaver : langgraph
 * 
*/
const chatMemory = new MemorySaver();

const chatSate = Annotation.Root({
  messages: Annotation({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  })
})

const chatGraph = new StateGraph(chatSate)
  .addNode('chatbot', async(state) => {
    // 请求大模型
    const result = await getChatModel().invoke([
      new SystemMessage("你是一个乐于助人的助手，请自然的交谈"),
      ...state.messages,
    ]);
    return {
      messages: [result]
    }
  })
  .addEdge(START, 'chatbot')
  .addEdge('chatbot', END)
  .compile({ checkpointer: chatMemory })

// 记忆聊天
langgraphRouter.post(
  '/chat',
  asyncRoutes(async (req, res) => {
    const body = threadInputSchema.parse(req.body);
    const config = { configurable: { thread_id: body.threadId } };
    const result = await chatGraph.invoke({
      messages: [new HumanMessage(body.input)]
    },config);
    const messages = result.messages
    res.json({
      ok: true,
      data: {
        threadId: body.threadId,
        output: formateConveration(messages)
      }
    })
  })
)

// 查看记忆
langgraphRouter.get(
  '/state/:threadId',
  asyncRoutes(async (req, res) => {
    const threadId = String(req.params.threadId);
    const config = { configurable: { thread_id: threadId } };
    const shot = await chatGraph.getState(config);
    const messages = shot.values.messages ?? [];

    res.json({
      ok: true,
      data: {
        threadId,
        output: formateConveration(messages),
    
      }
    })
  })
)