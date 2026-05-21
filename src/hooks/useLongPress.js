import { useCallback, useRef } from 'react'

export function useLongPress(onLongPress, delay = 500) {
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

  const prevent = useCallback((e) => {
    if (fired.current) e.preventDefault()
  }, [])

  return {
    onTouchStart:  start,
    onTouchEnd:    cancel,
    onTouchMove:   cancel,
    onMouseDown:   start,
    onMouseUp:     cancel,
    onMouseLeave:  cancel,
    onClick:       prevent,
  }
}
