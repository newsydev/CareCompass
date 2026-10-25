import { Icon } from './Icon'
import { initialOf } from './format'

export function ProfileHeader({ name, contact, photoLabel }: { name: string; contact: string; photoLabel: string }) {
  return (
    <div className="rounded-b-[2.5rem] bg-brand-900 px-4 pb-8 pt-10 text-center text-white">
      <div className="relative mx-auto h-24 w-24">
        <div
          aria-hidden="true"
          className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/30 bg-brand-700 text-4xl font-bold"
        >
          {initialOf(name)}
        </div>
        <button
          type="button" disabled aria-label={photoLabel} title={photoLabel}
          className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-brand-900 bg-brand-500 text-white"
        >
          <Icon name="camera" className="h-4 w-4" />
        </button>
      </div>
      <h1 className="mt-4 break-words text-2xl font-bold">{name}</h1>
      <p className="mt-1 break-all text-sm text-brand-100">{contact}</p>
    </div>
  )
}
