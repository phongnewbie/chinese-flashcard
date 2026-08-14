import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { DeviceGate } from "@/components/device-gate";
import { TrialBanner } from "@/components/access-ui";
import { isAdminEmail } from "@/lib/admin";
import { listCoursesForUser } from "@/lib/hsk-enrollment";
import { redirect } from "next/navigation";
import { StudentCourseList } from "./course-list";

export default async function HocPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const isAdmin = session.user.email ? isAdminEmail(session.user.email) : false;

  const courses = await listCoursesForUser(session.user.id, session.user.email);

  return (
    <>
      <AppHeader />
      <DeviceGate>
        <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Khóa ôn tập</h1>
            <p className="text-stone-600 text-sm mt-1">
              Chọn bài học theo cấp HSK admin đã gán cho tài khoản của bạn.
            </p>
          </div>
          <TrialBanner />
          <StudentCourseList courses={courses} isAdmin={isAdmin} />
        </main>
      </DeviceGate>
    </>
  );
}
