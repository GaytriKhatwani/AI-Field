"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useField } from "@/lib/store";

export default function Entry() {
  const { hydrated, onboarded } = useField();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    router.replace(onboarded ? "/field" : "/onboarding");
  }, [hydrated, onboarded, router]);

  return (
    <main className="grid min-h-screen place-items-center">
      <div
        className="meta animate-breathe"
        style={{ color: "var(--ink-3)", letterSpacing: "0.2em" }}
      >
        AI&nbsp;Field
      </div>
    </main>
  );
}
