import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { generateCoverLetter, browseInternships, applyToInternship } from '../api'
import {
  Mail, Loader, Copy, CheckCircle, AlertCircle, ChevronDown,
  Download, Send, Edit3, Sparkles, Building, Briefcase, MapPin
} from 'lucide-react'

const TONES = [
  { id: 'formal', label: 'Formal', desc: 'Polished, authoritative & professional' },
  { id: 'friendly', label: 'Friendly', desc: 'Warm, personable & collaborative' },
  { id: 'enthusiastic', label: 'Enthusiastic', desc: 'High-energy, passionate & eager' },
]

export default function CoverLetter() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [internships, setInternships] = useState([])
  const [loadingInternships, setLoadingInternships] = useState(true)
  const [selected, setSelected]       = useState('')
  const [tone, setTone]               = useState('formal')
  const [emphasize, setEmphasize]     = useState('')
  const [generating, setGenerating]   = useState(false)
  const [letter, setLetter]           = useState('')
  const [isEditingLetter, setIsEditingLetter] = useState(false)
  const [stale, setStale]             = useState(false)
  const [error, setError]             = useState('')
  const [copied, setCopied]           = useState(false)

  // Direct Apply state
  const [applying, setApplying]       = useState(false)
  const [appliedOk, setAppliedOk]     = useState(false)
  const [applyError, setApplyError]   = useState('')

  // Retrieve resume from localStorage (fallback to user profile)
  const lastResume = (() => {
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
          _isProfileFallback: true,
        }
      }
      return null
    } catch {
      return null
    }
  })()

  // Load internships on mount and check for passed state
  useEffect(() => {
    const fetchList = async () => {
      setLoadingInternships(true)
      try {
        const res = await browseInternships()
        const list = res.data || []
        setInternships(list)

        // Pre-select if navigated from internships card
        if (location.state?.internship) {
          setSelected(location.state.internship.id)
        } else if (list.length > 0 && !selected) {
          setSelected(list[0].id)
        }
      } catch {
        setInternships([])
      } finally {
        setLoadingInternships(false)
      }
    }
    fetchList()
  }, [location.state])

  const selectedInternship = internships.find(i => i.id === selected) || location.state?.internship

  const handleGenerate = async (overrideTone = null) => {
    const activeTone = overrideTone || tone
    if (!lastResume || !selectedInternship) return
    setError(''); setLetter(''); setStale(false); setGenerating(true)
    setAppliedOk(false); setApplyError('')
    try {
      const res = await generateCoverLetter({
        resume_data: lastResume,
        internship:  selectedInternship,
        tone:        activeTone,
        emphasize:   emphasize || '',
      })
      setLetter(res.data.cover_letter)
      setIsEditingLetter(false)
    } catch (err) {
      setError(err.response?.data?.detail || 'Generation failed. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(letter)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    if (!letter) return
    const blob = new Blob([letter], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Cover_Letter_${selectedInternship?.company || 'Application'}_${tone}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleApplyWithLetter = async () => {
    if (!selectedInternship) return
    setApplying(true)
    setApplyError('')
    try {
      await applyToInternship({
        internship_id:    selectedInternship.id,
        internship_title: selectedInternship.title,
        company:          selectedInternship.company,
        location:         selectedInternship.location,
        work_mode:        selectedInternship.work_mode,
        domain:           selectedInternship.domain,
        match_percentage: selectedInternship.match_percentage ? String(selectedInternship.match_percentage) : null,
        cover_note:       letter ? letter.slice(0, 1000) : 'Applied with tailored cover letter',
      })
      setAppliedOk(true)
      setTimeout(() => setAppliedOk(false), 4000)
    } catch (err) {
      setApplyError(err.response?.data?.detail || 'Application failed or already applied.')
    } finally {
      setApplying(false)
    }
  }

  return (
    <Layout>
      <div style={s.page}>
        <h1 style={s.title}>Cover Letter Generator</h1>
        <p style={s.sub}>
          Generate tailored, high-converting cover letters grounded strictly in your actual resume details across 3 distinct communication tones.
        </p>

        <div style={s.grid}>
          {/* ── Controls column ── */}
          <div style={s.controls}>

            {/* Resume indicator */}
            <div style={s.section}>
              <label style={s.label}>Candidate Profile & Resume</label>
              {lastResume ? (
                <div style={s.resumeChip}>
                  <CheckCircle size={15} color="var(--green)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={s.resumeChipName}>
                      {lastResume._filename || (lastResume._isProfileFallback ? 'Profile Details' : 'Active Resume')}
                    </div>
                    <div style={s.resumeChipSub}>
                      {lastResume.full_name || user?.name} · {lastResume.skills?.length || 0} skills detected
                    </div>
                  </div>
                </div>
              ) : (
                <div style={s.noResume}>
                  <AlertCircle size={15} color="var(--yellow)" />
                  <span>No resume uploaded yet. Go to <b>Resumes</b> to upload one or update your <b>Profile</b>.</span>
                </div>
              )}
            </div>

            {/* Internship selector */}
            <div style={s.section}>
              <label style={s.label}>Target Internship</label>
              <p style={s.labelHint}>Choose which position you are writing for</p>
              <div style={s.selectWrap}>
                <select
                  style={s.select}
                  value={selected}
                  onChange={e => { setSelected(e.target.value); setLetter(''); setStale(false) }}
                  disabled={loadingInternships}
                >
                  {loadingInternships && <option value="">Loading internships…</option>}
                  {internships.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.title} — {i.company} ({i.domain || 'Tech'})
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} style={s.selectIcon} />
              </div>

              {selectedInternship && (
                <div style={s.targetDetailsBox}>
                  <div style={s.targetDetailRow}>
                    <Building size={13} color="var(--accent2)" />
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>{selectedInternship.company}</span>
                    <span style={{ color: 'var(--text3)' }}>·</span>
                    <span style={{ color: 'var(--text2)' }}>{selectedInternship.title}</span>
                  </div>
                  {selectedInternship.location && (
                    <div style={s.targetDetailRow}>
                      <MapPin size={12} color="var(--text3)" />
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>{selectedInternship.location} ({selectedInternship.work_mode || 'Full-time'})</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tone selector */}
            <div style={s.section}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={s.label}>Tone Selection</label>
                <span style={s.toneHelp}>3 Available Styles</span>
              </div>
              <div style={s.toneGrid}>
                {TONES.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    style={{ ...s.toneCard, ...(tone === t.id ? s.toneCardActive : {}) }}
                    onClick={() => {
                      setTone(t.id)
                      if (letter) setStale(true)
                    }}
                  >
                    <div style={s.toneCardHeader}>
                      <span style={s.toneCardTitle}>{t.label}</span>
                      {tone === t.id && <CheckCircle size={13} color="var(--accent2)" />}
                    </div>
                    <span style={s.toneCardDesc}>{t.desc}</span>
                  </button>
                ))}
              </div>
              {stale && (
                <p style={s.staleHint}>⚠ Settings changed — click Generate to re-draft in {tone} tone</p>
              )}
            </div>

            {/* Emphasize */}
            <div style={s.section}>
              <label style={s.label}>Special Emphasis <span style={s.optional}>(optional)</span></label>
              <input
                style={s.input}
                placeholder="e.g. my React project or AWS certification"
                value={emphasize}
                onChange={e => { setEmphasize(e.target.value); if (letter) setStale(true) }}
              />
            </div>

            {error && <div style={s.errorBox}><AlertCircle size={14} />{error}</div>}

            <button
              style={{
                ...s.genBtn,
                opacity: (!lastResume || !selected || generating) ? 0.55 : 1,
                ...(stale ? s.genBtnStale : {})
              }}
              onClick={() => handleGenerate()}
              disabled={!lastResume || !selected || generating}
            >
              {generating ? (
                <><Loader size={16} style={s.spin} /> Drafting with AI…</>
              ) : stale ? (
                <><Sparkles size={16} /> Regenerate ({tone.charAt(0).toUpperCase() + tone.slice(1)})</>
              ) : (
                <><Mail size={16} /> Generate Cover Letter</>
              )}
            </button>
          </div>

          {/* ── Output column ── */}
          <div style={s.output}>
            {!letter && !generating && (
              <div style={s.emptyState}>
                <div style={s.emptyIconCircle}>
                  <Mail size={36} color="var(--accent2)" />
                </div>
                <p style={s.emptyTitle}>Your personalized cover letter will appear here</p>
                <p style={s.emptySub}>
                  Select your target internship, choose your preferred tone (Formal, Friendly, Enthusiastic), and click <b>Generate Cover Letter</b>.
                </p>
              </div>
            )}

            {generating && (
              <div style={s.emptyState}>
                <Loader size={36} color="var(--accent2)" style={s.spin} />
                <p style={s.emptyTitle}>Generating your {tone} cover letter…</p>
                <p style={s.emptySub}>Extracting relevant skills & tailoring paragraph structure to {selectedInternship?.company || 'the role'}...</p>
              </div>
            )}

            {letter && (
              <>
                <div style={s.outputHeader}>
                  <div style={s.outputHeaderLeft}>
                    <span style={s.outputTitle}>Cover Letter</span>
                    <span style={s.toneBadge}>
                      {tone.charAt(0).toUpperCase() + tone.slice(1)} Tone
                    </span>
                    {selectedInternship && (
                      <span style={s.outputMeta}>
                        · {selectedInternship.title} at {selectedInternship.company}
                      </span>
                    )}
                  </div>

                  <div style={s.outputActions}>
                    <button
                      style={s.actionBtn}
                      onClick={() => setIsEditingLetter(!isEditingLetter)}
                      title="Edit letter text"
                    >
                      <Edit3 size={13} />
                      <span>{isEditingLetter ? 'Done Editing' : 'Edit'}</span>
                    </button>
                    <button style={s.actionBtn} onClick={handleDownload} title="Download as text file">
                      <Download size={13} />
                      <span>Download</span>
                    </button>
                    <button style={s.copyBtn} onClick={handleCopy}>
                      {copied ? (
                        <><CheckCircle size={13} color="var(--green)" /> Copied!</>
                      ) : (
                        <><Copy size={13} /> Copy</>
                      )}
                    </button>
                  </div>
                </div>

                {appliedOk && (
                  <div style={s.applySuccessBanner}>
                    <CheckCircle size={15} color="var(--green)" />
                    <span>Application successfully submitted with this cover letter! Track it in <b>My Applications</b>.</span>
                  </div>
                )}
                {applyError && (
                  <div style={s.applyErrBanner}>
                    <AlertCircle size={15} color="var(--red)" />
                    <span>{applyError}</span>
                  </div>
                )}

                {/* Letter Body: Editable or View pre-wrap */}
                <div style={s.letterBodyWrap}>
                  {isEditingLetter ? (
                    <textarea
                      style={s.editTextarea}
                      value={letter}
                      onChange={e => setLetter(e.target.value)}
                      placeholder="Edit your cover letter here..."
                    />
                  ) : (
                    <pre style={s.letterText}>{letter}</pre>
                  )}
                </div>

                {/* Output Footer with One-Click Apply */}
                <div style={s.outputFooter}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text3)' }}>
                    <span>Ready to apply to {selectedInternship?.company}?</span>
                  </div>
                  <button
                    style={{ ...s.directApplyBtn, opacity: applying ? 0.65 : 1 }}
                    onClick={handleApplyWithLetter}
                    disabled={applying}
                  >
                    {applying ? (
                      <><Loader size={14} style={s.spin} /> Submitting Application…</>
                    ) : (
                      <><Send size={14} /> Apply to {selectedInternship?.company || 'Internship'}</>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

const s = {
  page:  { maxWidth: 1140, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 6 },
  sub:   { color: 'var(--text2)', fontSize: 14, margin: 0, marginBottom: 30, maxWidth: 700 },

  grid:     { display: 'grid', gridTemplateColumns: '360px 1fr', gap: 24, alignItems: 'start' },
  controls: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 },

  section:    { display: 'flex', flexDirection: 'column', gap: 8 },
  label:      { fontSize: 13, fontWeight: 600, color: 'var(--text)' },
  labelHint:  { fontSize: 11, color: 'var(--text3)', margin: 0, marginTop: -3 },
  toneHelp:   { fontSize: 11, color: 'var(--accent2)', fontWeight: 600 },
  optional:   { fontWeight: 400, color: 'var(--text3)' },

  resumeChip: { display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--green-bg)', border: '1px solid var(--green)', borderRadius: 8, padding: '10px 12px' },
  resumeChipName: { fontSize: 13, fontWeight: 600, color: 'var(--text)' },
  resumeChipSub:  { fontSize: 11, color: 'var(--text3)', marginTop: 2 },
  noResume: { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--yellow-bg)', border: '1px solid var(--yellow)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--text2)' },

  selectWrap: { position: 'relative' },
  select:     { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 36px 10px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', appearance: 'none', cursor: 'pointer' },
  selectIcon: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' },

  targetDetailsBox: { background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4, border: '1px solid var(--border)' },
  targetDetailRow:  { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 },

  toneGrid: { display: 'flex', flexDirection: 'column', gap: 8 },
  toneCard: { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: 2 },
  toneCardActive: { background: 'var(--accent-glow)', borderColor: 'var(--accent)', boxShadow: '0 0 0 1px var(--accent)' },
  toneCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  toneCardTitle:  { fontSize: 13, fontWeight: 600, color: 'var(--text)' },
  toneCardDesc:   { fontSize: 11, color: 'var(--text3)' },

  input: { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%' },

  errorBox: { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red)', borderRadius: 8, padding: '10px 14px', fontSize: 13 },

  genBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'linear-gradient(135deg,#7c6ff7,#a78bfa)', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'opacity 0.15s', marginTop: 4 },
  genBtnStale:{ background: 'linear-gradient(135deg,#f59e0b,#fbbf24)' },
  staleHint:  { fontSize: 11, color: 'var(--yellow)', margin: 0, marginTop: 4 },

  output:          { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', minHeight: 560, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  emptyState:      { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40, textAlign: 'center' },
  emptyIconCircle: { width: 72, height: 72, borderRadius: '50%', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' },
  emptyTitle:      { fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 },
  emptySub:        { fontSize: 13, color: 'var(--text3)', maxWidth: 440, lineHeight: 1.6, margin: 0 },

  outputHeader:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg3)', flexWrap: 'wrap', gap: 12 },
  outputHeaderLeft:{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  outputTitle:     { fontSize: 15, fontWeight: 700, color: 'var(--text)' },
  toneBadge:       { fontSize: 11, fontWeight: 600, color: 'var(--accent2)', background: 'var(--accent-glow)', padding: '2px 8px', borderRadius: 99, border: '1px solid rgba(124,111,247,0.3)' },
  outputMeta:      { fontSize: 12, color: 'var(--text3)' },

  outputActions: { display: 'flex', alignItems: 'center', gap: 8 },
  actionBtn:     { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color: 'var(--text2)', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 11px', cursor: 'pointer' },
  copyBtn:       { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--accent2)', background: 'var(--accent-glow)', border: '1px solid rgba(124,111,247,0.3)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer' },

  applySuccessBanner: { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--green-bg)', color: 'var(--green)', padding: '10px 18px', fontSize: 13, borderBottom: '1px solid var(--green)' },
  applyErrBanner:     { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--red-bg)', color: 'var(--red)', padding: '10px 18px', fontSize: 13, borderBottom: '1px solid var(--red)' },

  letterBodyWrap: { flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column' },
  letterText:     { fontSize: 13, color: 'var(--text)', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', wordBreak: 'break-word' },
  editTextarea:   { width: '100%', flex: 1, minHeight: 380, background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 8, padding: '16px', color: 'var(--text)', fontSize: 13, lineHeight: 1.8, outline: 'none', resize: 'vertical', fontFamily: 'inherit' },

  outputFooter:   { padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  directApplyBtn: { display: 'flex', alignItems: 'center', gap: 7, background: 'linear-gradient(135deg,#7c6ff7,#a78bfa)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },

  spin: { animation: 'spin 0.8s linear infinite' },
}

