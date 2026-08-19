import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { DeviceGate } from "@/components/device-gate";
import { prisma } from "@/lib/db";
import { StudyClient } from "./study-client";
import { isAdminEmail } from "@/lib/admin";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type PageProps = { params: Promise<{ courseId: string }> };

export default async function StudyPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/");

  const { courseId } = await params;
  const isAdmin = session.user.email ? isAdminEmail(session.user.email) : false;

  const course = await prisma.course.findFirst({
    where: { id: courseId, published: true },
    select: { id: true, title: true, primarySection: true, hskLevel: true },
  });
  if (!course) notFound();

  return (
    <>
      <AppHeader />
      <DeviceGate>
        <main className="mx-auto max-w-3xl px-4 py-8">
          {isAdmin && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Đây là trang <strong>học viên</strong> (<code>/hoc/...</code>). Muốn Browse Anki →{" "}
              <Link href={`/admin/khoa/${courseId}`} className="font-semibold underline">
                Quản trị khóa này
              </Link>
            </div>
          )}
          <StudyClient
            courseId={courseId}
            title={course.title}
            primarySection={course.primarySection}
            hskLevel={course.hskLevel}
          />
        </main>
      </DeviceGate>
    </>
  );
}
