#!/usr/bin/env python3
import asyncio
import json
import ssl
import uuid
from aiohttp import web
import websockets
import socket

WSS_PORT = 3000
HTTP_PORT = 8080

# Connected WSS clients
spicetify_clients = set()

# Map request_id -> asyncio.Future
pending_responses = {}

# ----------------- WebSocket Handler -----------------
async def wss_handler(ws):
    global spicetify_clients, pending_responses
    spicetify_clients.add(ws)
    print("Spicetify client connected.")

    try:
        async for message in ws:
            data = json.loads(message)
            request_id = data.get("_request_id")
            if request_id and request_id in pending_responses:
                future = pending_responses.pop(request_id)
                if not future.done():
                    future.set_result(data)
            else:
                print("⬇︎ Unsolicited WS message:", data)
    finally:
        spicetify_clients.remove(ws)
        print("Spicetify client disconnected.")

# ----------------- HTTP Proxy -----------------
async def http_proxy(request):
    global spicetify_clients, pending_responses

    try:
        payload = await request.json()
    except:
        return web.json_response({"error": "invalid JSON"}, status=400)

    if not spicetify_clients:
        return web.json_response({"error": "no spicetify client connected"}, status=503)

    # Assign a unique ID
    request_id = str(uuid.uuid4())
    payload["_request_id"] = request_id

    # Prepare Future to wait for response
    future = asyncio.get_event_loop().create_future()
    pending_responses[request_id] = future

    # Send to all connected clients
    await asyncio.gather(*[client.send(json.dumps(payload)) for client in spicetify_clients])

    # Actions that don't return a value
    if payload.get("action") in ["play", "pause", "next", "previous", "setVolume", 
                                 "setShuffle", "setRepeat", "setSmartShuffle", "playFromUri",
                                 "seek", "toggleLike"]:
        pending_responses.pop(request_id, None)
        return web.json_response({"status": "command sent"})

    # Wait for response
    try:
        response = await asyncio.wait_for(future, timeout=6.0)
        return web.json_response(response)
    except asyncio.TimeoutError:
        pending_responses.pop(request_id, None)
        return web.json_response({"error": "no response from Spicetify"}, status=504)

# ----------------- Health Check -----------------
async def health(request):
    return web.json_response({"status": "ok"})

# ----------------- Helpers -----------------
def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    except:
        return "127.0.0.1"
    finally:
        s.close()

async def redirect_root(request):
    raise web.HTTPFound("/page/index.html")

async def redirect_page(request):
    raise web.HTTPFound("/page/index.html")

# ----------------- Server Startup -----------------
async def start_servers():
    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ssl_context.load_cert_chain(certfile="/home/anthony/deskos/cert.pem", keyfile="/home/anthony/deskos/key.pem")

    # WSS Server
    await websockets.serve(wss_handler, "0.0.0.0", WSS_PORT, ssl=ssl_context)
    print(f"WSS server listening on wss://0.0.0.0:{WSS_PORT}")

    # HTTP Server
    app = web.Application()
    app.router.add_get("/", redirect_root)
    app.router.add_get("/page", redirect_page)
    app.router.add_post("/proxy", http_proxy)
    app.router.add_get("/health", health)
    app.router.add_static("/page/", path="/home/anthony/deskos/public", name="public", show_index=False)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", HTTP_PORT)
    await site.start()

    print(f"HTTP server listening on http://0.0.0.0:{HTTP_PORT}")
    print(f"iPhone client can reach http://{get_local_ip()}:{HTTP_PORT}/proxy")
    await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(start_servers())
