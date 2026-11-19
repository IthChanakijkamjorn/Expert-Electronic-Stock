// Quantities read "1 pc", "3 pc": the unit is not pluralised.
export const unitLabel = (u: string) => (u.trim().toLowerCase() === "pcs" ? "pc" : u);
