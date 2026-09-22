"""Cache abstraction — Redis if available, else in-memory with TTL (Phase 11)

- Used for permission caching per بند 48
- Also for rate limiting and general caching
- Falls back to in-memory when REDIS_URL is None or Redis unavailable (Local-First)
"""

from __future__ import annotations

import asyncio
import json
import time
from typing import Any

from app.core.config import settings
from app.core.logging import logger

# In-memory fallback store: key -> (value, expires_at)
_memory_store: dict[str, tuple[Any, float | None]] = {}
_memory_lock = asyncio.Lock()


class CacheBackend:
    async def get(self, key: str) -> Any | None: ...
    async def set(self, key: str, value: Any, ttl: int | None = None) -> None: ...
    async def delete(self, key: str) -> None: ...
    async def delete_pattern(self, pattern: str) -> None: ...
    async def incr(self, key: str, ttl: int | None = None) -> int: ...


class MemoryCache(CacheBackend):
    async def get(self, key: str) -> Any | None:
        async with _memory_lock:
            entry = _memory_store.get(key)
            if not entry:
                return None
            value, expires_at = entry
            if expires_at is not None and time.time() > expires_at:
                _memory_store.pop(key, None)
                return None
            return value

    async def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        expires_at = time.time() + ttl if ttl else None
        async with _memory_lock:
            _memory_store[key] = (value, expires_at)

    async def delete(self, key: str) -> None:
        async with _memory_lock:
            _memory_store.pop(key, None)

    async def delete_pattern(self, pattern: str) -> None:
        # Simple prefix* support
        if pattern.endswith("*"):
            prefix = pattern[:-1]
            async with _memory_lock:
                keys = [k for k in _memory_store if k.startswith(prefix)]
                for k in keys:
                    _memory_store.pop(k, None)
        else:
            await self.delete(pattern)

    async def incr(self, key: str, ttl: int | None = None) -> int:
        async with _memory_lock:
            entry = _memory_store.get(key)
            if not entry:
                val = 1
                expires_at = time.time() + ttl if ttl else None
                _memory_store[key] = (val, expires_at)
                return val
            value, expires_at = entry
            if expires_at is not None and time.time() > expires_at:
                val = 1
                expires_at = time.time() + ttl if ttl else None
                _memory_store[key] = (val, expires_at)
                return val
            try:
                new_val = int(value) + 1
            except Exception:
                new_val = 1
            _memory_store[key] = (new_val, expires_at)
            return new_val


class RedisCache(CacheBackend):
    def __init__(self, redis_client):
        self.redis = redis_client

    async def get(self, key: str) -> Any | None:
        try:
            raw = await self.redis.get(key)
            if raw is None:
                return None
            # Try JSON decode, fallback to raw
            try:
                return json.loads(raw)
            except Exception:
                # If it's bytes, decode
                if isinstance(raw, bytes):
                    try:
                        return json.loads(raw.decode())
                    except Exception:
                        return raw.decode() if isinstance(raw, bytes) else raw
                return raw
        except Exception as e:
            logger.warning(f"redis get failed {key}: {e}")
            return None

    async def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        try:
            # Serialize
            if isinstance(value, (dict, list)):
                raw = json.dumps(value, ensure_ascii=False)
            elif isinstance(value, (int, float, bool)):
                raw = json.dumps(value)
            elif isinstance(value, str):
                # Store as JSON string to distinguish from raw?
                # For simplicity, store string as-is if not JSON
                raw = value
            else:
                raw = json.dumps(value, default=str)

            if ttl:
                await self.redis.setex(key, ttl, raw)
            else:
                await self.redis.set(key, raw)
        except Exception as e:
            logger.warning(f"redis set failed {key}: {e}")

    async def delete(self, key: str) -> None:
        try:
            await self.redis.delete(key)
        except Exception as e:
            logger.warning(f"redis delete failed {key}: {e}")

    async def delete_pattern(self, pattern: str) -> None:
        try:
            # Use SCAN
            async for key in self.redis.scan_iter(match=pattern):
                await self.redis.delete(key)
        except Exception as e:
            logger.warning(f"redis delete_pattern failed {pattern}: {e}")

    async def incr(self, key: str, ttl: int | None = None) -> int:
        try:
            pipe = self.redis.pipeline()
            pipe.incr(key)
            if ttl:
                pipe.expire(key, ttl)
            results = await pipe.execute()
            return int(results[0])
        except Exception as e:
            logger.warning(f"redis incr failed {key}: {e}")
            return 1


# Singleton
_cache_instance: CacheBackend | None = None
_redis_client = None


async def get_cache() -> CacheBackend:
    global _cache_instance, _redis_client
    if _cache_instance is not None:
        return _cache_instance

    if settings.REDIS_URL:
        try:
            import redis.asyncio as redis_async

            _redis_client = redis_async.from_url(settings.REDIS_URL, decode_responses=False)
            # Test connection
            await _redis_client.ping()
            _cache_instance = RedisCache(_redis_client)
            logger.info(f"cache: using Redis {settings.REDIS_URL}")
            return _cache_instance
        except Exception as e:
            logger.warning(f"cache: Redis unavailable {e}, falling back to memory")
            _cache_instance = MemoryCache()
            return _cache_instance
    else:
        _cache_instance = MemoryCache()
        logger.info("cache: using in-memory (REDIS_URL not set)")
        return _cache_instance


# Convenience helpers for permissions caching (بند 48)
def perm_cache_key(user_id: int, org_id: int, permissions_version: int) -> str:
    return f"perms:{user_id}:{org_id}:{permissions_version}"


def perms_invalidate_key(user_id: int, org_id: int) -> str:
    # Pattern to delete all versions for user+org
    return f"perms:{user_id}:{org_id}:*"
