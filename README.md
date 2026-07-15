# 使用 Express + LangChain 实现第一个 AI 聊天接口
这篇文章记录一个最小可运行的 AI 聊天接口实现：前端输入一句话，后端接收请求，调用大模型，并把模型回答返回给前端。

这个例子虽然简单，但它是后续实现流式输出、工具调用、RAG、LangGraph 工作流的基础。

## 技术栈

本文示例使用：

- Node.js
- Express
- LangChain.js
- DeepSeek 模型
- Zod 参数校验
- React 前端
整体请求链路如下：

用户输入
 -> React 前端
 -> POST /api/lc/chat/simple
 -> Express 后端路由
 -> LangChain 调用大模型
 -> 返回模型回答
 -> 前端展示结果

## 后端入口配置

在 Express 入口文件中，需要先加载环境变量，并开启 JSON 请求体解析：

import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

其中：

import 'dotenv/config';

用于读取 .env 文件，把里面的配置加载到 process.env 中。

例如：

PORT=3000
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_api_key
DEEPSEEK_MODEL=deepseek-chat

而：

app.use(express.json());

用于解析前端传来的 JSON 请求体。如果没有这行，后端可能拿不到 req.body。

## 创建聊天模型

我们把模型创建逻辑封装到 getChatModel 中：

import { ChatDeepSeek } from "@langchain/deepseek";

export function getChatModel() {
  const provider = process.env.LLM_PROVIDER ?? "deepseek";

  if (provider === "deepseek") {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error("DEEPSEEK_API_KEY is required when LLM_PROVIDER=deepseek");
    }

    return new ChatDeepSeek({
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
    });
  }

  throw new Error(`Unsupported LLM_PROVIDER: ${provider}`);
}

这样做的好处是：路由层不用关心模型细节，只需要调用 getChatModel() 即可。

## 请求参数校验

接口接收的参数很简单，只需要一个 input 字段：

import { z } from "zod";

export const textInputSchema = z.object({
  input: z.string().min(1),
});

这表示请求体必须是：

{
  "input": "你好"
}

其中 input 必须是非空字符串。

如果传入：

{}

或者：

{
  "input": ""
}

都会校验失败。

## 异步路由错误处理

因为接口内部会使用 async/await，所以可以封装一个 asyncRoute：

export function asyncRoute(handler) {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
}

它的作用是捕获异步路由中的错误，并交给 Express 的统一错误处理中间件处理。

## 基础聊天接口

核心接口代码如下：

import { Router } from "express";
import { asyncRoute } from "../shared/async-route.js";
import { getChatModel } from "../ai/models.js";
import { textInputSchema } from "../shared/validation.js";

export const langchainRouter = Router();

langchainRouter.post(
  "/chat/simple",
  asyncRoute(async (req, res) => {
    const body = textInputSchema.parse(req.body);
    const model = getChatModel();
    const result = await model.invoke(body.input);

    res.json({
      ok: true,
      data: {
        input: body.input,
        output: result.content,
      },
    });
  }),
);

这段代码做了几件事：

1. 注册一个 POST 接口 /chat/simple
2. 使用 Zod 校验请求体
3. 创建聊天模型
4. 调用模型的 invoke 方法
5. 把模型回答返回给前端
完整请求路径通常是：

POST /api/lc/chat/simple

请求示例：

{
  "input": "你是谁？"
}

返回示例：

{
  "ok": true,
  "data": {
    "input": "你是谁？",
    "output": "我是一个 AI 助手，可以帮助你回答问题、整理资料和完成一些文本任务。"
  }
}

## 前端调用方式

前端只需要发送一个 POST 请求：

postJson("/api/lc/chat/simple", { input });

一个简单的封装如下：

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    throw new Error(payload.message ?? payload.error ?? `Request failed: ${response.status}`);
  }

  return payload.data as T;
}

前端负责收集用户输入，后端负责调用模型，最终把 output 展示到页面上。

## 为什么这个例子重要

这个基础聊天接口是所有 AI 应用的起点。

后续无论是：

- 流式输出
- 工具调用
- RAG 知识库问答
- 多轮对话
- LangGraph 工作流
本质上都离不开这个最小链路：

接收用户输入 -> 调用模型 -> 返回结果

先把这个链路跑通，后面的功能才有稳定的基础。

总结

本文实现了一个最小可用的 AI 聊天接口：

- 使用 Express 提供 HTTP 接口
- 使用 Zod 校验请求参数
- 使用 LangChain 创建聊天模型
- 使用 model.invoke() 调用大模型
- 返回统一 JSON 格式给前端
这就是一个完整的基础 AI 聊天闭环。后续可以在这个基础上继续扩展流式响应、工具调用、RAG 和工作流能力。
