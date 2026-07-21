"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

type PendingSubmitButtonProps = ButtonProps & {
  idleLabel: string;
  pendingLabel?: string;
};

export function PendingSubmitButton({ idleLabel, pendingLabel = "Guardando…", disabled, ...props }: Readonly<PendingSubmitButtonProps>) {
  const { pending } = useFormStatus();

  return (
    <Button aria-disabled={pending || disabled} disabled={pending || disabled} {...props}>
      {pending ? pendingLabel : idleLabel}
    </Button>
  );
}
