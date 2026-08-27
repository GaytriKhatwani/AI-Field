"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// SPA navigations don't move focus or tell a screen reader the page changed —
// focus is left on the now-unmounted trigger. On each client route change this
// moves focus to the top of the page content and announces the new surface in a
// polite live region, so keyboard and screen-reader users are oriented. The very
// first load is skipped so it never steals focus from the landing content.
function routeName(path: string): string {
  if (path.startsWith("/onboarding")) return "Setting up your practice";
  if (path.startsWith("/field")) return "The Field";
  if (path.startsWith("/briefing")) return "Scenario brief";
  if (path.startsWith("/workbench")) return "Workbench";
  if (path.startsWith("/evaluating")) return "Preparing your practice review";
  if (path.startsWith("/debrief")) return "Practice review";
  if (path.startsWith("/auth/callback")) return "Signing you in";
  if (path === "/") return "Welcome to AI Field";
  return "AI Field";
}

export function RouteFocus() {
  const pathname = usePathname();
  const first = useRef(true);
  const liveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    document.getElementById("main-content")?.focus();
    if (liveRef.current) liveRef.current.textContent = routeName(pathname);
  }, [pathname]);

  return <div ref={liveRef} role="status" aria-live="polite" className="sr-only" />;
}
