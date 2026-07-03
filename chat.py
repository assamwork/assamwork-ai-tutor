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
from services.ai_service import AIService, AIServiceDependencies
from services.cache_manager import LocalJSONCacheManager

load_dotenv()

logger = logging.getLogger(__name__)
_rag_lock = threading.Lock()
_client = None
_collection = None
_ai_service = None

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
RETRIEVAL_QUERY_ALIASES = (
    (re.compile(r"\bdipor\s+beel\b", re.IGNORECASE), "Deepor Beel"),
)
QUESTION_TYPE_RULES = (
    ("Constitution Article", (
        r"\barticle\s+\d+[a-z]?\b",
        r"\bfundamental rights?\b",
        r"\bdirective principles?\b",
        r"\bdpsp\b",
        r"\bconstitution(?:al)?\b",
    )),
    ("Scheme", (
        r"\bschemes?\b",
        r"\byojana\b",
        r"\bmission\b",
        r"\bprogramme\b",
        r"\bbeneficiar(?:y|ies)\b",
        r"\bministry\b",
        r"\blaunched?\b",
    )),
    ("Battle", (
        r"\bbattle\b",
        r"\bwar\b",
        r"\bconflict\b",
        r"\bsaraighat\b",
    )),
    ("Movement", (
        r"\bmovement\b",
        r"\brevolt\b",
        r"\brebellion\b",
        r"\bsatyagraha\b",
        r"\bquit india\b",
        r"\bnon cooperation\b",
    )),
    ("River", (
        r"\brivers?\b",
        r"\btributar(?:y|ies)\b",
        r"\bbrahmaputra\b",
        r"\bbarak\b",
    )),
    ("Mountain", (
        r"\bmountains?\b",
        r"\bhills?\b",
        r"\bpeaks?\b",
        r"\branges?\b",
    )),
    ("Environment", (
        r"\benvironment\b",
        r"\becology\b",
        r"\bbiodiversity\b",
        r"\bwetlands?\b",
        r"\bramsar\b",
        r"\bnational parks?\b",
        r"\bwildlife\b",
        r"\bpollution\b",
        r"\bclimate\b",
        r"\bconservation\b",
    )),
    ("Geography", (
        r"\bgeography\b",
        r"\blocation\b",
        r"\blocated\b",
        r"\bmap\b",
        r"\bdistrict\b",
        r"\bstate\b",
        r"\bsoil\b",
        r"\bvalley\b",
        r"\bbeel\b",
        r"\blake\b",
    )),
    ("Science", (
        r"\bscience\b",
        r"\bphysics\b",
        r"\bchemistry\b",
        r"\bbiology\b",
        r"\bcells?\b",
        r"\batoms?\b",
        r"\bforce\b",
        r"\benergy\b",
        r"\bphotosynthesis\b",
        r"\bdisease\b",
        r"\bvirus\b",
        r"\bbacteria\b",
    )),
    ("Economy", (
        r"\beconom(?:y|ic|ics)\b",
        r"\bgdp\b",
        r"\binflation\b",
        r"\bbudget\b",
        r"\btax\b",
        r"\bbank(?:ing)?\b",
        r"\bmarket\b",
        r"\bfinance\b",
        r"\brevenue\b",
    )),
    ("Mathematics", (
        r"\bmath(?:s|ematics)?\b",
        r"\bcalculate\b",
        r"\bformula\b",
        r"\bpercentage\b",
        r"\bratio\b",
        r"\bprofit\b",
        r"\bloss\b",
        r"\binterest\b",
        r"\balgebra\b",
    )),
    ("Organization", (
        r"\borganisations?\b",
        r"\borganizations?\b",
        r"\binstitutions?\b",
        r"\bcommittees?\b",
        r"\bcommissions?\b",
        r"\bcouncils?\b",
        r"\bunesco\b",
        r"\basean\b",
        r"\bsaarc\b",
    )),
    ("Person", (
        r"^\s*who\s+(?:is|was)\b",
        r"\bbiograph(?:y|ical)\b",
        r"\bborn\b",
        r"\bleader\b",
        r"\bgeneral\b",
        r"\bking\b",
        r"\bchief minister\b",
        r"\bminister\b",
        r"\bpresident\b",
        r"\bauthor\b",
        r"\bpoet\b",
        r"\bsinger\b",
        r"\bscientist\b",
    )),
    ("Current Affairs", (
        r"\bcurrent affairs?\b",
        r"\brecent\b",
        r"\blatest\b",
        r"\bappointed\b",
        r"\bwon\b",
        r"\b202[4-9]\b",
    )),
    ("History", (
        r"\bhistory\b",
        r"\bdynasty\b",
        r"\bahom\b",
        r"\bancient\b",
        r"\bmedieval\b",
        r"\bmodern\b",
        r"\bkingdom\b",
    )),
)
EXAM_AUDIENCE = (
    "APSC, ADRE, Assam Police, Assam TET, Grade 3, Grade 4, "
    "Guwahati High Court, Class 10, and Class 12"
)
UNIVERSAL_EXAM_STRUCTURE = """
Use this universal Knowledge Base answer structure:

## Introduction
- Maximum 2-3 lines.
- Explain the topic directly.
- No unnecessary history.

## Key Points
- Short bullets.
- Include dates, places, people, provisions, features, and keywords when present.
- Avoid paragraph blocks.

## Detailed Explanation
- Include only when the question needs it.
- Use headings, bullets, tables, or examples.
- Never write one huge paragraph.

## Exam Highlights
- Very important section.
- Include high-yield facts supported by the retrieved material.
- Mention important years, related personalities, related events, map facts,
  articles, institutions, or features only when present in the context.
- Do not claim something is frequently asked in an exam unless the material
  itself supports that.

## Quick Revision
- 5-10 one-line bullets.
- Last-minute notes only.
- Do not copy sentences from the answer.
- Prefer names, years, places, articles, battles, features, and keywords.

## Memory Tricks
- Include only when the retrieved material directly supports a safe memory cue.
- Do not invent mnemonics.

## PYQ / Exam Relevance
- Include only when supported by retrieved material.
- Never hallucinate exam frequency.
"""
EXAM_TEMPLATES = {
    "Person": (
        "## Introduction\n"
        "- 2-3 direct lines.\n\n"
        "## Key Facts\n"
        "- Born\n"
        "- Position\n"
        "- Known For\n"
        "- Important Events / Years\n\n"
        "## Major Contributions\n"
        "- High-yield contributions from the context.\n\n"
        "## Important Years\n"
        "- Include years only if present.\n\n"
        "## Exam Highlights\n"
        "- Scoring facts from the material.\n\n"
        "## Quick Revision\n"
        "- 5-10 one-line facts."
    ),
    "Constitution Article": (
        "## Definition\n"
        "## Features\n"
        "## Importance\n"
        "## Exceptions\n"
        "## Landmark Cases\n"
        "## Exam Highlights\n"
        "## Quick Revision"
    ),
    "Scheme": (
        "## Launch\n"
        "## Ministry\n"
        "## Objectives\n"
        "## Beneficiaries\n"
        "## Features\n"
        "## Exam Highlights\n"
        "## Quick Revision"
    ),
    "Battle": (
        "## Background\n"
        "## Timeline\n"
        "## Leaders\n"
        "## Outcome\n"
        "## Importance\n"
        "## Exam Highlights\n"
        "## Quick Revision"
    ),
    "Movement": (
        "## Background\n"
        "## Timeline\n"
        "## Leaders\n"
        "## Outcome\n"
        "## Importance\n"
        "## Exam Highlights\n"
        "## Quick Revision"
    ),
    "Geography": (
        "## Location\n"
        "## Features\n"
        "## Importance\n"
        "## Map Facts\n"
        "## Exam Highlights\n"
        "## Quick Revision"
    ),
    "River": (
        "## Location / Course\n"
        "## Features\n"
        "## Tributaries / Associated Places\n"
        "## Importance\n"
        "## Map Facts\n"
        "## Exam Highlights\n"
        "## Quick Revision"
    ),
    "Mountain": (
        "## Location\n"
        "## Features\n"
        "## Importance\n"
        "## Map Facts\n"
        "## Exam Highlights\n"
        "## Quick Revision"
    ),
    "Science": (
        "## Definition\n"
        "## Working Principle\n"
        "## Applications\n"
        "## Important Facts\n"
        "## Quick Revision"
    ),
    "Current Affairs": (
        "## Event\n"
        "## Background\n"
        "## Why Important\n"
        "## Exam Relevance\n"
        "## Quick Revision"
    ),
    "Environment": (
        "## Location\n"
        "## Key Features\n"
        "## Importance\n"
        "## Map / Ramsar Facts\n"
        "## Exam Highlights\n"
        "## Quick Revision"
    ),
    "Economy": (
        "## Meaning\n"
        "## Key Points\n"
        "## Data / Institutions\n"
        "## Exam Highlights\n"
        "## Quick Revision"
    ),
    "Organization": (
        "## Overview\n"
        "## Formation / Headquarters\n"
        "## Objectives\n"
        "## Functions\n"
        "## Exam Highlights\n"
        "## Quick Revision"
    ),
    "History": (
        "## Background\n"
        "## Key Facts\n"
        "## Timeline\n"
        "## Importance\n"
        "## Exam Highlights\n"
        "## Quick Revision"
    ),
    "Mathematics": (
        "## Formula / Concept\n"
        "## Steps\n"
        "## Example\n"
        "## Shortcut / Exam Tip\n"
        "## Quick Revision"
    ),
    "General": (
        "## Introduction\n"
        "## Key Points\n"
        "## Detailed Explanation\n"
        "## Exam Highlights\n"
        "## Exam Relevance\n"
        "## Quick Revision"
    ),
}


class KnowledgeBaseNotIndexedError(RuntimeError):
    pass


def _trace(trace_id: str | None, message: str, *args):
    trace_label = trace_id or "-"
    logger.info("[trace:%s] " + message, trace_label, *args)


def _metadata_pdf_page_index(metadata: dict):
    value = metadata.get("pdf_page_index")

    if value in (None, ""):
        value = metadata.get("page_index")

    if value in (None, ""):
        return None

    try:
        return int(value)
    except (TypeError, ValueError):
        return value


def _metadata_display_page(metadata: dict):
    display_page = metadata.get("display_page")

    if display_page not in (None, ""):
        return display_page

    source_page_label = metadata.get("source_page_label")

    if source_page_label not in (None, ""):
        return source_page_label

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

    pdf_page_index = _metadata_pdf_page_index(metadata)

    if pdf_page_index not in (None, ""):
        try:
            return int(pdf_page_index) + 1
        except (TypeError, ValueError):
            return pdf_page_index

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


def _normalize_retrieval_query(query: str):
    normalized_query = query

    for pattern, replacement in RETRIEVAL_QUERY_ALIASES:
        normalized_query = pattern.sub(replacement, normalized_query)

    return normalized_query


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


def rewrite_question(question: str, history=None, trace_id: str | None = None):
    normalized_history = _normalize_history(history)
    _trace(
        trace_id,
        "rewrite start question=%r history_len=%s",
        question,
        len(normalized_history),
    )

    if not normalized_history:
        if _needs_conversation_context(question):
            _trace(
                trace_id,
                "rewrite return clarification_needed query=%r",
                question,
            )
            return {
                "query": question,
                "clarification": CLARIFICATION_MESSAGE,
            }

        _trace(trace_id, "rewrite return original query=%r", question)
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
        _trace(trace_id, "rewrite return original after error query=%r", question)
        return {
            "query": question,
            "clarification": "",
        }

    if rewrite["clarification_needed"]:
        _trace(
            trace_id,
            "rewrite return clarification query=%r clarification=%r",
            rewrite["standalone_question"],
            rewrite["clarification"] or CLARIFICATION_MESSAGE,
        )
        return {
            "query": rewrite["standalone_question"],
            "clarification": rewrite["clarification"] or CLARIFICATION_MESSAGE,
        }

    _trace(
        trace_id,
        "rewrite return standalone query=%r",
        rewrite["standalone_question"],
    )
    return {
        "query": rewrite["standalone_question"],
        "clarification": "",
    }


def _sources_from_metadatas(metadatas):
    sources = []
    seen = set()

    for item in metadatas:
        item = item or {}
        display_page = _metadata_display_page(item)
        source_key = (
            item.get("subject"),
            item.get("book"),
            display_page,
        )

        if source_key in seen:
            continue

        seen.add(source_key)
        source = {
            "subject": item.get("subject"),
            "book": item.get("book"),
            "filename": item.get("filename") or item.get("book"),
            "chunk_id": item.get("chunk_id"),
            "pdf_page_index": _metadata_pdf_page_index(item),
            "display_page": display_page,
            "source_page_label": item.get("source_page_label") or "",
        }

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


def _log_retrieval_confidence(
    question: str,
    confidence: dict,
    source_count: int,
    trace_id: str | None = None,
):
    _trace(
        trace_id,
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


def _distance_score(distance):
    if not isinstance(distance, (int, float)):
        return None

    return round(1 / (1 + max(distance, 0)), 4)


def _log_retrieved_chunks(
    question: str,
    ids,
    documents,
    metadatas,
    distances,
    trace_id: str | None = None,
):
    _trace(
        trace_id,
        "retrieval returned chunks=%s query=%r",
        len(documents or []),
        question,
    )

    for index, document in enumerate(documents or []):
        metadata = (metadatas or [{}])[index] if index < len(metadatas or []) else {}
        distance = (distances or [None])[index] if index < len(distances or []) else None
        chunk_id = (
            metadata.get("chunk_id")
            or ((ids or [None])[index] if index < len(ids or []) else None)
        )
        preview = re.sub(r"\s+", " ", document or "").strip()[:120]
        _trace(
            trace_id,
            (
                "retrieval chunk index=%s raw_distance=%r similarity_score=%r "
                "book=%r chunk_id=%r pdf_page_index=%r display_page=%r "
                "source_page_label=%r preview=%r"
            ),
            index,
            distance,
            _distance_score(distance),
            metadata.get("book"),
            chunk_id,
            _metadata_pdf_page_index(metadata or {}),
            _metadata_display_page(metadata or {}),
            (metadata or {}).get("source_page_label"),
            preview,
        )


def _retrieve_context(question: str, trace_id: str | None = None):
    global _collection

    _trace(trace_id, "retrieval start query=%r", question)

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
        _trace(trace_id, "retrieval return fallback reason=knowledge_base_not_indexed")
        _log_retrieval_confidence(question, confidence, 0, trace_id)

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
        _trace(trace_id, "retrieval return fallback reason=knowledge_base_unavailable")
        _log_retrieval_confidence(question, confidence, 0, trace_id)

        return {
            "context": "",
            "sources": [],
            "confidence": confidence,
        }

    documents = _flatten_query_result(results, "documents")
    metadatas = _flatten_query_result(results, "metadatas")
    distances = _flatten_query_result(results, "distances")
    ids = _flatten_query_result(results, "ids")
    _log_retrieved_chunks(
        question,
        ids,
        documents,
        metadatas,
        distances,
        trace_id,
    )

    if not documents:
        confidence = {
            "mode": "gemini_fallback",
            "reason": "no_documents",
            "document_count": 0,
            "useful_chunks": 0,
        }
        _trace(trace_id, "retrieval return fallback reason=no_documents")
        _log_retrieval_confidence(question, confidence, 0, trace_id)

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
    _log_retrieval_confidence(
        question,
        confidence,
        len(candidate_sources),
        trace_id,
    )

    if confidence.get("mode") != "knowledge_base":
        _trace(
            trace_id,
            "retrieval return fallback reason=%s candidate_sources=%s returned_sources=0",
            confidence.get("reason", "unknown"),
            len(candidate_sources),
        )
        return {
            "context": "",
            "sources": [],
            "confidence": confidence,
        }

    _trace(
        trace_id,
        "retrieval return knowledge_base context_chars=%s returned_sources=%s",
        len("\n\n".join(documents)),
        len(candidate_sources),
    )
    return {
        "context": "\n\n".join(documents),
        "sources": candidate_sources,
        "confidence": confidence,
    }


def _classify_question(question: str, retrieval_query: str | None = None):
    combined_text = f"{question or ''} {retrieval_query or ''}".lower()

    for question_type, patterns in QUESTION_TYPE_RULES:
        if any(re.search(pattern, combined_text, re.IGNORECASE) for pattern in patterns):
            return question_type

    return "General"


def _answer_length_instruction(question: str, question_type: str):
    normalized = question.lower().strip()

    if any(
        keyword in normalized
        for keyword in ("mcq", "mcqs", "quiz", "question paper")
    ):
        return (
            "The user wants exam practice. If the retrieved material supports "
            "it, format as numbered multiple-choice questions with options and "
            "mark the correct answer. Do not create questions from unsupported "
            "facts. Keep explanations brief."
        )

    if any(
        keyword in normalized
        for keyword in (
            "detailed notes",
            "long answer",
            "full notes",
            "comprehensive",
            "essay",
            "elaborate",
        )
    ):
        return (
            "This is a long answer request. Give detailed but scan-friendly "
            "exam notes and never exceed 800 words. Use headings, bullets, "
            "tables, and examples only when supported by the material."
        )

    if any(
        keyword in normalized
        for keyword in (
            "explain",
            "describe",
            "discuss",
            "detail",
            "achievements",
            "achievement",
            "notes",
        )
    ):
        return (
            "This is a medium or long answer request. Use 400-600 words for "
            "normal detail and never exceed 800 words. Give structured exam "
            "notes with concise headings, bullets, and tables only when useful."
        )

    if question_type != "General":
        return (
            "This is a simple exam question. Keep the answer under 250 words. "
            "Use the selected template, but keep each section tight and avoid "
            "long paragraphs."
        )

    if normalized.startswith(("who is", "what is", "who was", "what was")):
        return (
            "This is a short question. Answer in 2-5 high-yield bullets. "
            "Stay under 250 words. Do not over-explain."
        )

    return (
        "Keep the answer concise by default. Expand only when the user asks "
        "for detail."
    )


def _exam_template_instruction(question_type: str):
    template = EXAM_TEMPLATES.get(question_type) or EXAM_TEMPLATES["General"]

    return f"""
Detected Question Type: {question_type}

Universal Structure:

{UNIVERSAL_EXAM_STRUCTURE}

Question-Type Template:

Use this template when the retrieved material supports it:

{template}

Template rules:
- Omit any section whose facts are not present in the supplied study material.
- Never fill missing fields from outside knowledge.
- Prefer compact Markdown headings, bullets, spacing, and small tables where appropriate.
- Avoid Wikipedia-style paragraphs.
- Avoid repeated information.
- Never produce walls of text.
- Use ## and ### headings, bullets, tables, and restrained bold.
- Add labels such as Exam Tip, Frequently Asked, Remember, Important Year,
  Mnemonic, or PYQ Hint only when the content is directly supported by the
  supplied material.
"""


def _answer_prompt(question: str, context: str, retrieval_query: str | None = None):
    retrieval_text = retrieval_query or question
    question_type = _classify_question(question, retrieval_text)

    return f"""
You are AssamWork AI Tutor in Competitive Exam Teacher Mode.

You are an experienced faculty member for {EXAM_AUDIENCE}.

Your goal is to help the student score marks.
Do not behave like a general chatbot.
Do not sound like Wikipedia.
If a student has only 2 minutes to revise this topic before the exam, the
answer should help immediately.

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

Exam Template:

{_exam_template_instruction(question_type)}

Answer Length:

{_answer_length_instruction(question, question_type)}

Write premium competitive exam notes, not a generic AI answer.
Use short bullets instead of paragraphs whenever possible.
Preserve source grounding.
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

Answer clearly and concisely. Do not apply Knowledge Base exam templates to
Gemini fallback answers. Do not create citations.
"""


def _fallback_answer_text(answer: str):
    clean_answer = (answer or "No answer returned.").strip()

    return f"{GEMINI_FALLBACK_NOTICE}\n\n{clean_answer}"


def _fallback_generation_error_text():
    return (
        f"{GEMINI_FALLBACK_NOTICE}\n\n"
        "Gemini fallback mode was selected, but Gemini could not generate "
        "an answer right now. Please try again after checking the Gemini "
        "API credentials."
    )


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
  "revision": ["5-10 independent one-line last-minute revision facts"]
}}

If the supplied study material is insufficient, return:
{{
  "answer": "The supplied AssamWork study material does not contain enough information to answer this fully.",
  "revision": []
}}
"""


def _revision_prompt(question: str, context: str, answer: str):
    return f"""
You are AssamWork AI Tutor in Competitive Exam Teacher Mode.

Using only the study material and completed answer below, create 5-10 high-yield
one-line quick revision bullets for competitive exam students.

Prefer years, names, places, battles, articles, institutions, features, and
frequently asked facts when they are present.

The revision must not copy answer sentences.
It must be independently useful as 20-second last-minute notes.

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
  "revision": ["independent one-line last-minute revision fact"]
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


def generate_knowledge_answer(question: str, context: str, retrieval_query: str):
    response = get_client().models.generate_content(
        model="gemini-2.5-flash",
        contents=_structured_prompt(
            question,
            context,
            retrieval_query,
        ),
        config=_json_config(_answer_schema()),
    )

    return _parse_structured_answer(response.text)


def stream_general_answer(question: str, retrieval_query: str):
    stream = get_client().models.generate_content_stream(
        model="gemini-2.5-flash",
        contents=_general_knowledge_prompt(question, retrieval_query),
    )

    for chunk in stream:
        yield getattr(chunk, "text", "") or ""


def stream_knowledge_answer(question: str, context: str, retrieval_query: str):
    stream = get_client().models.generate_content_stream(
        model="gemini-2.5-flash",
        contents=_answer_prompt(question, context, retrieval_query),
    )

    for chunk in stream:
        yield getattr(chunk, "text", "") or ""


def _route_question(question: str, history=None, trace_id: str | None = None):
    return get_ai_service().route_question(question, history, trace_id)


def stream_answer(
    question: str,
    history=None,
    stop_event: threading.Event | None = None,
    trace_id: str | None = None,
):
    _trace(trace_id, "stream_answer delegate=AIService streaming_path=true")
    yield from get_ai_service().stream_answer(
        question,
        history,
        stop_event,
        trace_id,
    )


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


def get_ai_service():
    global _ai_service

    if _ai_service is None:
        cache_manager = LocalJSONCacheManager(DATABASE_PATH / "ai_cache.json")
        dependencies = AIServiceDependencies(
            trace=_trace,
            is_greeting=_is_greeting,
            greeting_answer=_greeting_answer,
            normalize_history=_normalize_history,
            rewrite_question=rewrite_question,
            normalize_retrieval_query=_normalize_retrieval_query,
            retrieve_context=_retrieve_context,
            generate_general_answer=generate_general_answer,
            stream_general_answer=stream_general_answer,
            generate_knowledge_answer=generate_knowledge_answer,
            stream_knowledge_answer=stream_knowledge_answer,
            generate_revision=generate_revision,
        )
        _ai_service = AIService(
            dependencies=dependencies,
            cache_manager=cache_manager,
        )

    return _ai_service


def ask_question(question: str, history=None, trace_id: str | None = None):
    _trace(trace_id, "ask_question delegate=AIService streaming_path=false")
    return get_ai_service().ask_question(question, history, trace_id)
