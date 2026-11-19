// Short numeric passwords (4-9 digits) are allowed. They are combined with a secret server-side pepper before reaching
// Supabase, so the stored password is long. Changing PIN_PEPPER later invalidates every PIN.
export const isPin = (p: string) => /^\d{4,9}$/.test(p);

export const validPassword = (p: string) => p.length >= 10 || isPin(p);

export function effectivePassword(p: string) {
  if (!isPin(p)) return p;
  const pepper = process.env.PIN_PEPPER;
  if (!pepper || pepper.length < 32) throw new Error("PIN_PEPPER must be set (32+ characters)");
  return `${p}#${pepper}`;
}
