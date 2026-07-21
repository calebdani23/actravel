"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { getPendingSafeCancelState } from "@/lib/admin/pending-safe-navigation";

type CatalogSubmitBarProps = {
  isEditing: boolean;
  isPublished: boolean;
  isArchived: boolean;
  cancelHref: string;
  previewLinks?: Array<{ label: string; href: string }>;
  publishAction: (formData: FormData) => void | Promise<void>;
  draftAction: (formData: FormData) => void | Promise<void>;
  archiveAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
};

function PendingLabel({ idleLabel, pendingLabel }: Readonly<{ idleLabel: string; pendingLabel: string }>) {
  const { pending } = useFormStatus();
  return pending ? pendingLabel : idleLabel;
}

export function CatalogSubmitBar({
  isEditing,
  isPublished,
  isArchived,
  cancelHref,
  previewLinks,
  publishAction,
  draftAction,
  archiveAction,
  deleteAction,
}: Readonly<CatalogSubmitBarProps>) {
  const { pending } = useFormStatus();
  const [submittedAction, setSubmittedAction] = useState<string | null>(null);
  const cancelState = getPendingSafeCancelState(cancelHref, pending);

  return (
    <div className="sticky bottom-0 z-10 space-y-3 border-t border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface)]/95 px-1 pb-1 pt-4 backdrop-blur">
      {previewLinks?.length ? (
        <div className="flex flex-wrap gap-2">
          {previewLinks.map((item) => (
            <Button asChild key={item.href} size="sm" type="button" variant="outline">
              <Link href={item.href} target="_blank">{item.label}</Link>
            </Button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={() => setSubmittedAction("save")} type="submit">
          <PendingLabel idleLabel={isEditing ? "Guardar cambios" : "Crear borrador"} pendingLabel={submittedAction === "save" ? "Guardando..." : "Procesando..."} />
        </Button>
        <Button disabled={pending} formAction={publishAction} onClick={() => setSubmittedAction("publish")} type="submit" variant="outline">
          <PendingLabel idleLabel={isEditing ? (isPublished ? "Actualizar publicación" : "Publicar") : "Crear y publicar"} pendingLabel={submittedAction === "publish" ? "Publicando..." : "Procesando..."} />
        </Button>
        {isEditing && !isArchived ? (
          <Button disabled={pending} formAction={archiveAction} onClick={() => setSubmittedAction("archive")} type="submit" variant="outline">
            <PendingLabel idleLabel="Archivar" pendingLabel={submittedAction === "archive" ? "Archivando..." : "Procesando..."} />
          </Button>
        ) : null}
        {isEditing && isPublished ? (
          <Button disabled={pending} formAction={draftAction} onClick={() => setSubmittedAction("draft")} type="submit" variant="outline">
            <PendingLabel idleLabel="Mover a borrador" pendingLabel={submittedAction === "draft" ? "Moviendo..." : "Procesando..."} />
          </Button>
        ) : null}
        {isEditing ? (
          <Button disabled={pending} formAction={deleteAction} onClick={() => setSubmittedAction("delete")} type="submit" variant="outline">
            <PendingLabel idleLabel="Eliminar" pendingLabel={submittedAction === "delete" ? "Eliminando..." : "Procesando..."} />
          </Button>
        ) : null}
        {cancelState.kind === "disabled" ? (
          <Button aria-disabled={cancelState.ariaDisabled} disabled type="button" variant="ghost">
            Cancelar
          </Button>
        ) : (
          <Button asChild type="button" variant="ghost">
            <Link href={cancelState.href}>Cancelar</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
