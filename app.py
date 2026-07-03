import os
import threading
import logging
import asyncio
import json
import uuid
import inspect
from datetime import datetime, timezone
from pathlib import Path

import chat as chat_module
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi import (
    Depends,
    File,
    Form,
    Header,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from google.auth import exceptions as google_auth_exceptions
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import id_token
from pydantic import BaseModel, Field

from chat import ask_question, stream_answer
from ingest import ingest_library
from library import (
    LibraryValidationError,
    delete_pdf,
    get_library,
    get_library_status,
    save_pdf,
)

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s:%(name)s:%(message)s",
)
logging.getLogger().setLevel(logging.INFO)

logger = logging.getLogger(__name__)
logging.getLogger("chat").setLevel(logging.INFO)
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


def _callable_location(function):
    return (
        f"{function.__module__}."
        f"{getattr(function, '__name__', '<unknown>')} "
        f"@ {inspect.getsourcefile(function)}:"
        f"{inspect.getsourcelines(function)[1]}"
    )


@app.on_event("startup")
async def log_runtime_paths():
    logger.info("Runtime path audit: cwd=%s", os.getcwd())
    logger.info("Runtime path audit: app.__file__=%s", __file__)
    logger.info("Runtime path audit: app.py absolute=%s", Path(__file__).resolve())
    logger.info(
        "Runtime path audit: chat.__file__=%s",
        getattr(chat_module, "__file__", None),
    )
    logger.info(
        "Runtime path audit: chat.py absolute=%s",
        Path(getattr(chat_module, "__file__", "")).resolve(),
    )
    logger.info(
        "Runtime path audit: imported ask_question=%s",
        _callable_location(ask_question),
    )
    logger.info(
        "Runtime path audit: imported stream_answer=%s",
        _callable_location(stream_answer),
    )

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=(
        r"^http://localhost:\d+$|"
        r"^http://127\.0\.0\.1:\d+$|"
        r"^https://ai\.assamwork\.com$|"
        r"^https://.*\.vercel\.app$"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatHistoryMessage(BaseModel):
    role: str
    content: str


class Question(BaseModel):
    question: str
    history: list[ChatHistoryMessage] = Field(default_factory=list)


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

    project_id = os.getenv("FIREBASE_PROJECT_ID", "").strip()
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

    if not project_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firebase project ID is not configured.",
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
    request_id = uuid.uuid4().hex[:10]
    history = [message.model_dump() for message in question.history]
    logger.info(
        "[trace:%s] POST /ask incoming question=%r history_len=%s",
        request_id,
        question.question,
        len(history),
    )
    logger.info(
        "[trace:%s] POST /ask will call %s",
        request_id,
        _callable_location(ask_question),
    )
    result = ask_question(
        question.question,
        history,
        trace_id=request_id,
    )
    logger.info(
        "[trace:%s] POST /ask return answer_chars=%s revision_chars=%s sources=%s confidence_mode=%s",
        request_id,
        len(result.get("answer", "")),
        len(result.get("revision", "") or ""),
        len(result.get("sources", []) or []),
        (result.get("confidence") or {}).get("mode"),
    )

    return {
        "answer": result["answer"],
        "revision": result.get("revision", ""),
        "sources": result["sources"],
        "confidence": result.get("confidence"),
    }


def _sse_event(event: str, data):
    return (
        f"event: {event}\n"
        f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
    )


@app.post("/ask/stream")
async def ask_stream(question: Question, request: Request):
    request_id = uuid.uuid4().hex[:10]
    history = [message.model_dump() for message in question.history]
    logger.info(
        "[trace:%s] POST /ask/stream incoming question=%r history_len=%s",
        request_id,
        question.question,
        len(history),
    )
    logger.info(
        "[trace:%s] POST /ask/stream will call %s",
        request_id,
        _callable_location(stream_answer),
    )

    async def event_generator():
        queue = asyncio.Queue()
        stop_event = threading.Event()
        loop = asyncio.get_running_loop()

        def producer():
            def put_item(item):
                future = asyncio.run_coroutine_threadsafe(
                    queue.put(item),
                    loop,
                )
                future.result()

            try:
                for item in stream_answer(
                    question.question,
                    history,
                    stop_event,
                    trace_id=request_id,
                ):
                    if stop_event.is_set():
                        logger.info(
                            "[trace:%s] POST /ask/stream producer stopped before enqueue",
                            request_id,
                        )
                        break

                    put_item(item)
            except Exception as error:
                logger.warning(
                    "[trace:%s] Streaming producer failed: %s",
                    request_id,
                    error,
                )
                put_item(
                    {
                        "type": "error",
                        "message": (
                            "Unable to get an answer right now. "
                            "Please try again."
                        ),
                    }
                )
            finally:
                put_item(None)

        thread = threading.Thread(target=producer, daemon=True)
        thread.start()

        try:
            logger.info(
                "[trace:%s] POST /ask/stream send event=thinking",
                request_id,
            )
            yield _sse_event("thinking", {"message": "Thinking..."})

            while True:
                if await request.is_disconnected():
                    logger.info(
                        "[trace:%s] POST /ask/stream client disconnected",
                        request_id,
                    )
                    stop_event.set()
                    break

                try:
                    item = await asyncio.wait_for(queue.get(), timeout=0.5)
                except asyncio.TimeoutError:
                    continue

                if item is None:
                    logger.info(
                        "[trace:%s] POST /ask/stream producer completed",
                        request_id,
                    )
                    break

                item_type = item.get("type")

                if item_type == "chunk":
                    logger.info(
                        "[trace:%s] POST /ask/stream send event=chunk chars=%s",
                        request_id,
                        len(item.get("text", "") or ""),
                    )
                    yield _sse_event("chunk", {"text": item.get("text", "")})
                elif item_type == "metadata":
                    logger.info(
                        "[trace:%s] POST /ask/stream send event=metadata sources=%s revision_chars=%s confidence_mode=%s",
                        request_id,
                        len(item.get("sources", []) or []),
                        len(item.get("revision", "") or ""),
                        (item.get("confidence") or {}).get("mode"),
                    )
                    yield _sse_event(
                        "metadata",
                        {
                            "sources": item.get("sources", []),
                            "revision": item.get("revision", ""),
                            "confidence": item.get("confidence"),
                        },
                    )
                elif item_type == "error":
                    logger.info(
                        "[trace:%s] POST /ask/stream send event=error message=%r",
                        request_id,
                        item.get("message", "Unable to get an answer right now."),
                    )
                    yield _sse_event(
                        "error",
                        {
                            "message": item.get(
                                "message",
                                "Unable to get an answer right now.",
                            )
                        },
                    )
        finally:
            stop_event.set()
            logger.info(
                "[trace:%s] POST /ask/stream generator closing",
                request_id,
            )

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/library", dependencies=[Depends(require_admin)])
async def library(query: str = Query(default="")):
    return await run_in_threadpool(get_library, query)


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


def _run_reindex(force: bool = False):
    try:
        result = ingest_library(force=force)
        finished_at = datetime.now(timezone.utc).isoformat()

        with indexing_state_lock:
            indexing_state["running"] = False
            indexing_state["finishedAt"] = finished_at
            indexing_state["lastResult"] = result

            if result.get("success"):
                indexing_state["lastSuccessfulAt"] = finished_at

        return result
    except Exception as error:
        logger.error(
            "Library re-index failed. Verify PDFs in knowledge/, "
            "Chroma database path, and embedding model availability. "
            "Error: %s",
            error,
        )
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
    return await reindex_library_with_options(force=False)


@app.post(
    "/admin/library/reindex/changed",
    dependencies=[Depends(require_admin)],
)
async def reindex_changed_library():
    return await reindex_library_with_options(force=False)


@app.post(
    "/admin/library/reindex/all",
    dependencies=[Depends(require_admin)],
)
async def reindex_all_library():
    return await reindex_library_with_options(force=True)


async def reindex_library_with_options(force: bool = False):
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
        return await run_in_threadpool(_run_reindex, force)
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
        "collectionExists": library_status["collectionExists"],
        "collectionName": library_status["collectionName"],
        "databasePath": library_status["databasePath"],
        "ready": library_status["ready"],
        "libraryBooks": library_status["libraryBooks"],
        "libraryChunks": library_status["libraryChunks"],
        "lastIndexed": last_indexed,
        "environment": os.getenv("APP_ENV", "local"),
    }
