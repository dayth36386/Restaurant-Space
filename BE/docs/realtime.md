# Realtime chat (WebSocket)

Native WebSocket at `GET /api/v1/ws` (same origin rules as the REST API). Socket.IO was not adopted: the Go Socket.IO servers lag the current `socket.io-client` protocol, so the spec's plain-WebSocket fallback is used. HTTP endpoints remain the source of truth for history (`GET /conversations/{id}/messages`); the socket only delivers live events.

## Connection

1. Open `ws(s)://<api>/api/v1/ws`. Browsers send `Origin`; only `WEB_ORIGIN` / `API_PUBLIC_URL` are accepted.
2. Within 10 s send `{"type":"auth","ref":"1","data":{"token":"<access token>"}}`. The token is never put in the URL.
3. Server replies `ready`. Any failure closes the socket with code **4001**.
4. Access tokens last 15 minutes. After each refresh, send `auth` again with the new token (same user) — reply `auth:ok`. A socket that goes 15 minutes without a successful `auth` is closed with 4001; reconnect with a fresh token.
5. The server pings every 25 s. On reconnect, refetch the open conversation's history, since events missed while offline are not replayed.

Limits: 32 KiB per frame, 30 events per 10 s per connection (excess gets `error` `RATE_LIMITED`). Slow consumers are disconnected.

## Envelope

```json
{ "type": "message:send", "ref": "client-chosen id", "data": { } }
```

`ref` is optional and echoed on the direct reply (`ack`, `error`, `pong`, `auth:ok`, `ready`). Errors: `{"type":"error","ref":"…","error":{"code":"INVALID_INPUT|NOT_FOUND|UNAUTHORIZED|RATE_LIMITED|…","message":"…"}}` — codes match the REST error codes.

## Client → server

| type | data | effect |
| --- | --- | --- |
| `auth` | `{token}` | Authenticate (first frame) or extend after refresh |
| `message:send` | `{conversation_id, client_message_id, content}` or `{conversation_id, client_message_id, restaurant_id}` | Persist + ack. `client_message_id` is a client UUID; resending it returns the original message (no duplicate) |
| `message:read` | `{conversation_id, message_id}` | Advance own read cursor (never backwards) |
| `typing:start` / `typing:stop` | `{conversation_id}` | Relay typing state to the other member. Send `start` at most every ~3 s while typing and `stop` when idle |
| `ping` | — | `pong` |

There is no `conversation:join`: events are routed to every member's open sockets, and membership is checked on every event.

## Server → client

| type | data | to |
| --- | --- | --- |
| `ready` | `{user_id, online_user_ids}` — conversation partners online now | this socket |
| `message:ack` | `ChatMessage` (OpenAPI schema) | sending socket |
| `message:new` | `ChatMessage` | all members' sockets, including the sender's other tabs (dedupe by `id` / `client_message_id`) |
| `message:read_update` | `{conversation_id, user_id, message_id}` | all members |
| `typing:update` | `{conversation_id, user_id, typing}` | other member |
| `presence:update` | `{user_id, online}` — first socket opened / last closed | users sharing a conversation |

`ChatMessage.restaurant` carries a `RestaurantCard` when a public restaurant is shared; only public restaurants can be shared, and history hides cards that are no longer visible.

## Scaling note

The hub is in-memory, matching the single API process of the MVP. Multiple API replicas need a shared broker (e.g. Redis pub/sub) behind `hub.publish` plus sticky sessions or a presence store.
