from fastapi import FastAPI
from app.routers import auth

app = FastAPI()

# Routers
app.include_router(auth.router, prefix="/auth", tags=["auth"])


@app.get("/health")
def health_check():
    return {"status": "ok"}
