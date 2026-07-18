

/**
 * 关于 调用 langChain 的时候时候使用
 * 
*/
import { Router } from "express";
import { asyncRoutes } from '../shared/async-route.js';
import { threadInputSchema, expressionSchema, ragInputSchema, ragQueryInputSchema } from '../shared/validation.js';
import { getChatModel } from '../ai/models.js';
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

import { formateConveration, guessToolCall, tools, formatTools } from "../ai/tools.js";

import { endSse, openSse, sendSse } from '../ai/sse.js';

import { addDocument, listDocuments, searchDocuments  } from "../ai/rag-store.js";



export const langchanRouter = Router();

const sessions = new Map();

// 接口
langchanRouter.post(
  "/chat/simple",
  asyncRoutes(async (req, res) => {
    // req: 请求参数
    // res: 返回数据
    /**
     * 1. 限制用户输入
     * 2. 拿到大模型
     * 3. 请求大模型
     * 4. 返回大模型数据
     * */ 
    const body = threadInputSchema.parse(req.body);
    const model = getChatModel();
    // 拿到大模型返回的结果
    const result = await model.invoke(body.input);
    res.json({
      ok: true,
      data: {
        input: body.input,
        output: result.content,
      }
    })
  })
);
/**
 * 1. 缓存数据 （id）
 * 2. 取数据
 * 
*/
// 带记忆
langchanRouter.post(
  '/agent/chat',
  asyncRoutes(async (req, res) => {
    /**
     * 1. 去当前信息 threadId input
     * 2. 去缓存里面取历史数据，根据 threadId
     * 3. 把当前信息和历史数据合并
     * 4. 请求 大模型
     * 5. 把大模型返回的数据存储缓存
     * 6. 返回
    */ 
    const body = threadInputSchema.parse(req.body);
    const messages = sessions.get(body.threadId) ?? [];
    // HumanMessage | SystemMessage | AiMessage
    messages.push(new HumanMessage(body.input));
    const aiMessage = await getChatModel().invoke(messages);
    messages.push(aiMessage);
    sessions.set(body.threadId,  messages);
    res.json({
      ok: true,
      data: {
        output: aiMessage.content
      }
    })
  })
)

// 那缓存
langchanRouter.get(
  '/agent/threads/:threadId',
  asyncRoutes(async (req, res) => {
    const threadId = String(req.params.threadId);
    const messages = sessions.get(threadId) ?? [];
    res.json({
      ok: true,
      data: {
        threadId,
        output: formateConveration(messages) 
      }
    })
  })
)
/**
 * 流式输出
 * 1. 大模型调用 
 *    invoke: 拿到全部信息一起返回
 *    stream: 一点一点返回
 * 2. 请求头需要特殊设置： Content-Type : 'text/event-stream'
 * 
 * 
*/
// 流式输出
langchanRouter.post(
  '/chat/stream',
  asyncRoutes(async (req, res) => {
    /**
     * 1. 拿到参数
     * 2. 获取大模型
     * 3. 设置 请求头
     * 4. 通过大模型的 stream 
     * 5. res.write 去一个传给前端
     * 6. res.end 停止
     * 
    */
    const body = threadInputSchema.parse(req.body);
    const model = getChatModel();
    // 设置请求头
    openSse(res);
    try {
      const stream = await model.stream(body.input);
      // 循环传递给前端
      for await (const chunk of stream) {
        // res.write
        console.log(chunk, '==chunk===');
        sendSse(res, 'token', { token: chunk.content });
      }
      // end res.end()
      endSse(res);
    } catch (error) {
      sendSse(res, 'error', {
        message: error instanceof Error ? error.message : "Unknown stream error"
      });
      res.end();
    }
  })
)
/**
 * 调用工具
 * 1. 用户输入
 *  1. 匹配用户输入，查询字段
 *    1. 调用自己内部工具
 *  2. 匹配不到，直接调用大模型
 *  
 * 
*/
langchanRouter.post(
  '/tools/ask',
  asyncRoutes(async (req, res) => {
    /**
     * 1. 匹配： 正则
     * 2. 匹配到了之后，调用工具
     * 3. 把用户输入的信息，和工具调用的结果，一起给到大模型
     * 
    */
    const body = threadInputSchema.parse(req.body);
    // 函数正则去匹配用户输入  订单 1001 -> 订单号：1001 需要调哪个工具
    const call = guessToolCall(body.input);
    // 没有匹配到 直接调用大模型
    if (!call) {
      const result = await getChatModel().invoke([
        new SystemMessage("正常回答，这个请求不需要工具"),
        new HumanMessage(body.input),
      ]);
      res.json({
        ok: true,
        data: {
          mode: 'chat',
          output: result.content
        }
      });
      return;
    }
    // 匹配到了，调用工具
    // call -> { toolName, args: { orderId } }
    const selectTool = tools.find(demoTool => demoTool.toolName === call.toolName );
    const toolResult = await selectTool?.invoke(call.args);
    const result = await getChatModel().invoke([
      new SystemMessage("使用提供的工具结果，简洁的方式回答用户"),
      new HumanMessage(`用户请求：${body.input}\n 工具结果：${JSON.stringify(toolResult)}`)
    ]);
    res.json({
      ok: true,
      data: {
        mode: 'tool',
        output: result.content
      }
    })
  })
)


// 调用计算器
/**
 * 1. 验证用户输入
 * 2. 调用工具
 * 
*/
langchanRouter.post(
  '/tools/calculator',
  asyncRoutes(async (req, res) => {
    const body = expressionSchema.parse(req.body);
    const calculator = tools.find(demoTool => demoTool.toolName === 'calculator');
    const result = await calculator.invoke({ expression: body.expression });

    res.json({
      ok: true,
      data: result
    })
  })
)
// 直接返回 tools
// 处理成字符串返回
langchanRouter.get(
  '/tools',
  asyncRoutes(async (req, res) => {
    res.json({
      ok: true,
      data: {
        output: formatTools(tools)
      }
    })
  })
)

//导入数据
/**
 * 1. 导入数据
 *  1. 存储
 *  2. 数据进行分词 我叫左耳 -> 我 | 叫 | 左 | 耳
 *      我叫左耳 -> 我 | 叫 | 左 | 耳
 *  3. 返回当前的数据和已经存进去的数据
 * 
*/
langchanRouter.post(
  '/rag/ingest',
  asyncRoutes(async (req, res) => {
    // 限制用户输入
    const body = ragInputSchema.parse(req.body);
    // 直接输出 当前添加的数据|历史所有数据
    res.json({
      ok: true,
      document: addDocument(body.title, body.content),
      allDocuments: listDocuments()
    })
  })
)

// 提问
langchanRouter.post(
  '/rag/query',
  asyncRoutes(async (req, res) => {
    // 验证用户输入
    const body = ragQueryInputSchema.parse(req.body);
    // 需要给 传入 用户输入的问题和数据库里面的 tokens 做打分
    const hits = searchDocuments(body.question, body.topK);
    // [{ title, content}]
    const context = hits.map(hit => `[${hit.title}]\n ${hit.content}`).join('\n\n');
    // 给大模型
    const result = await getChatModel().invoke([
      new SystemMessage("仅根据所提供的上下文来回到用户，如果上下文信息不足，请如实相告"),
      new HumanMessage(`问题：${body.question}\n\n内容：${context}`),
    ])

    res.json({
      ok: true,
      data: {
        question: body.question,
        output: result.content,
        hits
      }
    })
  })
) 
