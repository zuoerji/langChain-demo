
/**
 * 根据用户输入，分类
 * 
 * 投诉|订单|价格|聊天
 * 
 * return string（complaint | order | pricing | chat）
 * 
*/
export const classifyTicket = (input) => {
  const intent = /投诉|差评|生气|赔偿/.test(input)
    ? "complaint"
    : /订单|多少钱|退款|发货/.test(input)
      ? "order"
      : /价格|多少钱|费用|套餐/.test(input)
        ? 'pricing'
        : 'chat';

  return {
    intent,
    priority: intent === 'complaint' ? 'high' : intent === 'chat' ? 'low' : 'normal',
  }
}