import "server-only"

import { createClient } from "@/lib/supabase/server"
import { hasExactKeys, isCanonicalUuid } from "./task-automation-historical-contract"

export type BootstrapDependencyCode = "CLIENT_UNAVAILABLE" | "PERSISTENCE_FAILURE"
type Failure<Code extends string> = Code extends string ? { ok: false; error: { code: Code; message: Code } } : never
export type BootstrapAuthResult<DependencyCode extends BootstrapDependencyCode> =
  | { ok: true; actorId: string; actorRole: "admin" }
  | Failure<"AUTH_REQUIRED" | "AUTH_INACTIVE" | "AUTH_NOT_ADMIN" | DependencyCode>
type QueryResult = { data: unknown; error: unknown }
export type BootstrapAuthDeps = {
  createAuthClient?: () => Promise<unknown>
  getUser?: (client: unknown) => Promise<QueryResult>
  readProfile?: (client: unknown, actorId: string) => Promise<QueryResult>
  readRoles?: (client: unknown, actorId: string) => Promise<QueryResult>
}

type ServerClient = Awaited<ReturnType<typeof createClient>>
const failure = <Code extends string>(code: Code): Failure<Code> => ({ ok: false, error: { code, message: code } }) as Failure<Code>
const query = (value: unknown): QueryResult | null => {
  if (!value || typeof value !== "object") return null
  const data = Object.getOwnPropertyDescriptor(value, "data"), error = Object.getOwnPropertyDescriptor(value, "error")
  return data && "value" in data && error && "value" in error ? { data: data.value, error: error.value } : null
}

export async function authorizeTaskAutomationHistoricalAdmin<DependencyCode extends BootstrapDependencyCode>(
  dependencyCode: DependencyCode, deps: BootstrapAuthDeps = {},
): Promise<BootstrapAuthResult<DependencyCode>> {
  try {
    const client = await (deps.createAuthClient ?? createClient)()
    const userResult = query(await (deps.getUser ?? ((value) => (value as ServerClient).auth.getUser()))(client))
    if (!userResult || userResult.error !== null || !hasExactKeys(userResult.data, ["user"])) return failure(dependencyCode)
    if (userResult.data.user === null) return failure("AUTH_REQUIRED")
    const user = userResult.data.user
    if (!user || typeof user !== "object") return failure(dependencyCode)
    const actorId = Object.getOwnPropertyDescriptor(user, "id")?.value
    if (!isCanonicalUuid(actorId)) return failure(dependencyCode)
    const profileResult = query(await (deps.readProfile ?? (async (value, id) =>
      (value as ServerClient).from("profiles").select("id,is_active").eq("id", id).maybeSingle()))(client, actorId))
    if (!profileResult || profileResult.error !== null) return failure(dependencyCode)
    if (profileResult.data === null) return failure("AUTH_INACTIVE")
    if (!hasExactKeys(profileResult.data, ["id", "is_active"]) || profileResult.data.id !== actorId
      || typeof profileResult.data.is_active !== "boolean") return failure(dependencyCode)
    if (!profileResult.data.is_active) return failure("AUTH_INACTIVE")
    const rolesResult = query(await (deps.readRoles ?? (async (value, id) =>
      (value as ServerClient).from("profile_roles").select("roles(name)").eq("profile_id", id)))(client, actorId))
    if (!rolesResult || rolesResult.error !== null || !Array.isArray(rolesResult.data)) return failure(dependencyCode)
    const roles: string[] = []
    for (const row of rolesResult.data) {
      if (!hasExactKeys(row, ["roles"]) || !hasExactKeys(row.roles, ["name"]) || typeof row.roles.name !== "string") return failure(dependencyCode)
      roles.push(row.roles.name)
    }
    return roles.includes("admin") ? { ok: true, actorId, actorRole: "admin" } : failure("AUTH_NOT_ADMIN")
  } catch { return failure(dependencyCode) }
}
