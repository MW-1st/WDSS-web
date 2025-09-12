from pathlib import Path

# --- 기본 경로 설정 ---
# 이 config.py 파일의 위치를 기준으로 프로젝트의 최상위 디렉토리를 찾습니다.
# (app 폴더의 부모 폴더)
BASE_DIR = Path(__file__).resolve().parent.parent

# --- 업로드 관련 경로 설정 ---
UPLOAD_DIRECTORY = BASE_DIR / "uploads"
ORIGINALS_DIR = BASE_DIR / "originals"
PROCESSED_DIR = BASE_DIR / "processed"
SVG_JSON_DIR = BASE_DIR / "svg_json"
TMP_DIR = BASE_DIR / "tmp"
THUMBNAILS_DIR = BASE_DIR / "thumbnails"


# --- 서버 시작 시 폴더 자동 생성 ---
def create_upload_directories():
    """업로드에 필요한 모든 폴더를 생성합니다."""
    UPLOAD_DIRECTORY.mkdir(parents=True, exist_ok=True)
    ORIGINALS_DIR.mkdir(exist_ok=True)
    PROCESSED_DIR.mkdir(exist_ok=True)
    TMP_DIR.mkdir(exist_ok=True)
    SVG_JSON_DIR.mkdir(exist_ok=True)
    THUMBNAILS_DIR.mkdir(exist_ok=True)
