"""
rag.py
RAG pipeline — takes parsed resume data, retrieves matching internships
from the FAISS vector store, then optionally calls Gemini to produce
a natural-language matching summary grounded strictly in real data.
"""

import os
import re
from typing import Optional
from dotenv import load_dotenv
import google.generativeai as genai

from app.internships import build_candidate_text, search_internships

load_dotenv()

# ============================================================
# GEMINI SETUP
# ============================================================

def get_gemini_api_key() -> str:
    """Retrieve Gemini API key dynamically from env or .env file."""
    key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
    if not key:
        load_dotenv(override=True)
        key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
    return key.strip()


def _get_gemini(model_name: str = "gemini-2.0-flash", system_instruction: Optional[str] = None):
    """
    Dynamically configure and return a Gemini GenerativeModel.
    Returns None if no API key is available.
    Tries gemini-2.0-flash first, falls back to gemini-1.5-flash-latest.
    """
    api_key = get_gemini_api_key()
    if not api_key:
        return None

    try:
        genai.configure(api_key=api_key)
        kwargs = {}
        if system_instruction:
            kwargs["system_instruction"] = system_instruction
        try:
            return genai.GenerativeModel(model_name, **kwargs)
        except Exception:
            # fallback to the other common free-tier model
            return genai.GenerativeModel("gemini-1.5-flash-latest", **kwargs)
    except Exception:
        return None


# ============================================================
# MATCH SUMMARY (LLM layer)
# ============================================================

def generate_match_summary(
    resume_data: dict,
    matched_internships: list[dict]
) -> str:
    """
    Use Gemini to write a short paragraph explaining WHY the top
    internships match this candidate.  Falls back to a rule-based
    summary if no API key is configured.
    """
    model = _get_gemini()

    if not model or not matched_internships:
        return _rule_based_summary(resume_data, matched_internships)

    candidate_skills = resume_data.get("skills", [])
    candidate_edu = resume_data.get("education", [])
    candidate_exp = resume_data.get("work_experience", [])
    candidate_projects = resume_data.get("projects", [])

    top3 = matched_internships[:3]
    internship_list = "\n".join(
        f"- {i['title']} at {i['company']} "
        f"(match: {i['match_percentage']}%, "
        f"skills: {', '.join(i['required_skills'][:4])})"
        for i in top3
    )

    prompt = f"""You are an internship matching assistant. Based ONLY on the information provided below, write a concise 3-4 sentence summary explaining why these internships are a good match for this candidate. Do NOT invent any details.

CANDIDATE PROFILE:
- Skills: {', '.join(candidate_skills[:15]) if candidate_skills else 'Not specified'}
- Education: {' | '.join(candidate_edu[:2]) if candidate_edu else 'Not specified'}
- Experience: {' | '.join(candidate_exp[:2]) if candidate_exp else 'Not specified'}
- Projects: {' | '.join(candidate_projects[:2]) if candidate_projects else 'Not specified'}

TOP MATCHING INTERNSHIPS:
{internship_list}

Write the summary now:"""

    try:
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception:
        return _rule_based_summary(resume_data, matched_internships)


def _rule_based_summary(resume_data: dict, matched_internships: list[dict]) -> str:
    """Fallback summary when Gemini is not available."""
    if not matched_internships:
        return "No matching internships found for the provided resume."

    name = resume_data.get("full_name", "The candidate")
    skills = resume_data.get("skills", [])
    top = matched_internships[0]

    skill_overlap = [
        s for s in skills
        if any(s.lower() in rs.lower() for rs in top.get("required_skills", []))
    ]

    summary = (
        f"{name}'s resume shows strong alignment with {top['title']} at {top['company']} "
        f"({top['match_percentage']}% match). "
    )
    if skill_overlap:
        summary += f"Key matching skills include: {', '.join(skill_overlap[:5])}. "
    if len(matched_internships) > 1:
        domains = list({i["domain"] for i in matched_internships[:5]})
        summary += f"Overall, the profile matches well with {', '.join(domains[:3])} roles."
    return summary


def _get_clean_education_summary(resume_data: dict) -> str:
    """
    Extract a clean, human-readable education degree summary from parsed resume data,
    filtering out table headers (like 'COURSE INSTITUTE / COLLEGE BOARD / UNIVERSITY SCORE YEAR').
    """
    other_info = resume_data.get("other_relevant_information", []) or []
    education = resume_data.get("education", []) or []

    # 1. Check other_relevant_information for Course / Degree line
    for item in other_info:
        if re.search(r"\b(course|degree|branch|b\.?tech|b\.?e\.?|bca|mca|m\.?tech|computer science)\b", item, re.IGNORECASE):
            cleaned = re.sub(r"^(course|degree|branch)\s*[:\-]\s*", "", item, flags=re.IGNORECASE).strip()
            if not re.search(r"institute\s*/\s*college|board\s*/\s*university|score\s+year", cleaned, re.IGNORECASE) or "b.tech" in cleaned.lower():
                return cleaned

    # 2. Check education list
    valid_degrees = []
    for item in education:
        # Ignore table headers
        if re.search(r"course\s+institute|board\s*/\s*university|score\s+year|academic details", item, re.IGNORECASE):
            continue
        if re.search(r"\b(b\.?tech|b\.?e\.?|m\.?tech|bca|mca|b\.?sc|master|bachelor|computer science|engineering|technology)\b", item, re.IGNORECASE):
            valid_degrees.append(item)
        elif "class" in item.lower() or "college" in item.lower():
            valid_degrees.append(item)

    if valid_degrees:
        top = valid_degrees[0]
        if " - " in top:
            parts = top.split(" - ")
            return f"{parts[0]} at {parts[1]}" if len(parts) > 1 else parts[0]
        return top

    return "Computer Science and Engineering"


def _get_clean_project_mention(resume_data: dict, highlight_skills: str = "") -> str:
    """
    Extract first clean project name or fallback.
    """
    projects = resume_data.get("projects", []) or []
    for p in projects:
        first_line = p.splitlines()[0].strip()
        first_line = re.sub(r"\s*\|\s*github|\s*live|\s*github|\s*jan\s*20\d\d.*|\s*feb\s*20\d\d.*|\s*mar\s*20\d\d.*|\s*apr\s*20\d\d.*|\s*may\s*20\d\d.*|\s*jun\s*20\d\d.*|\s*jul\s*20\d\d.*|\s*aug\s*20\d\d.*|\s*sep\s*20\d\d.*|\s*oct\s*20\d\d.*|\s*nov\s*20\d\d.*|\s*dec\s*20\d\d.*", "", first_line, flags=re.IGNORECASE).strip()
        if first_line and len(first_line) > 3 and len(first_line) < 90 and not re.match(r"^projects?\b", first_line, re.IGNORECASE):
            return f"'{first_line}'"
    return f"hands-on project development in {highlight_skills}" if highlight_skills else "practical software projects"


def _get_clean_exp_mention(resume_data: dict) -> str:
    """
    Extract first internship / work experience mention.
    """
    internships = resume_data.get("internships", []) or []
    if internships:
        first_intern = internships[0].splitlines()[0].strip()
        # Clean dates
        first_intern = re.sub(r"\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*20\d\d.*", "", first_intern, flags=re.IGNORECASE).strip()
        if first_intern and len(first_intern) < 100:
            return f"my experience as {first_intern}"

    experience = resume_data.get("work_experience", []) or []
    if experience:
        first_exp = experience[0].splitlines()[0].strip()
        if first_exp and len(first_exp) < 100:
            return f"my experience in {first_exp}"

    return "practical coursework and project development"


# ============================================================
# COVER LETTER GENERATION
# ============================================================

def generate_cover_letter(
    resume_data: dict,
    internship: dict,
    tone: str = "formal",
    emphasize: str = ""
) -> str:
    """
    Generate a cover letter for a specific internship using Gemini or rule-based fallback,
    grounded only in the candidate's actual resume data and tailored to the chosen tone:
    'formal', 'friendly', or 'enthusiastic'.
    """
    valid_tones = {"formal", "friendly", "enthusiastic"}
    tone_clean = tone.lower().strip() if tone and tone.lower().strip() in valid_tones else "formal"

    model = _get_gemini()

    if not model:
        return _template_cover_letter(resume_data, internship, tone_clean, emphasize)

    name = resume_data.get("full_name") or "Candidate"
    email = resume_data.get("email", "")
    phone = resume_data.get("phone", "")
    skills = ", ".join(resume_data.get("skills", [])[:15])
    education = _get_clean_education_summary(resume_data)
    internships = " | ".join(resume_data.get("internships", [])[:2])
    experience = " | ".join(resume_data.get("work_experience", [])[:2]) or internships
    projects = " | ".join([p.splitlines()[0] for p in resume_data.get("projects", [])[:3]])
    certifications = ", ".join(resume_data.get("certifications", [])[:3])
    summary = resume_data.get("summary", "")

    tone_instructions = {
        "formal": (
            "Tone style: FORMAL & PROFESSIONAL. Use polished, articulate, and respectful language. "
            "Structure it like an executive business cover letter with traditional salutation ('Dear Hiring Team at {company}') "
            "and sign-off ('Sincerely'). Emphasize qualifications, academic rigor, and alignment with organizational goals."
        ),
        "friendly": (
            "Tone style: FRIENDLY & CONVERSATIONAL. Use warm, approachable, and engaging language. "
            "Sound passionate, collaborative, and personable with a welcoming salutation ('Hello {company} Team') "
            "and sign-off ('Warm regards'). Emphasize team spirit, excitement about the company culture, and eagerness to learn."
        ),
        "enthusiastic": (
            "Tone style: ENTHUSIASTIC & HIGH-ENERGY. Use dynamic, inspiring, and passionate language. "
            "Convey immense excitement and proactive drive with a high-energy salutation ('Dear {company} Hiring Team') "
            "and sign-off ('With great enthusiasm'). Emphasize intense curiosity, rapid learning, and eagerness to make an immediate impact."
        ),
    }.get(tone_clean, "Tone style: FORMAL & PROFESSIONAL.")

    emphasize_line = f"\nPlease especially highlight and emphasize: {emphasize}" if emphasize else ""

    prompt = f"""You are an expert cover letter writer. Write a tailored, compelling cover letter for the candidate applying to the specific internship below.

TONE REQUIREMENT:
{tone_instructions}

GROUNDING RULES:
- Use ONLY the provided candidate information below.
- Do NOT invent experiences, companies, degrees, or placeholders like 'COURSE INSTITUTE / COLLEGE BOARD'.
- Directly connect the candidate's actual projects, skills, education, and internships to the internship requirements.
{emphasize_line}

CANDIDATE PROFILE:
- Name: {name}
- Email: {email}
- Phone: {phone}
- Summary: {summary if summary else 'Not provided'}
- Degree / Education: {education}
- Skills: {skills if skills else 'Not specified'}
- Internships & Experience: {experience if experience else 'Not specified'}
- Projects: {projects if projects else 'Not specified'}
- Certifications: {certifications if certifications else 'Not specified'}

TARGET INTERNSHIP:
- Title: {internship.get('title', '')}
- Company: {internship.get('company', '')}
- Domain: {internship.get('domain', '')}
- Description: {internship.get('description', '')}
- Required Skills: {', '.join(internship.get('required_skills', []))}
- Preferred Skills: {', '.join(internship.get('preferred_skills', []))}
- Location: {internship.get('location', '')}

Write the complete cover letter (3-4 concise paragraphs) now:"""

    try:
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception:
        return _template_cover_letter(resume_data, internship, tone_clean, emphasize)


def _template_cover_letter(
    resume_data: dict,
    internship: dict,
    tone: str = "formal",
    emphasize: str = ""
) -> str:
    """
    Intelligent rule-based cover letter generator that creates 3 distinct styles
    (formal, friendly, enthusiastic) deeply grounded in the candidate's parsed resume details.
    """
    name = resume_data.get("full_name") or "Candidate"
    email = resume_data.get("email", "")
    phone = resume_data.get("phone", "")
    skills = resume_data.get("skills", [])
    certs = resume_data.get("certifications", [])

    title = internship.get("title", "Internship")
    company = internship.get("company", "your organization")
    domain = internship.get("domain", "Technology")
    req_skills = internship.get("required_skills", [])

    # Identify matching skills between resume and internship
    req_lower = [r.lower() for r in req_skills]
    skill_overlap = [s for s in skills if s.lower() in req_lower or any(s.lower() in r for r in req_lower)]

    highlight_skills = (
        emphasize if emphasize
        else (", ".join(skill_overlap[:4]) if skill_overlap else (", ".join(skills[:4]) if skills else "software development"))
    )
    all_top_skills = ", ".join(skills[:5]) if skills else highlight_skills

    edu_desc = _get_clean_education_summary(resume_data)
    project_mention = _get_clean_project_mention(resume_data, highlight_skills)
    exp_mention = _get_clean_exp_mention(resume_data)
    req_str = ", ".join(req_skills[:3]) if req_skills else "modern software technologies"

    contact_footer = f"\n{name}"
    if email:
        contact_footer += f"\nEmail: {email}"
    if phone:
        contact_footer += f"\nPhone: {phone}"

    if tone == "friendly":
        return f"""Hello {company} Team,

I was excited to come across the {title} opportunity at {company}! Having a strong interest in {domain} and hands-on experience in {highlight_skills}, I would love to contribute to your team as an intern.

With a background in {edu_desc}, I enjoy building practical solutions using {all_top_skills}. Through {project_mention}, I gained valuable experience solving real-world challenges and collaborating on software implementations. {exp_mention} has further helped me build a solid foundation in engineering best practices.

What draws me most to {company} is the opportunity to learn alongside talented professionals while applying my skills in {req_str}. I am naturally curious, communicate proactively, and enjoy supporting my teammates to achieve shared goals.

I would love the opportunity to speak with you about how my background and enthusiasm can benefit {company}. Thank you very much for your time and consideration!

Warm regards,{contact_footer}"""

    elif tone == "enthusiastic":
        return f"""Dear {company} Hiring Team,

I am absolutely thrilled to submit my application for the {title} position at {company}! As an aspiring engineer passionate about {domain} and specializing in {highlight_skills}, this internship is the exact opportunity I have been eager to pursue.

My technical training in {edu_desc} has provided me with deep practical skills in {all_top_skills}. Through challenging work such as {project_mention}, I have consistently pushed myself to design clean, efficient, and impactful solutions. Your focus on {req_str} aligns perfectly with my technical drive and eagerness to build cutting-edge solutions.

Additionally, {exp_mention} has given me the confidence to hit the ground running, tackle demanding technical challenges, and bring dedication and positive energy to your engineering team. I would be honored to contribute to your initiatives and grow alongside your exceptional team.

Thank you for considering my application! I look forward to discussing how my skills, passion, and energy will make a meaningful impact at {company}.

With great enthusiasm,{contact_footer}"""

    else:  # Formal tone (default)
        cert_line = f" Furthermore, my background includes certifications in {', '.join(certs[:2])}." if certs else ""
        return f"""Dear Hiring Team at {company},

I am writing to formally submit my application for the {title} internship position at {company}. With a solid academic background in {edu_desc} and proven proficiency in {highlight_skills}, I am well-prepared to contribute to your engineering objectives.

Throughout my studies and technical training, I have developed competencies in {all_top_skills}. Specifically, through practical work such as {project_mention}, I have demonstrated the ability to translate technical requirements into robust solutions.{cert_line} Additionally, {exp_mention} has reinforced my discipline in code quality, problem analysis, and timely delivery.

I am particularly drawn to {company} because of your leadership in {domain} and the demanding technical scope of this role. I am confident that my technical alignment with {req_str} and my commitment to continuous improvement will enable me to add immediate value to your team.

Thank you for your time and consideration. I welcome the opportunity to discuss my qualifications with you in an interview.

Sincerely,{contact_footer}"""


# ============================================================
# SKILL GAP ANALYSIS
# ============================================================

def analyze_skill_gap(
    resume_data: dict,
    internship: dict
) -> dict:
    """
    Compare candidate skills vs internship requirements.
    Returns matched, missing, and a recommendation string.
    """
    candidate_skills = {s.lower().strip() for s in resume_data.get("skills", [])}
    required = internship.get("required_skills", [])
    preferred = internship.get("preferred_skills", [])

    matched_required = [s for s in required if s.lower() in candidate_skills]
    missing_required = [s for s in required if s.lower() not in candidate_skills]
    matched_preferred = [s for s in preferred if s.lower() in candidate_skills]
    missing_preferred = [s for s in preferred if s.lower() not in candidate_skills]

    total = len(required) + len(preferred)
    matched_total = len(matched_required) + len(matched_preferred)
    readiness = round((matched_total / total * 100), 1) if total else 0

    model = _get_gemini()
    if model and (missing_required or missing_preferred):
        prompt = f"""Given a candidate applying for {internship.get('title')} at {internship.get('company')}, they are missing these skills:
Required: {', '.join(missing_required) if missing_required else 'None'}
Preferred: {', '.join(missing_preferred) if missing_preferred else 'None'}

In 2-3 sentences, suggest the most impactful learning path to fill these gaps. Be specific and practical."""
        try:
            response = model.generate_content(prompt)
            recommendation = response.text.strip()
        except Exception:
            recommendation = _default_recommendation(missing_required)
    else:
        recommendation = _default_recommendation(missing_required)

    return {
        "matched_required": matched_required,
        "missing_required": missing_required,
        "matched_preferred": matched_preferred,
        "missing_preferred": missing_preferred,
        "readiness_score": readiness,
        "recommendation": recommendation,
    }


def _default_recommendation(missing: list) -> str:
    if not missing:
        return "You meet all the required skill criteria for this internship. Focus on building project experience."
    return f"Focus on learning {', '.join(missing[:3])} first. Consider building a small project using these technologies to strengthen your portfolio."


# ============================================================
# MAIN RAG PIPELINE ENTRY POINT
# ============================================================

def run_rag_pipeline(
    resume_data: dict,
    top_k: int = 10
) -> dict:
    """
    Full RAG pipeline:
    1. Build candidate text from resume
    2. Search FAISS for top_k matching internships
    3. Generate an LLM-grounded match summary
    Returns structured result dict.
    """
    candidate_text = build_candidate_text(resume_data)
    matched = search_internships(candidate_text, top_k=top_k)
    summary = generate_match_summary(resume_data, matched)

    return {
        "candidate_name": resume_data.get("full_name", "Unknown"),
        "candidate_skills": resume_data.get("skills", []),
        "total_matched": len(matched),
        "match_summary": summary,
        "internships": matched,
    }
