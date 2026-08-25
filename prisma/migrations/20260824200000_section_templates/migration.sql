-- Mẫu hiển thị chung theo 4 mục: từ vựng, ngữ pháp, sắp xếp câu, giao tiếp
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "sectionTemplates" TEXT;
