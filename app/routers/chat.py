"""
routers/chat.py  —  AI Preparation Agent

Uses Groq (llama-3.3-70b-versatile) as primary LLM.
Gemini is kept as fallback.
Smart local responses used when both are unavailable.

Endpoints:
  POST /chat/sessions
  GET  /chat/sessions
  GET  /chat/sessions/{id}
  PATCH /chat/sessions/{id}
  DELETE /chat/sessions/{id}
  POST /chat/message
  POST /chat/extract-document
"""

import os
import re
from datetime import datetime, timezone
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

# Always reload .env so keys added after server start are picked up
load_dotenv(override=True)

from app.auth import get_current_user
from app.database import get_db
from app.models import ChatHistory, ChatSession, User
from app.parser import extract_text
from app.rag import _get_gemini, get_gemini_api_key
from app.internships import search_internships, build_candidate_text
from app.schemas import (
    ChatMessage, ChatRequest, ChatResponse,
    ChatSessionCreate, ChatSessionDetail,
    ChatSessionResponse, ChatSessionUpdate,
)

router = APIRouter(prefix="/chat", tags=["Chat"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ============================================================
# HELPERS — get API keys fresh every request
# ============================================================

def _groq_key() -> str:
    load_dotenv(override=True)
    return os.getenv("GROQ_API_KEY", "").strip()

def _gemini_key() -> str:
    load_dotenv(override=True)
    return os.getenv("GEMINI_API_KEY", "").strip()


# ============================================================
# CONTEXT BUILDERS
# ============================================================

def _resume_block(resume_data: Optional[dict]) -> str:
    if not resume_data:
        return ""
    name    = resume_data.get("full_name") or "the candidate"
    summary = resume_data.get("summary") or ""
    skills  = ", ".join(resume_data.get("skills", [])[:30]) or "Not specified"
    soft    = ", ".join(resume_data.get("soft_skills", [])[:10])
    edu     = " | ".join(resume_data.get("education", [])[:4]) or "Not specified"
    exp     = " | ".join(resume_data.get("work_experience", [])[:4]) or "Not specified"
    interns = " | ".join(resume_data.get("internships", [])[:4]) or "Not specified"
    projs   = " | ".join(p.splitlines()[0] for p in resume_data.get("projects", [])[:6]) or "Not specified"
    certs   = ", ".join(resume_data.get("certifications", [])[:6]) or "Not specified"
    achieve = " | ".join(resume_data.get("achievements", [])[:4])

    lines = ["=== CANDIDATE RESUME ===", f"Name: {name}"]
    if summary:  lines.append(f"Summary: {summary}")
    lines.append(f"Technical Skills: {skills}")
    if soft:     lines.append(f"Soft Skills: {soft}")
    lines += [
        f"Education: {edu}",
        f"Work Experience: {exp}",
        f"Internships: {interns}",
        f"Projects: {projs}",
        f"Certifications: {certs}",
    ]
    if achieve:  lines.append(f"Achievements: {achieve}")
    lines.append("========================")
    return "\n".join(lines)


def _document_block(doc_text: Optional[str], doc_name: Optional[str]) -> str:
    """
    Puts the document content into context for the LLM.
    Limits to 12000 chars to stay within token limits.
    """
    if not doc_text or not doc_text.strip():
        return ""
    name    = doc_name or "Uploaded Document"
    snippet = doc_text[:12000].strip()
    tail    = "\n[...truncated for length...]" if len(doc_text) > 12000 else ""
    return (
        f"=== ATTACHED DOCUMENT: {name} ===\n"
        f"{snippet}{tail}\n"
        f"==================================="
    )


def _internship_block(resume_data: Optional[dict]) -> str:
    if not resume_data:
        return ""
    try:
        text = build_candidate_text(resume_data)
        if not text:
            return ""
        matches = search_internships(text, top_k=5)
        if not matches:
            return ""
        lines = ["=== TOP MATCHING INTERNSHIPS ==="]
        for m in matches:
            req = ", ".join(m.get("required_skills", [])[:5])
            lines.append(
                f"- {m.get('title','')} @ {m.get('company','')} "
                f"[{m.get('domain','')}] | Skills: {req} | Match: {m.get('match_percentage',0):.0f}%"
            )
        lines.append("================================")
        return "\n".join(lines)
    except Exception:
        return ""


def _build_system_prompt(
    resume_data: Optional[dict] = None,
    doc_text:    Optional[str]  = None,
    doc_name:    Optional[str]  = None,
    target_role: Optional[str]  = None,
) -> str:
    has_doc    = bool(doc_text and doc_text.strip())
    has_resume = bool(resume_data and resume_data.get("skills"))

    persona = (
        "You are an expert AI Interview Preparation Agent and Career Coach for software engineering students.\n\n"
        "CAPABILITIES:\n"
        "- Answer ANY question about the candidate's resume: skills, projects, education, experience, certifications.\n"
        "- Recommend the most suitable internship/job roles based on the candidate's profile.\n"
        "- Generate tailored technical interview questions (DSA, language-specific, system design) with detailed answers.\n"
        "- Generate HR/behavioral questions with STAR-method coaching.\n"
        "- Build personalized interview preparation roadmaps and weekly study plans.\n"
        "- Analyze skill gaps and recommend what to learn next.\n"
    )

    if has_doc:
        persona += (
            "- The user has uploaded a document. When they ask about it: summarize it, extract key points, "
            "generate Q&A from it, explain concepts in it, or relate it to their resume profile. "
            "Answer questions about the document using ONLY the document content — be specific, not generic.\n"
        )

    persona += (
        "\nRULES:\n"
        "1. Every response must be freshly generated based on the actual question and context.\n"
        "2. Never give generic advice when you have specific resume/document data to reason from.\n"
        "3. Use Markdown formatting: ### headings, **bold**, bullet points, numbered lists, code blocks.\n"
        "4. Be encouraging, specific, and actionable.\n"
        "5. Do NOT add any disclaimers, footers, or notes about API keys or configuration.\n"
        "6. Do NOT dump raw document or resume content — always answer the actual question asked.\n"
    )

    sections = [persona]

    rb = _resume_block(resume_data)
    if rb:
        sections.append(rb)

    db_ = _document_block(doc_text, doc_name)
    if db_:
        sections.append(db_)

    ib = _internship_block(resume_data)
    if ib:
        sections.append(ib)

    if target_role:
        sections.append(f"CANDIDATE'S TARGET ROLE: {target_role}")

    return "\n\n".join(sections)


# ============================================================
# LLM CALLERS
# ============================================================

def _call_groq(system_prompt: str, history: List[ChatMessage], user_message: str) -> Optional[str]:
    """Call Groq with SSL verification disabled (required on networks with corporate CA)."""
    key = _groq_key()
    if not key:
        return None
    try:
        import httpx
        from groq import Groq

        # Disable SSL verification — needed on corporate/college networks
        http_client = httpx.Client(verify=False)
        client      = Groq(api_key=key, http_client=http_client)

        messages = [{"role": "system", "content": system_prompt}]
        for m in history[-12:]:
            messages.append({"role": m.role, "content": m.content})
        messages.append({"role": "user", "content": user_message})

        # Try models in order until one works
        for model in ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"]:
            try:
                completion = client.chat.completions.create(
                    model       = model,
                    messages    = messages,
                    temperature = 0.7,
                    max_tokens  = 2048,
                )
                text = (completion.choices[0].message.content or "").strip()
                if text:
                    return text
            except Exception:
                continue
        return None
    except Exception:
        return None


def _call_gemini(system_prompt: str, history: List[ChatMessage], user_message: str) -> Optional[str]:
    """Call Gemini. Returns reply string or None on any failure."""
    key = _gemini_key()
    if not key:
        return None
    try:
        model = _get_gemini(system_instruction=system_prompt)
        if not model:
            return None

        full_history = [
            {"role": "user",  "parts": [system_prompt]},
            {"role": "model", "parts": ["Understood. Ready to help!"]},
        ]
        for m in history[-12:]:
            full_history.append({"role": "user" if m.role == "user" else "model", "parts": [m.content]})

        while len(full_history) > 2 and full_history[2]["role"] != "user":
            full_history.pop(2)

        chat     = model.start_chat(history=full_history)
        response = chat.send_message(user_message)
        text     = (response.text or "").strip()
        return text if text else None
    except Exception:
        return None


def _call_llm(system_prompt: str, history: List[ChatMessage], user_message: str) -> Optional[str]:
    """Try Groq → Gemini → None (triggers smart fallback)."""
    result = _call_groq(system_prompt, history, user_message)
    if result:
        return result
    result = _call_gemini(system_prompt, history, user_message)
    if result:
        return result
    return None


# ============================================================
# SMART FALLBACK  (no API key needed — uses resume/doc data)
# ============================================================

def _fallback(
    message:     str,
    resume_data: Optional[dict],
    doc_text:    Optional[str],
    doc_name:    Optional[str],
    target_role: Optional[str],
) -> str:
    msg       = message.lower().strip()
    name      = (resume_data or {}).get("full_name") or ""
    first     = name.split()[0] if name else ""
    skills    = (resume_data or {}).get("skills", [])
    sk        = " ".join(s.lower() for s in skills)
    projects  = (resume_data or {}).get("projects", [])
    education = (resume_data or {}).get("education", [])
    certs     = (resume_data or {}).get("certifications", [])
    has_res   = bool(resume_data and skills)
    has_doc   = bool(doc_text and doc_text.strip())

    # ── Document Q&A ──────────────────────────────────────────────────
    if has_doc:
        doc_lines = [l.strip() for l in doc_text.splitlines() if l.strip()]
        doc_paras = [p.strip() for p in re.split(r'\n{2,}', doc_text) if len(p.strip()) > 40]

        if any(k in msg for k in ["summar", "overview", "key point", "main point", "about", "what is", "what does"]):
            top = "\n\n".join(f"• {p}" for p in doc_paras[:5])
            return f"### 📄 Summary — *{doc_name or 'Document'}*\n\n{top}\n\n*~{len(doc_text.split())} words total.*"

        if any(k in msg for k in ["question", "quiz", "generate", "q&a", "test"]):
            pts  = [l for l in doc_lines if len(l) > 40][:5]
            qs   = "\n\n".join(f"**Q{i+1}.** {p[:100]}?\n**A:** Based on the document: {p[:200]}" for i, p in enumerate(pts))
            return f"### ❓ Questions from *{doc_name or 'the document'}*\n\n{qs}"

        # Keyword relevance search
        words = [w for w in re.findall(r'[a-z]{4,}', msg)
                 if w not in {"what","which","about","that","this","does","have","will","from","when","with","your","tell","give","show"}]
        scored = sorted(
            [(sum(1 for w in words if w in p.lower()), p) for p in doc_paras if any(w in p.lower() for w in words)],
            reverse=True
        )
        if scored:
            excerpts = "\n\n".join(f"• {p}" for _, p in scored[:3])
            return f"### 📄 From *{doc_name or 'the document'}*\n\n{excerpts}"

        return f"I have **{doc_name or 'your document'}** loaded. Please ask a specific question — e.g. summarize it, generate Q&A, or ask about a specific topic."

    # ── Role recommendations ───────────────────────────────────────────
    if any(k in msg for k in ["which role","what role","roles suit","best role","suitable","internship match","apply for","recommend"]):
        if not has_res:
            return "Please upload your resume using the **Resume** button so I can recommend suitable roles based on your skills."
        matched = []
        if any(k in sk for k in ["python","fastapi","django","flask"]):      matched.append("Python Backend Developer Intern")
        if any(k in sk for k in ["react","javascript","typescript","html"]):  matched.append("Frontend / React Developer Intern")
        if any(k in sk for k in ["machine learning","ml","tensorflow","data"]): matched.append("ML / Data Science Intern")
        if any(k in sk for k in ["sql","postgres","mysql","database"]):       matched.append("Database / Backend Intern")
        if any(k in sk for k in ["docker","aws","azure","gcp","devops"]):     matched.append("Cloud / DevOps Intern")
        if any(k in sk for k in ["java","spring"]):                           matched.append("Java Backend Developer Intern")
        if not matched: matched = ["Software Engineer Intern"]
        lines = "\n".join(f"**{i+1}. {r}**" for i, r in enumerate(matched[:5]))
        return (
            f"### 🎯 Recommended Roles for {name or 'You'}\n\n"
            f"Based on your skills ({', '.join(skills[:5])}):\n\n{lines}\n\n"
            "Would you like interview questions or a preparation roadmap for any of these?"
        )

    # ── Skills analysis ────────────────────────────────────────────────
    if any(k in msg for k in ["my skill","what skill","strongest","skill i have","skill gap","what do i know"]):
        if not has_res:
            return "Upload your resume so I can analyze your specific skills."
        bullets = "\n".join(f"• **{s}**" for s in skills[:12])
        gaps = []
        if not any(k in sk for k in ["git","github"]):      gaps.append("Git & GitHub")
        if not any(k in sk for k in ["sql","database"]):    gaps.append("SQL / Databases")
        if not any(k in sk for k in ["docker","aws","cloud"]): gaps.append("Cloud / Docker")
        gap_txt = "\n".join(f"• {g}" for g in gaps) if gaps else "• Profile looks strong!"
        return (
            f"### 💡 Skills for {name}\n\n"
            f"**Detected ({len(skills)} total):**\n{bullets}\n\n"
            f"**Gaps to consider:**\n{gap_txt}"
        )

    # ── Interview questions ────────────────────────────────────────────
    if any(k in msg for k in ["interview question","technical question","hr question","behavioral","give me question","generate question"]):
        role = target_role or ("Python Developer" if "python" in sk else "Software Engineer")
        tech_qs = []
        if "python" in sk:      tech_qs += ["What is the GIL and how does it affect concurrency?", "Explain decorators with an example."]
        if "react" in sk:        tech_qs += ["How does React's virtual DOM work?", "Difference between controlled and uncontrolled components?"]
        if "sql" in sk:          tech_qs += ["Difference between INNER JOIN and LEFT JOIN?", "When would you use indexing?"]
        if "machine learning" in sk: tech_qs += ["Explain bias-variance tradeoff.", "What is overfitting and how do you prevent it?"]
        if not tech_qs:
            tech_qs = ["Explain time/space complexity with examples.", "What are SOLID design principles?",
                       "How does a HashMap work internally?", "Explain OOP concepts with examples."]
        tq = "\n".join(f"{i+1}. {q}" for i, q in enumerate(tech_qs[:4]))
        return (
            f"### 💼 Interview Questions — {role}\n\n"
            f"**Technical:**\n{tq}\n\n"
            "**Behavioral (STAR Method):**\n"
            "1. Describe a challenging bug you fixed. What was your process?\n"
            "2. Tell me about a project you're most proud of.\n"
            "3. How do you handle tight deadlines?\n\n"
            "Want detailed answers for any of these?"
        )

    # ── Roadmap ────────────────────────────────────────────────────────
    if any(k in msg for k in ["roadmap","study plan","prep plan","how to prepare","4 week","learning path","schedule"]):
        role = target_role or "Software Internship"
        return (
            f"### 📅 4-Week Roadmap — {role}\n\n"
            "**Week 1 — Core Foundations**\n"
            "• Review your primary language: syntax, OOP, memory model.\n"
            "• Revise data structures: arrays, linked lists, trees, hash maps.\n\n"
            "**Week 2 — Problem Solving**\n"
            "• Solve 2–3 LeetCode Easy problems daily (arrays, strings, recursion).\n"
            "• Practice explaining your approach out loud.\n\n"
            "**Week 3 — Projects & Domain**\n"
            "• Prepare to explain each project using STAR: problem → approach → result.\n"
            "• Study role-specific tools and frameworks.\n\n"
            "**Week 4 — Mock Interviews**\n"
            "• Do timed mock interviews and record yourself.\n"
            "• Nail 'Tell me about yourself' in under 90 seconds.\n"
            "• Prepare 3–5 questions to ask the interviewer.\n\n"
            "Want practice questions for any week?"
        )

    # ── Tell me about yourself ────────────────────────────────────────
    if any(k in msg for k in ["tell me about yourself","introduce myself","self introduction","my pitch"]):
        if has_res:
            edu  = education[0] if education else "Computer Science"
            top4 = ", ".join(skills[:4]) or "software development"
            proj = projects[0].splitlines()[0] if projects else "personal projects"
            return (
                f"### 🎙️ Your Personalised Pitch\n\n"
                f"---\n\"Hi, I'm **{name}**, studying **{edu}**. "
                f"I specialize in **{top4}**, which I've applied in projects like *{proj}*. "
                "I'm passionate about building real-world solutions and looking for an internship "
                "where I can grow and contribute.\"\n---\n\n"
                "**Tips:** Keep it under 90 seconds. End with why *this specific role* excites you."
            )
        return "Upload your resume for a personalized pitch. General template: 'Hi, I'm [Name], studying [degree]. I specialize in [skills] and have worked on [projects]. I'm looking for an internship to apply and grow my skills.'"

    # ── Profile overview ───────────────────────────────────────────────
    if any(k in msg for k in ["my profile","my resume","analyse my","analyze my","overview"]):
        if not has_res:
            return "Please upload your resume to see your profile overview."
        roles = []
        if any(k in sk for k in ["python","django","fastapi"]): roles.append("Python Backend Developer")
        if any(k in sk for k in ["react","javascript"]): roles.append("Frontend Developer")
        if any(k in sk for k in ["machine learning","ml"]): roles.append("ML/Data Science")
        if not roles: roles = ["Software Engineer"]
        return (
            f"### 👤 Profile — {name}\n\n"
            f"**Skills:** {len(skills)} detected ({', '.join(skills[:6])})\n"
            f"**Education:** {education[0] if education else 'Not detected'}\n"
            f"**Projects:** {len(projects)}\n"
            f"**Certifications:** {len(certs)}\n\n"
            f"**Best matching roles:** {', '.join(roles[:3])}"
        )

    # ── Default ───────────────────────────────────────────────────────
    doc_hint = f'Ask about **"{doc_name}"**, or ' if has_doc else ""
    res_hint = "" if has_res else "\n\nUpload your resume for personalized answers."
    return (
        f"Hi{' **' + first + '**' if first else ''}! I'm your AI Preparation Agent.\n\n"
        f"I can help with:\n"
        f"• {doc_hint}**Role Recommendations** — *'Which roles suit my resume?'*\n"
        f"• **Skill Analysis** — *'What are my strongest skills?'*\n"
        f"• **Interview Questions** — *'Give me 5 technical questions'*\n"
        f"• **Preparation Roadmap** — *'Create a 4-week study plan'*\n"
        f"• **Tell Me About Yourself** — *'Help me write my intro pitch'*"
        + res_hint
    )


# ============================================================
# SUGGESTION CHIPS
# ============================================================

def _suggestions(message: str, has_doc: bool, has_resume: bool) -> List[str]:
    msg = message.lower()
    if has_doc and any(k in msg for k in ["document","pdf","file","paper","attached"]):
        return ["Summarise this document", "Generate 5 questions from this document",
                "What are the key concepts in this document?", "How does this relate to my resume?"]
    if any(k in msg for k in ["question","interview","technical","behavioral"]):
        return ["Give me detailed answers for these questions", "Create a 4-week prep roadmap",
                "What topics should I focus on?", "Generate HR/behavioral questions"]
    if any(k in msg for k in ["roadmap","plan","week","prepare"]):
        return ["Generate practice questions for Week 1", "What projects should I build?",
                "How do I answer 'Tell me about yourself'?"]
    if any(k in msg for k in ["skill","role","profile","strength","gap"]):
        return ["Which roles match my skills?", "What should I learn next?",
                "Give me interview questions for my top skill", "Create a preparation roadmap"]
    if has_doc:
        return ["Summarise the document", "Generate interview questions from the document",
                "Which roles suit my resume?", "Create a 4-week preparation roadmap"]
    return ["Which internship roles suit my resume?", "Give me 5 technical interview questions",
            "Create a 4-week preparation roadmap", "How do I answer 'Tell me about yourself'?"]


# ============================================================
# SESSION ENDPOINTS
# ============================================================

@router.post("/sessions", response_model=ChatSessionResponse, status_code=201)
def create_session(payload: ChatSessionCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    s = ChatSession(user_id=current_user.id, title=payload.title.strip() or "New Chat", mode=payload.mode)
    db.add(s); db.commit(); db.refresh(s)
    return s


@router.get("/sessions", response_model=List[ChatSessionResponse])
def list_sessions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(ChatSession).filter(ChatSession.user_id == current_user.id).order_by(ChatSession.updated_at.desc(), ChatSession.created_at.desc()).all()


@router.get("/sessions/{session_id}", response_model=ChatSessionDetail)
def get_session(session_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    s = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not s: raise HTTPException(404, "Session not found")
    msgs = db.query(ChatHistory).filter(ChatHistory.session_id == session_id).order_by(ChatHistory.created_at).all()
    return ChatSessionDetail(session=s, messages=msgs)


@router.patch("/sessions/{session_id}", response_model=ChatSessionResponse)
def rename_session(session_id: int, payload: ChatSessionUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    s = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not s: raise HTTPException(404, "Session not found")
    s.title = payload.title.strip() or s.title
    s.updated_at = datetime.now(timezone.utc)
    db.commit(); db.refresh(s)
    return s


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    s = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not s: raise HTTPException(404, "Session not found")
    db.delete(s); db.commit()


# ============================================================
# MAIN CHAT ENDPOINT
# ============================================================

@router.post("/message", response_model=ChatResponse)
def chat_message(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not request.message.strip():
        raise HTTPException(400, "Message cannot be empty")

    # Session validation + load DB history
    session: Optional[ChatSession] = None
    if request.session_id:
        session = db.query(ChatSession).filter(
            ChatSession.id == request.session_id,
            ChatSession.user_id == current_user.id,
        ).first()
        if not session:
            raise HTTPException(404, "Session not found")

    history = list(request.history or [])
    if session:
        rows = db.query(ChatHistory).filter(ChatHistory.session_id == session.id).order_by(ChatHistory.created_at).all()
        if rows:
            history = []
            for row in rows[-10:]:
                history.append(ChatMessage(role="user",      content=row.user_query))
                history.append(ChatMessage(role="assistant", content=row.assistant_response))

    # Build system prompt with all context
    sys_prompt = _build_system_prompt(
        resume_data = request.resume_data,
        doc_text    = request.document_text,
        doc_name    = request.document_name,
        target_role = request.target_role,
    )

    # Call LLM → fallback
    reply = _call_llm(sys_prompt, history, request.message)
    if not reply:
        reply = _fallback(
            message     = request.message,
            resume_data = request.resume_data,
            doc_text    = request.document_text,
            doc_name    = request.document_name,
            target_role = request.target_role,
        )

    # Persist to DB
    if session:
        if session.title == "New Chat":
            session.title = request.message[:60] + ("…" if len(request.message) > 60 else "")
        session.updated_at = datetime.now(timezone.utc)
        db.add(ChatHistory(
            session_id         = session.id,
            user_id            = current_user.id,
            user_query         = request.message,
            assistant_response = reply,
        ))
        db.commit()

    suggestions = _suggestions(
        message    = request.message,
        has_doc    = bool(request.document_text and request.document_text.strip()),
        has_resume = bool(request.resume_data and request.resume_data.get("skills")),
    )

    return ChatResponse(reply=reply, suggested_questions=suggestions)


# ============================================================
# DOCUMENT EXTRACTION
# ============================================================

@router.post("/extract-document")
async def extract_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    if not file.filename:
        raise HTTPException(400, "Filename is required")
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in {".pdf", ".docx"}:
        raise HTTPException(400, "Only PDF and DOCX files are supported")
    content = await file.read()
    if not content:
        raise HTTPException(400, "Uploaded file is empty")
    fpath = os.path.join(UPLOAD_DIR, f"doc_{os.path.basename(file.filename)}")
    try:
        with open(fpath, "wb") as f:
            f.write(content)
        text = extract_text(fpath, ext)
        if not text.strip():
            raise HTTPException(400, "Could not extract text from the document")
        return {
            "filename":   file.filename,
            "text":       text,
            "word_count": len(text.split()),
            "char_count": len(text),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, f"Document processing failed: {exc}")
