import os
import re
import uuid
from typing import Iterable, List, Tuple, Dict, Any, Optional
import xml.etree.ElementTree as ET


def _parse_float(val: Optional[str], default: float = 0.0) -> float:
    if val is None:
        return default
    try:
        # remove common units like 'px'
        return float(re.sub(r"[a-zA-Z%]+$", "", val.strip()))
    except Exception:
        return default


def svg_to_coords(svg_path: str) -> List[Tuple[float, float]]:
    """
    Parse an SVG file and return a list of (x, y) positions for <circle> elements.
    - Supports namespaced SVGs.
    - Uses 'cx' and 'cy' attributes; ignores radius for coordinate output.
    """
    if not os.path.exists(svg_path):
        raise FileNotFoundError(f"SVG not found: {svg_path}")

    tree = ET.parse(svg_path)
    root = tree.getroot()

    coords: List[Tuple[float, float]] = []

    def iter_circles(elem: ET.Element) -> Iterable[ET.Element]:
        # Match any tag that ends with 'circle'
        for e in elem.iter():
            if e.tag.endswith('circle'):
                yield e

    for c in iter_circles(root):
        cx = _parse_float(c.get('cx'))
        cy = _parse_float(c.get('cy'))
        coords.append((cx, cy))

    return coords


def coords_to_json(
    coords: List[Tuple[float, float]],
    *,
    show_name: str = "svg-import",
    max_scene: int = 1,
    max_drone: Optional[int] = None,
    scene_number: int = 1,
    scene_holder: int = 0,
    # mapping params
    z_value: float = 0.0,
    scale_x: float = 1.0,
    scale_y: float = 1.0,
    scale_z: float = 1.0,
    offset_x: float = 0.0,
    offset_y: float = 0.0,
    offset_z: float = 0.0,
    # visual params
    led_intensity: float = 1.0,
    led_rgb: Tuple[int, int, int] = (255, 255, 255),
    # constraints
    max_speed: float = 6.0,
    max_accel: float = 3.0,
    min_separation: float = 2.0,
) -> Dict[str, Any]:
    """
    Build JSON matching the reference schema using the provided coordinates.

    Each coordinate becomes one action with transform_pos [x,y,z].
    Scaling and offset are applied (then z_value, scale_z, offset_z for Z).
    """
    if max_drone is None:
        max_drone = len(coords)

    actions = []
    for (x, y) in coords:
        tx = x * scale_x + offset_x
        ty = y * scale_y + offset_y
        tz = z_value * scale_z + offset_z
        actions.append(
            {
                "led_intensity": float(led_intensity),
                "led_rgb": [int(led_rgb[0]), int(led_rgb[1]), int(led_rgb[2])],
                "transform_pos": [float(tx), float(ty), float(tz)],
            }
        )

    data: Dict[str, Any] = {
        "format": "dsj",
        "show": {
            "show_name": show_name,
            "max_scene": int(max_scene),
            "max_drone": int(max_drone),
        },
        "constraints": {
            "max_speed": float(max_speed),
            "max_accel": float(max_accel),
            "min_separation": float(min_separation),
        },
        "scenes": [
            {
                "scene_number": int(scene_number),
                "scene_holder": int(scene_holder),
                "action_data": actions,
            }
        ],
    }

    return data

