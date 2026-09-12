import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  User, FileText, Briefcase,
  Mail, ClipboardList, LogOut, Zap, BrainCircuit,
} from 'lucide-react'

const NAV = [
  { to: '/profile',      icon: User,          label: 'My Profile' },
  { to: '/resumes',      icon: FileText,       label: 'Resumes' },
  { to: '/internships',  icon: Briefcase,      label: 'Internships' },
  { to: '/cover-letter', icon: Mail,           label: 'Cover Letter' },
  { to: '/applications', icon: ClipboardList,  label: 'Applications' },
  { to: '/chat',         icon: BrainCircuit,   label: 'Preparation Agent' },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <aside style={styles.aside}>
      {/* Logo */}
      <div style={styles.logo}>
        <div style={styles.logoIcon}><Zap size={18} color="#fff" /></div>
        <div>
          <div style={styles.logoLine1}>Internship</div>
          <div style={styles.logoLine2}>Assistant</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={styles.nav}>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              ...styles.link,
              ...(isActive ? styles.linkActive : {}),
            })}
          >
            <Icon size={17} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div style={styles.footer}>
        <div style={styles.userRow}>
          <div style={styles.avatar}>
            {user?.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div style={styles.userInfo}>
            <div style={styles.userName}>{user?.name || 'User'}</div>
            <div style={styles.userEmail}>{user?.email || ''}</div>
          </div>
        </div>
        <button onClick={handleLogout} style={styles.logoutBtn} title="Logout">
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  )
}

const styles = {
  aside: {
    width: 232, minHeight: '100vh', background: 'var(--bg2)',
    borderRight: '1px solid var(--border)', display: 'flex',
    flexDirection: 'column', padding: '0', position: 'fixed',
    left: 0, top: 0, bottom: 0, zIndex: 100,
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '22px 20px 22px', borderBottom: '1px solid var(--border)',
  },
  logoIcon: {
    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
    background: 'linear-gradient(135deg,#7c6ff7,#a78bfa)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoLine1: { fontSize: 12, color: 'var(--text2)', lineHeight: 1.3 },
  logoLine2: { fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 },
  nav: { flex: 1, padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 2 },
  link: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
    borderRadius: 'var(--radius-sm)', color: 'var(--text2)', fontSize: 13,
    fontWeight: 500, transition: 'all 0.15s', textDecoration: 'none',
    borderLeft: '3px solid transparent',
  },
  linkActive: {
    background: 'var(--accent-glow)', color: 'var(--accent2)',
    borderLeft: '3px solid var(--accent)',
  },
  footer: {
    padding: '14px 10px', borderTop: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', gap: 8,
  },
  userRow: { flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  avatar: {
    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg,#7c6ff7,#a78bfa)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 700, color: '#fff',
  },
  userInfo: { minWidth: 0 },
  userName: { fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userEmail: { fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  logoutBtn: {
    background: 'none', border: 'none', color: 'var(--text3)',
    padding: 6, borderRadius: 6, flexShrink: 0, cursor: 'pointer',
  },
}
