import mongoose from 'mongoose'
import { z } from 'zod'

const objectId = z.string().refine((value) => mongoose.isValidObjectId(value), {
  message: 'Invalid ID',
})

const dateRange = {
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
}

function validDateRange(range) {
  if (!range.from || !range.to) return true
  return new Date(range.from) <= new Date(range.to)
}

export const salesReportSchema = z.object({
  query: z
    .object({
      period: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
      ...dateRange,
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    })
    .strict()
    .refine(validDateRange, { message: 'from must not be after to' }),
})

export const stockReportSchema = z.object({
  query: z
    .object({
      from: dateRange.from,
      to: dateRange.to,
      medicine: objectId.optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    })
    .strict()
    .refine(validDateRange, { message: 'from must not be after to' }),
})

export const supplierReportSchema = z.object({
  query: z
    .object({
      from: dateRange.from,
      to: dateRange.to,
      supplier: objectId.optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    })
    .strict()
    .refine(validDateRange, { message: 'from must not be after to' }),
})

export const movementHistorySchema = z.object({
  query: z
    .object({
      medicine: objectId.optional(),
      batch: objectId.optional(),
      movementType: z.enum(['purchase', 'sale', 'return', 'adjustment']).optional(),
      from: dateRange.from,
      to: dateRange.to,
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    })
    .strict()
    .refine(validDateRange, { message: 'from must not be after to' }),
})
