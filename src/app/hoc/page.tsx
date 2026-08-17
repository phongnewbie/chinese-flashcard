import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { DeviceGate } from "@/components/device-gate";
import { isAdminEmail } from "@/lib/admin";
import { listCoursesForUser } from "@/lib/hsk-enrollment";
import { redirect } from "next/navigation";
import { HskStudentBoard } from "./hsk-student-board";

export default async function HocPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const isAdmin = session.user.email ? isAdminEmail(session.user.email) : false;

  const courses = await listCoursesForUser(session.user.id, session.user.email);

  return (
    <>
      <AppHeader />
      <DeviceGate>
        <main className="mx-auto max-w-[1200px] px-4 py-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Khóa ôn tập</h1>
            <p className="text-stone-600 text-sm mt-1">
              Chọn bài theo cấp HSK — học thử miễn phí, hết giờ sẽ khóa và hiện thông báo liên hệ Zalo.
            </p>
          </div>
          <HskStudentBoard courses={courses} isAdmin={isAdmin} />
        </main>
      </DeviceGate>
    </>
  );
}
