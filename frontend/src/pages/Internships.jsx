import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import {
  uploadResume, matchInternships, browseInternships,
  applyToInternship, generateCoverLetter, getMyApplications
} from '../api'
import {
  Upload, FileText, X, Briefcase, MapPin, Clock,
  DollarSign, CheckCircle, Loader, ChevronDown, ChevronUp,
  Send, Mail, Star, AlertCircle, Sparkles, Filter, Search, ArrowRight
} from 'lucide-react'

const DOMAIN_COLORS = {
  'AI/ML':               { bg: 'rgba(124,111,247,0.15)', color: '#a78bfa', border: 'rgba(124,111,247,0.35)' },
  'Generative AI':       { bg: 'rgba(251,191,36,0.12)',  color: '#fbbf24', border: 'rgba(251,191,36,0.35)' },
  'Data Science':        { bg: 'rgba(96,165,250,0.12)',  color: '#60a5fa', border: 'rgba(96,165,250,0.35)' },
  'Backend Development': { bg: 'rgba(52,211,153,0.12)',  color: '#34d399', border: 'rgba(52,211,153,0.35)' },
  'Full Stack':          { bg: 'rgba(52,211,153,0.12)',  color: '#34d399', border: 'rgba(52,211,153,0.35)' },
  'Data Engineering':    { bg: 'rgba(96,165,250,0.12)',  color: '#60a5fa', border: 'rgba(96,165,250,0.35)' },
  'Frontend':            { bg: 'rgba(251,191,36,0.12)',  color: '#fbbf24', border: 'rgba(251,191,36,0.35)' },
  'DevOps':              { bg: 'rgba(248,113,113,0.12)', color: '#f87171', border: 'rgba(248,113,113,0.35)' },
}
const domainStyle = (d) => DOMAIN_COLORS[d] || { bg: 'rgba(148,163,184,0.12)', color: '#94a3b8', border: 'rgba(148,163,184,0.3)' }

const matchColor = (pct) => {
  if (pct >= 80) return { color: '#34d399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.35)', label: 'Perfect Match' }
  if (pct >= 60) return { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.35)', label: 'Strong Match' }
  if (pct >= 40) return { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.35)', label: 'Good Match' }
  return { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)', label: 'Possible Match' }
}

export default function Internships() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [file, setFile]             = useState(null)
  const [dragging, setDragging]     = useState(false)
  const [loading, setLoading]       = useState(false)
  const [matches, setMatches]       = useState(null)
  const [allInternships, setAllInternships] = useState([])
  const [loadingAll, setLoadingAll] = useState(true)
  const [summary, setSummary]       = useState('')
  const [resumeData, setResumeData] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lastResume') || 'null') } catch { return null }
  })
  const [error, setError]           = useState('')
  const fileRef                     = useRef()

  const [searchQuery, setSearchQuery] = useState('')
  const [domainFilter, setDomainFilter] = useState('All')
  const [workModeFilter, setWorkModeFilter] = useState('All')

  const [applying, setApplying]         = useState({})
  const [applied, setApplied]           = useState({})
  const [applyErr, setApplyErr]         = useState({})
  const [genCL, setGenCL]               = useState({})
  const [coverLetters, setCoverLetters] = useState({})
  const [cardTones, setCardTones]       = useState({})
  const [expanded, setExpanded]         = useState({})
  const [copySuccess, setCopySuccess]   = useState({})

  useEffect(() => {
    const initData = async () => {
      setLoadingAll(true)
      try {
        const [allRes, myAppsRes] = await Promise.allSettled([
          browseInternships(),
          getMyApplications(),
        ])

        if (allRes.status === 'fulfilled') {
          setAllInternships(allRes.value.data || [])
        }

        if (myAppsRes.status === 'fulfilled') {
          const appsMap = {}
          for (const app of myAppsRes.value.data || []) {
            appsMap[app.internship_id] = true
          }
          setApplied(appsMap)
        }
      } catch (_) {
      } finally {
        setLoadingAll(false)
      }
    }
    initData()
  }, [])

  useEffect(() => {
    if (resumeData && !matches && !loading) {
      handleMatchWithData(resumeData)
    }
  }, [])

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && (f.name.endsWith('.pdf') || f.name.endsWith('.docx'))) setFile(f)
  }

  const handleMatchWithData = async (data) => {
    setLoading(true); setError('')
    try {
      const matchRes = await matchInternships(data, 15)
      setMatches(matchRes.data.internships || [])
      setSummary(matchRes.data.match_summary || '')
    } catch (err) {
      setError(err.response?.data?.detail || 'Matching failed')
    } finally {
      setLoading(false)
    }
  }

  const handleMatch = async () => {
    if (!file) return
    setError(''); setLoading(true); setMatches(null); setSummary('')
    try {
      const parseRes = await uploadResume(file)
      const parsed   = { ...parseRes.data, _filename: file.name }
      setResumeData(parsed)
      localStorage.setItem('lastResume', JSON.stringify(parsed))

      const matchRes = await matchInternships(parsed, 15)
      setMatches(matchRes.data.internships || [])
      setSummary(matchRes.data.match_summary || '')
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async (internship) => {
    const id = internship.id
    setApplying(a => ({ ...a, [id]: true }))
    setApplyErr(e => ({ ...e, [id]: '' }))
    try {
      const cl = coverLetters[id]
      const matchPct = internship.match_percentage ? String(internship.match_percentage.toFixed(1)) : null
      await applyToInternship({
        internship_id:    id,
        internship_title: internship.title,
        company:          internship.company,
        location:         internship.location,
        work_mode:        internship.work_mode,
        domain:           internship.domain,
        match_percentage: matchPct,
        cover_note:       cl ? cl.slice(0, 1000) : null,
      })
      setApplied(a => ({ ...a, [id]: true }))
    } catch (err) {
      const msg = err.response?.data?.detail || 'Apply failed'
      setApplyErr(e => ({ ...e, [id]: msg }))
    } finally {
      setApplying(a => ({ ...a, [id]: false }))
    }
  }

  const handleCoverLetter = async (internship, targetTone = 'formal') => {
    const id = internship.id
    const currentTone = targetTone || cardTones[id] || 'formal'
    setCardTones(t => ({ ...t, [id]: currentTone }))

    const activeResume = resumeData || (() => {
      try {
        const stored = localStorage.getItem('lastResume')
        if (stored) return JSON.parse(stored)
        if (user) {
          return {
            full_name: user.name,
            email: user.email,
            phone: user.phone,
            skills: Array.isArray(user.skills) ? user.skills : [],
            summary: user.bio || '',
          }
        }
        return null
      } catch { return null }
    })()

    if (!activeResume) {
      setApplyErr(e => ({ ...e, [id]: 'Please upload a resume or add skills in your Profile first.' }))
      return
    }

    setGenCL(g => ({ ...g, [id]: true }))
    try {
      const res = await generateCoverLetter({
        resume_data: activeResume,
        internship:  internship,
        tone:        currentTone,
        emphasize:   '',
      })
      setCoverLetters(c => ({ ...c, [id]: res.data.cover_letter }))
      setExpanded(e => ({ ...e, [id]: true }))
    } catch {
      setCoverLetters(c => ({ ...c, [id]: 'Could not generate cover letter. Please try again.' }))
      setExpanded(e => ({ ...e, [id]: true }))
    } finally {
      setGenCL(g => ({ ...g, [id]: false }))
    }
  }

  const handleCopyCardLetter = (id, text) => {
    navigator.clipboard.writeText(text)
    setCopySuccess(c => ({ ...c, [id]: true }))
    setTimeout(() => setCopySuccess(c => ({ ...c, [id]: false })), 2000)
  }

  const rawList = matches || allInternships
  const filteredInternships = rawList.filter(item => {
    const matchesSearch = !searchQuery || (
      item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.required_skills?.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    const matchesDomain = domainFilter === 'All' || item.domain?.toLowerCase() === domainFilter.toLowerCase()
    const matchesWorkMode = workModeFilter === 'All' || item.work_mode?.toLowerCase() === workModeFilter.toLowerCase()
    return matchesSearch && matchesDomain && matchesWorkMode
  })

  const domains = ['All', ...Array.from(new Set(rawList.map(i => i.domain).filter(Boolean)))]
  const workModes = ['All', 'Remote', 'Hybrid', 'On-site']

  return (
    <Layout>
      <div style={s.page}>
        <div style={s.headerRow}>
          <div>
            <h1 style={s.title}>Internship Matching</h1>
            <p style={s.sub}>Upload your resume to calculate semantic match scores, or browse and apply directly</p>
          </div>
        </div>

        <div style={s.uploadCard}>
          <div
            style={{ ...s.dropZone, ...(dragging ? s.dropActive : {}) }}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current.click()}
          >
            <Upload size={28} color={dragging ? 'var(--accent2)' : 'var(--text3)'} />
            <p style={s.dropTitle}>
              {file ? file.name : (resumeData ? `Current resume: ${resumeData._filename || resumeData.full_name || 'Uploaded resume'}` : 'Drop your resume here or click to browse')}
            </p>
            <p style={s.dropSub}>PDF or DOCX · Max 10MB</p>
            <input
              ref={fileRef} type="file" accept=".pdf,.docx"
              style={{ display: 'none' }}
              onChange={e => setFile(e.target.files[0])}
            />
          </div>

          <div style={s.uploadRow}>
            {file ? (
              <div style={s.fileChip}>
                <FileText size={13} color="var(--accent2)" />
                <span>{file.name}</span>
                <button style={s.chipX} onClick={e => { e.stopPropagation(); setFile(null) }}>
                  <X size={12} />
                </button>
              </div>
            ) : resumeData && (
              <div style={s.activeResumeChip}>
                <CheckCircle size={13} color="var(--green)" />
                <span>Active: <b>{resumeData._filename || resumeData.full_name || 'Resume'}</b> ({resumeData.skills?.length || 0} skills)</span>
              </div>
            )}

            <button
              style={{ ...s.matchBtn, opacity: (!file && !resumeData) || loading ? 0.55 : 1, marginLeft: 'auto' }}
              disabled={(!file && !resumeData) || loading}
              onClick={() => file ? handleMatch() : handleMatchWithData(resumeData)}
            >
              {loading ? (
                <><Loader size={15} style={s.spin} /> Matching with AI…</>
              ) : (
                <><Briefcase size={15} /> {matches ? 'Re-Match to Resume' : 'Match to My Resume'}</>
              )}
            </button>
          </div>

          {error && (
            <div style={s.errorBox}>
              <AlertCircle size={14} />{error}
            </div>
          )}
        </div>

        {summary && (
          <div style={s.summaryBox}>
            <Star size={18} color="var(--yellow)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <span style={s.summaryTitle}>AI Match Analysis</span>
              <p style={s.summaryText}>{summary}</p>
            </div>
          </div>
        )}

        <div style={s.filterBar}>
          <div style={s.searchWrap}>
            <Search size={15} color="var(--text3)" style={s.searchIcon} />
            <input
              style={s.searchInput}
              placeholder="Search by role, company, skills..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button style={s.clearSearchBtn} onClick={() => setSearchQuery('')}>
                <X size={13} />
              </button>
            )}
          </div>

          <div style={s.filterGroup}>
            <div style={s.selectWrap}>
              <select
                style={s.filterSelect}
                value={domainFilter}
                onChange={e => setDomainFilter(e.target.value)}
              >
                {domains.map(d => (
                  <option key={d} value={d}>Domain: {d}</option>
                ))}
              </select>
            </div>

            <div style={s.selectWrap}>
              <select
                style={s.filterSelect}
                value={workModeFilter}
                onChange={e => setWorkModeFilter(e.target.value)}
              >
                {workModes.map(w => (
                  <option key={w} value={w}>Mode: {w}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div style={s.resultsHeader}>
          <div>
            <h2 style={s.resultsTitle}>
              {matches ? `${filteredInternships.length} Matched Positions` : `${filteredInternships.length} Available Internships`}
            </h2>
            <p style={s.resultsSub}>
              {matches
                ? 'Ranked by semantic match score against your resume'
                : 'Browse opportunities and apply, or upload your resume above to rank matches'}
            </p>
          </div>
        </div>

        {loadingAll && (
          <div style={s.centerLoading}>
            <Loader size={30} color="var(--accent2)" style={s.spin} />
            <span style={{ fontSize: 14, color: 'var(--text2)' }}>Loading internships…</span>
          </div>
        )}

        <div style={s.cards}>
          {filteredInternships.map((intern) => {
            const hasScore = typeof intern.match_percentage === 'number'
            const mc  = hasScore ? matchColor(intern.match_percentage) : null
            const ds  = domainStyle(intern.domain)
            const id  = intern.id
            const cl  = coverLetters[id]
            const clOpen = expanded[id]
            const currentTone = cardTones[id] || 'formal'

            return (
              <div key={id} style={s.card}>
                <div style={s.cardTop}>
                  <div style={s.cardTitleRow}>
                    <div>
                      <h3 style={s.cardTitle}>{intern.title}</h3>
                      <p style={s.cardCompany}>{intern.company}</p>
                    </div>

                    {hasScore ? (
                      <div style={{ ...s.matchBadge, background: mc.bg, color: mc.color, border: `1px solid ${mc.border}` }}>
                        <span style={s.matchPct}>{intern.match_percentage.toFixed(1)}%</span>
                        <span style={s.matchLabel}>{mc.label}</span>
                      </div>
                    ) : (
                      <span style={{ ...s.domainBadge, background: ds.bg, color: ds.color, border: `1px solid ${ds.border}` }}>
                        {intern.domain || 'Technology'}
                      </span>
                    )}
                  </div>

                  <div style={s.metaRow}>
                    {intern.location && <span style={s.meta}><MapPin size={13} />{intern.location}</span>}
                    {intern.work_mode && <span style={s.meta}><Briefcase size={13} />{intern.work_mode}</span>}
                    {intern.duration  && <span style={s.meta}><Clock size={13} />{intern.duration}</span>}
                    {intern.stipend   && <span style={s.meta}><DollarSign size={13} />{intern.stipend}</span>}
                    {hasScore && intern.domain && (
                      <span style={{ ...s.domainBadge, background: ds.bg, color: ds.color, border: `1px solid ${ds.border}` }}>
                        {intern.domain}
                      </span>
                    )}
                  </div>
                </div>

                <p style={s.desc}>{intern.description}</p>

                {intern.required_skills?.length > 0 && (
                  <div style={s.skillsRow}>
                    {intern.required_skills.map((sk, i) => (
                      <span key={i} style={s.skillChip}>{sk}</span>
                    ))}
                  </div>
                )}

                {applyErr[id] && (
                  <div style={s.applyErr}>
                    <AlertCircle size={14} />
                    <span>{applyErr[id]}</span>
                  </div>
                )}

                <div style={s.actions}>
                  <button
                    style={{
                      ...s.applyBtn,
                      ...(applied[id] ? s.applyBtnDone : {}),
                      opacity: applying[id] ? 0.7 : 1,
                    }}
                    onClick={() => !applied[id] && handleApply(intern)}
                    disabled={applying[id] || applied[id]}
                  >
                    {applying[id] ? (
                      <><Loader size={14} style={s.spin} />Applying…</>
                    ) : applied[id] ? (
                      <><CheckCircle size={14} />Applied</>
                    ) : (
                      <><Send size={14} />Apply Now</>
                    )}
                  </button>

                  <button
                    style={{ ...s.clBtn, opacity: genCL[id] ? 0.7 : 1 }}
                    onClick={() => {
                      if (cl) {
                        setExpanded(e => ({ ...e, [id]: !e[id] }))
                      } else {
                        handleCoverLetter(intern, 'formal')
                      }
                    }}
                    disabled={genCL[id]}
                  >
                    {genCL[id] ? (
                      <><Loader size={14} style={s.spin} />Drafting Letter…</>
                    ) : cl ? (
                      clOpen ? (
                        <><ChevronUp size={14} />Hide Cover Letter</>
                      ) : (
                        <><ChevronDown size={14} />Show Cover Letter</>
                      )
                    ) : (
                      <><Mail size={14} />Generate Cover Letter</>
                    )}
                  </button>
                </div>

                {cl && clOpen && (
                  <div style={s.clPanel}>
                    <div style={s.clHeader}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Mail size={14} color="var(--accent2)" />
                        <span style={s.clHeaderText}>Cover Letter ({currentTone.toUpperCase()})</span>
                      </div>

                      <div style={s.cardToneRow}>
                        {['formal', 'friendly', 'enthusiastic'].map(t => (
                          <button
                            key={t}
                            style={{
                              ...s.cardToneBtn,
                              ...(currentTone === t ? s.cardToneBtnActive : {})
                            }}
                            onClick={() => handleCoverLetter(intern, t)}
                            disabled={genCL[id]}
                          >
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                          </button>
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                        <button
                          style={s.copyBtn}
                          onClick={() => handleCopyCardLetter(id, cl)}
                        >
                          {copySuccess[id] ? 'Copied!' : 'Copy'}
                        </button>
                        <button
                          style={s.openGeneratorBtn}
                          onClick={() => navigate('/cover-letter', { state: { internship: intern } })}
                          title="Open full editor"
                        >
                          Open in Editor <ArrowRight size={12} />
                        </button>
                      </div>
                    </div>
                    <pre style={s.clText}>{cl}</pre>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </Layout>
  )
}

const s = {
  page:  { maxWidth: 960, paddingBottom: 40 },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 6 },
  sub:   { color: 'var(--text2)', fontSize: 14, margin: 0, maxWidth: 650 },

  uploadCard: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '24px', marginBottom: 20 },
  dropZone:   { border: '2px dashed var(--border)', borderRadius: 10, padding: '30px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', transition: 'all 0.2s', marginBottom: 16 },
  dropActive: { borderColor: 'var(--accent)', background: 'var(--accent-glow)' },
  dropTitle:  { fontWeight: 600, fontSize: 14, color: 'var(--text)', textAlign: 'center', margin: 0 },
  dropSub:    { fontSize: 12, color: 'var(--text3)', margin: 0 },
  uploadRow:  { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  fileChip:   { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, background: 'var(--accent-glow)', color: 'var(--accent2)', padding: '6px 12px', borderRadius: 99, border: '1px solid rgba(124,111,247,0.3)' },
  activeResumeChip: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, background: 'var(--green-bg)', color: 'var(--green)', padding: '6px 12px', borderRadius: 99, border: '1px solid var(--green)' },
  chipX:      { background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 0, lineHeight: 1, marginLeft: 2 },
  matchBtn:   { display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#7c6ff7,#a78bfa)', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 22px', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'opacity 0.15s' },
  errorBox:   { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginTop: 12 },

  summaryBox:  { display: 'flex', alignItems: 'flex-start', gap: 12, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 10, padding: '16px 18px', marginBottom: 20 },
  summaryTitle:{ fontSize: 13, fontWeight: 700, color: 'var(--yellow)', display: 'block', marginBottom: 4 },
  summaryText: { fontSize: 13, color: 'var(--text2)', lineHeight: 1.65, margin: 0 },

  filterBar:   { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' },
  searchWrap:  { position: 'relative', flex: 1, minWidth: 220 },
  searchIcon:  { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' },
  searchInput: { width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 34px 9px 36px', color: 'var(--text)', fontSize: 13, outline: 'none' },
  clearSearchBtn: { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 2 },
  filterGroup: { display: 'flex', gap: 10 },
  selectWrap:  { position: 'relative' },
  filterSelect:{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text2)', fontSize: 13, outline: 'none', cursor: 'pointer' },

  resultsHeader: { marginBottom: 16 },
  resultsTitle:  { fontSize: 18, fontWeight: 700, margin: 0 },
  resultsSub:    { fontSize: 13, color: 'var(--text3)', margin: 0, marginTop: 2 },
  centerLoading: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 60 },

  cards: { display: 'flex', flexDirection: 'column', gap: 18 },
  card:  { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 14, transition: 'border-color 0.2s' },

  cardTop:      { display: 'flex', flexDirection: 'column', gap: 10 },
  cardTitleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  cardTitle:    { fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: 0 },
  cardCompany:  { fontSize: 13, color: 'var(--accent2)', fontWeight: 600, margin: 0, marginTop: 2 },

  matchBadge: { display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: 10, padding: '8px 14px', flexShrink: 0 },
  matchPct:   { fontSize: 18, fontWeight: 800, lineHeight: 1.1 },
  matchLabel: { fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', marginTop: 2 },

  metaRow:    { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  meta:       { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text3)' },
  domainBadge:{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99 },

  desc:       { fontSize: 13, color: 'var(--text2)', lineHeight: 1.65, margin: 0 },

  skillsRow:  { display: 'flex', flexWrap: 'wrap', gap: 6 },
  skillChip:  { fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 99, background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)' },

  applyErr: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--red)', background: 'var(--red-bg)', padding: '8px 12px', borderRadius: 8 },

  actions:    { display: 'flex', gap: 10, flexWrap: 'wrap' },
  applyBtn:   { display: 'flex', alignItems: 'center', gap: 7, background: 'linear-gradient(135deg,#7c6ff7,#a78bfa)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'opacity 0.15s' },
  applyBtnDone: { background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green)' },
  clBtn:      { display: 'flex', alignItems: 'center', gap: 7, background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'opacity 0.15s' },

  clPanel:     { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' },
  clHeader:    { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexWrap: 'wrap' },
  clHeaderText:{ fontSize: 12, fontWeight: 600, color: 'var(--text)' },
  cardToneRow: { display: 'flex', gap: 4 },
  cardToneBtn: { background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text3)', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, cursor: 'pointer' },
  cardToneBtnActive: { background: 'var(--accent-glow)', color: 'var(--accent2)', borderColor: 'var(--accent)' },
  copyBtn:     { fontSize: 11, fontWeight: 600, color: 'var(--accent2)', background: 'var(--accent-glow)', border: '1px solid rgba(124,111,247,0.3)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' },
  openGeneratorBtn: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--text2)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' },
  clText:      { fontSize: 12, color: 'var(--text2)', lineHeight: 1.7, padding: '16px', margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', overflowX: 'auto' },

  spin: { animation: 'spin 0.8s linear infinite' },
}
