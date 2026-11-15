import mongoose from 'mongoose'
import { z } from 'zod'

const supplierFields = {
  name: z.string().trim().min(1).max(160),
  contactPerson: z.string().trim().max(120).default(''),
  email: z
    .string()
    .trim()
    .max(254)
    .refine((value) => value === '' || z.email().safeParse(value).success, {
      message: 'Invalid email address',
    })
    .transform((value) => value.toLowerCase())
    .default(''),
  phone: z
    .string()
    .trim()
    .max(40)
    .regex(/^\+?[\d\s().-]{7,40}$/, 'Invalid phone number')
    .or(z.literal(''))
    .default(''),
  address: z.string().trim().max(500).default(''),
  isActive: z.boolean().default(true),
}

const supplierEmail = z
  .string()
  .trim()
  .max(254)
  .refine((value) => value === '' || z.email().safeParse(value).success, {
    message: 'Invalid email address',
  })
  .transform((value) => value.toLowerCase())

const supplierPhone = z
  .string()
  .trim()
  .max(40)
  .regex(/^\+?[\d\s().-]{7,40}$/, 'Invalid phone number')
  .or(z.literal(''))

const supplierId = z.string().refine((value) => mongoose.isValidObjectId(value), {
  message: 'Invalid supplier ID',
})

export const supplierCreateSchema = z.object({
  body: z.object(supplierFields).strict(),
})

export const supplierUpdateSchema = z.object({
  params: z.object({ supplierId }).strict(),
  body: z
    .object({
      name: supplierFields.name.optional(),
      contactPerson: z.string().trim().max(120).optional(),
      email: supplierEmail.optional(),
      phone: supplierPhone.optional(),
      address: z.string().trim().max(500).optional(),
      isActive: z.boolean().optional(),
    })
    .strict()
    .refine((body) => Object.keys(body).length > 0, {
      message: 'At least one field must be provided',
    }),
})

export const supplierActivationSchema = z.object({
  params: z.object({ supplierId }).strict(),
  body: z.object({ isActive: z.boolean() }).strict(),
})

export const supplierIdSchema = z.object({
  params: z.object({ supplierId }).strict(),
})

export const supplierListSchema = z.object({
  query: z
    .object({
      search: z.string().trim().max(160).optional(),
      isActive: z.enum(['true', 'false']).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
      sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('name'),
      sortOrder: z.enum(['asc', 'desc']).default('asc'),
    })
    .strict(),
})

export const supplierPurchaseHistorySchema = z.object({
  params: z.object({ supplierId }).strict(),
  query: z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    })
    .strict(),
})
