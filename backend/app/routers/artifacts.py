from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db.models import ArtifactRecord
from ..db.session import get_db
from ..core.serializers import artifact_to_json
from ..schemas import ArtifactPatch

router = APIRouter(tags=["artifacts"])


@router.get("/artifacts")
def list_artifacts(db: Session = Depends(get_db)):
    rows = db.query(ArtifactRecord).order_by(ArtifactRecord.gallery, ArtifactRecord.id).all()
    return [artifact_to_json(a) for a in rows]


@router.get("/artifacts/{artifact_id}")
def get_artifact(artifact_id: str, db: Session = Depends(get_db)):
    a = db.get(ArtifactRecord, artifact_id)
    if a is None:
        raise HTTPException(404, f"No artifact '{artifact_id}'")
    return artifact_to_json(a)


@router.patch("/artifacts/{artifact_id}")
def patch_artifact(artifact_id: str, patch: ArtifactPatch, db: Session = Depends(get_db)):
    a = db.get(ArtifactRecord, artifact_id)
    if a is None:
        raise HTTPException(404, f"No artifact '{artifact_id}'")

    field_map = {
        "name": "name",
        "kind": "kind",
        "gallery": "gallery",
        "period": "period",
        "region": "region",
        "material": "material",
        "dimensions": "dimensions",
        "description": "description",
        "history": "history",
        "provenance": "provenance",
        "ownership": "ownership",
        "curatorNotes": "curator_notes",
        "verified": "verified",
        "narrationLangs": "narration_langs",
    }
    data = patch.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(a, field_map[key], value)
    a.updated_at = int(datetime.now(timezone.utc).timestamp() * 1000)
    db.flush()
    return artifact_to_json(a)
