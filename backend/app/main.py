from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth

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


@app.get("/health")
def health_check():
    return {"status": "ok"}
