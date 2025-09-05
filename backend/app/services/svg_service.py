import os
import re
import uuid
from typing import Iterable, List, Tuple, Dict, Any, Optional
import xml.etree.ElementTree as ET
from PIL import ImageColor


def _parse_float(val: Optional[str], default: float = 0.0) -> float:
    if val is None:
        return default
    try:
        # remove common units like 'px'
        return float(re.sub(r"[a-zA-Z%]+$", "", val.strip()))
    except Exception:
        return default


def _parse_color(color_str: Optional[str], default: Tuple[int, int, int] = (255, 255, 255)) -> Tuple[int, int, int]:
    """
    Parse SVG color string to RGB tuple.
    Supports hex (#rrggbb, #rgb), rgb(r,g,b), rgba(r,g,b,a), and named colors.
    """
    if not color_str:
        return default
    
    color_str = color_str.strip()
    
    try:
        # Use PIL's ImageColor to parse various color formats
        rgb = ImageColor.getcolor(color_str, "RGB")
        return rgb
    except (ValueError, AttributeError):
        # Fallback for unsupported formats
        try:
            # Try manual hex parsing
            if color_str.startswith('#'):
                hex_color = color_str[1:]
                if len(hex_color) == 3:
                    # Short hex format (#rgb -> #rrggbb)
                    hex_color = ''.join([c*2 for c in hex_color])
                if len(hex_color) == 6:
                    r = int(hex_color[0:2], 16)
                    g = int(hex_color[2:4], 16)
                    b = int(hex_color[4:6], 16)
                    return (r, g, b)
            
            # Try rgb() format parsing
            if color_str.startswith('rgb('):
                rgb_values = re.findall(r'\d+', color_str)
                if len(rgb_values) >= 3:
                    r = int(rgb_values[0])
                    g = int(rgb_values[1])
                    b = int(rgb_values[2])
                    return (r, g, b)
        except (ValueError, IndexError):
            pass
    
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


def svg_to_coords_with_colors(svg_path: str) -> List[Tuple[float, float, Tuple[int, int, int]]]:
    """
    Parse an SVG file and return a list of (x, y, (r, g, b)) for <circle> elements.
    - Supports namespaced SVGs.
    - Uses 'cx', 'cy', and 'fill' attributes.
    """
    if not os.path.exists(svg_path):
        raise FileNotFoundError(f"SVG not found: {svg_path}")

    tree = ET.parse(svg_path)
    root = tree.getroot()

    coords_with_colors: List[Tuple[float, float, Tuple[int, int, int]]] = []

    def iter_circles(elem: ET.Element) -> Iterable[ET.Element]:
        # Match any tag that ends with 'circle'
        for e in elem.iter():
            if e.tag.endswith('circle'):
                yield e

    for c in iter_circles(root):
        cx = _parse_float(c.get('cx'))
        cy = _parse_float(c.get('cy'))
        fill_color = _parse_color(c.get('fill'))
        coords_with_colors.append((cx, cy, fill_color))

    return coords_with_colors


def get_svg_size(svg_path: str) -> Tuple[float, float, float]:
    """
    Determine (width, height, z) for the scene_size field from the SVG.
    - Prefer explicit width/height attributes.
    - Fallback to viewBox width/height.
    - Return (0.0, 0.0, 0.0) if not determinable.
    """
    if not os.path.exists(svg_path):
        raise FileNotFoundError(f"SVG not found: {svg_path}")

    try:
        tree = ET.parse(svg_path)
        root = tree.getroot()

        w = _parse_float(root.get("width"), 0.0)
        h = _parse_float(root.get("height"), 0.0)

        if w <= 0.0 or h <= 0.0:
            vb = root.get("viewBox") or root.get("viewbox")
            if vb:
                parts = re.split(r"[\s,]+", vb.strip())
                if len(parts) == 4:
                    try:
                        w = float(parts[2])
                        h = float(parts[3])
                    except Exception:
                        pass

        return float(w), float(h), 0.0
    except Exception:
        return 0.0, 0.0, 0.0


def coords_to_json(
    coords: List[Tuple[float, float]],
    *,
    show_name: str = "svg-import",
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
                **({"scene_size": [float(scene_size[0]), float(scene_size[1]), float(scene_size[2])]} if scene_size is not None else {}),
                "action_data": actions,
            }
        ],
    }

    return data


def coords_with_colors_to_json(
    coords_with_colors: List[Tuple[float, float, Tuple[int, int, int]]],
    *,
    show_name: str = "svg-import",
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
    for (x, y, (r, g, b)) in coords_with_colors:
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
                **({"scene_size": [float(scene_size[0]), float(scene_size[1]), float(scene_size[2])]} if scene_size is not None else {}),
                "action_data": actions,
            }
        ],
    }

    return data
