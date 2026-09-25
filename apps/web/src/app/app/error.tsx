"use client";
import { ErrorView } from "@/components/screens/error";

/** Route error boundary under /app (ErrorState.html). */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView title="Coś poszło nie tak" reason={"Ekran zatrzymał się: " + (error.message || "nieznany błąd") + ". Postępy są zapisane na koncie."} can={[["refresh", "Odśwież ekran — zwykle to wystarcza"], ["home", "Wróć na Dziś i spróbuj jeszcze raz"]]} actions={[{ label: "ODŚWIEŻ", primary: true, onClick: reset }, { label: "Na Dziś", href: "/app" }]} />;
}
