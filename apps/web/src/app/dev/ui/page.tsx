import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Gallery } from "@/components/dev/gallery";

export const metadata: Metadata = { title: "UI gallery", robots: { index: false } };
export const dynamic = "force-static";

/** Component gallery for visual QA (Playwright shoots it without auth). Not rendered on production builds unless NEXT_PUBLIC_DEV_UI=1. */
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_DEV_UI !== "1") notFound();
  return <Gallery />;
}
