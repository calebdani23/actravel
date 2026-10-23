"use client";

import { useState } from "react";
import DashboardError from "@/app/admin/(protected)/dashboard/error";

export function DashboardRouteErrorFixture() {
  const [resetCount, setResetCount] = useState(0);
  return <>
    <DashboardError error={new Error("provider-sql-secret")} reset={() => setResetCount((count) => count + 1)} />
    <p data-testid="route-error-reset-count">Reset invocations: {resetCount}</p>
  </>;
}
