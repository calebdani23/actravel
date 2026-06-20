export type PromotionOfferFact = { label: string; value: string; emphasis?: boolean };
export type PromotionValueHighlight = { title: string; text?: string };

export type PromotionCommercialSections = {
  offerFacts?: PromotionOfferFact[];
  includedList?: string[];
  restrictionsList?: string[];
  valueHighlights?: PromotionValueHighlight[];
  ctaNote?: string;
};

export class PromotionCommercialSectionsValidationError extends Error {
  constructor(message = "Formato inválido en secciones comerciales. Usa solo los bloques [Datos de oferta], [Incluye], [Restricciones], [Valor] y [Nota CTA].") {
    super(message);
    this.name = "PromotionCommercialSectionsValidationError";
  }
}

const LIMITS = {
  offerFacts: 8,
  includedList: 12,
  restrictionsList: 12,
  valueHighlights: 6,
  shortText: 80,
  longText: 220,
} as const;

type SectionKey = "offerFacts" | "includedList" | "restrictionsList" | "valueHighlights" | "ctaNote";

const SECTION_HEADERS: Record<string, SectionKey> = {
  "offer facts": "offerFacts",
  "datos de oferta": "offerFacts",
  included: "includedList",
  incluye: "includedList",
  restrictions: "restrictionsList",
  restricciones: "restrictionsList",
  "value highlights": "valueHighlights",
  valor: "valueHighlights",
  "cta note": "ctaNote",
  "nota cta": "ctaNote",
};

const CANONICAL_HEADERS: Record<SectionKey, string> = {
  offerFacts: "Datos de oferta",
  includedList: "Incluye",
  restrictionsList: "Restricciones",
  valueHighlights: "Valor",
  ctaNote: "Nota CTA",
};

function cleanText(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function normalizeList(value: unknown, limit: number) {
  if (!Array.isArray(value)) return undefined;
  const items = value.map((item) => cleanText(item, LIMITS.longText)).filter(Boolean).slice(0, limit);
  return items.length ? items : undefined;
}

function normalizeOfferFacts(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const facts = value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const label = cleanText((item as { label?: unknown }).label, LIMITS.shortText);
      const valueText = cleanText((item as { value?: unknown }).value, LIMITS.longText);
      if (!label || !valueText) return null;
      const emphasis = (item as { emphasis?: unknown }).emphasis === true ? true : undefined;
      return emphasis ? { label, value: valueText, emphasis } : { label, value: valueText };
    })
    .filter((item): item is PromotionOfferFact => Boolean(item))
    .slice(0, LIMITS.offerFacts);

  return facts.length ? facts : undefined;
}

function normalizeValueHighlights(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const highlights = value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const title = cleanText((item as { title?: unknown }).title, LIMITS.shortText);
      const text = cleanText((item as { text?: unknown; description?: unknown }).text ?? (item as { description?: unknown }).description, LIMITS.longText);
      if (!title) return null;
      return text ? { title, text } : { title };
    })
    .filter((item): item is PromotionValueHighlight => Boolean(item))
    .slice(0, LIMITS.valueHighlights);

  return highlights.length ? highlights : undefined;
}

export function normalizePromotionCommercialSectionsValue(value: unknown): PromotionCommercialSections | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const offerFacts = normalizeOfferFacts(record.offerFacts);
  const includedList = normalizeList(record.includedList, LIMITS.includedList);
  const restrictionsList = normalizeList(record.restrictionsList, LIMITS.restrictionsList);
  const valueHighlights = normalizeValueHighlights(record.valueHighlights);
  const ctaNote = cleanText(record.ctaNote, LIMITS.longText) || undefined;
  const normalized: PromotionCommercialSections = {
    ...(offerFacts ? { offerFacts } : {}),
    ...(includedList ? { includedList } : {}),
    ...(restrictionsList ? { restrictionsList } : {}),
    ...(valueHighlights ? { valueHighlights } : {}),
    ...(ctaNote ? { ctaNote } : {}),
  };

  return Object.values(normalized).some(Boolean) ? normalized : null;
}

export function parsePromotionCommercialSectionsEditorValue(input: string | null | undefined): PromotionCommercialSections | null {
  const source = input?.trim();
  if (!source) return null;

  const draft: Record<SectionKey, unknown[]> = {
    offerFacts: [],
    includedList: [],
    restrictionsList: [],
    valueHighlights: [],
    ctaNote: [],
  };
  let currentSection: SectionKey | null = null;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const headerMatch = line.match(/^\[(.+)]$/);
    if (headerMatch) {
      currentSection = SECTION_HEADERS[headerMatch[1].trim().toLowerCase()] ?? null;
      continue;
    }

    if (!currentSection) continue;

    if (currentSection === "includedList" || currentSection === "restrictionsList") {
      const itemMatch = line.match(/^[-*]\s+(.+)$/);
      if (itemMatch) draft[currentSection].push(itemMatch[1]);
      continue;
    }

    if (currentSection === "offerFacts") {
      const [label, value, marker] = line.split("|").map((item) => item.trim());
      const normalizedMarker = marker?.toLowerCase();
      if (label && value) draft.offerFacts.push({ label, value, ...(["emphasis", "destacado", "enfasis", "énfasis"].includes(normalizedMarker ?? "") ? { emphasis: true } : {}) });
      continue;
    }

    if (currentSection === "valueHighlights") {
      const [title, text] = line.split("|").map((item) => item.trim());
      if (title) draft.valueHighlights.push(text ? { title, text } : { title });
      continue;
    }

    draft.ctaNote.push(line);
  }

  return normalizePromotionCommercialSectionsValue({
    offerFacts: draft.offerFacts,
    includedList: draft.includedList,
    restrictionsList: draft.restrictionsList,
    valueHighlights: draft.valueHighlights,
    ctaNote: draft.ctaNote.join(" "),
  });
}

export function parsePromotionCommercialSectionsEditorValueOrThrow(input: string | null | undefined): PromotionCommercialSections | null {
  const source = input?.trim();
  if (!source) return null;

  const parsed = parsePromotionCommercialSectionsEditorValue(source);
  if (!parsed) throw new PromotionCommercialSectionsValidationError();
  return parsed;
}

export function stringifyPromotionCommercialSectionsEditorValue(value: unknown) {
  const normalized = normalizePromotionCommercialSectionsValue(value);
  if (!normalized) return "";

  const groups = [
    normalized.offerFacts?.length ? [`[${CANONICAL_HEADERS.offerFacts}]`, ...normalized.offerFacts.map((item) => `${item.label} | ${item.value}${item.emphasis ? " | destacado" : ""}`)].join("\n") : null,
    normalized.includedList?.length ? [`[${CANONICAL_HEADERS.includedList}]`, ...normalized.includedList.map((item) => `- ${item}`)].join("\n") : null,
    normalized.restrictionsList?.length ? [`[${CANONICAL_HEADERS.restrictionsList}]`, ...normalized.restrictionsList.map((item) => `- ${item}`)].join("\n") : null,
    normalized.valueHighlights?.length ? [`[${CANONICAL_HEADERS.valueHighlights}]`, ...normalized.valueHighlights.map((item) => item.text ? `${item.title} | ${item.text}` : item.title)].join("\n") : null,
    normalized.ctaNote ? [`[${CANONICAL_HEADERS.ctaNote}]`, normalized.ctaNote].join("\n") : null,
  ].filter(Boolean);

  return groups.join("\n\n");
}
