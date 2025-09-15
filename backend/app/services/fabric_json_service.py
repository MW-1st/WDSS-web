import os
import re
import uuid
import json
from typing import Iterable, List, Tuple, Dict, Any, Optional


def _parse_float(val: Optional[str], default: float = 0.0) -> float:
    if val is None:
        return default
    try:
        # remove common units like 'px'
        return float(re.sub(r"[a-zA-Z%]+$", "", val.strip()))
    except Exception:
        return default


def _hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
    """Convert hex color to RGB tuple"""
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 3:
        hex_color = "".join([c * 2 for c in hex_color])
    if len(hex_color) == 6:
        try:
            r = int(hex_color[0:2], 16)
            g = int(hex_color[2:4], 16)
            b = int(hex_color[4:6], 16)
            return (r, g, b)
        except ValueError:
            pass
    return (255, 255, 255)  # default white


def fabric_json_to_coords(json_path: str) -> List[Tuple[float, float]]:
    """
    Parse a Fabric.js JSON file and return a list of (x, y) positions for circle objects.
    """
    if not os.path.exists(json_path):
        raise FileNotFoundError(f"Fabric.js JSON not found: {json_path}")

    try:
        with open(json_path, "r", encoding="utf-8") as f:
            fabric_data = json.load(f)
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        raise ValueError(f"Failed to parse JSON file: {json_path}, error: {e}")

    coords: List[Tuple[float, float]] = []

    # Extract objects from Fabric.js canvas JSON
    objects = fabric_data.get("objects", [])

    for obj in objects:
        if obj.get("type").lower() == "circle":
            # Fabric.js uses 'left' and 'top' for position
            x = _parse_float(str(obj.get("left", 0)))
            y = _parse_float(str(obj.get("top", 0)))
            coords.append((x, y))

    return coords


def fabric_json_to_coords_with_colors(
    json_path: str,
) -> List[Tuple[float, float, Tuple[int, int, int]]]:
    """
    Parse a Fabric.js JSON file and return a list of (x, y, (r, g, b)) for circle objects.
    """
    if not os.path.exists(json_path):
        raise FileNotFoundError(f"Fabric.js JSON not found: {json_path}")

    try:
        with open(json_path, "r", encoding="utf-8") as f:
            fabric_data = json.load(f)
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        raise ValueError(f"Failed to parse JSON file: {json_path}, error: {e}")

    coords_with_colors: List[Tuple[float, float, Tuple[int, int, int]]] = []

    # Extract objects from Fabric.js canvas JSON
    objects = fabric_data.get("objects", [])

    for obj in objects:
        if obj.get("type").lower() == "circle":
            # Fabric.js uses 'left' and 'top' for position
            x = _parse_float(str(obj.get("left", 0)))
            y = _parse_float(str(obj.get("top", 0)))

            # Extract fill color
            fill_color = obj.get("fill", "#ffffff")
            if isinstance(fill_color, str) and fill_color.startswith("#"):
                rgb_color = _hex_to_rgb(fill_color)
            else:
                rgb_color = (255, 255, 255)  # default white

            coords_with_colors.append((x, y, rgb_color))

    return coords_with_colors


def get_fabric_json_size(json_path: str) -> Tuple[float, float, float]:
    """
    Determine (width, height, z) for the scene_size field from the Fabric.js JSON.
    Uses the canvas width and height properties.
    """
    if not os.path.exists(json_path):
        raise FileNotFoundError(f"Fabric.js JSON not found: {json_path}")

    try:
        with open(json_path, "r", encoding="utf-8") as f:
            fabric_data = json.load(f)

        # 1. 'canvasSize' 객체를 가져옵니다. 없으면 빈 딕셔너리({})를 사용합니다.
        canvas_size_obj = fabric_data.get("canvasSize", {})

        # 2. 'canvasSize' 객체 내부에서 'width'와 'height'를 가져옵니다.
        w = _parse_float(str(canvas_size_obj.get("width", 0)), 0.0)
        h = _parse_float(str(canvas_size_obj.get("height", 0)), 0.0)

        return float(w), float(h), 0.0
    except Exception:
        return 0.0, 0.0, 0.0


def coords_to_json(
    coords: List[Tuple[float, float]],
    *,
    show_name: str = "fabric-import",
    max_scene: int = 1,
    max_drone: Optional[int] = None,
    scene_number: int = 1,
    scene_holder: int = 0,
    scene_size: Optional[Tuple[float, float, float]] = None,
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
    for x, y in coords:
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
                **(
                    {
                        "scene_size": [
                            float(scene_size[0]),
                            float(scene_size[1]),
                            float(scene_size[2]),
                        ]
                    }
                    if scene_size is not None
                    else {}
                ),
                "action_data": actions,
            }
        ],
    }

    return data


def coords_with_colors_to_json(
    coords_with_colors: List[Tuple[float, float, Tuple[int, int, int]]],
    *,
    show_name: str = "fabric-import",
    max_scene: int = 1,
    max_drone: Optional[int] = None,
    scene_number: int = 1,
    scene_holder: int = 0,
    scene_size: Optional[Tuple[float, float, float]] = None,
    # mapping params
    z_value: float = 0.0,
    scale_x: float = 1.0,
    scale_y: float = 1.0,
    scale_z: float = 1.0,
    offset_x: float = 0.0,
    offset_y: float = 0.0,
    offset_z: float = 0.0,
    # visual params (default values, will be overridden by individual colors)
    led_intensity: float = 1.0,
    # constraints
    max_speed: float = 6.0,
    max_accel: float = 3.0,
    min_separation: float = 2.0,
) -> Dict[str, Any]:
    """
    Build JSON matching the reference schema using the provided coordinates with colors.
    Each coordinate becomes one action with transform_pos [x,y,z] and individual led_rgb.
    """
    if max_drone is None:
        max_drone = len(coords_with_colors)

    actions = []
    for x, y, (r, g, b) in coords_with_colors:
        tx = x * scale_x + offset_x
        ty = y * scale_y + offset_y
        tz = z_value * scale_z + offset_z
        actions.append(
            {
                "led_intensity": float(led_intensity),
                "led_rgb": [int(r), int(g), int(b)],  # Use individual circle colors
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
                **(
                    {
                        "scene_size": [
                            float(scene_size[0]),
                            float(scene_size[1]),
                            float(scene_size[2]),
                        ]
                    }
                    if scene_size is not None
                    else {}
                ),
                "action_data": actions,
            }
        ],
    }

    return data
