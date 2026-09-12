import React, { useState, useRef, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import { uploadResume, sendChatMessage, extractDocument } from '../api'
import {
  Send, Upload, FileText, User, Bot, Sparkles,
  ChevronRight, X, Loader, RefreshCw, AlertCircle,
  BrainCircuit, CheckCircle, Paperclip, Target,
} from 'lucide-react'

// ─── helpers ──────────────────────────────────────────────────────────
const getStoredResume = () => {
  try { return JSON.parse(localStorage.getItem('lastResume') || 'null') }
  catch { return null }
}

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const INITIAL_QUICK_STARTERS = [
  'Which roles suit my resume best?',
  'Give me 5 technical interview questions',
  'Create a 4-week preparation roadmap',
  'What are my strongest skills and where are my gaps?',
  'How do I answer "Tell me about yourself"?',
]

const DOC_QUICK_STARTERS = [
  'Summarise the key points from this document',
  'Generate 5 interview questions based on this document',
  'What are the main technical concepts in this document?',
  'How does this document relate to my resume profile?',
]

// ─── Markdown-lite renderer ───────────────────────────────────────────
function renderMd(text) {
  if (!text) return ''
  let formatted = text.replace(
    /```(?:[a-zA-Z]*)\n([\s\S]*?)```/g,
    '<pre style="background:var(--bg3);padding:10px 14px;border-radius:8px;font-size:0.86em;overflow-x:auto;margin:8px 0;border:1px solid var(--border)"><code>$1</code></pre>'
  )
  return formatted
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:var(--bg3);padding:1px 5px;border-radius:4px;font-size:0.87em;color:var(--accent2)">$1</code>')
    .replace(/^###\s+(.+)$/gm, '<strong style="font-size:1.05em;display:block;margin-top:8px;margin-bottom:3px;color:var(--text)">$1</strong>')
    .replace(/^##\s+(.+)$/gm, '<strong style="font-size:1.1em;display:block;margin-top:10px;margin-bottom:4px;color:var(--text)">$1</strong>')
    .replace(/^#\s+(.+)$/gm, '<strong style="font-size:1.15em;display:block;margin-top:12px;margin-bottom:4px;color:var(--text)">$1</strong>')
    .replace(/^[•*-]\s(.+)$/gm, '<div style="display:flex;gap:6px;margin:3px 0"><span style="color:var(--accent);margin-top:1px">•</span><span>$1</span></div>')
    .replace(/^(\d+)\.\s(.+)$/gm, '<div style="display:flex;gap:6px;margin:3px 0"><span style="color:var(--accent2);font-weight:600;min-width:18px">$1.</span><span>$2</span></div>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>')
}

// ─── Typing indicator ─────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
      <div style={S.botAvatar}><Bot size={14} color="#fff" /></div>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '18px 18px 18px 4px', padding: '12px 16px', display: 'flex', gap: 5, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: 'chatbounce 1.2s ease infinite', animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  )
}

// ─── Single message bubble ────────────────────────────────────────────
function Bubble({ msg, onQuickSend }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', gap: 10, justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
        {!isUser && <div style={S.botAvatar}><Bot size={14} color="#fff" /></div>}
        <div style={{ maxWidth: '78%' }}>
          <div
            style={{
              background: isUser ? 'var(--accent)' : 'var(--bg2)',
              border: isUser ? 'none' : '1px solid var(--border)',
              borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              padding: '12px 17px', fontSize: 13.5, lineHeight: 1.65, color: isUser ? '#fff' : 'var(--text)',
            }}
            dangerouslySetInnerHTML={{ __html: renderMd(msg.content) }}
          />
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3, textAlign: isUser ? 'right' : 'left' }}>
            {msg.timestamp}
          </div>
        </div>
        {isUser && <div style={S.userAvatar}><User size={14} color="#fff" /></div>}
      </div>

      {/* Suggested follow-ups under assistant messages */}
      {!isUser && msg.suggestions?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 8, paddingLeft: 42 }}>
          {msg.suggestions.map((s, i) => (
            <button key={i} onClick={() => onQuickSend(s)} style={S.suggestChip}>
              <ChevronRight size={11} style={{ flexShrink: 0 }} />{s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Preparation Agent Page ──────────────────────────────────────
export default function Chat() {
  // ── Chat state ──────────────────────────────────────────────────────
  const [messages, setMessages]       = useState([])
  const [input, setInput]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [targetRole, setTargetRole]   = useState('')

  // ── Resume state ────────────────────────────────────────────────────
  const [resumeData, setResumeData]           = useState(getStoredResume)
  const [resumeName, setResumeName]           = useState(() => getStoredResume()?.full_name ? `${getStoredResume().full_name}'s resume` : '')
  const [resumeUploading, setResumeUploading] = useState(false)
  const [resumeError, setResumeError]         = useState('')

  // ── Document state (attached directly in unified chat) ──────────────
  const [docText, setDocText]           = useState('')
  const [docName, setDocName]           = useState('')
  const [docWordCount, setDocWordCount] = useState(0)
  const [docUploading, setDocUploading] = useState(false)
  const [docError, setDocError]         = useState('')

  const bottomRef     = useRef(null)
  const textareaRef   = useRef(null)
  const resumeFileRef = useRef(null)
  const docFileRef    = useRef(null)

  // Scroll on new messages
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  // Build initial greeting
  const buildInitialGreeting = useCallback((rData) => {
    const candidateName = rData?.full_name?.split(' ')[0] || ''
    const skillsCount = rData?.skills?.length || 0
    if (candidateName && skillsCount) {
      return `Hi ${candidateName}! 👋 I've loaded your resume (${skillsCount} skills detected). Ask me anything — which internship roles suit your profile, technical and HR interview questions, customized roadmaps, or attach any document (PDF/DOCX) anytime for in-depth Q&A!`
    }
    return "Hi there! 👋 I'm your AI Preparation Agent. Ask me anything about internship roles, interview questions (technical & HR), skills, or career roadmaps. You can also upload your resume or attach any document (PDF/DOCX) anytime for personalized guidance and Q&A!"
  }, [])

  // Seed initial greeting on mount
  useEffect(() => {
    setMessages([{
      role: 'assistant',
      content: buildInitialGreeting(resumeData),
      timestamp: now(),
    }])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resume upload handler ───────────────────────────────────────────
  const handleResumeUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setResumeError('')
    setResumeUploading(true)
    try {
      const res = await uploadResume(file)
      const parsed = res.data
      setResumeData(parsed)
      setResumeName(file.name)
      localStorage.setItem('lastResume', JSON.stringify(parsed))

      const name = parsed.full_name?.split(' ')[0] || 'there'
      const skills = parsed.skills?.slice(0, 6).join(', ') || 'various skills'
      const moreSkills = parsed.skills?.length > 6 ? ` +${parsed.skills.length - 6} more` : ''

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ **Resume parsed successfully!**\n\n**Candidate:** ${parsed.full_name || 'Detected'}\n**Detected Skills:** ${skills}${moreSkills}\n\nI can now personalize role recommendations, interview questions, and preparation roadmaps specifically for you, ${name}! What would you like to explore first?`,
        timestamp: now(),
      }])
    } catch (err) {
      setResumeError(err?.response?.data?.detail || 'Failed to parse resume. Please use a PDF or DOCX file.')
    } finally {
      setResumeUploading(false)
      e.target.value = ''
    }
  }

  const clearResume = () => {
    setResumeData(null)
    setResumeName('')
    setResumeError('')
    localStorage.removeItem('lastResume')
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: 'ℹ️ Resume cleared from active session. You can still ask general career & interview questions, or upload another resume anytime.',
      timestamp: now(),
    }])
  }

  // ── Document upload handler (in unified chat) ───────────────────────
  const handleDocUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setDocError('')
    setDocUploading(true)
    try {
      const res = await extractDocument(file)
      setDocText(res.data.text)
      setDocName(res.data.filename)
      setDocWordCount(res.data.word_count || 0)

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `📄 **"${res.data.filename}"** attached successfully (${res.data.word_count || 0} words extracted).\n\nIts contents are now part of our conversation! You can ask questions about this document (summaries, key topics, specific details) or continue asking about your resume and interview preparation.`,
        timestamp: now(),
        suggestions: [
          'Summarise the key points from this document',
          'Generate 5 interview questions based on this document',
          'What are the main technical concepts in this document?',
        ],
      }])
    } catch (err) {
      setDocError(err?.response?.data?.detail || 'Failed to extract document. Please use a valid PDF or DOCX.')
    } finally {
      setDocUploading(false)
      e.target.value = ''
    }
  }

  const clearDoc = () => {
    const prevName = docName
    setDocText('')
    setDocName('')
    setDocWordCount(0)
    setDocError('')
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: `ℹ️ Document **"${prevName}"** detached. Continuing general conversation.`,
      timestamp: now(),
    }])
  }

  // ── Build conversation history ──────────────────────────────────────
  const buildHistory = useCallback(
    () => messages.map(m => ({ role: m.role, content: m.content })),
    [messages],
  )

  // ── Send message ────────────────────────────────────────────────────
  const sendMessage = async (text) => {
    const userText = (text || input).trim()
    if (!userText || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userText, timestamp: now() }])
    setLoading(true)

    try {
      const res = await sendChatMessage({
        message:       userText,
        history:       buildHistory(),
        resume_data:   resumeData || undefined,
        document_text: docText || undefined,
        document_name: docName || undefined,
        target_role:   targetRole || undefined,
      })

      const reply = res.data.reply
      const suggestions = res.data.suggested_questions || []
      setMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: now(), suggestions }])
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Something went wrong. Please try again.'
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${msg}`, timestamp: now() }])
    } finally {
      setLoading(false)
      textareaRef.current?.focus()
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([{
      role: 'assistant',
      content: buildInitialGreeting(resumeData),
      timestamp: now(),
    }])
  }

  const quickStarters = docText ? DOC_QUICK_STARTERS : INITIAL_QUICK_STARTERS

  return (
    <Layout>
      <style>{`
        @keyframes chatbounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        .prep-input:focus { outline: none; }
        .prep-target:focus { outline: none; border-color: var(--accent) !important; }
        .quick-btn:hover { background: var(--bg3) !important; border-color: var(--accent) !important; }
        .action-chip:hover { border-color: var(--accent) !important; }
      `}</style>

      <div style={S.page}>

        {/* ── UNIFIED HEADER ────────────────────────────────────────── */}
        <div style={S.pageHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={S.headerIcon}>
              <BrainCircuit size={22} color="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                  Preparation Agent
                </h1>
                <span style={S.aiBadge}>
                  <Sparkles size={11} color="var(--accent2)" /> AI Powered
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text3)', margin: '2px 0 0' }}>
                Unified interview preparation, resume matching, and on-demand document Q&A
              </p>
            </div>
          </div>

          {/* Right side controls: Target Role, Upload buttons, Clear chat */}
          <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>

            {/* Optional Target Role input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={S.targetWrap}>
                <Target size={13} color="var(--text3)" style={{ flexShrink: 0 }} />
                <input
                  className="prep-target"
                  value={targetRole}
                  onChange={e => setTargetRole(e.target.value)}
                  placeholder="Target Role (optional)"
                  style={S.targetInput}
                  title="Optionally specify your target role to tailor interview questions and roadmaps"
                />
                {targetRole && (
                  <button onClick={() => setTargetRole('')} style={S.miniX} title="Clear role">
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>

            {/* Resume Upload / Active Chip */}
            {resumeData ? (
              <div style={S.uploadedChip}>
                <CheckCircle size={13} color="var(--green)" />
                <span style={{ fontSize: 12, color: 'var(--green)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {resumeName || 'Resume active'}
                </span>
                <button
                  onClick={() => resumeFileRef.current?.click()}
                  style={S.rechipBtn}
                  title="Replace resume"
                >
                  <RefreshCw size={11} />
                </button>
                <button onClick={clearResume} style={S.rechipBtn} title="Remove resume">
                  <X size={11} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => resumeFileRef.current?.click()}
                disabled={resumeUploading}
                style={S.uploadBtn('var(--accent)')}
                title="Upload resume for personalized questions and matches"
              >
                {resumeUploading
                  ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Parsing…</>
                  : <><Upload size={13} /> Resume</>}
              </button>
            )}
            <input ref={resumeFileRef} type="file" accept=".pdf,.docx,.doc" style={{ display: 'none' }} onChange={handleResumeUpload} />

            {/* Document Upload / Active Chip in Header */}
            {docText ? (
              <div style={S.uploadedChip}>
                <FileText size={13} color="var(--blue)" />
                <span style={{ fontSize: 12, color: 'var(--blue)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {docName}
                </span>
                <button onClick={clearDoc} style={S.rechipBtn} title="Detach document">
                  <X size={11} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => docFileRef.current?.click()}
                disabled={docUploading}
                style={S.uploadBtn('var(--blue)')}
                title="Attach a PDF or DOCX document to ask questions about it"
              >
                {docUploading
                  ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Reading…</>
                  : <><Paperclip size={13} /> Document</>}
              </button>
            )}
            <input ref={docFileRef} type="file" accept=".pdf,.docx" style={{ display: 'none' }} onChange={handleDocUpload} />

            {/* Clear chat button */}
            <button onClick={clearChat} style={S.clearBtn} title="Clear conversation history">
              <RefreshCw size={12} /> Clear
            </button>
          </div>
        </div>

        {/* Error notifications if any */}
        {(resumeError || docError) && (
          <div style={S.errorBar}>
            <AlertCircle size={13} color="var(--red)" />
            <span>{resumeError || docError}</span>
            <button onClick={() => { setResumeError(''); setDocError('') }} style={S.miniX}><X size={12} /></button>
          </div>
        )}

        {/* ── MAIN CHAT AREA ────────────────────────────────────────── */}
        <div style={S.chatArea}>

          {/* Messages scroll container */}
          <div style={S.messages}>
            {messages.map((msg, i) => (
              <Bubble
                key={i}
                msg={msg}
                onQuickSend={sendMessage}
              />
            ))}
            {loading && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          {/* Quick starters — visible when chat is fresh */}
          {messages.length <= 1 && !loading && (
            <div style={S.quickRow}>
              <div style={{ width: '100%', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 2 }}>
                Suggested Prompts:
              </div>
              {quickStarters.map((q, i) => (
                <button key={i} className="quick-btn" onClick={() => sendMessage(q)} style={S.quickBtn}>
                  <Sparkles size={11} color="var(--accent2)" style={{ flexShrink: 0 }} />
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Active document attachment banner right above input bar */}
          {docText && (
            <div style={S.attachedDocBanner}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                <FileText size={14} color="var(--blue)" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {docName}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                  ({docWordCount} words active in conversation)
                </span>
              </div>
              <button onClick={clearDoc} style={S.detachBtn} title="Detach document from chat">
                <X size={12} /> Detach
              </button>
            </div>
          )}

          {/* ── UNIFIED INPUT BAR ───────────────────────────────────── */}
          <div style={S.inputBar}>
            {/* Quick attach document button */}
            <button
              onClick={() => docFileRef.current?.click()}
              disabled={docUploading || loading}
              style={{
                ...S.attachBtn,
                color: docText ? 'var(--blue)' : 'var(--text3)',
                borderColor: docText ? 'var(--blue)' : 'var(--border)',
              }}
              title={docText ? `Attached: ${docName}. Click to replace.` : "Attach PDF or DOCX document to this chat"}
            >
              {docUploading
                ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                : <Paperclip size={16} />}
            </button>

            {/* Input textarea */}
            <textarea
              ref={textareaRef}
              className="prep-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={
                docText
                  ? `Ask anything about "${docName}", or about your resume & interview preparation…`
                  : resumeData
                    ? "Ask anything — role recommendations, technical & HR questions, roadmaps…"
                    : "Ask anything — interview questions, roadmaps, career guidance, or attach a document…"
              }
              disabled={loading}
              rows={2}
              style={S.textarea}
            />

            {/* Send button */}
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              style={{ ...S.sendBtn, opacity: loading || !input.trim() ? 0.45 : 1 }}
              title="Send (Enter)"
            >
              {loading
                ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
                : <Send size={18} />}
            </button>
          </div>
        </div>

      </div>
    </Layout>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────
const S = {
  page: {
    display: 'flex', flexDirection: 'column',
    height: 'calc(100vh - 72px)',
    marginTop: -36,
    marginLeft: -40,
    marginRight: -40,
    overflow: 'hidden',
  },

  pageHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: 12,
    padding: '16px 32px',
    background: 'var(--bg2)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },

  headerIcon: {
    width: 42, height: 42, borderRadius: 12, flexShrink: 0,
    background: 'linear-gradient(135deg, #7c6ff7, #a78bfa)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 14px rgba(124, 111, 247, 0.35)',
  },

  aiBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: 11, fontWeight: 600, padding: '2px 8px',
    borderRadius: 99, background: 'var(--accent-glow)',
    color: 'var(--accent2)', border: '1px solid rgba(124,111,247,0.3)',
  },

  targetWrap: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'var(--bg3)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '5px 9px',
  },

  targetInput: {
    background: 'transparent', border: 'none',
    fontSize: 12, color: 'var(--text)', width: 140,
  },

  uploadBtn: (color) => ({
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'transparent',
    border: `1px solid ${color}`,
    borderRadius: 8, padding: '6px 12px',
    fontSize: 12, fontWeight: 600,
    color: color, cursor: 'pointer',
    transition: 'all 0.15s',
  }),

  uploadedChip: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'var(--bg3)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '5px 9px',
  },

  rechipBtn: {
    background: 'none', border: 'none', color: 'var(--text3)',
    cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center',
  },

  miniX: {
    background: 'none', border: 'none', color: 'var(--text3)',
    cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center',
  },

  clearBtn: {
    display: 'flex', alignItems: 'center', gap: 5,
    background: 'none', border: '1px solid var(--border)',
    borderRadius: 8, padding: '6px 11px',
    fontSize: 12, color: 'var(--text3)', cursor: 'pointer',
  },

  errorBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 32px', background: 'rgba(239, 68, 68, 0.12)',
    borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
    color: 'var(--red)', fontSize: 12,
  },

  chatArea: {
    flex: 1, display: 'flex', flexDirection: 'column',
    overflow: 'hidden', background: 'var(--bg)',
  },

  messages: {
    flex: 1, overflowY: 'auto',
    padding: '24px 32px 10px',
  },

  botAvatar: {
    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg,#7c6ff7,#a78bfa)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  userAvatar: {
    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
    background: 'var(--bg3)', border: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  suggestChip: {
    display: 'flex', alignItems: 'center', gap: 5, fontSize: 12,
    background: 'var(--accent-glow)', border: '1px solid rgba(124,111,247,0.3)',
    borderRadius: 99, padding: '5px 13px', color: 'var(--accent2)',
    cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
  },

  quickRow: {
    display: 'flex', flexWrap: 'wrap', gap: 8,
    padding: '0 32px 14px',
  },

  quickBtn: {
    display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5,
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 9, padding: '7px 13px', color: 'var(--text2)',
    cursor: 'pointer', transition: 'all 0.15s',
  },

  attachedDocBanner: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '7px 32px', background: 'rgba(59, 130, 246, 0.08)',
    borderTop: '1px solid rgba(59, 130, 246, 0.2)',
    borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
  },

  detachBtn: {
    display: 'flex', alignItems: 'center', gap: 4,
    background: 'none', border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: 6, padding: '3px 8px', fontSize: 11,
    color: 'var(--blue)', cursor: 'pointer',
  },

  inputBar: {
    display: 'flex', gap: 10, padding: '12px 32px 18px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg2)', alignItems: 'flex-end', flexShrink: 0,
  },

  attachBtn: {
    width: 44, height: 44, borderRadius: 10,
    background: 'var(--bg3)', border: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
  },

  textarea: {
    flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '11px 15px',
    fontSize: 13.5, color: 'var(--text)',
    resize: 'none', lineHeight: 1.55,
  },

  sendBtn: {
    background: 'var(--accent)', border: 'none', borderRadius: 10,
    width: 44, height: 44, color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, cursor: 'pointer', transition: 'opacity 0.15s',
  },
}
