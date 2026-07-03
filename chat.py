import os
import threading
import logging
import json

import chromadb
from dotenv import load_dotenv
from google import genai
from google.genai import types
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

from library import COLLECTION_NAME, DATABASE_PATH

load_dotenv()

logger = logging.getLogger(__name__)
_rag_lock = threading.Lock()
_client = None
_collection = None

KNOWLEDGE_BASE_NOT_INDEXED_ANSWER = (
    "Knowledge base not indexed yet. Please ask an admin to re-index "
    "the AssamWork ebook library, then try again."
)


class KnowledgeBaseNotIndexedError(RuntimeError):
    pass


def _metadata_page(metadata: dict):
    for key in (
        "page",
        "page_number",
        "pageNumber",
        "source_page",
        "pdf_page",
        "page_no",
        "pageNo",
    ):
        value = metadata.get(key)

        if value not in (None, ""):
            return value

    page_index = metadata.get("page_index")

    if page_index not in (None, ""):
        try:
            return int(page_index) + 1
        except (TypeError, ValueError):
            return page_index

    return None


def _parse_structured_answer(response_text: str):
    try:
        payload = json.loads(response_text or "{}")
    except json.JSONDecodeError:
        return {
            "answer": response_text or "No answer returned.",
            "revision": "",
        }

    answer = str(payload.get("answer") or "").strip()
    revision_items = payload.get("revision") or []

    if isinstance(revision_items, str):
        revision = revision_items.strip()
    elif isinstance(revision_items, list):
        revision = "\n".join(
            f"- {str(item).strip()}"
            for item in revision_items
            if str(item).strip()
        )
    else:
        revision = ""

    return {
        "answer": answer or "No answer returned.",
        "revision": revision,
    }


def get_client():
    global _client

    if _client is None:
        _client = genai.Client(
            api_key=os.getenv("GEMINI_API_KEY")
        )

    return _client


def get_collection():
    global _collection

    if _collection is None:
        with _rag_lock:
            if _collection is None:
                embedding_function = SentenceTransformerEmbeddingFunction(
                    model_name="all-MiniLM-L6-v2"
                )
                db = chromadb.PersistentClient(path=str(DATABASE_PATH))

                try:
                    _collection = db.get_collection(
                        name=COLLECTION_NAME,
                        embedding_function=embedding_function,
                    )
                except Exception as error:
                    logger.warning(
                        "Chroma collection '%s' is missing or unavailable "
                        "at '%s'. Run admin re-index to recreate it. Error: %s",
                        COLLECTION_NAME,
                        DATABASE_PATH,
                        error,
                    )
                    raise KnowledgeBaseNotIndexedError(
                        "Knowledge base collection is missing."
                    ) from error

    return _collection


def ask_question(question: str):
    global _collection

    try:
        collection = get_collection()

        results = collection.query(
            query_texts=[question],
            n_results=5,
        )
    except KnowledgeBaseNotIndexedError:
        return {
            "answer": KNOWLEDGE_BASE_NOT_INDEXED_ANSWER,
            "revision": "",
            "sources": [],
        }
    except Exception as error:
        _collection = None
        logger.warning(
            "Unable to query Chroma collection '%s' at '%s'. "
            "Run admin re-index if this persists. Error: %s",
            COLLECTION_NAME,
            DATABASE_PATH,
            error,
        )
        return {
            "answer": KNOWLEDGE_BASE_NOT_INDEXED_ANSWER,
            "revision": "",
            "sources": [],
        }

    documents = results["documents"][0]
    metadatas = results["metadatas"][0]

    if not documents:
        return {
            "answer": "I couldn't find this information in the uploaded AssamWork study materials.",
            "revision": "",
            "sources": [],
        }

    context = "\n\n".join(documents)

    prompt = f"""
You are AssamWork AI Tutor.

Answer ONLY using the study material below.

If the answer is not found, reply exactly:

I couldn't find this information in the uploaded AssamWork study materials.

Do not add any other text when the answer is not found.

Study Material:

{context}

Question:

{question}

Write in exam-oriented language.

Return JSON only with this structure:
{{
  "answer": "exam-oriented answer text",
  "revision": ["3-5 concise revision bullet points"]
}}

If the answer is not found, return:
{{
  "answer": "I couldn't find this information in the uploaded AssamWork study materials.",
  "revision": []
}}
"""

    response = get_client().models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema={
                "type": "object",
                "properties": {
                    "answer": {"type": "string"},
                    "revision": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
                "required": ["answer", "revision"],
            },
        ),
    )
    structured_answer = _parse_structured_answer(response.text)

    sources = []

    for item in metadatas:
        item = item or {}
        page = _metadata_page(item)
        source = {
            "subject": item.get("subject"),
            "book": item.get("book"),
            "page": page,
            "page_number": page,
            "source_page": item.get("source_page") or page,
            "pdf_page": item.get("pdf_page") or page,
        }

        if source not in sources:
            sources.append(source)

    return {
        "answer": structured_answer["answer"],
        "revision": structured_answer["revision"],
        "sources": sources,
    }
