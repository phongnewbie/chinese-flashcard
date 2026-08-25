import Link from "next/link";
import { auth, signOut } from "@/auth";
import { AdminNavLinks } from "@/components/admin-nav-links";

export async function AppHeader() {
  const session = await auth();

  return (
    <header className="border-b border-stone-200 bg-white/80 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-semibold text-stone-900 tracking-tight">
          ÔN HSK
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {session ? (
            <>
              <Link href="/hoc" className="text-stone-600 hover:text-stone-900">
                Bộ thẻ
              </Link>
              <AdminNavLinks />
              <span className="hidden sm:inline text-stone-400 truncate max-w-[140px]">
                {session.user?.email}
              </span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button type="submit" className="text-stone-500 hover:text-stone-800">
                  Thoát
                </button>
              </form>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
