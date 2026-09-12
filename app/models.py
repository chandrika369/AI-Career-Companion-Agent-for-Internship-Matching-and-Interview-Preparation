from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    phone = Column(String(20), nullable=True)
    password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    skills = Column(Text, nullable=True)
    bio = Column(Text, nullable=True)
    github = Column(String(255), nullable=True)
    linkedin = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    applications = relationship("Application", back_populates="user", cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Internship snapshot (denormalized so history is preserved)
    internship_id = Column(String(20), nullable=False)
    internship_title = Column(String(200), nullable=False)
    company = Column(String(200), nullable=False)
    location = Column(String(200), nullable=True)
    work_mode = Column(String(50), nullable=True)
    domain = Column(String(100), nullable=True)

    # Application metadata
    status = Column(String(50), default="applied")   # applied | interviewing | rejected | accepted
    cover_note = Column(Text, nullable=True)          # optional short note from candidate
    match_percentage = Column(String(10), nullable=True)

    applied_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="applications")


class ChatSession(Base):
    """One chat session per user — a named conversation thread.
    A user can have many sessions (e.g. one per role they're preparing for).
    """

    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Human-readable title shown in the session list (auto-generated or user-set).
    title = Column(String(200), nullable=False, default="New Chat")

    # The chat mode when the session was created.
    # general | role_recommendation | interview_prep | document_qa
    mode = Column(String(50), default="general")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="chat_sessions")
    messages = relationship("ChatHistory", back_populates="session", cascade="all, delete-orphan",
                            order_by="ChatHistory.created_at")


class ChatHistory(Base):
    """One row per message exchange (user query + assistant response).
    Stored so conversation memory can be retrieved across page reloads.
    """

    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    user_query = Column(Text, nullable=False)
    assistant_response = Column(Text, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("ChatSession", back_populates="messages")
    user = relationship("User")
