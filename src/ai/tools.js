
import { z } from 'zod';
export const formateConveration = (messages) => {
  // 对象转 字符串
  const _messages = messages.map((message) => ({
    type: message._getType(),
    content: message.content,
  }));
  const filted = _messages.filter(msg => msg.type === "human" || msg.type === 'ai');
  return filted.map(msg => `${msg.type}: ${msg.content}`).join('\n');
}

const orders = new Map([
  [
    '1001',
    {
      orderId: '1001',
      status: 'shipped',
      carrier: "SF Express",
      eta: '2026-08-06'
    }
  ],
  [
    '1002',
    {
      orderId: '1002',
      // 退款中
      status: 'refund_pending',
      carrier: "SF Express",
      eta: '2026-08-10'
    }
  ],
])

export const tools = [
  {
    toolName: "order_lookup",
    description: "查看订单",
    invoke: ({ orderId }) => {
      const id = String(orderId ?? '');
      return orders.get(id) ?? { orderId: id, status: "not_found" }
    }
  },
  {
    toolName: 'calculator',
    description: "简单计算器",
    invoke: ({ expression }) => {
      const input = String(expression ?? '');
      const reg = /^[\d+\-*/().\s]+$/;
      if (!reg.test(input)) {
        return { error: "只能写简单的计算" }
      }
      const output = Function(`"use strict"; return (${input});`)();
      return { expression: input, output };
    }
  }
];

export const guessToolCall = (input) => {
  // 订单 1001 -》 1001
  const orderId = input.match(/(?:订单|order)\s*#?\s*(\d+)/i)?.[1];
  if (orderId) {
    return {
      toolName: 'order_lookup',
      args: { orderId }
    }
  }
}


export const formatTools = (tools) => {
  const _tools = tools.map(tool => ({
    name: tool.toolName,
    description: tool.description
  }));
  return _tools.map(tool => `${tool.name}: ${tool.description}`).join('\n');
}