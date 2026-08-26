import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildStaffAuthCreatePayload,
  changeCurrentStaffPassword,
  createStaffAccount,
  deleteStaffAccount,
  getAdvisorCapableStaffFromRows,
  requestCurrentStaffEmailChange,
  updateStaffAccount,
  type StaffActor,
} from "@/lib/admin/staff";
import { staffRoleLabel } from "@/lib/admin/staff-view";
import { requireAdminRole } from "@/lib/admin/auth";

const actor: StaffActor = { id: "actor-1", email: "admin@example.com", roles: ["admin"] };

function deniedActions() {
  return {
    redirect: (path: string): never => { throw new Error(`redirect:${path}`); },
    notFound: (): never => { throw new Error("not-found"); },
  };
}

test("staff mutation authorization denies Manager-only and Manager plus non-Admin sessions", async () => {
  for (const roles of [["manager"], ["manager", "asesor"]] as const) {
    await assert.rejects(() => requireAdminRole(["admin"], async () => ({
      user: { id: "manager-actor" },
      profile: { id: "manager-actor", full_name: "Manager", is_active: true },
      roles: [...roles],
    }), deniedActions()), /not-found/);
  }
});

test("createStaffAccount provisions auth/profile/role/audit without leaking password", async () => {
  const calls: string[] = [];
  const result = await createStaffAccount({
    email: "ada@example.com",
    full_name: "Ada Lovelace",
    role: "admin",
    is_active: true,
    initial_password: "Str0ng!Password",
  }, actor, {
    getManagedRoleId: async () => "role-admin",
    createAuthUser: async (input) => {
      calls.push(`createAuth:${input.email}`);
      assert.equal("initial_password" in input, false);
      return { id: "user-1", email: input.email };
    },
    upsertProfile: async (profile) => {
      calls.push(`profile:${profile.id}`);
    },
    replaceProfileRole: async ({ profileId, roleId }) => {
      calls.push(`role:${profileId}:${roleId}`);
    },
    insertAuditEvent: async (event) => {
      calls.push(`audit:${event.action}`);
      assert.equal(JSON.stringify(event.metadata).includes("Str0ng!Password"), false);
    },
    deleteAuthUser: async () => {
      throw new Error("cleanup should not run");
    },
  });

  assert.deepEqual(calls, [
    "createAuth:ada@example.com",
    "profile:user-1",
    "role:user-1:role-admin",
    "audit:staff_created",
  ]);
  assert.equal(result.userId, "user-1");
});

test("Admin can create a Manager account and preserve its audit role payload", async () => {
  const calls: string[] = [];

  await createStaffAccount({
    email: "manager@example.com",
    full_name: "Grace Manager",
    role: "manager",
    is_active: true,
    initial_password: "Str0ng!Password",
  }, actor, {
    getManagedRoleId: async (role) => {
      assert.equal(role, "manager");
      return "role-manager";
    },
    createAuthUser: async () => ({ id: "manager-1", email: "manager@example.com" }),
    upsertProfile: async () => undefined,
    replaceProfileRole: async ({ roleId }) => { calls.push(`role:${roleId}`); },
    insertAuditEvent: async (event) => {
      calls.push(`audit:${event.action}`);
      assert.deepEqual(event.metadata, { role: "manager", isActive: true });
    },
    deleteAuthUser: async () => undefined,
  });

  assert.deepEqual(calls, ["role:role-manager", "audit:staff_created"]);
});

test("Admin can edit and display Manager while Manager combinations stay read-only", async () => {
  const calls: string[] = [];

  await updateStaffAccount({
    profile_id: "manager-1",
    full_name: "Grace Manager Updated",
    role: "manager",
    is_active: true,
  }, actor, {
    getManagedRoleId: async (role) => {
      assert.equal(role, "manager");
      return "role-manager";
    },
    getStaffSnapshot: async () => ({
      profile_id: "manager-1",
      full_name: "Grace Manager",
      is_active: true,
      roles: ["manager"],
      email: "manager@example.com",
    }),
    countActiveAdminsExcluding: async () => 1,
    updateProfile: async () => { calls.push("profile"); },
    replaceProfileRole: async () => { calls.push("role"); },
    insertAuditEvent: async (event) => { calls.push(`audit:${event.action}`); },
  });

  assert.deepEqual(calls, ["profile", "role", "audit:staff_updated"]);
  assert.equal(staffRoleLabel("manager"), "Gerencia");

  await assert.rejects(() => updateStaffAccount({
    profile_id: "manager-asesor",
    full_name: "Combined Role",
    role: "manager",
    is_active: true,
  }, actor, {
    getManagedRoleId: async () => {
      throw new Error("role lookup should not run");
    },
    getStaffSnapshot: async () => ({
      profile_id: "manager-asesor",
      full_name: "Combined Role",
      is_active: true,
      roles: ["manager", "asesor"],
      email: "combined@example.com",
    }),
    countActiveAdminsExcluding: async () => 1,
    updateProfile: async () => {
      throw new Error("profile update should not run");
    },
    replaceProfileRole: async () => undefined,
    insertAuditEvent: async () => undefined,
  }), /gestión con rol único/i);
});

test("createStaffAccount compensates auth user when downstream write fails", async () => {
  const cleanup: string[] = [];

  await assert.rejects(() => createStaffAccount({
    email: "ada@example.com",
    full_name: "Ada Lovelace",
    role: "asesor",
    is_active: true,
    initial_password: "Str0ng!Password",
  }, actor, {
    getManagedRoleId: async () => "role-asesor",
    createAuthUser: async () => ({ id: "user-2", email: "ada@example.com" }),
    upsertProfile: async () => {
      throw new Error("profile write failed");
    },
    replaceProfileRole: async () => undefined,
    insertAuditEvent: async () => undefined,
    deleteAuthUser: async (userId) => {
      cleanup.push(userId);
    },
  }), /limpieza automática/i);

  assert.deepEqual(cleanup, ["user-2"]);
});

test("updateStaffAccount blocks self-demotion and last-admin removal", async () => {
  await assert.rejects(() => updateStaffAccount({
    profile_id: "actor-1",
    full_name: "Admin",
    role: "asesor",
    is_active: true,
  }, actor, {
    getManagedRoleId: async () => "role-asesor",
    getStaffSnapshot: async () => ({
      profile_id: "actor-1",
      full_name: "Admin",
      is_active: true,
      roles: ["admin"],
      email: "admin@example.com",
    }),
    countActiveAdminsExcluding: async () => 1,
    updateProfile: async () => undefined,
    replaceProfileRole: async () => undefined,
    insertAuditEvent: async () => undefined,
  }), /propio rol de administración/i);

  await assert.rejects(() => updateStaffAccount({
    profile_id: "user-2",
    full_name: "Only Admin",
    role: "asesor",
    is_active: true,
  }, actor, {
    getManagedRoleId: async () => "role-asesor",
    getStaffSnapshot: async () => ({
      profile_id: "user-2",
      full_name: "Only Admin",
      is_active: true,
      roles: ["admin"],
      email: "only@example.com",
    }),
    countActiveAdminsExcluding: async () => 0,
    updateProfile: async () => undefined,
    replaceProfileRole: async () => undefined,
    insertAuditEvent: async () => undefined,
  }), /último administrador activo/i);
});

test("deleteStaffAccount hard deletes a reference-free account and audits the action", async () => {
  const calls: string[] = [];

  await deleteStaffAccount({
    profile_id: "user-3",
  }, actor, {
    getStaffSnapshot: async () => ({
      profile_id: "user-3",
      full_name: "Grace Hopper",
      is_active: true,
      roles: ["asesor"],
      email: "grace@example.com",
    }),
    countActiveAdminsExcluding: async () => 1,
    getDeletionReferenceSummary: async () => ({ totalReferences: 0, references: [] }),
    insertAuditEvent: async (event) => {
      calls.push(`audit:${event.action}`);
      assert.equal(event.target_profile_id, null);
      assert.equal(event.target_email, "grace@example.com");
      assert.match(JSON.stringify(event.metadata), /Grace Hopper/);
    },
    deleteAuthUser: async (userId) => {
      calls.push(`delete:${userId}`);
    },
  });

  assert.deepEqual(calls, ["delete:user-3", "audit:staff_deleted"]);
});

test("deleteStaffAccount blocks self-delete, last-admin delete, and referenced accounts", async () => {
  await assert.rejects(() => deleteStaffAccount({
    profile_id: "actor-1",
  }, actor, {
    getStaffSnapshot: async () => ({
      profile_id: "actor-1",
      full_name: "Admin",
      is_active: true,
      roles: ["admin"],
      email: "admin@example.com",
    }),
    countActiveAdminsExcluding: async () => 1,
    getDeletionReferenceSummary: async () => ({ totalReferences: 0, references: [] }),
    insertAuditEvent: async () => undefined,
    deleteAuthUser: async () => undefined,
  }), /eliminar tu propia cuenta/i);

  await assert.rejects(() => deleteStaffAccount({
    profile_id: "user-last-admin",
  }, actor, {
    getStaffSnapshot: async () => ({
      profile_id: "user-last-admin",
      full_name: "Only Admin",
      is_active: true,
      roles: ["admin"],
      email: "only@example.com",
    }),
    countActiveAdminsExcluding: async () => 0,
    getDeletionReferenceSummary: async () => ({ totalReferences: 0, references: [] }),
    insertAuditEvent: async () => undefined,
    deleteAuthUser: async () => undefined,
  }), /último administrador activo/i);

  await assert.rejects(() => deleteStaffAccount({
    profile_id: "user-referenced",
  }, actor, {
    getStaffSnapshot: async () => ({
      profile_id: "user-referenced",
      full_name: "Referenced User",
      is_active: false,
      roles: ["asesor"],
      email: "referenced@example.com",
    }),
    countActiveAdminsExcluding: async () => 1,
    getDeletionReferenceSummary: async () => ({
      totalReferences: 2,
      references: [
        { table: "leads", label: "Leads", count: 1 },
        { table: "payments", label: "Payments", count: 1 },
      ],
    }),
    insertAuditEvent: async () => undefined,
    deleteAuthUser: async () => undefined,
  }), /desactiva la cuenta/i);
});

test("deleteStaffAccount refuses staff records outside the MVP single-role management scope", async () => {
  await assert.rejects(() => deleteStaffAccount({
    profile_id: "user-mixed",
  }, actor, {
    getStaffSnapshot: async () => ({
      profile_id: "user-mixed",
      full_name: "Mixed Roles",
      is_active: true,
      roles: ["admin", "marketing"],
      email: "mixed@example.com",
    }),
    countActiveAdminsExcluding: async () => 1,
    getDeletionReferenceSummary: async () => ({ totalReferences: 0, references: [] }),
    insertAuditEvent: async () => {
      throw new Error("audit should not run");
    },
    deleteAuthUser: async () => {
      throw new Error("delete should not run");
    },
  }), /alcance MVP/i);
});

test("updateStaffAccount refuses staff records outside the MVP single-role management scope", async () => {
  await assert.rejects(() => updateStaffAccount({
    profile_id: "user-mixed",
    full_name: "Mixed Roles",
    role: "admin",
    is_active: true,
  }, actor, {
    getManagedRoleId: async () => "role-admin",
    getStaffSnapshot: async () => ({
      profile_id: "user-mixed",
      full_name: "Mixed Roles",
      is_active: true,
      roles: ["admin", "marketing"],
      email: "mixed@example.com",
    }),
    countActiveAdminsExcluding: async () => 1,
    updateProfile: async () => undefined,
    replaceProfileRole: async () => undefined,
    insertAuditEvent: async () => undefined,
  }), /alcance MVP/i);

  await assert.rejects(() => updateStaffAccount({
    profile_id: "user-multi",
    full_name: "Dual Role",
    role: "admin",
    is_active: true,
  }, actor, {
    getManagedRoleId: async () => "role-admin",
    getStaffSnapshot: async () => ({
      profile_id: "user-multi",
      full_name: "Dual Role",
      is_active: true,
      roles: ["admin", "asesor"],
      email: "dual@example.com",
    }),
    countActiveAdminsExcluding: async () => 1,
    updateProfile: async () => undefined,
    replaceProfileRole: async () => undefined,
    insertAuditEvent: async () => undefined,
  }), /gestión con rol único/i);
});

test("buildStaffAuthCreatePayload keeps auth creation independent from app-level active status", () => {
  const activePayload = buildStaffAuthCreatePayload({
    email: "ada@example.com",
    password: "Str0ng!Password",
    full_name: "Ada Lovelace",
    is_active: true,
  });
  const inactivePayload = buildStaffAuthCreatePayload({
    email: "ada@example.com",
    password: "Str0ng!Password",
    full_name: "Ada Lovelace",
    is_active: false,
  });

  assert.equal(activePayload.email_confirm, true);
  assert.deepEqual(activePayload.user_metadata, { full_name: "Ada Lovelace" });
  assert.equal("ban_duration" in activePayload, false);
  assert.equal("ban_duration" in inactivePayload, false);
  assert.deepEqual(inactivePayload, activePayload);
});

test("changeCurrentStaffPassword audits self-service password changes without storing the password", async () => {
  const auditPayloads: string[] = [];
  await changeCurrentStaffPassword({ password: "An0ther!StrongPwd" }, actor, {
    updateOwnPassword: async (password) => {
      assert.equal(password, "An0ther!StrongPwd");
    },
    insertAuditEvent: async (event) => {
      auditPayloads.push(JSON.stringify(event));
    },
  });

  assert.equal(auditPayloads.length, 1);
  assert.equal(auditPayloads[0].includes("An0ther!StrongPwd"), false);
  assert.match(auditPayloads[0], /staff_password_changed/);
});

test("requestCurrentStaffEmailChange updates auth email first and audits a pending request", async () => {
  const calls: string[] = [];

  await requestCurrentStaffEmailChange({ email: "new.admin@example.com" }, actor, {
    updateOwnEmail: async (email) => {
      calls.push(`email:${email}`);
    },
    insertAuditEvent: async (event) => {
      calls.push(`audit:${event.action}`);
      assert.equal(event.actor_id, actor.id);
      assert.equal(event.target_profile_id, actor.id);
      assert.equal(event.target_email, actor.email);
      assert.deepEqual(event.metadata, {
        selfService: true,
        previousEmail: actor.email,
        requestedEmail: "new.admin@example.com",
        status: "verification_pending",
      });
      assert.equal(JSON.stringify(event).includes("token"), false);
    },
  });

  assert.deepEqual(calls, ["email:new.admin@example.com", "audit:staff_email_change_requested"]);
});

test("requestCurrentStaffEmailChange returns a generic unavailable-email message for duplicate auth errors", async () => {
  await assert.rejects(() => requestCurrentStaffEmailChange({ email: "taken@example.com" }, actor, {
    updateOwnEmail: async () => {
      throw new Error("User already registered");
    },
    insertAuditEvent: async () => {
      throw new Error("audit should not run");
    },
  }), /ese correo no se puede usar/i);
});

test("advisor helper keeps only active admin and asesor rows without duplicates", () => {
  const advisors = getAdvisorCapableStaffFromRows([
    { id: "1", full_name: "Ada", is_active: true, roles: ["admin"] },
    { id: "1", full_name: "Ada", is_active: true, roles: ["asesor"] },
    { id: "2", full_name: "Grace", is_active: true, roles: ["marketing"] },
    { id: "3", full_name: "Linus", is_active: false, roles: ["asesor"] },
    { id: "4", full_name: "Margaret", is_active: true, roles: ["asesor"] },
  ]);

  assert.deepEqual(advisors, [
    { id: "1", full_name: "Ada" },
    { id: "4", full_name: "Margaret" },
  ]);
});

test("staff routes and client boundaries enforce admin-only management", () => {
  const staffModule = readFileSync("lib/admin/staff.ts", "utf8");
  const staffActions = readFileSync("app/admin/(protected)/staff/actions.ts", "utf8");
  const editForm = readFileSync("components/admin/staff/staff-action-forms.tsx", "utf8");
  const staffView = readFileSync("lib/admin/staff-view.ts", "utf8");
  const staffActionState = readFileSync("app/admin/(protected)/staff/action-state.ts", "utf8");
  const createForm = readFileSync("components/admin/staff/staff-create-form.tsx", "utf8");
  const list = readFileSync("components/admin/staff/staff-list.tsx", "utf8");
  const accountPage = readFileSync("app/admin/(protected)/account/page.tsx", "utf8");
  const accountActions = readFileSync("app/admin/(protected)/account/actions.ts", "utf8");
  const accountActionState = readFileSync("app/admin/(protected)/account/action-state.ts", "utf8");
  const emailForm = readFileSync("components/admin/account/email-change-form.tsx", "utf8");
  const leads = readFileSync("lib/admin/leads.ts", "utf8");
  const operations = readFileSync("lib/admin/operations.ts", "utf8");

  assert.match(staffActions, /deleteStaffAction/);
  assert.match(staffActions, /createStaffAction[\s\S]*requireAdminRole\(\["admin"\]\)/);
  assert.match(staffActions, /updateStaffAction[\s\S]*requireAdminRole\(\["admin"\]\)/);
  assert.match(staffActions, /deleteStaffAction[\s\S]*requireAdminRole\(\["admin"\]\)/);
  assert.match(createForm, /<option value="manager">Gerencia<\/option>/);
  assert.match(editForm, /<option value="manager">Gerencia<\/option>/);
  assert.match(staffView, /role === "manager".*Gerencia/);
  assert.match(staffActionState, /StaffDeleteActionState/);
  assert.match(accountActions, /requireAdminRole\(\)/);
  assert.match(accountActions, /requestEmailChangeAction/);
  assert.match(accountActionState, /initialEmailChangeActionState/);
  assert.match(emailForm, /useActionState\(requestEmailChangeAction, initialEmailChangeActionState\)/);
  assert.match(accountPage, /Mi cuenta/);
  assert.match(accountPage, /Correo de acceso actual/);
  assert.match(accountPage, /<EmailChangeForm\s*\/?>/);
  assert.doesNotMatch(createForm, /createSupabaseAdminClient/);
  assert.doesNotMatch(list, /createSupabaseAdminClient/);
  assert.doesNotMatch(emailForm, /createSupabaseAdminClient/);
  assert.match(list, /staff\.is_manageable_in_mvp \? \(/);
  assert.match(list, /Eliminación no disponible/);
  assert.match(list, /Eliminar/);
  assert.match(leads, /getAdvisorCapableStaff/);
  assert.match(operations, /getAdvisorCapableStaff/);
  assert.match(staffModule, /notification_logs[\s\S]*last_retried_by/);
  assert.match(staffModule, /notification_logs[\s\S]*incident_updated_by/);
  assert.match(staffModule, /sheet_sync_logs[\s\S]*last_retried_by/);
  assert.match(staffModule, /sheet_sync_logs[\s\S]*incident_updated_by/);
  assert.match(staffModule, /staff_email_change_requested/);
  assert.doesNotMatch(staffModule, /auth\.admin\.updateUserById/);
});
