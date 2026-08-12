"use client";

import { useDeviceRegistration } from "@/lib/device-client";
import { DeviceBlocked } from "@/components/access-ui";

export function DeviceGate({ children }: { children: React.ReactNode }) {
  const status = useDeviceRegistration(true);

  if (status === "blocked") {
    return (
      <div className="py-12">
        <DeviceBlocked />
      </div>
    );
  }

  return <>{children}</>;
}
