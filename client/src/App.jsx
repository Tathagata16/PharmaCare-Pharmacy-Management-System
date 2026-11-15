import { useState } from 'react'
import { BrowserRouter, Link, NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { Activity, Boxes, ChevronRight, LogOut, Menu, Pill, ShieldCheck } from 'lucide-react'
import { AuthProvider, useAuth } from './features/auth/AuthProvider.jsx'
import { ProtectedRoute } from './components/ProtectedRoute.jsx'
import LoginPage, { RegisterPage } from './pages/LoginPage.jsx'
import {
  CategoriesPage, DashboardPage, InventoryPage, MedicinesPage, MovementsPage,
  PurchasesPage, ProfilePage, ReportsPage, ReturnsPage, SalesPage,
  SuppliersPage, UsersPage,
} from './pages/WorkspacePages.jsx'
import { pageMeta } from './pages/pageMeta.js'
import './Workspace.css'

const linksByRole = {
  admin: ['dashboard', 'medicines', 'categories', 'suppliers', 'purchases', 'inventory', 'sales', 'returns', 'movements', 'reports', 'users', 'profile'],
  pharmacist: ['dashboard', 'medicines', 'categories', 'suppliers', 'purchases', 'inventory', 'sales', 'returns', 'movements', 'reports', 'profile'],
  cashier: ['dashboard', 'medicines', 'inventory', 'sales', 'reports', 'profile'],
  customer: ['dashboard', 'medicines', 'profile'],
}

const pageRoutes = {
  dashboard: { path: '/', component: DashboardPage },
  medicines: { path: '/medicines', component: MedicinesPage, roles: ['admin', 'pharmacist', 'cashier', 'customer'] },
  categories: { path: '/categories', component: CategoriesPage, roles: ['admin', 'pharmacist'] },
  suppliers: { path: '/suppliers', component: SuppliersPage, roles: ['admin', 'pharmacist'] },
  purchases: { path: '/purchases', component: PurchasesPage, roles: ['admin', 'pharmacist'] },
  inventory: { path: '/inventory', component: InventoryPage, roles: ['admin', 'pharmacist', 'cashier'] },
  sales: { path: '/sales', component: SalesPage, roles: ['admin', 'pharmacist', 'cashier'] },
  returns: { path: '/returns', component: ReturnsPage, roles: ['admin', 'pharmacist'] },
  movements: { path: '/movements', component: MovementsPage, roles: ['admin', 'pharmacist'] },
  reports: { path: '/reports', component: ReportsPage, roles: ['admin', 'pharmacist', 'cashier'] },
  users: { path: '/users', component: UsersPage, roles: ['admin'] },
  profile: { path: '/profile', component: ProfilePage },
}

function WorkspaceLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const activeKey = Object.entries(pageRoutes).find(([, route]) => route.path === location.pathname)?.[0] ?? 'dashboard'
  const links = linksByRole[user.role] ?? ['dashboard', 'profile']

  async function signOut() {
    await logout()
  }

  return (
    <div className="workspace-shell">
      {sidebarOpen && <button className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}
      <aside className={`workspace-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <Link className="workspace-brand" to="/" onClick={() => setSidebarOpen(false)}>
          <span className="brand-icon"><Pill size={20} /></span>
          <span>PharmaCare<small>PHARMACY MANAGEMENT</small></span>
        </Link>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="workspace-nav" aria-label="Main navigation">
          {links.map((key) => {
            const page = pageMeta[key]
            const Icon = page.icon
            const route = pageRoutes[key]
            return <NavLink key={key} to={route.path} end={key === 'dashboard'} onClick={() => setSidebarOpen(false)} className={({ isActive }) => `workspace-nav-link ${isActive ? 'active' : ''}`}><Icon size={18} /><span>{page.title}</span></NavLink>
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="secure-note"><ShieldCheck size={17} /><span><b>Secure workspace</b><small>Access is role controlled</small></span></div>
          <button className="user-summary" onClick={() => { window.location.href = '/profile' }}><span className="user-avatar">{user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><span className="user-meta"><b>{user.name}</b><small>{user.role}</small></span><ChevronRight size={16} /></button>
        </div>
      </aside>
      <main className="workspace-main">
        <header className="workspace-topbar">
          <button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><b>{pageMeta[activeKey]?.title ?? 'Dashboard'}</b></div>
          <div className="topbar-user"><span className="online-dot" /><span>{user.name}</span><button className="logout-button" onClick={signOut}><LogOut size={16} /> Sign out</button></div>
        </header>
        <div className="workspace-content"><Outlet /></div>
        <footer className="workspace-footer"><span><Activity size={14} /> PharmaCare operations</span><span>Backend-enforced access · {new Date().getFullYear()}</span></footer>
      </main>
    </div>
  )
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <div className="screen-state"><span className="loading-mark"><Boxes size={22} /></span>Loading your workspace…</div>
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<WorkspaceLayout />}>
          {Object.entries(pageRoutes).map(([key, route]) => {
            const Page = route.component
            return <Route key={key} path={route.path} element={route.roles && !route.roles.includes(user?.role) ? <Navigate to="/" replace /> : <Page />} />
          })}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default function App() {
  return <BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter>
}
