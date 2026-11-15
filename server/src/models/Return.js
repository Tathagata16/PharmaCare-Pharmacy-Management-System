import mongoose from 'mongoose'

const returnItemSchema = new mongoose.Schema(
  {
    medicine: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
    batchNumber: { type: String, required: true, trim: true, maxlength: 100 },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
    unitPrice: { type: Number, required: true, min: 0 },
    refundAmount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
)

const returnSchema = new mongoose.Schema(
  {
    returnReference: { type: String, required: true, trim: true, maxlength: 120 },
    idempotencyKey: { type: String, required: true, trim: true, maxlength: 120 },
    requestHash: { type: String, required: true, select: false },
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', required: true },
    invoiceNumber: { type: String, required: true, trim: true, maxlength: 100 },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    items: { type: [returnItemSchema], required: true, validate: hasItems },
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending_inspection', 'inspected'],
      required: true,
      default: 'pending_inspection',
    },
  },
  { timestamps: true },
)

returnSchema.index({ returnReference: 1 }, { unique: true })
returnSchema.index({ processedBy: 1, idempotencyKey: 1 }, { unique: true })
returnSchema.index({ sale: 1, createdAt: -1 })

function hasItems(items) {
  return Array.isArray(items) && items.length > 0
}

export default mongoose.models.Return || mongoose.model('Return', returnSchema)
