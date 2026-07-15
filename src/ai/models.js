

import { ChatDeepSeek } from '@langchain/deepseek';

export const getChatModel = () => {
  const provide = process.env.LLM_PROVIDER ?? 'deepseek';
  if (provide === 'deepseek') {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error('没有 api_key');
    }
    return new ChatDeepSeek({
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: 'deepseek-chat'
    });
  }
 throw new Error('没有大模型');
}