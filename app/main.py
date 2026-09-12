from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine, init_db
from app.routers import users, resume
from app.routers import internships
from app.routers import chat

# Create all DB tables & run migrations
init_db()

app = FastAPI(
    title="Resume & Internship Matching API",
    description=(
        "User Management, Resume Parsing, and RAG-based "
        "Internship Matching System"
    ),
    version="2.0.0"
)

# ── CORS ─────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────
app.include_router(users.router)
app.include_router(resume.router)
app.include_router(internships.router)
app.include_router(chat.router)


@app.get("/")
def root():
    return {
        "message": "Resume & Internship Matching API is running",
        "version": "2.0.0",
        "docs": "/docs"
    }
