"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";
import { initialLogActionState, type LogActionState } from "@/app/admin/(protected)/logs/action-state";
import { AlertBanner } from "@/components/admin/admin-primitives";
import { PendingSubmitButton } from "@/components/admin/pending-submit-button";

type LogActionFormProps = {
  action: (state: LogActionState, formData: FormData) => Promise<LogActionState>;
  logId: string;
  label: string;
  pendingLabel: string;
  incidentStatus?: "open" | "resolved";
  variant?: "default" | "outline";
  children?: ReactNode;
};

export function LogActionForm({ action, logId, incidentStatus, label, pendingLabel, variant = "outline", children }: Readonly<LogActionFormProps>) {
  const [state, formAction] = useActionState(action, initialLogActionState);

  return (
    <form action={formAction} className="inline-flex flex-col gap-2">
      <input name="logId" type="hidden" value={logId} />
      {incidentStatus ? <input name="incidentStatus" type="hidden" value={incidentStatus} /> : null}
      {state.message ? <AlertBanner description={state.message} tone={state.ok ? "success" : "warning"} /> : null}
      <div className="inline-flex gap-2">
        {children}
        <PendingSubmitButton idleLabel={label} pendingLabel={pendingLabel} size="sm" type="submit" variant={variant} />
      </div>
    </form>
  );
}
