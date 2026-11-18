# Image storage — S3-compatible local development

ไฟล์จริงอยู่ใน MinIO named volume ฐานข้อมูลเก็บ `media_objects.bucket`, `object_key`, MIME, bytes และ dimensions รูป profile/menu/gallery อ้าง `media_id` ไม่เก็บ Base64 หรือ URL ที่หมดอายุใน MySQL

```text
Go API → S3 SDK → MinIO (Docker) → persistent minio_data
           └──→ MySQL media_objects + entity attachment
```

## Configuration สำหรับ Go API

- ใช้ S3-compatible `StorageProvider` ที่มี Put/Get presign/Delete โดยตั้ง endpoint, region, credentials และ force-path-style จาก `.env`
- API บน host ใช้ `http://localhost:9000`; API ใน Compose ใช้ `http://minio:9000`
- URL สำหรับ browser ต้อง sign ด้วย `S3_PUBLIC_ENDPOINT=http://localhost:9000` ตั้งแต่แรก การแทน hostname หลัง sign ทำให้ signature ไม่ตรง
- ทุก object อยู่ private bucket แม้เป็นร้าน PUBLIC ให้ API ตรวจการมองเห็นร้านแล้วออก presigned GET อายุสั้น เช่น 300 วินาที URL ที่ออกไปก่อนเปลี่ยนร้านเป็น PRIVATE ยังใช้ได้จนหมดอายุ หากต้อง revoke ทันทีต้อง proxy ผ่าน API
- Application key มีสิทธิ์เฉพาะ bucket นี้ ไม่ใช้ MinIO root credentials ใน API
- Console เข้าได้ที่ `http://localhost:9001` และใช้ admin credentials ดู bucket/objects ได้

## Upload lifecycle

1. รับ multipart จากผู้ใช้ที่ login แล้ว ตรวจ file signature, allowlist JPEG/PNG/WebP, จำกัด bytes/dimensions และ re-encode/strip metadata ฝั่ง server
2. สร้าง UUID และ key เช่น `users/{owner_uuid}/{media_uuid}.jpg` สร้างแถว `PENDING` พร้อม metadata ของไฟล์ที่ re-encode แล้ว
3. PutObject ผ่าน SDK เมื่อสำเร็จเปลี่ยนเป็น `READY` การ attach ใช้ transaction ตรวจเจ้าของและสถานะ READY
4. แนบ `media_id` ใน restaurant_images, restaurant_menus หรือ user_profile_images การเปลี่ยนรูปห้ามลบ object ที่ยังมี reference อื่น
5. Cleanup worker ล็อก media row ตรวจทุก attachment table แล้ว mark `DELETING` ก่อนลบ S3 object และแถว DB ให้ attach path ล็อก media row เดียวกัน ป้องกัน cleanup แข่งกับ attach
6. เก็บ PENDING/READY ที่ยังไม่ถูกใช้งานไว้ช่วง grace period (เช่น 24 ชั่วโมง) และ retry DELETING หาก S3 ล้มเหลว DB กับ S3 ไม่มี distributed transaction

Go API implement upload endpoint, presigner และ cleanup worker แล้ว โดยรับรูปไม่เกิน 8 MiB/20 megapixels และแปลงเป็น JPEG การอัปโหลดตรงจาก browser ไป S3 ยังไม่ได้ตั้ง CORS เพราะ flow ส่ง multipart ผ่าน Go API

`BE/tests/storage-smoke.sh` ตรวจ object storage put/get/delete ด้วย application key โดยใช้ไฟล์ข้อความเล็กเพื่อทดสอบ protocol ไม่ได้ทดสอบ image validation ของ API
