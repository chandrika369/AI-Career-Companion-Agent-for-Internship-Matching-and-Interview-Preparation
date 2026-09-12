"""
routers/internships.py
All internship-related API endpoints:
  GET  /internships/           — browse all internships
  GET  /internships/{id}       — get one internship
  POST /internships/match      — RAG match against resume data
  POST /internships/cover-letter — generate cover letter
  POST /internships/skill-gap  — skill gap analysis
  POST /internships/apply      — save an application
  GET  /internships/applications/me — user's applications
  DELETE /internships/applications/{id} — withdraw application
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Application, User
from app.auth import get_current_user
from app.internships import load_internships, search_internships, build_candidate_text
from app.rag import run_rag_pipeline, generate_cover_letter, analyze_skill_gap
from app.schemas import (
    RAGMatchResult,
    InternshipBase,
    InternshipMatch,
    MatchRequest,
    CoverLetterRequest,
    CoverLetterResponse,
    SkillGapRequest,
    SkillGapResponse,
    ApplicationCreate,
    ApplicationResponse,
    ApplicationStatusUpdate,
)

router = APIRouter(
    prefix="/internships",
    tags=["Internships"]
)


# ============================================================
# BROWSE ALL INTERNSHIPS
# ============================================================

@router.get("/", response_model=List[InternshipBase])
def browse_internships(
    domain: str = Query(None, description="Filter by domain"),
    work_mode: str = Query(None, description="Filter by work mode"),
    search: str = Query(None, description="Keyword search in title/company/description"),
):
    internships = load_internships()

    if domain:
        internships = [i for i in internships if i.get("domain", "").lower() == domain.lower()]

    if work_mode:
        internships = [i for i in internships if i.get("work_mode", "").lower() == work_mode.lower()]

    if search:
        q = search.lower()
        internships = [
            i for i in internships
            if q in i.get("title", "").lower()
            or q in i.get("company", "").lower()
            or q in i.get("description", "").lower()
            or any(q in s.lower() for s in i.get("tags", []))
            or any(q in s.lower() for s in i.get("required_skills", []))
        ]

    return internships


# ============================================================
# GET SINGLE INTERNSHIP
# ============================================================

@router.get("/{internship_id}", response_model=InternshipBase)
def get_internship(internship_id: str):
    internships = load_internships()
    for i in internships:
        if i["id"] == internship_id:
            return i
    raise HTTPException(status_code=404, detail="Internship not found")


# ============================================================
# RAG MATCH
# ============================================================

@router.post("/match", response_model=RAGMatchResult)
def match_internships(request: MatchRequest):
    """
    Run the full RAG pipeline against the candidate's parsed resume data.
    Returns top-k matching internships with similarity scores and a
    Gemini-grounded match summary.
    """
    if not request.resume_data:
        raise HTTPException(status_code=400, detail="resume_data is required")

    result = run_rag_pipeline(
        resume_data=request.resume_data,
        top_k=request.top_k
    )
    return result


# ============================================================
# COVER LETTER
# ============================================================

@router.post("/cover-letter", response_model=CoverLetterResponse)
def create_cover_letter(request: CoverLetterRequest):
    """
    Generate a grounded cover letter for a specific internship.
    """
    if not request.resume_data or not request.internship:
        raise HTTPException(status_code=400, detail="resume_data and internship are required")

    valid_tones = {"formal", "friendly", "enthusiastic"}
    tone = request.tone.lower() if request.tone.lower() in valid_tones else "formal"

    letter = generate_cover_letter(
        resume_data=request.resume_data,
        internship=request.internship,
        tone=tone,
        emphasize=request.emphasize or "",
    )

    return CoverLetterResponse(
        cover_letter=letter,
        internship_title=request.internship.get("title", ""),
        company=request.internship.get("company", ""),
    )


# ============================================================
# SKILL GAP ANALYSIS
# ============================================================

@router.post("/skill-gap", response_model=SkillGapResponse)
def skill_gap_analysis(request: SkillGapRequest):
    """
    Analyse the gap between candidate skills and internship requirements.
    """
    if not request.resume_data or not request.internship:
        raise HTTPException(status_code=400, detail="resume_data and internship are required")

    result = analyze_skill_gap(
        resume_data=request.resume_data,
        internship=request.internship,
    )
    return result


# ============================================================
# APPLY TO INTERNSHIP (authenticated)
# ============================================================

@router.post("/apply", response_model=ApplicationResponse, status_code=201)
def apply_to_internship(
    payload: ApplicationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Prevent duplicate applications
    existing = db.query(Application).filter(
        Application.user_id == current_user.id,
        Application.internship_id == payload.internship_id,
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail="You have already applied to this internship"
        )

    # Safely format match_percentage
    match_pct = payload.match_percentage
    if match_pct is not None:
        match_pct_str = str(match_pct).strip()
        if match_pct_str.lower() in ("undefined", "null", ""):
            match_pct = None
        else:
            match_pct = match_pct_str

    application = Application(
        user_id=current_user.id,
        internship_id=payload.internship_id,
        internship_title=payload.internship_title,
        company=payload.company,
        location=payload.location,
        work_mode=payload.work_mode,
        domain=payload.domain,
        cover_note=payload.cover_note,
        match_percentage=match_pct,
        status="applied",
    )
    db.add(application)
    db.commit()
    db.refresh(application)
    return application


# ============================================================
# MY APPLICATIONS (authenticated)
# ============================================================

@router.get("/applications/me", response_model=List[ApplicationResponse])
def my_applications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(Application)
        .filter(Application.user_id == current_user.id)
        .order_by(Application.applied_at.desc())
        .all()
    )


# ============================================================
# UPDATE APPLICATION STATUS (authenticated)
# ============================================================

@router.patch("/applications/{application_id}/status", response_model=ApplicationResponse)
def update_application_status(
    application_id: int,
    payload: ApplicationStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    application = db.query(Application).filter(
        Application.id == application_id,
        Application.user_id == current_user.id,
    ).first()

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    valid_statuses = {"applied", "interviewing", "accepted", "rejected"}
    new_status = payload.status.lower().strip()
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status: {payload.status}")

    application.status = new_status
    db.commit()
    db.refresh(application)
    return application


# ============================================================
# WITHDRAW APPLICATION (authenticated)
# ============================================================

@router.delete("/applications/{application_id}")
def withdraw_application(
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    application = db.query(Application).filter(
        Application.id == application_id,
        Application.user_id == current_user.id,
    ).first()

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    db.delete(application)
    db.commit()
    return {"message": "Application withdrawn successfully"}

