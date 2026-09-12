from typing import Any, Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr


# ============================================================
# USER MANAGEMENT SCHEMAS
# ============================================================

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


import json


class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    phone: Optional[str] = None
    skills: List[str] = []
    bio: Optional[str] = None
    github: Optional[str] = None
    linkedin: Optional[str] = None

    @classmethod
    def model_validate_user(cls, user_obj):
        skills_raw = getattr(user_obj, "skills", None)
        skills_list = []
        if skills_raw:
            if isinstance(skills_raw, list):
                skills_list = skills_raw
            elif isinstance(skills_raw, str):
                try:
                    parsed = json.loads(skills_raw)
                    skills_list = parsed if isinstance(parsed, list) else [s.strip() for s in skills_raw.split(",") if s.strip()]
                except Exception:
                    skills_list = [s.strip() for s in skills_raw.split(",") if s.strip()]

        return cls(
            id=user_obj.id,
            name=user_obj.name,
            email=user_obj.email,
            phone=user_obj.phone,
            skills=skills_list,
            bio=getattr(user_obj, "bio", None),
            github=getattr(user_obj, "github", None),
            linkedin=getattr(user_obj, "linkedin", None),
        )

    class Config:
        from_attributes = True


class UserProfileUpdate(BaseModel):
    name: str
    phone: Optional[str] = None
    skills: Optional[List[str]] = []
    bio: Optional[str] = None
    github: Optional[str] = None
    linkedin: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


# ============================================================
# RESUME RESPONSE SCHEMA
# ============================================================

class TechnicalSkills(BaseModel):
    programming_languages: List[str] = []
    libraries_tools: List[str] = []
    web_technologies: List[str] = []
    concepts: List[str] = []


class ResumeResponse(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    linkedin: Optional[str] = None
    github: Optional[str] = None
    summary: Optional[str] = None
    skills: List[str] = []
    education: List[str] = []
    work_experience: List[str] = []
    projects: List[str] = []
    certifications: List[str] = []
    internships: List[str] = []
    languages: List[str] = []
    achievements: List[str] = []
    soft_skills: List[str] = []
    other_relevant_information: List[str] = []


# ============================================================
# INTERNSHIP SCHEMAS
# ============================================================

class InternshipBase(BaseModel):
    id: str
    title: str
    company: str
    location: Optional[str] = None
    work_mode: Optional[str] = None
    duration: Optional[str] = None
    stipend: Optional[str] = None
    description: Optional[str] = None
    required_skills: List[str] = []
    preferred_skills: List[str] = []
    education_requirements: Optional[str] = None
    experience_requirements: Optional[str] = None
    domain: Optional[str] = None
    tags: List[str] = []


class InternshipMatch(InternshipBase):
    similarity_score: float = 0.0
    match_percentage: float = 0.0


class RAGMatchResult(BaseModel):
    candidate_name: Optional[str] = None
    candidate_skills: List[str] = []
    total_matched: int = 0
    match_summary: str = ""
    internships: List[InternshipMatch] = []


class MatchRequest(BaseModel):
    resume_data: Dict[str, Any]
    top_k: int = 10


class CoverLetterRequest(BaseModel):
    resume_data: Dict[str, Any]
    internship: Dict[str, Any]
    tone: str = "formal"          # formal | friendly | enthusiastic
    emphasize: Optional[str] = None


class CoverLetterResponse(BaseModel):
    cover_letter: str
    internship_title: str
    company: str


class SkillGapRequest(BaseModel):
    resume_data: Dict[str, Any]
    internship: Dict[str, Any]


class SkillGapResponse(BaseModel):
    matched_required: List[str] = []
    missing_required: List[str] = []
    matched_preferred: List[str] = []
    missing_preferred: List[str] = []
    readiness_score: float = 0.0
    recommendation: str = ""


# ============================================================
# APPLICATION SCHEMAS
# ============================================================

class ApplicationCreate(BaseModel):
    internship_id: str
    internship_title: str
    company: str
    location: Optional[str] = None
    work_mode: Optional[str] = None
    domain: Optional[str] = None
    cover_note: Optional[str] = None
    match_percentage: Optional[str] = None


class ApplicationResponse(BaseModel):
    id: int
    user_id: int
    internship_id: str
    internship_title: str
    company: str
    location: Optional[str] = None
    work_mode: Optional[str] = None
    domain: Optional[str] = None
    status: str
    cover_note: Optional[str] = None
    match_percentage: Optional[str] = None
    applied_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ApplicationStatusUpdate(BaseModel):
    status: str  # applied | interviewing | rejected | accepted


# ============================================================
# CHAT / INTERVIEW PREP SCHEMAS
# ============================================================

class ChatMessage(BaseModel):
    role: str          # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    resume_data: Optional[Dict[str, Any]] = None
    document_text: Optional[str] = None
    document_name: Optional[str] = None
    context_type: Optional[str] = "general"
    target_role: Optional[str] = None   # role name if specified
    session_id: Optional[int] = None    # DB session to persist messages into


class ChatResponse(BaseModel):
    reply: str
    suggested_questions: List[str] = []


class DocumentQARequest(BaseModel):
    question: str
    document_text: str
    history: List[ChatMessage] = []


class DocumentQAResponse(BaseModel):
    answer: str
    suggested_questions: List[str] = []


# ============================================================
# CHAT SESSION & HISTORY SCHEMAS
# ============================================================

class ChatSessionCreate(BaseModel):
    """Body for POST /chat/sessions — create a new session."""
    title: str = "New Chat"
    mode: str = "general"


class ChatSessionUpdate(BaseModel):
    """Body for PATCH /chat/sessions/{id} — rename a session."""
    title: str


class ChatSessionResponse(BaseModel):
    """What we send back when listing / creating sessions."""
    id: int
    user_id: int
    title: str
    mode: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ChatHistoryResponse(BaseModel):
    """One stored exchange: a user query + the assistant's reply."""
    id: int
    session_id: int
    user_id: int
    user_query: str
    assistant_response: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ChatSessionDetail(BaseModel):
    """Session metadata + all its messages — returned by GET /chat/sessions/{id}."""
    session: ChatSessionResponse
    messages: List[ChatHistoryResponse] = []
