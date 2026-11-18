# Deploy Restaurant Space

คู่มือ deploy ขึ้น production แบบ **VPS เครื่องเดียว + Docker Compose + Caddy (HTTPS อัตโนมัติ)** เก็บรูปบน **Cloudflare R2** (หรือ S3) และส่งอีเมลผ่าน SMTP จริง

```text
            Internet (80/443)
                   │
              ┌────▼────┐   Let's Encrypt, HSTS, gzip/zstd, WebSocket
              │  Caddy  │
              └─┬─────┬─┘
     example.com│     │api.example.com
          ┌─────▼─┐ ┌─▼──────┐        ┌──────────────┐
          │  web  │ │  api   ├───────►│ R2 / S3      │ รูปภาพ (private bucket)
          │Next.js│ │ Go+WS  ├───────►│ SMTP         │ อีเมล reset password
          └───────┘ └─┬──────┘        └──────────────┘
                      │ network "data" (ไม่มีทางออกอินเทอร์เน็ต)
                 ┌────▼────┐  ┌─────────┐
                 │  MySQL  │◄─┤ migrate │ (รันครั้งเดียวก่อน api)
                 └─────────┘  └─────────┘
```

| ไฟล์ | ใช้ทำอะไร |
| --- | --- |
| `docker-compose.prod.yml` | stack production: caddy, web, api, migrate, mysql (ไม่มี MinIO/Mailpit/Adminer) |
| `infra/caddy/Caddyfile` | HTTPS + reverse proxy สำหรับ `WEB_DOMAIN` และ `API_DOMAIN` |
| `.env.production.example` | ตัวอย่างค่าทั้งหมด → คัดลอกเป็น `.env.production` (ห้าม commit) |
| `docker-compose.yml` | **สำหรับ dev เท่านั้น** ห้ามใช้บน server |

---

## 1. สิ่งที่ต้องเตรียมก่อน

| รายการ | รายละเอียด |
| --- | --- |
| **VPS** | Linux (Ubuntu 24.04 แนะนำ) อย่างน้อย 2 vCPU / 4 GB RAM / 40 GB disk เช่น DigitalOcean, Hetzner, AWS Lightsail |
| **โดเมน** | ต้องอยู่ใต้โดเมนหลักเดียวกัน เช่น `example.com` + `api.example.com` ⚠️ ห้ามแยกคนละโดเมน (เช่น `*.vercel.app` + `*.onrender.com`) เพราะ refresh cookie (`SameSite=Lax`) จะไม่ถูกส่ง ผู้ใช้จะหลุด login ทุกครั้งที่ refresh |
| **Object storage** | Cloudflare R2 (หรือ AWS S3) — bucket แบบ **private** |
| **SMTP** | ผู้ให้บริการอีเมล เช่น Resend, Postmark, Amazon SES (port 587 STARTTLS หรือ 465 TLS) พร้อมตั้ง SPF/DKIM ของโดเมนผู้ส่ง |
| **Map tiles** | ผู้ให้บริการ tile เช่น MapTiler, Stadia, Carto (tile ฟรีของ OpenStreetMap **ห้าม**ใช้กับ traffic จริง) |
| **Google OAuth** | ไม่บังคับ — ถ้าจะเปิด login ด้วย Google |

## 2. ตั้งค่าบริการภายนอก

### DNS
สร้าง record ชี้ไปที่ IP ของ VPS (ถ้าใช้ Cloudflare ให้ตั้งเป็น **DNS only** ก่อน เพื่อให้ Caddy ขอใบรับรองได้):

```text
A   example.com       → <VPS IP>
A   api.example.com   → <VPS IP>
```

### Cloudflare R2
1. R2 → **Create bucket** เช่น `restaurant-images` (ไม่ต้องเปิด public access)
2. R2 → **Manage API tokens** → สร้าง token สิทธิ์ **Object Read & Write** จำกัดเฉพาะ bucket นี้
3. จดค่า Access Key ID, Secret Access Key และ endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

ไม่ต้องตั้ง CORS: รูปแสดงผ่าน presigned URL อายุ 5 นาทีใน `<img>` และอัปโหลดผ่าน API

### SMTP (ตัวอย่าง Resend)
`SMTP_ADDR=smtp.resend.com:587`, `SMTP_USERNAME=resend`, `SMTP_PASSWORD=<API key>`, `SMTP_TLS=starttls` และ verify โดเมนผู้ส่งตามที่ผู้ให้บริการบอก

### Google OAuth (ถ้าใช้)
Google Cloud Console → Credentials → OAuth client:
- **Authorized redirect URI**: `https://example.com/auth/google/callback`
- OAuth consent screen: เปลี่ยนเป็น **In production**
- แนะนำสร้าง client secret ใหม่สำหรับ production (ไม่ใช้ตัวเดียวกับ dev)

## 3. เตรียม server

```sh
# ติดตั้ง Docker Engine + Compose plugin (Ubuntu)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # logout/login ใหม่

# เปิด firewall เฉพาะ SSH และเว็บ
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443/tcp && sudo ufw allow 443/udp
sudo ufw enable
```

นำโค้ดขึ้น server (git clone หรือ `rsync`) — ต้องมีโฟลเดอร์ `BE/`, `FE/`, `infra/`, `docker-compose.prod.yml` และ `.env.production.example`

## 4. ตั้งค่า `.env.production`

```sh
cp .env.production.example .env.production
chmod 600 .env.production
openssl rand -base64 48   # ใช้สร้าง JWT_SECRET, MYSQL_PASSWORD, MYSQL_ROOT_PASSWORD (สร้างแยกแต่ละค่า)
```

แก้ทุกค่าในไฟล์ ถ้าค่าที่จำเป็นว่าง compose จะหยุดพร้อมบอกชื่อค่าที่ขาด

ค่าเหล่านี้ **compose ตั้งให้อัตโนมัติจากโดเมน** ไม่ต้องใส่เอง: `WEB_ORIGIN`, `API_PUBLIC_URL`, `NEXT_PUBLIC_API_URL`, `GOOGLE_REDIRECT_URL`, `PASSWORD_RESET_URL`, `COOKIE_SECURE=true`, `TRUSTED_PROXIES` (IP คงที่ของ Caddy `172.30.0.10`)

> `NEXT_PUBLIC_*` (API URL, map tiles) ถูกฝังใน FE ตอน build — ถ้าเปลี่ยนโดเมนหรือ tile provider ต้อง build `web` ใหม่

## 5. Deploy

```sh
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f caddy api
```

ลำดับการเริ่ม: mysql (healthy) → migrate (รันจนจบ) → api → web/caddy ครั้งแรก Caddy จะขอใบรับรองใช้เวลาประมาณ 10–60 วินาที

แนะนำตั้ง alias ไว้ใช้ทุกครั้ง:

```sh
alias prod='docker compose -f docker-compose.prod.yml --env-file .env.production'
```

## 6. ตรวจหลัง deploy

- [ ] `https://api.example.com/readyz` → `{"status":"ready"}`
- [ ] `http://example.com` redirect ไป `https://` และมี header `Strict-Transport-Security`
- [ ] สมัคร → refresh หน้าแล้วยัง login อยู่ (ยืนยันว่า cookie ข้าม subdomain ทำงาน)
- [ ] อัปโหลดรูปร้าน แล้วรูปแสดง (R2 ทำงาน)
- [ ] ลืมรหัสผ่าน → ได้อีเมลจริง ลิงก์เป็น `https://example.com/reset-password?token=…`
- [ ] แชทระหว่าง 2 บัญชีเห็นข้อความทันที (WebSocket `wss://` ผ่าน Caddy)
- [ ] login ด้วย Google (ถ้าเปิด)
- [ ] `https://api.example.com/docs` → 404 (ถ้า `ENABLE_API_DOCS=false`)

## 7. ข้อมูลเริ่มต้น: หมวดหมู่อาหาร

ยังไม่มีหน้า admin — หมวดหมู่/แท็กว่างตอนเริ่ม ใส่ผ่าน SQL:

```sh
prod exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u"$MYSQL_USER" --default-character-set=utf8mb4 "$MYSQL_DATABASE"' <<'SQL'
INSERT INTO categories (id, name, slug) VALUES
  (UUID(), 'ก๋วยเตี๋ยว', 'noodles'),
  (UUID(), 'อาหารตามสั่ง', 'made-to-order'),
  (UUID(), 'คาเฟ่', 'cafe'),
  (UUID(), 'อาหารญี่ปุ่น', 'japanese'),
  (UUID(), 'อีสาน', 'isan'),
  (UUID(), 'ของหวาน', 'dessert');
SQL
```

## 8. งานประจำ (operations)

### อัปเดตเวอร์ชัน
```sh
git pull                     # หรือ rsync โค้ดใหม่
prod up -d --build           # migrate จะรัน migration ใหม่ก่อน api เริ่ม
```
การ deploy ใหม่ทำให้ API restart สั้น ๆ: ผู้ใช้ที่เปิดแชทอยู่จะ reconnect เอง

### Logs
```sh
prod logs -f --since 1h api
```

### Backup MySQL (ทำทุกวัน และเก็บนอก server)
```sh
prod exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --routines --default-character-set=utf8mb4 restaurant_space' \
  | gzip > backup-$(date +%F).sql.gz
```
ตัวอย่าง cron (ตี 3 ทุกวัน): `0 3 * * * cd /srv/restaurant-space && <คำสั่งด้านบน>` แล้วคัดลอกไฟล์ไปเก็บที่อื่น (เช่น R2 bucket แยก) และเปิด versioning/lifecycle ของ bucket รูปภาพ

### Restore
```sh
gunzip -c backup-YYYY-MM-DD.sql.gz | prod exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot restaurant_space'
```
ควรทดลอง restore ลงเครื่องทดสอบอย่างน้อยหนึ่งครั้ง

### ห้ามทำ
- `prod down -v` — ลบ volume ฐานข้อมูลและใบรับรองทั้งหมด
- เปิด Adminer/Mailpit/MinIO บน server
- commit `.env.production`

## 9. Security checklist

- [ ] secrets ทุกตัวสร้างใหม่ ไม่ซ้ำ dev, `.env.production` สิทธิ์ `600`
- [ ] Google client secret ที่เคยหลุด (เช่นพิมพ์ในแชท) ถูก rotate แล้ว
- [ ] firewall เปิดแค่ 22/80/443, SSH ใช้ key ไม่ใช้ password
- [ ] `ENABLE_API_DOCS=false` หรือมีการป้องกัน
- [ ] R2 bucket เป็น private, token จำกัดเฉพาะ bucket
- [ ] มี backup อัตโนมัติ + เคยทดสอบ restore
- [ ] มี uptime monitor ยิง `https://api.example.com/readyz`

## 10. ข้อจำกัดที่ต้องรู้

- **API ต้องรัน 1 instance**: realtime hub (แชท/presence) และ rate limit เก็บใน memory — ห้าม `--scale api=2` ถ้าจะขยายต้องเพิ่ม Redis pub/sub (ดู `BE/docs/realtime.md`)
- **Rate limit** `/auth/*` 20 ครั้ง/นาที/IP และ reset เมื่อ API restart (IP จริงมาจาก `X-Forwarded-For` ของ Caddy เท่านั้น — client ปลอม header ไม่ได้)
- **Presigned URL อายุ 5 นาที**: รูปจากร้านที่เปลี่ยนเป็นส่วนตัวยังเปิดด้วย URL เก่าได้จนหมดอายุ
- ใช้ **managed MySQL** แทนได้: ลบ service `mysql` ใน `docker-compose.prod.yml`, ตั้ง `DB_HOST` และให้ network `data` ออกอินเทอร์เน็ตได้ (เอา `internal: true` ออก)

## 11. ซ้อม deploy ในเครื่อง (ไม่มีโดเมนจริง)

ใช้โดเมนสมมติ `rs.test` + ใบรับรองจาก CA ภายในของ Caddy:

```sh
cp .env.production.example .env.rehearsal   # แล้วแก้ค่าตามนี้
# WEB_DOMAIN=rs.test  API_DOMAIN=api.rs.test  CADDY_GLOBAL_EXTRA=local_certs
# S3_*  → MinIO ของ dev (S3_ENDPOINT=http://host.docker.internal:9000, S3_PUBLIC_ENDPOINT=http://localhost:9000)
# SMTP_ADDR=host.docker.internal:1025  SMTP_TLS=none  (Mailpit ของ dev)
echo "127.0.0.1 rs.test api.rs.test" | sudo tee -a /etc/hosts
docker compose -f docker-compose.prod.yml --env-file .env.rehearsal up -d --build
# เปิด https://rs.test (กดยอมรับใบรับรอง self-signed)
docker compose -f docker-compose.prod.yml --env-file .env.rehearsal down -v   # ลบทิ้งหลังซ้อม
```

stack นี้ผ่านการซ้อมแล้ว: HTTPS/HSTS, redirect 80→443, cookie `Secure`, CORS, trusted proxy + rate limit, อีเมล reset, e2e ทั้ง 18 ขั้นและแชท 2 ผู้ใช้ผ่าน `wss://`
