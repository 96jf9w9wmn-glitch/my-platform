// Catmull-Rom → кубические Безье: ломаная из 3–4 точек выглядит рвано, а
// сглаженная читается как динамика.
export function smoothPath(pts) {
  if (pts.length < 2) return ""
  let d = `M${pts[0].x},${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] || p2
    d += ` C${p1.x + (p2.x - p0.x) / 6},${p1.y + (p2.y - p0.y) / 6}` +
         ` ${p2.x - (p3.x - p1.x) / 6},${p2.y - (p3.y - p1.y) / 6}` +
         ` ${p2.x},${p2.y}`
  }
  return d
}
