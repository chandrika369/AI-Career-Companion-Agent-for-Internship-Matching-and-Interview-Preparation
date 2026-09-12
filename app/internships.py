"""
internships.py
Loads the internship dataset and builds/caches a FAISS vector index
so the RAG pipeline can do fast semantic search.
"""

# ── SSL patch (required on systems with corporate CA / no cert bundle) ──
import requests
import urllib3
urllib3.disable_warnings()
_orig_request = requests.Session.request
def _no_ssl_verify(self, *args, **kwargs):
    kwargs["verify"] = False
    return _orig_request(self, *args, **kwargs)
requests.Session.request = _no_ssl_verify
# ────────────────────────────────────────────────────────────────────────

import json
import os
import pickle
from pathlib import Path

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
from typing import Optional, List, Tuple

# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_FILE = BASE_DIR / "data" / "internships.json"
INDEX_FILE = BASE_DIR / "data" / "internships.index"
META_FILE  = BASE_DIR / "data" / "internships_meta.pkl"

# ============================================================
# EMBEDDING MODEL  (all-MiniLM-L6-v2 — fast, 384-dim)
# ============================================================

_model: Optional[SentenceTransformer] = None


def get_embedding_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


# ============================================================
# INTERNSHIP TEXT BUILDER
# ============================================================

def build_internship_text(internship: dict) -> str:
    """
    Concatenate all meaningful fields of an internship into a
    single string that the embedding model can encode.
    """
    parts = [
        internship.get("title", ""),
        internship.get("company", ""),
        internship.get("domain", ""),
        internship.get("description", ""),
        "Required skills: " + ", ".join(internship.get("required_skills", [])),
        "Preferred skills: " + ", ".join(internship.get("preferred_skills", [])),
        internship.get("education_requirements", ""),
        internship.get("experience_requirements", ""),
        "Tags: " + ", ".join(internship.get("tags", [])),
    ]
    return " | ".join(p for p in parts if p.strip())


# ============================================================
# LOAD DATA
# ============================================================

def load_internships() -> list[dict]:
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


# ============================================================
# BUILD / LOAD FAISS INDEX
# ============================================================

def _build_and_save_index(internships: List[dict]) -> Tuple[faiss.IndexFlatIP, List[dict]]:
    """Encode all internships and persist the FAISS index to disk."""
    model = get_embedding_model()
    texts = [build_internship_text(i) for i in internships]
    embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    embeddings = np.array(embeddings, dtype="float32")

    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)   # inner-product == cosine similarity for unit vectors
    index.add(embeddings)

    faiss.write_index(index, str(INDEX_FILE))
    with open(META_FILE, "wb") as f:
        pickle.dump(internships, f)

    return index, internships


def get_faiss_index() -> Tuple[faiss.IndexFlatIP, List[dict]]:
    """
    Return (faiss_index, internships_list).
    Loads from cache if available, otherwise builds from scratch.
    """
    internships = load_internships()

    if INDEX_FILE.exists() and META_FILE.exists():
        index = faiss.read_index(str(INDEX_FILE))
        with open(META_FILE, "rb") as f:
            meta = pickle.load(f)
        # Rebuild if dataset changed
        if len(meta) == len(internships):
            return index, meta

    return _build_and_save_index(internships)


# ============================================================
# CANDIDATE TEXT BUILDER
# ============================================================

def build_candidate_text(resume_data: dict) -> str:
    """
    Convert a parsed resume dict (from parser.parse_resume) into a
    flat string ready for embedding.
    """
    parts = []

    if resume_data.get("full_name"):
        parts.append(resume_data["full_name"])

    if resume_data.get("summary"):
        parts.append("Summary: " + resume_data["summary"])

    skills = resume_data.get("skills", [])
    if skills:
        parts.append("Skills: " + ", ".join(skills))

    education = resume_data.get("education", [])
    if education:
        parts.append("Education: " + " | ".join(education))

    experience = resume_data.get("work_experience", [])
    if experience:
        parts.append("Work Experience: " + " | ".join(experience))

    internships = resume_data.get("internships", [])
    if internships:
        parts.append("Internships: " + " | ".join(internships))

    projects = resume_data.get("projects", [])
    if projects:
        parts.append("Projects: " + " | ".join(projects))

    certifications = resume_data.get("certifications", [])
    if certifications:
        parts.append("Certifications: " + ", ".join(certifications))

    achievements = resume_data.get("achievements", [])
    if achievements:
        parts.append("Achievements: " + " | ".join(achievements))

    soft_skills = resume_data.get("soft_skills", [])
    if soft_skills:
        parts.append("Soft Skills: " + ", ".join(soft_skills))

    return " | ".join(p for p in parts if p.strip())


# ============================================================
# SEARCH
# ============================================================

def search_internships(
    candidate_text: str,
    top_k: int = 10
) -> list[dict]:
    """
    Encode candidate_text and return the top_k most similar internships
    with a 'similarity_score' field attached (0-1 cosine similarity).
    """
    model = get_embedding_model()
    index, internships = get_faiss_index()

    query_vec = model.encode(
        [candidate_text],
        normalize_embeddings=True,
        show_progress_bar=False
    )
    query_vec = np.array(query_vec, dtype="float32")

    k = min(top_k, len(internships))
    distances, indices = index.search(query_vec, k)

    results = []
    for score, idx in zip(distances[0], indices[0]):
        if idx == -1:
            continue
        internship = dict(internships[idx])
        internship["similarity_score"] = float(round(score, 6))
        # Human-readable match percentage
        internship["match_percentage"] = float(round(score * 100, 2))
        results.append(internship)

    return results
