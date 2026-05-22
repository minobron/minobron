import { useCallback, useRef } from 'react'

export function useLongPress(onLongPress, onTap, delay = 500) {
  const timerRef = useRef(null)
  const fired    = useRef(false)

  const start = useCallback((e) => {
    fired.current = false
    timerRef.current = setTimeout(() => {
      fired.current = true
      onLongPress(e)
    }, delay)
  }, [onLongPress, delay])

  const cancel = useCallback(() => {
    clearTimeout(timerRef.current)
  }, [])

  const handleClick = useCallback((e) => {
    if (fired.current) {
      // Long press già scattato — previeni il click sintetico del browser
      e.preventDefault()
    } else {
      // Tap normale — chiama il callback
      onTap?.(e)
    }
  }, [onTap])

  return {
    onTouchStart:  start,
    onTouchEnd:    cancel,
    onTouchMove:   cancel,
    onMouseDown:   start,
    onMouseUp:     cancel,
    onMouseLeave:  cancel,
    onClick:       handleClick,
  }
}
