import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page } from "@playwright/test";

function readLocalEnvValue(name: string) {
  for (const fileName of [".env.local", ".env"]) {
    const envPath = resolve(process.cwd(), fileName);
    if (!existsSync(envPath)) continue;

    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;

      const key = trimmed.slice(0, separatorIndex).trim();
      if (key !== name) continue;

      return trimmed.slice(separatorIndex + 1).trim().replace(/^("|')(.*)\1$/, "$2");
    }
  }

  return undefined;
}

export function getAdminCredentials() {
  const email = process.env.E2E_ADMIN_EMAIL ?? process.env.BOOTSTRAP_ADMIN_EMAIL ?? readLocalEnvValue("E2E_ADMIN_EMAIL") ?? readLocalEnvValue("BOOTSTRAP_ADMIN_EMAIL");
  const password = process.env.E2E_ADMIN_PASSWORD ?? process.env.BOOTSTRAP_ADMIN_PASSWORD ?? readLocalEnvValue("E2E_ADMIN_PASSWORD") ?? readLocalEnvValue("BOOTSTRAP_ADMIN_PASSWORD");

  if (!email || !password) {
    throw new Error("Missing E2E admin credentials. Set E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD or BOOTSTRAP_ADMIN_EMAIL/BOOTSTRAP_ADMIN_PASSWORD.");
  }

  return { email, password };
}

export async function loginAsAdmin(page: Page) {
  const { email, password } = getAdminCredentials();

  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Entrar con Supabase" }).click();
  await page.waitForURL("**/admin/dashboard");
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
}

export function futureIsoDate(daysFromToday: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}
