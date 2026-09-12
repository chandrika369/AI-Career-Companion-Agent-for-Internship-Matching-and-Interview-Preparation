import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register } from '../api'
import { Zap } from 'lucide-react'

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(form)
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logoRow}>
          <div style={s.logoIcon}><Zap size={20} color="#fff" /></div>
          <h1 style={s.logoText}>Create Account</h1>
        </div>
        <p style={s.sub}>Start matching with internships today</p>

        {error && <div style={s.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={s.form}>
          {[['name','Full Name','text','Jane Doe'],['email','Email','email','you@example.com'],['phone','Phone (optional)','tel','+91 9999999999'],['password','Password','password','••••••••']].map(([k,lbl,type,ph]) => (
            <React.Fragment key={k}>
              <label style={s.label}>{lbl}</label>
              <input style={s.input} type={type} value={form[k]} onChange={set(k)} placeholder={ph} required={k !== 'phone'} />
            </React.Fragment>
          ))}
          <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
            {loading ? 'Creating…' : 'Create Account'}
          </button>
        </form>

        <p style={s.footer}>
          Already have an account?{' '}
          <Link to="/login" style={s.link}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 },
  card: { width: '100%', maxWidth: 420, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: '40px 36px' },
  logoRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
  logoIcon: { width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#7c6ff7,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 18, fontWeight: 700 },
  sub: { color: 'var(--text2)', fontSize: 13, marginBottom: 28 },
  error: { background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  label: { fontSize: 13, fontWeight: 500, color: 'var(--text2)', marginBottom: -6 },
  input: { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '11px 14px', color: 'var(--text)', fontSize: 14, outline: 'none', width: '100%' },
  btn: { background: 'linear-gradient(135deg,#7c6ff7,#a78bfa)', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 14, fontWeight: 600, marginTop: 8 },
  footer: { textAlign: 'center', marginTop: 24, color: 'var(--text2)', fontSize: 13 },
  link: { color: 'var(--accent2)', fontWeight: 600 },
}
