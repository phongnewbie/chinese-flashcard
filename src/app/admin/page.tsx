import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { isAdminEmail } from "@/lib/admin";
import { redirect } from "next/navigation";
import { AdminPanel } from "./admin-panel";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    redirect("/");
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-bold text-stone-900 mb-6">Quản trị nội dung</h1>
        <AdminPanel />
      </main>
    </>
  );
}
