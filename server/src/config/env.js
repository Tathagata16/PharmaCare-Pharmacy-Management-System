import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5001),
  MONGODB_URI: z
    .string()
    .regex(/^mongodb(?:\+srv)?:\/\//, 'must be a MongoDB connection string'),
  CLIENT_ORIGIN: z
    .string()
    .url()
    .transform((value) => new URL(value).origin)
    .default('http://localhost:5173'),
  JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),
  JWT_ACCESS_TOKEN_TTL: z.string().regex(/^\d+[smhd]$/).default('15m'),
  SALES_TAX_RATE: z.coerce.number().min(0).max(1).default(0),
  MAX_SALE_DISCOUNT_PERCENT: z.coerce.number().min(0).max(100).default(20),
  PHARMACY_NAME: z.string().trim().min(1).max(160).default('PharmaCare Pharmacy'),
})

const result = envSchema.safeParse(process.env)

if (!result.success) {
  const issues = result.error.issues
    .map(({ path, message }) => `${path.join('.') || 'environment'}: ${message}`)
    .join('; ')
  throw new Error(`Invalid environment configuration: ${issues}`)
}

export const env = {
  nodeEnv: result.data.NODE_ENV,
  port: result.data.PORT,
  mongoUri: result.data.MONGODB_URI,
  clientOrigin: result.data.CLIENT_ORIGIN,
  jwtSecret: result.data.JWT_SECRET,
  jwtAccessTokenTtl: result.data.JWT_ACCESS_TOKEN_TTL,
  salesTaxRate: result.data.SALES_TAX_RATE,
  maxSaleDiscountPercent: result.data.MAX_SALE_DISCOUNT_PERCENT,
  pharmacyName: result.data.PHARMACY_NAME,
}
