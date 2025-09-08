from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.routers import auth, scene, websocket, project, image_router
from app.db.database import init_db, close_db
from starlette.middleware.base import BaseHTTPMiddleware
from app.config import create_upload_directories

# 애플리케이션 생성 전에 디렉토리 생성
create_upload_directories()
app = FastAPI()

# CORS for local dev (Vite on 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://3.85.51.152:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# CORS 헤더를 추가하는 미들웨어
class CORSStaticFilesMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # /uploads 경로에 대해 CORS 헤더 추가
        if request.url.path.startswith("/uploads/"):
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "*"
        return response


# CORS 미들웨어 추가
app.add_middleware(CORSStaticFilesMiddleware)

# Routers
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(project.router, prefix="/projects", tags=["project"])
# app.include_router(image.router, prefix="/images", tags=["image"])
app.include_router(
    scene.router, prefix="/projects/{project_id}/scenes", tags=["scenes"]
)

app.include_router(image_router.router)
app.include_router(websocket.router)

app.mount(
    "/uploads",
    StaticFiles(directory="uploads"),
    name="uploads",
)

app.mount(
    "/originals",
    StaticFiles(directory="originals"),
    name="originals",
)

app.mount(
    "/processed",
    StaticFiles(directory="processed"),
    name="processed",
)

# Static files for generated JSON
app.mount(
    "/svg-json",
    StaticFiles(directory="svg_json"),
    name="svg_json",
)


@app.on_event("startup")
async def startup():
    create_upload_directories()
    await init_db()


@app.on_event("shutdown")
async def shutdown():
    await close_db()


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"message": "Backend is running"}
