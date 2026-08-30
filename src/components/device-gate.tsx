"use client";

import { useDeviceRegistration } from "@/lib/device-client";
import { DeviceBlocked, useAccess } from "@/components/access-ui";

export function DeviceGate({ children }: { children: React.ReactNode }) {
  const { access, loading: accessLoading } = useAccess();
  const status = useDeviceRegistration(!accessLoading && !access?.isAdmin);

  if (!accessLoading && access?.isAdmin) {
    return <>{children}</>;
  }

  if (status === "blocked") {
    return (
      <div className="py-12">
        <DeviceBlocked />
      </div>
    );
  }

  return <>{children}</>;
}
