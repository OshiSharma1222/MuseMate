#!/usr/bin/env python3
"""(Re)seeds the artifact catalogue from data/artifacts.json.

Usage:
    python backend/scripts/seed_dataset.py            # add any missing artifacts
    python backend/scripts/seed_dataset.py --reset     # wipe the whole DB file first
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from backend.app.config import get_settings  # noqa: E402
from backend.app.db.init_db import init_db, seed_artifacts_if_empty  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="Delete the existing sqlite file first.")
    args = parser.parse_args()

    settings = get_settings()
    if args.reset and settings.database_url.startswith("sqlite:///"):
        db_path = Path(settings.database_url.removeprefix("sqlite:///"))
        if db_path.exists():
            db_path.unlink()
            print(f"Deleted {db_path}")

    init_db()
    n = seed_artifacts_if_empty()
    print(f"Seed complete. {n} new artifacts inserted this run.")


if __name__ == "__main__":
    main()
