// "1 pc", "3 pcs": only the pc/pcs unit changes with the quantity.
export const unitLabel = (u: string, qty: number | string) =>
  ["pc", "pcs"].includes(u.trim().toLowerCase()) ? (Number(qty) > 1 ? "pcs" : "pc") : u;
