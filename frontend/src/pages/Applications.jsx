import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { getMyApplications, withdrawApplication } from '../api'
import {
  ClipboardList, MapPin, Briefcase, Calendar,
  Trash2, Loader, AlertCircle, CheckCircle, Clock,
  ArrowRight, Search
} from 'lucide-react'

export default function Applications() {
  const navigate = useNavigate()
  const [apps,    setApps]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [removing, setRemoving] = useState({})
  const [search, setSearch]   = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const res = await getMyApplications()
      setApps(res.data || [])
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load applications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleWithdraw = async (id) => {
    if (!window.confirm('Are you sure you want to withdraw this application?')) return
    setRemoving(r => ({ ...r, [id]: true }))
    try {
      await withdrawApplication(id)
      setApps(a => a.filter(x => x.id !== id))
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to withdraw application')
    } finally {
      setRemoving(r => ({ ...r, [id]: false }))
    }
  }

  const formatDate = (d) => {
    if (!d) return ''
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const filteredApps = apps.filter(a => {
    return !search || (
      a.internship_title?.toLowerCase().includes(search.toLowerCase()) ||
      a.company?.toLowerCase().includes(search.toLowerCase()) ||
      a.domain?.toLowerCase().includes(search.toLowerCase())
    )
  })

  return (
    <Layout>
      <div style={s.page}>
        <div style={s.headerRow}>
          <div>
            <h1 style={s.title}>My Applications</h1>
            <p style={s.sub}>Track all internships you have applied to</p>
          </div>
          <button style={s.browseMoreBtn} onClick={() => navigate('/internships')}>
            <span>Find More Internships</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {loading && (
          <div style={s.center}>
            <Loader size={32} color="var(--accent2)" style={s.spin} />
            <span style={{ color: 'var(--text2)', fontSize: 14 }}>Loading applications from database…</span>
          </div>
        )}

        {error && (
          <div style={s.errorBox}>
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && apps.length === 0 && (
          <div style={s.empty}>
            <div style={s.emptyIconCircle}>
              <ClipboardList size={40} color="var(--accent2)" />
            </div>
            <p style={s.emptyTitle}>No applications submitted yet</p>
            <p style={s.emptySub}>
              Go to <b>Internships</b>, match your resume, and click <b>Apply</b> on any role to store your application here.
            </p>
            <button style={s.primaryBtn} onClick={() => navigate('/internships')}>
              Explore Internships
            </button>
          </div>
        )}

        {!loading && apps.length > 0 && (
          <>
            {/* Stats summary & Search */}
            <div style={s.topControls}>
              <div style={s.totalBadge}>
                <CheckCircle size={15} color="var(--green)" />
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                  {apps.length} {apps.length === 1 ? 'Application' : 'Applications'} Applied
                </span>
              </div>

              <div style={s.searchWrap}>
                <Search size={15} color="var(--text3)" style={s.searchIcon} />
                <input
                  style={s.searchInput}
                  placeholder="Filter applied internships by role or company..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* List */}
            <div style={s.list}>
              {filteredApps.map(app => (
                <div key={app.id} style={s.card}>
                  <div style={s.cardLeft}>
                    <div style={s.cardTitleRow}>
                      <div>
                        <h3 style={s.cardTitle}>{app.internship_title}</h3>
                        <p style={s.company}>{app.company}</p>
                      </div>
                      <span style={s.appliedBadge}>
                        <CheckCircle size={12} color="var(--green)" />
                        Applied
                      </span>
                    </div>

                    <div style={s.metaRow}>
                      {app.location && <span style={s.meta}><MapPin size={13} />{app.location}</span>}
                      {app.work_mode && <span style={s.meta}><Briefcase size={13} />{app.work_mode}</span>}
                      {app.domain   && <span style={s.meta}><CheckCircle size={13} />{app.domain}</span>}
                      {app.match_percentage && app.match_percentage !== 'undefined' && (
                        <span style={{ ...s.meta, color: 'var(--accent2)', fontWeight: 600 }}>
                          ★ {app.match_percentage}% match
                        </span>
                      )}
                      <span style={s.meta}>
                        <Calendar size={13} />Applied {formatDate(app.applied_at)}
                      </span>
                    </div>

                    {app.cover_note && (
                      <div style={s.noteBox}>
                        <Clock size={13} color="var(--text3)" style={{ flexShrink: 0, marginTop: 2 }} />
                        <div style={{ minWidth: 0 }}>
                          <span style={s.noteLabel}>Submitted Note / Cover Letter Excerpt:</span>
                          <p style={s.noteText}>{app.cover_note}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={s.cardRight}>
                    <button
                      style={{ ...s.withdrawBtn, opacity: removing[app.id] ? 0.6 : 1 }}
                      onClick={() => handleWithdraw(app.id)}
                      disabled={removing[app.id]}
                      title="Withdraw application"
                    >
                      {removing[app.id] ? (
                        <Loader size={14} style={s.spin} />
                      ) : (
                        <><Trash2 size={13} /> Withdraw</>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}

const s = {
  page:  { maxWidth: 960, paddingBottom: 40 },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 14 },
  title: { fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 6 },
  sub:   { color: 'var(--text2)', fontSize: 14, margin: 0, maxWidth: 600 },
  browseMoreBtn: { display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 16px', color: 'var(--accent2)', fontWeight: 600, fontSize: 13, cursor: 'pointer' },

  center:   { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 60 },
  errorBox: { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red)', borderRadius: 8, padding: '12px 16px', fontSize: 13 },

  empty:          { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '80px 20px', textAlign: 'center', background: 'var(--bg2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' },
  emptyIconCircle:{ width: 72, height: 72, borderRadius: '50%', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' },
  emptyTitle:     { fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: 0 },
  emptySub:       { fontSize: 13, color: 'var(--text3)', maxWidth: 420, lineHeight: 1.6, margin: 0 },
  primaryBtn:     { background: 'linear-gradient(135deg,#7c6ff7,#a78bfa)', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 22px', fontWeight: 600, fontSize: 14, cursor: 'pointer', marginTop: 6 },

  topControls: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' },
  totalBadge:  { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--green-bg)', border: '1px solid var(--green)', borderRadius: 8, padding: '9px 16px', fontSize: 13 },

  searchWrap: { position: 'relative', flex: 1, minWidth: 260, maxWidth: 420 },
  searchIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' },
  searchInput:{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px 9px 36px', color: 'var(--text)', fontSize: 13, outline: 'none' },

  list: { display: 'flex', flexDirection: 'column', gap: 14 },
  card: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '22px 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' },
  cardLeft: { flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 8 },

  cardTitleRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  cardTitle:    { fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 },
  company:      { fontSize: 13, color: 'var(--accent2)', fontWeight: 600, margin: 0, marginTop: 2 },
  appliedBadge: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--green)', background: 'var(--green-bg)', border: '1px solid var(--green)', padding: '4px 10px', borderRadius: 99 },

  metaRow: { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  meta:    { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text3)' },

  noteBox:  { display: 'flex', alignItems: 'flex-start', gap: 8, background: 'var(--bg3)', borderRadius: 8, padding: '10px 14px', marginTop: 4 },
  noteLabel:{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 2 },
  noteText: { fontSize: 12, color: 'var(--text2)', margin: 0, lineHeight: 1.5 },

  cardRight: { display: 'flex', alignItems: 'center' },
  withdrawBtn: { background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--red)', padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, transition: 'opacity 0.15s' },

  spin: { animation: 'spin 0.8s linear infinite' },
}


