import mongoose from 'mongoose'
import { enforceAppendOnly } from './appendOnly.js'

const referenceSchema = new mongoose.Schema(
  {
    model: {
      type: String,
      enum: ['Purchase', 'Sale'],
      required: true,
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'reference.model',
    },
  },
  { _id: false },
)

const stockMovementSchema = new mongoose.Schema(
  {
    medicine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
      immutable: true,
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: true,
      immutable: true,
    },
    movementType: {
      type: String,
      enum: ['purchase', 'sale', 'return', 'adjustment'],
      required: true,
      immutable: true,
    },
    quantityChanged: {
      type: Number,
      required: true,
      validate: [
        { validator: Number.isInteger, message: 'quantityChanged must be a whole number' },
        { validator: (value) => value !== 0, message: 'quantityChanged cannot be zero' },
      ],
      immutable: true,
    },
    previousQuantity: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isInteger,
      immutable: true,
    },
    newQuantity: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isInteger,
      immutable: true,
    },
    reason: { type: String, required: true, trim: true, maxlength: 500, immutable: true },
    reference: { type: referenceSchema, default: undefined, immutable: true },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      immutable: true,
    },
    timestamp: { type: Date, required: true, default: Date.now, immutable: true },
  },
  { versionKey: false },
)

stockMovementSchema.index({ medicine: 1, timestamp: -1 })
stockMovementSchema.index({ batch: 1, timestamp: -1 })
stockMovementSchema.index({ performedBy: 1, timestamp: -1 })

stockMovementSchema.pre('validate', function validateQuantityTransition() {
  if (
    Number.isInteger(this.quantityChanged) &&
    Number.isInteger(this.previousQuantity) &&
    Number.isInteger(this.newQuantity) &&
    this.previousQuantity + this.quantityChanged !== this.newQuantity
  ) {
    this.invalidate(
      'newQuantity',
      'newQuantity must equal previousQuantity plus quantityChanged',
    )
  }
})

enforceAppendOnly(stockMovementSchema, 'StockMovement')

export default mongoose.models.StockMovement ||
  mongoose.model('StockMovement', stockMovementSchema)
