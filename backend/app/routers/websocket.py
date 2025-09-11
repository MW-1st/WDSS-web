from typing import Dict, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect


class ConnectionManager:
    """Manages websocket connections per project room.

    - Rooms are keyed by `project_id`.
    - Each room holds a set of WebSocket connections.
    """

    def __init__(self):
        self.rooms: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, project_id: str):
        await websocket.accept()
        room = self.rooms.setdefault(project_id, set())
        room.add(websocket)

    def disconnect(self, websocket: WebSocket, project_id: str):
        room = self.rooms.get(project_id)
        if not room:
            return
        room.discard(websocket)
        if not room:
            # Clean up empty rooms
            self.rooms.pop(project_id, None)

    async def broadcast_to_room(self, project_id: str, message: str):
        room = self.rooms.get(project_id)
        if not room:
            return
        # Create a snapshot to avoid "set changed size during iteration"
        for connection in list(room):
            try:
                await connection.send_text(message)
            except Exception:
                # If send fails, drop this connection
                room.discard(connection)
        if not room:
            self.rooms.pop(project_id, None)


manager = ConnectionManager()

router = APIRouter(
    prefix="/ws",
    tags=["websocket"],
)


@router.websocket("/unity/{project_id}")
async def websocket_endpoint(websocket: WebSocket, project_id: str):
    # Join the room corresponding to project_id
    await manager.connect(websocket, project_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo/broadcast only within the same room
            await manager.broadcast_to_room(project_id, f"A client says: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket, project_id)
        await manager.broadcast_to_room(project_id, "A client has left the chat")


@router.post("/test/broadcast/{project_id}")
async def test_broadcast(project_id: str):
    test_message = "Test message from backend"
    await manager.broadcast_to_room(project_id, test_message)
    return {
        "status": "success",
        "message": f"Test message broadcasted to project room '{project_id}'",
    }

