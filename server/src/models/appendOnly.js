const mutationOperations = [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'findOneAndReplace',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
]

export function enforceAppendOnly(schema, modelName) {
  const rejectMutation = function rejectMutation() {
    throw new Error(`${modelName} records are append-only`)
  }

  schema.pre('save', function preventDocumentUpdate() {
    if (!this.isNew) {
      rejectMutation()
    }
  })

  for (const operation of mutationOperations) {
    schema.pre(operation, rejectMutation)
  }

  schema.pre('deleteOne', { document: true, query: false }, rejectMutation)
}
