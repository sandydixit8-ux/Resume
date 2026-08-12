"""File storage abstraction.

Backends:
  - "local": files on the server disk (dev / VPS default)
  - "supabase": files in Supabase Storage

Switch with STORAGE_BACKEND=supabase plus SUPABASE_URL / SUPABASE_SERVICE_KEY /
SUPABASE_STORAGE_BUCKET.
"""

import logging
from pathlib import Path

from app.config import get_settings

logger = logging.getLogger("app.storage")


class FileStorage:
    def __init__(self) -> None:
        self.settings = get_settings()

    @property
    def backend_name(self) -> str:
        return self.settings.storage_backend

    def save(self, filename: str, data: bytes) -> str:
        """Persist bytes and return the storage key / path used to reference them."""
        if self.settings.storage_backend == "supabase":
            return self._save_supabase(filename, data)
        return self._save_local(filename, data)

    def open_bytes(self, key: str) -> bytes:
        if self.settings.storage_backend == "supabase":
            return self._open_supabase(key)
        return self._open_local(key)

    def delete(self, key: str) -> None:
        if self.settings.storage_backend == "supabase":
            self._delete_supabase(key)
        else:
            self._delete_local(key)

    # --- local ---

    def _save_local(self, filename: str, data: bytes) -> str:
        upload_dir = Path(self.settings.upload_dir)
        upload_dir.mkdir(parents=True, exist_ok=True)
        fp = upload_dir / filename
        with open(fp, "wb") as f:
            f.write(data)
        logger.debug("saved upload locally", extra={"event": "storage_local_save", "key": str(fp)})
        return str(fp)

    def _open_local(self, key: str) -> bytes:
        with open(key, "rb") as f:
            return f.read()

    def _delete_local(self, key: str) -> None:
        p = Path(key)
        if p.exists():
            p.unlink()
            logger.debug("deleted upload locally", extra={"event": "storage_local_delete", "key": str(p)})

    # --- supabase ---

    def _client(self):
        from supabase import create_client

        if not self.settings.supabase_url or not self.settings.supabase_service_key:
            raise RuntimeError(
                "Supabase storage is enabled but SUPABASE_URL / SUPABASE_SERVICE_KEY are not set"
            )
        return create_client(self.settings.supabase_url, self.settings.supabase_service_key)

    def _bucket(self, client):
        return client.storage.from_(self.settings.supabase_storage_bucket)

    def _ensure_bucket(self, client) -> None:
        try:
            client.storage.get_bucket(self.settings.supabase_storage_bucket)
        except Exception:
            client.storage.create_bucket(self.settings.supabase_storage_bucket)
            logger.info(
                "created supabase bucket",
                extra={"event": "storage_supabase_bucket", "bucket": self.settings.supabase_storage_bucket},
            )

    def _save_supabase(self, filename: str, data: bytes) -> str:
        client = self._client()
        self._ensure_bucket(client)
        bucket = self._bucket(client)
        path = f"resumes/{filename}"
        bucket.upload(path, data, {"content-type": "application/octet-stream"})
        logger.info(
            "saved upload to supabase storage",
            extra={"event": "storage_supabase_save", "key": path},
        )
        return path

    def _open_supabase(self, key: str) -> bytes:
        client = self._client()
        res = self._bucket(client).download(key)
        if res is None:
            raise FileNotFoundError(f"Object not found in storage: {key}")
        return res

    def _delete_supabase(self, key: str) -> None:
        client = self._client()
        try:
            self._bucket(client).remove([key])
            logger.info(
                "deleted upload from supabase storage",
                extra={"event": "storage_supabase_delete", "key": key},
            )
        except Exception as e:
            logger.warning("failed to delete storage object", extra={"key": key, "error": str(e)})


_storage: FileStorage | None = None


def get_storage() -> FileStorage:
    global _storage
    if _storage is None:
        _storage = FileStorage()
    return _storage
