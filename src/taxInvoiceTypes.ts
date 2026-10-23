// A purchase tax invoice collected from 홈택스 through Barobill.
export type PurchaseTaxInvoice = {
  id: string
  approvalNumber: string
  writeDate: string
  vendor: string
  vendorCorpNum: string
  itemName: string
  supplyAmount: number | null
  vatAmount: number | null
  amount: number
  modified: boolean
}
export type PurchaseTaxInvoicePage = {
  records: PurchaseTaxInvoice[]; page: number; totalPages: number; total: number
  startDate: string; endDate: string
}
