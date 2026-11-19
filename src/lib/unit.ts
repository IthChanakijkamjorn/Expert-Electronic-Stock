// Legacy pc/pcs units are shown as ชิ้น.
export const unitLabel = (u: string) => (/^pcs?$/i.test(u.trim()) ? "ชิ้น" : u);
