import mongoose from 'mongoose'
import { enforceAppendOnly } from './appendOnly.js'

const entityTypes = [
  'User',
  'Category',
  'Medicine',
  'Supplier',
  'Batch',
  'Purchase',
  'Sale',
  'StockMovement',
]

const auditLogSchema = new mongoose.Schema(
  {
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      immutable: true,
    },
    entityType: {
      type: String,
      enum: entityTypes,
      required: true,
      immutable: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'entityType',
      immutable: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
      immutable: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      immutable: true,
    },
  },
  { versionKey: false },
)

auditLogSchema.index({ performedBy: 1, timestamp: -1 })
auditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 })

enforceAppendOnly(auditLogSchema, 'AuditLog')

export default mongoose.models.AuditLog ||
  mongoose.model('AuditLog', auditLogSchema)
