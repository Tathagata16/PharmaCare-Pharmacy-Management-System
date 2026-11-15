import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import mongoose from 'mongoose'
import morgan from 'morgan'
import swaggerUi from 'swagger-ui-express'
import { env } from './config/env.js'
import { openapi } from './config/openapi.js'
import authRoutes from './routes/authRoutes.js'
import { errorHandler } from './middleware/errorHandler.js'
import { notFound } from './middleware/notFound.js'
import categoryRoutes from './routes/categoryRoutes.js'
import medicineRoutes from './routes/medicineRoutes.js'
import supplierRoutes from './routes/supplierRoutes.js'
import purchaseRoutes from './routes/purchaseRoutes.js'
import batchRoutes from './routes/batchRoutes.js'
import inventoryRoutes from './routes/inventoryRoutes.js'
import saleRoutes from './routes/saleRoutes.js'
import returnRoutes from './routes/returnRoutes.js'
import reportRoutes from './routes/reportRoutes.js'

const app = express()

app.disable('x-powered-by')
app.use(helmet())
app.use(cors({ origin: env.clientOrigin }))
app.use(express.json({ limit: '10kb' }))
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'))

app.get('/api/docs.json', (req, res) => res.json(openapi))
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi))
app.use('/api/auth', authRoutes)
app.use('/api/medicines', medicineRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/suppliers', supplierRoutes)
app.use('/api/purchases', purchaseRoutes)
app.use('/api/batches', batchRoutes)
app.use('/api/inventory', inventoryRoutes)
app.use('/api/sales', saleRoutes)
app.use('/api/returns', returnRoutes)
app.use('/api/reports', reportRoutes)

app.get('/api/health', (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1
  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? 'ok' : 'unavailable',
    database: databaseConnected ? 'connected' : 'disconnected',
  })
})

app.use(notFound)
app.use(errorHandler)

export default app
