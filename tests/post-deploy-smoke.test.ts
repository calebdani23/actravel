import assert from "node:assert/strict";
import test from "node:test";

import { runPostDeploySmokeCheck } from "@/lib/ops/post-deploy-smoke";

const validEnv = {
  NEXT_PUBLIC_SITE_URL: "https://www.actravel.com",
  EMAIL_FROM: "AC Travel <quotes@actravel.com>",
  EMAIL_ADMIN: "ventas@actravel.com",
} as const;

async function withEnv<T>(env: Partial<NodeJS.ProcessEnv>, run: () => Promise<T> | T) {
  const previous = {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_ADMIN: process.env.EMAIL_ADMIN,
  };

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    return await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("post-deploy smoke check validates env-driven absolute URLs and recipients", async () => {
  const result = await withEnv(validEnv, () => runPostDeploySmokeCheck());

  assert.equal(result.expectedSiteUrl, "https://www.actravel.com");
  assert.equal(result.emailFromAddress, "quotes@actravel.com");
  assert.equal(result.emailAdminAddress, "ventas@actravel.com");
  assert.equal(result.checkedUrlCount, 4);
});

test("post-deploy smoke check fails fast on missing env", async () => {
  await assert.rejects(
    withEnv({ NEXT_PUBLIC_SITE_URL: undefined, EMAIL_FROM: undefined, EMAIL_ADMIN: undefined }, () => runPostDeploySmokeCheck()),
    /NEXT_PUBLIC_SITE_URL is missing[\s\S]*EMAIL_FROM is missing[\s\S]*EMAIL_ADMIN is missing/,
  );
});

test("post-deploy smoke check rejects malformed production env values", async () => {
  await assert.rejects(
    withEnv({ NEXT_PUBLIC_SITE_URL: "https://www.actravel.com/app", EMAIL_FROM: "invalid-from", EMAIL_ADMIN: "ventas" }, () => runPostDeploySmokeCheck()),
    /NEXT_PUBLIC_SITE_URL must be a clean site origin without path, query, or hash[\s\S]*EMAIL_FROM must contain a valid email address[\s\S]*EMAIL_ADMIN must contain a valid email address/,
  );
});
