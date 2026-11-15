import mongoose from 'mongoose'
import { z } from 'zod'
import { roles } from '../auth/roles.js'

const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase())
const password = z.string().min(8).max(128)

export const registerSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1).max(120),
      email,
      password,
    })
    .strict(),
})

export const loginSchema = z.object({
  body: z
    .object({
      email,
      password: z.string().min(1).max(128),
    })
    .strict(),
})

export const userListSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  }).strict(),
})

export const userIdSchema = z.object({
  params: z
    .object({
      userId: z.string().refine((value) => mongoose.isValidObjectId(value), {
        message: 'Invalid user ID',
      }),
    })
    .strict(),
})

export const userRoleSchema = z.object({
  params: userIdSchema.shape.params,
  body: z
    .object({
      role: z.enum([roles.ADMIN, roles.PHARMACIST, roles.CASHIER, roles.CUSTOMER]),
    })
    .strict(),
})

export const userActivationSchema = z.object({
  params: userIdSchema.shape.params,
  body: z
    .object({
      isActive: z.boolean(),
    })
    .strict(),
})
