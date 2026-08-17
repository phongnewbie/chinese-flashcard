import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/db";

/** Cấp HSK học viên được admin gán (theo dõi trên bảng quản trị) */
export async function getStudentHskLevels(userId: string): Promise<string[]> {
  const rows = await prisma.userHskLevel.findMany({
    where: { userId },
    select: { hskLevel: true },
  });
  return rows.map((r) => r.hskLevel);
}

/** Mọi tài khoản đều thấy toàn bộ bài HSK trên bảng học */
export async function listCoursesForUser(_userId: string, _email: string | null | undefined) {
  return prisma.course.findMany({
    where: { published: true, hskLevel: { not: null } },
    orderBy: [{ hskLevel: "asc" }, { primarySection: "asc" }, { lessonNumber: "asc" }, { sortOrder: "asc" }],
    include: { _count: { select: { cards: true } } },
  });
}

/** Cho phép mở trang học nếu bài tồn tại; quyền học thực tế kiểm tra qua getAccessStatus */
export async function canAccessCourse(
  _userId: string,
  email: string | null | undefined,
  courseId: string,
): Promise<boolean> {
  if (email && isAdminEmail(email)) return true;

  const course = await prisma.course.findFirst({
    where: { id: courseId, published: true, hskLevel: { not: null } },
    select: { id: true },
  });
  return !!course;
}
