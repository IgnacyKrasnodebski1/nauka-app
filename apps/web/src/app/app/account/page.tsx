import { redirect } from "next/navigation";

/** 1.x „Konto” → 2.0 Ustawienia. */
export default function AccountPage() {
  redirect("/app/settings");
}
