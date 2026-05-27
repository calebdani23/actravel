import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadLocalEnv() {
  for (const fileName of [".env.local", ".env"]) {
    const envPath = resolve(process.cwd(), fileName);
    if (!existsSync(envPath)) continue;

    const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      if (!key || process.env[key] !== undefined) continue;

      process.env[key] = rawValue.replace(/^(["'])(.*)\1$/, "$2");
    }
  }
}

loadLocalEnv();

type BootstrapUser = {
  email?: string;
  password?: string;
  fullName: string;
  role: "admin" | "asesor";
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
}

const users: BootstrapUser[] = [
  {
    email: process.env.BOOTSTRAP_ADMIN_EMAIL,
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
    fullName: process.env.BOOTSTRAP_ADMIN_NAME ?? "AC Travel Admin",
    role: "admin",
  },
  {
    email: process.env.BOOTSTRAP_ASESOR_EMAIL,
    password: process.env.BOOTSTRAP_ASESOR_PASSWORD,
    fullName: process.env.BOOTSTRAP_ASESOR_NAME ?? "AC Travel Asesor",
    role: "asesor",
  },
];

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function ensureUser({ email, password, fullName, role }: BootstrapUser) {
  if (!email || !password) {
    console.log(`Skipping ${role}: missing bootstrap email or password env`);
    return;
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError && !createError.message.toLowerCase().includes("already")) {
    throw createError;
  }

  let userId = created.user?.id;
  if (!userId) {
    const { data: listed, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;
    userId = listed.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())?.id;
  }

  if (!userId) throw new Error(`Could not find or create ${role} bootstrap user`);

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userId,
    full_name: fullName,
    is_active: true,
  });
  if (profileError) throw profileError;

  const { data: roleRow, error: roleError } = await supabase
    .from("roles")
    .select("id")
    .eq("name", role)
    .single();
  if (roleError) throw roleError;

  const { error: assignmentError } = await supabase.from("profile_roles").upsert({
    profile_id: userId,
    role_id: roleRow.id,
  });
  if (assignmentError) throw assignmentError;

  console.log(`Ensured ${role} bootstrap user`);
}

async function main() {
  for (const user of users) {
    await ensureUser(user);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Bootstrap failed");
  process.exit(1);
});
