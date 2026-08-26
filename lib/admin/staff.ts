import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json, TablesInsert } from "@/lib/supabase/database.types";
import type { RoleName } from "@/lib/supabase/roles";
import type { CreateStaffInput, DeleteStaffInput, EmailChangeInput, ManagedStaffRole, PasswordChangeInput, UpdateStaffInput } from "@/lib/validations/staff";

export type StaffActor = { id: string; email?: string; roles: readonly RoleName[] };

type StaffAuditAction =
  | "staff_created"
  | "staff_create_failed"
  | "staff_updated"
  | "staff_deactivated"
  | "staff_reactivated"
  | "staff_role_changed"
  | "staff_deleted"
  | "staff_password_changed"
  | "staff_email_change_requested";

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

export type StaffDeletionReference = {
  table: string;
  label: string;
  count: number;
};

export type StaffDeletionReferenceSummary = {
  totalReferences: number;
  references: StaffDeletionReference[];
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

type EmailChangeDeps = {
  updateOwnEmail: (email: string) => Promise<void>;
  insertAuditEvent: (event: StaffEventInsert) => Promise<void>;
};

type DeleteDeps = {
  getStaffSnapshot: (profileId: string) => Promise<StaffSnapshot | null>;
  countActiveAdminsExcluding: (profileId: string) => Promise<number>;
  getDeletionReferenceSummary: (profileId: string) => Promise<StaffDeletionReferenceSummary>;
  deleteAuthUser: (userId: string) => Promise<void>;
  insertAuditEvent: (event: StaffEventInsert) => Promise<void>;
};

const deletionReferenceChecks = [
  { table: "leads", column: "assigned_to", label: "Leads" },
  { table: "lead_notes", column: "author_id", label: "Lead notes" },
  { table: "lead_events", column: "actor_id", label: "Lead events" },
  { table: "bookings", column: "assigned_to", label: "Bookings" },
  { table: "payments", column: "verified_by", label: "Payments" },
  { table: "documents", column: "uploaded_by", label: "Documents" },
  { table: "notification_logs", column: "last_retried_by", label: "Notification retry history" },
  { table: "notification_logs", column: "incident_updated_by", label: "Notification incident history" },
  { table: "sheet_sync_logs", column: "last_retried_by", label: "Sheet sync retry history" },
  { table: "sheet_sync_logs", column: "incident_updated_by", label: "Sheet sync incident history" },
] as const;

const managedRoleNames = new Set<ManagedStaffRole>(["admin", "manager", "asesor"]);

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
      blockReason: "Esta cuenta incluye roles fuera del alcance MVP de administración y asesoría, por lo que aquí solo puede consultarse.",
    } as const;
  }

  if (managedRoles.length !== 1 || uniqueRoles.length !== 1) {
    return {
        managedRole: null,
        hasUnsupportedRole: false,
        isManageableInMvp: false,
        blockReason: uniqueRoles.length === 0
          ? "Esta cuenta no tiene un rol asignado y aquí solo puede consultarse."
          : "Esta cuenta usa múltiples roles fuera del alcance MVP de gestión con rol único y aquí solo puede consultarse.",
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
  const base = error instanceof Error ? error.message : "No se pudo crear el usuario interno.";
  if (cleanupFailed) return `${base} Se intentó la limpieza automática, pero no terminó correctamente. Comparte correo objetivo y hora del intento con mantenimiento técnico.`;
  if (cleanupAttempted) return `${base} Se completó la limpieza automática del intento parcial.`;
  return base;
}

function buildAuditEvent(event: StaffEventInsert): StaffEventInsert {
  return { metadata: {}, target_email: null, actor_id: null, target_profile_id: null, ...event };
}

function buildDeleteBlockedMessage(summary: StaffDeletionReferenceSummary) {
  const details = summary.references.map((reference) => `${reference.label} (${reference.count})`).join(", ");
  return `La eliminación permanente está bloqueada porque esta cuenta todavía aparece referenciada por ${details}. Desactiva la cuenta para conservar el historial.`;
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
  if (!data?.id) throw new Error(`Falta el rol base requerido para ${role}.`);
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
      throw new Error("Ya existe un usuario interno con ese correo.");
    }
    throw new Error(error.message);
  }
  if (!data.user?.id) throw new Error("No se pudo confirmar la creación del acceso.");
  return { id: data.user.id, email: data.user.email ?? input.email };
}

async function deleteAuthUser(userId: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
}

async function countRowsByProfileReference(table: string, column: string, profileId: string) {
  const admin = createSupabaseAdminClient();
  const { count, error } = await admin.from(table).select("id", { count: "exact", head: true }).eq(column, profileId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function getDeletionReferenceSummary(profileId: string): Promise<StaffDeletionReferenceSummary> {
  const references = (await Promise.all(deletionReferenceChecks.map(async (reference) => ({
    table: reference.table,
    label: reference.label,
    count: await countRowsByProfileReference(reference.table, reference.column, profileId),
  })))).filter((reference) => reference.count > 0);

  return {
    totalReferences: references.reduce((total, reference) => total + reference.count, 0),
    references,
  };
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

async function updateOwnEmail(email: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ email });
  if (error) throw new Error(error.message);
}

function mapEmailChangeError(error: unknown) {
  const message = error instanceof Error ? error.message : "No se pudo solicitar el cambio de correo.";

  if (/already|registered|exists|email.*used|duplicate|taken/i.test(message)) {
    return new Error("Ese correo no se puede usar. Intenta con otro o contacta a una persona administradora.");
  }

  return error instanceof Error ? error : new Error(message);
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

function defaultEmailChangeDeps(): EmailChangeDeps {
  return { updateOwnEmail, insertAuditEvent };
}

function defaultDeleteDeps(): DeleteDeps {
  return { getStaffSnapshot, countActiveAdminsExcluding, getDeletionReferenceSummary, deleteAuthUser, insertAuditEvent };
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
  if (!snapshot) throw new Error("No encontramos el perfil solicitado.");
  const managementState = getStaffManagementState(snapshot.roles);
  if (!managementState.isManageableInMvp) throw new Error(managementState.blockReason);

  const currentManagedRole = managementState.managedRole;
  const nextManagedRole = input.role;
  const isRoleChange = currentManagedRole !== nextManagedRole;
  const isStatusChange = snapshot.is_active !== input.is_active;
  const isSelf = snapshot.profile_id === actor.id;
  const removesAdminAccess = snapshot.is_active && snapshot.roles.includes("admin") && (!input.is_active || input.role !== "admin");

  if (isSelf && input.role !== "admin") throw new Error("No puedes quitarte tu propio rol de administración.");
  if (isSelf && !input.is_active) throw new Error("No puedes desactivar tu propia cuenta.");

  if (removesAdminAccess) {
    const otherActiveAdmins = await deps.countActiveAdminsExcluding(snapshot.profile_id);
    if (otherActiveAdmins === 0) throw new Error("Este cambio quitaría al último administrador activo.");
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

export async function deleteStaffAccount(input: DeleteStaffInput, actor: StaffActor, deps: DeleteDeps = defaultDeleteDeps()) {
  const snapshot = await deps.getStaffSnapshot(input.profile_id);
  if (!snapshot) throw new Error("No encontramos el perfil solicitado.");
  const managementState = getStaffManagementState(snapshot.roles);
  if (!managementState.isManageableInMvp) throw new Error(managementState.blockReason);
  if (snapshot.profile_id === actor.id) throw new Error("No puedes eliminar tu propia cuenta.");

  if (snapshot.is_active && snapshot.roles.includes("admin")) {
    const otherActiveAdmins = await deps.countActiveAdminsExcluding(snapshot.profile_id);
    if (otherActiveAdmins === 0) throw new Error("No puedes eliminar al último administrador activo.");
  }

  const referenceSummary = await deps.getDeletionReferenceSummary(snapshot.profile_id);
  if (referenceSummary.totalReferences > 0) throw new Error(buildDeleteBlockedMessage(referenceSummary));

  await deps.deleteAuthUser(snapshot.profile_id);
  await deps.insertAuditEvent({
    actor_id: actor.id,
    target_profile_id: null,
    target_email: snapshot.email,
    action: "staff_deleted",
    metadata: {
      deletedProfileId: snapshot.profile_id,
      deletedFullName: snapshot.full_name,
      deletedRoles: snapshot.roles,
      deletedWasActive: snapshot.is_active,
    },
  });
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

export async function requestCurrentStaffEmailChange(input: EmailChangeInput, actor: StaffActor, deps: EmailChangeDeps = defaultEmailChangeDeps()) {
  try {
    await deps.updateOwnEmail(input.email);
  } catch (error) {
    throw mapEmailChangeError(error);
  }

  await deps.insertAuditEvent({
    actor_id: actor.id,
    target_profile_id: actor.id,
    target_email: actor.email ?? null,
    action: "staff_email_change_requested",
    metadata: {
      selfService: true,
      previousEmail: actor.email ?? null,
      requestedEmail: input.email,
      status: "verification_pending",
    },
  });
}
