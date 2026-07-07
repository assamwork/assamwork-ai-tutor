from __future__ import annotations

from dataclasses import dataclass
import logging
import re
import threading
import time
from typing import Callable, Iterable

from services.cache_manager import CacheManager
from services.models import AnswerPackage


logger = logging.getLogger(__name__)


PROMPT_VERSION = "v5"
GEMINI_FALLBACK_NOTICE = (
    "Note: This topic is not currently covered in AssamWork's uploaded "
    "study materials. The following answer is based on Gemini's general knowledge."
)

NORMALIZATION_PREFIXES = (
    r"please\s+",
    r"can\s+you\s+",
    r"could\s+you\s+",
    r"would\s+you\s+",
    r"tell\s+me\s+about\s+",
    r"give\s+me\s+(?:a\s+)?(?:short\s+)?(?:note\s+on|overview\s+of|information\s+about)\s+",
    r"who\s+(?:is|was)\s+",
    r"what\s+(?:is|was|are|were)\s+",
    r"explain\s+",
    r"describe\s+",
    r"define\s+",
    r"write\s+(?:a\s+)?(?:short\s+)?(?:note\s+)?(?:on\s+)?",
)
CONTEXT_REFERENCE_PATTERN = re.compile(
    r"\b(he|his|him|she|her|they|their|it|its|this|that|these|those|above|same)\b",
    re.IGNORECASE,
)
FOLLOW_UP_HINT_PATTERN = re.compile(
    r"\b(achievement|achievements|examples?|mcqs?|quiz|revision|from this|about this)\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class AIServiceDependencies:
    trace: Callable
    is_greeting: Callable[[str], bool]
    greeting_answer: Callable[[], str]
    normalize_history: Callable
    rewrite_question: Callable
    normalize_retrieval_query: Callable[[str], str]
    retrieve_context: Callable
    generate_general_answer: Callable[[str, str], str]
    stream_general_answer: Callable[[str, str], Iterable[str]]
    generate_knowledge_answer: Callable[[str, str, str], dict]
    stream_knowledge_answer: Callable[[str, str, str], Iterable[str]]
    generate_revision: Callable[[str, str, str], str]
    record_sources_used: Callable[[list], None] | None = None


class AIMetrics:
    def __init__(self):
        self._lock = threading.Lock()
        self._values = {
            "cache_hits": 0,
            "cache_misses": 0,
            "KB_mode": 0,
            "Gemini_fallback": 0,
            "Gemini_calls_saved": 0,
            "response_count": 0,
            "total_response_time": 0.0,
        }

    def record_cache_hit(self):
        self._increment("cache_hits")
        self._increment("Gemini_calls_saved")

    def record_cache_miss(self):
        self._increment("cache_misses")

    def record_mode(self, mode: str):
        if mode == "knowledge_base":
            self._increment("KB_mode")
        elif mode == "gemini_fallback":
            self._increment("Gemini_fallback")

    def record_response_time(self, seconds: float):
        with self._lock:
            self._values["response_count"] += 1
            self._values["total_response_time"] += max(seconds, 0.0)

    def snapshot(self):
        with self._lock:
            values = dict(self._values)

        response_count = values.pop("response_count")
        total = values.pop("total_response_time")
        values["average_response_time"] = (
            round(total / response_count, 4)
            if response_count
            else 0.0
        )
        return values

    def _increment(self, key: str):
        with self._lock:
            self._values[key] += 1


class QuestionNormalizer:
    def canonicalize(self, question: str):
        normalized = (question or "").strip().lower()
        normalized = re.sub(r"['’]", "", normalized)
        normalized = re.sub(r"[^a-z0-9\s]", " ", normalized)
        normalized = re.sub(r"\s+", " ", normalized).strip()

        previous = None
        while previous != normalized:
            previous = normalized
            for prefix in NORMALIZATION_PREFIXES:
                normalized = re.sub(rf"^(?:{prefix})", "", normalized).strip()

        normalized = re.sub(r"\b(the|a|an)\b", " ", normalized)
        normalized = re.sub(r"\s+", " ", normalized).strip()

        return normalized or "empty-question"

    def cache_key(self, question: str):
        return self.canonicalize(question)

    def needs_history_before_cache(self, question: str, history=None):
        normalized_history = history or []

        if not normalized_history:
            return False

        normalized = (question or "").strip().lower()

        if CONTEXT_REFERENCE_PATTERN.search(normalized):
            return True

        words = re.findall(r"[a-z0-9]+", normalized)
        return len(words) <= 4 and bool(FOLLOW_UP_HINT_PATTERN.search(normalized))


class AIService:
    def __init__(
        self,
        dependencies: AIServiceDependencies,
        cache_manager: CacheManager,
        prompt_version: str = PROMPT_VERSION,
        normalizer: QuestionNormalizer | None = None,
        metrics: AIMetrics | None = None,
    ):
        self.dependencies = dependencies
        self.cache_manager = cache_manager
        self.prompt_version = prompt_version
        self.normalizer = normalizer or QuestionNormalizer()
        self.metrics = metrics or AIMetrics()

    def ask_question(self, question: str, history=None, trace_id: str | None = None):
        started_at = time.perf_counter()
        package = None

        try:
            self._trace(
                trace_id,
                "ai_service ask start prompt_version=%s",
                self.prompt_version,
            )
            package = self._get_pre_rewrite_cache(question, history, trace_id)

            if package is None:
                route = self.route_question(question, history, trace_id)
                package = self._answer_from_route(question, route, trace_id)

                if route["mode"] != "cached":
                    self._store_package(package, trace_id)

            self._record_sources_used(package)
            return package.to_chat_response()
        finally:
            elapsed = time.perf_counter() - started_at
            self.metrics.record_response_time(elapsed)
            self._trace(
                trace_id,
                "ai_service ask done elapsed=%.4fs cache_key=%r",
                elapsed,
                package.cache_key if package else None,
            )

    def stream_answer(
        self,
        question: str,
        history=None,
        stop_event: threading.Event | None = None,
        trace_id: str | None = None,
    ):
        started_at = time.perf_counter()
        package = None

        try:
            self._trace(
                trace_id,
                "ai_service stream start prompt_version=%s",
                self.prompt_version,
            )
            package = self._get_pre_rewrite_cache(question, history, trace_id)

            if package is not None:
                yield {
                    "type": "chunk",
                    "text": package.answer,
                }
                yield self._metadata_event(package)
                self._record_sources_used(package)
                return

            route = self.route_question(question, history, trace_id)

            if route["mode"] in {"greeting", "clarification"}:
                package = self._package_from_immediate(route)
                yield {
                    "type": "chunk",
                    "text": package.answer,
                }
                yield self._metadata_event(package)
                self._record_sources_used(package)
                return

            if route["mode"] == "cached":
                package = route["package"]
                yield {
                    "type": "chunk",
                    "text": package.answer,
                }
                yield self._metadata_event(package)
                self._record_sources_used(package)
                return

            if route["mode"] == "gemini_fallback":
                package = yield from self._stream_gemini_fallback(
                    question,
                    route,
                    stop_event,
                    trace_id,
                )
            else:
                package = yield from self._stream_knowledge_base(
                    question,
                    route,
                    stop_event,
                    trace_id,
                )

            if package is not None and not (stop_event and stop_event.is_set()):
                self._store_package(package, trace_id)
                self._record_sources_used(package)
        finally:
            elapsed = time.perf_counter() - started_at
            self.metrics.record_response_time(elapsed)
            self._trace(
                trace_id,
                "ai_service stream done elapsed=%.4fs cache_key=%r",
                elapsed,
                package.cache_key if package else None,
            )

    def route_question(self, question: str, history=None, trace_id: str | None = None):
        normalized_history = self.dependencies.normalize_history(history)
        self._trace(
            trace_id,
            "ai_service route start question=%r history_len=%s",
            question,
            len(normalized_history),
        )

        if self.dependencies.is_greeting(question):
            self._trace(
                trace_id,
                "Mode: Greeting Bypass. Source count returned: 0. Query: %s",
                question,
            )
            return {
                "mode": "greeting",
                "answer": self.dependencies.greeting_answer(),
                "revision": "",
                "sources": [],
                "confidence": None,
                "retrieval_query": question,
                "context": "",
                "cache_key": self._cache_key(question),
            }

        rewrite = self.dependencies.rewrite_question(
            question,
            history,
            trace_id,
        )

        if rewrite["clarification"]:
            self._trace(
                trace_id,
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
                "cache_key": "",
            }

        retrieval_query = self.dependencies.normalize_retrieval_query(rewrite["query"])
        if retrieval_query != rewrite["query"]:
            self._trace(
                trace_id,
                "ai_service normalized retrieval_query from %r to %r",
                rewrite["query"],
                retrieval_query,
            )

        cache_key = self._cache_key(retrieval_query)
        cached_package = self._get_cached_package(cache_key, trace_id)

        if cached_package is not None:
            self._trace(
                trace_id,
                "ai_service route cache hit after rewrite key=%r",
                cache_key,
            )
            return {
                "mode": "cached",
                "package": cached_package,
                "retrieval_query": retrieval_query,
                "cache_key": cache_key,
            }

        self.metrics.record_cache_miss()
        self._trace(trace_id, "ai_service route retrieval_query=%r", retrieval_query)
        rag = self.dependencies.retrieve_context(retrieval_query, trace_id)
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

        self.metrics.record_mode(mode)
        self._trace(
            trace_id,
            "Mode: %s. Reason: %s. Source count returned: %s. Query: %s",
            log_mode,
            confidence.get("reason", "unknown"),
            source_count,
            retrieval_query,
        )
        self._trace(
            trace_id,
            "ai_service route return mode=%s context_chars=%s sources=%s",
            mode,
            len(rag["context"] if mode == "knowledge_base" else ""),
            source_count,
        )

        return {
            "mode": mode,
            "answer": "",
            "revision": "",
            "sources": sources,
            "confidence": confidence,
            "retrieval_query": retrieval_query,
            "context": rag["context"] if mode == "knowledge_base" else "",
            "cache_key": cache_key,
        }

    def stats(self):
        return {
            "cache": self.cache_manager.stats(),
            "metrics": self.metrics.snapshot(),
            "prompt_version": self.prompt_version,
        }

    def _answer_from_route(self, question: str, route: dict, trace_id: str | None):
        if route["mode"] == "cached":
            return route["package"]

        if route["mode"] in {"greeting", "clarification"}:
            return self._package_from_immediate(route)

        if route["mode"] == "gemini_fallback":
            self._trace(trace_id, "ai_service ask branch=gemini_fallback sources=0")
            try:
                answer = self.dependencies.generate_general_answer(
                    question,
                    route["retrieval_query"],
                )
            except Exception as error:
                logger.warning("Unable to generate Gemini fallback answer: %s", error)
                answer = self._fallback_generation_error_text()
                route["cache_key"] = ""
                self._trace(
                    trace_id,
                    "ai_service ask graceful_generation_error mode=gemini_fallback error=%r sources=0",
                    str(error),
                )

            return self._build_package(
                answer=answer,
                revision="",
                sources=[],
                confidence=route.get("confidence"),
                cache_key=route.get("cache_key", ""),
            )

        self._trace(
            trace_id,
            "ai_service ask branch=knowledge_base context_chars=%s sources=%s",
            len(route["context"]),
            len(route["sources"]),
        )
        structured_answer = self.dependencies.generate_knowledge_answer(
            question,
            route["context"],
            route["retrieval_query"],
        )

        return self._build_package(
            answer=structured_answer["answer"],
            revision=structured_answer["revision"],
            sources=route["sources"],
            confidence=route.get("confidence"),
            cache_key=route.get("cache_key", ""),
        )

    def _stream_gemini_fallback(
        self,
        question: str,
        route: dict,
        stop_event: threading.Event | None,
        trace_id: str | None,
    ):
        self._trace(trace_id, "ai_service stream branch=gemini_fallback sources=0")
        answer_parts = []
        notice = f"{GEMINI_FALLBACK_NOTICE}\n\n"

        try:
            yield {
                "type": "chunk",
                "text": notice,
            }

            for text in self.dependencies.stream_general_answer(
                question,
                route["retrieval_query"],
            ):
                if stop_event and stop_event.is_set():
                    self._trace(
                        trace_id,
                        "ai_service stream return stopped mode=gemini_fallback answer_chars=%s sources=0",
                        len(f"{notice}{''.join(answer_parts)}"),
                    )
                    return None

                if not text:
                    continue

                answer_parts.append(text)
                yield {
                    "type": "chunk",
                    "text": text,
                }

            if not "".join(answer_parts).strip():
                answer_parts.append("No answer returned.")
                yield {
                    "type": "chunk",
                    "text": "No answer returned.",
                }

            package = self._build_package(
                answer=f"{notice}{''.join(answer_parts)}".strip(),
                revision="",
                sources=[],
                confidence=route.get("confidence"),
                cache_key=route.get("cache_key", ""),
            )
            yield self._metadata_event(package)
            self._trace(
                trace_id,
                "ai_service stream return metadata mode=gemini_fallback answer_chars=%s sources=0",
                len(package.answer),
            )
            return package
        except Exception as error:
            logger.warning("Unable to stream Gemini fallback answer: %s", error)
            error_text = self._fallback_generation_error_text()
            yield {
                "type": "chunk",
                "text": error_text.replace(notice, ""),
            }
            package = self._build_package(
                answer=error_text,
                revision="",
                sources=[],
                confidence=route.get("confidence"),
                cache_key="",
            )
            yield self._metadata_event(package)
            self._trace(
                trace_id,
                "ai_service stream return graceful_generation_error mode=gemini_fallback error=%r sources=0",
                str(error),
            )
            return None

    def _stream_knowledge_base(
        self,
        question: str,
        route: dict,
        stop_event: threading.Event | None,
        trace_id: str | None,
    ):
        context = route["context"]
        sources = route["sources"]
        self._trace(
            trace_id,
            "ai_service stream branch=knowledge_base context_chars=%s sources=%s",
            len(context),
            len(sources),
        )
        answer_parts = []

        try:
            for text in self.dependencies.stream_knowledge_answer(
                question,
                context,
                route["retrieval_query"],
            ):
                if stop_event and stop_event.is_set():
                    self._trace(
                        trace_id,
                        "ai_service stream return stopped mode=knowledge_base answer_chars=%s sources=%s",
                        len("".join(answer_parts)),
                        len(sources),
                    )
                    return None

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
                    revision = self.dependencies.generate_revision(
                        question,
                        context,
                        answer,
                    )
                except Exception as error:
                    logger.warning("Unable to generate revision metadata: %s", error)

            package = self._build_package(
                answer=answer,
                revision=revision,
                sources=sources,
                confidence=route.get("confidence"),
                cache_key=route.get("cache_key", ""),
            )
            yield self._metadata_event(package)
            self._trace(
                trace_id,
                "ai_service stream return metadata mode=knowledge_base answer_chars=%s sources=%s revision_chars=%s",
                len(answer),
                len(sources),
                len(revision or ""),
            )
            return package
        except Exception as error:
            logger.warning("Unable to stream Gemini answer: %s", error)
            self._trace(
                trace_id,
                "ai_service stream return error mode=knowledge_base error=%r",
                str(error),
            )
            yield {
                "type": "error",
                "message": "Unable to get an answer right now. Please try again.",
            }
            return None

    def _get_pre_rewrite_cache(self, question: str, history, trace_id: str | None):
        normalized_history = self.dependencies.normalize_history(history)

        if self.normalizer.needs_history_before_cache(question, normalized_history):
            self._trace(
                trace_id,
                "ai_service cache pre-rewrite skipped history_dependent_question=%r",
                question,
            )
            return None

        cache_key = self._cache_key(question)
        package = self._get_cached_package(cache_key, trace_id)

        return package

    def _get_cached_package(self, cache_key: str, trace_id: str | None):
        if not cache_key:
            return None

        cached = self.cache_manager.get(cache_key)

        if not cached:
            self._trace(trace_id, "ai_service cache miss key=%r", cache_key)
            return None

        package = AnswerPackage.from_dict(cached)

        if package.prompt_version != self.prompt_version:
            self._trace(
                trace_id,
                "ai_service cache stale key=%r cached_prompt_version=%s current_prompt_version=%s",
                cache_key,
                package.prompt_version,
                self.prompt_version,
            )
            return None

        self.metrics.record_cache_hit()
        self.metrics.record_mode((package.confidence or {}).get("mode", ""))
        self._trace(
            trace_id,
            "ai_service cache hit key=%r answer_chars=%s sources=%s prompt_version=%s",
            cache_key,
            len(package.answer),
            len(package.sources or []),
            package.prompt_version,
        )
        return package

    def _store_package(self, package: AnswerPackage, trace_id: str | None):
        if not package.cache_key:
            self._trace(trace_id, "ai_service cache store skipped missing_cache_key")
            return

        if not package.answer.strip():
            self._trace(trace_id, "ai_service cache store skipped empty_answer")
            return

        self.cache_manager.set(package.cache_key, package.to_dict())
        self._trace(
            trace_id,
            "ai_service cache store key=%r prompt_version=%s answer_chars=%s sources=%s",
            package.cache_key,
            package.prompt_version,
            len(package.answer),
            len(package.sources or []),
        )

    def _record_sources_used(self, package: AnswerPackage | None):
        if (
            not package
            or not package.sources
            or not self.dependencies.record_sources_used
        ):
            return

        try:
            self.dependencies.record_sources_used(package.sources)
        except Exception as error:
            logger.warning("Unable to record library source usage: %s", error)

    def _cache_key(self, question: str):
        return self.normalizer.cache_key(question)

    def _package_from_immediate(self, route: dict):
        return self._build_package(
            answer=route["answer"],
            revision="",
            sources=[],
            confidence=route.get("confidence"),
            cache_key=route.get("cache_key", ""),
        )

    def _build_package(
        self,
        answer: str,
        revision: str,
        sources: list[dict],
        confidence: dict | None,
        cache_key: str,
    ):
        return AnswerPackage(
            answer=answer,
            revision=revision,
            summary="",
            related_topics=[],
            sources=sources or [],
            confidence=confidence,
            cache_key=cache_key,
            prompt_version=self.prompt_version,
        )

    def _metadata_event(self, package: AnswerPackage):
        return {
            "type": "metadata",
            "sources": package.sources,
            "revision": package.revision,
            "confidence": package.confidence,
        }

    def _fallback_generation_error_text(self):
        return (
            f"{GEMINI_FALLBACK_NOTICE}\n\n"
            "Gemini fallback mode was selected, but Gemini could not generate "
            "an answer right now. Please try again after checking the Gemini "
            "API credentials."
        )

    def _trace(self, trace_id: str | None, message: str, *args):
        self.dependencies.trace(trace_id, message, *args)
