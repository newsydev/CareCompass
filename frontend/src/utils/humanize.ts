export function humanizeSlug(slug: string | null | undefined): string {
  if (!slug) return 'Unknown'
  return slug
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const URGENCY_STYLES: Record<string, string> = {
  emergency: 'bg-red-100 text-red-700 border-red-200',
  immediate: 'bg-red-100 text-red-700 border-red-200',
  same_day: 'bg-amber-100 text-amber-800 border-amber-200',
  scheduled: 'bg-brand-100 text-brand-700 border-brand-200',
  routine: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

export function urgencyBadgeClass(urgency: string | null | undefined): string {
  if (!urgency) return 'bg-gray-100 text-gray-700 border-gray-200'
  return URGENCY_STYLES[urgency] ?? 'bg-gray-100 text-gray-700 border-gray-200'
}
