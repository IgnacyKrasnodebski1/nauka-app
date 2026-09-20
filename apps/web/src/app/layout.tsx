import type { Metadata, Viewport } from "next";
import { COLORS, cssVars } from "@nauka/shared";
import "./globals.css";

const FONTS = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700;800&family=Manrope:wght@400;500;600;700&display=swap";

export const metadata: Metadata = {
  title: { default: "Recall — z notatek do lekcji w minutę", template: "%s · Recall" },
  description: "Wrzucasz notatki albo wpisujesz temat — AI robi z tego lekcje jak w Duolingo: feed, fiszki, mini-gry, quizy i egzamin próbny.",
  applicationName: "Recall",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/icons/icon-192.png" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Recall" },
  openGraph: { title: "Recall", description: "Z notatek do lekcji, fiszek i mini-gier w minutę.", type: "website", locale: "pl_PL", siteName: "Recall" },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
};

export const viewport: Viewport = {
  themeColor: COLORS.bg0,
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONTS} />
        {/* design tokens from @nauka/shared — single source of truth for web + mobile */}
        <style dangerouslySetInnerHTML={{ __html: cssVars() }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
