from __future__ import annotations

from abc import ABC, abstractmethod
import json
import logging
import os
from pathlib import Path
import threading


logger = logging.getLogger(__name__)


class CacheManager(ABC):
    @abstractmethod
    def get(self, key: str):
        raise NotImplementedError

    @abstractmethod
    def set(self, key: str, value: dict):
        raise NotImplementedError

    @abstractmethod
    def invalidate(self, key: str):
        raise NotImplementedError

    @abstractmethod
    def exists(self, key: str):
        raise NotImplementedError

    @abstractmethod
    def stats(self):
        raise NotImplementedError


class LocalJSONCacheManager(CacheManager):
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self._lock = threading.Lock()

    def get(self, key: str):
        with self._lock:
            return self._load().get(key)

    def set(self, key: str, value: dict):
        with self._lock:
            cache = self._load()
            cache[key] = value
            self._persist(cache)
            return value

    def invalidate(self, key: str):
        with self._lock:
            cache = self._load()
            existed = key in cache
            cache.pop(key, None)
            self._persist(cache)
            return existed

    def exists(self, key: str):
        with self._lock:
            return key in self._load()

    def stats(self):
        with self._lock:
            cache = self._load()
            return {
                "backend": "local_json",
                "path": str(self.path),
                "entries": len(cache),
            }

    def _load(self):
        if not self.path.exists():
            return {}

        try:
            with self.path.open("r", encoding="utf-8") as handle:
                payload = json.load(handle)
        except (OSError, json.JSONDecodeError) as error:
            logger.warning("Unable to read AI cache '%s': %s", self.path, error)
            return {}

        if not isinstance(payload, dict):
            logger.warning("AI cache '%s' did not contain an object.", self.path)
            return {}

        return payload

    def _persist(self, cache: dict):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = self.path.with_suffix(f"{self.path.suffix}.tmp")

        with temp_path.open("w", encoding="utf-8") as handle:
            json.dump(cache, handle, ensure_ascii=False, indent=2, sort_keys=True)

        os.replace(temp_path, self.path)
