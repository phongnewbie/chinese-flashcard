import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { redirect } from "next/navigation";
import { CourseAdmin } from "./course-admin";

type PageProps = { params: Promise<{ courseId: string }> };

export default async function AdminCoursePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    redirect("/");
  }

  const { courseId } = await params;

  return (
    <main style={{ margin: 0, padding: 0, minHeight: "100vh" }}>
      <CourseAdmin courseId={courseId} />
    </main>
  );
}
