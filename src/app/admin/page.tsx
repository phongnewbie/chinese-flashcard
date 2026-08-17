import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { AdminShell } from "./admin-shell";
import { isAdminEmail } from "@/lib/admin";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    redirect("/");
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-[1200px] px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-stone-900">Quản trị ÔN HSK</h1>
        <AdminShell />
      </main>
    </>
  );
}
