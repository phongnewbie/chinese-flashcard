import { auth, signIn } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/hoc");

  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="text-emerald-700 font-medium text-sm mb-3">Ôn tập tiếng Trung</p>
          <h1 className="text-4xl font-bold text-stone-900 mb-4 tracking-tight">
            Học từ vựng bằng thẻ flashcard
          </h1>
          <p className="text-stone-600 text-lg mb-8 leading-relaxed">
            Đăng nhập Google để học thử toàn bộ nội dung trong thời gian giới hạn. Sau đó liên hệ
            Zalo để mở khóa và tham gia lớp trên Zoom.
          </p>
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/hoc" });
            }}
          >
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-8 py-3.5 text-white font-medium hover:bg-stone-800 transition shadow-sm"
            >
              <GoogleIcon />
              Đăng nhập với Google
            </button>
          </form>
          <ul className="mt-12 text-left grid gap-3 text-sm text-stone-600 max-w-md mx-auto">
            <li>✓ Học thử có thời gian (mặc định 30 phút, giáo viên chỉnh được)</li>
            <li>✓ Tối đa 2 thiết bị / tài khoản Google</li>
            <li>✓ Có âm thanh phát âm trên từng thẻ</li>
          </ul>
        </section>
      </main>
    </>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#fff"
        d="M22 12c0-.68-.06-1.37-.17-2H12v3.78h5.64c-.24 1.28-.97 2.37-2.07 3.1v2.56h3.35c1.95-1.8 3.08-4.44 3.08-7.44z"
      />
      <path
        fill="#fff"
        opacity=".85"
        d="M12 23c2.8 0 5.15-.93 6.87-2.52l-3.35-2.56c-.93.62-2.12.99-3.52.99-2.71 0-5-1.83-5.82-4.3H2.1v2.64C3.79 20.53 7.62 23 12 23z"
      />
    </svg>
  );
}
