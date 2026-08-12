# 中文 Flashcard — Ôn tập tiếng Trung

Web ôn tập flashcard cho học viên: đăng nhập Google, học thử theo thời gian (mặc định 30 phút), giới hạn 2 thiết bị, quản trị nội dung và import Excel/Notepad kèm âm thanh.

## Cài đặt nhanh

1. Cài dependency (đã có sẵn nếu clone repo):

```bash
npm install
```

2. Sao chép `.env.example` thành `.env` và điền:

- `AUTH_SECRET` — chuỗi ngẫu nhiên dài (openssl rand -base64 32)
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — tạo tại [Google Cloud Console](https://console.cloud.google.com/) → OAuth 2.0, redirect URI: `http://localhost:3000/api/auth/callback/google`
- `ADMIN_EMAILS` — email Google của bạn (giáo viên), có thể nhiều email cách nhau bằng dấu phẩy
- `AUTH_URL` — URL site (local: `http://localhost:3000`)

3. Tạo database:

```bash
npx prisma migrate dev --name init
```

4. Chạy dev:

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

## Quy trình giáo viên

1. Đăng nhập Google bằng email trong `ADMIN_EMAILS` → menu **Quản trị**.
2. **Cài đặt học thử & Zalo**: chỉnh số phút học thử, link Zalo, nội dung thông báo khi hết giờ.
3. **Thêm khóa học** → **Quản lý thẻ & import**.
4. **Âm thanh**: upload file MP3/WAV trước; trong file Excel hoặc Notepad, cột/dòng cuối ghi **tên file** (ví dụ `hello.mp3`) hoặc URL đầy đủ.
5. **Import Excel**: cột `front`, `back`, tùy chọn `pinyin`, `audio`.
6. **Import Notepad (.txt)**: mỗi dòng `汉字|nghĩa|pinyin|ten_file.mp3` (tab hoặc `|`).
7. **Học viên**: bật **Full** sau khi tư vấn Zoom / thu phí; **Reset học thử** nếu cần cho họ thử lại; **Gỡ** thiết bị nếu vượt 2 máy.

## Ghi chú

- Học viên **không** thêm/sửa nội dung trừ khi bạn bật **Sửa nội dung** (dành cho trợ giảng nếu cần).
- File âm thanh lưu tại `public/uploads/audio/` (nên backup khi deploy).
- Deploy production: dùng hosting hỗ trợ Node (Vercel, VPS…), đặt `AUTH_URL` đúng domain, thêm redirect URI Google tương ứng.
