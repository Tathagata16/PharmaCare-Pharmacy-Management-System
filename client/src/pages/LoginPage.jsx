import { useState } from 'react'
import { Activity, LockKeyhole, Mail, Pill } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider.jsx'
import { getApiError } from '../lib/api.js'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(form)
      navigate(location.state?.from?.pathname || '/', { replace: true })
    } catch (requestError) {
      setError(getApiError(requestError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand">
        <a href="/" className="brand-lockup"><span className="brand-symbol"><Pill size={22} /></span><span>PharmaCare</span></a>
        <div className="login-message">
          <div className="eyebrow"><Activity size={15} /> PHARMACY OPERATIONS</div>
          <h1>Better care starts with a clearer view.</h1>
          <p>Manage inventory, purchasing and sales from one secure workspace.</p>
        </div>
        <span className="login-footnote">Inventory and revenue insights, in real time.</span>
      </section>
      <section className="login-form-wrap">
        <form className="login-card" onSubmit={submit}>
          <div className="login-card-icon"><LockKeyhole size={20} /></div>
          <p className="eyebrow">WELCOME BACK</p>
          <h2>Sign in to PharmaCare</h2>
          <p className="muted">Use your staff or customer account to continue.</p>
          {error && <div className="form-error" role="alert">{error}</div>}
          <label>Email address<span className="field-control"><Mail size={17} /><input type="email" autoComplete="username" required maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></span></label>
          <label>Password<span className="field-control"><LockKeyhole size={17} /><input type="password" autoComplete="current-password" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></span></label>
          <button className="button primary wide" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <p className="login-hint">New customer? <Link to="/register">Create an account</Link></p>
        </form>
      </section>
    </main>
  )
}

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await register(form)
      navigate('/', { replace: true })
    } catch (requestError) {
      setError(getApiError(requestError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand">
        <a href="/" className="brand-lockup"><span className="brand-symbol"><Pill size={22} /></span><span>PharmaCare</span></a>
        <div className="login-message"><div className="eyebrow"><Activity size={15} /> CUSTOMER ACCESS</div><h1>Your health essentials, all in one place.</h1><p>Create an account to access the customer pharmacy experience.</p></div>
        <span className="login-footnote">Account registration creates a customer role only.</span>
      </section>
      <section className="login-form-wrap">
        <form className="login-card" onSubmit={submit}>
          <div className="login-card-icon"><Pill size={20} /></div><p className="eyebrow">GET STARTED</p><h2>Create a customer account</h2><p className="muted">Staff accounts are created by an administrator.</p>
          {error && <div className="form-error" role="alert">{error}</div>}
          <label>Full name<span className="field-control"><input autoComplete="name" required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></span></label>
          <label>Email address<span className="field-control"><Mail size={17} /><input type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></span></label>
          <label>Password<span className="field-control"><LockKeyhole size={17} /><input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></span></label>
          <button className="button primary wide" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
          <p className="login-hint">Already have an account? <Link to="/login">Sign in</Link></p>
        </form>
      </section>
    </main>
  )
}
