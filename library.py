from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import chromadb


PROJECT_ROOT = Path(__file__).resolve().parent
KNOWLEDGE_ROOT = PROJECT_ROOT / "knowledge"
DATABASE_PATH = PROJECT_ROOT / "db"
COLLECTION_NAME = "assamwork"


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
        for pdf in KNOWLEDGE_ROOT.glob("*/*.pdf"):
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

    for (subject, book), chunks in chunk_counts.items():
        key = (subject, book)

        if key in books:
            continue

        books[key] = {
            "subject": subject,
            "book": book,
            "chunks": chunks,
            "uploadedAt": None,
            "status": "Indexed",
        }

    return sorted(
        books.values(),
        key=lambda item: (
            item["subject"].lower(),
            item["book"].lower(),
        ),
    )
