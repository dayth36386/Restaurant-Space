# Restaurant Space web

UI ตาม Figma "Restaurant Collection — Minimal Modern UI Kit" (Savorly design system: พื้น `#FAF8F3`, primary `#426B4D`, sage/peach/gold, Inter + IBM Plex Sans Thai) tokens อยู่ใน `src/app/globals.css`

Next.js 16 (App Router, Cache Components) + TypeScript, Tailwind v4, shadcn/ui (radix), TanStack Query, Zustand, React Hook Form + Zod และ Leaflet/OpenStreetMap เชื่อมกับ Go API ใน `../BE` ตามสัญญาใน `BE/docs/openapi.json`

## รัน

```sh
# ผ่าน Compose (จาก root): เปิด http://localhost:3000
docker compose up --build -d web

# หรือ dev server (API ต้องรันอยู่ที่ :8080)
cd FE && npm install && npm run dev
```

`NEXT_PUBLIC_API_URL` (default `http://localhost:8080`) ถูกฝังตอน build; Compose ส่งค่า `API_PUBLIC_URL` ให้ origin ของเว็บต้องตรงกับ `WEB_ORIGIN` ของ API (CORS)

## หน้าที่มี

| Route                                                                                 |                                                                                                         |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `/`, `/feed`                                                                          | ฟีดสาธารณะ (hero + ค้นหา + chip ประเภท sync กับ URL), infinite scroll ด้วย cursor                       |
| `/restaurants`                                                                        | ร้านของฉัน (รวม private) กรองสถานะ                                                                      |
| `/restaurants/new`, `/[id]`, `/[id]/edit`                                             | สร้าง/ดู/แก้ไขร้าน: ปักหมุด Leaflet, ราคา, visibility, หมวด/แท็ก, รูป (ปก/เรียง/ลบ), เมนู CRUD พร้อมรูป |
| `/map`                                                                                | แผนที่ร้านของฉัน / ร้านสาธารณะ                                                                          |
| `/profile/[username]`, `/profile/edit`                                                | โปรไฟล์สาธารณะ, แก้ไขชื่อ/bio/avatar/cover                                                              |
| `/settings`                                                                           | ภาษา, ธีม, visibility เริ่มต้น, ออกจากระบบ                                                              |
| `/login`, `/register`, `/forgot-password`, `/reset-password`, `/auth/google/callback` | Auth                                                                                                    |

| `/chat`, `/chat/[conversationId]` | แชท 1:1 realtime: รายการแชท + unread badge, ห้องสนทนา, typing, ออนไลน์, อ่านแล้ว, แชร์การ์ดร้าน |

หน้ารายละเอียดร้านมีปุ่มถูกใจ, "ทักเจ้าของร้าน" และความคิดเห็น (ตอบกลับ 1 ชั้น, แก้ไข/ลบของตัวเอง) หน้าโปรไฟล์มีปุ่ม "ส่งข้อความ" ยังไม่มี collections, ratings, notifications และ admin เพราะ BE ยังไม่เปิด endpoints

## Realtime

`src/lib/realtime.ts` ต่อ WebSocket `/api/v1/ws` ตอน login, ส่ง token เป็น frame แรก (ไม่ใส่ใน URL) และส่ง auth ใหม่ทุกครั้งที่ access token เปลี่ยน, reconnect แบบ backoff (ถ้าปิดด้วย 4001 จะ refresh ก่อน) `src/features/chat/realtime-bridge.tsx` รวม event เข้า TanStack Query cache และโหลดประวัติใหม่หลัง reconnect การส่งข้อความเป็น optimistic และใช้ `client_message_id` เดิมทั้งตอน retry และตอน fallback ไป REST จึงไม่เกิดข้อความซ้ำ

## Auth

- Access token อยู่ใน memory (Zustand) เท่านั้น refresh token เป็น HttpOnly cookie ของ API เรียกด้วย `credentials: "include"`
- `src/lib/api/client.ts` รวม refresh ที่กำลังทำงานเป็น promise เดียว และ serialize ข้ามแท็บด้วย Web Locks เพราะ BE ถือว่าการใช้ refresh token ซ้ำพร้อมกันเป็น replay แล้ว revoke ทั้ง family; ถ้าได้ 401 จะ refresh แล้วลองใหม่หนึ่งครั้ง
- localStorage เก็บแค่ hint ว่า "น่าจะมี session" (ไม่ใช่ token) เพื่อให้ guest ไม่ต้องยิง `/auth/refresh` ทุกครั้งที่โหลดหน้า — `/auth/*` ถูกจำกัด 20 req/นาที/IP
- Google: `GOOGLE_REDIRECT_URL` ชี้มาที่ `http://localhost:3000/auth/google/callback` หน้านั้นส่ง `state`/`code` ต่อให้ API

## โครงสร้าง

```text
src/app/            routes (server components บาง ๆ ที่ render view)
src/features/       auth, feed, restaurant, map, profile, home
src/components/     layout, shadcn ui/, shared pieces
src/hooks/          TanStack Query hooks, URL state
src/lib/api/        typed client, endpoints, types (mirror OpenAPI)
src/lib/i18n/       ข้อความภาษาไทย (เพิ่ม en.ts รูปแบบเดียวกันได้)
src/stores/         Zustand auth store
```

Data fetching ทั้งหมดทำฝั่ง client เพราะ token อยู่ใน browser; layout ครอบ `Suspense` ไว้ตามข้อกำหนดของ `cacheComponents`

## Code style

Prettier (`.prettierrc.json`, เรียง class ของ Tailwind ด้วย `prettier-plugin-tailwindcss`) จัด format ส่วน ESLint (`eslint-config-next` + `eslint-config-prettier`) ตรวจโค้ด โดยปิดกฎด้าน format ที่ชนกับ Prettier

```sh
npm run format        # จัด format ทุกไฟล์
npm run lint:fix      # แก้ปัญหาที่ ESLint แก้อัตโนมัติได้
npm run check         # format:check + lint + typecheck (ใช้ก่อน commit/CI)
npm run build
```
