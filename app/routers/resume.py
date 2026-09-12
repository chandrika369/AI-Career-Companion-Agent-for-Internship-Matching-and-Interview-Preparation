import os

from fastapi import (
    APIRouter,
    UploadFile,
    File,
    HTTPException
)

from app.parser import (
    extract_text,
    parse_resume
)

from app.schemas import ResumeResponse


router = APIRouter(
    prefix="/resume",
    tags=["Resume"]
)


UPLOAD_DIR = "uploads"

os.makedirs(
    UPLOAD_DIR,
    exist_ok=True
)


@router.post(
    "/upload",
    response_model=ResumeResponse
)
async def upload_resume(
    file: UploadFile = File(...)
):

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Filename is required"
        )

    allowed_extensions = {
        ".pdf",
        ".docx"
    }

    file_extension = os.path.splitext(
        file.filename
    )[1].lower()

    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail="Only PDF and DOCX files are supported"
        )

    file_content = await file.read()

    if not file_content:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty"
        )

    safe_filename = os.path.basename(
        file.filename
    )

    file_path = os.path.join(
        UPLOAD_DIR,
        safe_filename
    )

    try:

        with open(
            file_path,
            "wb"
        ) as f:

            f.write(file_content)

        text = extract_text(
            file_path,
            file_extension
        )

        if not text.strip():
            raise HTTPException(
                status_code=400,
                detail="Could not extract text from resume"
            )

        result = parse_resume(text)

        return result

    except HTTPException:
        raise

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Resume processing failed: {str(e)}"
        )