import os
import threading
import logging
import json
import re

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

CLARIFICATION_MESSAGE = (
    "Please clarify what you want me to refer to, so I can answer "
    "from the AssamWork study materials."
)
GEMINI_FALLBACK_NOTICE = (
    "Note: This topic is not currently covered in AssamWork's uploaded "
    "study materials. The following answer is based on Gemini's general knowledge."
)
STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "about",
    "be",
    "by",
    "can",
    "could",
    "for",
    "from",
    "give",
    "how",
    "in",
    "into",
    "is",
    "it",
    "its",
    "me",
    "make",
    "of",
    "on",
    "or",
    "please",
    "s",
    "should",
    "tell",
    "the",
    "this",
    "that",
    "to",
    "was",
    "were",
    "what",
    "when",
    "where",
    "which",
    "who",
    "why",
    "would",
}
INTENT_WORDS = {
    "achievement",
    "achievements",
    "describe",
    "detail",
    "discuss",
    "elaborate",
    "example",
    "examples",
    "explain",
    "mcq",
    "mcqs",
    "note",
    "notes",
    "quiz",
    "revision",
    "summarize",
}


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


def _parse_query_rewrite(response_text: str, fallback_question: str):
    try:
        payload = json.loads(response_text or "{}")
    except json.JSONDecodeError:
        return {
            "standalone_question": fallback_question,
            "clarification_needed": False,
            "clarification": "",
        }

    standalone_question = str(
        payload.get("standalone_question") or fallback_question
    ).strip()
    clarification = str(payload.get("clarification") or "").strip()

    return {
        "standalone_question": standalone_question or fallback_question,
        "clarification_needed": bool(payload.get("clarification_needed")),
        "clarification": clarification,
    }


def _normalize_history(history=None):
    normalized = []

    for message in (history or [])[-5:]:
        role = str(message.get("role") or "").strip().lower()
        content = str(message.get("content") or "").strip()

        if role not in {"user", "assistant"} or not content:
            continue

        normalized.append(
            {
                "role": role,
                "content": content[:900],
            }
        )

    return normalized


def _history_text(history):
    if not history:
        return "No prior conversation."

    return "\n".join(
        f"{message['role'].title()}: {message['content']}"
        for message in history
    )


def _tokenize(value: str):
    return [
        token
        for token in re.findall(r"[a-zA-Z0-9]+", value.lower())
        if token and token not in STOPWORDS
    ]


def _important_query_terms(question: str):
    return [
        token
        for token in _tokenize(question)
        if token not in INTENT_WORDS
    ]


def _unique_terms(terms):
    unique = []
    seen = set()

    for term in terms:
        if term in seen:
            continue

        seen.add(term)
        unique.append(term)

    return unique


def _is_definition_question(question: str):
    normalized = question.lower().strip()

    return normalized.startswith(
        (
            "who is",
            "what is",
            "who was",
            "what was",
            "what are",
            "define",
            "meaning of",
        )
    )


def _has_definition_signal(question: str, document: str, query_terms):
    unique_terms = _unique_terms(query_terms)

    if len(unique_terms) != 1 or not _is_definition_question(question):
        return False

    term = re.escape(unique_terms[0])
    text = re.sub(r"\s+", " ", (document or "").lower())
    term_first_linking_words = (
        "is",
        "are",
        "was",
        "were",
        "means",
        "refers to",
    )
    term_second_linking_words = (
        "defined as",
        "known as",
        "called",
    )
    term_first_pattern = "|".join(
        re.escape(word)
        for word in term_first_linking_words
    )
    term_second_pattern = "|".join(
        re.escape(word)
        for word in term_second_linking_words
    )

    return bool(
        re.search(rf"\b{term}\b\s+(?:{term_first_pattern})\b", text)
        or re.search(rf"\b(?:{term_second_pattern})\b[^.:\n]*\b{term}\b", text)
    )


def _is_greeting(question: str):
    normalized = re.sub(r"[^a-z\s]", "", question.lower()).strip()

    return normalized in {
        "hello",
        "hi",
        "hey",
        "good morning",
        "good afternoon",
        "good evening",
        "namaste",
    }


def _greeting_answer():
    return (
        "Hello! Ask me anything from AssamWork's uploaded study materials, "
        "and I'll answer with sources when the topic is covered."
    )


def _needs_conversation_context(question: str):
    return bool(
        re.search(
            r"\b(he|his|him|she|her|they|their|it|its|this|that|these|those|above|same)\b",
            question.lower(),
        )
    )


def _rewrite_schema():
    return {
        "type": "object",
        "properties": {
            "standalone_question": {"type": "string"},
            "clarification_needed": {"type": "boolean"},
            "clarification": {"type": "string"},
        },
        "required": [
            "standalone_question",
            "clarification_needed",
            "clarification",
        ],
    }


def _rewrite_prompt(question: str, history):
    return f"""
Rewrite the latest user question into a standalone retrieval query for an ebook-grounded RAG system.

Use the recent conversation only to resolve references such as he, his, this, that, these, it, above, or from this.

Do not answer the question.
Do not add facts that are not implied by the conversation.

If the latest question depends on missing context and cannot be resolved, set clarification_needed to true and provide one short clarification question.

Recent Conversation:
{_history_text(history)}

Latest User Question:
{question}

Return JSON only with this structure:
{{
  "standalone_question": "standalone retrieval query",
  "clarification_needed": false,
  "clarification": ""
}}
"""


def rewrite_question(question: str, history=None):
    normalized_history = _normalize_history(history)

    if not normalized_history:
        if _needs_conversation_context(question):
            return {
                "query": question,
                "clarification": CLARIFICATION_MESSAGE,
            }

        return {
            "query": question,
            "clarification": "",
        }

    try:
        response = get_client().models.generate_content(
            model="gemini-2.5-flash",
            contents=_rewrite_prompt(question, normalized_history),
            config=_json_config(_rewrite_schema()),
        )
        rewrite = _parse_query_rewrite(response.text, question)
    except Exception as error:
        logger.warning("Unable to rewrite follow-up question: %s", error)
        return {
            "query": question,
            "clarification": "",
        }

    if rewrite["clarification_needed"]:
        return {
            "query": rewrite["standalone_question"],
            "clarification": rewrite["clarification"] or CLARIFICATION_MESSAGE,
        }

    return {
        "query": rewrite["standalone_question"],
        "clarification": "",
    }


def _sources_from_metadatas(metadatas):
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

    return sources


def _flatten_query_result(results, key):
    values = results.get(key) or []

    if not values:
        return []

    first = values[0]

    if isinstance(first, list):
        return first

    return values


def _evaluate_retrieval_confidence(question: str, documents, distances=None):
    documents = documents or []
    distances = distances or []
    important_terms = _unique_terms(_important_query_terms(question))

    if not documents:
        return {
            "mode": "gemini_fallback",
            "reason": "no_documents",
            "useful_chunks": 0,
            "document_count": 0,
            "important_terms": important_terms,
        }

    if not important_terms:
        return {
            "mode": "gemini_fallback",
            "reason": "no_search_terms",
            "useful_chunks": 0,
            "document_count": len(documents),
            "important_terms": important_terms,
        }

    useful_chunks = 0
    best_overlap = 0
    combined_terms = set()
    full_match_chunks = 0
    definition_chunks = 0

    for document in documents:
        document_terms = set(_tokenize(document or ""))
        overlap = set(important_terms) & document_terms
        overlap_count = len(overlap)

        if overlap_count:
            useful_chunks += 1
            combined_terms.update(overlap)
            best_overlap = max(best_overlap, overlap_count)

        if important_terms and all(term in document_terms for term in important_terms):
            full_match_chunks += 1

        if _has_definition_signal(question, document or "", important_terms):
            definition_chunks += 1

    unique_term_count = len(set(important_terms))
    supported_terms = sorted(combined_terms)
    numeric_terms = [
        term
        for term in important_terms
        if term.isdigit()
    ]
    numeric_terms_supported = all(
        term in combined_terms
        for term in numeric_terms
    )

    distance_support = False

    numeric_distances = [
        value
        for value in distances
        if isinstance(value, (int, float))
    ]

    if len(numeric_distances) >= 2:
        best_distance = min(numeric_distances)
        average_distance = sum(numeric_distances) / len(numeric_distances)
        distance_support = best_distance < average_distance

    details = {
        "useful_chunks": useful_chunks,
        "document_count": len(documents),
        "important_terms": important_terms,
        "supported_terms": supported_terms,
        "term_coverage": f"{len(combined_terms)}/{unique_term_count}",
        "best_overlap": best_overlap,
        "full_match_chunks": full_match_chunks,
        "definition_chunks": definition_chunks,
        "distance_support": distance_support,
        "numeric_terms_supported": numeric_terms_supported,
    }

    if unique_term_count == 1 and not definition_chunks:
        return {
            "mode": "gemini_fallback",
            "reason": "single_term_lacks_definition_signal",
            **details,
        }

    if not numeric_terms_supported:
        return {
            "mode": "gemini_fallback",
            "reason": "numeric_terms_not_supported",
            **details,
        }

    if definition_chunks or full_match_chunks:
        return {
            "mode": "knowledge_base",
            "reason": "query_terms_supported_in_retrieved_chunks",
            **details,
        }

    required_terms = max(2, unique_term_count - 1)
    has_strong_partial_match = (
        best_overlap >= required_terms
        and len(combined_terms) >= required_terms
        and (useful_chunks > 1 or distance_support)
    )

    if has_strong_partial_match:
        return {
            "mode": "knowledge_base",
            "reason": "strong_partial_query_support",
            **details,
        }

    return {
        "mode": "gemini_fallback",
        "reason": "retrieval_evidence_too_weak",
        **details,
    }


def _log_retrieval_confidence(question: str, confidence: dict, source_count: int):
    logger.info(
        (
            "Retrieval confidence details: mode=%s reason=%s "
            "documents=%s useful_chunks=%s term_coverage=%s "
            "best_overlap=%s full_match_chunks=%s definition_chunks=%s "
            "distance_support=%s candidate_sources=%s query=%s"
        ),
        confidence.get("mode", "unknown"),
        confidence.get("reason", "unknown"),
        confidence.get("document_count", 0),
        confidence.get("useful_chunks", 0),
        confidence.get("term_coverage", "0/0"),
        confidence.get("best_overlap", 0),
        confidence.get("full_match_chunks", 0),
        confidence.get("definition_chunks", 0),
        confidence.get("distance_support", False),
        source_count,
        question,
    )


def _retrieve_context(question: str):
    global _collection

    try:
        collection = get_collection()

        results = collection.query(
            query_texts=[question],
            n_results=5,
            include=["documents", "metadatas", "distances"],
        )
    except KnowledgeBaseNotIndexedError:
        confidence = {
            "mode": "gemini_fallback",
            "reason": "knowledge_base_not_indexed",
            "document_count": 0,
            "useful_chunks": 0,
        }
        _log_retrieval_confidence(question, confidence, 0)

        return {
            "context": "",
            "sources": [],
            "confidence": confidence,
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
        confidence = {
            "mode": "gemini_fallback",
            "reason": "knowledge_base_unavailable",
            "document_count": 0,
            "useful_chunks": 0,
        }
        _log_retrieval_confidence(question, confidence, 0)

        return {
            "context": "",
            "sources": [],
            "confidence": confidence,
        }

    documents = _flatten_query_result(results, "documents")
    metadatas = _flatten_query_result(results, "metadatas")
    distances = _flatten_query_result(results, "distances")

    if not documents:
        confidence = {
            "mode": "gemini_fallback",
            "reason": "no_documents",
            "document_count": 0,
            "useful_chunks": 0,
        }
        _log_retrieval_confidence(question, confidence, 0)

        return {
            "context": "",
            "sources": [],
            "confidence": confidence,
        }

    candidate_sources = _sources_from_metadatas(metadatas)
    confidence = _evaluate_retrieval_confidence(
        question,
        documents,
        distances,
    )
    _log_retrieval_confidence(question, confidence, len(candidate_sources))

    if confidence.get("mode") != "knowledge_base":
        return {
            "context": "",
            "sources": [],
            "confidence": confidence,
        }

    return {
        "context": "\n\n".join(documents),
        "sources": candidate_sources,
        "confidence": confidence,
    }


def _answer_style_instruction(question: str):
    normalized = question.lower().strip()

    if any(
        keyword in normalized
        for keyword in ("mcq", "mcqs", "quiz", "question paper")
    ):
        return (
            "If the user asks for MCQs or a quiz, format the answer as "
            "numbered multiple-choice questions with options and mark the "
            "correct answer."
        )

    if any(
        keyword in normalized
        for keyword in (
            "explain",
            "describe",
            "discuss",
            "elaborate",
            "detail",
            "achievements",
            "achievement",
            "notes",
        )
    ):
        return (
            "For detailed, explain, describe, discuss, notes, or achievement "
            "requests, give a structured answer with concise headings and "
            "bullet points where useful."
        )

    if normalized.startswith(("who is", "what is", "who was", "what was")):
        return (
            "For simple who/what questions, answer in 2-4 short lines. "
            "Do not over-explain."
        )

    return (
        "Keep the answer concise by default. Expand only when the user asks "
        "for detail."
    )


def _answer_prompt(question: str, context: str, retrieval_query: str | None = None):
    retrieval_text = retrieval_query or question

    return f"""
You are AssamWork AI Tutor.

Answer ONLY using the study material below.

If the supplied study material is insufficient, say that the supplied
material does not contain enough information to answer fully.

Use only the supplied study material.
If the answer cannot be fully derived from the supplied context, do not invent facts.
Do not complete missing information from your own knowledge.
Do not add external facts when the supplied material is incomplete.

Study Material:

{context}

Original User Question:

{question}

Standalone Retrieval Query:

{retrieval_text}

Style:

{_answer_style_instruction(question)}

Write in exam-oriented language. Preserve source grounding.
"""


def _general_knowledge_prompt(question: str, retrieval_query: str | None = None):
    retrieval_text = retrieval_query or question

    return f"""
You are AssamWork AI Tutor.

The uploaded AssamWork study materials did not contain sufficient relevant material for this question.

Answer using Gemini's general knowledge.

Do not cite AssamWork study materials.
Do not invent page numbers or references.
Do not mention sources.

Original User Question:

{question}

Standalone Query:

{retrieval_text}

Style:

{_answer_style_instruction(question)}

Write in clear exam-oriented language when useful.
"""


def _fallback_answer_text(answer: str):
    clean_answer = (answer or "No answer returned.").strip()

    return f"{GEMINI_FALLBACK_NOTICE}\n\n{clean_answer}"


def _structured_prompt(
    question: str,
    context: str,
    retrieval_query: str | None = None,
):
    return f"""
{_answer_prompt(question, context, retrieval_query)}

Return JSON only with this structure:
{{
  "answer": "exam-oriented answer text",
  "revision": ["3-5 concise revision bullet points"]
}}

If the supplied study material is insufficient, return:
{{
  "answer": "The supplied AssamWork study material does not contain enough information to answer this fully.",
  "revision": []
}}
"""


def _revision_prompt(question: str, context: str, answer: str):
    return f"""
You are AssamWork AI Tutor.

Using only the study material and completed answer below, create 3-5 concise revision bullet points.

If the answer says the supplied material does not contain enough information,
return an empty revision list.

Study Material:

{context}

Question:

{question}

Completed Answer:

{answer}

Return JSON only with this structure:
{{
  "revision": ["concise revision bullet point"]
}}
"""


def _json_config(schema):
    return types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=schema,
    )


def _answer_schema():
    return {
        "type": "object",
        "properties": {
            "answer": {"type": "string"},
            "revision": {
                "type": "array",
                "items": {"type": "string"},
            },
        },
        "required": ["answer", "revision"],
    }


def _revision_schema():
    return {
        "type": "object",
        "properties": {
            "revision": {
                "type": "array",
                "items": {"type": "string"},
            },
        },
        "required": ["revision"],
    }


def generate_revision(question: str, context: str, answer: str):
    response = get_client().models.generate_content(
        model="gemini-2.5-flash",
        contents=_revision_prompt(question, context, answer),
        config=_json_config(_revision_schema()),
    )

    return _parse_structured_answer(response.text)["revision"]


def generate_general_answer(question: str, retrieval_query: str):
    response = get_client().models.generate_content(
        model="gemini-2.5-flash",
        contents=_general_knowledge_prompt(question, retrieval_query),
    )

    return _fallback_answer_text(response.text)


def _route_question(question: str, history=None):
    if _is_greeting(question):
        logger.info(
            "Mode: Greeting Bypass. Source count returned: 0. Query: %s",
            question,
        )
        return {
            "mode": "greeting",
            "answer": _greeting_answer(),
            "revision": "",
            "sources": [],
            "confidence": None,
            "retrieval_query": question,
            "context": "",
        }

    rewrite = rewrite_question(question, history)

    if rewrite["clarification"]:
        logger.info(
            "Mode: Clarification. Source count returned: 0. Query: %s",
            question,
        )
        return {
            "mode": "clarification",
            "answer": rewrite["clarification"],
            "revision": "",
            "sources": [],
            "confidence": None,
            "retrieval_query": rewrite["query"],
            "context": "",
        }

    retrieval_query = rewrite["query"]
    rag = _retrieve_context(retrieval_query)
    confidence = rag.get("confidence") or {}
    mode = (
        "knowledge_base"
        if confidence.get("mode") == "knowledge_base"
        else "gemini_fallback"
    )
    sources = rag["sources"] if mode == "knowledge_base" else []
    source_count = len(sources)
    log_mode = (
        "Knowledge Base"
        if mode == "knowledge_base"
        else "Gemini Fallback"
    )

    logger.info(
        "Mode: %s. Reason: %s. Source count returned: %s. Query: %s",
        log_mode,
        confidence.get("reason", "unknown"),
        source_count,
        retrieval_query,
    )

    return {
        "mode": mode,
        "answer": "",
        "revision": "",
        "sources": sources,
        "confidence": confidence,
        "retrieval_query": retrieval_query,
        "context": rag["context"] if mode == "knowledge_base" else "",
    }


def stream_answer(
    question: str,
    history=None,
    stop_event: threading.Event | None = None,
):
    route = _route_question(question, history)

    if route["mode"] in {"greeting", "clarification"}:
        yield {
            "type": "chunk",
            "text": route["answer"],
        }
        yield {
            "type": "metadata",
            "sources": [],
            "revision": "",
            "confidence": None,
        }
        return

    retrieval_query = route["retrieval_query"]
    confidence = route.get("confidence") or {}

    if route["mode"] == "gemini_fallback":
        answer_parts = []

        try:
            yield {
                "type": "chunk",
                "text": f"{GEMINI_FALLBACK_NOTICE}\n\n",
            }
            stream = get_client().models.generate_content_stream(
                model="gemini-2.5-flash",
                contents=_general_knowledge_prompt(question, retrieval_query),
            )

            for chunk in stream:
                if stop_event and stop_event.is_set():
                    return

                text = getattr(chunk, "text", "") or ""

                if not text:
                    continue

                answer_parts.append(text)
                yield {
                    "type": "chunk",
                    "text": text,
                }

            if not "".join(answer_parts).strip():
                yield {
                    "type": "chunk",
                    "text": "No answer returned.",
                }

            yield {
                "type": "metadata",
                "sources": [],
                "revision": "",
                "confidence": confidence,
            }
        except Exception as error:
            logger.warning("Unable to stream Gemini fallback answer: %s", error)
            yield {
                "type": "error",
                "message": "Unable to get an answer right now. Please try again.",
            }

        return

    context = route["context"]
    sources = route["sources"]
    answer_parts = []

    try:
        stream = get_client().models.generate_content_stream(
            model="gemini-2.5-flash",
            contents=_answer_prompt(question, context, retrieval_query),
        )

        for chunk in stream:
            if stop_event and stop_event.is_set():
                return

            text = getattr(chunk, "text", "") or ""

            if not text:
                continue

            answer_parts.append(text)
            yield {
                "type": "chunk",
                "text": text,
            }

        answer = "".join(answer_parts).strip()

        if not answer:
            answer = "No answer returned."
            yield {
                "type": "chunk",
                "text": answer,
            }

        revision = ""

        if not (stop_event and stop_event.is_set()):
            try:
                revision = generate_revision(question, context, answer)
            except Exception as error:
                logger.warning("Unable to generate revision metadata: %s", error)

        yield {
            "type": "metadata",
            "sources": sources,
            "revision": revision,
            "confidence": confidence,
        }
    except Exception as error:
        logger.warning("Unable to stream Gemini answer: %s", error)
        yield {
            "type": "error",
            "message": "Unable to get an answer right now. Please try again.",
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


def ask_question(question: str, history=None):
    route = _route_question(question, history)

    if route["mode"] in {"greeting", "clarification"}:
        return {
            "answer": route["answer"],
            "revision": "",
            "sources": [],
        }

    retrieval_query = route["retrieval_query"]

    if route["mode"] == "gemini_fallback":
        return {
            "answer": generate_general_answer(question, retrieval_query),
            "revision": "",
            "sources": [],
        }

    response = get_client().models.generate_content(
        model="gemini-2.5-flash",
        contents=_structured_prompt(
            question,
            route["context"],
            retrieval_query,
        ),
        config=_json_config(_answer_schema()),
    )
    structured_answer = _parse_structured_answer(response.text)

    return {
        "answer": structured_answer["answer"],
        "revision": structured_answer["revision"],
        "sources": route["sources"],
    }
