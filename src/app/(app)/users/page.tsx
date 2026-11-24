import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import { CreateUserForm, UserRow } from "./UserForms";

export default async function UsersPage() {
  if ((await getRole()) !== "admin") notFound();
  const { t } = await getDictionary();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const [{ data: profiles }, listed] = await Promise.all([
    supabase.from("profiles").select("id, full_name, role").order("full_name"),
    adminClient().auth.admin.listUsers({ perPage: 200 }),
  ]);
  const banned = new Map(listed.data.users.map((u) => [u.id, !!u.banned_until && new Date(u.banned_until) > new Date()]));
  const l = {
    addUser: t.addUser, username: t.username, fullName: t.fullName, password: t.password, role: t.role,
    staff: t.roles.staff, manager: t.roles.manager, admin: t.roles.admin, saveFailed: t.saveFailed, save: t.save,
    newPassword: t.newPassword, resetPassword: t.resetPassword, enable: t.enableUser, disable: t.disableUser,
  };
  return (
    <section className="flex flex-col gap-6">
      <h1 className="page-title">{t.users}</h1>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="card p-4">
          <ul className="divide-y divide-[#ece8f2] text-sm">
            {(profiles ?? []).map((p) => (
              <UserRow key={p.id} id={p.id} name={p.full_name ?? p.id} role={p.role} disabled={banned.get(p.id) ?? false} isSelf={p.id === claims?.claims.sub} l={l} />
            ))}
          </ul>
        </div>
        <CreateUserForm l={l} />
      </div>
    </section>
  );
}
