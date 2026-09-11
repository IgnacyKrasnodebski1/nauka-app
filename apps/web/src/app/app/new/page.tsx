import type { Metadata } from "next";
import { NewSubject } from "@/components/upload/new-subject";

export const metadata: Metadata = { title: "Dodaj materiały" };

export default function NewPage() {
  return <NewSubject />;
}
