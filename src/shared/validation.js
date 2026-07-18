

/**
 * zod:
 * 
 * z.string().min(1): 字符串至少有 1个长度
 * 
*/
import { z } from 'zod'
export const threadInputSchema = z.object({
  input: z.string().min(1),
  threadId: z.string().min(1).default('demo-thread')
})


export const expressionSchema = z.object({
  expression: z.string().min(1)
})