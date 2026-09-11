// ВРЕМЕННЫЙ стенд для воспроизведения жестов на доске в симуляторе. Не коммитить.
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Board from './components/Board.jsx'

const describe = (x, y) => {
  const el = document.elementFromPoint(x, y)
  if (!el) return `(${x},${y})=none`
  const cls = typeof el.className === 'string' && el.className ? '.' + el.className.split(' ').slice(0, 1).join('.') : ''
  return `(${x},${y})=${el.tagName.toLowerCase()}${cls}[${getComputedStyle(el).touchAction}]`
}

function ScaleHud() {
  const [s, setS] = useState(() => (window.visualViewport ? window.visualViewport.scale : 1))
  const [fingers, setFingers] = useState('')
  const [zones, setZones] = useState([])
  useEffect(() => {
    const vv = window.visualViewport
    const sync = () => setS(vv.scale)
    vv?.addEventListener('resize', sync); vv?.addEventListener('scroll', sync)
    let got = false
    const log = (e) => {
      if (e.touches.length < 2 || got) return
      got = true
      setFingers([...e.touches].map((t) => describe(Math.round(t.clientX), Math.round(t.clientY))).join(' | '))
    }
    for (const t of ['touchstart', 'touchmove']) document.addEventListener(t, log, { passive: true, capture: true })
    // Прозрачные зоны для XCUITest: pinch(withScale:) умеет только по элементу,
    // а шапка и панель доски доступности не имеют. pointer-events: none — касания
    // проходят сквозь зону в то, что под ней.
    const place = () => {
      const root = document.querySelector('[data-board-version]')
      const header = root?.firstElementChild?.getBoundingClientRect()
      const row = document.querySelector('[aria-label="Перо"]')?.parentElement?.getBoundingClientRect()
      const cvEl = document.querySelector('canvas.relative')
      // Холсту — имя для доступности: XCUITest щиплет только по элементу, а у
      // холста без роли точка попадания выходит INFINITY.
      if (cvEl) { cvEl.setAttribute('role', 'img'); cvEl.setAttribute('aria-label', 'boardCanvas') }
      const cv = cvEl?.getBoundingClientRect()
      const z = []
      if (header) z.push({ id: 'zoneHeader', left: 0, top: header.top, width: header.width, height: header.height })
      if (row) z.push({ id: 'zoneToolbar', left: row.left, top: row.top, width: row.width, height: row.height })
      if (cv) z.push({ id: 'zoneCanvas', left: cv.left + cv.width / 2 - 100, top: cv.top + cv.height / 2 - 100, width: 200, height: 200 })
      setZones(z)
    }
    const tm = setTimeout(place, 800)
    return () => { clearTimeout(tm); vv?.removeEventListener('resize', sync); vv?.removeEventListener('scroll', sync) }
  }, [])
  return (
    <>
      <div style={{ position: 'fixed', left: 8, top: 110, zIndex: 999999, pointerEvents: 'none', fontSize: 20, fontWeight: 700, color: '#ff3b30', background: 'rgba(255,255,255,.85)', padding: '4px 8px', borderRadius: 8 }}>
        <div>{`scale=${Number(s).toFixed(2)}`}</div>
        <div style={{ fontSize: 13 }}>{`fingers: ${fingers || 'none'}`}</div>
      </div>
      {zones.map((z) => (
        <div key={z.id} role="img" aria-label={z.id}
          style={{ position: 'fixed', left: z.left, top: z.top, width: z.width, height: z.height, zIndex: 999998, pointerEvents: 'none', outline: '1px dashed rgba(255,59,48,.5)' }} />
      ))}
    </>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Board roomId="0" userId="s:dev" userName="Тест" theme="light" onClose={() => {}} />
    <ScaleHud />
  </StrictMode>
)
