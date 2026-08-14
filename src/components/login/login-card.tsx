"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoginSocialButtons } from "./login-social-buttons";

type Mode = "login" | "register";

const REMEMBER_KEY = "onhsk_remember_email";

export function LoginCard({ facebookEnabled }: { facebookEnabled: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) {
      setEmail(saved);
      setRemember(true);
    }
  }, []);

  const onEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    if (mode === "register") {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg(data.error ?? "Không đăng ký được");
        setLoading(false);
        return;
      }
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setMsg(mode === "register" ? "Đăng ký xong nhưng đăng nhập thất bại." : "Email hoặc mật khẩu không đúng.");
      return;
    }

    if (remember) localStorage.setItem(REMEMBER_KEY, email);
    else localStorage.removeItem(REMEMBER_KEY);

    router.push("/hoc");
    router.refresh();
  };

  return (
    <div className="login-card w-full max-w-[420px] bg-white rounded-2xl shadow-xl shadow-blue-900/10 px-8 py-10 sm:px-10 sm:py-12">
      <h2 className="text-2xl font-bold text-stone-800 text-center mb-8">
        {mode === "login" ? "Đăng nhập" : "Đăng ký"}
      </h2>

      <form onSubmit={onEmailLogin} className="space-y-5">
        {mode === "register" && (
          <div>
            <label htmlFor="login-name" className="login-label">
              Họ tên
            </label>
            <div className="login-input-wrap">
              <input
                id="login-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tên của bạn (tuỳ chọn)"
                className="login-input pl-4"
                autoComplete="name"
              />
            </div>
          </div>
        )}

        <div>
          <label htmlFor="login-email" className="login-label">
            Email
          </label>
          <div className="login-input-wrap">
            <MailIcon />
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Nhập email của bạn"
              className="login-input"
              autoComplete="email"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="login-password" className="login-label">
            Mật khẩu
          </label>
          <div className="login-input-wrap">
            <LockIcon />
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "register" ? "Tối thiểu 6 ký tự" : "Nhập mật khẩu tại đây"}
              className="login-input pr-11"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              required
              minLength={mode === "register" ? 6 : undefined}
            />
            <button
              type="button"
              className="login-input-eye"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        {mode === "login" && (
          <div className="flex items-center justify-between text-sm gap-3">
            <label className="flex items-center gap-2 text-stone-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="login-checkbox"
              />
              Ghi nhớ mật khẩu
            </label>
            <button
              type="button"
              className="login-link"
              onClick={() => setMsg("Liên hệ giáo viên qua Zalo để được hỗ trợ đặt lại mật khẩu.")}
            >
              Quên mật khẩu
            </button>
          </div>
        )}

        {msg && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            {msg}
          </p>
        )}

        <button type="submit" disabled={loading} className="login-btn-primary w-full disabled:opacity-60">
          {loading ? "Đang xử lý…" : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
        </button>
      </form>

      <div className="login-divider my-7">
        <span>Hoặc đăng nhập với</span>
      </div>

      <LoginSocialButtons facebookEnabled={facebookEnabled} />

      <p className="mt-8 text-center text-sm text-stone-500">
        {mode === "login" ? "Bạn chưa có tài khoản?" : "Đã có tài khoản?"}{" "}
        <button
          type="button"
          className="login-link font-semibold"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setMsg("");
          }}
        >
          {mode === "login" ? "Đăng ký" : "Đăng nhập"}
        </button>
      </p>
    </div>
  );
}

function MailIcon() {
  return (
    <svg className="login-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="login-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 118 0v3" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-10-8-10-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 10 8 10 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  );
}
