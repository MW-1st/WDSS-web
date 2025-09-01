import os
import uuid
import cv2
import numpy as np


def process_image(
    input_path: str,
    step: int = 4,
    canny_threshold1: int = 100,
    canny_threshold2: int = 200,
    blur_ksize: int = 5,
    blur_sigma: float = 1.4,
) -> str:
    """
    입력 이미지 경로를 받아 엣지를 점으로 샘플링한 이미지를 생성하고 저장합니다.

    - 그레이스케일 → 가우시안 블러 → Canny 엣지 → 격자 간격(step)으로 점 샘플링
    - 결과 이미지는 `uploaded_images/processed_<uuid>.png` 경로로 저장됨

    Returns: 생성된 결과 이미지의 파일 경로(백엔드 루트 기준 상대 경로)
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input image not found: {input_path}")

    # Use imdecode to support non-ASCII (e.g., Korean) paths on Windows
    with open(input_path, "rb") as f:
        file_bytes = np.frombuffer(f.read(), dtype=np.uint8)
    img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(f"Failed to read image: {input_path}")

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 가우시안 블러 (커널은 홀수)
    k = max(3, blur_ksize | 1)
    blur = cv2.GaussianBlur(gray, (k, k), blur_sigma)

    # Canny edge
    edges = cv2.Canny(blur, canny_threshold1, canny_threshold2)

    # 점 이미지 초기화 (검정 바탕)
    dots = np.zeros_like(edges)

    # 간격에 따라 점 찍기
    h, w = edges.shape[:2]
    dot_count = 0
    for y in range(0, h, step):
        for x in range(0, w, step):
            if edges[y, x] != 0:
                cv2.circle(dots, (x, y), 1, 255, -1)
                dot_count += 1

    # 출력 경로 준비
    # 레포 구조 상 backend/uploaded_images 폴더 사용
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    out_dir = os.path.join(backend_dir, "uploaded_images")
    os.makedirs(out_dir, exist_ok=True)

    out_name = f"processed_{uuid.uuid4().hex}_{dot_count}.png"
    output_path = os.path.join(out_dir, out_name)

    # 저장
    cv2.imwrite(output_path, dots)

    # 백엔드 루트 기준 상대 경로 반환 (예: uploaded_images/processed_xxx.png)
    rel_path = os.path.relpath(output_path, start=backend_dir)
    return rel_path
