import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi import Depends, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from google.auth import exceptions as google_auth_exceptions
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import id_token
from pydantic import BaseModel

from chat import ask_question
from library import get_library

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Question(BaseModel):
    question: str


def require_admin(authorization: str | None = Header(default=None)):
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase ID token is required.",
        )

    scheme, separator, token = authorization.partition(" ")

    if (
        separator != " "
        or scheme.lower() != "bearer"
        or not token.strip()
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization must use a Bearer token.",
        )

    project_id = os.getenv(
        "FIREBASE_PROJECT_ID",
        "assamwork-ai",
    ).strip()
    admin_emails = {
        email.strip().lower()
        for email in os.getenv("ADMIN_EMAILS", "").split(",")
        if email.strip()
    }

    if not admin_emails:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Backend admin access is not configured.",
        )

    try:
        claims = id_token.verify_firebase_token(
            token.strip(),
            GoogleAuthRequest(),
            audience=project_id,
        )
    except google_auth_exceptions.TransportError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firebase token verification is temporarily unavailable.",
        ) from error
    except (ValueError, google_auth_exceptions.GoogleAuthError) as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase ID token is invalid or expired.",
        ) from error

    expected_issuer = f"https://securetoken.google.com/{project_id}"
    email = str(claims.get("email") or "").strip().lower()
    subject = str(claims.get("sub") or "").strip()

    if claims.get("iss") != expected_issuer or not subject or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase ID token claims are invalid.",
        )

    if email not in admin_emails:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access is required.",
        )

    return claims


@app.get("/")
async def root():
    return {
        "status": "ok",
        "message": "AssamWork AI Backend Running"
    }


@app.post("/ask")
async def ask(question: Question):
    result = ask_question(question.question)

    return {
        "answer": result["answer"],
        "sources": result["sources"],
    }


@app.get("/library", dependencies=[Depends(require_admin)])
async def library():
    return await run_in_threadpool(get_library)
