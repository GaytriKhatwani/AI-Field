import type { Metadata } from "next";
import { Bricolage_Grotesque, Public_Sans } from "next/font/google";
import { RouteFocus } from "@/components/RouteFocus";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const body = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Field",
  description: "A practice environment for doing real work with AI.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable}`}
      suppressHydrationWarning
    >
      <body>
        {/* Set the theme on <html> BEFORE the styled content paints, so there's
            no flash. The saved choice wins; with nothing saved the app defaults
            to dark (the user can toggle to light). Kept in sync by
            components/ThemeToggle. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('aifield.theme');if(t!=='light'&&t!=='dark'){t='dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`,
          }}
        />
        {/* RouteFocus + the focus target live in the ROOT layout so the public
            landing gets them too. The FieldProvider (which mints the anonymous
            user) lives one level down in app/(app)/layout.tsx, so viewing the
            landing creates no anonymous account — the mint happens on Start. */}
        <RouteFocus />
        {/* focus target for route changes; tabIndex -1 so it takes
            programmatic focus without becoming a tab stop */}
        <div id="main-content" tabIndex={-1} className="outline-none">
          {children}
        </div>
      </body>
    </html>
  );
}
