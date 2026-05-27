import "server-only";

import { google } from "googleapis";

export const GOOGLE_SHEETS_ENV_KEYS = [
  "GOOGLE_SHEETS_CLIENT_EMAIL",
  "GOOGLE_SHEETS_PRIVATE_KEY",
  "GOOGLE_SHEETS_SPREADSHEET_ID",
  "GOOGLE_SHEETS_LEADS_TAB",
] as const;

export type GoogleSheetsConfig = {
  clientEmail: string;
  privateKey: string;
  spreadsheetId: string;
  leadsTab: string;
};

export function getGoogleSheetsConfig(): GoogleSheetsConfig | { missing: string[] } {
  const missing = GOOGLE_SHEETS_ENV_KEYS.filter((key) => !process.env[key]);
  if (missing.length > 0) return { missing };

  return {
    clientEmail: process.env.GOOGLE_SHEETS_CLIENT_EMAIL as string,
    privateKey: (process.env.GOOGLE_SHEETS_PRIVATE_KEY as string).replace(/\\n/g, "\n"),
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID as string,
    leadsTab: process.env.GOOGLE_SHEETS_LEADS_TAB as string,
  };
}

export function createGoogleSheetsClient(config: GoogleSheetsConfig) {
  const auth = new google.auth.JWT({
    email: config.clientEmail,
    key: config.privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

export function quoteSheetName(sheetName: string) {
  return `'${sheetName.replace(/'/g, "''")}'`;
}
