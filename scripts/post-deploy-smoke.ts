import { runPostDeploySmokeCheck } from "@/lib/ops/post-deploy-smoke";

async function main() {
  const result = await runPostDeploySmokeCheck();
  const lines = [
    "Post-deploy smoke check passed.",
    `- Site URL: ${result.expectedSiteUrl}`,
    `- EMAIL_FROM: ${result.emailFromAddress}`,
    `- EMAIL_ADMIN: ${result.emailAdminAddress}`,
    `- Local URL checks: ${result.checkedUrlCount}`,
  ];

  process.stdout.write(`${lines.join("\n")}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown smoke check failure";
  process.stderr.write(`Post-deploy smoke check failed.\n${message}\n`);
  process.exitCode = 1;
});
