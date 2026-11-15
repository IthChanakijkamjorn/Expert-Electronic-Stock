// Printed on quotations. Edit here if any detail changes.
export const COMPANY = {
  nameEn: "Expert Electronic & Communication Co., Ltd.",
  address: "51/2 Ramkhamhaeng 96, Ramkhamhaeng Rd, Saphansung, Bangkok, Thailand 10240",
  tel: "TEL. (66) 0 2729 3549-50, (66) 0 2729 4225-6",
  email: "admin@expertelectronic.co.th",
  web: "www.expertelectronic.co.th",
  taxId: "0105538039535",
  nameTh: "บริษัท เอ็กซ์เพิร์ท อีเล็คโทรนิค แอนด์ คอมมูนิเคชั่น จำกัด",
  addressTh: "51/2 ซ.รามคำแหง 96 ถ.รามคำแหง แขวงสะพานสูง เขตสะพานสูง กรุงเทพฯ 10240",
  telTh: "โทรศัพท์: (66) 0 2729 3549-50, (66) 0 2729 4225-6",
  invoiceBank: "ธนาคารกรุงไทย สาขาสัมมากรเพลส รามคำแหง 110 เลขที่บัญชี 0170816672",
  approverName: "นายสมชาย ชนะกิจกำจร",
  approverTitle: "ผู้จัดการ",
  bank:
    "ธนาคารกรุงเทพ สาขาถนนสุขาภิบาล 3 บึงกุม เลขที่บัญชี 056-0-35738-6 ชื่อบัญชี \"บริษัท เอ็กซ์เพิร์ท อีเล็คโทรนิค แอนด์ คอมมูนิเคชั่น จำกัด\" โอนเงินแล้วกรุณา โทร/แฟกซ์/เมล แจ้งบริษัทด้วย",
};

// Company block printed on documents. Editable per document, so it is stored with each one.
export type DocCompany = {
  name: string;
  address: string;
  tel: string;
  email: string;
  web: string;
  taxId: string;
  bank: string;
  approverName: string;
  approverTitle: string;
};

export type DocKind = "invoice" | "quote" | "receipt";

export const defaultDocCompany = (kind: DocKind = "invoice"): DocCompany =>
  kind === "quote"
    ? {
        name: COMPANY.nameEn,
        address: COMPANY.address,
        tel: COMPANY.tel,
        email: COMPANY.email,
        web: COMPANY.web,
        taxId: "010 5538 039 535",
        bank: COMPANY.bank,
        approverName: COMPANY.approverName,
        approverTitle: COMPANY.approverTitle,
      }
    : {
        name: COMPANY.nameTh,
        address: COMPANY.addressTh,
        tel: COMPANY.telTh,
        email: COMPANY.email,
        web: COMPANY.web,
        taxId: "010 5538 039 535",
        bank: COMPANY.invoiceBank,
        approverName: COMPANY.approverName,
        approverTitle: COMPANY.approverTitle,
      };

export const mergeDocCompany = (c: Partial<DocCompany> | null | undefined, kind: DocKind = "invoice"): DocCompany => ({
  ...defaultDocCompany(kind),
  ...(c ?? {}),
});
