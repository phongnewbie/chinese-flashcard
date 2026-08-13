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
| `AUTH_URL` | `https://TEN-APP.onrender.com` |
| `AUTH_GOOGLE_ID` | từ Google Console |
| `AUTH_GOOGLE_SECRET` | từ Google Console |
| `ADMIN_EMAILS` | email Google của bạn |
| `AUTH_SECRET` | Render tự generate (hoặc dán chuỗi random) |

**Start Command** (Render Dashboard):

```bash
bash scripts/render-start.sh
```

Script tự dùng `/var/data` nếu có disk; không có disk thì fallback `./data` (free tier — data có thể mất khi redeploy).

### Disk (khuyến nghị cho khách xài)

Vào service → **Disks** → **Add Disk**:
- **Mount Path:** `/var/data` (phải khớp `DATA_DIR`)
- **Size:** 1 GB

Không thêm disk → app vẫn **chạy được** nhưng database/upload lưu tạm, mất khi redeploy.

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
