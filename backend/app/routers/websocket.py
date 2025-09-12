import json # JSON 라이브러리 import
from typing import List, DefaultDict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from collections import defaultdict
from app.utils import security
from app.core import config
from app.dependencies import get_current_user
from app.schemas import UserResponse
from app.db.user import get_user_by_username
from app.db.database import get_conn
from pydantic import BaseModel

# (ConnectionManager 클래스는 변경 없음)
class ConnectionManager:
    def __init__(self):
        # map user_id -> list of sockets
        self.user_connections: DefaultDict[str, List[WebSocket]] = defaultdict(list)

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.user_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket):
        # remove from all user lists where it exists
        for uid, conns in list(self.user_connections.items()):
            if websocket in conns:
                conns.remove(websocket)
                if not conns:
                    del self.user_connections[uid]
                break

    async def broadcast(self, message: str):
        # legacy: send to all users
        for conns in self.user_connections.values():
            for connection in conns:
                await connection.send_text(message)

    async def send_to_user(self, user_id: str, message: str):
        conns = self.user_connections.get(user_id) or []
        for connection in list(conns):
            try:
                await connection.send_text(message)
            except Exception:
                # on failure, drop the dead socket
                try:
                    conns.remove(connection)
                except ValueError:
                    pass

manager = ConnectionManager()

router = APIRouter(
    prefix="/ws",
    tags=["websocket"],
)



@router.websocket("/unity")
async def websocket_endpoint(websocket: WebSocket):
    # Require Unity short-lived token via query param only
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008)
        return
    try:
        user_id = security.decode_ws_token(token)
    except Exception:
        await websocket.close(code=1008)
        return

    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            # echo only to this user's sockets for isolation
            await manager.send_to_user(user_id, f"A client says: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        # optional: notify only this user group
        try:
            await manager.send_to_user(user_id, "A client has left the chat")
        except Exception:
            pass


@router.post("/token")
async def issue_ws_token(current_user: UserResponse = Depends(get_current_user)):
    """Issue a short-lived WebSocket token for Unity clients."""
    token = security.create_ws_token(str(current_user.id))
    return {"ws_token": token, "expires_in": config.WS_TOKEN_EXPIRE_MINUTES * 60}


@router.post("/test/broadcast")
async def test_broadcast():
    test_message = "Test message from backend"
    await manager.broadcast(test_message)
    return {"status": "success", "message": "Test message broadcasted to all connected Unity clients"}
