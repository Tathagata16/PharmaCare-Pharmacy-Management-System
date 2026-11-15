import mongoose from 'mongoose'
import { z } from 'zod'

const objectId = z.string().refine((value) => mongoose.isValidObjectId(value), {
  message: 'Invalid ID',
})

export const returnCreateSchema = z.object({
  body: z
    .object({
      idempotencyKey: z.string().trim().min(8).max(120),
      invoiceNumber: z.string().trim().min(1).max(100),
      reason: z.string().trim().min(1).max(500),
      items: z
        .array(
          z
            .object({
              batch: objectId,
              quantity: z.number().int().positive(),
            })
            .strict(),
        )
        .min(1)
        .max(100),
    })
    .strict(),
})

export const returnListSchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    })
    .strict(),
})

export const returnIdSchema = z.object({
  params: z.object({ returnId: objectId }).strict(),
})
