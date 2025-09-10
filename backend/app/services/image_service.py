import os
import uuid
import cv2
import numpy as np
import json


def process_image(
    input_path: str,
    step: int = 3,
    target_dots: int | None = None,
    canny_threshold1: int = 80,  # 강한 엣지만 검출
    canny_threshold2: int = 200,  # 더 높은 임계값으로 선명한 윤곽선만
    blur_ksize: int = 5,  # 더 강한 블러로 노이즈 제거
    blur_sigma: float = 1.2,
    color_rgb: tuple[int, int, int] | None = None,
) -> str:
    """
    입력 이미지 경로를 받아 엣지 픽셀을 일정 간격으로 점 샘플링한 결과를 Fabric.js JSON으로 생성합니다.

    - 파이프라인: Gray → GaussianBlur → Canny → Grid Sampling
    - target_dots가 주어지면 엣지 픽셀 수로부터 step을 자동 계산합니다.
      대략적으로 기대 도트 수 ≈ edge_pixels / (step^2)로 가정하여 step ≈ sqrt(edge_pixels / target_dots)
    - 결과는 backend/uploads/processed_<uuid>_<dot_count>.json 로 저장됩니다.

    Returns: 백엔드 루트 기준 상대 경로 (e.g., "uploads/processed_xxx.json")
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input image not found: {input_path}")

    # 읽기: imdecode로 비ASCII 경로 호환
    with open(input_path, "rb") as f:
        file_bytes = np.frombuffer(f.read(), dtype=np.uint8)
    img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(f"Failed to read image: {input_path}")

    # 간단하고 빠른 엣지 검출
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 기본 블러 + Canny 엣지
    k = max(3, blur_ksize | 1)
    blur = cv2.GaussianBlur(gray, (k, k), blur_sigma)
    edges = cv2.Canny(blur, canny_threshold1, canny_threshold2)

    # 최소한의 모폴로지 연산
    kernel = np.ones((2, 2), np.uint8)
    edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)  # 끊어진 선만 연결

    # step 자동 계산 (target_dots 지정 시 우선)
    h, w = edges.shape[:2]
    if target_dots and target_dots > 0:
        edge_pixels = int(np.count_nonzero(edges))
        if edge_pixels <= 0:
            step = 4
        else:
            est = int(max(1, round((edge_pixels / max(target_dots, 1)) ** 0.5)))
            step = max(1, min(est, 64))

    # 간단한 점 선택 (원래 방식)
    points: list[tuple[int, int]] = []  # (x, y)
    if target_dots and target_dots > 0:
        coords = np.column_stack(np.where(edges != 0))  # (y, x)
        total = int(coords.shape[0])
        if total > 0:
            replace = target_dots > total
            idx = np.random.choice(total, size=target_dots, replace=replace)
            sel = coords[idx]
            points = [(int(x), int(y)) for (y, x) in sel]
        else:
            points = []
    else:
        for y in range(0, h, step):
            for x in range(0, w, step):
                if edges[y, x] != 0:
                    points.append((x, y))
    dot_count = len(points)

    # 출력 경로 준비 (backend/uploads)
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    out_dir = os.path.join(backend_dir, "uploads")
    os.makedirs(out_dir, exist_ok=True)

    out_name = f"{uuid.uuid4().hex}.json"
    output_path = os.path.join(out_dir, out_name)

    # 색상 분석 및 펜 스트로크 통합
    def is_yellow_like(r, g, b):
        """노란색 계열인지 판별"""
        hsv = cv2.cvtColor(np.uint8([[[b, g, r]]]), cv2.COLOR_BGR2HSV)[0][0]
        hue = hsv[0]
        saturation = hsv[1]
        value = hsv[2]
        return (20 <= hue <= 30) and saturation > 50 and value > 100

    def is_pen_stroke_area(img, x, y, radius=3):
        """해당 영역이 펜 스트로크인지 판별 (균일한 색상 영역)"""
        if (
            y < radius
            or x < radius
            or y >= img.shape[0] - radius
            or x >= img.shape[1] - radius
        ):
            return False

        # 주변 픽셀들의 색상 분산을 체크
        region = img[y - radius : y + radius + 1, x - radius : x + radius + 1]
        mean_color = np.mean(region, axis=(0, 1))
        std_color = np.std(region, axis=(0, 1))

        # RGB 각 채널의 표준편차가 모두 작으면 균일한 영역 (펜 스트로크)
        return all(std < 15 for std in std_color)  # 표준편차 15 이하면 균일

    def get_dominant_pen_color(img, points, sample_size=50):
        """펜 스트로크 영역에서 주요 색상들을 추출"""
        pen_colors = []

        # 샘플링으로 성능 최적화
        sample_points = points[:sample_size] if len(points) > sample_size else points

        for x, y in sample_points:
            if y < img.shape[0] and x < img.shape[1]:
                if is_pen_stroke_area(img, x, y):
                    b, g, r = img[int(y), int(x)]
                    pen_colors.append((r, g, b))

        if not pen_colors:
            return {}

        # 색상을 클러스터링하여 주요 펜 색상들 찾기
        unique_colors = {}
        for color in pen_colors:
            # 비슷한 색상들을 그룹화 (각 채널 20 이내 차이)
            found_group = None
            for group_color in unique_colors:
                if all(abs(color[i] - group_color[i]) < 20 for i in range(3)):
                    found_group = group_color
                    break

            if found_group:
                unique_colors[found_group] += 1
            else:
                unique_colors[color] = 1

        # 빈도가 높은 색상들만 반환 (전체의 10% 이상)
        threshold = len(pen_colors) * 0.1
        dominant_colors = {
            color: count for color, count in unique_colors.items() if count >= threshold
        }

        return dominant_colors

    # 펜 스트로크 색상 분석 (간소화)
    dominant_pen_colors = get_dominant_pen_color(img, points)

    # Fabric.js Circle 객체들 생성
    fabric_objects = []
    for x, y in points:
        if y < img.shape[0] and x < img.shape[1]:
            b, g, r = img[int(y), int(x)]

            # 펜 스트로크 영역인지 확인
            if is_pen_stroke_area(img, x, y):
                # 가장 가까운 주요 펜 색상으로 통일
                best_match = None
                min_distance = float("inf")

                for pen_color in dominant_pen_colors:
                    distance = sum(abs(pen_color[i] - [r, g, b][i]) for i in range(3))
                    if distance < min_distance:
                        min_distance = distance
                        best_match = pen_color

                if best_match and min_distance < 60:  # 임계값 내의 색상만 통일
                    r, g, b = best_match

            # 노란색 계열 특별 처리
            if is_yellow_like(r, g, b):
                saturation_boost = 1.2
                b = max(0, min(255, int(b * 0.8)))
                r = max(0, min(255, int(r * saturation_boost)))
                g = max(0, min(255, int(g * saturation_boost)))

            actual_color = f"rgb({int(r)}, {int(g)}, {int(b)})"
        else:
            # 범위를 벗어난 경우
            if color_rgb:
                r, g, b = color_rgb
                actual_color = f"rgb({r}, {g}, {b})"
            else:
                actual_color = "#000000"

        # Fabric.js Circle 객체 형식으로 생성
        circle_obj = {
            "type": "circle",
            "version": "5.3.0",
            "originX": "center",
            "originY": "center",
            "left": float(x),
            "top": float(y),
            "width": 4,
            "height": 4,
            "radius": 2,
            "fill": actual_color,
            "stroke": None,
            "strokeWidth": 0,
            "strokeDashArray": None,
            "strokeLineCap": "butt",
            "strokeDashOffset": 0,
            "strokeLineJoin": "miter",
            "strokeUniform": False,
            "strokeMiterLimit": 4,
            "scaleX": 1,
            "scaleY": 1,
            "angle": 0,
            "flipX": False,
            "flipY": False,
            "opacity": 1,
            "shadow": None,
            "visible": True,
            "backgroundColor": "",
            "fillRule": "nonzero",
            "paintFirst": "fill",
            "globalCompositeOperation": "source-over",
            "skewX": 0,
            "skewY": 0,
        }
        fabric_objects.append(circle_obj)

    # Fabric.js Canvas JSON 형식으로 생성
    fabric_canvas_json = {
        "version": "5.3.0",
        "objects": fabric_objects,
        "background": "white",
        "backgroundVpt": True,
        "nextUnusedId": dot_count + 1,
        "width": w,
        "height": h,
        "viewportTransform": [1, 0, 0, 1, 0, 0],
        "zoom": 1,
        "overlayColor": "",
        "overlayImage": "",
        "overlayOpacity": 1,
        "overlayVpt": True,
        "clipPath": None,
        "enableRetinaScaling": True,
        "renderOnAddRemove": True,
        "controlsAboveOverlay": False,
        "allowTouchScrolling": False,
        "imageSmoothingEnabled": True,
        "preserveObjectStacking": True,
        "snapAngle": 45,
        "snapThreshold": None,
        "targetFindTolerance": 10,
        "skipTargetFind": False,
        "isDrawingMode": False,
        "freeDrawingBrush": {
            "type": "PencilBrush",
            "width": 1,
            "color": "rgb(0,0,0)",
            "strokeLineCap": "round",
            "strokeLineJoin": "round",
            "shadow": None,
            "strokeMiterLimit": 10,
            "strokeDashArray": None,
            "strokeDashOffset": 0,
        },
        "selection": True,
        "selectionColor": "rgba(100, 100, 255, 0.3)",
        "selectionDashArray": [],
        "selectionBorderColor": "rgba(255, 255, 255, 0.3)",
        "selectionLineWidth": 1,
        "hoverCursor": "move",
        "moveCursor": "move",
        "defaultCursor": "default",
        "freeDrawingCursor": "crosshair",
        "rotationCursor": "crosshair",
        "notAllowedCursor": "not-allowed",
    }

    # JSON 저장 (비ASCII 경로 호환)
    # 출력 디렉토리가 존재하지 않으면 생성
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(fabric_canvas_json, f, ensure_ascii=False, indent=2)

    print(f"Saved processed Fabric.js JSON to: {output_path}")

    # 전체 경로 반환
    return output_path
