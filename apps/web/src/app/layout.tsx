import type { Metadata, Viewport } from "next";
import { FONT_LINK, TOKENS, TOKENS_CSS } from "@nauka/shared";
import { MotionProvider } from "@/lib/motion";
import { SfxProvider } from "@/lib/sfx";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Recall — z notatek do lekcji", template: "%s · Recall" },
  description: "Zdjęcie strony z podręcznika, PDF albo notatki — powstają z tego poziomy, fiszki, zadania i pytania. Uczysz się po 10 minut dziennie.",
  applicationName: "Recall",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/icons/icon-192.png" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Recall" },
  openGraph: { title: "Recall", description: "Z własnych materiałów do lekcji, fiszek i zadań.", type: "website", locale: "pl_PL", siteName: "Recall" },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
};

export const viewport: Viewport = {
  themeColor: TOKENS.bg,
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
        <link rel="stylesheet" href={FONT_LINK} />
        {/* design/tokens.css verbatim from @nauka/shared — the single source of colours, radii, drops and motion */}
        <style dangerouslySetInnerHTML={{ __html: TOKENS_CSS }} />
      </head>
      <body>
        <MotionProvider>
          <SfxProvider>{children}</SfxProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
