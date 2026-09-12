import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  MessageSquare, X, Send, Bot, User, Loader,
  Sparkles, Minus, ChevronRight,
} from 'lucide-react'
import { sendChatMessage } from '../api'

// ─── helpers ──────────────────────────────────────────────────────────
const getResume = () => {
  try { return JSON.parse(localStorage.getItem('lastResume') || 'null') }
  catch { return null }
}

const now = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const QUICK_STARTERS = [
  'Which roles suit my resume?',
  'Give me interview questions',
  'Create a 4-week prep roadmap',
  'What skills am I missing?',
]

// ─── Markdown-lite renderer ───────────────────────────────────────────
function renderMd(text) {
  if (!text) return ''
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:var(--bg3);padding:1px 4px;border-radius:3px;font-size:0.86em">$1</code>')
    .replace(/^#{1,3}\s+(.+)$/gm, '<strong style="font-size:1.02em">$1</strong>')
    .replace(/^•\s(.+)$/gm, '<div style="display:flex;gap:5px;margin:1px 0"><span style="color:var(--accent)">•</span><span>$1</span></div>')
    .replace(/^(\d+)\.\s(.+)$/gm, '<div style="display:flex;gap:5px;margin:1px 0"><span style="color:var(--accent2);font-weight:600;min-width:16px">$1.</span><span>$2</span></div>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>')
}

// ─── Typing dots ──────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
      <div style={W.botAvatar}><Bot size={12} color="#fff" /></div>
      <div style={W.botBubble}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '6px 2px' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)',
              animation: 'wbounce 1.2s ease infinite',
              animationDelay: `${i * 0.2}s`,
            }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main widget ──────────────────────────────────────────────────────
export default function ChatWidget() {
  const [open, setOpen]       = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [unread, setUnread]   = useState(0)

  const bottomRef   = useRef(null)
  const inputRef    = useRef(null)
  const resume      = getResume()

  // seed greeting once
  useEffect(() => {
    const first = resume
      ? `Hi ${resume.full_name?.split(' ')[0] || 'there'}! 👋 I'm your AI Coach. Ask me anything about your career, interview prep, or resume.`
      : "Hi! 👋 I'm your AI Coach. Upload your resume for personalised advice, or ask me a general question!"
    setMessages([{ role: 'assistant', content: first, timestamp: now() }])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // scroll to bottom
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, open])

  // focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80)
  }, [open])

  const handleOpen = () => {
    setOpen(true)
    setUnread(0)
  }

  const buildHistory = useCallback(
    () => messages.map(m => ({ role: m.role, content: m.content })),
    [messages],
  )

  const send = async (text) => {
    const userText = (text || input).trim()
    if (!userText || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userText, timestamp: now() }])
    setLoading(true)

    try {
      const res = await sendChatMessage({
        message: userText,
        history: buildHistory(),
        context_type: 'general',
        resume_data: resume || undefined,
      })
      const reply = res.data.reply
      setMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: now() }])
      if (!open) setUnread(u => u + 1)
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Something went wrong. Please try again.'
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${msg}`, timestamp: now() }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const clearChat = () => {
    const greeting = resume
      ? `Hi ${resume.full_name?.split(' ')[0] || 'there'}! 👋 How can I help you today?`
      : "Chat cleared! Ask me anything about your career or interview prep."
    setMessages([{ role: 'assistant', content: greeting, timestamp: now() }])
  }

  return (
    <>
      {/* ── keyframes ─────────────────────────────────────────────── */}
      <style>{`
        @keyframes wbounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }
        @keyframes wslide  { from{opacity:0;transform:translateY(16px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes wpulse  { 0%,100%{box-shadow:0 0 0 0 rgba(124,111,247,0.55)} 50%{box-shadow:0 0 0 8px rgba(124,111,247,0)} }
        .widget-input:focus { outline: none; }
        .wquick:hover { background: var(--accent-glow) !important; color: var(--accent2) !important; }
      `}</style>

      {/* ── Floating bubble ───────────────────────────────────────── */}
      {!open && (
        <button onClick={handleOpen} style={W.bubble} title="Open AI Coach">
          <MessageSquare size={22} color="#fff" />
          {unread > 0 && (
            <span style={W.badge}>{unread}</span>
          )}
        </button>
      )}

      {/* ── Chat popup ────────────────────────────────────────────── */}
      {open && (
        <div style={W.popup}>

          {/* header */}
          <div style={W.header}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={W.headerIcon}>
                <Sparkles size={14} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>AI Coach</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
                  Online
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={clearChat} style={W.hBtn} title="Clear chat">
                <Minus size={14} />
              </button>
              <button onClick={() => setOpen(false)} style={W.hBtn} title="Close">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* messages */}
          <div style={W.messages}>
            {messages.map((msg, i) => {
              const isUser = msg.role === 'user'
              return (
                <div key={i} style={{ display: 'flex', gap: 7, justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                  {!isUser && <div style={W.botAvatar}><Bot size={12} color="#fff" /></div>}
                  <div style={{ maxWidth: '80%' }}>
                    <div
                      style={isUser ? W.userBubble : W.botBubble}
                      dangerouslySetInnerHTML={{ __html: renderMd(msg.content) }}
                    />
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, textAlign: isUser ? 'right' : 'left' }}>
                      {msg.timestamp}
                    </div>
                  </div>
                  {isUser && <div style={W.userAvatar}><User size={12} color="#fff" /></div>}
                </div>
              )
            })}
            {loading && <TypingDots />}
            <div ref={bottomRef} />
          </div>

          {/* quick starters — only on first message */}
          {messages.length === 1 && !loading && (
            <div style={W.quickWrap}>
              {QUICK_STARTERS.map((q, i) => (
                <button key={i} className="wquick" onClick={() => send(q)} style={W.quickBtn}>
                  <ChevronRight size={10} style={{ flexShrink: 0 }} />{q}
                </button>
              ))}
            </div>
          )}

          {/* input */}
          <div style={W.inputRow}>
            <textarea
              ref={inputRef}
              className="widget-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask me anything…"
              disabled={loading}
              rows={1}
              style={W.textarea}
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              style={{ ...W.sendBtn, opacity: loading || !input.trim() ? 0.4 : 1 }}
            >
              {loading
                ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} />
                : <Send size={15} />}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Widget styles ────────────────────────────────────────────────────
const W = {
  bubble: {
    position: 'fixed', bottom: 28, right: 28, zIndex: 1000,
    width: 54, height: 54, borderRadius: '50%',
    background: 'linear-gradient(135deg, #7c6ff7, #a78bfa)',
    border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(124,111,247,0.5)',
    cursor: 'pointer', transition: 'transform 0.2s',
    animation: 'wpulse 2.5s ease-in-out infinite',
  },
  badge: {
    position: 'absolute', top: 2, right: 2,
    width: 18, height: 18, borderRadius: '50%',
    background: 'var(--red)', color: '#fff',
    fontSize: 10, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '2px solid var(--bg)',
  },
  popup: {
    position: 'fixed', bottom: 28, right: 28, zIndex: 1000,
    width: 360, height: 520,
    background: 'var(--bg2)', borderRadius: 16,
    border: '1px solid var(--border)',
    boxShadow: '0 8px 40px rgba(0,0,0,0.55)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    animation: 'wslide 0.2s ease',
  },
  header: {
    background: 'linear-gradient(135deg, #7c6ff7, #a78bfa)',
    padding: '12px 14px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexShrink: 0,
  },
  headerIcon: {
    width: 32, height: 32, borderRadius: '50%',
    background: 'rgba(255,255,255,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  hBtn: {
    background: 'rgba(255,255,255,0.15)', border: 'none',
    borderRadius: 6, padding: '4px 6px', color: '#fff',
    display: 'flex', alignItems: 'center', cursor: 'pointer',
  },
  messages: {
    flex: 1, overflowY: 'auto', padding: '14px 14px 6px',
  },
  botAvatar: {
    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg,#7c6ff7,#a78bfa)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  userAvatar: {
    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
    background: 'var(--bg3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  botBubble: {
    background: 'var(--bg3)', border: '1px solid var(--border)',
    borderRadius: '14px 14px 14px 4px',
    padding: '8px 11px', fontSize: 12.5, lineHeight: 1.6, color: 'var(--text)',
  },
  userBubble: {
    background: 'var(--accent)',
    borderRadius: '14px 14px 4px 14px',
    padding: '8px 11px', fontSize: 12.5, lineHeight: 1.6, color: '#fff',
  },
  quickWrap: {
    display: 'flex', flexDirection: 'column', gap: 5,
    padding: '0 14px 8px', flexShrink: 0,
  },
  quickBtn: {
    display: 'flex', alignItems: 'center', gap: 5,
    background: 'var(--bg3)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '5px 10px', fontSize: 12,
    color: 'var(--text2)', cursor: 'pointer', textAlign: 'left',
    transition: 'all 0.15s',
  },
  inputRow: {
    display: 'flex', gap: 8, padding: '10px 12px 12px',
    borderTop: '1px solid var(--border)', background: 'var(--bg2)',
    alignItems: 'flex-end', flexShrink: 0,
  },
  textarea: {
    flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '8px 11px', fontSize: 13,
    color: 'var(--text)', resize: 'none', lineHeight: 1.5,
    maxHeight: 80, overflowY: 'auto',
  },
  sendBtn: {
    background: 'var(--accent)', border: 'none', borderRadius: 10,
    padding: '8px 11px', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, cursor: 'pointer', transition: 'opacity 0.15s',
  },
}
