// Цвет кружка с инициалами. Считается от имени, поэтому у одного ученика он
// один и тот же во всех разделах, и список читается по цветам, а не по буквам.
const AVATAR_COLORS = [
  { bg: "bg-blue-100 dark:bg-blue-500/15", text: "text-blue-700 dark:text-blue-300" },
  { bg: "bg-purple-100 dark:bg-purple-500/15", text: "text-purple-700 dark:text-purple-300" },
  { bg: "bg-amber-100 dark:bg-amber-500/15", text: "text-amber-700 dark:text-amber-300" },
  { bg: "bg-green-100 dark:bg-green-500/15", text: "text-green-700 dark:text-green-300" },
  { bg: "bg-pink-100 dark:bg-pink-500/15", text: "text-pink-700 dark:text-pink-300" },
]

export default function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0]
  let sum = 0
  for (const c of name) sum += c.charCodeAt(0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}
