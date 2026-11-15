import {
  createMedicine,
  deleteMedicine,
  getCurrentMedicinePrices,
  getMedicineById,
  listMedicines,
  updateMedicine,
} from '../services/medicineService.js'

function canManageMedicines(user) {
  return user.role === 'admin' || user.role === 'pharmacist'
}

export async function getMedicines(req, res) {
  const result = await listMedicines({
    ...req.validated.query,
    includeInactive: canManageMedicines(req.user),
  })
  const prices = await getCurrentMedicinePrices(result.medicines.map(({ _id }) => _id))
  if (req.user.role === 'customer') {
    result.medicines = result.medicines.map((medicine) => ({
      _id: medicine._id,
      name: medicine.name,
      genericName: medicine.genericName,
      brand: medicine.brand,
      category: medicine.category,
      manufacturer: medicine.manufacturer,
      description: medicine.description,
      price: prices.get(medicine._id.toString()) ?? null,
    }))
  } else {
    result.medicines = result.medicines.map((medicine) => ({
      ...medicine,
      price: prices.get(medicine._id.toString()) ?? null,
    }))
  }
  res.json(result)
}

export async function getMedicine(req, res) {
  const medicine = await getMedicineById(req.validated.params.medicineId, {
    includeInactive: canManageMedicines(req.user),
  })
  if (req.user.role === 'customer') {
    const prices = await getCurrentMedicinePrices([medicine._id])
    return res.json({
      medicine: {
        _id: medicine._id,
        name: medicine.name,
        genericName: medicine.genericName,
        brand: medicine.brand,
        category: medicine.category,
        manufacturer: medicine.manufacturer,
        description: medicine.description,
        price: prices.get(medicine._id.toString()) ?? null,
      },
    })
  }
  const prices = await getCurrentMedicinePrices([medicine._id])
  res.json({
    medicine: {
      ...medicine,
      price: prices.get(medicine._id.toString()) ?? null,
    },
  })
}

export async function postMedicine(req, res) {
  const medicine = await createMedicine(req.validated.body)
  res.status(201).json({ medicine })
}

export async function patchMedicine(req, res) {
  const medicine = await updateMedicine(req.validated.params.medicineId, req.validated.body)
  res.json({ medicine })
}

export async function removeMedicine(req, res) {
  await deleteMedicine(req.validated.params.medicineId)
  res.status(204).end()
}
