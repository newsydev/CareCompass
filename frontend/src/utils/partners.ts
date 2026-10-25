export interface PartnerLike {
  caregiver_id?: string
  name?: string | null
  role?: string | null
  qualification?: string | null
  languages?: string | null
  skills?: string | null
  base_area?: string | null
  rating?: number | null
  experience_years?: number | null
  active?: boolean | null
}

const ROLE_LABELS: Record<string, string> = {
  doctor: 'Doctor',
  medic: 'Nurse / Medic',
  nurse: 'Nurse',
  phlebotomist: 'Phlebotomist',
}

export function parseList(value: string | null | undefined): string[] {
  if (!value) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of value.split(';')) {
    const item = part.trim()
    if (item && !seen.has(item.toLowerCase())) {
      seen.add(item.toLowerCase())
      out.push(item)
    }
  }
  return out
}

function titleCase(slug: string): string {
  return slug.split('_').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export function roleLabel(role: string | null | undefined): string {
  if (!role) return 'Caregiver'
  return ROLE_LABELS[role] ?? titleCase(role)
}

export function skillLabel(skill: string): string {
  return titleCase(skill.trim())
}

export function activePartners<T extends PartnerLike>(list: T[] | undefined | null): T[] {
  return (list ?? []).filter((p) => p.active !== false)
}

export function rolesPresent(list: PartnerLike[]): string[] {
  const roles = new Set<string>()
  for (const p of list) if (p.role) roles.add(p.role)
  return [...roles].sort((a, b) => roleLabel(a).localeCompare(roleLabel(b)))
}

export function sortPartners<T extends PartnerLike>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const ra = typeof a.rating === 'number' ? a.rating : -1
    const rb = typeof b.rating === 'number' ? b.rating : -1
    if (rb !== ra) return rb - ra
    return (a.name ?? '').localeCompare(b.name ?? '')
  })
}

export function filterPartners<T extends PartnerLike>(list: T[], role: string | null, query: string): T[] {
  const q = query.trim().toLowerCase()
  return list.filter((p) => {
    if (role && p.role !== role) return false
    if (!q) return true
    const hay = [p.name, p.qualification, p.base_area, roleLabel(p.role), ...parseList(p.skills).flatMap((s) => [s, skillLabel(s)])]
      .filter(Boolean).join(' ').toLowerCase()
    return hay.includes(q)
  })
}

export function visiblePartners<T extends PartnerLike>(list: T[] | undefined | null, role: string | null, query: string): T[] {
  return sortPartners(filterPartners(activePartners(list), role, query))
}
