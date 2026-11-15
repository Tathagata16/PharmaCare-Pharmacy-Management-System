import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    passwordHash: { type: String, required: true, minlength: 8, select: false },
    role: {
      type: String,
      enum: ['admin', 'pharmacist', 'cashier', 'customer'],
      required: true,
      default: 'cashier',
    },
    isActive: { type: Boolean, default: true, required: true },
    sessionVersion: { type: Number, default: 0, min: 0, select: false },
  },
  { timestamps: true },
)

userSchema.index({ email: 1 }, { unique: true })

userSchema.virtual('password').set(function setPassword(password) {
  this.passwordHash = password
})

userSchema.pre('save', async function hashPassword() {
  if (this.isModified('passwordHash')) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12)
  }
})

userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.passwordHash)
}

export default mongoose.models.User || mongoose.model('User', userSchema)
