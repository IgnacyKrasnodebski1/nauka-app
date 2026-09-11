import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NAUKA — z notatek do quizów w minutę", template: "%s · NAUKA" },
  description: "Wrzucasz screeny, notatki, PDF — AI robi z tego poziomy jak w Duolingo: feed, fiszki, mini-gry, quizy i egzamin próbny.",
  applicationName: "NAUKA",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/icons/icon-192.png" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "NAUKA" },
  openGraph: { title: "NAUKA", description: "Z notatek do quizów, fiszek i mini-gier w minutę.", type: "website", locale: "pl_PL", siteName: "NAUKA" },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
};

export const viewport: Viewport = {
  themeColor: "#0a0a12",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
