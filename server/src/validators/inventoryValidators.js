import mongoose from 'mongoose'
import { z } from 'zod'

const objectId = z.string().refine((value) => mongoose.isValidObjectId(value), {
  message: 'Invalid ID',
})

export const medicineStockSchema = z.object({
  params: z.object({ medicineId: objectId }).strict(),
})

export const inventoryAlertSchema = z.object({
  query: z
    .object({
      warningDays: z.coerce.number().int().min(1).max(365).default(30),
    })
    .strict(),
})

export const stockAdjustmentSchema = z.object({
  body: z
    .object({
      batch: objectId,
      adjustmentType: z.enum([
        'damaged',
        'expired',
        'missing',
        'physical_correction',
        'other',
      ]),
      quantityChange: z.number().int().refine((value) => value !== 0, {
        message: 'quantityChange cannot be zero',
      }),
      reason: z.string().trim().min(1).max(500),
    })
    .strict()
    .refine(
      ({ adjustmentType, quantityChange }) =>
        !['damaged', 'expired', 'missing'].includes(adjustmentType) || quantityChange < 0,
      {
        message: 'Damaged, expired, and missing stock adjustments must reduce quantity',
        path: ['quantityChange'],
      },
    ),
})

export const batchListQuerySchema = z.object({
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
