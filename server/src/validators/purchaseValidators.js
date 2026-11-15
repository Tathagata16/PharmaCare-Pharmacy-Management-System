import mongoose from 'mongoose'
import { z } from 'zod'

const objectId = z.string().refine((value) => mongoose.isValidObjectId(value), {
  message: 'Invalid ID',
})

const purchaseItem = z
  .object({
    medicine: objectId,
    batchNumber: z.string().trim().min(1).max(100),
    quantity: z.number().int().positive(),
    purchasePrice: z.number().finite().min(0),
    sellingPrice: z.number().finite().min(0),
    expiryDate: z.iso.datetime({ offset: true }).or(z.iso.date()),
  })
  .strict()
  .transform((item) => ({
    ...item,
    expiryDate: new Date(item.expiryDate),
  }))

export const purchaseCreateSchema = z.object({
  body: z
    .object({
      supplier: objectId,
      items: z
        .array(purchaseItem)
        .min(1)
        .max(100)
        .superRefine((items, context) => {
          const seen = new Set()
          items.forEach((item, index) => {
            const key = `${item.medicine}:${item.batchNumber}`
            if (seen.has(key)) {
              context.addIssue({
                code: 'custom',
                path: [index, 'batchNumber'],
                message: 'A medicine and batch number may appear only once per purchase',
              })
            }
            seen.add(key)
          })
        }),
    })
    .strict(),
})

export const purchaseListSchema = z.object({
  query: z
    .object({
      supplier: objectId.optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
    })
    .strict(),
})

export const purchaseIdSchema = z.object({
  params: z
    .object({
      purchaseId: objectId,
    })
    .strict(),
})

export const batchListSchema = z.object({
  query: z
    .object({
      medicine: objectId.optional(),
      supplier: objectId.optional(),
      includeExpired: z.enum(['true', 'false']).default('false'),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
      sortOrder: z.enum(['asc', 'desc']).default('asc'),
    })
    .strict(),
})
