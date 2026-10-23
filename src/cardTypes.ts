export type ConnectedCard = { id: string; company: string; number: string; alias: string }
export type CardApproval = {
  id: string; dateTime: string; approvalType: string; approvalNumber: string
  store: string; storeNumber: string; amount: number; currency: string
  supplyAmount: number | null; vatAmount: number | null; serviceCharge: number | null
  memo: string
  cardNumber: string
}
export type CardApprovalPage = {
  records: CardApproval[]; page: number; totalPages: number; total: number
  card: ConnectedCard; startDate: string; endDate: string
}
