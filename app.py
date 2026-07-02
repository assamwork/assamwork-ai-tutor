import os
import threading
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi import (
    Depends,
    File,
    Form,
    Header,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from google.auth import exceptions as google_auth_exceptions
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import id_token
from pydantic import BaseModel

from chat import ask_question
from ingest import ingest_library
from library import (
    LibraryValidationError,
    delete_pdf,
    get_library,
    get_library_status,
    save_pdf,
)

load_dotenv()

app = FastAPI()
library_job_lock = threading.Lock()
indexing_state_lock = threading.Lock()
indexing_state = {
    "running": False,
    "startedAt": None,
    "finishedAt": None,
    "lastSuccessfulAt": None,
    "lastResult": None,
}

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Question(BaseModel):
    question: str


class DeleteBookRequest(BaseModel):
    subject: str
    book: str


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


@app.post(
    "/admin/library/upload",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
async def upload_library_book(
    file: UploadFile = File(...),
    subject: str = Form(...),
):
    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed.",
        )

    if not library_job_lock.acquire(blocking=False):
        await file.close()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A library operation is already running.",
        )

    try:
        book = await run_in_threadpool(
            save_pdf,
            file.file,
            subject,
            file.filename or "",
        )
    except LibraryValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error
    finally:
        await file.close()
        library_job_lock.release()

    return {
        **book,
        "message": (
            "PDF uploaded but not indexed yet. Click Make Available "
            "to AI to index it."
        ),
    }


@app.delete(
    "/admin/library/book",
    dependencies=[Depends(require_admin)],
)
async def delete_library_book(request: DeleteBookRequest):
    if not library_job_lock.acquire(blocking=False):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A library operation is already running.",
        )

    try:
        return await run_in_threadpool(
            delete_pdf,
            request.subject,
            request.book,
        )
    except LibraryValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error
    except FileNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    finally:
        library_job_lock.release()


def _run_reindex():
    try:
        result = ingest_library()
        finished_at = datetime.now(timezone.utc).isoformat()

        with indexing_state_lock:
            indexing_state["running"] = False
            indexing_state["finishedAt"] = finished_at
            indexing_state["lastResult"] = result

            if result.get("success"):
                indexing_state["lastSuccessfulAt"] = finished_at

        return result
    except Exception as error:
        finished_at = datetime.now(timezone.utc).isoformat()

        with indexing_state_lock:
            indexing_state["running"] = False
            indexing_state["finishedAt"] = finished_at
            indexing_state["lastResult"] = {
                "success": False,
                "message": (
                    "Re-index failed. Check backend logs and try again."
                ),
                "booksProcessed": 0,
                "chunksAdded": 0,
                "errors": [
                    {
                        "error": str(error),
                    }
                ],
            }

        raise
    finally:
        library_job_lock.release()


@app.post(
    "/admin/library/reindex",
    dependencies=[Depends(require_admin)],
)
async def reindex_library():
    if not library_job_lock.acquire(blocking=False):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Re-index is already running.",
        )

    with indexing_state_lock:
        indexing_state["running"] = True
        indexing_state["startedAt"] = datetime.now(
            timezone.utc
        ).isoformat()
        indexing_state["finishedAt"] = None

    try:
        return await run_in_threadpool(_run_reindex)
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Re-index failed. Check backend logs and try again.",
        ) from error


@app.get(
    "/admin/library/reindex/status",
    dependencies=[Depends(require_admin)],
)
async def reindex_status():
    with indexing_state_lock:
        return {
            "running": indexing_state["running"],
            "startedAt": indexing_state["startedAt"],
            "finishedAt": indexing_state["finishedAt"],
            "lastResult": indexing_state["lastResult"],
        }


@app.get(
    "/admin/system/status",
    dependencies=[Depends(require_admin)],
)
async def system_status():
    library_status = await run_in_threadpool(get_library_status)

    with indexing_state_lock:
        last_indexed = indexing_state["lastSuccessfulAt"]

    rag_ready = (
        library_status["chroma"] == "ready"
        and (library_status["libraryChunks"] or 0) > 0
        and bool(os.getenv("GEMINI_API_KEY"))
    )

    return {
        "backend": "online",
        "rag": "ready" if rag_ready else "not_ready",
        "chroma": library_status["chroma"],
        "libraryBooks": library_status["libraryBooks"],
        "libraryChunks": library_status["libraryChunks"],
        "lastIndexed": last_indexed,
        "environment": os.getenv("APP_ENV", "local"),
    }
