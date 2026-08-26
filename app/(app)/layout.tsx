import { Providers } from "../providers";

// Layout for the authenticated app surfaces (field, onboarding, briefing,
// workbench, evaluating, debrief). It owns <Providers> → FieldProvider, which
// bootstraps/hydrates the anonymous user. The public landing at "/" sits OUTSIDE
// this group, so it never mounts the provider and never mints an account on
// view. By the time any (app) route mounts, the Start action has already created
// the session, so bootstrap resumes it rather than minting a second one.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
