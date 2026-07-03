from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone


def _utc_now_iso():
    return datetime.now(timezone.utc).isoformat()


@dataclass
class AnswerPackage:
    answer: str
    revision: str = ""
    summary: str = ""
    related_topics: list[str] = field(default_factory=list)
    sources: list[dict] = field(default_factory=list)
    confidence: dict | None = None
    created_at: str = field(default_factory=_utc_now_iso)
    cache_key: str = ""
    prompt_version: str = "v1"
    mcqs: list[dict] = field(default_factory=list)
    flashcards: list[dict] = field(default_factory=list)
    mind_map: dict | None = None
    study_plan: dict | None = None
    essay_feedback: dict | None = None

    @classmethod
    def from_dict(cls, payload: dict):
        payload = payload or {}
        return cls(
            answer=str(payload.get("answer") or ""),
            revision=str(payload.get("revision") or ""),
            summary=str(payload.get("summary") or ""),
            related_topics=list(payload.get("related_topics") or []),
            sources=list(payload.get("sources") or []),
            confidence=payload.get("confidence"),
            created_at=str(payload.get("created_at") or _utc_now_iso()),
            cache_key=str(payload.get("cache_key") or ""),
            prompt_version=str(payload.get("prompt_version") or "v1"),
            mcqs=list(payload.get("mcqs") or []),
            flashcards=list(payload.get("flashcards") or []),
            mind_map=payload.get("mind_map"),
            study_plan=payload.get("study_plan"),
            essay_feedback=payload.get("essay_feedback"),
        )

    def to_dict(self):
        return asdict(self)

    def to_chat_response(self):
        return {
            "answer": self.answer,
            "revision": self.revision,
            "summary": self.summary,
            "related_topics": self.related_topics,
            "sources": self.sources,
            "confidence": self.confidence,
            "created_at": self.created_at,
            "cache_key": self.cache_key,
            "prompt_version": self.prompt_version,
            "mcqs": self.mcqs,
            "flashcards": self.flashcards,
            "mind_map": self.mind_map,
            "study_plan": self.study_plan,
            "essay_feedback": self.essay_feedback,
        }
