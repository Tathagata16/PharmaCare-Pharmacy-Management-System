import {
  Activity, Boxes, CircleUserRound, FileBarChart, LayoutDashboard,
  Package, RefreshCw, ShoppingBag, ShoppingCart, Tag, Truck, Users,
} from 'lucide-react'

export const pageMeta = {
  dashboard: { title: 'Dashboard', icon: LayoutDashboard },
  medicines: { title: 'Medicines', icon: Package },
  categories: { title: 'Categories', icon: Tag },
  suppliers: { title: 'Suppliers', icon: Truck },
  purchases: { title: 'Purchases', icon: ShoppingBag },
  inventory: { title: 'Batch inventory', icon: Boxes },
  sales: { title: 'Sales & billing', icon: ShoppingCart },
  returns: { title: 'Returns', icon: RefreshCw },
  movements: { title: 'Stock movements', icon: Activity },
  reports: { title: 'Reports', icon: FileBarChart },
  users: { title: 'Users', icon: Users },
  profile: { title: 'Profile', icon: CircleUserRound },
}
