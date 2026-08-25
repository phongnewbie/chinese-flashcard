import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { AnkiMainDecks } from "@/components/anki-main-decks";
import { DeviceGate } from "@/components/device-gate";
import { StudentPreviewSection } from "@/components/student-preview-section";
import { redirect } from "next/navigation";

export default async function HocPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  return (
    <>
      <AppHeader />
      <DeviceGate>
        <StudentPreviewSection />
        <main className="anki-home-main">
          <AnkiMainDecks />
        </main>
      </DeviceGate>
    </>
  );
}
