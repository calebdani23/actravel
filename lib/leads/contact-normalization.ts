const FULLWIDTH_ASCII_SOURCE = "！＂＃＄％＆＇（）＊＋，－．／０１２３４５６７８９：；＜＝＞？＠ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ［＼］＾＿｀ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ｛｜｝～";
const FULLWIDTH_ASCII_TARGET = "!\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~";

function foldFullwidthAscii(value: string) {
  return value.replace(/[！-～]/g, (character) => {
    const index = FULLWIDTH_ASCII_SOURCE.indexOf(character);
    return index >= 0 ? FULLWIDTH_ASCII_TARGET[index] ?? character : character;
  });
}

export function normalizeIdentityAscii(value?: string | null) {
  return value ? foldFullwidthAscii(value).trim() : "";
}

function normalizeIdentityText(value?: string | null) {
  return normalizeIdentityAscii(value);
}

export function normalizeWhatsAppIdentity(value: string) {
  const normalized = normalizeIdentityText(value);
  const withoutExtension = normalized.replace(/(?:ext\.?|extension|anexo|x|#)\s*\d+$/i, "");
  let digits = withoutExtension.replace(/\D/g, "");
  digits = digits.replace(/^00+/, "");
  if (digits.startsWith("521") && digits.length === 13) {
    digits = `52${digits.slice(3)}`;
  }
  return digits;
}

export function normalizeEmailIdentity(value?: string | null) {
  const email = normalizeIdentityText(value);
  if (!email) return null;

  const compact = email.replace(/\s+/g, "");
  const [rawLocalPart, rawDomain, ...rest] = compact.split("@");
  if (!rawLocalPart || !rawDomain || rest.length > 0) {
    return compact.toLowerCase();
  }

  const domain = rawDomain.toLowerCase().replace(/\.+$/, "");
  const localPart = rawLocalPart.toLowerCase();

  if (domain === "gmail.com" || domain === "googlemail.com") {
    const canonicalLocal = localPart.split("+")[0]?.replace(/\./g, "") ?? localPart;
    return `${canonicalLocal}@gmail.com`;
  }

  return `${localPart}@${domain}`;
}

export const CRM_NORMALIZATION_SQL_ASCII_TRANSLATE = {
  source: FULLWIDTH_ASCII_SOURCE,
  target: FULLWIDTH_ASCII_TARGET,
} as const;

export const CONTACT_NORMALIZATION_PARITY_CASES = {
  emails: [
    { input: "  Ada.Test+vip@GoogleMail.com ", expected: "adatest@gmail.com" },
    { input: " Ａｄａ．Ｔｅｓｔ＋vip＠ＧｏｏｇｌｅＭａｉｌ．ｃｏｍ ", expected: "adatest@gmail.com" },
    { input: " USER@Example.COM.. ", expected: "user@example.com" },
    { input: "bad@@example.com", expected: "bad@@example.com" },
  ],
  phones: [
    { input: "+52 1 998 845 3455 ext 22", expected: "529988453455" },
    { input: "＋５２ １ ９９８ ８４５ ３４５５ ext 22", expected: "529988453455" },
    { input: "  00 52 1 998 845 3455 x 9  ", expected: "529988453455" },
    { input: "(998) 845-3455 #123", expected: "9988453455" },
  ],
  supportedScope:
    "Supported parity covers full-width ASCII folding, trim/whitespace compaction, case folding, Gmail dot/plus canonicalization, trailing domain dots, and trailing phone extensions. It does not promise broader Unicode NFKC folding beyond full-width ASCII.",
} as const;
