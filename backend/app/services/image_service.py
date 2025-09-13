import os
import uuid
import cv2
import numpy as np
import json


def apply_sobel_edge_detection(gray_img, low_threshold, high_threshold):
    """
    미리보기와 동일한 Sobel 엣지 검출 알고리즘
    OpenCV 최적화 버전으로 성능 개선 (결과는 동일)
    """
    # OpenCV Sobel 연산자 사용 (C++ 최적화)
    grad_x = cv2.Sobel(gray_img, cv2.CV_64F, 1, 0, ksize=3)  # X 방향 기울기
    grad_y = cv2.Sobel(gray_img, cv2.CV_64F, 0, 1, ksize=3)  # Y 방향 기울기
    
    # 기울기 크기 계산 (미리보기와 동일한 공식)
    magnitude = np.sqrt(grad_x**2 + grad_y**2)
    
    # 임계값에 따른 분류 (미리보기와 동일)
    result = np.zeros_like(gray_img, dtype=np.uint8)
    result[magnitude > high_threshold] = 255
    result[(magnitude > low_threshold) & (magnitude <= high_threshold)] = 128
    # magnitude <= low_threshold인 경우는 이미 0으로 초기화됨
    
    return result


def process_image(
    input_path: str,
    step: int = 3,
    target_dots: int | None = None,
    canny_threshold1: int = 80,  # Sobel 낮은 임계값 (미리보기 lowThreshold와 동일)
    canny_threshold2: int = 200,  # Sobel 높은 임계값 (미리보기 highThreshold와 동일)
    blur_ksize: int = 5,  # 더 강한 블러로 노이즈 제거
    blur_sigma: float = 1.2,
    color_rgb: tuple[int, int, int] | None = None,
) -> str:
    """
    입력 이미지 경로를 받아 엣지 픽셀을 일정 간격으로 점 샘플링한 결과를 Fabric.js JSON으로 생성합니다.

    - 파이프라인: Gray → GaussianBlur → Sobel → Grid Sampling (미리보기와 동일)
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

    # 기본 블러 
    k = max(3, blur_ksize | 1)
    blur = cv2.GaussianBlur(gray, (k, k), blur_sigma)
    
    # Sobel 엣지 검출 (미리보기와 동일한 알고리즘)
    edges = apply_sobel_edge_detection(blur, canny_threshold1, canny_threshold2)
    
    # 기존 Canny 엣지 검출 (주석 처리)
    # edges = cv2.Canny(blur, canny_threshold1, canny_threshold2)

    # 최소한의 모폴로지 연산
    kernel = np.ones((2, 2), np.uint8)
    edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)  # 끊어진 선만 연결
    circle_radius = 2  # 원 반지름(px)

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
        # 추정된 step 간격으로 그리드 형태 수집
        for y in range(0, h, step):
            for x in range(0, w, step):
                if edges[y, x] != 0:
                    points.append((x, y))
        # 목표 개수보다 많으면 무작위로 일부만 추출(그리드 좌표 유지)
        total = len(points)
        if total > int(target_dots):
            idx = np.random.choice(total, size=int(target_dots), replace=False)
            points = [points[i] for i in idx]
    else:
        for y in range(0, h, step):
            for x in range(0, w, step):
                if edges[y, x] != 0:
                    points.append((x, y))

    # 최소 간격 유지(원 반지름 기준) + 중복 제거
    def _enforce_min_distance(points_list, min_dist):
        if not points_list or min_dist <= 1:
            return points_list
        cell = int(max(1, min_dist))
        inv = 1.0 / float(cell)
        grid = {}
        accepted = []
        min_sq = float(min_dist) * float(min_dist)

        for px, py in points_list:
            cx = int(px * inv)
            cy = int(py * inv)
            ok = True
            for nx in (cx - 1, cx, cx + 1):
                for ny in (cy - 1, cy, cy + 1):
                    bucket = grid.get((nx, ny))
                    if not bucket:
                        continue
                    for ax, ay in bucket:
                        dx = ax - px
                        dy = ay - py
                        if (dx * dx + dy * dy) < min_sq:
                            ok = False
                            break
                    if not ok:
                        break
                if not ok:
                    break
            if ok:
                ipx = int(px)
                ipy = int(py)
                accepted.append((ipx, ipy))
                grid.setdefault((cx, cy), []).append((ipx, ipy))
        return accepted

    if points:
        points = list(dict.fromkeys(points))
        points = _enforce_min_distance(points, circle_radius * 2)
    dot_count = len(points)

    # 출력 경로 준비 (backend/uploads)
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    out_dir = os.path.join(backend_dir, "uploads")
    os.makedirs(out_dir, exist_ok=True)

    out_name = f"processed_{uuid.uuid4().hex}_{dot_count}.json"
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

    def rgb_to_hex(r, g, b):
        """RGB 값을 HEX 색상 코드로 변환"""
        return f"#{r:02x}{g:02x}{b:02x}"

    # 펜 스트로크 색상 분석 (간소화)
    dominant_pen_colors = get_dominant_pen_color(img, points)

    # Fabric.js 객체들을 저장할 리스트
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

            fill_color = rgb_to_hex(int(r), int(g), int(b))
        else:
            # 범위를 벗어난 경우
            if color_rgb:
                r, g, b = color_rgb
                fill_color = rgb_to_hex(r, g, b)
            else:
                fill_color = "#000000"

        # Fabric.js Circle 객체 생성
        circle_obj = {
            "type": "circle",
            "version": "5.3.0",
            "originX": "center",
            "originY": "center",
            "left": x,
            "top": y,
            "width": circle_radius * 2,
            "height": circle_radius * 2,
            "fill": fill_color,
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
            "radius": circle_radius,
        }

        fabric_objects.append(circle_obj)

    # Fabric.js Canvas JSON 구조 생성
    fabric_canvas = {
        "version": "5.3.0",
        "objects": fabric_objects,
        "background": "",
        "backgroundImage": "",
        "overlay": "",
        "clipPath": "",
        "width": w,
        "height": h,
        "viewportTransform": [1, 0, 0, 1, 0, 0],
    }

    # JSON 파일로 저장 (비ASCII 경로 호환)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(fabric_canvas, f, ensure_ascii=False, indent=2)

    print(f"Saved processed Fabric.js JSON to: {output_path}")

    # 백엔드 루트 기준 상대 경로 반환
    rel_path = os.path.relpath(output_path, start=backend_dir)
    return rel_path
