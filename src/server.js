/**
 * 1. 引入 express
 * 2. Router 模块
 *  请求： api/message/get
 * 3. express 返回应用
 *  1. 使用 Router 模块
 *  2. 监听
 * 
 * 前端发请求 -> 后端 -> langChain 
 *  调用大模型：
 *    1. 调什么大模型
 *      1. 本地大模型（1.5b qwen | 7b | 32b） 
 *      2. 线上大模型（推荐）
 *        api_key
 *        base_url
 *    
 * 
*/
import { ZodError } from 'zod';
import 'dotenv/config';
import express, { Router } from 'express';
import { apiRouter } from './routes/index.js';


const router = Router();
const app = express();
const port = Number(process.env.PORT ?? 3000);

// 返回数据处理成 json
app.use(express.json());

// 应用路由 // /api/lc/chat/simple
app.use('/api',apiRouter);

// 报错处理
app.use((req,res) => {
  res.status(404).json({
    ok: false,
    error: "Not Found",
    message: "Route not found"
  })
});

app.use((error, req, res, next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      ok: false,
      error: "验证输入错误",
      message: "请查看请求体",
      details: error.flatten(),
    });
    return;
  }

  res.status(500).json({
    ok: false,
    error: "服务器错误",
    message: "服务器错误"
  });
})

// 监听
app.listen(port,() => {
  console.log(`接口已经启动在: http://127.0.0.1:${port}`);
})