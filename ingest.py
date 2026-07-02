from pathlib import Path

import chromadb
from chromadb.utils.embedding_functions import (
    SentenceTransformerEmbeddingFunction,
)
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader


PROJECT_ROOT = Path(__file__).resolve().parent
KNOWLEDGE_ROOT = PROJECT_ROOT / "knowledge"
DATABASE_PATH = PROJECT_ROOT / "db"
COLLECTION_NAME = "assamwork"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
UPSERT_BATCH_SIZE = 100


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


def _extract_text(pdf: Path):
    reader = PdfReader(pdf)
    pages = []

    for page in reader.pages:
        page_text = page.extract_text()

        if page_text:
            pages.append(page_text)

    return "\n".join(pages)


def _chunk_id(subject: str, book: str, index: int):
    return f"{subject}_{Path(book).stem}_{index}"


def ingest_library():
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
    books_processed = 0
    chunks_added = 0
    errors = []

    for pdf in pdf_files:
        subject = pdf.parent.name
        book = pdf.name

        try:
            text = _extract_text(pdf)
            chunks = splitter.split_text(text)

            if not chunks:
                raise ValueError("No extractable text was found.")

            ids = [
                _chunk_id(subject, book, index)
                for index in range(len(chunks))
            ]
            metadatas = [
                {
                    "subject": subject,
                    "book": book,
                }
                for _ in chunks
            ]

            for start in range(0, len(chunks), UPSERT_BATCH_SIZE):
                end = start + UPSERT_BATCH_SIZE
                collection.upsert(
                    ids=ids[start:end],
                    documents=chunks[start:end],
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
        except Exception as error:
            errors.append(
                {
                    "subject": subject,
                    "book": book,
                    "error": str(error),
                }
            )

    if not pdf_files:
        message = "No PDF ebooks were found in the knowledge library."
    elif errors:
        message = (
            f"Indexed {books_processed} of {len(pdf_files)} ebook(s). "
            f"{len(errors)} ebook(s) failed."
        )
    else:
        message = (
            f"Library indexed successfully. "
            f"{books_processed} ebook(s) processed."
        )

    return {
        "success": len(errors) == 0,
        "message": message,
        "booksProcessed": books_processed,
        "chunksAdded": chunks_added,
        "errors": errors,
    }


def main():
    result = ingest_library()

    print("\n===============================")
    print(result["message"])
    print(f"Books processed : {result['booksProcessed']}")
    print(f"Chunks indexed  : {result['chunksAdded']}")

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
