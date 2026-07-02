from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
import re
import unicodedata

import chromadb


PROJECT_ROOT = Path(__file__).resolve().parent
KNOWLEDGE_ROOT = PROJECT_ROOT / "knowledge"
DATABASE_PATH = PROJECT_ROOT / "db"
COLLECTION_NAME = "assamwork"
MAX_PDF_SIZE = 50 * 1024 * 1024


class LibraryValidationError(ValueError):
    pass


def _sanitize_subject(value: str):
    subject = unicodedata.normalize("NFKC", value or "").strip()

    if not subject:
        raise LibraryValidationError("Subject is required.")

    if "/" in subject or "\\" in subject or subject in {".", ".."}:
        raise LibraryValidationError("Subject contains invalid characters.")

    subject = re.sub(r"[^\w\s&()'-]", "", subject, flags=re.UNICODE)
    subject = re.sub(r"\s+", " ", subject).strip(" ._-")

    if not subject:
        raise LibraryValidationError("Subject is invalid.")

    return subject[:80].rstrip()


def _sanitize_pdf_name(value: str):
    original_name = unicodedata.normalize("NFKC", value or "").strip()

    if (
        not original_name
        or "/" in original_name
        or "\\" in original_name
    ):
        raise LibraryValidationError("PDF filename is invalid.")

    path = Path(original_name)

    if path.suffix.lower() != ".pdf":
        raise LibraryValidationError("Only PDF files are allowed.")

    stem = re.sub(
        r"[^\w\s&()'-]",
        "",
        path.stem,
        flags=re.UNICODE,
    )
    stem = re.sub(r"\s+", " ", stem).strip(" ._-")

    if not stem:
        stem = "ebook"

    return f"{stem[:120].rstrip()}.pdf"


def _safe_pdf_path(subject: str, book: str):
    safe_subject = _sanitize_subject(subject)
    safe_book = _sanitize_pdf_name(book)
    subject_folder = (KNOWLEDGE_ROOT / safe_subject).resolve()
    book_path = (subject_folder / safe_book).resolve()
    knowledge_root = KNOWLEDGE_ROOT.resolve()

    if (
        subject_folder.parent != knowledge_root
        or book_path.parent != subject_folder
    ):
        raise LibraryValidationError("Invalid knowledge library path.")

    return safe_subject, safe_book, subject_folder, book_path


def save_pdf(file_object, subject: str, filename: str):
    safe_subject = _sanitize_subject(subject)
    safe_filename = _sanitize_pdf_name(filename)
    subject_folder = (KNOWLEDGE_ROOT / safe_subject).resolve()
    knowledge_root = KNOWLEDGE_ROOT.resolve()

    if subject_folder.parent != knowledge_root:
        raise LibraryValidationError("Invalid subject folder.")

    subject_folder.mkdir(parents=True, exist_ok=True)
    stem = Path(safe_filename).stem
    candidate = subject_folder / safe_filename
    suffix = 2

    while True:
        try:
            destination = candidate.open("xb")
            break
        except FileExistsError:
            candidate = subject_folder / f"{stem}_{suffix}.pdf"
            suffix += 1

    total_size = 0
    first_chunk = True

    try:
        with destination:
            while True:
                chunk = file_object.read(1024 * 1024)

                if not chunk:
                    break

                if first_chunk:
                    first_chunk = False

                    if not chunk[:1024].lstrip().startswith(b"%PDF-"):
                        raise LibraryValidationError(
                            "The selected file is not a valid PDF."
                        )

                total_size += len(chunk)

                if total_size > MAX_PDF_SIZE:
                    raise LibraryValidationError(
                        "PDF must be 50 MB or smaller."
                    )

                destination.write(chunk)

        if total_size == 0:
            raise LibraryValidationError("The selected PDF is empty.")
    except Exception:
        candidate.unlink(missing_ok=True)
        raise

    return {
        "subject": safe_subject,
        "book": candidate.name,
        "chunks": None,
        "uploadedAt": _uploaded_at(candidate),
        "status": "uploaded_pending_ingestion",
    }


def delete_pdf(subject: str, book: str):
    _, _, _, book_path = _safe_pdf_path(subject, book)

    if not book_path.is_file():
        raise FileNotFoundError("Ebook was not found.")

    book_path.unlink()

    try:
        book_path.parent.rmdir()
    except OSError:
        pass

    return {
        "deleted": True,
        "vectorCleanup": "pending",
    }


def _uploaded_at(path: Path | None):
    if not path or not path.exists():
        return None

    return datetime.fromtimestamp(
        path.stat().st_mtime,
        tz=timezone.utc,
    ).isoformat()


def get_library():
    chunk_counts = Counter()
    index_available = False

    try:
        client = chromadb.PersistentClient(path=str(DATABASE_PATH))
        collection = client.get_collection(name=COLLECTION_NAME)
        result = collection.get(include=["metadatas"])
        index_available = True

        for metadata in result.get("metadatas") or []:
            metadata = metadata or {}
            subject = metadata.get("subject") or "Unknown subject"
            book = metadata.get("book") or "Unknown book"
            chunk_counts[(subject, book)] += 1
    except Exception:
        # The knowledge folder can still provide a useful read-only library
        # response when Chroma is unavailable or has not been created yet.
        chunk_counts = Counter()

    books = {}

    if KNOWLEDGE_ROOT.exists():
        for pdf in KNOWLEDGE_ROOT.glob("*/*"):
            if not pdf.is_file() or pdf.suffix.lower() != ".pdf":
                continue

            subject = pdf.parent.name or "Unknown subject"
            key = (subject, pdf.name)
            books[key] = {
                "subject": subject,
                "book": pdf.name,
                "chunks": chunk_counts.get(key),
                "uploadedAt": _uploaded_at(pdf),
                "status": (
                    "Indexed"
                    if chunk_counts.get(key, 0) > 0
                    else (
                        "Not indexed"
                        if index_available
                        else "Unknown"
                    )
                ),
            }

    return sorted(
        books.values(),
        key=lambda item: (
            item["subject"].lower(),
            item["book"].lower(),
        ),
    )


def get_library_status():
    books = get_library()
    chroma_status = "unknown"
    chunks = None

    try:
        client = chromadb.PersistentClient(path=str(DATABASE_PATH))
        collection = client.get_collection(name=COLLECTION_NAME)
        chunks = collection.count()
        chroma_status = "ready"
    except Exception:
        pass

    return {
        "libraryBooks": len(books),
        "libraryChunks": chunks,
        "chroma": chroma_status,
    }
