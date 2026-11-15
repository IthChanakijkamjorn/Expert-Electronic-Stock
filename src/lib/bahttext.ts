const D = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const P = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

function chunk(n: number, hasHigher: boolean) {
  const s = String(n);
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const d = Number(s[i]);
    const pos = s.length - i - 1;
    if (d === 0) continue;
    if (pos === 1) out += (d === 1 ? "" : d === 2 ? "ยี่" : D[d]) + P[1];
    else if (pos === 0) out += d === 1 && (s.length > 1 || hasHigher) ? "เอ็ด" : D[d];
    else out += D[d] + P[pos];
  }
  return out;
}

function integerText(n: number): string {
  if (n === 0) return D[0];
  const high = Math.floor(n / 1_000_000);
  const low = n % 1_000_000;
  return (high ? integerText(high) + "ล้าน" : "") + (low ? chunk(low, high > 0) : "");
}

// 1234.5 -> "หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบสตางค์"
export function bahtText(amount: number) {
  const satangTotal = Math.round(Math.abs(amount) * 100);
  const baht = Math.floor(satangTotal / 100);
  const satang = satangTotal % 100;
  const bahtPart = integerText(baht) + "บาท";
  return satang === 0 ? bahtPart + "ถ้วน" : bahtPart + integerText(satang) + "สตางค์";
}
