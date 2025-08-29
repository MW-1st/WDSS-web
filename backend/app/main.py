from fastapi import FastAPI
# from app.routers import image

app = FastAPI()

# app.include_router(image.router, prefix="/images", tags=["images"])

@app.get("/health")
def health_check():
    return {"status": "ok"}
