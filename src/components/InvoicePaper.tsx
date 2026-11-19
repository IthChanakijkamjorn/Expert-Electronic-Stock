import { unitLabel } from "@/lib/unit";
import { docHead, type DocVariant } from "@/lib/docType";
import type { DocCompany } from "@/lib/company";
import { LineCells, type PickerProduct } from "./LineCells";

export type PaperLine = {
  key: string;
  productId?: string;
  brand: string;
  model: string;
  name: string;
  unit: string;
  qty: string;
  price: string;
  hint?: string;
  over?: boolean;
};

export type PaperData = {
  number: string;
  company: DocCompany;
  customerCode: string;
  customer: string;
  address: string;
  taxId: string;
  branch: string;
  salesperson: string;
  date: string;
  vat: boolean;
  variant?: DocVariant;
  lines: PaperLine[];
};

export type PaperHandlers = {
  onField: (patch: Partial<Omit<PaperData, "lines" | "company">>) => void;
  onCompany: (patch: Partial<DocCompany>) => void;
  onLine: (key: string, patch: Partial<PaperLine>) => void;
  onRemove: (key: string) => void;
  onPick?: (key: string, p: PickerProduct) => void;
};

export const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const blank = "w-full border-0 border-b border-dashed border-sky-400 bg-sky-50 px-1 py-0.5 outline-none focus:bg-sky-100";
const MIN_ROWS = 14;

// Looks like the paper form. `h` set = editable blanks; unset = read-only text (preview, print and saved view).
export function InvoicePaper({
  data,
  h,
  salesSlot,
  editCompany = false,
  pickProducts = [],
}: {
  data: PaperData;
  salesSlot?: React.ReactNode;
  h?: PaperHandlers;
  editCompany?: boolean;
  pickProducts?: PickerProduct[];
}) {
  const co = data.company;
  const subtotal = data.lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
  const vat = data.vat ? subtotal * 0.07 : 0;
  const dateText = data.date
    ? new Date(data.date).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" })
    : "";

  const coField = (k: keyof DocCompany, cls = "") =>
    editCompany && h ? (
      <input className={`${blank} ${cls}`} value={co[k]} onChange={(e) => h.onCompany({ [k]: e.target.value })} />
    ) : (
      <span className={cls}>{co[k]}</span>
    );
  const field = (k: "customerCode" | "customer" | "address" | "taxId" | "branch" | "salesperson") =>
    h ? (
      k === "address" ? (
        <textarea rows={2} className={blank} value={data[k]} onChange={(e) => h.onField({ [k]: e.target.value })} />
      ) : (
        <input className={blank} value={data[k]} onChange={(e) => h.onField({ [k]: e.target.value })} />
      )
    ) : (
      <span className="whitespace-pre-wrap">{data[k]}</span>
    );

  const rows = Math.max(0, MIN_ROWS - data.lines.length);
  const th = "border border-black px-1 py-1 text-center text-[11px] font-bold leading-tight";
  const td = "border-x border-black px-1 py-1 align-top";

  return (
    <div className="mx-auto w-[794px] max-w-none bg-white p-7 text-[12.5px] leading-snug text-black shadow-lg print:w-full print:p-[12mm] print:shadow-none">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-16 w-16" />
        <div className="flex-1">
          <div className="text-[15px] font-bold">{coField("name")}</div>
          <div>{coField("address")}</div>
          <div>{coField("tel")}</div>
          <div className="flex gap-2">
            <span>Email:</span>
            {coField("email")}
            {coField("web")}
          </div>
        </div>
        <div className="w-[270px] border border-black text-center">
          <div className="border-b border-black py-1 text-[15px] font-bold">{docHead("ใบกำกับภาษี", "TAX INVOICE", data.variant).th}</div>
          <div className="border-b border-black py-1 text-[14px] font-bold">{docHead("ใบกำกับภาษี", "TAX INVOICE", data.variant).en}</div>
          <div className="flex items-center justify-center gap-1 px-1 py-1 text-[11px]">
            <span className="shrink-0">เลขประจำตัวผู้เสียภาษีอากร:</span>
            {coField("taxId")}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_260px] gap-x-6 gap-y-1">
        <div className="grid grid-cols-[170px_1fr] items-start gap-y-1">
          <span>รหัสลูกค้า / Customer Code:</span>
          {field("customerCode")}
          <span>ชื่อลูกค้า / Customer:</span>
          {field("customer")}
          <span>ที่อยู่ / Address:</span>
          {field("address")}
          <span>เลขประจำตัวผู้เสียภาษี:</span>
          {field("taxId")}
          <span>สาขา / Branch:</span>
          {field("branch")}
        </div>
        <div className="grid grid-cols-[90px_1fr] items-start gap-y-1">
          <span>เลขที่ / No.:</span>
          <span className="font-semibold">{data.number}</span>
          <span>วันที่ / Date:</span>
          {h ? (
            <input type="date" className={blank} value={data.date} onChange={(e) => h.onField({ date: e.target.value })} />
          ) : (
            <span>{dateText}</span>
          )}
          <span>พนักงานขาย:</span>
          {h && salesSlot ? salesSlot : field("salesperson")}
        </div>
      </div>

      <table className="mt-4 w-full border-collapse border border-black">
        <colgroup>
          <col style={{ width: 48 }} />
          <col style={{ width: 80 }} />
          <col style={{ width: 90 }} />
          <col />
          <col style={{ width: 70 }} />
          <col style={{ width: 90 }} />
          <col style={{ width: 90 }} />
        </colgroup>
        <thead className="bg-indigo-50 print:bg-transparent">
          <tr>
            <th className={th}>ลำดับที่<br />Item</th>
            <th className={th}>ยี่ห้อ<br />Brand</th>
            <th className={th}>รุ่น<br />Model</th>
            <th className={th}>รายละเอียด<br />Description</th>
            <th className={th}>จำนวน<br />Quantity</th>
            <th className={th}>ราคาต่อหน่วย<br />Unit Price</th>
            <th className={th}>จำนวนเงิน<br />Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((l, i) => (
            <tr key={l.key}>
              <td className={`${td} text-center`}>
                {i + 1}
                {h && (
                  <button type="button" title="Remove" className="block w-full text-red-600 print:hidden" onClick={() => h.onRemove(l.key)}>
                    ✕
                  </button>
                )}
              </td>
              {h ? (
                <LineCells l={l} h={h} products={pickProducts} td={td} />
              ) : (
                <>
                  <td className={td}>{l.brand}</td>
                  <td className={td}>{l.model}</td>
                  <td className={td}>{l.name}</td>
                </>
              )}
              <td className={`${td} text-center`}>
                {h ? (
                  <div className="flex items-center gap-1">
                    <input type="number" min={1} step={1} className={`${blank} text-center`} value={l.qty} onChange={(e) => h.onLine(l.key, { qty: e.target.value })} />
                  </div>
                ) : (
                  `${l.qty} ${unitLabel(l.unit)}`
                )}
              </td>
              <td className={`${td} text-right`}>
                {h ? (
                  <input type="number" min={0} step="0.01" className={`${blank} text-right`} value={l.price} onChange={(e) => h.onLine(l.key, { price: e.target.value })} />
                ) : (
                  money(Number(l.price) || 0)
                )}
              </td>
              <td className={`${td} text-right`}>{money((Number(l.qty) || 0) * (Number(l.price) || 0))}</td>
            </tr>
          ))}
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={`b${i}`}>
              {Array.from({ length: 7 }).map((__, c) => (
                <td key={c} className={`${td} h-6`} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end">
        <table className="w-[280px] border-collapse border-x border-b border-black">
          <tbody>
            <tr><td className="border border-black px-2 py-1">ราคาสินค้า (TOTAL):</td><td className="border border-black px-2 py-1 text-right">{money(subtotal)}</td></tr>
            <tr><td className="border border-black px-2 py-1">ภาษีมูลค่าเพิ่ม 7% (VAT):</td><td className="border border-black px-2 py-1 text-right">{data.vat ? money(vat) : "-"}</td></tr>
            <tr className="font-bold"><td className="border border-black px-2 py-1">ทั้งสิ้น (GRAND TOTAL):</td><td className="border border-black px-2 py-1 text-right">{money(subtotal + vat)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="border border-black px-2 py-1 text-center text-[11px]">
        <p>สินค้าและบริการนี้เป็นกรรมสิทธิ์ของบริษัท เอ็กซ์เพิร์ท อีเล็คโทรนิค แอนด์ คอมมูนิเคชั่น จำกัด จนกว่าผู้ซื้อจะชำระเงินครบตามจำนวน</p>
        <p>เมื่อท่านชำระเงินเรียบร้อยแล้ว ทางบริษัทจะออกใบเสร็จรับเงินให้</p>
        <p>(The receipt will be issued upon cash received or cheque cleared.)</p>
      </div>
      <div className="flex items-center gap-3 border-x border-b border-black px-2 py-2 font-bold">
        <span className="shrink-0">ชำระโดย / PAID BY:</span>
        {coField("bank", "flex-1")}
      </div>
      <div className="grid h-24 grid-cols-4 border-x border-b border-black text-center text-[11px] font-bold">
        {[
          ["ผู้รับสินค้า", "RECEIVED BY"],
          ["ผู้ส่งสินค้า", "DELIVERED BY"],
          ["ผู้รับเงิน", "COLLECTED BY"],
          ["ผู้มีอำนาจลงนาม", "AUTHORIZED SIGNATURE"],
        ].map(([a, b], i) => (
          <div key={a} className={`flex flex-col justify-end pb-1 ${i ? "border-l border-black" : ""}`}>
            <span>{a}</span>
            <span className="text-[10px]">{b}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
