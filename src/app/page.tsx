import { auth } from "@/auth";
import { LoginScreen } from "@/components/login/login-screen";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/hoc");

  return <LoginScreen />;
}
