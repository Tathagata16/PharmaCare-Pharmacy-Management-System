import mongoose from 'mongoose'

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { timestamps: true },
)

categorySchema.index({ name: 1 }, { unique: true })

export default mongoose.models.Category ||
  mongoose.model('Category', categorySchema)
