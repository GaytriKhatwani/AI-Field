"use client";

import { FieldProvider } from "@/lib/store";

export function Providers({ children }: { children: React.ReactNode }) {
  return <FieldProvider>{children}</FieldProvider>;
}
