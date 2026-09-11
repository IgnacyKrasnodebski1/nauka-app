import type { Metadata } from "next";
import { Account } from "@/components/account/account";

export const metadata: Metadata = { title: "Konto" };

export default function AccountPage() {
  return <Account />;
}
