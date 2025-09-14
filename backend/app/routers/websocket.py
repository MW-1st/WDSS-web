import json # JSON 라이브러리 import
from typing import List, Dict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

class ConnectionManager:
    def __init__(self):
        # 프로젝트 ID를 키로 하는 연결 딕셔너리
        self.project_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, project_id: str):
        await websocket.accept()
        if project_id not in self.project_connections:
            self.project_connections[project_id] = []
        self.project_connections[project_id].append(websocket)

    def disconnect(self, websocket: WebSocket, project_id: str):
        if project_id in self.project_connections:
            if websocket in self.project_connections[project_id]:
                self.project_connections[project_id].remove(websocket)
            # 프로젝트에 연결이 없으면 딕셔너리에서 제거
            if not self.project_connections[project_id]:
                del self.project_connections[project_id]

    async def broadcast_to_project(self, project_id: str, message: str):
        if project_id in self.project_connections:
            disconnected = []
            for connection in self.project_connections[project_id]:
                try:
                    await connection.send_text(message)
                except:
                    disconnected.append(connection)

            # 끊어진 연결들 정리
            for connection in disconnected:
                self.project_connections[project_id].remove(connection)

            if not self.project_connections[project_id]:
                del self.project_connections[project_id]

    async def broadcast(self, message: str):
        # 모든 프로젝트에 브로드캐스트 (기존 호환성 유지)
        for project_id in list(self.project_connections.keys()):
            await self.broadcast_to_project(project_id, message)

manager = ConnectionManager()

router = APIRouter(
    prefix="/ws",
    tags=["websocket"],
)



@router.websocket("/unity/{project_id}")
async def websocket_endpoint_with_project(websocket: WebSocket, project_id: str):
    await manager.connect(websocket, project_id)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast_to_project(project_id, f"A client in project {project_id} says: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket, project_id)
        await manager.broadcast_to_project(project_id, f"A client has left project {project_id}")


@router.websocket("/unity")
async def websocket_endpoint_legacy(websocket: WebSocket):
    """기존 호환성을 위한 레거시 엔드포인트 - default-project 사용"""
    default_project_id = "default-project"
    await manager.connect(websocket, default_project_id)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast_to_project(default_project_id, f"A legacy client says: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket, default_project_id)
        await manager.broadcast_to_project(default_project_id, "A legacy client has left the chat")


@router.post("/test/broadcast")
async def test_broadcast():
    test_message = "Test message from backend"
    await manager.broadcast(test_message)
    return {"status": "success", "message": "Test message broadcasted to all connected Unity clients"}


@router.post("/test/broadcast/{project_id}")
async def test_broadcast_to_project(project_id: str):
    test_message = f"Test message for project {project_id}"
    await manager.broadcast_to_project(project_id, test_message)
    return {"status": "success", "message": f"Test message broadcasted to project {project_id}"}
