import { connectDatabase } from '../config/database.js'
import { Batch, Category, Medicine, Supplier } from '../models/index.js'
import { medicineCatalog } from './medicineCatalog.js'
import mongoose from 'mongoose'

const categories = [
  { name: 'Pain Relief', description: 'Non-prescription pain and fever relief.' },
  { name: 'Digestive Health', description: 'Products for common digestive concerns.' },
  { name: 'First Aid', description: 'Basic wound-care and first-aid supplies.' },
  { name: 'Allergy Care', description: 'Products for common allergy symptoms.' },
  { name: 'Cold & Respiratory', description: 'Products for common cold and respiratory symptoms.' },
  { name: 'Skin Care', description: 'Topical skin care and common skin treatments.' },
  { name: 'Vitamins & Supplements', description: 'Dietary supplements and vitamins.' },
  { name: 'Eye & Ear Care', description: 'Products for common eye and ear care needs.' },
  { name: 'Oral Care', description: 'Medicines and products for oral care.' },
  { name: 'Women’s Health', description: 'Women’s health products and supplements.' },
]

const suppliers = [
  {
    name: 'Northstar Medical Supply',
    contactPerson: 'Avery Brooks',
    email: 'orders@northstarmed.example',
    phone: '+1-555-0101',
    address: '120 Market Street, Example City',
  },
  {
    name: 'Cedar Ridge Distributors',
    contactPerson: 'Jordan Lee',
    email: 'supply@cedarridge.example',
    phone: '+1-555-0102',
    address: '48 Harbor Avenue, Example City',
  },
]

const medicines = [
  {
    name: 'Acetaminophen 500 mg',
    genericName: 'Acetaminophen',
    brand: 'ClearDay',
    categoryName: 'Pain Relief',
    manufacturer: 'Fictional Valley Labs',
    description: 'Demo product record; not medical advice.',
    reorderLevel: 20,
  },
  {
    name: 'Cetirizine 10 mg',
    genericName: 'Cetirizine',
    brand: 'BreezeWell',
    categoryName: 'Pain Relief',
    manufacturer: 'Fictional Valley Labs',
    description: 'Demo product record; not medical advice.',
    reorderLevel: 12,
  },
  {
    name: 'Oral Rehydration Salts',
    genericName: 'Oral electrolyte solution',
    brand: 'HydraDemo',
    categoryName: 'Digestive Health',
    manufacturer: 'Example Botanics & Health',
    description: 'Fictional seed catalog entry.',
    reorderLevel: 15,
  },
  {
    name: 'Adhesive Bandages',
    genericName: 'Adhesive wound dressing',
    brand: 'CarePatch',
    categoryName: 'First Aid',
    manufacturer: 'Example Botanics & Health',
    description: 'Fictional seed catalog entry.',
    reorderLevel: 10,
  },
]

const batches = [
  {
    medicineName: 'Acetaminophen 500 mg',
    supplierName: 'Northstar Medical Supply',
    batchNumber: 'DEMO-AC-2026-01',
    quantity: 120,
    purchasePrice: 2.4,
    sellingPrice: 4.5,
    expiryDate: '2028-06-30',
    receivedDate: '2026-10-15',
  },
  {
    medicineName: 'Cetirizine 10 mg',
    supplierName: 'Northstar Medical Supply',
    batchNumber: 'DEMO-CE-2026-01',
    quantity: 80,
    purchasePrice: 3.1,
    sellingPrice: 5.75,
    expiryDate: '2028-03-31',
    receivedDate: '2026-10-20',
  },
  {
    medicineName: 'Oral Rehydration Salts',
    supplierName: 'Cedar Ridge Distributors',
    batchNumber: 'DEMO-OR-2026-01',
    quantity: 60,
    purchasePrice: 1.2,
    sellingPrice: 2.5,
    expiryDate: '2027-12-31',
    receivedDate: '2026-10-25',
  },
  {
    medicineName: 'Adhesive Bandages',
    supplierName: 'Cedar Ridge Distributors',
    batchNumber: 'DEMO-AB-2026-01',
    quantity: 150,
    purchasePrice: 0.8,
    sellingPrice: 1.75,
    expiryDate: '2029-01-31',
    receivedDate: '2026-10-28',
  },
]

async function upsertByName(Model, data) {
  return Model.findOneAndUpdate(
    { name: data.name },
    { $setOnInsert: data },
    { upsert: true, returnDocument: 'after', runValidators: true },
  )
}

async function seed() {
  await connectDatabase()

  const categoryByName = new Map()
  for (const data of categories) {
    categoryByName.set(data.name, await upsertByName(Category, data))
  }

  const supplierByName = new Map()
  for (const data of suppliers) {
    supplierByName.set(data.name, await upsertByName(Supplier, data))
  }

  const medicineByName = new Map()
  for (const { categoryName, ...data } of medicines) {
    const category = categoryByName.get(categoryName)
    const medicine = await Medicine.findOneAndUpdate(
      { name: data.name, manufacturer: data.manufacturer },
      { $setOnInsert: { ...data, category: category._id } },
      { upsert: true, returnDocument: 'after', runValidators: true },
    )
    medicineByName.set(data.name, medicine)
  }

  for (const { categoryName, price, ...data } of medicineCatalog) {
    const category = categoryByName.get(categoryName)
    const medicine = await Medicine.findOneAndUpdate(
      { name: data.name, manufacturer: 'PharmaCare Demo Manufacturer' },
      {
        $setOnInsert: {
          ...data,
          brand: 'Generic',
          category: category._id,
          manufacturer: 'PharmaCare Demo Manufacturer',
          reorderLevel: 10,
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: true },
    )
    medicineByName.set(data.name, medicine)
  }

  for (const { medicineName, supplierName, expiryDate, receivedDate, ...data } of batches) {
    const medicine = medicineByName.get(medicineName)
    const supplier = supplierByName.get(supplierName)
    await Batch.findOneAndUpdate(
      { medicine: medicine._id, batchNumber: data.batchNumber },
      {
        $setOnInsert: {
          ...data,
          medicine: medicine._id,
          supplier: supplier._id,
          expiryDate: new Date(expiryDate),
          receivedDate: new Date(receivedDate),
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: true },
    )
  }

  const expiryDate = new Date()
  expiryDate.setFullYear(expiryDate.getFullYear() + 3)
  const receivedDate = new Date()
  for (const [index, catalogEntry] of medicineCatalog.entries()) {
    const medicine = medicineByName.get(catalogEntry.name)
    const supplier = supplierByName.get(
      index % 2 === 0 ? suppliers[0].name : suppliers[1].name,
    )
    const batchNumber = `DEMO-CATALOG-${String(index + 1).padStart(3, '0')}`
    await Batch.findOneAndUpdate(
      { medicine: medicine._id, batchNumber },
      {
        $setOnInsert: {
          medicine: medicine._id,
          supplier: supplier._id,
          batchNumber,
          quantity: 40,
          purchasePrice: Number((catalogEntry.price * 0.65).toFixed(2)),
          sellingPrice: catalogEntry.price,
          expiryDate,
          receivedDate,
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: true },
    )
  }

  console.log(
    `Seed complete: ${categories.length} categories, ${medicineCatalog.length} catalog medicines, ${medicines.length} sample medicines, ${suppliers.length} suppliers, ${batches.length + medicineCatalog.length} batches (existing records were left unchanged).`,
  )
}

seed()
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
