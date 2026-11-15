"use server";

import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/role";
import { logAudit } from "@/lib/audit";

const DOMAIN = "expertelectronic.co.th";
const ROLES = ["admin", "manager", "staff"];
export type UserState = { error?: string; ok?: boolean } | null;

async function requireAdmin() {
  if ((await getRole()) !== "admin") throw new Error("admin only");
}

export async function createUser(_prev: UserState, formData: FormData): Promise<UserState> {
  await requireAdmin();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim() || username;
  const role = String(formData.get("role") ?? "staff");
  if (!/^[a-z0-9._-]{2,30}$/.test(username) || password.length < 10 || !ROLES.includes(role)) {
    return { error: "invalid" };
  }
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: `${username}@${DOMAIN}`,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) return { error: "failed" };
  await admin.from("profiles").update({ role, full_name: fullName }).eq("id", data.user.id);
  await logAudit("create_user", "user", `${username} (${role})`);
  revalidatePath("/users");
  return { ok: true };
}

export async function setRole(userId: string, role: string) {
  await requireAdmin();
  if (!ROLES.includes(role)) throw new Error("bad role");
  const supabase = await createClient();
  const { data: me } = await supabase.auth.getClaims();
  if (me?.claims.sub === userId) throw new Error("cannot change own role");
  const { data: target } = await supabase.from("profiles").select("full_name").eq("id", userId).single();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) throw new Error(error.message);
  await logAudit("change_role", "user", `${target?.full_name} → ${role}`);
  revalidatePath("/users");
}

export async function resetPassword(userId: string, password: string) {
  await requireAdmin();
  if (password.length < 10) throw new Error("too short");
  const { error } = await adminClient().auth.admin.updateUserById(userId, { password });
  if (error) throw new Error(error.message);
  await logAudit("reset_password", "user", userId);
}

export async function setDisabled(userId: string, disabled: boolean) {
  await requireAdmin();
  const supabase = await createClient();
  const { data: me } = await supabase.auth.getClaims();
  if (me?.claims.sub === userId) throw new Error("cannot disable yourself");
  const { error } = await adminClient().auth.admin.updateUserById(userId, {
    ban_duration: disabled ? "876000h" : "none",
  });
  if (error) throw new Error(error.message);
  await logAudit(disabled ? "disable_user" : "enable_user", "user", userId);
  revalidatePath("/users");
}
