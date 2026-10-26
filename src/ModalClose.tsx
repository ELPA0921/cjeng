import { useEffect, useRef } from 'react'

// Open windows in the order they appeared; Esc closes only the topmost one.
const openWindows: symbol[] = []

/** The X at the top right of every window. Esc does the same as clicking it. */
export default function ModalClose({ onClose, disabled = false }: { onClose: () => void; disabled?: boolean }) {
  const latest = useRef({ onClose, disabled })
  useEffect(() => { latest.current = { onClose, disabled } })
  useEffect(() => {
    const id = Symbol('window')
    openWindows.push(id)
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing || event.defaultPrevented || openWindows.at(-1) !== id || latest.current.disabled) return
      event.preventDefault()
      latest.current.onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); openWindows.splice(openWindows.indexOf(id), 1) }
  }, [])
  return <button type="button" className="modal-close" aria-label="창 닫기" title="창 닫기 (Esc)" disabled={disabled} onClick={onClose}>
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  </button>
}
