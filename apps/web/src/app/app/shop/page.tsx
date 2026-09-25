import type { Metadata } from "next";
import { ShopScreen } from "@/components/screens/shop";

export const metadata: Metadata = { title: "Plecak" };
export default function ShopPage() {
  return <ShopScreen />;
}
