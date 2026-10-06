'use client'
import { useState, useSyncExternalStore } from 'react'

const noop = () => () => {}

/**
 * Progressive enhancement of the code field: without JS it's a big plain
 * input; with JS six boxes are drawn under the (transparent) real input.
 */
export function CodeInput() {
  const enhanced = useSyncExternalStore(noop, () => true, () => false)
  const [digits, setDigits] = useState('')
  const [focused, setFocused] = useState(false)
  const active = Math.min(digits.length, 5)
  return (
    <div className={enhanced ? 'codigo codigo--mejorado' : 'codigo'}>
      <input
        id="code" name="code" className="codigo-input" type="text" required autoFocus
        inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} placeholder="000000"
        // Digits typed (or autofilled) before hydration are already in the DOM.
        ref={(el) => {
          if (!el) return
          setDigits(el.value.replace(/\D/g, '').slice(0, 6))
          setFocused(document.activeElement === el)
        }}
        onInput={(e) => setDigits(e.currentTarget.value.replace(/\D/g, '').slice(0, 6))}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      />
      <div className="codigo-casillas" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="casilla" data-activa={focused && i === active ? '' : undefined}>{digits[i] ?? ''}</span>
        ))}
      </div>
    </div>
  )
}
