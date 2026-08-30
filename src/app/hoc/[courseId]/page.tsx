import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { DeviceGate } from "@/components/device-gate";
import { prisma } from "@/lib/db";
import { canAccessCourse } from "@/lib/hsk-enrollment";
import { StudyClient } from "./study-client";
import { isAdminEmail } from "@/lib/admin";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type PageProps = { params: Promise<{ courseId: string }> };

export default async function StudyPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/");

  const { courseId } = await params;
  const rawAdmin = session.user.email ? isAdminEmail(session.user.email) : false;

  const course = await prisma.course.findFirst({
    where: rawAdmin ? { id: courseId } : { id: courseId, published: true },
    select: { id: true, title: true, primarySection: true, hskLevel: true },
  });
  if (!course) notFound();

  const courseAllowed =
    rawAdmin ||
    (await canAccessCourse(session.user.id, session.user.email, courseId));

  return (
    <>
      <AppHeader />
      <DeviceGate>
        <main className="mx-auto max-w-5xl px-4 py-8">
          {rawAdmin && (
            <p className="mb-4 text-right">
              <Link
                href={`/admin/khoa/${courseId}`}
                className="text-sm text-stone-500 hover:text-stone-800 underline"
              >
                ⚙ Quản trị / import bộ thẻ này
              </Link>
            </p>
          )}
          {!courseAllowed ? (
            <div className="mx-auto max-w-lg rounded-2xl border border-stone-200 bg-white p-8 shadow-sm text-center">
              <div className="text-4xl mb-4">🔒</div>
              <h2 className="text-xl font-semibold text-stone-900 mb-3">Cấp HSK chưa được mở</h2>
              <p className="text-stone-600 mb-6 leading-relaxed">
                Bộ thẻ này thuộc cấp HSK bạn chưa được admin gán. Liên hệ giáo viên để được thêm vào đúng cấp.
              </p>
              <Link
                href="/hoc"
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-6 py-3 text-white font-medium hover:bg-emerald-700 transition"
              >
                ← Về danh sách bộ thẻ
              </Link>
            </div>
          ) : (
            <StudyClient
              courseId={courseId}
              title={course.title}
              primarySection={course.primarySection}
              hskLevel={course.hskLevel}
            />
          )}
        </main>
      </DeviceGate>
    </>
  );
}
