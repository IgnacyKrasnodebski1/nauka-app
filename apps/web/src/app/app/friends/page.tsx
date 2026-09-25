import type { Metadata } from "next";
import { FriendsScreen } from "@/components/screens/social";

export const metadata: Metadata = { title: "Znajomi" };
export default function FriendsPage() {
  return <FriendsScreen />;
}
