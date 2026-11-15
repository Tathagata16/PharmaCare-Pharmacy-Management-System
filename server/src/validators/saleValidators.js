import mongoose from 'mongoose'
import { z } from 'zod'

const objectId = z.string().refine((value) => mongoose.isValidObjectId(value), {
  message: 'Invalid ID',
})

export const saleCreateSchema = z.object({
  body: z
    .object({
      idempotencyKey: z.string().trim().min(8).max(120),
      items: z
        .array(
          z
            .object({
              medicine: objectId,
              quantity: z.number().int().positive(),
            })
            .strict(),
        )
        .min(1)
        .max(100),
      discount: z.number().finite().min(0).default(0),
      paymentMethod: z.enum(['cash', 'card', 'mobile_money', 'other']),
    })
    .strict(),
})

export const saleListSchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
    })
    .strict(),
})

export const saleIdSchema = z.object({
  params: z.object({ saleId: objectId }).strict(),
})
