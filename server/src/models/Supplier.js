import mongoose from 'mongoose'

const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    contactPerson: { type: String, trim: true, maxlength: 120, default: '' },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      default: '',
      match: /^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 40,
      default: '',
      validate: {
        validator: (value) => !value || /^\+?[\d\s().-]{7,40}$/.test(value),
        message: 'phone must contain a valid phone number',
      },
    },
    address: { type: String, trim: true, maxlength: 500, default: '' },
    isActive: { type: Boolean, default: true, required: true },
  },
  { timestamps: true },
)

supplierSchema.index({ name: 1 })

export default mongoose.models.Supplier ||
  mongoose.model('Supplier', supplierSchema)
