import type { CardApproval } from './cardTypes.ts'

export function cardSupplyAmount(row: Pick<CardApproval, 'amount' | 'supplyAmount' | 'vatAmount' | 'serviceCharge' | 'currency'>) {
  if (row.supplyAmount !== null && row.supplyAmount !== 0) return { value: row.supplyAmount, calculated: false }
  // Only subtract amounts known to be in the same currency; keep foreign and
  // incomplete source data unchanged rather than infer tax or currency rates.
  if (row.currency !== 'KRW' || row.vatAmount === null || row.serviceCharge === null) return { value: row.supplyAmount, calculated: false }
  return { value: Math.round((row.amount - row.vatAmount - row.serviceCharge) * 100) / 100, calculated: true }
}
