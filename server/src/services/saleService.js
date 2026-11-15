import { createHash, randomUUID } from 'node:crypto'
import mongoose from 'mongoose'
import { env } from '../config/env.js'
import { AuditLog, Sale, StockMovement } from '../models/index.js'
import { allocateStockFEFO } from './inventoryService.js'

function httpError(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

function money(value) {
  return Number(value.toFixed(2))
}

function hashRequest({ items, discount, paymentMethod }) {
  return createHash('sha256')
    .update(JSON.stringify({ items, discount, paymentMethod }))
    .digest('hex')
}

function createInvoiceNumber() {
  return `SALE-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID()}`
}

async function findSaleByIdempotencyKey(idempotencyKey, soldBy) {
  return Sale.findOne({ idempotencyKey, soldBy }).select('+requestHash').lean()
}

function assertSameRequest(sale, requestHash) {
  if (sale.requestHash !== requestHash) {
    throw httpError(409, 'Idempotency key was already used for a different request')
  }
}

export async function createSale({
  idempotencyKey,
  items,
  discount = 0,
  paymentMethod,
  soldBy,
}) {
  const requestHash = hashRequest({ items, discount, paymentMethod })
  const existingSale = await findSaleByIdempotencyKey(idempotencyKey, soldBy)
  if (existingSale) {
    assertSameRequest(existingSale, requestHash)
    return { sale: existingSale, replayed: true }
  }

  const session = await mongoose.startSession()
  let result
  try {
    await session.withTransaction(async () => {
      const priorSale = await Sale.findOne({ idempotencyKey, soldBy })
        .select('+requestHash')
        .session(session)
        .lean()
      if (priorSale) {
        assertSameRequest(priorSale, requestHash)
        result = { sale: priorSale, replayed: true }
        return
      }

      const requestedByMedicine = new Map()
      for (const item of items) {
        requestedByMedicine.set(
          item.medicine,
          (requestedByMedicine.get(item.medicine) ?? 0) + item.quantity,
        )
      }

      const saleId = new mongoose.Types.ObjectId()
      const saleItems = []
      const movements = []
      for (const [medicineId, quantity] of requestedByMedicine) {
        const allocations = await allocateStockFEFO(medicineId, quantity, session)
        for (const allocation of allocations) {
          const unitPrice = allocation.batch.sellingPrice
          const lineTotal = money(unitPrice * allocation.quantity)
          saleItems.push({
            medicine: allocation.medicine._id,
            batch: allocation.batch._id,
            medicineName: allocation.medicine.name,
            genericName: allocation.medicine.genericName,
            brand: allocation.medicine.brand,
            batchNumber: allocation.batch.batchNumber,
            quantity: allocation.quantity,
            returnedQuantity: 0,
            unitPrice,
            lineTotal,
          })
          movements.push({
            medicine: allocation.medicine._id,
            batch: allocation.batch._id,
            movementType: 'sale',
            quantityChanged: -allocation.quantity,
            previousQuantity: allocation.previousQuantity,
            newQuantity: allocation.newQuantity,
            reason: `Sale: ${idempotencyKey}`,
            reference: { model: 'Sale', id: saleId },
            performedBy: soldBy,
          })
        }
      }

      const subtotal = money(saleItems.reduce((sum, item) => sum + item.lineTotal, 0))
      const maximumDiscount = money(subtotal * (env.maxSaleDiscountPercent / 100))
      if (discount > maximumDiscount) {
        throw httpError(400, 'Discount exceeds the permitted limit')
      }
      const tax = money((subtotal - discount) * env.salesTaxRate)
      const totalAmount = money(subtotal - discount + tax)
      const sale = new Sale({
        _id: saleId,
        invoiceNumber: createInvoiceNumber(),
        idempotencyKey,
        requestHash,
        items: saleItems,
        subtotal,
        tax,
        taxRate: env.salesTaxRate,
        discount,
        totalAmount,
        pharmacyName: env.pharmacyName,
        paymentMethod,
        soldBy,
        status: 'completed',
      })
      await sale.save({ session })
      await StockMovement.create(movements, { session, ordered: true })
      await AuditLog.create(
        [
          {
            performedBy: soldBy,
            action: 'sale.completed',
            entityType: 'Sale',
            entityId: saleId,
            details: {
              invoiceNumber: sale.invoiceNumber,
              subtotal,
              tax,
              discount,
              totalAmount,
            },
          },
        ],
        { session, ordered: true },
      )
      result = { sale, replayed: false }
    })
    return result
  } catch (error) {
    if (error.code === 11000) {
      const duplicate = await findSaleByIdempotencyKey(idempotencyKey, soldBy)
      if (duplicate) {
        assertSameRequest(duplicate, requestHash)
        return { sale: duplicate, replayed: true }
      }
    }
    throw error
  } finally {
    await session.endSession()
  }
}

export async function listSales({ page, limit, sortOrder, soldBy }) {
  const filter = soldBy ? { soldBy } : {}
  const sort = { saleDate: sortOrder === 'asc' ? 1 : -1, _id: 1 }
  const [sales, total] = await Promise.all([
    Sale.find(filter)
      .populate('soldBy', 'name email')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Sale.countDocuments(filter),
  ])
  return { sales, total, page, limit }
}

export async function getSaleById(saleId) {
  const sale = await Sale.findById(saleId).populate('soldBy', 'name email').lean()
  if (!sale) throw httpError(404, 'Sale not found')
  return sale
}

export function createInvoiceDetails(sale) {
  return {
    pharmacyName: sale.pharmacyName,
    invoiceNumber: sale.invoiceNumber,
    dateTime: sale.saleDate,
    items: sale.items.map((item) => ({
      medicineName: item.medicineName,
      genericName: item.genericName,
      batchNumber: item.batchNumber,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
    subtotal: sale.subtotal,
    taxRate: sale.taxRate,
    tax: sale.tax,
    discount: sale.discount,
    grandTotal: sale.totalAmount,
    paymentMethod: sale.paymentMethod,
    cashierName: sale.soldBy?.name ?? '',
  }
}
