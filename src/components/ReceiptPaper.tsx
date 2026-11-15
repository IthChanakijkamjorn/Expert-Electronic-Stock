import type { DocCompany } from "@/lib/company";
import { bahtText } from "@/lib/bahttext";
import { docHead, type DocVariant } from "@/lib/docType";
import { blank, money } from "@/components/InvoicePaper";

export type ReceiptRow = { key: string; desc: string; qty: string; amount: string };

export type ReceiptPaperData = {
  number: string;
  company: DocCompany;
  variant?: DocVariant;
  customerCode: string;
  customer: string;
  receivedFrom: string;
  salesperson: string;
  date: string;
  lines: ReceiptRow[];
  cashAmount: string;
  chequeBank: string;
  chequeBranch: string;
  chequeNo: string;
  chequeDate: string;
  chequeAmount: string;
};

type TextKey = "customerCode" | "customer" | "receivedFrom" | "salesperson" | "cashAmount" | "chequeBank" | "chequeBranch" | "chequeNo" | "chequeAmount";

export type ReceiptHandlers = {
  onField: (patch: Partial<ReceiptPaperData>) => void;
  onCompany: (patch: Partial<DocCompany>) => void;
  onLine: (key: string, patch: Partial<ReceiptRow>) => void;
  onRemove: (key: string) => void;
};

export const RECEIPT_ROWS = 14;

export function ReceiptPaper({ data, h, editCompany = false }: { data: ReceiptPaperData; h?: ReceiptHandlers; editCompany?: boolean }) {
  const co = data.company;
  const head = docHead("ใบเสร็จรับเงิน", "RECEIPT", data.variant);
  const total = data.lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const fmt = (d: string) => (d ? new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }) : "");

  const coField = (k: keyof DocCompany) =>
    editCompany && h ? <input className={blank} value={co[k]} onChange={(e) => h.onCompany({ [k]: e.target.value })} /> : <span>{co[k]}</span>;
  const field = (k: TextKey, type: "text" | "number" = "text") =>
    h ? (
      <input type={type} min={type === "number" ? 0 : undefined} step={type === "number" ? "0.01" : undefined} className={blank} value={data[k]} onChange={(e) => h.onField({ [k]: e.target.value })} />
    ) : (
      <span>{type === "number" ? (Number(data[k]) ? money(Number(data[k])) : "") : data[k]}</span>
    );

  const th = "border border-black px-1 py-1 text-center text-[11px] font-bold leading-tight";
  const td = "border-x border-black px-1 py-1 align-top";
  const rows = Math.max(0, RECEIPT_ROWS - data.lines.length);

  return (
    <div className="mx-auto w-[794px] max-w-none bg-white p-7 text-[12.5px] leading-snug text-black shadow-lg print:w-full print:p-0 print:shadow-none">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-16 w-16" />
        <div className="flex-1">
          <div className="text-[15px] font-bold">{coField("name")}</div>
          <div>{coField("address")}</div>
          <div>{coField("tel")}</div>
          <div className="flex gap-2"><span>Email:</span>{coField("email")}{coField("web")}</div>
        </div>
        <div className="w-[270px] border border-black text-center">
          <div className="border-b border-black py-1 text-[15px] font-bold">{head.th}</div>
          <div className="border-b border-black py-1 text-[14px] font-bold">{head.en}</div>
          <div className="flex items-center justify-center gap-1 px-1 py-1 text-[11px]">
            <span className="shrink-0">เลขประจำตัวผู้เสียภาษีอากร:</span>
            {coField("taxId")}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_270px] gap-x-6">
        <div className="grid grid-cols-[200px_1fr] items-start gap-y-1">
          <span>รหัสลูกค้า / Customer Code:</span>{field("customerCode")}
          <span>ชื่อลูกค้า / Customer:</span>{field("customer")}
          <span>ได้รับเงินจาก / Received from:</span>{field("receivedFrom")}
        </div>
        <div className="grid grid-cols-[100px_1fr] items-start gap-y-1">
          <span>เลขที่ / No.:</span><span>{data.number}</span>
          <span>วันที่ / Date:</span>
          {h ? <input type="date" className={blank} value={data.date} onChange={(e) => h.onField({ date: e.target.value })} /> : <span>{fmt(data.date)}</span>}
          <span>พนักงานขาย / Sales:</span>{field("salesperson")}
        </div>
      </div>

      <table className="mt-4 w-full border-collapse border border-black">
        <colgroup><col style={{ width: 52 }} /><col /><col style={{ width: 90 }} /><col style={{ width: 130 }} /></colgroup>
        <thead className="bg-indigo-50 print:bg-transparent">
          <tr>
            <th className={th}>ลำดับ<br />Item</th>
            <th className={th}>รายละเอียด<br />Description</th>
            <th className={th}>จำนวน<br />Quantity</th>
            <th className={th}>จำนวนเงิน (บาท)<br />Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((l, i) => (
            <tr key={l.key}>
              <td className={`${td} text-center`}>
                {i + 1}
                {h && <button type="button" className="block w-full text-red-600 print:hidden" onClick={() => h.onRemove(l.key)}>✕</button>}
              </td>
              <td className={td}>{h ? <input className={blank} value={l.desc} onChange={(e) => h.onLine(l.key, { desc: e.target.value })} /> : l.desc}</td>
              <td className={`${td} text-center`}>{h ? <input className={`${blank} text-center`} value={l.qty} onChange={(e) => h.onLine(l.key, { qty: e.target.value })} /> : l.qty}</td>
              <td className={`${td} text-right`}>
                {h ? <input type="number" min={0} step="0.01" className={`${blank} text-right`} value={l.amount} onChange={(e) => h.onLine(l.key, { amount: e.target.value })} /> : money(Number(l.amount) || 0)}
              </td>
            </tr>
          ))}
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={`b${i}`}>{[0, 1, 2, 3].map((c) => <td key={c} className={`${td} h-6`} />)}</tr>
          ))}
        </tbody>
      </table>
      {h && data.lines.length < RECEIPT_ROWS && (
        <button type="button" className="btn-ghost mt-2 print:hidden" onClick={() => h.onField({ lines: [...data.lines, { key: crypto.randomUUID(), desc: "", qty: "", amount: "" }] })}>
          + เพิ่มรายการ / Add row
        </button>
      )}

      <div className="grid grid-cols-[1fr_130px] border-x border-b border-black">
        <div className="flex items-center justify-center border-r border-black p-2 text-center text-[14px] font-bold">({bahtText(total)})</div>
        <div className="px-2 py-2 text-right text-[14px] font-bold">{money(total)}</div>
      </div>
      <div className="border-x border-b border-black p-1 text-center text-[11px]">
        ใบเสร็จรับเงินฉบับนี้จะสมบูรณ์ต่อเมื่อบริษัทได้รับเงินสด หรือเช็คของธนาคารได้เรียกเก็บเงินตามเช็คแล้ว<br />
        (The receipt will be issued upon cash received or cheque cleared.)
      </div>

      <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 border-x border-b border-black p-2">
        <b>ชำระโดย / PAID BY</b><span />
        <span className="pl-4">เงินสด / CASH</span>
        <span className="flex items-center gap-2">{field("cashAmount", "number")}<span className="shrink-0">บาท / BAHT</span></span>
        <span className="pl-4">เช็คธนาคาร / CHEQUE</span>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          <label className="flex items-center gap-1">ธนาคาร/BANK {field("chequeBank")}</label>
          <label className="flex items-center gap-1">สาขา/BRANCH {field("chequeBranch")}</label>
          <label className="flex items-center gap-1">เลขที่/NUMBER {field("chequeNo")}</label>
          <label className="flex items-center gap-1">
            ลงวันที่/DATE{" "}
            {h ? <input type="date" className={blank} value={data.chequeDate} onChange={(e) => h.onField({ chequeDate: e.target.value })} /> : <span>{fmt(data.chequeDate)}</span>}
          </label>
          <label className="col-span-2 flex items-center gap-1">จำนวนเงิน/AMOUNT {field("chequeAmount", "number")} บาท/BAHT</label>
        </div>
      </div>

      <div className="grid grid-cols-2 border-x border-b border-black text-center">
        <div className="h-24 border-r border-black pt-16"><b>ผู้รับเงิน</b><br /><b className="text-[11px]">COLLECTED BY</b></div>
        <div className="h-24 pt-16"><b>ผู้มีอำนาจลงนาม</b><br /><b className="text-[11px]">AUTHORIZED SIGNATURE</b></div>
      </div>
    </div>
  );
}
