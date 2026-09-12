import React, { useState, useEffect, useRef } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { updateProfile, changePassword } from '../api'
import {
  Camera, Save, Lock, CheckCircle,
  Mail, Phone, User, Shield, Edit3, Plus, X,
  Sparkles, Globe, Github, Linkedin, AlertCircle, ArrowLeft
} from 'lucide-react'

const SUGGESTED_SKILLS = [
  'Python', 'React', 'JavaScript', 'TypeScript', 'FastAPI', 'Node.js',
  'Machine Learning', 'Deep Learning', 'SQL', 'PostgreSQL', 'Docker',
  'Git', 'AWS', 'Java', 'C++', 'Data Science', 'Tailwind CSS', 'HTML/CSS'
]

export default function Profile() {
  const { user, refreshUser } = useAuth()

  // Profile fields
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')
  const [github, setGithub] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [skills, setSkills] = useState([])
  const [newSkillInput, setNewSkillInput] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveOk, setSaveOk] = useState(false)
  const [saveErr, setSaveErr] = useState('')

  // Password fields
  const [curPwd, setCurPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdOk, setPwdOk] = useState(false)
  const [pwdErr, setPwdErr] = useState('')

  // Avatar
  const [photo, setPhoto] = useState(null)
  const fileRef = useRef()

  // Sync state with user data from backend
  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setPhone(user.phone || '')
      setBio(user.bio || '')
      setGithub(user.github || '')
      setLinkedin(user.linkedin || '')
      setSkills(Array.isArray(user.skills) ? user.skills : [])
    }
  }, [user])

  const initials = user?.name
    ?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'

  const handlePhoto = (e) => {
    const f = e.target.files[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      setPhoto(reader.result)
      try { localStorage.setItem(`avatar_${user?.id}`, reader.result) } catch (_) {}
    }
    reader.readAsDataURL(f)
  }

  // Load cached avatar if available
  useEffect(() => {
    if (user?.id) {
      const savedAvatar = localStorage.getItem(`avatar_${user.id}`)
      if (savedAvatar) setPhoto(savedAvatar)
    }
  }, [user?.id])

  // Add skill
  const handleAddSkill = (skillToAdd) => {
    const trimmed = (skillToAdd || newSkillInput).trim()
    if (!trimmed) return
    if (!skills.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      setSkills([...skills, trimmed])
    }
    setNewSkillInput('')
  }

  // Remove skill
  const handleRemoveSkill = (skillToRemove) => {
    setSkills(skills.filter(s => s !== skillToRemove))
  }

  // Import skills from parsed resume if available in localStorage
  const handleImportResumeSkills = () => {
    try {
      const lastResume = JSON.parse(localStorage.getItem('lastResume') || 'null')
      if (lastResume?.skills && Array.isArray(lastResume.skills)) {
        const merged = Array.from(new Set([...skills, ...lastResume.skills]))
        setSkills(merged)
        setSaveOk(true)
        setTimeout(() => setSaveOk(false), 3000)
      } else {
        alert('No parsed resume skills found. Upload a resume in the Resumes page first.')
      }
    } catch (_) {
      alert('Could not read resume data.')
    }
  }

  // Save profile changes
  const handleSave = async (e) => {
    if (e) e.preventDefault()
    setSaveErr(''); setSaveOk(false); setSaving(true)
    try {
      await updateProfile({
        name,
        phone,
        skills,
        bio,
        github,
        linkedin,
      })
      await refreshUser()
      setSaveOk(true)
      setIsEditing(false)
      setTimeout(() => setSaveOk(false), 3500)
    } catch (err) {
      setSaveErr(err.response?.data?.detail || 'Save failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    if (user) {
      setName(user.name || '')
      setPhone(user.phone || '')
      setBio(user.bio || '')
      setGithub(user.github || '')
      setLinkedin(user.linkedin || '')
      setSkills(Array.isArray(user.skills) ? user.skills : [])
    }
    setSaveErr('')
    setIsEditing(false)
  }

  // Change password
  const handlePwd = async (e) => {
    e.preventDefault()
    setPwdErr(''); setPwdOk(false); setPwdLoading(true)
    try {
      await changePassword({ current_password: curPwd, new_password: newPwd })
      setPwdOk(true); setCurPwd(''); setNewPwd('')
      setTimeout(() => setPwdOk(false), 3000)
    } catch (err) {
      setPwdErr(err.response?.data?.detail || 'Password change failed')
    } finally {
      setPwdLoading(false)
    }
  }

  return (
    <Layout>
      <div style={s.page}>
        <div style={s.headerRow}>
          <div>
            <h1 style={s.pageTitle}>My Profile</h1>
            <p style={s.pageSub}>Manage your candidate profile, technical skills, and account details</p>
          </div>
          {!isEditing ? (
            <button style={s.editProfileBtn} onClick={() => setIsEditing(true)}>
              <Edit3 size={15} />
              <span>Edit Profile</span>
            </button>
          ) : (
            <button style={s.cancelTopBtn} onClick={handleCancelEdit}>
              <ArrowLeft size={15} />
              <span>Cancel Editing</span>
            </button>
          )}
        </div>

        {saveOk && (
          <div style={s.successMsg}>
            <CheckCircle size={16} />
            <span>Profile and skills saved successfully! All changes are permanently stored.</span>
          </div>
        )}
        {saveErr && <div style={s.errorMsg}><AlertCircle size={16} />{saveErr}</div>}

        <div style={s.grid}>
          {/* ── Left column: Avatar & Quick Info ── */}
          <div style={s.leftCol}>
            <div style={s.avatarCard}>
              <div style={s.avatarWrap}>
                {photo ? (
                  <img src={photo} alt="avatar" style={s.avatarImg} />
                ) : (
                  <div style={s.avatarFallback}>{initials}</div>
                )}
                <button
                  style={s.cameraBtn}
                  onClick={() => fileRef.current.click()}
                  title="Change profile picture"
                >
                  <Camera size={13} color="#fff" />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handlePhoto}
                />
              </div>

              <h2 style={s.userName}>{user?.name}</h2>
              <p style={s.userRole}>Candidate</p>

              <div style={s.infoList}>
                <div style={s.infoRow}>
                  <Mail size={14} color="var(--text3)" />
                  <span>{user?.email}</span>
                </div>
                <div style={s.infoRow}>
                  <Phone size={14} color="var(--text3)" />
                  <span>{user?.phone || 'No phone added'}</span>
                </div>
                {user?.github && (
                  <div style={s.infoRow}>
                    <Github size={14} color="var(--text3)" />
                    <span style={s.truncate}>{user.github}</span>
                  </div>
                )}
                {user?.linkedin && (
                  <div style={s.infoRow}>
                    <Linkedin size={14} color="var(--text3)" />
                    <span style={s.truncate}>{user.linkedin}</span>
                  </div>
                )}
              </div>

              {/* Skills summary counter */}
              <div style={s.skillsSummaryBox}>
                <Sparkles size={14} color="var(--accent2)" />
                <span>{skills.length} Technical Skills Listed</span>
              </div>
            </div>
          </div>

          {/* ── Right column: Details & Skills Editor ── */}
          <div style={s.rightCol}>
            {/* Main Profile Info Card */}
            <div style={s.formCard}>
              <div style={s.cardHeaderRow}>
                <div style={s.cardHeader}>
                  <User size={18} color="var(--accent2)" />
                  <h3 style={s.cardTitle}>Personal Information</h3>
                </div>
                {!isEditing && (
                  <button style={s.smallEditBtn} onClick={() => setIsEditing(true)}>
                    <Edit3 size={13} /> Edit
                  </button>
                )}
              </div>

              {!isEditing ? (
                /* ── VIEW MODE ── */
                <div style={s.viewContainer}>
                  <div style={s.viewGrid}>
                    <div style={s.viewField}>
                      <span style={s.viewLabel}>Full Name</span>
                      <span style={s.viewValue}>{user?.name || 'Not provided'}</span>
                    </div>
                    <div style={s.viewField}>
                      <span style={s.viewLabel}>Email Address</span>
                      <span style={s.viewValue}>{user?.email}</span>
                    </div>
                    <div style={s.viewField}>
                      <span style={s.viewLabel}>Phone Number</span>
                      <span style={s.viewValue}>{user?.phone || 'Not provided'}</span>
                    </div>
                    <div style={s.viewField}>
                      <span style={s.viewLabel}>Candidate ID</span>
                      <span style={s.viewValue}>#{user?.id}</span>
                    </div>
                  </div>

                  {user?.bio && (
                    <div style={s.viewBioSection}>
                      <span style={s.viewLabel}>Bio / Summary</span>
                      <p style={s.bioText}>{user.bio}</p>
                    </div>
                  )}

                  {/* Skills Display in View Mode */}
                  <div style={s.viewSkillsSection}>
                    <div style={s.skillsSectionHeader}>
                      <span style={s.viewLabel}>Technical Skills ({skills.length})</span>
                    </div>
                    {skills.length > 0 ? (
                      <div style={s.skillsGrid}>
                        {skills.map((skill, i) => (
                          <span key={i} style={s.viewSkillChip}>
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div style={s.noSkillsPrompt}>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--text3)' }}>
                          No skills added yet. Click &quot;Edit Profile&quot; to add your technical skills.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* ── EDIT MODE ── */
                <form onSubmit={handleSave} style={s.form}>
                  <div style={s.inputGrid}>
                    <div style={s.fg}>
                      <label style={s.label}>Full Name *</label>
                      <input
                        style={s.input}
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Your full name"
                        required
                      />
                    </div>
                    <div style={s.fg}>
                      <label style={s.label}>Email (Permanent)</label>
                      <input
                        style={{ ...s.input, opacity: 0.6, cursor: 'not-allowed' }}
                        value={user?.email || ''}
                        disabled
                      />
                    </div>
                    <div style={s.fg}>
                      <label style={s.label}>Phone Number</label>
                      <input
                        style={s.input}
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="+91 9999999999"
                      />
                    </div>
                    <div style={s.fg}>
                      <label style={s.label}>GitHub Profile</label>
                      <input
                        style={s.input}
                        value={github}
                        onChange={e => setGithub(e.target.value)}
                        placeholder="https://github.com/yourhandle"
                      />
                    </div>
                    <div style={{ ...s.fg, gridColumn: 'span 2' }}>
                      <label style={s.label}>LinkedIn Profile</label>
                      <input
                        style={s.input}
                        value={linkedin}
                        onChange={e => setLinkedin(e.target.value)}
                        placeholder="https://linkedin.com/in/yourhandle"
                      />
                    </div>
                  </div>

                  <div style={s.fg}>
                    <label style={s.label}>Bio / Professional Summary</label>
                    <textarea
                      style={s.textarea}
                      rows={3}
                      value={bio}
                      onChange={e => setBio(e.target.value)}
                      placeholder="Brief overview of your background, career focus, and goals..."
                    />
                  </div>

                  {/* ── Interactive Skills Editor ── */}
                  <div style={s.skillsEditorBox}>
                    <div style={s.skillsEditorTop}>
                      <div>
                        <label style={s.label}>Technical Skills ({skills.length})</label>
                        <p style={s.labelSub}>Type a skill and press Enter, or pick from suggestions below</p>
                      </div>
                      <button
                        type="button"
                        style={s.importResumeBtn}
                        onClick={handleImportResumeSkills}
                        title="Load skills from your uploaded resume"
                      >
                        <Sparkles size={13} />
                        <span>Import from Resume</span>
                      </button>
                    </div>

                    {/* Skill input & Add button */}
                    <div style={s.addSkillRow}>
                      <input
                        style={s.addSkillInput}
                        value={newSkillInput}
                        onChange={e => setNewSkillInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddSkill()
                          }
                        }}
                        placeholder="Type skill (e.g. Python, React, Docker)..."
                      />
                      <button
                        type="button"
                        style={s.addSkillBtn}
                        onClick={() => handleAddSkill()}
                      >
                        <Plus size={14} />
                        <span>Add</span>
                      </button>
                    </div>

                    {/* Current Skills list with remove button */}
                    {skills.length > 0 && (
                      <div style={s.activeSkillsWrap}>
                        {skills.map((sk, idx) => (
                          <span key={idx} style={s.editableSkillChip}>
                            <span>{sk}</span>
                            <button
                              type="button"
                              style={s.skillRemoveBtn}
                              onClick={() => handleRemoveSkill(sk)}
                              title={`Remove ${sk}`}
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Quick suggestion tags */}
                    <div style={s.suggestionsBox}>
                      <span style={s.suggestionsLabel}>Suggested skills:</span>
                      <div style={s.suggestedChipsRow}>
                        {SUGGESTED_SKILLS.filter(sug => !skills.some(s => s.toLowerCase() === sug.toLowerCase())).slice(0, 10).map((sug, i) => (
                          <button
                            key={i}
                            type="button"
                            style={s.sugChip}
                            onClick={() => handleAddSkill(sug)}
                          >
                            + {sug}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={s.actionRow}>
                    <button
                      type="submit"
                      style={{ ...s.saveBtn, opacity: saving ? 0.65 : 1 }}
                      disabled={saving}
                    >
                      <Save size={15} />
                      <span>{saving ? 'Saving to Database…' : 'Save Changes'}</span>
                    </button>
                    <button
                      type="button"
                      style={s.cancelBtn}
                      onClick={handleCancelEdit}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Change Password Card */}
            <div style={s.formCard}>
              <div style={s.cardHeader}>
                <Shield size={18} color="var(--accent2)" />
                <h3 style={s.cardTitle}>Change Password</h3>
              </div>

              {pwdOk  && <div style={s.successMsg}><CheckCircle size={14} /> Password changed successfully</div>}
              {pwdErr && <div style={s.errorMsg}><AlertCircle size={14} />{pwdErr}</div>}

              <form onSubmit={handlePwd} style={s.form}>
                <div style={s.inputGrid}>
                  <div style={s.fg}>
                    <label style={s.label}>Current Password</label>
                    <input
                      style={s.input}
                      type="password"
                      value={curPwd}
                      onChange={e => setCurPwd(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <div style={s.fg}>
                    <label style={s.label}>New Password</label>
                    <input
                      style={s.input}
                      type="password"
                      value={newPwd}
                      onChange={e => setNewPwd(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  style={{ ...s.secondarySaveBtn, opacity: pwdLoading ? 0.65 : 1 }}
                  disabled={pwdLoading}
                >
                  <Lock size={14} />
                  <span>{pwdLoading ? 'Updating…' : 'Update Password'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

const s = {
  page:     { maxWidth: 1020, paddingBottom: 40 },
  headerRow:{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 16 },
  pageTitle:{ fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 6 },
  pageSub:  { color: 'var(--text2)', fontSize: 14, margin: 0 },

  editProfileBtn: { display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#7c6ff7,#a78bfa)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s' },
  cancelTopBtn:   { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },

  grid:     { display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, alignItems: 'start' },
  leftCol:  { display: 'flex', flexDirection: 'column', gap: 20 },
  rightCol: { display: 'flex', flexDirection: 'column', gap: 20 },

  /* Avatar card */
  avatarCard:     { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 },
  avatarWrap:     { position: 'relative', marginBottom: 4 },
  avatarImg:      { width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--accent)' },
  avatarFallback: { width: 96, height: 96, borderRadius: '50%', background: 'linear-gradient(135deg,#7c6ff7,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 700, color: '#fff', border: '3px solid var(--accent)' },
  cameraBtn:      { position: 'absolute', bottom: 2, right: 2, width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  userName:       { fontSize: 17, fontWeight: 700, textAlign: 'center', margin: 0 },
  userRole:       { fontSize: 12, color: 'var(--accent2)', fontWeight: 600, background: 'var(--accent-glow)', padding: '4px 14px', borderRadius: 99, border: '1px solid rgba(124,111,247,0.3)', margin: 0 },
  infoList:       { width: '100%', marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 14 },
  infoRow:        { display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text2)', minWidth: 0 },
  truncate:       { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  skillsSummaryBox:{ width: '100%', marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--bg3)', borderRadius: 8, padding: '9px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text2)' },

  /* Form cards */
  formCard:      { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '24px' },
  cardHeaderRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  cardHeader:    { display: 'flex', alignItems: 'center', gap: 10 },
  cardTitle:     { fontSize: 16, fontWeight: 700, margin: 0 },
  smallEditBtn:  { display: 'flex', alignItems: 'center', gap: 5, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--accent2)', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },

  successMsg: { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green)', borderRadius: 8, padding: '12px 16px', fontSize: 13, marginBottom: 20 },
  errorMsg:   { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red)', borderRadius: 8, padding: '12px 16px', fontSize: 13, marginBottom: 20 },

  /* View Mode styles */
  viewContainer:    { display: 'flex', flexDirection: 'column', gap: 20 },
  viewGrid:         { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 },
  viewField:        { display: 'flex', flexDirection: 'column', gap: 4 },
  viewLabel:        { fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  viewValue:        { fontSize: 14, fontWeight: 500, color: 'var(--text)' },
  viewBioSection:   { display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 16 },
  bioText:          { fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, margin: 0 },
  viewSkillsSection:{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 16 },
  skillsSectionHeader:{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  skillsGrid:       { display: 'flex', flexWrap: 'wrap', gap: 8 },
  viewSkillChip:    { fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 99, background: 'var(--accent-glow)', color: 'var(--accent2)', border: '1px solid rgba(124,111,247,0.35)' },
  noSkillsPrompt:   { background: 'var(--bg3)', border: '1px dashed var(--border)', borderRadius: 8, padding: '16px', textAlign: 'center' },

  /* Edit Mode styles */
  form:       { display: 'flex', flexDirection: 'column', gap: 18 },
  inputGrid:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  fg:         { display: 'flex', flexDirection: 'column', gap: 6 },
  label:      { fontSize: 13, fontWeight: 600, color: 'var(--text2)' },
  labelSub:   { fontSize: 11, color: 'var(--text3)', margin: 0, marginTop: 2 },
  input:      { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%' },
  textarea:   { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%', resize: 'vertical', fontFamily: 'inherit' },

  /* Skills Editor */
  skillsEditorBox:   { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px', display: 'flex', flexDirection: 'column', gap: 14 },
  skillsEditorTop:   { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 },
  importResumeBtn:   { display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent-glow)', border: '1px solid rgba(124,111,247,0.4)', color: 'var(--accent2)', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  addSkillRow:       { display: 'flex', gap: 10 },
  addSkillInput:     { flex: 1, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text)', fontSize: 13, outline: 'none' },
  addSkillBtn:       { display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  activeSkillsWrap:  { display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 180, overflowY: 'auto', padding: '4px 0' },
  editableSkillChip: { display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg2)', border: '1px solid var(--accent)', color: 'var(--text)', borderRadius: 99, padding: '5px 12px 5px 14px', fontSize: 12, fontWeight: 500 },
  skillRemoveBtn:    { background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', lineHeight: 1 },

  suggestionsBox:    { display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 10 },
  suggestionsLabel:  { fontSize: 11, color: 'var(--text3)', fontWeight: 600 },
  suggestedChipsRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  sugChip:           { background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text3)', borderRadius: 99, padding: '4px 10px', fontSize: 11, cursor: 'pointer', transition: 'all 0.15s' },

  actionRow:         { display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 },
  saveBtn:           { display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#7c6ff7,#a78bfa)', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 24px', fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'opacity 0.15s' },
  cancelBtn:         { background: 'none', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 8, padding: '12px 20px', fontWeight: 500, fontSize: 14, cursor: 'pointer' },
  secondarySaveBtn:  { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '11px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer', alignSelf: 'flex-start' },
}

