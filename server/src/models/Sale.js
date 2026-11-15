import mongoose from 'mongoose'

const saleItemSchema = new mongoose.Schema(
  {
    medicine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: true,
    },
    medicineName: { type: String, required: true, trim: true, maxlength: 160 },
    genericName: { type: String, required: true, trim: true, maxlength: 160 },
    brand: { type: String, trim: true, maxlength: 120, default: '' },
    batchNumber: { type: String, required: true, trim: true, maxlength: 100 },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
)

const saleSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    items: { type: [saleItemSchema], required: true, validate: hasItems },
    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, required: true, min: 0, default: 0 },
    discount: { type: Number, required: true, min: 0, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'mobile_money', 'other'],
      required: true,
    },
    soldBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    saleDate: { type: Date, required: true, default: Date.now },
    status: {
      type: String,
      enum: ['completed', 'voided', 'refunded'],
      required: true,
      default: 'completed',
    },
  },
  { timestamps: true },
)

saleSchema.index({ invoiceNumber: 1 }, { unique: true })
saleSchema.index({ saleDate: -1 })
saleSchema.index({ soldBy: 1, saleDate: -1 })

function hasItems(items) {
  return Array.isArray(items) && items.length > 0
}

export default mongoose.models.Sale || mongoose.model('Sale', saleSchema)
