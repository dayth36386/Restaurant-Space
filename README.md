# Restaurant Space

แยก Backend และ Frontend ออกจากกัน โดย Backend ใช้ Clean Architecture และรักษา HTTP contract เดิม

```text
Restaurant-Space/
├── BE/                     Go backend
│   ├── cmd/server/         Entry point
│   ├── internal/
│   │   ├── domain/         Entities และ domain errors
│   │   ├── port/           Repository / external service interfaces
│   │   ├── usecase/        Business logic และ transaction boundaries
│   │   ├── adapter/        HTTP, MySQL, S3, JWT, SMTP, Google, image processing
│   │   ├── config/         Environment configuration
│   │   └── bootstrap/      Dependency injection และ lifecycle
│   ├── migrations/         Versioned SQL
│   ├── docs/               OpenAPI, architecture, database, storage
│   ├── scripts/            Generate/check API contract
│   └── tests/              Architecture checks และ integration tests
├── FE/                     Next.js frontend
├── infra/minio/            Local S3 infrastructure
├── docker-compose.yml      รันระบบจาก root
└── restaurant-platform-spec.md
```

รันจาก root:

```sh
# ครั้งแรกเท่านั้น ถ้ามี .env อยู่แล้วไม่ต้องคัดลอกทับ
cp .env.example .env
docker compose up --build -d
```

ถ้ามี stack เดิมทำงานอยู่ หลังย้ายโฟลเดอร์สามารถ rebuild เฉพาะ API:

```sh
docker compose up --build -d api
```

- Web: http://localhost:3000
- Scalar: http://localhost:8080/docs
- Readiness: http://localhost:8080/readyz
- Database UI (Adminer): http://localhost:8081 — System: MySQL, Server: `mysql`, user `restaurant`, password `restaurant_dev_password`, database `restaurant_space`
- Mailpit: http://localhost:8025
- MinIO: http://localhost:9001

ชื่อ services, volumes, ports และ schema เดิมยังใช้ต่อได้ ไม่ต้องล้างฐานข้อมูลหรือรัน `down -v`

[คู่มือ Backend](BE/README.md) · [Clean Architecture](BE/docs/architecture.md) · [Frontend layout](FE/README.md) · **[Deploy production](DEPLOY.md)**

Code style: FE ใช้ Prettier + ESLint (`cd FE && npm run check`), BE ใช้ gofmt/goimports + golangci-lint (`cd BE && make check`); ตั้ง format-on-save ไว้ใน `.vscode/`

ตรวจสอบ:

```sh
python3 BE/scripts/check_contract.py
cd BE
go test ./internal/domain ./internal/port ./internal/usecase ./tests/architecture
# Full tests ต้องดาวน์โหลด dependencies ได้
go mod tidy
go test ./...
```

หลัง refactor: use-case tests, architecture tests, Compose config และ static OpenAPI route check ผ่านแล้ว ส่วน adapter/integration tests ยังไม่ได้รันครบ เพราะ sandbox ดาวน์โหลด dependencies และเข้าถึง Docker socket ไม่ได้
