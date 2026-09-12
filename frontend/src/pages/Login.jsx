import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Zap, Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/internships')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logoRow}>
          <div style={s.logoIcon}><Zap size={20} color="#fff" /></div>
          <h1 style={s.logoText}>Internship Assistant</h1>
        </div>
        <p style={s.sub}>Sign in to find your perfect internship</p>

        {error && <div style={s.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={s.form}>
          <label style={s.label}>Email</label>
          <input style={s.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />

          <label style={s.label}>Password</label>
          <div style={s.pwdWrap}>
            <input style={{ ...s.input, paddingRight: 42 }} type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            <button type="button" style={s.eyeBtn} onClick={() => setShowPwd(!showPwd)}>
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={s.footer}>
          Don&apos;t have an account?{' '}
          <Link to="/register" style={s.link}>Create one</Link>
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
  pwdWrap: { position: 'relative' },
  eyeBtn: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text3)', padding: 0 },
  btn: { background: 'linear-gradient(135deg,#7c6ff7,#a78bfa)', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 14, fontWeight: 600, marginTop: 8, transition: 'opacity 0.15s' },
  footer: { textAlign: 'center', marginTop: 24, color: 'var(--text2)', fontSize: 13 },
  link: { color: 'var(--accent2)', fontWeight: 600 },
}
