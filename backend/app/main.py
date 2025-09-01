from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, image, scenes
from app.db.database import init_db, close_db
from app.routers import auth, image, scenes, projects

app = FastAPI()

# CORS for local dev (Vite on 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(
    image.router, prefix="/projects/{project_id}/scenes/{scene_id}", tags=["image"]
)
app.include_router(scenes.router, prefix="/api/projects", tags=["scenes"])
# 임시
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(
    image.router, prefix="/projects/{project_id}/scenes/{scene_id}", tags=["image"]
)
app.include_router(scenes.router, prefix="/api/projects", tags=["scenes"])
app.include_router(projects.router)  # ← /api/projects POST 등록


@app.on_event("startup")
async def startup():
    await init_db()


@app.on_event("shutdown")
async def shutdown():
    await close_db()


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/", include_in_schema=False)
def root():
    return {"ok": True, "docs": "/docs", "health": "/health"}
