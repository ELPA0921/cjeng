import { useRef, useState } from 'react'
import type { Order } from './orderTypes'
import { findOrder } from './cardAccounting'

/** "26023 · 서강테크"; 관리비 codes have no client, so their name stands in. */
const orderLabel = (order: Order) => `${order.orderNo} · ${order.client1 || order.projectName}`

/**
 * 수주번호 input with autocomplete. Typing (a number, a client or project name) opens a list
 * of matching orders; picking one by click or Enter fills it in as "수주번호 · 수주처".
 * Typed text stays as typed until something is picked or the field is left.
 * The value handed to onChange is always the bare order number or the raw text typed.
 */
export default function OrderNoField({ value, orders, disabled, invalid, onChange, onBlur }: {
  value: string
  orders: Order[]
  disabled: boolean
  invalid: boolean
  onChange: (orderNo: string) => void
  onBlur: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  // What the user is typing; null shows the committed value (as a label when it is a known order).
  const [draft, setDraft] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null)
  const selected = findOrder(orders, value)
  const text = draft ?? (selected ? orderLabel(selected) : value)
  const words = (draft ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean)
  // An exact order number comes first, so typing 26023 then Enter picks it.
  const exact = (order: Order) => order.orderNo === draft?.trim() ? 0 : 1
  const matches = !words.length ? [] : orders
    .filter(order => { const haystack = [order.orderNo, order.client1, order.client2, order.projectName, order.region].join(' ').toLowerCase(); return words.every(word => haystack.includes(word)) })
    .sort((a, b) => exact(a) - exact(b))
    .slice(0, 30)

  // The list is fixed to the viewport so the modal's scrolling table cannot clip it.
  function place() {
    const rect = input.current?.getBoundingClientRect()
    if (rect) setBox({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 340) })
  }
  function change(next: string) {
    // Editing a shown label ("26023 · 서강테") falls back to the number part.
    const typed = next.includes(' · ') ? next.split(' · ')[0].trim() : next
    setDraft(typed); onChange(typed)
    setActive(0); place()
  }
  function pick(order: Order) { onChange(order.orderNo); setDraft(null); setActive(0) }

  return <>
    <input ref={input} aria-label="수주번호" aria-invalid={invalid} aria-autocomplete="list" aria-expanded={matches.length > 0} value={text} disabled={disabled} placeholder={disabled ? '-' : '수주번호 또는 수주처'}
      onFocus={event => { place(); if (selected) event.currentTarget.select() }}
      onBlur={() => { setDraft(null); onBlur() }}
      onChange={event => change(event.target.value)}
      onKeyDown={event => {
        // A shown label is edited as its number: Backspace drops a digit, or clears it when all is selected.
        if (draft === null && selected && (event.key === 'Backspace' || event.key === 'Delete')) { event.preventDefault(); const all = event.currentTarget.selectionStart === 0 && event.currentTarget.selectionEnd === text.length; change(all ? '' : selected.orderNo.slice(0, -1)); return }
        // Keys pressed while a Korean syllable is still being composed belong to the IME.
        if (!matches.length || event.nativeEvent.isComposing) return
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActive(current => (current + (event.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length) }
        if (event.key === 'Enter') { event.preventDefault(); pick(matches[Math.min(active, matches.length - 1)]) }
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); input.current?.blur() }
      }} />
    {matches.length > 0 && box && <div className="order-suggest" role="listbox" style={{ top: box.top, left: box.left, width: box.width }}>
      {matches.map((order, index) => <button key={order.id} type="button" role="option" aria-selected={index === active} tabIndex={-1}
        onMouseDown={event => { event.preventDefault(); pick(order) }} onMouseEnter={() => setActive(index)}>
        <strong>{order.orderNo}</strong><span>{order.client1 || '-'}</span><small>{order.projectName}</small>
      </button>)}
    </div>}
  </>
}
