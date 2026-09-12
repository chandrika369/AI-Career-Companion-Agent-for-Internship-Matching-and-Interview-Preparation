import React, { useState } from 'react'
import Layout from '../components/Layout'
import { uploadResume } from '../api'
import { Upload, FileText, CheckCircle, AlertCircle, X, ChevronDown, ChevronUp } from 'lucide-react'

export default function Resumes() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [expanded, setExpanded] = useState({})

  // Saved resumes list (persistent in localStorage)
  const [savedResumes, setSavedResumes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('resumes') || '[]') } catch { return [] }
  })

  // Load lastResume on initial mount if available
  useState(() => {
    try {
      const last = JSON.parse(localStorage.getItem('lastResume') || 'null')
      if (last && !result) setResult(last)
    } catch (_) {}
  })

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }

  const handleUpload = async () => {
    if (!file) return
    setError(''); setLoading(true); setResult(null)
    try {
      const res = await uploadResume(file)
      const data = { ...res.data, _filename: file.name, _uploadedAt: new Date().toISOString() }
      setResult(data)
      // Save permanently to localStorage
      localStorage.setItem('lastResume', JSON.stringify(data))
      const list = [data, ...savedResumes.filter(r => r._filename !== file.name)].slice(0, 10)
      setSavedResumes(list)
      localStorage.setItem('resumes', JSON.stringify(list))
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed. Check the file and try again.')
    } finally {
      setLoading(false)
    }
  }

  const loadResume = (r) => {
    setResult(r)
    localStorage.setItem('lastResume', JSON.stringify(r))
  }

  const removeResume = (idx) => {
    const list = savedResumes.filter((_, i) => i !== idx)
    setSavedResumes(list)
    localStorage.setItem('resumes', JSON.stringify(list))
  }

  const toggle = (key) => setExpanded(e => ({ ...e, [key]: !e[key] }))

  const Section = ({ title, items, color = 'var(--accent2)' }) => {
    if (!items?.length) return null
    const key = title
    return (
      <div style={s.section}>
        <button style={s.sectionToggle} onClick={() => toggle(key)}>
          <span style={{ color }}>{title}</span>
          <span style={s.badge}>{items.length}</span>
          {expanded[key] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {expanded[key] && (
          <div style={s.sectionBody}>
            {items.map((item, i) => <div key={i} style={s.sectionItem}>{item}</div>)}
          </div>
        )}
      </div>
    )
  }

  return (
    <Layout>
      <div style={s.page}>
        <h1 style={s.pageTitle}>Resumes</h1>
        <p style={s.pageSub}>Upload your resume to parse and extract your profile data</p>

        <div style={s.grid}>
          {/* Left — upload + saved */}
          <div style={s.leftCol}>
            {/* Upload zone */}
            <div
              style={{ ...s.dropZone, ...(dragging ? s.dropZoneActive : {}) }}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <Upload size={32} color="var(--text3)" />
              <p style={s.dropTitle}>Drag & drop your resume</p>
              <p style={s.dropSub}>Supports PDF and DOCX</p>
              <label style={s.browseBtn}>
                Browse File
                <input type="file" accept=".pdf,.docx" style={{ display: 'none' }} onChange={e => setFile(e.target.files[0])} />
              </label>
              {file && (
                <div style={s.selectedFile}>
                  <FileText size={14} color="var(--accent2)" />
                  <span>{file.name}</span>
                  <button style={s.clearFile} onClick={() => setFile(null)}><X size={12} /></button>
                </div>
              )}
            </div>

            <button
              style={{ ...s.uploadBtn, opacity: (!file || loading) ? 0.6 : 1 }}
              onClick={handleUpload}
              disabled={!file || loading}
            >
              {loading ? 'Parsing resume…' : 'Parse Resume'}
            </button>

            {error && <div style={s.error}><AlertCircle size={14} />{error}</div>}

            {/* Saved resumes */}
            {savedResumes.length > 0 && (
              <div style={s.savedCard}>
                <h3 style={s.savedTitle}>Parsed Resumes</h3>
                {savedResumes.map((r, i) => (
                  <div key={i} style={s.savedRow}>
                    <button style={s.savedBtn} onClick={() => loadResume(r)}>
                      <FileText size={14} color="var(--accent2)" />
                      <div style={{ minWidth: 0 }}>
                        <div style={s.savedName}>{r._filename}</div>
                        <div style={s.savedMeta}>{r.full_name || 'Unknown'} · {r.skills?.length || 0} skills</div>
                      </div>
                    </button>
                    <button style={s.removeBtn} onClick={() => removeResume(i)}><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right — parsed result */}
          {result && (
            <div style={s.resultCard}>
              <div style={s.resultHeader}>
                <CheckCircle size={18} color="var(--green)" />
                <h3 style={s.resultTitle}>Parsed: {result._filename}</h3>
              </div>

              {/* Contact info */}
              <div style={s.contactGrid}>
                {[
                  ['Name', result.full_name],
                  ['Email', result.email],
                  ['Phone', result.phone],
                  ['LinkedIn', result.linkedin],
                  ['GitHub', result.github],
                  ['Address', result.address],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} style={s.contactItem}>
                    <span style={s.contactKey}>{k}</span>
                    <span style={s.contactVal}>{v}</span>
                  </div>
                ))}
              </div>

              {result.summary && (
                <div style={s.summaryBox}>
                  <p style={s.summaryText}>{result.summary}</p>
                </div>
              )}

              {result.skills?.length > 0 && (
                <div style={s.skillsRow}>
                  {result.skills.map((sk, i) => <span key={i} style={s.skill}>{sk}</span>)}
                </div>
              )}

              <Section title="Education" items={result.education} color="var(--blue)" />
              <Section title="Work Experience" items={result.work_experience} color="var(--green)" />
              <Section title="Projects" items={result.projects} color="var(--yellow)" />
              <Section title="Internships" items={result.internships} color="var(--accent2)" />
              <Section title="Certifications" items={result.certifications} color="var(--green)" />
              <Section title="Achievements" items={result.achievements} color="var(--yellow)" />
              <Section title="Languages" items={result.languages} color="var(--blue)" />
              <Section title="Soft Skills" items={result.soft_skills} color="var(--text2)" />
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

const s = {
  page: { maxWidth: 1100 },
  pageTitle: { fontSize: 26, fontWeight: 700, marginBottom: 6 },
  pageSub: { color: 'var(--text2)', fontSize: 14, marginBottom: 32 },
  grid: { display: 'grid', gridTemplateColumns: '340px 1fr', gap: 24, alignItems: 'start' },
  leftCol: { display: 'flex', flexDirection: 'column', gap: 16 },
  dropZone: { border: '2px dashed var(--border)', borderRadius: 'var(--radius)', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', transition: 'border-color 0.2s', background: 'var(--bg2)' },
  dropZoneActive: { borderColor: 'var(--accent)', background: 'var(--accent-glow)' },
  dropTitle: { fontWeight: 600, fontSize: 14 },
  dropSub: { color: 'var(--text3)', fontSize: 12 },
  browseBtn: { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer', color: 'var(--text)', marginTop: 4 },
  selectedFile: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--accent2)', background: 'var(--accent-glow)', padding: '6px 12px', borderRadius: 99, marginTop: 4, maxWidth: '100%' },
  clearFile: { background: 'none', border: 'none', color: 'var(--text3)', padding: 0, lineHeight: 1 },
  uploadBtn: { background: 'linear-gradient(135deg,#7c6ff7,#a78bfa)', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 14, fontWeight: 600, width: '100%', transition: 'opacity 0.15s' },
  error: { background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red)', borderRadius: 8, padding: '10px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 },
  savedCard: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 },
  savedTitle: { fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 },
  savedRow: { display: 'flex', alignItems: 'center', gap: 8 },
  savedBtn: { flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', textAlign: 'left', minWidth: 0 },
  savedName: { fontSize: 12, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  savedMeta: { fontSize: 11, color: 'var(--text3)' },
  removeBtn: { background: 'none', border: 'none', color: 'var(--text3)', padding: 4, flexShrink: 0 },
  resultCard: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 },
  resultHeader: { display: 'flex', alignItems: 'center', gap: 10 },
  resultTitle: { fontWeight: 600, fontSize: 15 },
  contactGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px' },
  contactItem: { display: 'flex', flexDirection: 'column', gap: 2 },
  contactKey: { fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' },
  contactVal: { fontSize: 13, color: 'var(--text)', wordBreak: 'break-word' },
  summaryBox: { background: 'var(--bg3)', borderRadius: 8, padding: '14px', borderLeft: '3px solid var(--accent)' },
  summaryText: { fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 },
  skillsRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  skill: { fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 99, background: 'var(--accent-glow)', color: 'var(--accent2)', border: '1px solid rgba(124,111,247,0.3)' },
  section: { borderTop: '1px solid var(--border)', paddingTop: 12 },
  sectionToggle: { display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, width: '100%', textAlign: 'left', padding: '4px 0' },
  badge: { marginLeft: 'auto', background: 'var(--bg3)', color: 'var(--text2)', fontSize: 11, borderRadius: 99, padding: '2px 8px', minWidth: 24, textAlign: 'center' },
  sectionBody: { marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 },
  sectionItem: { fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, paddingLeft: 12, borderLeft: '2px solid var(--border)' },
}
