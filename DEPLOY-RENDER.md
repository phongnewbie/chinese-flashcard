# Deploy lên Render (cho khách dùng)

## Tóm tắt

App cần **Render Web Service (Starter ~$7/tháng)** + **ổ cứng 1GB** để database SQLite và file ảnh/audio **không bị mất** khi redeploy.

## Bước 1 — Google OAuth (production)

1. Vào [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. OAuth client → **Authorized redirect URIs** thêm:
   ```
   https://TEN-APP.onrender.com/api/auth/callback/google
   ```
   (Thay `TEN-APP` sau khi tạo xong service trên Render)
3. Giữ nguyên `AUTH_GOOGLE_ID` và `AUTH_GOOGLE_SECRET`

## Bước 2 — Đẩy code lên GitHub

Repo đã có file `render.yaml`. Nếu chưa có remote:

```bash
git add .
git commit -m "Prepare Render deployment"
git push -u origin master
```

## Bước 3 — Tạo service trên Render

1. Đăng nhập [render.com](https://render.com)
2. **New +** → **Blueprint**
Repo GitHub: **https://github.com/phongnewbie/chinese-flashcard**
4. Render đọc `render.yaml` và tạo web service + disk

## Bước 4 — Biến môi trường (Render Dashboard)

Vào service → **Environment** → điền:

| Biến | Giá trị |
|------|---------|
| `DATABASE_URL` | Neon PostgreSQL pooled connection (thêm `?sslmode=require&connect_timeout=30`) |
| `DIRECT_URL` | Neon PostgreSQL direct connection (không có `-pooler`, dùng cho migrations) *(tùy chọn)* |
| `AUTH_URL` | `https://TEN-APP.onrender.com` |
| `AUTH_GOOGLE_ID` | từ Google Console |
| `AUTH_GOOGLE_SECRET` | từ Google Console |
| `ADMIN_EMAILS` | email Google của bạn |
| `AUTH_SECRET` | Render tự generate (hoặc dán chuỗi random) |

> **Lưu ý quan trọng cho Neon PostgreSQL:**
> - `DATABASE_URL`: Sử dụng connection string có `-pooler` từ Neon và **phải có** tham số `connect_timeout=30` để tránh lỗi `P1001: Can't reach database server` khi Neon thức dậy từ chế độ ngủ (scale-to-zero cold start).
>   Ví dụ: `postgresql://user:pass@ep-xxx-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&connect_timeout=30`
> - `DIRECT_URL` (khuyến nghị): Bỏ chọn "Pooled connection" trên Neon Dashboard để lấy direct connection string (không có `-pooler`). Script migration sẽ ưu tiên dùng URL này để chạy migration mượt mà không bị PgBouncer ngắt kết nối.

**Start Command** (Render Dashboard):

```bash
bash scripts/render-start.sh
```

Script tự động retry `prisma migrate deploy` tối đa 3 lần nếu Neon database đang thức dậy từ cold-start. Nếu có disk `/var/data` sẽ dùng persistent disk; nếu chạy Free tier không có disk thì fallback `./data`.

### Disk (khuyến nghị khi có file upload)

Vào service → **Disks** → **Add Disk**:
- **Mount Path:** `/var/data` (phải khớp `DATA_DIR`)
- **Size:** 1 GB

Nếu dùng Free tier không có disk, database đã nằm an toàn trên Neon Cloud PostgreSQL, chỉ có các file upload ảnh/audio tự tải lên sẽ nằm tạm ở `./data` (mất khi redeploy service).

## Bước 5 — Kiểm tra

- Mở `https://TEN-APP.onrender.com/api/health` → `{"ok":true}`
- Đăng nhập Google bằng email trong `ADMIN_EMAILS`
- Vào **Quản trị** → tạo khóa học, import thẻ

## Lưu ý

- **Free tier Render** không có persistent disk → dữ liệu mất khi redeploy. Dùng **Starter + disk** như `render.yaml`.
- Lần deploy đầu chạy `prisma migrate deploy` **khi khởi động** (trên ổ cứng persistent), không phải lúc build.
- Upload ảnh/audio lưu tại `/var/data/uploads` (persistent).
- Nếu đổi domain: cập nhật `AUTH_URL` + redirect URI Google.

## Local vẫn chạy bình thường

```bash
cp .env.example .env
npm install
npx prisma migrate dev
npm run dev
```
