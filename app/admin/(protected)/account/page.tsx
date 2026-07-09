import { PasswordChangeForm } from "@/components/admin/account/password-change-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminRole } from "@/lib/admin/auth";

export default async function AccountPage() {
  const session = await requireAdminRole();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ac-blue)]">Cuenta</p>
        <h1 className="mt-2 text-3xl font-bold">Security</h1>
        <p className="mt-2 text-muted-foreground">Signed in as {session.profile.full_name || session.user.email}. Update your own password here.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordChangeForm />
        </CardContent>
      </Card>
    </main>
  );
}
