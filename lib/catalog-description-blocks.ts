export type CatalogDescriptionBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

function cleanLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function pushParagraph(blocks: CatalogDescriptionBlock[], lines: string[]) {
  const text = lines.map(cleanLine).filter(Boolean).join(" ");
  if (text) blocks.push({ type: "paragraph", text });
}

function pushList(blocks: CatalogDescriptionBlock[], items: string[]) {
  const normalized = items.map(cleanLine).filter(Boolean);
  if (normalized.length) blocks.push({ type: "list", items: normalized });
}

export function parseCatalogDescriptionBlocks(value: string | null | undefined): CatalogDescriptionBlock[] {
  const source = value?.trim();
  if (!source) return [];

  const blocks: CatalogDescriptionBlock[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  const flush = () => {
    pushParagraph(blocks, paragraphLines);
    pushList(blocks, listItems);
    paragraphLines = [];
    listItems = [];
  };

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      flush();
      continue;
    }

    const listMatch = line.match(/^[-*]\s+(.+)$/);
    if (listMatch) {
      if (paragraphLines.length) {
        pushParagraph(blocks, paragraphLines);
        paragraphLines = [];
      }
      listItems.push(listMatch[1]);
      continue;
    }

    if (listItems.length) {
      pushList(blocks, listItems);
      listItems = [];
    }

    paragraphLines.push(line);
  }

  flush();
  return blocks;
}
