import type { Metadata } from "next";
import { AppProvider } from "@/lib/store/app-context";
import { AppChrome } from "@/components/app/chrome";

export const metadata: Metadata = { title: "Apka" };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <AppChrome>{children}</AppChrome>
    </AppProvider>
  );
}
