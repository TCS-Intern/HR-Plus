"""Storage service for file uploads/downloads to Supabase Storage."""

import logging
import uuid
from pathlib import Path
from typing import BinaryIO

from app.services.supabase import get_supabase_client

logger = logging.getLogger(__name__)


class StorageService:
    """Service for managing files in Supabase Storage."""

    BUCKET_RESUMES = "resumes"
    BUCKET_VIDEOS = "videos"
    BUCKET_DOCUMENTS = "documents"

    def __init__(self):
        self.client = get_supabase_client()
        self._ensured_buckets: set[str] = set()

    def _ensure_bucket(self, bucket: str) -> None:
        """Create a storage bucket if it doesn't exist."""
        if bucket in self._ensured_buckets:
            return
        try:
            self.client.storage.get_bucket(bucket)
        except Exception:
            try:
                self.client.storage.create_bucket(bucket, options={"public": False})
                logger.info(f"Created storage bucket: {bucket}")
            except Exception as e:
                # Bucket may have been created concurrently
                if "already exists" not in str(e).lower():
                    logger.warning(f"Could not create bucket {bucket}: {e}")
        self._ensured_buckets.add(bucket)

    def _generate_path(self, bucket: str, filename: str, prefix: str | None = None) -> str:
        """Generate a unique storage path for a file."""
        file_ext = Path(filename).suffix
        unique_id = str(uuid.uuid4())
        if prefix:
            return f"{prefix}/{unique_id}{file_ext}"
        return f"{unique_id}{file_ext}"

    async def upload_resume(
        self,
        file: BinaryIO,
        filename: str,
        candidate_id: str | None = None,
        content_type: str = "application/pdf",
    ) -> str:
        """Upload a resume file.

        Args:
            file: File-like object to upload
            filename: Original filename
            candidate_id: Optional candidate ID for organizing files
            content_type: MIME type of the file

        Returns:
            Storage path of the uploaded file
        """
        prefix = f"candidates/{candidate_id}" if candidate_id else "uploads"
        path = self._generate_path(self.BUCKET_RESUMES, filename, prefix)

        self._ensure_bucket(self.BUCKET_RESUMES)
        self.client.storage.from_(self.BUCKET_RESUMES).upload(
            path=path,
            file=file,
            file_options={"content-type": content_type},
        )
        return path

    async def upload_video(
        self,
        file: BinaryIO,
        filename: str,
        assessment_id: str | None = None,
        content_type: str = "video/webm",
    ) -> str:
        """Upload a video file.

        Args:
            file: File-like object to upload
            filename: Original filename
            assessment_id: Optional assessment ID for organizing files
            content_type: MIME type of the file

        Returns:
            Storage path of the uploaded file
        """
        prefix = f"assessments/{assessment_id}" if assessment_id else "uploads"
        path = self._generate_path(self.BUCKET_VIDEOS, filename, prefix)

        self._ensure_bucket(self.BUCKET_VIDEOS)
        self.client.storage.from_(self.BUCKET_VIDEOS).upload(
            path=path,
            file=file,
            file_options={"content-type": content_type},
        )
        return path

    async def upload_document(
        self,
        file: BinaryIO,
        filename: str,
        folder: str = "general",
        content_type: str = "application/pdf",
    ) -> str:
        """Upload a document file (offer letters, contracts, etc.).

        Args:
            file: File-like object to upload
            filename: Original filename
            folder: Folder to organize the document
            content_type: MIME type of the file

        Returns:
            Storage path of the uploaded file
        """
        path = self._generate_path(self.BUCKET_DOCUMENTS, filename, folder)

        self._ensure_bucket(self.BUCKET_DOCUMENTS)
        self.client.storage.from_(self.BUCKET_DOCUMENTS).upload(
            path=path,
            file=file,
            file_options={"content-type": content_type},
        )
        return path

    def get_public_url(self, bucket: str, path: str) -> str:
        """Get public URL for a file (only works if bucket is public)."""
        return self.client.storage.from_(bucket).get_public_url(path)

    def get_signed_url(self, bucket: str, path: str, expires_in: int = 3600) -> str:
        """Get a signed URL for private file access.

        Args:
            bucket: Storage bucket name
            path: File path in the bucket
            expires_in: URL expiration time in seconds (default 1 hour)

        Returns:
            Signed URL for file access
        """
        result = self.client.storage.from_(bucket).create_signed_url(path, expires_in)
        return result.get("signedURL", "")

    async def download_file(self, bucket: str, path: str) -> bytes:
        """Download a file from storage.

        Args:
            bucket: Storage bucket name
            path: File path in the bucket

        Returns:
            File contents as bytes
        """
        return self.client.storage.from_(bucket).download(path)

    async def delete_file(self, bucket: str, path: str) -> bool:
        """Delete a file from storage.

        Args:
            bucket: Storage bucket name
            path: File path in the bucket

        Returns:
            True if deleted successfully
        """
        try:
            self.client.storage.from_(bucket).remove([path])
            return True
        except Exception:
            return False

    def list_files(self, bucket: str, prefix: str = "") -> list[dict]:
        """List files in a bucket with optional prefix.

        Args:
            bucket: Storage bucket name
            prefix: Optional path prefix to filter files

        Returns:
            List of file metadata dictionaries
        """
        return self.client.storage.from_(bucket).list(prefix)


# Singleton instance
storage = StorageService()
