# Restaurant Space backend

Commands using Docker Compose below run from the repository root (the parent of `BE/`). See [Clean Architecture](docs/architecture.md) for layer boundaries.

Go + Gin + GORM backend ตาม `restaurant-platform-spec.md` Phase 1–3 (ร้าน, คอมเมนต์/ไลก์, แชท 1:1 แบบ realtime) ใช้ MySQL 8.4, MinIO จำลอง S3 และ Mailpit รับอีเมลทดสอบ มี 42 HTTP operations รวม health checks และ WebSocket `/api/v1/ws` พร้อม OpenAPI 3.1 และ Scalar; event ของ WebSocket อยู่ใน [docs/realtime.md](docs/realtime.md) ยังไม่มี collections/bookmarks, ratings, notifications และ admin (Phase 2 ส่วนที่เหลือ และ Phase 4)

## เริ่มระบบ

เปิด Docker Desktop แล้วรันจากโฟลเดอร์นี้:

```sh
# ทำครั้งแรกเท่านั้น; ถ้ามี .env อยู่แล้วให้เพิ่มค่าที่ขาดจาก .env.example
cp .env.example .env
docker compose up --build -d
docker compose logs api migrate minio-init
docker compose ps -a
```

Build stage จะดาวน์โหลด Go dependencies, รัน unit tests และ build binary ก่อนเริ่ม API ส่วน API รอ migration และสร้าง bucket สำเร็จก่อน การรันซ้ำไม่ล้างข้อมูล

| Service | Address |
| --- | --- |
| API | http://localhost:8080/api/v1 |
| Scalar API docs | http://localhost:8080/docs |
| OpenAPI JSON | http://localhost:8080/openapi.json |
| Liveness / readiness | `/healthz` / `/readyz` |
| Mailpit inbox | http://localhost:8025 |
| MinIO Console | http://localhost:9001 |
| S3 API | http://localhost:9000 |
| MySQL | 127.0.0.1:3306 |

ค่าเริ่มต้นเฉพาะ local: MySQL database `restaurant_space`, user `restaurant`, password `restaurant_dev_password`; MinIO admin `minioadmin` / `minio_dev_password`; application S3 key `restaurant-app` / `restaurant_s3_dev_password`; bucket `restaurant-images` เป็น private

## สิ่งที่ implement

- Register/login ด้วย bcrypt, JWT access token 15 นาที, HttpOnly refresh cookie 30 วัน หมุน token และ revoke ทั้ง family เมื่อพบ reuse; logout และ reset password ยกเลิก access token ของ session ที่เกี่ยวข้องทันทีผ่านการตรวจ session ใน DB
- Google OIDC พร้อม state cookie, nonce, PKCE และตรวจ signature/issuer/audience/expiry บัญชี email ซ้ำจะตอบ 409 โดยไม่ auto-link
- Forgot/reset password ส่งลิงก์เข้า Mailpit และเก็บเฉพาะ token hash ใน DB
- Profile, avatar/cover, preferences และ public profile ที่ไม่เปิดเผย email
- Restaurant CRUD, ownership, PRIVATE/PUBLIC, search/filter, cursor pagination, public feed และ soft delete
- Restaurant gallery, ตั้งปก/ลำดับ, menu CRUD, categories/tags read endpoints
- Upload JPEG/PNG/WebP ตรวจ decode จำกัด 8 MiB/20 megapixels ย่อไม่เกิน 2048 px แล้ว re-encode JPEG ก่อนส่ง S3; URL มีอายุ 5 นาที
- Cleanup worker ทุกชั่วโมงสำหรับ uploads ที่ไม่มี reference เกิน 24 ชั่วโมง และ retry การลบที่ค้าง

## ทดลอง API

เริ่มจาก Register ใน Scalar แล้วนำ `access_token` ไปใส่ Bearer authentication หรือใช้ curl:

```sh
curl -c /tmp/restaurant-cookies.txt -X POST http://localhost:8080/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","username":"demo_user","display_name":"ผู้ใช้ทดสอบ","password":"demo-password-123"}'
```

ใช้ token ที่ได้รับ (แทนค่าด้านล่าง):

```sh
curl -X POST http://localhost:8080/api/v1/restaurants \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"name":"ร้านโปรด","visibility":"PRIVATE","price_min":100,"price_max":300}'

curl -X POST http://localhost:8080/api/v1/uploads/images \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -F 'file=@/path/to/photo.jpg'
```

นำ `media.id` ไปส่ง `POST /restaurants/{id}/images` ด้วย `{"media_id":"...","is_cover":true}` ใช้ image URL ที่ API ส่งกลับสำหรับแสดงรูป ไม่เก็บ URL ที่ sign แล้วใน DB

`GET /restaurants?mine=true` คืนร้านตัวเองรวม private, `/restaurants?user_id={uuid}` กรองตามเจ้าของโดยยังตรวจ visibility; `/feed` คืนเฉพาะ public เสมอ

Frontend ต้องใช้ `credentials: 'include'` สำหรับ auth cookie และ serialize refresh requests (ห้าม refresh token เดียวกันพร้อมกัน เพราะถือเป็น reuse) หลัง Google callback API คืน token JSON และ cookie; frontend สามารถนำทางกลับแล้วเรียก refresh เพื่อรับ access token โดยไม่ส่ง token ผ่าน URL

## Google OAuth และ reset password

เติม `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` และ `GOOGLE_REDIRECT_URL` ให้ตรงกับ OAuth application จากนั้น recreate API ถ้ายังไม่ตั้งค่า Google endpoint จะตอบ 503 แต่ email/password login ใช้ได้

เปิด `GET /api/v1/auth/google` ผ่าน browser navigation สำหรับ login บัญชีใหม่หรือ Google identity เดิม การ link Google กับบัญชี password ที่มี email อยู่แล้วต้องเพิ่ม flow ยืนยันตัวตนแยก ยังไม่ implement การ link บัญชี

Forgot password ส่งเมลไป Mailpit ลิงก์ชี้ `PASSWORD_RESET_URL` จึงคัดลอกค่า `token` ในลิงก์ไปทดสอบ `POST /auth/reset-password` ผ่าน Scalar ได้ SMTP รองรับ `SMTP_TLS=none|starttls|tls` และ AUTH PLAIN (`SMTP_USERNAME`/`SMTP_PASSWORD`, บังคับใช้คู่กับ TLS) พร้อม header `Date`/`Message-ID`; local ใช้ `none` กับ Mailpit

## ทดสอบ

```sh
# Build รัน unit tests, image normalization, validation, JWT rejection,
# protected routes และ route/OpenAPI consistency
docker compose build api

# Integration tests: auth, privacy, ownership, pagination, images, menus,
# profiles และ refresh-token replay (สร้างข้อมูลทดสอบใน dev DB)
docker compose --profile test run --rm api-smoke

# Schema constraints / S3 protocol
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u"$MYSQL_USER" "$MYSQL_DATABASE"' < BE/tests/schema-smoke.sql
docker compose --profile test run --rm storage-smoke
```

หากมี Go 1.24+ ในเครื่อง:

```sh
cd BE
go mod tidy
gofmt -w cmd internal docs/embed.go
go test ./...
go vet ./...
```

The workspace does not yet contain a resolved `go.sum`: downloading external modules is blocked in this sandbox. Docker builds run `go mod tidy` before tests. On a network-enabled host, run `go mod tidy` in `BE/` and keep the resulting go.mod/go.sum in version control.

## Migrations / operations

```sh
docker compose run --rm migrate up
docker compose exec api /api cleanup
```

ใช้ SQL migrations เป็นแหล่ง schema หลัก ไม่ใช้ GORM AutoMigrate; เพิ่ม migration 000002 สำหรับ OAuth state การ rollback หนึ่ง version ด้วย `down 1` จะลบ OAuth state table และทำให้ Google login ใช้ไม่ได้จน migrate up การ rollback initial schema จะลบข้อมูลทั้งหมด ใช้เฉพาะ dev DB ที่ทิ้งได้

MySQL/MinIO ใช้ named volumes ข้อมูลอยู่หลัง `docker compose down`; `down -v` จะลบข้อมูลทั้งหมด การเปลี่ยนรหัส MySQL ใน `.env` ไม่เปลี่ยน credentials ใน volume เดิม ต้องปรับบัญชีใน DB ให้ตรงด้วย

`ENABLE_API_DOCS=false` ปิด `/docs` และ `/openapi.json`; Scalar UI โหลด JavaScript จาก CDN ตาม [Scalar HTML integration](https://scalar.com/products/api-references/integrations/html-js) ส่วน API ไม่ต้องพึ่ง CDN เปลี่ยน `API_PUBLIC_URL`, `WEB_ORIGIN` และ `S3_PUBLIC_ENDPOINT` ให้ตรง URL ที่ browser ใช้เมื่อเปลี่ยน port/domain

## ขอบเขตและสถานะการตรวจ

Verification after refactoring: Go use-case tests and dependency-direction tests pass, along with Compose configuration and the OpenAPI route check. After adding comments, likes and chat (42 routes): `go vet`/`go test ./...`, `tests/api-smoke.py` against the Compose stack, a WebSocket integration script (auth, acks, dedupe, typing, read receipts, presence, 4001 closes, origin check, >60 s idle) and two-user browser tests all pass.

Categories/tags เริ่มต้นว่าง จัดการผ่าน SQL ก่อนจนกว่าจะเพิ่ม Admin module; API ไม่เปิดให้ผู้ใช้ทั่วไปสร้าง taxonomy ไม่มี OAuth account linking, collections/bookmarks, ratings, notifications หรือ admin endpoints; realtime hub อยู่ใน memory ของ API process เดียว ถ้าจะ scale หลาย instance ต้องเพิ่ม broker (ดู docs/realtime.md)

MinIO server and mc are built locally from pinned upstream GitHub release tags in `infra/minio/Dockerfile`, without pulling MinIO images from Quay or Docker Hub. The first build needs GitHub/Go module access and takes longer; subsequent builds reuse Docker cache. Existing service names, credentials, ports and `minio_data` are preserved. For production follow [DEPLOY.md](../DEPLOY.md): S3/R2, a new JWT secret, HTTPS and `COOKIE_SECURE=true`. Behind a reverse proxy set `TRUSTED_PROXIES` (IPs/CIDRs) so auth rate limiting sees real client IPs; it is per API process.

รายละเอียดเพิ่มเติม: [database / ER diagram](docs/database.md), [storage lifecycle](docs/storage.md), [backend structure](docs/architecture.md)

If an earlier startup failed with Quay `401 UNAUTHORIZED`, run `docker compose up --build -d` again after this change. Do not run `down -v`: rebuilding does not require deleting data.

Pinned upstream sources: [MinIO server](https://github.com/minio/minio/tree/RELEASE.2025-04-22T22-12-26Z), [MinIO client](https://github.com/minio/mc/tree/RELEASE.2025-04-16T18-13-26Z).

## Code style

Go ใช้ `gofmt` + `goimports` เป็น formatter และ `golangci-lint` (config ใน `.golangci.yml`) เป็น linter แทน Prettier/ESLint `golangci-lint` รันผ่าน Docker image ที่ pin เวอร์ชันไว้ใน `Makefile` จึงไม่ต้องติดตั้งเพิ่ม

```sh
make fmt        # จัด format + เรียง import
make lint       # ตรวจด้วย golangci-lint
make check      # fmt-check + lint + go vet + go test
```
