from __future__ import annotations

import json
import time
import uuid
from dataclasses import dataclass
from urllib.parse import urlparse

from fastapi import UploadFile
from minio import Minio
from urllib3 import PoolManager, Timeout

from app.core.config import Settings, get_settings

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


class InvalidImageFile(ValueError):
    pass


@dataclass(frozen=True)
class StoredImage:
    object_name: str
    public_url: str
    content_type: str
    size_bytes: int


def _parse_minio_endpoint(endpoint: str) -> tuple[str, bool, str]:
    parsed = urlparse(endpoint)
    if parsed.scheme and parsed.netloc:
        return parsed.netloc, parsed.scheme == "https", parsed.path.rstrip("/")

    return endpoint, False, ""


def _get_minio_client(settings: Settings | None = None) -> Minio:
    settings = settings or get_settings()
    endpoint, secure, path_prefix = _parse_minio_endpoint(settings.minio_endpoint)
    client = Minio(
        endpoint,
        access_key=settings.minio_root_user,
        secret_key=settings.minio_root_password,
        secure=secure,
        region=settings.minio_region,
        http_client=PoolManager(
            timeout=Timeout(connect=3.0, read=3.0),
            retries=False,
        ),
    )
    if path_prefix:
        _add_path_prefix(client, path_prefix)
    return client


def _add_path_prefix(client: Minio, path_prefix: str) -> None:
    normalized_prefix = path_prefix.rstrip("/")
    original_build = client._base_url.build

    def build_with_prefix(*args, **kwargs):
        url = original_build(*args, **kwargs)
        return url._replace(path=_with_path_prefix(url.path, normalized_prefix))

    client._base_url.build = build_with_prefix


def _with_path_prefix(path: str, prefix: str) -> str:
    normalized_prefix = prefix.rstrip("/")
    if not normalized_prefix:
        return path
    if path == "/":
        return normalized_prefix
    return f"{normalized_prefix}{path}"


def ensure_listing_images_bucket(settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    client = _get_minio_client(settings)
    bucket_name = settings.minio_bucket_listing_images

    for attempt in range(1, 11):
        try:
            if not client.bucket_exists(bucket_name):
                client.make_bucket(bucket_name)
            client.set_bucket_policy(bucket_name, _public_read_policy(bucket_name))
            return
        except Exception as exc:
            if attempt == 10:
                raise RuntimeError(
                    f"Unable to initialize object-storage bucket '{bucket_name}'."
                ) from exc
            time.sleep(1)


def check_listing_images_bucket(settings: Settings | None = None) -> bool:
    settings = settings or get_settings()
    bucket_name = (settings.minio_bucket_listing_images or "").strip()
    if not bucket_name:
        raise RuntimeError("MINIO_BUCKET_LISTING_IMAGES is not configured.")

    client = _get_minio_client(settings)
    try:
        if not client.bucket_exists(bucket_name):
            raise RuntimeError(
                f"Object-storage bucket '{bucket_name}' does not exist."
            )
    except RuntimeError:
        raise
    except Exception as exc:
        raise RuntimeError(
            f"Object-storage readiness check failed for bucket '{bucket_name}'."
        ) from exc

    return True


def _public_read_policy(bucket_name: str) -> str:
    return json.dumps(
        {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{bucket_name}/*"],
                }
            ],
        }
    )


class MinioImageStorage:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.client = _get_minio_client(self.settings)
        self.bucket_name = self.settings.minio_bucket_listing_images

    def upload_listing_image(
        self,
        listing_id: uuid.UUID,
        file: UploadFile,
    ) -> StoredImage:
        extension = self._validate_image(file)
        object_name = f"listings/{listing_id}/{uuid.uuid4()}{extension}"
        size = self._get_file_size(file)
        content_type = (file.content_type or "").lower()

        self.client.put_object(
            self.bucket_name,
            object_name,
            file.file,
            length=size,
            content_type=content_type,
        )

        return StoredImage(
            object_name=object_name,
            public_url=self.build_public_url(object_name),
            content_type=content_type,
            size_bytes=size,
        )

    def build_public_url(self, object_name: str) -> str:
        public_url = self.settings.minio_public_url.rstrip("/")
        return f"{public_url}/{self.bucket_name}/{object_name}"

    def remove_listing_image(self, object_name: str) -> None:
        self.client.remove_object(self.bucket_name, object_name)

    def _validate_image(self, file: UploadFile) -> str:
        content_type = (file.content_type or "").lower()
        extension = ALLOWED_IMAGE_TYPES.get(content_type)
        if extension is None:
            raise InvalidImageFile("Only JPEG, PNG, and WebP images are allowed.")
        return extension

    def _get_file_size(self, file: UploadFile) -> int:
        file.file.seek(0, 2)
        size = file.file.tell()
        file.file.seek(0)
        if size <= 0:
            raise InvalidImageFile("Uploaded image file is empty.")
        max_size = self.settings.max_image_upload_mb * 1024 * 1024
        if size > max_size:
            raise InvalidImageFile(
                f"Uploaded image exceeds the {self.settings.max_image_upload_mb} MB limit."
            )
        return size
