import mongoose from 'mongoose'

const medicineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    genericName: { type: String, required: true, trim: true, maxlength: 160 },
    brand: { type: String, trim: true, maxlength: 120, default: '' },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    manufacturer: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    reorderLevel: {
      type: Number,
      required: true,
      default: 10,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'reorderLevel must be a whole number',
      },
    },
    isActive: { type: Boolean, default: true, required: true },
  },
  { timestamps: true },
)

medicineSchema.index({ name: 1, genericName: 1 })

export default mongoose.models.Medicine ||
  mongoose.model('Medicine', medicineSchema)
