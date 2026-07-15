

export const formateConveration = (messages) => {
  // 对象转 字符串
  const _messages = messages.map((message) => ({
    type: message._getType(),
    content: message.content,
  }));
  const filted = _messages.filter(msg => msg.type === "human" || msg.type === 'ai');
  return filted.map(msg => `${msg.type}: ${msg.content}`).join('\n');
}
