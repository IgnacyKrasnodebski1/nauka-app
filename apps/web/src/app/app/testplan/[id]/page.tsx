import type { Metadata } from "next";
import { Suspense } from "react";
import { TestPlanScreen } from "@/components/screens/testplan";

export const metadata: Metadata = { title: "Plan do sprawdzianu" };
type Params = { params: Promise<{ id: string }> };

export default async function TestPlanPage({ params }: Params) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <TestPlanScreen id={id} />
    </Suspense>
  );
}
