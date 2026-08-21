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

/** Học viên chưa được admin gán cấp HSK nào → thấy/học được tất cả (tương thích cũ). */
export async function hasHskEnrollment(userId: string): Promise<boolean> {
  const count = await prisma.userHskLevel.count({ where: { userId } });
  return count > 0;
}

/** Cấp HSK học viên được phép mở (admin: tất cả; chưa gán: tất cả; đã gán: chỉ cấp trong danh sách). */
export async function canAccessHskLevel(
  userId: string,
  email: string | null | undefined,
  hskLevel: string | null | undefined,
): Promise<boolean> {
  if (!hskLevel) return true;
  if (email && isAdminEmail(email)) return true;

  const enrolled = await getStudentHskLevels(userId);
  if (enrolled.length === 0) return true;
  return enrolled.includes(hskLevel);
}

export async function listCoursesForUser(userId: string, email: string | null | undefined) {
  const courses = await prisma.course.findMany({
    where: { published: true, hskLevel: { not: null } },
    orderBy: [{ hskLevel: "asc" }, { primarySection: "asc" }, { lessonNumber: "asc" }, { sortOrder: "asc" }],
    include: { _count: { select: { cards: true } } },
  });

  if (email && isAdminEmail(email)) return courses;

  const enrolled = await getStudentHskLevels(userId);
  if (enrolled.length === 0) return courses;

  return courses.filter((c) => c.hskLevel && enrolled.includes(c.hskLevel));
}

/** Cho phép mở trang học nếu bài tồn tại và thuộc cấp HSK được gán */
export async function canAccessCourse(
  userId: string,
  email: string | null | undefined,
  courseId: string,
): Promise<boolean> {
  if (email && isAdminEmail(email)) return true;

  const course = await prisma.course.findFirst({
    where: { id: courseId, published: true, hskLevel: { not: null } },
    select: { id: true, hskLevel: true },
  });
  if (!course) return false;

  return canAccessHskLevel(userId, email, course.hskLevel);
}
