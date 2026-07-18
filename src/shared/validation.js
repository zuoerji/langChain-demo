

/**
 * zod:
 * 
 * z.string().min(1): 字符串至少有 1个长度
 * 
*/
import { title } from 'process'
import { z } from 'zod'
export const threadInputSchema = z.object({
  input: z.string().min(1),
  threadId: z.string().min(1).default('demo-thread')
})


export const expressionSchema = z.object({
  expression: z.string().min(1)
})


export const ragInputSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1)
})

export const ragQueryInputSchema = z.object({
  question: z.string().min(1),
  topK: z.number().int().min(1).max(5).default(3)
})