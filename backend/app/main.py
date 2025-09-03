from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.routers import auth, image, scenes, websocket, project, image_router
from app.db.database import init_db, close_db

app = FastAPI()

# CORS for local dev (Vite on 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(
    image.router, prefix="/projects/{project_id}/scenes/{scene_id}", tags=["image"]
)
app.include_router(scenes.router, prefix="/projects", tags=["scenes"])
app.include_router(project.router, prefix="/projects", tags=["project"])
app.include_router(image_router.router)
app.include_router(websocket.router)

app.mount(
    "/uploads",
    StaticFiles(directory="uploaded_images"),
    name="uploads",
)

# Static files for generated JSON
app.mount(
    "/svg-json",
    StaticFiles(directory="svg_json"),
    name="svg_json",
)


@app.on_event("startup")
async def startup():
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
