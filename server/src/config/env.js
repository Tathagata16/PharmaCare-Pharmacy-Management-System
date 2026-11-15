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
}
