from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import logging
import re
import unicodedata
import uuid

import chromadb
from pypdf import PdfReader


logger = logging.getLogger(__name__)
PROJECT_ROOT = Path(__file__).resolve().parent
KNOWLEDGE_ROOT = PROJECT_ROOT / "knowledge"
DATABASE_PATH = PROJECT_ROOT / "db"
COLLECTION_NAME = "assamwork"
MAX_PDF_SIZE = 50 * 1024 * 1024
METADATA_PATH = DATABASE_PATH / "library_metadata.json"
HASH_CHUNK_SIZE = 1024 * 1024


class LibraryValidationError(ValueError):
    pass


def _utc_now_iso():
    return datetime.now(timezone.utc).isoformat()


def _book_key(subject: str, book: str):
    return f"{subject}/{book}"


def _load_metadata():
    if not METADATA_PATH.exists():
        return {"books": {}}

    try:
        with METADATA_PATH.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, json.JSONDecodeError) as error:
        logger.warning("Unable to read library metadata: %s", error)
        return {"books": {}}

    if not isinstance(payload, dict):
        return {"books": {}}

    books = payload.get("books")

    if not isinstance(books, dict):
        payload["books"] = {}

    return payload


def _save_metadata(metadata: dict):
    DATABASE_PATH.mkdir(parents=True, exist_ok=True)
    temp_path = METADATA_PATH.with_suffix(".json.tmp")

    with temp_path.open("w", encoding="utf-8") as handle:
        json.dump(metadata, handle, ensure_ascii=False, indent=2, sort_keys=True)

    temp_path.replace(METADATA_PATH)


def _file_hash(path: Path):
    digest = hashlib.sha256()

    with path.open("rb") as handle:
        while True:
            chunk = handle.read(HASH_CHUNK_SIZE)

            if not chunk:
                break

            digest.update(chunk)

    return digest.hexdigest()


def _pdf_page_count(path: Path):
    try:
        return len(PdfReader(path).pages)
    except Exception as error:
        logger.warning("Unable to read page count for '%s': %s", path, error)
        return None


def _pdf_fingerprint(path: Path):
    stat = path.stat()

    return {
        "file_hash": _file_hash(path),
        "file_size": stat.st_size,
        "modified_at": datetime.fromtimestamp(
            stat.st_mtime,
            tz=timezone.utc,
        ).isoformat(),
        "page_count": _pdf_page_count(path),
    }


def _iter_pdfs():
    if not KNOWLEDGE_ROOT.exists():
        return []

    return sorted(
        (
            path
            for path in KNOWLEDGE_ROOT.glob("*/*")
            if path.is_file() and path.suffix.lower() == ".pdf"
        ),
        key=lambda path: (
            path.parent.name.lower(),
            path.name.lower(),
        ),
    )


def _find_duplicate_pdf(file_hash: str, exclude_path: Path | None = None):
    exclude_resolved = exclude_path.resolve() if exclude_path else None

    for pdf in _iter_pdfs():
        if exclude_resolved and pdf.resolve() == exclude_resolved:
            continue

        try:
            if _file_hash(pdf) == file_hash:
                return pdf
        except OSError:
            continue

    return None


def _sync_pdf_metadata(
    metadata: dict,
    pdf: Path,
    uploaded_at: str | None = None,
):
    subject = pdf.parent.name or "Unknown subject"
    book = pdf.name
    key = _book_key(subject, book)
    fingerprint = _pdf_fingerprint(pdf)
    books = metadata.setdefault("books", {})
    existing = books.get(key) or {}
    content_changed = (
        bool(existing)
        and (
            existing.get("file_hash") != fingerprint["file_hash"]
            or existing.get("file_size") != fingerprint["file_size"]
        )
    )

    if not existing:
        record = {
            "book_id": uuid.uuid4().hex,
            "version": 1,
            "subject": subject,
            "book": book,
            "filename": book,
            "file_hash": fingerprint["file_hash"],
            "file_size": fingerprint["file_size"],
            "modified_at": fingerprint["modified_at"],
            "uploaded_at": uploaded_at or _uploaded_at(pdf),
            "indexed_at": None,
            "previous_version_id": None,
            "page_count": fingerprint["page_count"],
            "questions_answered": 0,
            "last_used_at": None,
            "indexing_errors": [],
        }
    else:
        record = {
            **existing,
            "subject": subject,
            "book": book,
            "filename": book,
            "file_hash": fingerprint["file_hash"],
            "file_size": fingerprint["file_size"],
            "modified_at": fingerprint["modified_at"],
            "page_count": fingerprint["page_count"],
        }

        if content_changed:
            record["previous_version_id"] = existing.get("book_id")
            record["book_id"] = uuid.uuid4().hex
            record["version"] = int(existing.get("version") or 1) + 1
            record["indexed_at"] = None
            record["indexing_errors"] = []

        if uploaded_at and not record.get("uploaded_at"):
            record["uploaded_at"] = uploaded_at

    books[key] = record
    return record


def sync_library_metadata():
    metadata = _load_metadata()
    books = metadata.setdefault("books", {})
    available_keys = set()

    for pdf in _iter_pdfs():
        subject = pdf.parent.name or "Unknown subject"
        book = pdf.name
        available_keys.add(_book_key(subject, book))
        _sync_pdf_metadata(metadata, pdf)

    for key in list(books.keys()):
        if key not in available_keys:
            books.pop(key, None)

    _save_metadata(metadata)
    return metadata


def get_book_metadata(subject: str, book: str):
    metadata = sync_library_metadata()
    return metadata.get("books", {}).get(_book_key(subject, book))


def mark_book_indexed(subject: str, book: str, chunks: int):
    metadata = sync_library_metadata()
    key = _book_key(subject, book)
    record = metadata.get("books", {}).get(key)

    if not record:
        return None

    record["indexed_at"] = _utc_now_iso()
    record["chunks"] = chunks
    record["indexing_errors"] = []
    _save_metadata(metadata)
    return record


def mark_book_index_error(subject: str, book: str, error: str):
    metadata = sync_library_metadata()
    key = _book_key(subject, book)
    record = metadata.get("books", {}).get(key)

    if not record:
        return None

    record["indexing_errors"] = [error]
    _save_metadata(metadata)
    return record


def record_book_usage(sources):
    if not sources:
        return

    metadata = sync_library_metadata()
    books = metadata.setdefault("books", {})
    now = _utc_now_iso()
    changed = False
    seen = set()

    for source in sources:
        subject = source.get("subject")
        book = source.get("book") or source.get("filename")

        if not subject or not book:
            continue

        key = _book_key(subject, book)

        if key in seen:
            continue

        seen.add(key)
        record = books.get(key)

        if not record:
            continue

        record["questions_answered"] = int(
            record.get("questions_answered") or 0
        ) + 1
        record["last_used_at"] = now
        changed = True

    if changed:
        _save_metadata(metadata)


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
    digest = hashlib.sha256()

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
                digest.update(chunk)

                if total_size > MAX_PDF_SIZE:
                    raise LibraryValidationError(
                        "PDF must be 50 MB or smaller."
                    )

                destination.write(chunk)

        if total_size == 0:
            raise LibraryValidationError("The selected PDF is empty.")

        file_hash = digest.hexdigest()
        duplicate = _find_duplicate_pdf(file_hash, exclude_path=candidate)

        if duplicate:
            raise LibraryValidationError(
                f"This PDF already exists as {duplicate.name}."
            )

        metadata = _load_metadata()
        uploaded_at = _utc_now_iso()
        record = _sync_pdf_metadata(metadata, candidate, uploaded_at=uploaded_at)
        _save_metadata(metadata)
    except Exception:
        candidate.unlink(missing_ok=True)

        try:
            candidate.parent.rmdir()
        except OSError:
            pass

        raise

    return {
        "subject": safe_subject,
        "book": candidate.name,
        "filename": candidate.name,
        "book_id": record["book_id"],
        "version": record["version"],
        "file_hash": record["file_hash"],
        "pageCount": record.get("page_count"),
        "chunks": None,
        "uploadedAt": record.get("uploaded_at"),
        "status": "uploaded_pending_ingestion",
    }


def delete_pdf(subject: str, book: str):
    _, _, _, book_path = _safe_pdf_path(subject, book)

    if not book_path.is_file():
        raise FileNotFoundError("Ebook was not found.")

    book_path.unlink()
    metadata = _load_metadata()
    metadata.get("books", {}).pop(_book_key(subject, book), None)
    _save_metadata(metadata)

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


def get_library(query: str = ""):
    return get_library_books(query)


def _normalize_text(value: str):
    return re.sub(r"\s+", " ", (value or "").lower()).strip()


def _preview_text(document: str, query: str):
    clean = re.sub(r"\s+", " ", document or "").strip()
    normalized_clean = clean.lower()
    normalized_query = query.lower().strip()
    index = normalized_clean.find(normalized_query)

    if index == -1:
        return clean[:180]

    start = max(index - 70, 0)
    end = min(index + len(normalized_query) + 110, len(clean))
    prefix = "..." if start > 0 else ""
    suffix = "..." if end < len(clean) else ""

    return f"{prefix}{clean[start:end]}{suffix}"


def _collection_book_stats(query: str = ""):
    chunk_counts = Counter()
    chunk_sizes = Counter()
    missing_page_metadata = Counter()
    documents_by_book = {}
    matches_by_book = {}
    collection_exists = False

    try:
        client = chromadb.PersistentClient(path=str(DATABASE_PATH))
        collection = client.get_collection(name=COLLECTION_NAME)
        result = collection.get(include=["documents", "metadatas"])
        collection_exists = True

        ids = result.get("ids") or []
        documents = result.get("documents") or []
        metadatas = result.get("metadatas") or []
        normalized_query = query.lower().strip()

        for index, metadata in enumerate(metadatas):
            metadata = metadata or {}
            subject = metadata.get("subject") or "Unknown subject"
            book = metadata.get("book") or "Unknown book"
            key = (subject, book)
            document = documents[index] if index < len(documents) else ""
            chunk_counts[key] += 1
            chunk_sizes[key] += len(document or "")
            documents_by_book.setdefault(key, []).append(_normalize_text(document))

            if metadata.get("display_page") in (None, ""):
                missing_page_metadata[key] += 1

            if (
                normalized_query
                and normalized_query in _normalize_text(document)
                and len(matches_by_book.get(key, [])) < 3
            ):
                matches_by_book.setdefault(key, []).append(
                    {
                        "type": "content",
                        "book": book,
                        "subject": subject,
                        "filename": metadata.get("filename") or book,
                        "page": metadata.get("display_page"),
                        "chunkId": (
                            metadata.get("chunk_id")
                            or (ids[index] if index < len(ids) else None)
                        ),
                        "preview": _preview_text(document, query),
                    }
                )
    except Exception as error:
        # The knowledge folder can still provide a useful read-only library
        # response when Chroma is unavailable or has not been created yet.
        logger.warning(
            "Chroma collection '%s' is unavailable at '%s'. "
            "Library list will be shown from PDFs only. Error: %s",
            COLLECTION_NAME,
            DATABASE_PATH,
            error,
        )
        chunk_counts = Counter()
        chunk_sizes = Counter()
        missing_page_metadata = Counter()
        documents_by_book = {}
        matches_by_book = {}

    duplicate_chunks = Counter()

    for key, documents in documents_by_book.items():
        counts = Counter(documents)
        duplicate_chunks[key] = sum(
            count - 1
            for document, count in counts.items()
            if document and count > 1
        )

    return {
        "collectionExists": collection_exists,
        "chunkCounts": chunk_counts,
        "chunkSizes": chunk_sizes,
        "missingPageMetadata": missing_page_metadata,
        "duplicateChunks": duplicate_chunks,
        "matches": matches_by_book,
    }


def get_library_books(query: str = ""):
    metadata = sync_library_metadata()
    books_metadata = metadata.get("books", {})
    collection_stats = _collection_book_stats(query)
    chunk_counts = collection_stats["chunkCounts"]
    normalized_query = query.lower().strip()
    books = {}

    if KNOWLEDGE_ROOT.exists():
        for pdf in _iter_pdfs():
            if not pdf.is_file() or pdf.suffix.lower() != ".pdf":
                continue

            subject = pdf.parent.name or "Unknown subject"
            key = (subject, pdf.name)
            metadata_key = _book_key(subject, pdf.name)
            record = books_metadata.get(metadata_key) or {}
            chunk_count = chunk_counts.get(key, 0)
            total_chunk_size = collection_stats["chunkSizes"].get(key, 0)
            average_chunk_size = (
                round(total_chunk_size / chunk_count)
                if chunk_count
                else 0
            )
            matches = list(collection_stats["matches"].get(key, []))
            metadata_search = " ".join(
                [
                    subject,
                    pdf.name,
                    record.get("filename") or pdf.name,
                ]
            ).lower()

            if normalized_query and normalized_query in metadata_search:
                matches.insert(
                    0,
                    {
                        "type": "metadata",
                        "book": pdf.name,
                        "subject": subject,
                        "filename": record.get("filename") or pdf.name,
                        "page": None,
                        "chunkId": None,
                        "preview": (
                            "Matched subject, book title, or filename."
                        ),
                    },
                )

            if normalized_query and not matches:
                continue

            books[key] = {
                "subject": subject,
                "book": pdf.name,
                "filename": record.get("filename") or pdf.name,
                "book_id": record.get("book_id"),
                "version": record.get("version") or 1,
                "currentVersion": record.get("version") or 1,
                "fileHash": record.get("file_hash"),
                "fileSize": record.get("file_size"),
                "uploadedAt": record.get("uploaded_at") or _uploaded_at(pdf),
                "modifiedAt": record.get("modified_at"),
                "indexedAt": record.get("indexed_at"),
                "lastIndexedAt": record.get("indexed_at"),
                "previousVersionId": record.get("previous_version_id"),
                "pageCount": record.get("page_count"),
                "chunks": chunk_count if chunk_count else None,
                "questionsAnswered": int(
                    record.get("questions_answered") or 0
                ),
                "lastUsedAt": record.get("last_used_at"),
                "accuracy": "Not measured",
                "health": {
                    "totalChunks": chunk_count,
                    "averageChunkSize": average_chunk_size,
                    "missingEmbeddings": "Not measured",
                    "duplicateChunks": collection_stats[
                        "duplicateChunks"
                    ].get(key, 0),
                    "indexingErrors": record.get("indexing_errors") or [],
                    "missingPageMetadata": collection_stats[
                        "missingPageMetadata"
                    ].get(key, 0),
                },
                "searchMatches": matches[:4],
                "status": (
                    "Indexed"
                    if chunk_count > 0
                    else (
                        "Not indexed"
                        if collection_stats["collectionExists"]
                        else "Not indexed"
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
    books_count = len(_iter_pdfs())
    chroma_status = "collection_missing"
    chunks = 0
    collection_exists = False
    ready = False

    try:
        client = chromadb.PersistentClient(path=str(DATABASE_PATH))
        collection = client.get_collection(name=COLLECTION_NAME)
        chunks = collection.count()
        collection_exists = True
        ready = chunks > 0
        chroma_status = "ready" if ready else "not_indexed"
    except Exception as error:
        logger.warning(
            "Chroma collection '%s' is missing or unavailable at '%s'. "
            "Run admin re-index to recreate it. Error: %s",
            COLLECTION_NAME,
            DATABASE_PATH,
            error,
        )

    return {
        "libraryBooks": books_count,
        "libraryChunks": chunks,
        "chroma": chroma_status,
        "collectionName": COLLECTION_NAME,
        "collectionExists": collection_exists,
        "databasePath": str(DATABASE_PATH),
        "ready": ready,
    }
