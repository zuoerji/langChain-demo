

/**
 * 关于 调用 langChain 的时候时候使用
 * 
*/
import { Router } from "express";
import { asyncRoutes } from '../shared/async-route.js';
import { threadInputSchema } from '../shared/validation.js';
import { getChatModel } from '../ai/models.js';
import { HumanMessage } from "@langchain/core/messages";

import { formateConveration } from "../ai/tools.js";

import { endSse, openSse, sendSse } from '../ai/sse.js';


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
