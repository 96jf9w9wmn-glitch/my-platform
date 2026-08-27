// Позиция всплывающей панели под кнопкой верхней панели.
// Панель шириной 320px, привязанная к правому краю кнопки, на узком экране
// (iPhone) уезжала левым краем за границу — уведомления обрезались. Здесь
// ширина ужимается под экран, а отступ справа зажимается так, чтобы левый край
// остался внутри окна; заодно считается предельная высота до низа экрана.
export function dropdownPos(btn, { width = 320, margin = 8, gap = 12 } = {}) {
  const rect = btn.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const w = Math.min(width, vw - margin * 2)
  const right = Math.min(Math.max(vw - rect.right, margin), Math.max(vw - w - margin, margin))
  const top = rect.bottom + gap
  return { top, right, width: w, maxHeight: Math.max(160, vh - top - margin) }
}
