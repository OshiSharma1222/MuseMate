"""Loads the static museum/gallery/directions JSON once and exposes lookups."""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache

from ..config import get_settings


@dataclass(frozen=True)
class Node:
    id: str
    name: str
    floor: str
    kind: str  # "gallery" | "facility"


@dataclass(frozen=True)
class MuseumData:
    info: dict
    nodes: dict[str, Node]
    adjacency: dict[str, list[tuple[str, str]]]  # node_id -> [(neighbour_id, direction_text)]

    def node_name(self, node_id: str) -> str:
        node = self.nodes.get(node_id)
        return node.name if node else node_id

    def match_destination(self, free_text: str) -> str | None:
        """Very small keyword matcher: finds a node id whose name (or a common
        alias) appears in the visitor's free-text question. Good enough for a
        museum with a few dozen named places; swap for embeddings if needed.
        """
        text = free_text.lower()
        aliases = {
            "washroom": None,  # resolved to nearest floor by caller if ambiguous
            "toilet": None,
            "bathroom": None,
            "restroom": None,
            "cafe": "cafe",
            "café": "cafe",
            "canteen": "cafe",
            "snack": "cafe",
            "shop": "museum_shop",
            "souvenir": "museum_shop",
            "exit": "exit",
            "way out": "exit",
            "cloakroom": "cloakroom",
            "locker": "cloakroom",
            "lift": "lift",
            "elevator": "lift",
            "wheelchair": "lift",
            "entrance": "entrance",
            "auditorium": "auditorium",
        }
        for alias, node_id in aliases.items():
            if alias in text and node_id:
                return node_id
        for node_id, node in self.nodes.items():
            if node.name.lower() in text or node_id.replace("_", " ") in text:
                return node_id
        if any(w in text for w in ("washroom", "toilet", "bathroom", "restroom")):
            return "washroom_ground"
        return None


@lru_cache
def load_museum_data() -> MuseumData:
    settings = get_settings()
    with open(settings.museum_json, encoding="utf-8") as f:
        museum = json.load(f)
    with open(settings.directions_json, encoding="utf-8") as f:
        directions = json.load(f)

    nodes: dict[str, Node] = {}
    for g in museum["galleries"]:
        nodes[g["id"]] = Node(id=g["id"], name=g["name"], floor=g["floor"], kind="gallery")
    for fac in museum["facilities"]:
        nodes[fac["id"]] = Node(id=fac["id"], name=fac["name"], floor=fac["floor"], kind="facility")

    adjacency: dict[str, list[tuple[str, str]]] = {node_id: [] for node_id in nodes}
    for edge in directions["edges"]:
        a, b = edge["from"], edge["to"]
        adjacency.setdefault(a, []).append((b, edge["forward"]))
        adjacency.setdefault(b, []).append((a, edge["backward"]))

    return MuseumData(info=museum, nodes=nodes, adjacency=adjacency)
