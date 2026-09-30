"""Creates tables (if missing) and seeds the artifact catalogue from
`data/artifacts.json` on first run. Safe to call every startup: it only
inserts artifacts that aren't already in the DB, so curator edits made via
`PATCH /artifacts/:id` are never overwritten by a restart.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy import select

from ..config import get_settings
from .models import ArtifactRecord
from .session import create_all, get_db_session


def _to_epoch_ms(iso_str: str) -> int:
    dt = datetime.fromisoformat(iso_str).replace(tzinfo=timezone.utc)
    return int(dt.timestamp() * 1000)


def seed_artifacts_if_empty() -> int:
    settings = get_settings()
    with open(settings.artifacts_json, encoding="utf-8") as f:
        payload = json.load(f)

    inserted = 0
    with get_db_session() as db:
        existing_ids = {row for row, in db.execute(select(ArtifactRecord.id))}
        for entry in payload["artifacts"]:
            if entry["id"] in existing_ids:
                continue
            db.add(
                ArtifactRecord(
                    id=entry["id"],
                    accession=entry["accession"],
                    nfc_tag=entry["nfcTag"],
                    name=entry["name"],
                    kind=entry["kind"],
                    gallery=entry["gallery"],
                    period=entry.get("period", ""),
                    region=entry.get("region", ""),
                    material=entry.get("material", ""),
                    dimensions=entry.get("dimensions", ""),
                    description=entry.get("description", ""),
                    history=entry.get("history", ""),
                    provenance=entry.get("provenance", ""),
                    ownership=entry.get("ownership", ""),
                    curator_notes=entry.get("curatorNotes", ""),
                    verified=entry.get("verified", True),
                    narration_langs=entry.get("narrationLangs", []),
                    common_questions=entry.get("commonQuestions", []),
                    updated_at=_to_epoch_ms(entry.get("updatedAt", "2026-01-01T00:00:00")),
                )
            )
            inserted += 1
    return inserted


def init_db() -> None:
    create_all()
    n = seed_artifacts_if_empty()
    if n:
        print(f"[init_db] seeded {n} artifacts from artifacts.json")
