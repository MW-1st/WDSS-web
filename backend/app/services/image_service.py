import os
import uuid
import cv2
import numpy as np


def process_image(
    input_path: str,
    step: int = 3,
    target_dots: int | None = None,
    canny_threshold1: int = 100,
    canny_threshold2: int = 200,
    blur_ksize: int = 5,
    blur_sigma: float = 1.4,
    color_rgb: tuple[int, int, int] | None = None,
) -> str:
    """
    입력 이미지 경로를 받아 엣지 픽셀을 일정 간격으로 점 샘플링한 결과 이미지를 생성합니다.

    - 파이프라인: Gray → GaussianBlur → Canny → Grid Sampling
    - target_dots가 주어지면 엣지 픽셀 수로부터 step을 자동 계산합니다.
      대략적으로 기대 도트 수 ≈ edge_pixels / (step^2)로 가정하여 step ≈ sqrt(edge_pixels / target_dots)
    - 결과는 backend/uploaded_images/processed_<uuid>_<dot_count>.png 로 저장됩니다.

    Returns: 백엔드 루트 기준 상대 경로 (e.g., "uploaded_images/processed_xxx.png")
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input image not found: {input_path}")

    # 읽기: imdecode로 비ASCII 경로 호환
    with open(input_path, "rb") as f:
        file_bytes = np.frombuffer(f.read(), dtype=np.uint8)
    img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(f"Failed to read image: {input_path}")

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 가우시안 블러 (커널 홀수 보정)
    k = max(3, blur_ksize | 1)
    blur = cv2.GaussianBlur(gray, (k, k), blur_sigma)

    # Canny edge
    edges = cv2.Canny(blur, canny_threshold1, canny_threshold2)

    # step 자동 계산 (target_dots 지정 시 우선)
    h, w = edges.shape[:2]
    if target_dots and target_dots > 0:
        edge_pixels = int(np.count_nonzero(edges))
        if edge_pixels <= 0:
            step = 4
        else:
            est = int(max(1, round((edge_pixels / max(target_dots, 1)) ** 0.5)))
            step = max(1, min(est, 64))

    # 좌표만 수집하여 SVG로 저장할 예정
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

    # 출력 경로 준비 (backend/uploaded_images)
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    out_dir = os.path.join(backend_dir, "uploaded_images")
    os.makedirs(out_dir, exist_ok=True)

    out_name = f"processed_{uuid.uuid4().hex}_{dot_count}.svg"
    output_path = os.path.join(out_dir, out_name)

    # 각 점의 실제 이미지 색상을 분석하여 사용
    circles = []
    for (x, y) in points:
        # 해당 위치의 실제 픽셀 색상 추출
        if y < img.shape[0] and x < img.shape[1]:
            # BGR 순서로 저장되어 있으므로 RGB로 변환
            b, g, r = img[int(y), int(x)]
            actual_color = f"rgb({int(r)}, {int(g)}, {int(b)})"
        else:
            # 범위를 벗어난 경우 기본 색상 사용
            if color_rgb:
                r, g, b = color_rgb
                actual_color = f"rgb({r}, {g}, {b})"
            else:
                actual_color = "#000"  # 기본 검은색
        
        circles.append(f"<circle cx=\"{x}\" cy=\"{y}\" r=\"2\" fill=\"{actual_color}\" />")

    # SVG 저장 (비ASCII 경로 호환)
    svg_header = (
        f"<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
        f"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{w}\" height=\"{h}\" viewBox=\"0 0 {w} {h}\">\n"
    )
    svg_footer = "\n</svg>\n"
    svg_content = svg_header + ("\n".join(circles)) + svg_footer

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(svg_content)
    print(f"Saved processed SVG to: {output_path}")

    # 백엔드 루트 기준 상대 경로 반환
    rel_path = os.path.relpath(output_path, start=backend_dir)
    return rel_path
