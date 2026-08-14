import { LoginCard } from "./login-card";
import { LoginHero } from "./login-hero";
import { isFacebookAuthEnabled } from "@/auth";

export function LoginScreen() {
  const facebookEnabled = isFacebookAuthEnabled();

  return (
    <div className="login-page min-h-screen flex flex-col lg:flex-row">
      <LoginHero />
      <div className="login-page__right flex flex-1 items-center justify-center p-6 sm:p-10 lg:p-12">
        <LoginCard facebookEnabled={facebookEnabled} />
      </div>
    </div>
  );
}
