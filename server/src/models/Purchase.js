import mongoose from 'mongoose'

const purchaseItemSchema = new mongoose.Schema(
  {
    medicine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
    },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
    batchNumber: { type: String, required: true, trim: true, maxlength: 100 },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
)

const purchaseSchema = new mongoose.Schema(
  {
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    items: { type: [purchaseItemSchema], required: true, validate: hasItems },
    totalAmount: { type: Number, required: true, min: 0 },
    purchaseDate: { type: Date, required: true, default: Date.now },
    status: {
      type: String,
      enum: ['pending', 'received', 'cancelled'],
      required: true,
      default: 'pending',
    },
  },
  { timestamps: true },
)

purchaseSchema.index({ supplier: 1, invoiceNumber: 1 }, { unique: true })
purchaseSchema.index({ purchaseDate: -1 })

function hasItems(items) {
  return Array.isArray(items) && items.length > 0
}

export default mongoose.models.Purchase ||
  mongoose.model('Purchase', purchaseSchema)
