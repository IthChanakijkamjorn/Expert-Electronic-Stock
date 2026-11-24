// "BOSE AM40 Pro" -> { brand: "BOSE", model: "AM40 Pro" }. Quick-create needs both, so one word gives null.
export function splitBrandModel(typed: string) {
  const [brand, ...rest] = typed.trim().split(/\s+/);
  const model = rest.join(" ");
  return brand && model ? { brand, model } : null;
}

// The name, unless it is only the "Brand Model" fallback that a label already shows.
export const nameBeyond = (p: { name: string; brand?: string | null; model: string | null }) =>
  p.name.trim().toLowerCase() === `${p.brand ?? ""} ${p.model ?? ""}`.trim().toLowerCase() ? "" : p.name;
