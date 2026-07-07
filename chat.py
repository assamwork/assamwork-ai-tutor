import os
import threading
import logging
import json
import re
import string

import chromadb
from dotenv import load_dotenv
from google import genai
from google.genai import types
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

from library import COLLECTION_NAME, DATABASE_PATH, record_book_usage
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
RETRIEVAL_CANDIDATE_LIMIT = 30
ANSWER_CONTEXT_CHUNK_LIMIT = 6
DISPLAY_PRIMARY_SOURCE_LIMIT = 3
DISPLAY_OPTIONAL_SOURCE_LIMIT = 0
CONTEXT_SUPPORT_MIN_SCORE = 0.42
OPTIONAL_SOURCE_MIN_SCORE = 0.72
DOCUMENT_TYPE_PRIMARY_EXPLANATORY = "primary_explanatory"
DOCUMENT_TYPE_REVISION_HIGH_YIELD = "revision_high_yield"
DOCUMENT_TYPE_SECONDARY_PRACTICE = "secondary_practice"
DOCUMENT_TYPE_UNKNOWN = "unknown"
PRACTICE_SOURCE_PATTERNS = (
    r"\bmcq(?:s)?\b",
    r"\bmultiple\s+choice\b",
    r"\bpyq(?:s)?\b",
    r"\bprevious\s+year(?:s)?\b",
    r"\bmock(?:\s+test)?(?:s)?\b",
    r"\bpractice(?:\s+set)?(?:s)?\b",
    r"\bquestion\s+bank(?:s)?\b",
    r"\bmodel\s+paper(?:s)?\b",
    r"\bsample\s+paper(?:s)?\b",
    r"\bquestion\s+paper(?:s)?\b",
    r"\btest\s+series\b",
    r"\bobjective\s+question(?:s)?\b",
)
REVISION_HIGH_YIELD_SOURCE_PATTERNS = (
    r"\bhigh\s*yield\b",
    r"\brevision(?:\s+notes?)?\b",
    r"\bquick\s+revision\b",
    r"\bshort\s+notes?\b",
    r"\bimportant\s+topics?\b",
    r"\bcapsule\b",
    r"\bcheat\s*sheet\b",
)
PRIMARY_EXPLANATORY_SOURCE_PATTERNS = (
    r"\bmain\s+book\b",
    r"\bassam\s+(?:book|gk|general\s+knowledge)\b",
    r"\bsubject\s+book\b",
    r"\btext\s*book\b",
    r"\bbook\b",
    r"\bnotes?\b",
    r"\bstudy\s+material(?:s)?\b",
    r"\bguide\b",
    r"\bhandbook\b",
    r"\bmanual\b",
    r"\bchapter\b",
    r"\benvironment\b",
    r"\bhistory\b",
    r"\bgeography\b",
)
PRACTICE_QUERY_PATTERN = re.compile(
    (
        r"\b(mcq(?:s)?|multiple\s+choice|pyq(?:s)?|previous\s+year(?:s)?|"
        r"mock(?:\s+test)?(?:s)?|practice(?:\s+set)?(?:s)?|question\s+bank|"
        r"model\s+paper(?:s)?|sample\s+paper(?:s)?|question\s+paper(?:s)?|"
        r"quiz(?:zes)?)\b"
    ),
    re.IGNORECASE,
)
EXPLANATION_SIGNAL_WORDS = {
    "are",
    "battle",
    "became",
    "born",
    "called",
    "commander",
    "comprises",
    "consists",
    "covers",
    "defined",
    "died",
    "established",
    "famous",
    "features",
    "formed",
    "founded",
    "freedom",
    "freshwater",
    "general",
    "important",
    "importance",
    "include",
    "includes",
    "is",
    "known",
    "lake",
    "led",
    "located",
    "means",
    "refers",
    "ramsar",
    "river",
    "ruler",
    "served",
    "significance",
    "situated",
    "site",
    "tributary",
    "was",
    "were",
    "wetland",
}
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
GENERIC_OPENING_PHRASES = (
    "Here is",
    "Here's",
    "Let us understand",
    "Let's understand",
    "Essential for your competitive exam revision",
    "Below is",
)
UNIVERSAL_EXAM_STRUCTURE = """
Use this Knowledge Base answer structure:

# Topic Heading
- Start immediately with a Markdown H1 heading for the topic.
- Do not write any generic introductory sentence before the heading.

## Introduction
- Maximum 2-3 lines.
- Explain the topic directly.
- No unnecessary history.

## Key Points
- Short bullets.
- Include dates, places, people, provisions, features, and keywords when present.
- Avoid paragraph blocks.

## Explanation
- Include only when the question needs it.
- Use headings, bullets, tables, or examples.
- Never write one huge paragraph.

## Examples
- Include only if examples are needed and supported by the material.

Allowed sections:
- # Topic Heading
- ## Introduction
- ## Key Points
- ## Explanation
- ## Examples

Forbidden sections:
- Quick Revision
- Exam Highlights
- Memory Tricks
- Revision Notes
- PYQ / Exam Relevance
- Exam Tips
"""
EXAM_TEMPLATES = {
    "Person": (
        "## Introduction\n"
        "## Key Points\n"
        "## Explanation\n"
        "## Examples"
    ),
    "Constitution Article": (
        "## Introduction\n"
        "## Key Points\n"
        "## Explanation\n"
        "## Examples"
    ),
    "Scheme": (
        "## Introduction\n"
        "## Key Points\n"
        "## Explanation\n"
        "## Examples"
    ),
    "Battle": (
        "## Introduction\n"
        "## Key Points\n"
        "## Explanation\n"
        "## Examples"
    ),
    "Movement": (
        "## Introduction\n"
        "## Key Points\n"
        "## Explanation\n"
        "## Examples"
    ),
    "Geography": (
        "## Introduction\n"
        "## Key Points\n"
        "## Explanation\n"
        "## Examples"
    ),
    "River": (
        "## Introduction\n"
        "## Key Points\n"
        "## Explanation\n"
        "## Examples"
    ),
    "Mountain": (
        "## Introduction\n"
        "## Key Points\n"
        "## Explanation\n"
        "## Examples"
    ),
    "Science": (
        "## Introduction\n"
        "## Key Points\n"
        "## Explanation\n"
        "## Examples"
    ),
    "Current Affairs": (
        "## Introduction\n"
        "## Key Points\n"
        "## Explanation\n"
        "## Examples"
    ),
    "Environment": (
        "## Introduction\n"
        "## Key Points\n"
        "## Explanation\n"
        "## Examples"
    ),
    "Economy": (
        "## Introduction\n"
        "## Key Points\n"
        "## Explanation\n"
        "## Examples"
    ),
    "Organization": (
        "## Introduction\n"
        "## Key Points\n"
        "## Explanation\n"
        "## Examples"
    ),
    "History": (
        "## Introduction\n"
        "## Key Points\n"
        "## Explanation\n"
        "## Examples"
    ),
    "Mathematics": (
        "## Introduction\n"
        "## Key Points\n"
        "## Explanation\n"
        "## Examples"
    ),
    "General": (
        "## Introduction\n"
        "## Key Points\n"
        "## Explanation\n"
        "## Examples"
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


def _strip_non_answer_sections(answer: str):
    clean_answer = (answer or "").strip()

    if not clean_answer:
        return clean_answer

    section_pattern = re.compile(
        (
            r"(?:^|\n)"
            r"(?:#{1,6}\s*)?"
            r"(?:\*\*)?\s*"
            r"(quick\s+revision|revision(?:\s+notes?)?|exam\s+highlights?|"
            r"memory\s+tricks?|pyq(?:\s*/\s*exam\s+relevance)?|"
            r"exam\s+relevance|exam\s+tips?|mnemonics?)"
            r"\s*(?:\*\*)?\s*:?\s*(?:\n|$)"
        ),
        re.IGNORECASE,
    )
    match = section_pattern.search(clean_answer)

    if not match:
        return clean_answer

    return clean_answer[:match.start()].rstrip()


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


def _raw_tokens(value: str):
    return [
        token
        for token in re.findall(r"[a-zA-Z0-9]+", value.lower())
        if token
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


def _topic_phrase(question: str):
    phrase = _topic_heading(question)
    phrase = re.sub(r"[^a-zA-Z0-9\s]", " ", phrase)
    phrase = re.sub(r"\s+", " ", phrase).strip()

    return phrase


def _phrase_pattern(phrase: str):
    terms = _tokenize(phrase or "")

    if not terms:
        return None

    return re.compile(r"\b" + r"\s+".join(map(re.escape, terms)) + r"\b")


def _phrase_occurrences(document: str, phrase: str):
    pattern = _phrase_pattern(phrase)

    if not pattern:
        return 0

    return len(pattern.findall((document or "").lower()))


def _term_occurrences(document: str, terms):
    text = (document or "").lower()

    return {
        term: len(re.findall(rf"\b{re.escape(term)}\b", text))
        for term in terms
    }


def _source_title_text(metadata: dict):
    metadata = metadata or {}

    return " ".join(
        str(value or "")
        for value in (
            metadata.get("filename"),
            metadata.get("book"),
            metadata.get("subject"),
        )
    )


def _normalize_source_title(value: str):
    normalized = re.sub(r"\.[a-z0-9]{1,8}\b", " ", (value or "").lower())
    normalized = re.sub(r"[_\-/]+", " ", normalized)
    normalized = re.sub(r"[^a-z0-9\s]", " ", normalized)

    return re.sub(r"\s+", " ", normalized).strip()


def _matches_any_pattern(value: str, patterns):
    return any(re.search(pattern, value, re.IGNORECASE) for pattern in patterns)


def _classify_source_document_type(metadata: dict):
    title = _normalize_source_title(_source_title_text(metadata))

    if _matches_any_pattern(title, PRACTICE_SOURCE_PATTERNS):
        return DOCUMENT_TYPE_SECONDARY_PRACTICE

    if _matches_any_pattern(title, REVISION_HIGH_YIELD_SOURCE_PATTERNS):
        return DOCUMENT_TYPE_REVISION_HIGH_YIELD

    if _matches_any_pattern(title, PRIMARY_EXPLANATORY_SOURCE_PATTERNS):
        return DOCUMENT_TYPE_PRIMARY_EXPLANATORY

    return DOCUMENT_TYPE_UNKNOWN


def _is_practice_query(question: str):
    return bool(PRACTICE_QUERY_PATTERN.search(question or ""))


def _document_type_priority(document_type: str, practice_intent: bool):
    if practice_intent:
        priorities = {
            DOCUMENT_TYPE_SECONDARY_PRACTICE: 4,
            DOCUMENT_TYPE_REVISION_HIGH_YIELD: 3,
            DOCUMENT_TYPE_PRIMARY_EXPLANATORY: 2,
            DOCUMENT_TYPE_UNKNOWN: 1,
        }
    else:
        priorities = {
            DOCUMENT_TYPE_PRIMARY_EXPLANATORY: 4,
            DOCUMENT_TYPE_REVISION_HIGH_YIELD: 3,
            DOCUMENT_TYPE_UNKNOWN: 2,
            DOCUMENT_TYPE_SECONDARY_PRACTICE: 0,
        }

    return priorities.get(document_type, 1)


def _is_secondary_practice_record(record: dict):
    return record.get("document_type") == DOCUMENT_TYPE_SECONDARY_PRACTICE


def _has_explanation_signal(question: str, document: str, query_terms):
    if _has_definition_signal(question, document, query_terms):
        return True

    phrase = _topic_phrase(question)
    pattern = _phrase_pattern(phrase)
    text = re.sub(r"\s+", " ", (document or "").lower())

    if pattern:
        for match in pattern.finditer(text):
            start = max(match.start() - 140, 0)
            end = min(match.end() + 140, len(text))
            window_terms = set(_raw_tokens(text[start:end]))

            if window_terms & EXPLANATION_SIGNAL_WORDS:
                return True

    document_terms = set(_tokenize(document or ""))
    raw_document_terms = set(_raw_tokens(document or ""))
    important_terms = set(query_terms or [])

    if important_terms and important_terms <= document_terms:
        return bool(raw_document_terms & EXPLANATION_SIGNAL_WORDS)

    return False


def _metadata_is_complete(metadata: dict):
    return bool(
        metadata.get("book")
        or metadata.get("filename")
    )


def _source_from_metadata(metadata: dict):
    metadata = metadata or {}
    display_page = _metadata_display_page(metadata)
    document_type = _classify_source_document_type(metadata)

    return {
        "subject": metadata.get("subject"),
        "book": metadata.get("book"),
        "filename": metadata.get("filename") or metadata.get("book"),
        "chunk_id": metadata.get("chunk_id"),
        "pdf_page_index": _metadata_pdf_page_index(metadata),
        "display_page": display_page,
        "source_page_label": metadata.get("source_page_label") or "",
        "_document_type": document_type,
    }


def _score_retrieved_chunk(
    question: str,
    document: str,
    metadata: dict,
    distance,
    index: int,
):
    important_terms = _unique_terms(_important_query_terms(question))
    document_terms = set(_tokenize(document or ""))
    overlap = sorted(set(important_terms) & document_terms)
    term_counts = _term_occurrences(document or "", important_terms)
    total_occurrences = sum(term_counts.values())
    topic_phrase = _topic_phrase(question)
    phrase_count = _phrase_occurrences(document or "", topic_phrase)
    explanation_signal = _has_explanation_signal(
        question,
        document or "",
        important_terms,
    )
    semantic_score = _distance_score(distance)

    if semantic_score is None:
        semantic_score = max(0.0, 1 - (index * 0.08))

    semantic_score = max(0.0, min(float(semantic_score), 1.0))
    term_count = max(len(important_terms), 1)
    overlap_ratio = len(overlap) / term_count
    exact_phrase_score = 1.0 if phrase_count else 0.0
    explanation_score = 1.0 if explanation_signal else 0.0
    word_count = len(_tokenize(document or ""))

    if word_count < 25:
        usefulness_score = 0.0
    else:
        usefulness_score = min(word_count / 120, 1.0)

    occurrence_score = min(total_occurrences / max(term_count * 2, 1), 1.0)
    score = round(
        (semantic_score * 0.28)
        + (overlap_ratio * 0.26)
        + (exact_phrase_score * 0.16)
        + (explanation_score * 0.16)
        + (usefulness_score * 0.10)
        + (occurrence_score * 0.04),
        4,
    )

    reasons = []
    numeric_terms = [
        term
        for term in important_terms
        if term.isdigit()
    ]

    if not (document or "").strip():
        reasons.append("empty_chunk")

    if not _metadata_is_complete(metadata or {}):
        reasons.append("missing_source_metadata")

    if important_terms and not overlap:
        reasons.append("weak_overlap")

    if numeric_terms and not all(term in document_terms for term in numeric_terms):
        reasons.append("numeric_terms_not_supported")

    if (
        important_terms
        and len(overlap) <= 1
        and total_occurrences <= 1
        and not phrase_count
        and not explanation_signal
    ):
        reasons.append("mention_only")

    if (
        phrase_count <= 1
        and total_occurrences <= term_count
        and not explanation_signal
    ):
        reasons.append("mentions_without_explanation")

    if score < CONTEXT_SUPPORT_MIN_SCORE:
        reasons.append("low_support_score")

    if semantic_score < 0.2 and not explanation_signal:
        reasons.append("low_semantic_similarity")

    rejected = bool(reasons)

    return {
        "index": index,
        "document": document or "",
        "metadata": metadata or {},
        "distance": distance,
        "source": _source_from_metadata(metadata or {}),
        "document_type": _classify_source_document_type(metadata or {}),
        "score": score,
        "semantic_score": round(semantic_score, 4),
        "overlap_terms": overlap,
        "overlap_ratio": round(overlap_ratio, 4),
        "phrase_occurrences": phrase_count,
        "term_occurrences": term_counts,
        "word_count": word_count,
        "definition_or_explanation": explanation_signal,
        "rejected": rejected,
        "rejection_reasons": reasons,
        "selected_for_context": False,
        "selection_reason": "",
        "context_rank": None,
        "ranking_priority": None,
    }


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
        source = _source_from_metadata(item)
        display_page = _metadata_display_page(item)
        source_key = (
            item.get("subject"),
            item.get("book"),
            display_page,
        )

        if source_key in seen:
            continue

        seen.add(source_key)
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


def _collection_query_limit(collection):
    try:
        total_chunks = int(collection.count())
    except Exception:
        return RETRIEVAL_CANDIDATE_LIMIT

    if total_chunks <= 0:
        return 0

    return min(RETRIEVAL_CANDIDATE_LIMIT, total_chunks)


def _score_retrieved_chunks(question: str, ids, documents, metadatas, distances):
    records = []

    for index, document in enumerate(documents or []):
        metadata = (
            dict((metadatas or [{}])[index] or {})
            if index < len(metadatas or [])
            else {}
        )

        if not metadata.get("chunk_id") and index < len(ids or []):
            metadata["chunk_id"] = ids[index]

        distance = (
            (distances or [None])[index]
            if index < len(distances or [])
            else None
        )
        records.append(
            _score_retrieved_chunk(
                question,
                document,
                metadata,
                distance,
                index,
            )
        )

    return records


def _chunk_dedupe_key(record: dict):
    metadata = record.get("metadata") or {}
    chunk_id = metadata.get("chunk_id")

    if chunk_id:
        return ("chunk", chunk_id)

    source = record.get("source") or {}

    return (
        "source_text",
        source.get("subject"),
        source.get("book") or source.get("filename"),
        source.get("pdf_page_index"),
        re.sub(r"\s+", " ", record.get("document") or "").strip()[:180],
    )


def _record_rank_key(record: dict, practice_intent: bool):
    priority = _document_type_priority(
        record.get("document_type") or DOCUMENT_TYPE_UNKNOWN,
        practice_intent,
    )
    record["ranking_priority"] = priority

    return (
        priority,
        record.get("score", 0),
        int(bool(record.get("definition_or_explanation"))),
        record.get("semantic_score", 0),
        -record.get("index", 0),
    )


def _select_supporting_chunks(records, question: str):
    practice_intent = _is_practice_query(question)
    selected = []
    seen = set()

    for record in records:
        record["selected_for_context"] = False
        record["context_rank"] = None
        record["ranking_priority"] = _document_type_priority(
            record.get("document_type") or DOCUMENT_TYPE_UNKNOWN,
            practice_intent,
        )

        if record.get("rejected"):
            record["selection_reason"] = (
                "rejected_weak_support:"
                + ",".join(record.get("rejection_reasons") or ["unknown"])
            )
        else:
            record["selection_reason"] = "eligible"

    eligible = [
        record
        for record in records
        if not record.get("rejected")
    ]
    explanatory_eligible = [
        record
        for record in eligible
        if not _is_secondary_practice_record(record)
    ]

    if not practice_intent and explanatory_eligible:
        for record in eligible:
            if _is_secondary_practice_record(record):
                record["selection_reason"] = (
                    "practice_source_deprioritized_explanatory_available"
                )

        eligible = explanatory_eligible

    eligible.sort(
        key=lambda record: _record_rank_key(record, practice_intent),
        reverse=True,
    )

    for record in eligible:
        dedupe_key = _chunk_dedupe_key(record)

        if dedupe_key in seen:
            record["selection_reason"] = "duplicate_chunk"
            continue

        seen.add(dedupe_key)
        record["selected_for_context"] = True
        record["selection_reason"] = "selected_for_context"
        record["context_rank"] = len(selected) + 1
        selected.append(record)

        if len(selected) >= ANSWER_CONTEXT_CHUNK_LIMIT:
            break

    for record in eligible:
        if record.get("selection_reason") == "eligible":
            record["selection_reason"] = "not_selected_below_context_limit"

    return selected


def _context_from_selected_chunks(selected_records):
    context_parts = []

    for record in selected_records:
        source = record.get("source") or {}
        book = source.get("book") or source.get("filename") or "Unknown source"
        page = source.get("display_page")
        page_label = f", Page {page}" if page not in (None, "") else ""
        text = (record.get("document") or "").strip()

        if not text:
            continue

        context_parts.append(f"Source: {book}{page_label}\n{text}")

    return "\n\n".join(context_parts)


def _numeric_page(value):
    if isinstance(value, bool) or value in (None, ""):
        return None

    if isinstance(value, int):
        return value

    if isinstance(value, float) and value.is_integer():
        return int(value)

    value_text = str(value).strip()

    if re.fullmatch(r"\d+", value_text):
        return int(value_text)

    return None


def _source_page_label(start_page, end_page):
    if start_page in (None, ""):
        return None

    if end_page in (None, "") or end_page == start_page:
        return start_page

    return f"{start_page}-{end_page}"


def _strip_internal_source_fields(source: dict):
    clean_source = dict(source)

    for key in (
        "_support_score",
        "_range_sort",
        "_document_type",
        "_ranking_priority",
        "_context_rank",
        "page_start",
        "page_end",
    ):
        clean_source.pop(key, None)

    return clean_source


def _source_sort_key(source: dict):
    return (
        source.get("_ranking_priority", 0),
        source.get("_support_score", 0),
        -source.get("_context_rank", 999),
        -source.get("_range_sort", 0),
    )


def _merge_selected_sources(selected_records, strip_internal=True):
    grouped = {}

    for record in selected_records:
        source = record.get("source") or {}
        subject = source.get("subject")
        book = source.get("book") or source.get("filename")
        filename = source.get("filename") or book
        group_key = (subject, book, filename)
        group = grouped.setdefault(
            group_key,
            {
                "subject": subject,
                "book": book,
                "filename": filename,
                "numeric_pages": {},
                "label_pages": {},
            },
        )
        display_page = source.get("display_page")
        numeric_page = _numeric_page(display_page)

        if numeric_page is not None:
            existing = group["numeric_pages"].get(numeric_page)

            if not existing or record.get("score", 0) > existing.get("score", 0):
                group["numeric_pages"][numeric_page] = record

            continue

        label = (
            str(display_page or source.get("source_page_label") or "Page not available")
            .strip()
        )
        existing = group["label_pages"].get(label)

        if not existing or record.get("score", 0) > existing.get("score", 0):
            group["label_pages"][label] = record

    merged_sources = []

    for group in grouped.values():
        pages = sorted(group["numeric_pages"])
        range_start = None
        range_end = None
        range_records = []

        def flush_range():
            if range_start is None:
                return

            best_record = max(
                range_records,
                key=lambda item: item.get("score", 0),
            )
            best_source = best_record.get("source") or {}
            page_label = _source_page_label(range_start, range_end)
            merged_sources.append(
                {
                    "subject": group["subject"],
                    "book": group["book"],
                    "filename": group["filename"],
                    "chunk_id": best_source.get("chunk_id"),
                    "pdf_page_index": best_source.get("pdf_page_index"),
                    "display_page": page_label,
                    "source_page_label": str(page_label or ""),
                    "page_start": range_start,
                    "page_end": range_end,
                    "_document_type": best_record.get("document_type"),
                    "_ranking_priority": best_record.get("ranking_priority", 0),
                    "_context_rank": best_record.get("context_rank") or 999,
                    "_support_score": best_record.get("score", 0),
                    "_range_sort": range_start or 0,
                }
            )

        for page in pages:
            record = group["numeric_pages"][page]

            if range_start is None:
                range_start = page
                range_end = page
                range_records = [record]
                continue

            if page == range_end + 1:
                range_end = page
                range_records.append(record)
                continue

            flush_range()
            range_start = page
            range_end = page
            range_records = [record]

        flush_range()

        for label, record in group["label_pages"].items():
            best_source = record.get("source") or {}
            merged_sources.append(
                {
                    "subject": group["subject"],
                    "book": group["book"],
                    "filename": group["filename"],
                    "chunk_id": best_source.get("chunk_id"),
                    "pdf_page_index": best_source.get("pdf_page_index"),
                    "display_page": label,
                    "source_page_label": label,
                    "_document_type": record.get("document_type"),
                    "_ranking_priority": record.get("ranking_priority", 0),
                    "_context_rank": record.get("context_rank") or 999,
                    "_support_score": record.get("score", 0),
                    "_range_sort": 0,
                }
            )

    merged_sources.sort(key=_source_sort_key, reverse=True)
    primary_sources = merged_sources[:DISPLAY_PRIMARY_SOURCE_LIMIT]
    optional_sources = [
        source
        for source in merged_sources[DISPLAY_PRIMARY_SOURCE_LIMIT:]
        if source.get("_support_score", 0) >= OPTIONAL_SOURCE_MIN_SCORE
    ][:DISPLAY_OPTIONAL_SOURCE_LIMIT]

    selected_sources = primary_sources + optional_sources

    if not strip_internal:
        return selected_sources

    return [
        _strip_internal_source_fields(source)
        for source in selected_sources
    ]


def _source_log_summary(sources):
    summary = []

    for source in sources or []:
        summary.append(
            {
                "book": source.get("book") or source.get("filename"),
                "page": source.get("display_page"),
                "chunk_id": source.get("chunk_id"),
                "document_type": source.get("_document_type"),
                "support_score": source.get("_support_score"),
                "rank_priority": source.get("_ranking_priority"),
            }
        )

    return summary


def _log_source_filtering(
    question: str,
    records,
    selected_records,
    candidate_sources,
    displayed_sources,
    trace_id: str | None = None,
):
    practice_intent = _is_practice_query(question)
    rejected_records = [
        record
        for record in records
        if record.get("rejected")
    ]
    reason_counts = {}

    for record in rejected_records:
        for reason in record.get("rejection_reasons") or ["unknown"]:
            reason_counts[reason] = reason_counts.get(reason, 0) + 1

    _trace(
        trace_id,
        (
            "source filtering summary total_retrieved_chunks=%s "
            "chunks_selected_for_context=%s candidate_sources=%s "
            "displayed_sources=%s rejected_weak_sources=%s "
            "practice_intent=%s reasons=%s query=%r"
        ),
        len(records or []),
        len(selected_records or []),
        len(candidate_sources or []),
        len(displayed_sources or []),
        len(rejected_records),
        practice_intent,
        reason_counts,
        question,
    )
    _trace(
        trace_id,
        "debug_candidate_sources=%s",
        _source_log_summary(candidate_sources),
    )
    _trace(
        trace_id,
        "displayed_sources=%s",
        _source_log_summary(displayed_sources),
    )

    for record in selected_records or []:
        source = record.get("source") or {}
        _trace(
            trace_id,
            (
                "selected context chunk rank=%s index=%s filename=%r "
                "document_type=%s rank_priority=%s support_score=%s "
                "semantic=%s page=%r overlap=%s phrase_occurrences=%s "
                "definition_or_explanation=%s reason=%s"
            ),
            record.get("context_rank"),
            record.get("index"),
            source.get("book") or source.get("filename"),
            record.get("document_type"),
            record.get("ranking_priority"),
            record.get("score"),
            record.get("semantic_score"),
            source.get("display_page"),
            record.get("overlap_terms"),
            record.get("phrase_occurrences"),
            record.get("definition_or_explanation"),
            record.get("selection_reason"),
        )

    ranked_records = sorted(
        records or [],
        key=lambda record: _record_rank_key(record, practice_intent),
        reverse=True,
    )

    for final_rank, record in enumerate(ranked_records, start=1):
        source = record.get("source") or {}
        rejected_reason = (
            ",".join(record.get("rejection_reasons") or [])
            if record.get("rejected")
            else ""
        )
        _trace(
            trace_id,
            (
                "source ranking detail final_rank=%s context_rank=%s "
                "selected=%s filename=%r document_type=%s rank_priority=%s "
                "support_score=%s page=%r rejected_reason=%r "
                "selection_reason=%r"
            ),
            final_rank,
            record.get("context_rank"),
            record.get("selected_for_context"),
            source.get("book") or source.get("filename"),
            record.get("document_type"),
            record.get("ranking_priority"),
            record.get("score"),
            source.get("display_page"),
            rejected_reason,
            record.get("selection_reason"),
        )

    for record in rejected_records:
        source = record.get("source") or {}
        _trace(
            trace_id,
            (
                "rejected weak chunk index=%s score=%s reasons=%s "
                "filename=%r document_type=%s page=%r overlap=%s "
                "phrase_occurrences=%s selected_for_context=%s"
            ),
            record.get("index"),
            record.get("score"),
            record.get("rejection_reasons"),
            source.get("book") or source.get("filename"),
            record.get("document_type"),
            source.get("display_page"),
            record.get("overlap_terms"),
            record.get("phrase_occurrences"),
            record.get("selected_for_context"),
        )


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

        if _has_explanation_signal(question, document or "", important_terms):
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
        query_limit = _collection_query_limit(collection)

        if query_limit <= 0:
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

        results = collection.query(
            query_texts=[question],
            n_results=query_limit,
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
    scored_records = _score_retrieved_chunks(
        question,
        ids,
        documents,
        metadatas,
        distances,
    )
    selected_records = _select_supporting_chunks(scored_records, question)
    selected_documents = [
        record.get("document") or ""
        for record in selected_records
    ]
    selected_distances = [
        record.get("distance")
        for record in selected_records
    ]
    ranked_displayed_sources = _merge_selected_sources(
        selected_records,
        strip_internal=False,
    )
    displayed_sources = [
        _strip_internal_source_fields(source)
        for source in ranked_displayed_sources
    ]
    selected_context = _context_from_selected_chunks(selected_records)
    confidence = _evaluate_retrieval_confidence(
        question,
        selected_documents,
        selected_distances,
    )
    _log_retrieval_confidence(
        question,
        confidence,
        len(candidate_sources),
        trace_id,
    )
    _log_source_filtering(
        question,
        scored_records,
        selected_records,
        candidate_sources,
        ranked_displayed_sources,
        trace_id,
    )

    if confidence.get("mode") != "knowledge_base" or not selected_context:
        _trace(
            trace_id,
            (
                "retrieval return fallback reason=%s candidate_sources=%s "
                "selected_chunks=%s displayed_sources=0"
            ),
            confidence.get("reason", "unknown"),
            len(candidate_sources),
            len(selected_records),
        )
        return {
            "context": "",
            "sources": [],
            "confidence": confidence,
        }

    _trace(
        trace_id,
        (
            "retrieval return knowledge_base context_chars=%s "
            "selected_chunks=%s displayed_sources=%s candidate_sources=%s"
        ),
        len(selected_context),
        len(selected_records),
        len(displayed_sources),
        len(candidate_sources),
    )
    return {
        "context": selected_context,
        "sources": displayed_sources,
        "confidence": confidence,
    }


def _classify_question(question: str, retrieval_query: str | None = None):
    combined_text = f"{question or ''} {retrieval_query or ''}".lower()

    for question_type, patterns in QUESTION_TYPE_RULES:
        if any(re.search(pattern, combined_text, re.IGNORECASE) for pattern in patterns):
            return question_type

    return "General"


def _topic_heading(question: str, retrieval_query: str | None = None):
    topic = (retrieval_query or question or "").strip()
    topic = re.sub(r"\s+", " ", topic)
    topic = re.sub(
        r"^(?:who|what|where|when|why|how)\s+(?:is|was|are|were)\s+",
        "",
        topic,
        flags=re.IGNORECASE,
    )
    topic = re.sub(
        r"^(?:explain|describe|discuss|define|write(?:\s+a)?(?:\s+short)?(?:\s+note)?(?:\s+on)?|tell\s+me\s+about)\s+",
        "",
        topic,
        flags=re.IGNORECASE,
    )
    topic = topic.strip(string.whitespace + "?.!:;-")

    return topic or (question or "Answer").strip() or "Answer"


def _answer_length_instruction(question: str, question_type: str):
    normalized = question.lower().strip()

    if any(
        keyword in normalized
        for keyword in (
            "mcq",
            "mcqs",
            "quiz",
            "pyq",
            "pyqs",
            "previous year",
            "mock",
            "practice",
            "question bank",
            "model paper",
            "question paper",
        )
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

Answer Structure:

{UNIVERSAL_EXAM_STRUCTURE}

Question-Type Template:

Use this template as the maximum allowed answer shape:

{template}

Template rules:
- Omit any section whose facts are not present in the supplied study material.
- Never fill missing fields from outside knowledge.
- Prefer compact Markdown headings, bullets, spacing, and small tables where helpful.
- Avoid Wikipedia-style paragraphs.
- Avoid repeated information.
- Never produce walls of text.
- Use only the allowed headings. Do not add extra study-note sections.
- Never start with generic AI phrases such as: {", ".join(GENERIC_OPENING_PHRASES)}.
- Do not assume the student is revising.
- Never include Quick Revision, Exam Highlights, Memory Tricks, Revision Notes,
  PYQ hints, exam tips, or mnemonic sections in the answer.
"""


def _answer_prompt(question: str, context: str, retrieval_query: str | None = None):
    retrieval_text = retrieval_query or question
    question_type = _classify_question(question, retrieval_text)
    topic_heading = _topic_heading(question, retrieval_text)

    return f"""
You are AssamWork AI Tutor in Competitive Exam Teacher Mode.

You are an experienced faculty member for {EXAM_AUDIENCE}.

Your goal is to help the student score marks.
Do not behave like a general chatbot.
Do not sound like Wikipedia.
Write like a high-quality digital textbook.

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

Required Opening:

Start the answer immediately with this exact Markdown heading:

# {topic_heading}

Then continue with the selected study-note sections. Do not write any sentence
before the heading.

Answer Rules:

- Generate the answer only.
- Include only these sections when supported: ## Introduction, ## Key Points,
  ## Explanation, and ## Examples.
- Do not include Quick Revision, Exam Highlights, Memory Tricks, Revision Notes,
  PYQ / Exam Relevance, Exam Tips, or mnemonic sections.
- Do not write last-minute notes in the answer. Those are generated separately.

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
  "answer": "answer text only"
}}

If the supplied study material is insufficient, return:
{{
  "answer": "The supplied AssamWork study material does not contain enough information to answer this fully."
}}
"""


def _revision_prompt(question: str, context: str, answer: str):
    return f"""
You are AssamWork AI Tutor in Competitive Exam Teacher Mode.

Using only the study material and completed answer below, create 4-8 high-yield
20-second quick revision notes for competitive exam students.

Prefer years, names, places, battles, articles, institutions, features, and
frequently asked facts when they are present.

Rules:
- Each item must be a short note, ideally 2-6 words.
- No paragraphs.
- No explanations.
- No repeated answer sentences.
- No markdown headings.
- No numbering.
- Do not include facts that are absent from the study material or answer.

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
  "revision": ["short last-minute note"]
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
        },
        "required": ["answer"],
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

    parsed = _parse_structured_answer(response.text)
    answer = _strip_non_answer_sections(parsed["answer"])

    try:
        revision = generate_revision(question, context, answer)
    except Exception as error:
        logger.warning("Unable to generate revision metadata: %s", error)
        revision = ""

    return {
        "answer": answer,
        "revision": revision,
    }


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
            record_sources_used=record_book_usage,
        )
        _ai_service = AIService(
            dependencies=dependencies,
            cache_manager=cache_manager,
        )

    return _ai_service


def ask_question(question: str, history=None, trace_id: str | None = None):
    _trace(trace_id, "ask_question delegate=AIService streaming_path=false")
    return get_ai_service().ask_question(question, history, trace_id)
