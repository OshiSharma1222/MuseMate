"""Pydantic request/response models for the API routers."""

from __future__ import annotations

from pydantic import BaseModel, Field


class CreateVisitorRequest(BaseModel):
    deviceId: str = "CONSOLE-01"
    lang: str = "en"
    group: str = "solo"


class CreateVisitorResponse(BaseModel):
    visitorId: str
    lang: str
    needsMode: bool
    prompt: str


class SetModeRequest(BaseModel):
    mode: str  # default | quick | detailed | child


class SetLangRequest(BaseModel):
    lang: str


class TapRequest(BaseModel):
    nfcTag: str = Field(description="The NFC tag UID, or an artifact id like 'A007' for testing.")


class TapResponse(BaseModel):
    artifactId: str
    name: str
    gallery: str
    narration: str
    audioBase64: str | None = None
    sampleRate: int | None = None


class TextQueryRequest(BaseModel):
    text: str
    lang: str | None = None


class QueryResponse(BaseModel):
    answer: str
    topic: str
    status: str
    artifactId: str | None
    needsTap: bool = False


class EndVisitRequest(BaseModel):
    rating: int | None = None
    reviewText: str | None = None
    reviewTextEn: str | None = None
    reviewTags: list[str] | None = None


class ArtifactPatch(BaseModel):
    name: str | None = None
    kind: str | None = None
    gallery: str | None = None
    period: str | None = None
    region: str | None = None
    material: str | None = None
    dimensions: str | None = None
    description: str | None = None
    history: str | None = None
    provenance: str | None = None
    ownership: str | None = None
    curatorNotes: str | None = None
    verified: bool | None = None
    narrationLangs: list[str] | None = None
