from fastapi import APIRouter, Depends, HTTPException, status, Body
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from app.database import get_db
from app.models import User
from app.schemas import UserCreate, UserResponse, UserProfileUpdate, ChangePasswordRequest
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user
)
import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)


# ---------------- REGISTER ----------------

@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED
)
def register_user(
    user: UserCreate,
    db: Session = Depends(get_db)
):
    existing_user = db.query(User).filter(
        User.email == user.email
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    hashed_password = hash_password(user.password)

    new_user = User(
        name=user.name,
        email=user.email,
        phone=user.phone,
        password=hashed_password
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return UserResponse.model_validate_user(new_user)


# ---------------- LOGIN ----------------

@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.email == form_data.username
    ).first()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    access_token = create_access_token(
        data={"sub": str(user.id)}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


# ---------------- GET PROFILE ----------------

@router.get("/profile", response_model=UserResponse)
def get_profile(
    current_user: User = Depends(get_current_user)
):
    return UserResponse.model_validate_user(current_user)


# ---------------- UPDATE PROFILE ----------------

@router.put("/profile", response_model=UserResponse)
def update_profile(
    payload: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    import json
    current_user.name = payload.name
    current_user.phone = payload.phone

    if payload.skills is not None:
        current_user.skills = json.dumps(payload.skills)
    if payload.bio is not None:
        current_user.bio = payload.bio
    if payload.github is not None:
        current_user.github = payload.github
    if payload.linkedin is not None:
        current_user.linkedin = payload.linkedin

    db.commit()
    db.refresh(current_user)
    return UserResponse.model_validate_user(current_user)


# ---------------- DELETE ACCOUNT ----------------

@router.delete("/profile")
def delete_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.delete(current_user)
    db.commit()
    return {"message": "Account deleted successfully"}


# ---------------- CHANGE PASSWORD ----------------

@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not verify_password(payload.current_password, current_user.password):
        raise HTTPException(
            status_code=400,
            detail="Current password is incorrect"
        )

    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=400,
            detail="New password must be different from current password"
        )

    current_user.password = hash_password(payload.new_password)
    db.commit()

    return {"message": "Password changed successfully"}


# ---------------- FORGOT PASSWORD ----------------

@router.post("/forgot-password")
def forgot_password(
    email: str = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User with this email does not exist"
        )

    reset_token = create_access_token(
        data={"sub": str(user.id), "purpose": "password_reset"}
    )

    return {
        "message": "Password reset token generated",
        "reset_token": reset_token
    }


# ---------------- RESET PASSWORD ----------------

@router.post("/reset-password")
def reset_password(
    reset_token: str = Body(..., embed=True),
    new_password: str = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    try:
        payload = jwt.decode(
            reset_token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        if payload.get("purpose") != "password_reset":
            raise HTTPException(status_code=400, detail="Invalid reset token")

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=400, detail="Invalid reset token")

        user = db.query(User).filter(User.id == int(user_id)).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        user.password = hash_password(new_password)
        db.commit()

        return {"message": "Password reset successfully"}

    except JWTError:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset token"
        )


# ---------------- LOGOUT ----------------

@router.post("/logout")
def logout(
    current_user: User = Depends(get_current_user)
):
    return {"message": "Logout successful"}
