from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from fastapi.staticfiles import StaticFiles
from app.routers import auth, image, websocket
from app.routers import image_router

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
app.include_router(image_router.router)
app.include_router(websocket.router)

# Static files for uploaded/processed images
# Serves files under backend/uploaded_images at /uploads/*
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


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"message": "Backend is running"}
