import { z } from "zod";

export const managedStaffRoleValues = ["admin", "manager", "asesor"] as const;

const managedStaffRoleSchema = z.enum(managedStaffRoleValues);
const normalizedEmailSchema = z.string().trim().toLowerCase().email().max(180);
const fullNameSchema = z.string().trim().min(2).max(120);
const passwordSchema = z.string()
  .min(12, "Password must be at least 12 characters")
  .max(200, "Password is too long")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[0-9]/, "Password must include a number")
  .regex(/[^A-Za-z0-9]/, "Password must include a symbol");

const createStaffSchema = z.object({
  email: normalizedEmailSchema,
  full_name: fullNameSchema,
  role: managedStaffRoleSchema,
  is_active: z.boolean(),
  initial_password: passwordSchema,
  confirm_initial_password: z.string(),
}).superRefine((value, ctx) => {
  if (value.initial_password !== value.confirm_initial_password) {
    ctx.addIssue({ code: "custom", path: ["confirm_initial_password"], message: "Passwords must match" });
  }
});

const updateStaffSchema = z.object({
  profile_id: z.string().uuid(),
  full_name: fullNameSchema,
  role: managedStaffRoleSchema,
  is_active: z.boolean(),
});

const deleteStaffSchema = z.object({
  profile_id: z.string().uuid(),
});

const passwordChangeSchema = z.object({
  new_password: passwordSchema,
  confirm_new_password: z.string(),
}).superRefine((value, ctx) => {
  if (value.new_password !== value.confirm_new_password) {
    ctx.addIssue({ code: "custom", path: ["confirm_new_password"], message: "Passwords must match" });
  }
});

const emailChangeSchema = z.object({
  email: normalizedEmailSchema,
  confirm_email: normalizedEmailSchema,
}).superRefine((value, ctx) => {
  if (value.email !== value.confirm_email) {
    ctx.addIssue({ code: "custom", path: ["confirm_email"], message: "Emails must match" });
  }
});

export type ManagedStaffRole = (typeof managedStaffRoleValues)[number];
export type CreateStaffInput = z.infer<typeof createStaffSchema> extends infer T ? Omit<T & object, "confirm_initial_password"> : never;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
export type DeleteStaffInput = z.infer<typeof deleteStaffSchema>;
export type PasswordChangeInput = { password: string };
export type EmailChangeInput = { email: string };

type ValidationFailure<TValues> = {
  success: false;
  error: z.ZodError;
  fieldErrors: Record<string, string[]>;
  values: TValues;
};

type ValidationSuccess<TData> = { success: true; data: TData };

function checkboxValue(value: FormDataEntryValue | null) {
  return value === "on" || value === "true" || value === "1";
}

function flatten<TValues>(result: z.ZodSafeParseError<unknown>, values: TValues): ValidationFailure<TValues> {
  return {
    success: false,
    error: result.error,
    fieldErrors: result.error.flatten().fieldErrors,
    values,
  };
}

export function parseCreateStaffFormData(formData: FormData): ValidationSuccess<CreateStaffInput> | ValidationFailure<Pick<CreateStaffInput, "email" | "full_name" | "role" | "is_active">> {
  const raw = {
    email: typeof formData.get("email") === "string" ? String(formData.get("email")) : "",
    full_name: typeof formData.get("full_name") === "string" ? String(formData.get("full_name")) : "",
    role: typeof formData.get("role") === "string" ? String(formData.get("role")) : "",
    is_active: checkboxValue(formData.get("is_active")),
    initial_password: typeof formData.get("initial_password") === "string" ? String(formData.get("initial_password")) : "",
    confirm_initial_password: typeof formData.get("confirm_initial_password") === "string" ? String(formData.get("confirm_initial_password")) : "",
  };
  const parsed = createStaffSchema.safeParse(raw);
  if (!parsed.success) {
    return flatten(parsed, {
      email: raw.email.trim().toLowerCase(),
      full_name: raw.full_name.trim(),
      role: raw.role as ManagedStaffRole,
      is_active: raw.is_active,
    });
  }

  return {
    success: true,
    data: {
      email: parsed.data.email,
      full_name: parsed.data.full_name,
      role: parsed.data.role,
      is_active: parsed.data.is_active,
      initial_password: parsed.data.initial_password,
    },
  };
}

export function parseUpdateStaffFormData(formData: FormData): ValidationSuccess<UpdateStaffInput> | ValidationFailure<UpdateStaffInput> {
  const raw: UpdateStaffInput = {
    profile_id: typeof formData.get("profile_id") === "string" ? String(formData.get("profile_id")) : "",
    full_name: typeof formData.get("full_name") === "string" ? String(formData.get("full_name")) : "",
    role: (typeof formData.get("role") === "string" ? String(formData.get("role")) : "admin") as ManagedStaffRole,
    is_active: checkboxValue(formData.get("is_active")),
  };
  const parsed = updateStaffSchema.safeParse(raw);
  if (!parsed.success) return flatten(parsed, { ...raw, full_name: raw.full_name.trim() });
  return { success: true, data: parsed.data };
}

export function parseDeleteStaffFormData(formData: FormData): ValidationSuccess<DeleteStaffInput> | ValidationFailure<DeleteStaffInput> {
  const raw: DeleteStaffInput = {
    profile_id: typeof formData.get("profile_id") === "string" ? String(formData.get("profile_id")) : "",
  };
  const parsed = deleteStaffSchema.safeParse(raw);
  if (!parsed.success) return flatten(parsed, raw);
  return { success: true, data: parsed.data };
}

export function parsePasswordChangeFormData(formData: FormData): ValidationSuccess<PasswordChangeInput> | ValidationFailure<Record<string, never>> {
  const raw = {
    new_password: typeof formData.get("new_password") === "string" ? String(formData.get("new_password")) : "",
    confirm_new_password: typeof formData.get("confirm_new_password") === "string" ? String(formData.get("confirm_new_password")) : "",
  };
  const parsed = passwordChangeSchema.safeParse(raw);
  if (!parsed.success) return flatten(parsed, {});
  return { success: true, data: { password: parsed.data.new_password } };
}

export function parseEmailChangeFormData(formData: FormData): ValidationSuccess<EmailChangeInput> | ValidationFailure<EmailChangeInput & { confirm_email: string }> {
  const raw = {
    email: typeof formData.get("email") === "string" ? String(formData.get("email")) : "",
    confirm_email: typeof formData.get("confirm_email") === "string" ? String(formData.get("confirm_email")) : "",
  };
  const parsed = emailChangeSchema.safeParse(raw);
  if (!parsed.success) {
    return flatten(parsed, {
      email: raw.email.trim().toLowerCase(),
      confirm_email: raw.confirm_email.trim().toLowerCase(),
    });
  }

  return { success: true, data: { email: parsed.data.email } };
}
