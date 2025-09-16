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
        "http://44.204.161.252:5173",
        "http://44.204.161.252:8000",
        "http://54.157.7.189:5173",
        "http://54.157.7.189:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

app.mount(
    "/thumbnails",
    StaticFiles(directory="thumbnails"),
    name="thumbnails",
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
