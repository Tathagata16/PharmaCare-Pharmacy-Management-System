import mongoose from 'mongoose'

const batchSchema = new mongoose.Schema(
  {
    medicine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
    },
    batchNumber: { type: String, required: true, trim: true, maxlength: 100 },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'quantity must be a whole number',
      },
    },
    purchasePrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    expiryDate: { type: Date, required: true },
    receivedDate: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
)

batchSchema.index({ medicine: 1, batchNumber: 1 }, { unique: true })
batchSchema.index({ medicine: 1, expiryDate: 1 })
batchSchema.index({ supplier: 1, receivedDate: -1 })

export default mongoose.models.Batch || mongoose.model('Batch', batchSchema)
