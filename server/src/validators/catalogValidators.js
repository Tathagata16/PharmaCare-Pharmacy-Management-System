import mongoose from 'mongoose'
import { z } from 'zod'

const objectId = z.string().refine((value) => mongoose.isValidObjectId(value), {
  message: 'Invalid ID',
})

const medicineFields = {
  name: z.string().trim().min(1).max(160),
  genericName: z.string().trim().min(1).max(160),
  brand: z.string().trim().max(120).default(''),
  category: objectId,
  manufacturer: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).default(''),
  reorderLevel: z.number().int().min(0).default(10),
  isActive: z.boolean().default(true),
}

export const medicineCreateSchema = z.object({
  body: z.object(medicineFields).strict(),
})

export const medicineUpdateSchema = z.object({
  params: z.object({ medicineId: objectId }).strict(),
  body: z
    .object({
      name: medicineFields.name.optional(),
      genericName: medicineFields.genericName.optional(),
      brand: z.string().trim().max(120).optional(),
      category: medicineFields.category.optional(),
      manufacturer: medicineFields.manufacturer.optional(),
      description: z.string().trim().max(2000).optional(),
      reorderLevel: z.number().int().min(0).optional(),
      isActive: z.boolean().optional(),
    })
    .strict()
    .refine((body) => Object.keys(body).length > 0, {
      message: 'At least one field must be provided',
    }),
})

export const medicineIdSchema = z.object({
  params: z.object({ medicineId: objectId }).strict(),
})

export const medicineListSchema = z.object({
  query: z
    .object({
      search: z.string().trim().max(160).optional(),
      name: z.string().trim().max(160).optional(),
      genericName: z.string().trim().max(160).optional(),
      category: objectId.optional(),
      manufacturer: z.string().trim().max(160).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
      sortBy: z
        .enum(['name', 'genericName', 'manufacturer', 'reorderLevel', 'createdAt', 'updatedAt'])
        .default('name'),
      sortOrder: z.enum(['asc', 'desc']).default('asc'),
    })
    .strict(),
})

export const categoryCreateSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1).max(100),
      description: z.string().trim().max(1000).default(''),
    })
    .strict(),
})

export const categoryUpdateSchema = z.object({
  params: z.object({ categoryId: objectId }).strict(),
  body: z
    .object({
      name: z.string().trim().min(1).max(100).optional(),
      description: z.string().trim().max(1000).optional(),
    })
    .strict()
    .refine((body) => Object.keys(body).length > 0, {
      message: 'At least one field must be provided',
    }),
})

export const categoryIdSchema = z.object({
  params: z.object({ categoryId: objectId }).strict(),
})
