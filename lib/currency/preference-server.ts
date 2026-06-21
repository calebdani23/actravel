import { cookies } from "next/headers";
import { normalizeCurrencyPreference } from "@/lib/currency/preference";

export async function getServerCurrencyPreference() {
  const cookieStore = await cookies();
  return normalizeCurrencyPreference(cookieStore.get("ac-travel-currency")?.value);
}
