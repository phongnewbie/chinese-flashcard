import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/db";

/** Cấp HSK học viên được admin gán */
export async function getStudentHskLevels(userId: string): Promise<string[]> {
  const rows = await prisma.userHskLevel.findMany({
    where: { userId },
    select: { hskLevel: true },
  });
  return rows.map((r) => r.hskLevel);
}

export async function listCoursesForUser(userId: string, email: string | null | undefined) {
  const isAdmin = email ? isAdminEmail(email) : false;

  if (isAdmin) {
    return prisma.course.findMany({
      where: { published: true },
      orderBy: [{ hskLevel: "asc" }, { lessonNumber: "asc" }, { sortOrder: "asc" }],
      include: { _count: { select: { cards: true } } },
    });
  }

  const levels = await getStudentHskLevels(userId);
  if (levels.length === 0) {
    return [];
  }

  return prisma.course.findMany({
    where: {
      published: true,
      hskLevel: { in: levels },
    },
    orderBy: [{ hskLevel: "asc" }, { lessonNumber: "asc" }, { sortOrder: "asc" }],
    include: { _count: { select: { cards: true } } },
  });
}

/** Học viên chỉ học bài thuộc cấp HSK admin đã gán; admin xem được mọi bài. */
export async function canAccessCourse(
  userId: string,
  email: string | null | undefined,
  courseId: string,
): Promise<boolean> {
  if (email && isAdminEmail(email)) return true;

  const course = await prisma.course.findFirst({
    where: { id: courseId, published: true },
    select: { hskLevel: true },
  });
  if (!course?.hskLevel) return false;

  const levels = await getStudentHskLevels(userId);
  return levels.includes(course.hskLevel);
}
