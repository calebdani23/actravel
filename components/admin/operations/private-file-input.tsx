"use client";

import { useId, useRef, useState, type DragEvent } from "react";
import { FileUp, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminFieldHintClassName } from "@/components/admin/admin-primitives";
import { buildPrivateFileInputAccessibility, clearPrivateFileSelection, validatePrivateFileSelection, type SelectedPrivateFile } from "@/lib/admin/private-file-input";
import { cn } from "@/lib/utils/cn";

type PrivateFileInputProps = {
  name: string;
  label: string;
  accept: string;
  helpText: string;
  maxSizeBytes: number;
  required?: boolean;
  replacementHelpText?: string;
};

export function PrivateFileInput({ name, label, accept, helpText, maxSizeBytes, required = false, replacementHelpText }: Readonly<PrivateFileInputProps>) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<SelectedPrivateFile | null>(null);
  const a11y = buildPrivateFileInputAccessibility({ error, hasReplacementHelpText: Boolean(replacementHelpText), inputId });

  const validateAndStore = (file: File | null) => {
    const result = validatePrivateFileSelection({ accept, file, maxSizeBytes });
    setError(result.error);
    setSelectedFile(result.selectedFile);
    if (result.shouldClearInput && inputRef.current) inputRef.current.value = "";
    return result.valid;
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0] ?? null;
    if (!validateAndStore(file) || !file || !inputRef.current) return;

    const transfer = new DataTransfer();
    transfer.items.add(file);
    inputRef.current.files = transfer.files;
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-[color:var(--admin-foreground)]" htmlFor={inputId}>{label}</label>
      <input
        accept={accept}
        className="sr-only"
        aria-describedby={a11y.inputDescribedBy}
        aria-invalid={a11y.inputInvalid}
        id={inputId}
        name={name}
        onChange={(event) => validateAndStore(event.currentTarget.files?.[0] ?? null)}
        ref={inputRef}
        required={required}
        type="file"
      />

      <div
        className={cn(
          "rounded-[var(--admin-radius-card)] border border-dashed bg-[color:var(--admin-surface-muted)] p-4 transition",
          dragging ? "border-[color:var(--admin-accent)] bg-[color:var(--admin-brand-bg)]" : "border-[color:var(--admin-border)]",
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--admin-brand-bg)] text-[color:var(--admin-brand-fg)]">
              <FileUp aria-hidden="true" className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-[color:var(--admin-foreground)]">Arrastra tu archivo aquí o selecciónalo manualmente</p>
              <p className={adminFieldHintClassName} id={a11y.helpId}>{helpText}</p>
              {replacementHelpText ? <p className={adminFieldHintClassName} id={a11y.replacementHelpId}>{replacementHelpText}</p> : null}
            </div>
          </div>

          <Button onClick={() => inputRef.current?.click()} type="button" variant="outline">
            Seleccionar archivo
          </Button>
        </div>

        {selectedFile ? (
          <div className="mt-4 flex flex-col gap-3 rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Paperclip aria-hidden="true" className="h-4 w-4 shrink-0 text-[color:var(--admin-accent)]" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[color:var(--admin-foreground)]">{selectedFile.name}</p>
                <p className={adminFieldHintClassName}>{selectedFile.sizeLabel} · Listo para subir</p>
              </div>
            </div>

              <Button
                onClick={() => {
                  const cleared = clearPrivateFileSelection();
                  if (cleared.shouldClearInput && inputRef.current) inputRef.current.value = "";
                  setSelectedFile(cleared.selectedFile);
                  setError(cleared.error);
                }}
                type="button"
                variant="ghost"
            >
              <Trash2 aria-hidden="true" className="mr-2 h-4 w-4" />
              Quitar
            </Button>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-[color:var(--admin-error-fg)]" id={a11y.errorId}>{error}</p> : null}
      </div>
    </div>
  );
}
