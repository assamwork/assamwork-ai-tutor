from pathlib import Path
import logging

import chromadb
from chromadb.utils.embedding_functions import (
    SentenceTransformerEmbeddingFunction,
)
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader

from library import (
    get_book_metadata,
    mark_book_index_error,
    mark_book_indexed,
    sync_library_metadata,
)


PROJECT_ROOT = Path(__file__).resolve().parent
KNOWLEDGE_ROOT = PROJECT_ROOT / "knowledge"
DATABASE_PATH = PROJECT_ROOT / "db"
COLLECTION_NAME = "assamwork"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
UPSERT_BATCH_SIZE = 100
logger = logging.getLogger(__name__)


def _pdf_files():
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


def _extract_pages(pdf: Path):
    reader = PdfReader(pdf)
    page_labels = list(getattr(reader, "page_labels", []) or [])
    pages = []

    for index, page in enumerate(reader.pages):
        page_text = page.extract_text()

        if page_text:
            source_page_label = (
                str(page_labels[index]).strip()
                if index < len(page_labels) and page_labels[index]
                else ""
            )
            display_page = (
                int(source_page_label)
                if source_page_label.isdigit()
                else source_page_label or index + 1
            )
            pages.append(
                {
                    "pdf_page_index": index,
                    "display_page": display_page,
                    "source_page_label": source_page_label,
                    "text": page_text,
                }
            )

    return pages


def _chunk_id(subject: str, book: str, pdf_page_index: int, index: int):
    return f"{subject}_{Path(book).stem}_pi{pdf_page_index}_c{index}"


def _delete_missing_pdf_chunks(collection, pdf_files):
    available_books = {
        (pdf.parent.name, pdf.name)
        for pdf in pdf_files
    }
    existing = collection.get(include=["metadatas"])
    stale_ids = []

    for chunk_id, metadata in zip(
        existing.get("ids") or [],
        existing.get("metadatas") or [],
    ):
        metadata = metadata or {}

        if (metadata.get("subject"), metadata.get("book")) not in available_books:
            stale_ids.append(chunk_id)

    for start in range(0, len(stale_ids), UPSERT_BATCH_SIZE):
        collection.delete(ids=stale_ids[start:start + UPSERT_BATCH_SIZE])

    return len(stale_ids)


def _existing_book_chunk_count(collection, subject: str, book: str):
    try:
        existing = collection.get(
            where={
                "$and": [
                    {"subject": subject},
                    {"book": book},
                ]
            },
            include=[],
        )
    except Exception:
        return 0

    return len(existing.get("ids") or [])


def _delete_book_chunks(collection, subject: str, book: str):
    existing = collection.get(
        where={
            "$and": [
                {"subject": subject},
                {"book": book},
            ]
        },
        include=[],
    )
    ids = existing.get("ids") or []

    for start in range(0, len(ids), UPSERT_BATCH_SIZE):
        collection.delete(ids=ids[start:start + UPSERT_BATCH_SIZE])

    return len(ids)


def ingest_library(force: bool = False):
    logger.info(
        "Starting AssamWork library ingestion. Database path: %s, "
        "collection: %s",
        DATABASE_PATH,
        COLLECTION_NAME,
    )
    embedding_function = SentenceTransformerEmbeddingFunction(
        model_name=EMBEDDING_MODEL
    )
    client = chromadb.PersistentClient(path=str(DATABASE_PATH))
    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=embedding_function,
    )
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
    )

    pdf_files = _pdf_files()
    sync_library_metadata()
    books_processed = 0
    books_skipped = 0
    chunks_added = 0
    chunks_deleted = _delete_missing_pdf_chunks(collection, pdf_files)
    errors = []

    for pdf in pdf_files:
        subject = pdf.parent.name
        book = pdf.name

        try:
            book_metadata = get_book_metadata(subject, book) or {}
            existing_chunk_count = _existing_book_chunk_count(
                collection,
                subject,
                book,
            )
            needs_index = (
                force
                or not book_metadata.get("indexed_at")
                or existing_chunk_count == 0
            )

            if not needs_index:
                books_skipped += 1
                logger.info(
                    "Skipping unchanged ebook '%s' under subject '%s'.",
                    book,
                    subject,
                )
                continue

            pages = _extract_pages(pdf)
            chunks = []

            for page in pages:
                for chunk in splitter.split_text(page["text"]):
                    chunks.append(
                        {
                            "text": chunk,
                            "pdf_page_index": page["pdf_page_index"],
                            "display_page": page["display_page"],
                            "source_page_label": page["source_page_label"],
                        }
                    )

            if not chunks:
                raise ValueError("No extractable text was found.")

            chunks_deleted += _delete_book_chunks(collection, subject, book)
            ids = [
                _chunk_id(subject, book, chunk["pdf_page_index"], index)
                for index, chunk in enumerate(chunks)
            ]
            documents = [chunk["text"] for chunk in chunks]
            metadatas = [
                {
                    "subject": subject,
                    "book": book,
                    "filename": book,
                    "chunk_id": ids[index],
                    "pdf_page_index": chunk["pdf_page_index"],
                    "display_page": chunk["display_page"],
                    "source_page_label": chunk["source_page_label"],
                }
                for index, chunk in enumerate(chunks)
            ]

            for start in range(0, len(chunks), UPSERT_BATCH_SIZE):
                end = start + UPSERT_BATCH_SIZE
                collection.upsert(
                    ids=ids[start:end],
                    documents=documents[start:end],
                    metadatas=metadatas[start:end],
                )

            existing = collection.get(
                where={
                    "$and": [
                        {"subject": subject},
                        {"book": book},
                    ]
                },
                include=[],
            )
            stale_ids = list(set(existing.get("ids") or []) - set(ids))

            if stale_ids:
                collection.delete(ids=stale_ids)

            books_processed += 1
            chunks_added += len(chunks)
            mark_book_indexed(subject, book, len(chunks))
        except Exception as error:
            logger.error(
                "Failed to index ebook '%s' under subject '%s'. "
                "Verify the PDF is readable and contains extractable text. "
                "Error: %s",
                book,
                subject,
                error,
            )
            errors.append(
                {
                    "subject": subject,
                    "book": book,
                    "error": str(error),
                }
            )
            mark_book_index_error(subject, book, str(error))

    if not pdf_files:
        message = "No PDF ebooks were found in the knowledge library."
    elif errors:
        message = (
            f"Indexed {books_processed} of {len(pdf_files)} ebook(s). "
            f"{books_skipped} unchanged ebook(s) skipped. "
            f"{len(errors)} ebook(s) failed."
        )
    else:
        message = (
            f"Library indexed successfully. "
            f"{books_processed} ebook(s) processed, "
            f"{books_skipped} unchanged ebook(s) skipped."
        )

    return {
        "success": len(errors) == 0,
        "message": message,
        "booksProcessed": books_processed,
        "booksSkipped": books_skipped,
        "chunksAdded": chunks_added,
        "chunksDeleted": chunks_deleted,
        "force": force,
        "errors": errors,
    }


def main():
    result = ingest_library()

    print("\n===============================")
    print(result["message"])
    print(f"Books processed : {result['booksProcessed']}")
    print(f"Books skipped   : {result['booksSkipped']}")
    print(f"Chunks indexed  : {result['chunksAdded']}")
    print(f"Chunks deleted  : {result['chunksDeleted']}")

    if result["errors"]:
        print("Errors:")

        for error in result["errors"]:
            print(
                f"- {error['subject']} / {error['book']}: "
                f"{error['error']}"
            )

    print("===============================")


if __name__ == "__main__":
    main()
