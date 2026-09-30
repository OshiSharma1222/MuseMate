"""BFS way-finding from the visitor's last-tapped artifact's gallery to a
named destination (another gallery or a facility like washroom/café/exit).
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass

from .museum_data import MuseumData, load_museum_data


@dataclass
class DirectionsResult:
    found: bool
    origin_name: str
    destination_name: str
    steps: list[str]


def find_path(origin_node_id: str, destination_node_id: str, data: MuseumData | None = None) -> DirectionsResult:
    data = data or load_museum_data()
    origin_name = data.node_name(origin_node_id)
    destination_name = data.node_name(destination_node_id)

    if origin_node_id == destination_node_id:
        return DirectionsResult(True, origin_name, destination_name, ["You're already there."])

    if origin_node_id not in data.nodes or destination_node_id not in data.nodes:
        return DirectionsResult(False, origin_name, destination_name, [])

    # BFS for shortest hop path
    prev: dict[str, tuple[str, str]] = {}  # node -> (parent, edge_text)
    visited = {origin_node_id}
    queue = deque([origin_node_id])
    while queue:
        current = queue.popleft()
        if current == destination_node_id:
            break
        for neighbour, text in data.adjacency.get(current, []):
            if neighbour not in visited:
                visited.add(neighbour)
                prev[neighbour] = (current, text)
                queue.append(neighbour)

    if destination_node_id not in visited:
        return DirectionsResult(False, origin_name, destination_name, [])

    steps: list[str] = []
    node = destination_node_id
    while node != origin_node_id:
        parent, text = prev[node]
        steps.append(text)
        node = parent
    steps.reverse()
    return DirectionsResult(True, origin_name, destination_name, steps)


def resolve_gallery_for_artifact(artifact_gallery_id: str) -> str:
    """An artifact's gallery id IS a node id in the directions graph, so this
    is an identity function today; kept as a seam in case galleries and
    directions-graph nodes ever diverge.
    """
    return artifact_gallery_id
