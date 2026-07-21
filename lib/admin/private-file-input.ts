export type PrivateFileLike = {
  name: string;
  size: number;
  type: string;
};

export type SelectedPrivateFile = {
  name: string;
  sizeLabel: string;
};

export function buildPrivateFileInputAccessibility({
  error,
  hasReplacementHelpText,
  inputId,
}: {
  error: string | null;
  hasReplacementHelpText: boolean;
  inputId: string;
}) {
  const describedBy = [`${inputId}-help`];
  if (hasReplacementHelpText) describedBy.push(`${inputId}-replacement-help`);
  if (error) describedBy.push(`${inputId}-error`);

  return {
    errorId: `${inputId}-error`,
    helpId: `${inputId}-help`,
    inputDescribedBy: describedBy.join(" "),
    inputInvalid: Boolean(error),
    replacementHelpId: `${inputId}-replacement-help`,
  };
}

export function formatPrivateFileSizeLabel(size: number) {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

export function clearPrivateFileSelection() {
  return {
    error: null,
    selectedFile: null as SelectedPrivateFile | null,
    shouldClearInput: true,
  };
}

export function validatePrivateFileSelection({
  accept,
  file,
  maxSizeBytes,
}: {
  accept: string;
  file: PrivateFileLike | null;
  maxSizeBytes: number;
}) {
  if (!file) {
    return {
      error: null,
      selectedFile: null as SelectedPrivateFile | null,
      shouldClearInput: false,
      valid: false,
    };
  }

  const allowedTypes = new Set(accept.split(",").map((value) => value.trim()).filter(Boolean));
  if (file.type && allowedTypes.size && !allowedTypes.has(file.type)) {
    return {
      error: "Tipo de archivo no permitido. Usa PDF, JPG, PNG o WebP.",
      selectedFile: null as SelectedPrivateFile | null,
      shouldClearInput: true,
      valid: false,
    };
  }

  if (file.size > maxSizeBytes) {
    return {
      error: `El archivo excede el límite de ${Math.round(maxSizeBytes / (1024 * 1024))} MB.`,
      selectedFile: null as SelectedPrivateFile | null,
      shouldClearInput: true,
      valid: false,
    };
  }

  return {
    error: null,
    selectedFile: {
      name: file.name,
      sizeLabel: formatPrivateFileSizeLabel(file.size),
    },
    shouldClearInput: false,
    valid: true,
  };
}
