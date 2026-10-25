export function MenuItem({ label, onSelect, disabled = false, danger = false }: {
  label: string
  onSelect: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button" role="menuitem" disabled={disabled} onClick={onSelect}
      className={`flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-medium hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-50 ${danger ? 'text-red-800' : 'text-gray-900'}`}
    >
      {label}
    </button>
  )
}
