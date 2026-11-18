import type { ReactNode } from "react";
import type { DocCompany } from "@/lib/company";
import { bahtText } from "@/lib/bahttext";
import { blank, money, type PaperLine } from "@/components/InvoicePaper";
import { LineCells, type PickerProduct } from "./LineCells";

export type QuotePaperData = {
  number: string;
  company: DocCompany;
  customer: string;
  attention: string;
  project: string;
  phone: string;
  email: string;
  date: string;
  validDays: string;
  leadDays: string;
  warrantyYears: string;
  quotedBy: string;
  paymentTerms: string;
  discountPct: string;
  vat: boolean;
  signatureUrl: string | null;
  lines: PaperLine[];
};

type TextKey = "customer" | "attention" | "project" | "phone" | "email" | "validDays" | "leadDays" | "warrantyYears" | "quotedBy" | "paymentTerms" | "discountPct";

export type QuoteHandlers = {
  onField: (patch: Partial<QuotePaperData>) => void;
  onCompany: (patch: Partial<DocCompany>) => void;
  onLine: (key: string, patch: Partial<PaperLine>) => void;
  onRemove: (key: string) => void;
  onPick?: (key: string, p: PickerProduct) => void;
};

const MIN_ROWS = 12;

// On-screen quotation form. `h` set = editable blanks; unset = read-only (preview, print, saved view).
export function QuotationPaper({
  data,
  h,
  salesSlot,
  editCompany = false,
  pickProducts = [],
}: {
  data: QuotePaperData;
  salesSlot?: ReactNode;
  h?: QuoteHandlers;
  editCompany?: boolean;
  pickProducts?: PickerProduct[];
}) {
  const co = data.company;
  const factor = 1 - (Number(data.discountPct) || 0) / 100;
  const gross = data.lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0) * factor, 0);
  const vat = data.vat ? gross * 0.07 : 0;
  const total = gross + vat;
  const dateText = data.date
    ? new Date(data.date).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" })
    : "";

  const coField = (k: keyof DocCompany, cls = "") =>
    editCompany && h ? (
      <input className={`${blank} ${cls}`} value={co[k]} onChange={(e) => h.onCompany({ [k]: e.target.value })} />
    ) : (
      <span className={cls}>{co[k]}</span>
    );
  const field = (k: TextKey, type: "text" | "number" = "text") =>
    h ? (
      <input type={type} min={type === "number" ? 0 : undefined} className={blank} value={data[k]} onChange={(e) => h.onField({ [k]: e.target.value })} />
    ) : (
      <span>{data[k]}</span>
    );

  const th = "border border-black px-1 py-1 text-center text-[11px] font-bold leading-tight";
  const td = "border-x border-black px-1 py-1 align-top";
  const rows = Math.max(0, MIN_ROWS - data.lines.length);
  const discount = Number(data.discountPct) || 0;

  return (
    <div className="mx-auto w-[794px] max-w-none bg-white p-7 text-[12.5px] leading-snug text-black shadow-lg print:w-full print:p-0 print:shadow-none">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-16 w-16" />
        <div className="flex-1">
          <div className="text-[16px] font-bold">{coField("name")}</div>
          <div>{coField("address")}</div>
          <div>{coField("tel")}</div>
          <div className="flex gap-2">
            <span>E-mail:</span>
            {coField("email")}
            {coField("web")}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-[16px] font-bold">ใบเสนอราคา / QUOTATION</span>
        <span>
          <b>เลขที่ / No.:</b> {data.number}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-[1fr_330px] gap-x-4">
        <div className="grid grid-cols-[190px_1fr] items-start gap-y-1">
          <span>บริษัท/องค์กร / Company:</span>
          {field("customer")}
          <span>เรียน / Attn:</span>
          {field("attention")}
          <span>โครงการ / Project:</span>
          {field("project")}
          <div className="col-span-2 grid grid-cols-[190px_1fr_auto_1fr] items-start gap-x-2">
            <span>โทร / Tel:</span>
            {field("phone")}
            <span>อีเมล / Email:</span>
            {field("email")}
          </div>
          <span>เลขประจำตัวผู้เสียภาษี / Tax ID:</span>
          {coField("taxId")}
        </div>
        <div className="grid grid-cols-[190px_1fr] items-start gap-y-1 [&>span]:whitespace-nowrap">
          <span>วันที่ / Date:</span>
          {h ? (
            <label className="relative block">
              <span className={`${blank} block min-h-[1.4em]`}>{dateText}</span>
              <input type="date" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" value={data.date} onChange={(e) => h.onField({ date: e.target.value })} />
            </label>
          ) : (
            <span>{dateText}</span>
          )}
          <span>กำหนดยืนราคา (วัน):</span>
          {field("validDays", "number")}
          <span>ระยะเวลากำหนดส่งสินค้า (วัน):</span>
          {field("leadDays", "number")}
          <span>การรับประกัน (ปี):</span>
          {field("warrantyYears", "number")}
          <span>ผู้เสนอราคา / Quoted by:</span>
          {h && salesSlot ? salesSlot : field("quotedBy")}
        </div>
      </div>

      <p className="mt-4">บริษัทฯยินดีที่จะเสนอราคาสินค้า เพื่อประกอบการพิจารณาดังนี้:</p>
      <table className="mt-1 w-full border-collapse border border-black">
        <colgroup>
          <col style={{ width: 48 }} />
          <col style={{ width: 70 }} />
          <col style={{ width: 80 }} />
          <col />
          <col style={{ width: 62 }} />
          <col style={{ width: 80 }} />
          <col style={{ width: 36 }} />
          <col style={{ width: 80 }} />
        </colgroup>
        <thead className="bg-indigo-50 print:bg-transparent">
          <tr>
            <th className={th}>ลำดับที่<br />Item</th>
            <th className={th}>ยี่ห้อ<br />Brand</th>
            <th className={th}>รุ่น<br />Model</th>
            <th className={th}>รายละเอียด<br />Description</th>
            <th className={th}>จำนวน<br />Quantity</th>
            <th className={th}>ราคาต่อหน่วย<br />Unit Price</th>
            <th className={th}>ส่วนลด<br />%</th>
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
                  <input type="number" min={1} step={1} className={`${blank} text-center`} value={l.qty} onChange={(e) => h.onLine(l.key, { qty: e.target.value })} />
                ) : (
                  `${l.qty} ${l.unit}`
                )}
              </td>
              <td className={`${td} text-right`}>
                {h ? (
                  <input type="number" min={0} step="0.01" className={`${blank} text-right`} value={l.price} onChange={(e) => h.onLine(l.key, { price: e.target.value })} />
                ) : (
                  money(Number(l.price) || 0)
                )}
              </td>
              <td className={`${td} text-center`}>{discount ? discount : "-"}</td>
              <td className={`${td} text-right`}>{money((Number(l.qty) || 0) * (Number(l.price) || 0) * factor)}</td>
            </tr>
          ))}
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={`b${i}`}>
              {Array.from({ length: 8 }).map((__, c) => (
                <td key={c} className={`${td} h-6`} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid grid-cols-[1fr_270px] border-x border-b border-black">
        <div className="flex items-center justify-center border-r border-black p-2 text-center text-[14px] font-bold">{bahtText(total)}</div>
        <table className="w-full border-collapse">
          <tbody>
            <tr><td className="border-b border-black px-2 py-1">ราคาสินค้า</td><td className="border-b border-black px-2 py-1 text-right">{money(gross)}</td></tr>
            <tr><td className="border-b border-black px-2 py-1">ภาษีมูลค่าเพิ่ม 7%</td><td className="border-b border-black px-2 py-1 text-right">{data.vat ? money(vat) : "-"}</td></tr>
            <tr className="font-bold"><td className="px-2 py-1">รวมราคาทั้งสิ้น</td><td className="px-2 py-1 text-right">{money(total)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-[1fr_1fr] border-x border-b border-black">
        <div className="border-r border-black">
          <div className="border-b border-black py-1 text-center font-bold">เงื่อนไขชำระเงิน / PAYMENT</div>
          <div className="p-2 text-center">{field("paymentTerms")}</div>
        </div>
        <div className="text-center">
          <div className="border-b border-black py-1 font-bold">ผู้อนุมัติ / APPROVED BY</div>
          <div className="flex h-14 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {data.signatureUrl && <img src={data.signatureUrl} alt="" className="max-h-12 max-w-[200px] object-contain" />}
          </div>
          <div className="pb-2">
            <div>{editCompany && h ? <input className={`${blank} text-center`} value={co.approverName} onChange={(e) => h.onCompany({ approverName: e.target.value })} /> : co.approverName}</div>
            <div>
              {editCompany && h ? (
                <input className={`${blank} text-center`} value={co.approverTitle} onChange={(e) => h.onCompany({ approverTitle: e.target.value })} />
              ) : (
                `( ${co.approverTitle} )`
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
