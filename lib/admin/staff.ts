import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json, TablesInsert } from "@/lib/supabase/database.types";
import type { RoleName } from "@/lib/supabase/roles";
import type { CreateStaffInput, ManagedStaffRole, PasswordChangeInput, UpdateStaffInput } from "@/lib/validations/staff";

export type StaffActor = { id: string; email?: string; roles: readonly RoleName[] };

type StaffAuditAction =
  | "staff_created"
  | "staff_create_failed"
  | "staff_updated"
  | "staff_deactivated"
  | "staff_reactivated"
  | "staff_role_changed"
  | "staff_password_changed";

type StaffAccountRole = ManagedStaffRole | null;

type StaffRoleRow = { profile_id: string; role: string | null };
type StaffProfileRow = { id: string; full_name: string; is_active: boolean; created_at: string; updated_at: string };

export type StaffAccount = {
  id: string;
  email: string | null;
  full_name: string;
  is_active: boolean;
  role: StaffAccountRole;
  roles: string[];
  has_unsupported_role: boolean;
  is_manageable_in_mvp: boolean;
  management_block_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type StaffAuditEvent = {
  id: string;
  created_at: string;
  action: StaffAuditAction;
  actor_name: string | null;
  target_name: string | null;
  target_email: string | null;
  metadata: Json;
};

type StaffSnapshot = {
  profile_id: string;
  full_name: string;
  is_active: boolean;
  roles: string[];
  email: string | null;
};

type StaffEventInsert = TablesInsert<"admin_account_events">;

type CreateDeps = {
  getManagedRoleId: (role: ManagedStaffRole) => Promise<string>;
  createAuthUser: (input: { email: string; password: string; full_name: string; is_active: boolean }) => Promise<{ id: string; email: string | null }>;
  upsertProfile: (profile: { id: string; full_name: string; is_active: boolean }) => Promise<void>;
  replaceProfileRole: (input: { profileId: string; roleId: string }) => Promise<void>;
  insertAuditEvent: (event: StaffEventInsert) => Promise<void>;
  deleteAuthUser: (userId: string) => Promise<void>;
};

type UpdateDeps = {
  getManagedRoleId: (role: ManagedStaffRole) => Promise<string>;
  getStaffSnapshot: (profileId: string) => Promise<StaffSnapshot | null>;
  countActiveAdminsExcluding: (profileId: string) => Promise<number>;
  updateProfile: (input: { profileId: string; full_name: string; is_active: boolean }) => Promise<void>;
  replaceProfileRole: (input: { profileId: string; roleId: string }) => Promise<void>;
  insertAuditEvent: (event: StaffEventInsert) => Promise<void>;
};

type PasswordDeps = {
  updateOwnPassword: (password: string) => Promise<void>;
  insertAuditEvent: (event: StaffEventInsert) => Promise<void>;
};

const managedRoleNames = new Set<ManagedStaffRole>(["admin", "asesor"]);

function hasUnsupportedRole(roles: string[]) {
  return roles.some((role) => !managedRoleNames.has(role as ManagedStaffRole));
}

function getManagedRoleNames(roles: string[]) {
  return Array.from(new Set(roles.filter((role): role is ManagedStaffRole => managedRoleNames.has(role as ManagedStaffRole))));
}

function getStaffManagementState(roles: string[]) {
  const uniqueRoles = Array.from(new Set(roles.filter(Boolean)));
  const managedRoles = getManagedRoleNames(uniqueRoles);
  const unsupportedRoles = uniqueRoles.filter((role) => !managedRoleNames.has(role as ManagedStaffRole));

  if (unsupportedRoles.length > 0) {
    return {
      managedRole: null,
      hasUnsupportedRole: true,
      isManageableInMvp: false,
      blockReason: "This staff account includes roles outside the MVP admin/asesor scope and cannot be edited here safely.",
    } as const;
  }

  if (managedRoles.length !== 1 || uniqueRoles.length !== 1) {
    return {
      managedRole: null,
      hasUnsupportedRole: false,
      isManageableInMvp: false,
      blockReason: uniqueRoles.length === 0
        ? "This staff account has no role assignment and cannot be edited here safely."
        : "This staff account uses a multi-role assignment outside the MVP single-role management scope and cannot be edited here safely.",
    } as const;
  }

  return {
    managedRole: managedRoles[0],
    hasUnsupportedRole: false,
    isManageableInMvp: true,
    blockReason: null,
  } as const;
}

function buildCreateFailureMessage(error: unknown, cleanupAttempted: boolean, cleanupFailed: boolean) {
  const base = error instanceof Error ? error.message : "Staff account creation failed.";
  if (cleanupFailed) return `${base} Cleanup attempted but failed; contact a technical maintainer with the target email and timestamp.`;
  if (cleanupAttempted) return `${base} Cleanup attempted successfully.`;
  return base;
}

function buildAuditEvent(event: StaffEventInsert): StaffEventInsert {
  return { metadata: {}, target_email: null, actor_id: null, target_profile_id: null, ...event };
}

async function loadRoleRows() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("profile_roles").select("profile_id, roles(name)");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ profile_id: string; roles?: { name?: string | null } | { name?: string | null }[] | null }>).flatMap((row) => {
    const values = Array.isArray(row.roles) ? row.roles : row.roles ? [row.roles] : [];
    return values.map((role) => ({ profile_id: row.profile_id, role: role.name ?? null }));
  }) as StaffRoleRow[];
}

async function loadProfiles() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("profiles").select("id, full_name, is_active, created_at, updated_at").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as StaffProfileRow[];
}

async function loadAuthEmails() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(error.message);
  return new Map((data.users ?? []).map((user) => [user.id, user.email ?? null]));
}

async function resolveManagedRoleId(role: ManagedStaffRole) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("roles").select("id, name").eq("name", role).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error(`Missing seeded role: ${role}`);
  return data.id;
}

async function insertAuditEvent(event: StaffEventInsert) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("admin_account_events").insert(buildAuditEvent(event));
  if (error) throw new Error(error.message);
}

async function getStaffSnapshot(profileId: string): Promise<StaffSnapshot | null> {
  const admin = createSupabaseAdminClient();
  const [{ data: profile, error: profileError }, roleRows, userResult] = await Promise.all([
    admin.from("profiles").select("id, full_name, is_active").eq("id", profileId).maybeSingle(),
    admin.from("profile_roles").select("roles(name)").eq("profile_id", profileId),
    admin.auth.admin.getUserById(profileId),
  ]);

  if (profileError) throw new Error(profileError.message);
  if (!profile) return null;

  const roles = ((roleRows.data ?? []) as Array<{ roles?: { name?: string | null } | { name?: string | null }[] | null }>)
    .flatMap((row) => Array.isArray(row.roles) ? row.roles : row.roles ? [row.roles] : [])
    .map((role) => role.name ?? "")
    .filter(Boolean);

  return {
    profile_id: profile.id,
    full_name: profile.full_name,
    is_active: profile.is_active,
    roles,
    email: userResult.data.user?.email ?? null,
  };
}

async function countActiveAdminsExcluding(profileId: string) {
  const profiles = await loadProfiles();
  const roleRows = await loadRoleRows();
  const roleMap = new Map<string, string[]>();
  for (const row of roleRows) {
    const list = roleMap.get(row.profile_id) ?? [];
    if (row.role) list.push(row.role);
    roleMap.set(row.profile_id, list);
  }
  return profiles.filter((profile) => profile.id !== profileId && profile.is_active && (roleMap.get(profile.id) ?? []).includes("admin")).length;
}

async function upsertProfile(profile: { id: string; full_name: string; is_active: boolean }) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("profiles").upsert(profile);
  if (error) throw new Error(error.message);
}

async function replaceProfileRole(input: { profileId: string; roleId: string }) {
  const admin = createSupabaseAdminClient();
  const { error: deleteError } = await admin.from("profile_roles").delete().eq("profile_id", input.profileId);
  if (deleteError) throw new Error(deleteError.message);
  const { error: insertError } = await admin.from("profile_roles").insert({ profile_id: input.profileId, role_id: input.roleId });
  if (insertError) throw new Error(insertError.message);
}

async function createAuthUser(input: { email: string; password: string; full_name: string; is_active: boolean }) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.createUser(buildStaffAuthCreatePayload(input));
  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      throw new Error("A staff account with that email already exists.");
    }
    throw new Error(error.message);
  }
  if (!data.user?.id) throw new Error("Supabase did not return a created auth user.");
  return { id: data.user.id, email: data.user.email ?? input.email };
}

async function deleteAuthUser(userId: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
}

async function updateProfile(input: { profileId: string; full_name: string; is_active: boolean }) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("profiles").update({ full_name: input.full_name, is_active: input.is_active }).eq("id", input.profileId);
  if (error) throw new Error(error.message);
}

async function updateOwnPassword(password: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

function defaultCreateDeps(): CreateDeps {
  return { getManagedRoleId: resolveManagedRoleId, createAuthUser, upsertProfile, replaceProfileRole, insertAuditEvent, deleteAuthUser };
}

export function buildStaffAuthCreatePayload(input: { email: string; password: string; full_name: string; is_active: boolean }) {
  return {
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name },
  };
}

function defaultUpdateDeps(): UpdateDeps {
  return { getManagedRoleId: resolveManagedRoleId, getStaffSnapshot, countActiveAdminsExcluding, updateProfile, replaceProfileRole, insertAuditEvent };
}

function defaultPasswordDeps(): PasswordDeps {
  return { updateOwnPassword, insertAuditEvent };
}

export async function getStaffAccounts(): Promise<StaffAccount[]> {
  const [profiles, roleRows, emailMap] = await Promise.all([loadProfiles(), loadRoleRows(), loadAuthEmails()]);
  const roleMap = new Map<string, string[]>();
  for (const row of roleRows) {
    const list = roleMap.get(row.profile_id) ?? [];
    if (row.role) list.push(row.role);
    roleMap.set(row.profile_id, list);
  }

  return profiles.map((profile) => {
    const roles = Array.from(new Set(roleMap.get(profile.id) ?? [])).sort();
    const managementState = getStaffManagementState(roles);
    return {
      id: profile.id,
      email: emailMap.get(profile.id) ?? null,
      full_name: profile.full_name,
      is_active: profile.is_active,
      role: managementState.managedRole,
      roles,
      has_unsupported_role: managementState.hasUnsupportedRole,
      is_manageable_in_mvp: managementState.isManageableInMvp,
      management_block_reason: managementState.blockReason,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    };
  }).sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.full_name.localeCompare(b.full_name));
}

export async function getStaffAuditEvents(limit = 25): Promise<StaffAuditEvent[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("admin_account_events")
    .select("id, created_at, action, target_email, metadata, actor:profiles!admin_account_events_actor_id_fkey(full_name), target:profiles!admin_account_events_target_profile_id_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  return ((data ?? []) as Array<{
    id: string;
    created_at: string;
    action: StaffAuditAction;
    target_email: string | null;
    metadata: Json;
    actor?: { full_name?: string | null } | { full_name?: string | null }[] | null;
    target?: { full_name?: string | null } | { full_name?: string | null }[] | null;
  }>).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    action: row.action,
    actor_name: Array.isArray(row.actor) ? row.actor[0]?.full_name ?? null : row.actor?.full_name ?? null,
    target_name: Array.isArray(row.target) ? row.target[0]?.full_name ?? null : row.target?.full_name ?? null,
    target_email: row.target_email,
    metadata: row.metadata,
  }));
}

export function getAdvisorCapableStaffFromRows(rows: Array<{ id: string; full_name: string; is_active: boolean; roles: string[] }>) {
  const unique = new Map<string, { id: string; full_name: string }>();
  for (const row of rows) {
    if (!row.is_active) continue;
    if (!row.roles.some((role) => role === "admin" || role === "asesor")) continue;
    unique.set(row.id, { id: row.id, full_name: row.full_name });
  }
  return [...unique.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export async function getAdvisorCapableStaff() {
  const accounts = await getStaffAccounts();
  return getAdvisorCapableStaffFromRows(accounts.map((account) => ({
    id: account.id,
    full_name: account.full_name,
    is_active: account.is_active,
    roles: account.roles,
  })));
}

export async function createStaffAccount(input: CreateStaffInput, actor: StaffActor, deps: CreateDeps = defaultCreateDeps()) {
  const roleId = await deps.getManagedRoleId(input.role);
  let createdUserId: string | null = null;
  let cleanupAttempted = false;
  let cleanupFailed = false;

  try {
    const user = await deps.createAuthUser({
      email: input.email,
      password: input.initial_password,
      full_name: input.full_name,
      is_active: input.is_active,
    });
    createdUserId = user.id;
    await deps.upsertProfile({ id: user.id, full_name: input.full_name, is_active: input.is_active });
    await deps.replaceProfileRole({ profileId: user.id, roleId });
    await deps.insertAuditEvent({
      actor_id: actor.id,
      target_profile_id: user.id,
      target_email: input.email,
      action: "staff_created",
      metadata: { role: input.role, isActive: input.is_active },
    });
    return { userId: user.id, email: user.email };
  } catch (error) {
    if (createdUserId) {
      cleanupAttempted = true;
      try {
        await deps.deleteAuthUser(createdUserId);
      } catch {
        cleanupFailed = true;
      }
    }

    try {
      await deps.insertAuditEvent({
        actor_id: actor.id,
        target_profile_id: null,
        target_email: input.email,
        action: "staff_create_failed",
        metadata: { role: input.role, isActive: input.is_active, cleanupAttempted, cleanupFailed },
      });
    } catch {
      // Best effort only; do not replace the primary failure.
    }

    throw new Error(buildCreateFailureMessage(error, cleanupAttempted, cleanupFailed));
  }
}

export async function updateStaffAccount(input: UpdateStaffInput, actor: StaffActor, deps: UpdateDeps = defaultUpdateDeps()) {
  const snapshot = await deps.getStaffSnapshot(input.profile_id);
  if (!snapshot) throw new Error("Staff profile was not found.");
  const managementState = getStaffManagementState(snapshot.roles);
  if (!managementState.isManageableInMvp) throw new Error(managementState.blockReason);

  const currentManagedRole = managementState.managedRole;
  const nextManagedRole = input.role;
  const isRoleChange = currentManagedRole !== nextManagedRole;
  const isStatusChange = snapshot.is_active !== input.is_active;
  const isSelf = snapshot.profile_id === actor.id;
  const removesAdminAccess = snapshot.is_active && snapshot.roles.includes("admin") && (!input.is_active || input.role !== "admin");

  if (isSelf && input.role !== "admin") throw new Error("You cannot remove your own admin role.");
  if (isSelf && !input.is_active) throw new Error("You cannot deactivate your own account.");

  if (removesAdminAccess) {
    const otherActiveAdmins = await deps.countActiveAdminsExcluding(snapshot.profile_id);
    if (otherActiveAdmins === 0) throw new Error("This change would remove the last active admin.");
  }

  const roleId = await deps.getManagedRoleId(nextManagedRole);
  await deps.updateProfile({ profileId: input.profile_id, full_name: input.full_name, is_active: input.is_active });
  await deps.replaceProfileRole({ profileId: input.profile_id, roleId });

  if (snapshot.full_name !== input.full_name) {
    await deps.insertAuditEvent({
      actor_id: actor.id,
      target_profile_id: input.profile_id,
      target_email: snapshot.email,
      action: "staff_updated",
      metadata: { previousFullName: snapshot.full_name, nextFullName: input.full_name },
    });
  }
  if (isRoleChange) {
    await deps.insertAuditEvent({
      actor_id: actor.id,
      target_profile_id: input.profile_id,
      target_email: snapshot.email,
      action: "staff_role_changed",
      metadata: { previousRole: currentManagedRole, nextRole: nextManagedRole },
    });
  }
  if (isStatusChange) {
    await deps.insertAuditEvent({
      actor_id: actor.id,
      target_profile_id: input.profile_id,
      target_email: snapshot.email,
      action: input.is_active ? "staff_reactivated" : "staff_deactivated",
      metadata: { previousIsActive: snapshot.is_active, nextIsActive: input.is_active },
    });
  }
}

export async function changeCurrentStaffPassword(input: PasswordChangeInput, actor: StaffActor, deps: PasswordDeps = defaultPasswordDeps()) {
  await deps.updateOwnPassword(input.password);
  await deps.insertAuditEvent({
    actor_id: actor.id,
    target_profile_id: actor.id,
    target_email: actor.email ?? null,
    action: "staff_password_changed",
    metadata: { selfService: true },
  });
}
