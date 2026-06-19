export type DetailSection = { title: string; items: string[] };

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeDetailSectionsValue(value: unknown): DetailSection[] | null {
  if (!Array.isArray(value)) return null;

  const sections = value
    .map((section) => {
      if (!section || typeof section !== "object" || Array.isArray(section)) return null;

      const title = cleanText((section as { title?: unknown }).title);
      const items = Array.isArray((section as { items?: unknown }).items)
        ? ((section as { items: unknown[] }).items.map(cleanText).filter(Boolean))
        : [];

      if (!title || !items.length) return null;
      return { title, items };
    })
    .filter((section): section is DetailSection => Boolean(section));

  return sections.length ? sections : null;
}

export function stringifyDetailSectionsEditorValue(sections?: DetailSection[] | unknown | null) {
  const normalized = normalizeDetailSectionsValue(sections);
  if (!normalized?.length) return "";

  return normalized
    .map((section) => [`[${section.title}]`, ...section.items.map((item) => `- ${item}`)].join("\n"))
    .join("\n\n");
}

export function parseDetailSectionsEditorValue(value: string | null | undefined): DetailSection[] | null {
  const input = value?.trim();
  if (!input) return null;

  const sections: DetailSection[] = [];
  let current: DetailSection | null = null;

  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const sectionMatch = line.match(/^\[(.+)]$/);
    if (sectionMatch) {
      if (current?.title && current.items.length) sections.push(current);
      current = { title: sectionMatch[1].trim(), items: [] };
      continue;
    }

    const itemMatch = line.match(/^[-*]\s+(.+)$/);
    if (itemMatch && current) {
      const item = itemMatch[1].trim();
      if (item) current.items.push(item);
    }
  }

  if (current?.title && current.items.length) sections.push(current);

  return normalizeDetailSectionsValue(sections);
}
