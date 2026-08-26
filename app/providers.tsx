"use client";

import { useEffect } from "react";
import { FieldProvider } from "@/lib/store";
import { initAnalytics } from "@/lib/analytics/client";

export function Providers({ children }: { children: React.ReactNode }) {
  // Boot the analytics SDK once on the client. Safe no-op when unconfigured.
  useEffect(() => {
    initAnalytics();
  }, []);

  return <FieldProvider>{children}</FieldProvider>;
}
