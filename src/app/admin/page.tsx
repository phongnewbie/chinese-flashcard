import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { HskAdminBoard } from "./hsk-admin-board";
import { AdminPanel as AdminPanelLegacy } from "./admin-panel";
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
      <main className="mx-auto max-w-[1200px] px-4 py-8 space-y-10">
        <h1 className="text-2xl font-bold text-stone-900">Quản trị ÔN HSK</h1>
        <HskAdminBoard />
        <details className="rounded-xl border border-stone-200 bg-stone-50 p-4">
          <summary className="cursor-pointer text-sm font-medium text-stone-600">
            Cài đặt &amp; học viên (nâng cao)
          </summary>
          <div className="mt-4">
            <AdminPanelLegacy />
          </div>
        </details>
      </main>
    </>
  );
}
