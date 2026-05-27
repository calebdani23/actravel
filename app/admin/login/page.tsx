import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { getAdminSession } from "@/lib/admin/auth";
import { redirect } from "next/navigation";

export default async function AdminLoginPage() {
  const session = await getAdminSession();
  if (session) redirect("/admin/dashboard");

  return (
    <main className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-6 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Acceso admin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>Ingresa con una cuenta interna activa de Supabase.</p>
          <AdminLoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
