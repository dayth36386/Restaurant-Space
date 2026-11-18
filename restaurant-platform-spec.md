# Restaurant Collection & Social Platform — Project Specification

> Specification / implementation prompt for a full-stack restaurant bookmarking and social application.

## 1. Product Overview

Build a responsive web application where users can save restaurants they want to visit or have visited, manage restaurant details, discover publicly shared places, comment, like, organize collections, and chat privately with other users.

**Primary language:** Thai-ready UI, designed for future English localization.

**Scope:** Modular monolith for MVP. Do not introduce microservices prematurely.

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js App Router, TypeScript |
| UI | Tailwind CSS, shadcn/ui, Lucide Icons |
| Frontend state | Zustand (client state), TanStack Query (server state) |
| Forms | React Hook Form, Zod |
| Backend | Go, Gin |
| Database | MySQL 8 |
| Go ORM | GORM (not Prisma Client: Prisma is not a maintained Go ORM) |
| DB migrations | golang-migrate or Goose; use versioned SQL migrations |
| Authentication | JWT access tokens, rotating refresh tokens, Google OAuth 2.0 / OpenID Connect |
| API contract | OpenAPI 3.1 specification |
| API documentation | **Scalar API Reference** rendered from OpenAPI |
| Real-time | Socket.IO-compatible Go library with verified client compatibility, or native WebSocket if interoperability becomes problematic |
| Maps | Leaflet + OpenStreetMap tiles (respect tile provider usage policy) |
| Image storage | S3-compatible MinIO in Docker with a persistent volume for development; S3 / Cloudflare R2 for production |
| Runtime | Docker Compose locally, deploy behind HTTPS reverse proxy |

### Important architecture rules

- **Go + GORM** is the selected backend implementation. Do not mix Prisma into the Go runtime; if schema generation is desired, use GORM models plus explicit SQL migrations.
- Do not store full image files as Base64 in MySQL. Save image object keys / URLs and metadata in MySQL. Base64 increases payload and storage size and is unsuitable for a feed with many images.
- Abstract image storage behind a `StorageProvider` interface (`S3StorageProvider` configured for local MinIO or production S3/R2). Local MinIO must use a persistent Docker volume; uploads require server-side validation.
- The Google Maps iframe/embed URL is optional. Keep `latitude`, `longitude`, and `map_url` separately. Sanitize / allowlist iframe providers; never render untrusted arbitrary iframe HTML.
- Start with a single Go API process. Chat connections can use the same application during MVP.
- Default to secure, maintainable patterns, typed request/response contracts, pagination, consistent errors, and authorization checks.

## 3. Roles & Visibility

- **GUEST:** view public feed, public restaurant detail, and public user profiles.
- **USER:** manage own restaurants, profile, collections, comments, likes, bookmarks, and chats.
- **ADMIN:** moderate reports, comments, and public restaurant content; manage users.
- Restaurant and collection visibility: `PUBLIC` / `PRIVATE`.
- Restaurant visit status: `WANT_TO_GO` / `VISITED`.
- Private resources are only visible to their owner (except narrowly authorized admin moderation as applicable).

## 4. Functional Requirements

### 4.1 Authentication & Authorization — P0

- [ ] Register with email and password.
- [ ] Log in / log out.
- [ ] Google OAuth 2.0 / OIDC login; link OAuth identities to accounts safely.
- [ ] Issue short-lived JWT access tokens and rotating refresh tokens.
- [ ] Persist hashed refresh tokens/sessions and support revocation.
- [ ] Password hashing (Argon2id or bcrypt), password reset flow.
- [ ] Protect backend endpoints; check resource ownership and user roles.
- [ ] Handle unauthorized sessions in frontend and secure token storage (prefer HttpOnly Secure SameSite cookies for refresh tokens).
- [ ] Throttle authentication endpoints and validate OAuth `state`, `nonce`, and redirect URIs.

### 4.2 Restaurant CRUD — P0

- [ ] Create / read / update / delete own restaurant entries.
- [ ] Name, description, address, contact/website (optional).
- [ ] Latitude/longitude and map pin selection.
- [ ] Google Maps link and safe optional embedded map preview.
- [ ] Cover photo plus multiple restaurant photos; image ordering and deletion.
- [ ] Menu item CRUD: name, description, optional photo, price.
- [ ] Approximate price per person (`price_min`, `price_max`, currency THB).
- [ ] Food categories, restaurant tags.
- [ ] Visit status (`WANT_TO_GO`, `VISITED`).
- [ ] Visibility (`PUBLIC`, `PRIVATE`).
- [ ] Validate all inputs, ownership, and image limits.

### 4.3 Feed & Discovery — P0

- [ ] Public restaurant feed and restaurant cards (cover image, name, address, price, social counts).
- [ ] Personal saved-restaurants feed (including private own items).
- [ ] Restaurant detail page with gallery, menu, map, comments.
- [ ] Search by name / address / category, with filters and sorting.
- [ ] Cursor-based pagination or carefully designed paginated infinite scrolling.
- [ ] Sort newest; add popularity sorting when engagement data is available.
- [ ] Do not expose private restaurants in public search, feed, or user profiles.

### 4.4 User Profile — P0

- [ ] Public profile: username, display name, avatar, bio, public saved restaurants.
- [ ] Edit own profile, avatar, cover image (optional).
- [ ] Profile restaurant counters and own restaurant list.
- [ ] Account preferences and privacy settings.

### 4.5 Comments, Ratings & Likes — P1

- [ ] Create, edit, delete own comments on public restaurants.
- [ ] Comment replies via `parent_id`.
- [ ] Like/unlike restaurants (one like per user and restaurant).
- [ ] Optional restaurant ratings (1–5) with clearly defined one-per-user rule.
- [ ] Report inappropriate comments/restaurants.
- [ ] Admin moderation and soft-deletion where appropriate.

### 4.6 Collections & Bookmarks — P1

- [ ] Create, edit, delete restaurant collections.
- [ ] Add/remove restaurant references to/from collections.
- [ ] `PUBLIC` / `PRIVATE` collections and shareable public URLs.
- [ ] Bookmark public restaurants created by others.
- [ ] Enforce privacy when a collection contains non-public restaurants.

### 4.7 Real-time Chat — P1

- [ ] Private 1:1 conversation creation and listing.
- [ ] Real-time message send/receive and database persistence.
- [ ] Conversation message history with pagination.
- [ ] Read/unread status, typing indicator, online/offline presence.
- [ ] Share a restaurant link/card in a conversation.
- [ ] Authenticate WebSocket/Socket.IO connections, authorize conversation membership and message reads/writes.
- [ ] Support reconnection and avoid duplicate messages (client idempotency key).
- [ ] Verify Go Socket.IO library is compatible with the installed browser `socket.io-client` protocol version before adopting it; plain WebSocket is an acceptable fallback.

### 4.8 Notifications — P2

- [ ] Notifications for new comments, replies, and chat messages.
- [ ] List notifications, mark read / mark all read.

### 4.9 Admin & Moderation — P2

- [ ] Admin dashboard with basic counts.
- [ ] List/manage users and flagged content.
- [ ] Moderate reported comments and restaurants; log moderation actions.
- [ ] Manage food categories and tags.

## 5. API Documentation — Scalar (Required)

**Scalar API Reference is mandatory.** Use OpenAPI as the source of truth for all REST endpoints, and serve interactive Scalar documentation directly from the Go backend.

Requirements:

- [ ] Maintain an OpenAPI 3.1 spec (`BE/docs/openapi.json` or generated equivalent).
- [ ] Expose the spec at `GET /openapi.json` (or `/openapi.yaml`).
- [ ] Expose Scalar UI at `GET /docs`.
- [ ] Organize endpoints into tags: `Auth`, `Users`, `Restaurants`, `Restaurant Images`, `Menus`, `Feed`, `Comments`, `Likes`, `Collections`, `Chats`, `Uploads`, `Admin`.
- [ ] Describe request/response schemas, error responses, status codes, pagination parameters, and examples.
- [ ] Define a JWT Bearer security scheme; explicitly annotate protected endpoints.
- [ ] Provide a development server and production server in the OpenAPI servers configuration.
- [ ] Make Scalar's “Try It” capability work against the configured API, including auth and CORS rules.
- [ ] Keep the OpenAPI spec up to date when backend contracts change. Add contract validation/linting to CI when practical.
- [ ] Keep production docs configurable (`ENABLE_API_DOCS`) and protect or disable Try It as needed for production security.

**Implementation direction:** Choose a maintained Scalar Go/Gin integration or serve Scalar's supported web bundle/page yourself using the OpenAPI document. Verify current package API and compatibility before coding; do not invent a library's function signature.

**Realtime docs:** Document Socket.IO/WebSocket events and payloads in `docs/realtime.md` (or AsyncAPI), because OpenAPI describes HTTP APIs rather than the WebSocket event contract.

## 6. Suggested REST API (`/api/v1`)

| Method | Route | Purpose |
|---|---|---|
| POST | `/auth/register` | Register |
| POST | `/auth/login` | Login |
| POST | `/auth/refresh` | Refresh session |
| POST | `/auth/logout` | Revoke refresh session |
| GET | `/auth/google` | Start Google OAuth |
| GET | `/auth/google/callback` | Complete Google OAuth |
| POST | `/auth/forgot-password` | Request password reset |
| POST | `/auth/reset-password` | Reset password |
| GET | `/users/me` | My profile |
| PATCH | `/users/me` | Update profile |
| GET | `/users/:username` | Public profile |
| GET | `/restaurants` | Search/list restaurants with visibility rules |
| POST | `/restaurants` | Create restaurant |
| GET | `/restaurants/:id` | Restaurant detail |
| PATCH | `/restaurants/:id` | Update own restaurant |
| DELETE | `/restaurants/:id` | Delete own restaurant |
| POST | `/restaurants/:id/images` | Attach uploaded image |
| PATCH | `/restaurants/:id/images/:imageId` | Set cover/order |
| DELETE | `/restaurants/:id/images/:imageId` | Remove image |
| POST | `/restaurants/:id/menus` | Add menu item |
| PATCH | `/restaurants/:id/menus/:menuId` | Update menu item |
| DELETE | `/restaurants/:id/menus/:menuId` | Delete menu item |
| GET | `/feed` | Public feed |
| GET | `/restaurants/:id/comments` | List comments |
| POST | `/restaurants/:id/comments` | Add comment |
| PATCH | `/comments/:id` | Edit own comment |
| DELETE | `/comments/:id` | Delete own comment |
| POST | `/restaurants/:id/likes` | Like |
| DELETE | `/restaurants/:id/likes` | Unlike |
| GET | `/collections` | My collections |
| POST | `/collections` | Create collection |
| GET | `/collections/:id` | Collection detail (visibility-aware) |
| PATCH | `/collections/:id` | Update collection |
| DELETE | `/collections/:id` | Delete collection |
| POST | `/collections/:id/restaurants` | Add restaurant to collection |
| DELETE | `/collections/:id/restaurants/:restaurantId` | Remove restaurant |
| GET | `/conversations` | List own chats |
| POST | `/conversations` | Start 1:1 chat |
| GET | `/conversations/:id/messages` | Paginated messages |
| POST | `/uploads/images` | Upload image (multipart) |

REST error format recommendation: `{ "error": { "code": "...", "message": "...", "details": ... } }` with appropriate HTTP status codes.

## 7. Socket Events (Proposed)

| Direction | Event | Meaning |
|---|---|---|
| Client → Server | `conversation:join` | Join authorized conversation room |
| Client → Server | `message:send` | Send message + client message ID |
| Server → Client | `message:new` | Deliver persisted message |
| Client → Server | `message:read` | Update read cursor |
| Server → Client | `message:read_update` | Read receipt |
| Client → Server | `typing:start` / `typing:stop` | Typing status |
| Server → Client | `presence:update` | Online status (best effort) |

All events must have a documented payload schema, auth requirements, and error/ack response.

## 8. Database Design (Initial)

Implemented schema source of truth: `BE/migrations/000001_initial_schema.up.sql`; relationships and application invariants: `BE/docs/database.md`. The table below is the initial concept. The migration normalizes image metadata into `media_objects` and `user_profile_images`, uses explicit foreign keys for report/notification targets, and adds password reset tokens and moderation actions.

Use string UUIDs or UUID-compatible identifiers consistently; keep created/updated timestamps in UTC, use proper foreign keys and indexes.

| Table | Important fields |
|---|---|
| `users` | id, email unique, password_hash nullable, username unique, display_name, avatar_key, cover_key, bio, role, created_at, updated_at |
| `oauth_accounts` | id, user_id, provider, provider_user_id, unique(provider, provider_user_id) |
| `refresh_sessions` | id, user_id, token_hash, expires_at, revoked_at |
| `restaurants` | id, user_id, name, description, address, lat, lng, map_url, price_min, price_max, currency, visit_status, visibility, created_at, updated_at, deleted_at |
| `restaurant_images` | id, restaurant_id, storage_key, mime_type, size_bytes, sort_order, is_cover |
| `restaurant_menus` | id, restaurant_id, name, description, price, image_key |
| `categories` | id, name, slug |
| `tags` | id, name, slug |
| `restaurant_tags` | restaurant_id, tag_id |
| `restaurant_categories` | restaurant_id, category_id |
| `comments` | id, restaurant_id, user_id, parent_id nullable, content, created_at, updated_at, deleted_at |
| `restaurant_likes` | user_id, restaurant_id, created_at; unique(user_id, restaurant_id) |
| `restaurant_ratings` | user_id, restaurant_id, score; unique(user_id, restaurant_id) (P1 optional) |
| `collections` | id, user_id, name, description, visibility, created_at, updated_at |
| `collection_restaurants` | collection_id, restaurant_id, created_at; composite unique |
| `bookmarks` | user_id, restaurant_id, created_at; composite unique |
| `conversations` | id, type, created_at |
| `conversation_members` | conversation_id, user_id, last_read_message_id nullable, joined_at |
| `messages` | id, conversation_id, sender_id, content, client_message_id, created_at |
| `reports` | id, reporter_id, target_type, target_id, reason, status |
| `notifications` | id, user_id, type, reference_id, is_read, created_at |

Indexes: restaurants `(visibility, created_at)`, `(user_id, created_at)`, filtering columns, comments `(restaurant_id, created_at)`, messages `(conversation_id, created_at)`, conversation members `(user_id, conversation_id)`. Design full-text search appropriate to MySQL collation and Thai-language limitations.

## 9. Image Upload & Map Guidelines

### Upload

1. Next.js uploads a `multipart/form-data` image to `POST /api/v1/uploads/images`.
2. Go verifies authenticated user, actual file signature, allowed formats, max size, and dimensions.
3. Re-encode/resize to WebP or JPEG, strip unnecessary metadata, generate random object key.
4. Store bytes through `StorageProvider`; record storage key and metadata in MySQL when attaching the image to an entity.
5. Return a public URL (or authorized URL if image is private) to render in UI.
6. Avoid arbitrary SVG uploads and path traversal. Remove orphan uploads periodically.

Development: MinIO in Docker Compose with a persistent named volume and private image bucket. Store object keys and metadata in `media_objects`; issue authorized, short-lived presigned URLs. Production: S3-compatible object storage (e.g. R2). Do not assume free-tier quotas are permanent; verify pricing before deployment.

### Maps

- Use interactive Leaflet map and coordinate selection.
- Persist lat/lng as the canonical pin location.
- Use a separate Google Maps link for external navigation.
- Optional iframe preview must use a strictly allowlisted URL source. No raw pasted HTML iframe execution.
- Observe OSM attribution and tile usage policies. A tile service may need replacing if traffic increases.

## 10. Frontend Routes

```text
/
/login
/register
/forgot-password
/feed
/restaurants
/restaurants/new
/restaurants/[id]
/restaurants/[id]/edit
/map
/collections
/collections/[id]
/chat
/chat/[conversationId]
/profile/edit
/profile/[username]
/settings
/admin
/admin/users
/admin/restaurants
/admin/reports
```

Suggested structure:

```text
restaurant-platform/
├── BE/
│   ├── cmd/server/
│   ├── internal/
│   │   ├── domain/
│   │   ├── port/
│   │   ├── usecase/
│   │   ├── adapter/{http,mysql,storage,security,mail,google,image}/
│   │   ├── config/
│   │   └── bootstrap/
│   ├── docs/openapi.json
│   ├── migrations/
│   ├── scripts/
│   └── tests/
├── FE/
│   └── src/{app,components,features,lib}/
├── infra/
├── docker-compose.yml
└── README.md
```

## 11. Delivery Phases

### Phase 1 — MVP / P0
- Project bootstrap, Docker Compose, MySQL migrations.
- Gin REST API + OpenAPI 3.1 + Scalar `/docs` + `/openapi.json`.
- Registration/login/Google OAuth, JWT and refresh sessions.
- Profile CRUD.
- Restaurant CRUD with menus, image uploads, map pins, visibility.
- Public feed, personal list, search/filter, restaurant details.

### Phase 2 — Social / P1
- Comments and replies, likes, ratings.
- Bookmarks and collections.

### Phase 3 — Chat / P1
- Persisted conversations, Socket.IO or native WS, read receipt, typing, presence, restaurant sharing.
- Event documentation and integration tests.

### Phase 4 — Operational / P2
- Notifications, reports/admin moderation, throttling, logging/monitoring, security hardening, CI/CD and deployment.

## 12. Acceptance Criteria

- [ ] `docker compose up` starts MySQL, backend, and frontend for local development.
- [ ] DB schema is created with repeatable versioned migrations.
- [ ] `GET /docs` opens Scalar and lists actual implemented endpoints.
- [ ] `GET /openapi.json` produces valid OpenAPI and API calls use consistent contracts.
- [ ] User can register/login and use Google sign-in.
- [ ] User can add/edit/delete restaurants with photos, menus, prices, and a map pin.
- [ ] Users see only public restaurants of others; owner sees own private ones.
- [ ] Feed supports pagination and search.
- [ ] Permission checks prevent editing/deleting others' restaurants and comments.
- [ ] File uploads have size/type/security validation.
- [ ] Tests cover auth, visibility, restaurant CRUD, and OpenAPI spec validity.
- [ ] Later phases add tested comments, collections, and private chat with event contracts.

## 13. Prompt to Continue Implementation

```text
You are a senior full-stack software engineer. Implement the Restaurant Collection & Social Platform described in this Markdown specification.

Tech stack: Next.js App Router + TypeScript + shadcn/ui + Tailwind + TanStack Query + Zustand; Go + Gin + GORM; MySQL 8; JWT and Google OAuth; Scalar API Reference backed by OpenAPI 3.1; Leaflet + OpenStreetMap; S3-compatible image storage using Docker MinIO locally and S3/R2 in production; Socket.IO-compatible Go realtime implementation or native WebSocket if necessary.

Proceed with Phase 1 first. Create a maintainable modular monolith and provide runnable code, migrations, Docker Compose, environment variable examples, typed API contracts, and README setup instructions. Set up Scalar on /docs and expose the OpenAPI spec early in the implementation. Implement secure authentication, ownership/visibility rules, and validated image uploads. Do not implement unrequested later phases before Phase 1 is working. For every completed module, add endpoints to OpenAPI and provide tests. Explain any compatibility tradeoff rather than guessing package APIs.
```
