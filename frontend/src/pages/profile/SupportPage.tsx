import { EmptyState } from '../../components/profile/EmptyState'
import { Icon } from '../../components/profile/Icon'
import { SubPageHeader } from '../../components/profile/SubPageHeader'
import type { ProfileStrings } from '../../components/profile/strings'

export function SupportPage({ t, onBack }: { t: ProfileStrings; onBack: () => void }) {
  return (
    <>
      <SubPageHeader title={t.support} backLabel={t.back} onBack={onBack} />
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pb-28 pt-4">
        <button
          type="button" disabled
          className="flex items-center gap-3 rounded-3xl bg-brand-100 p-4 text-left"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-200 text-brand-800">
            <Icon name="bot" className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-base font-bold text-brand-900">{t.aiSupport}</span>
              <span className="rounded-md bg-brand-200 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand-900">{t.comingSoon}</span>
            </span>
            <span className="mt-0.5 block text-sm text-brand-800">{t.aiSupportHint}</span>
          </span>
        </button>

        <button
          type="button" disabled
          className="flex items-center gap-3 rounded-3xl border border-gray-100 bg-white p-4 text-left shadow-sm"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600">
            <Icon name="book" className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-base font-bold text-gray-700">{t.helpCentre}</span>
              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-gray-700">{t.comingSoon}</span>
            </span>
            <span className="mt-0.5 block text-sm text-gray-600">{t.helpCentreHint}</span>
          </span>
        </button>

        <div className="rounded-3xl border border-gray-100 bg-white shadow-sm">
          <EmptyState icon="chat" title={t.noTickets} hint={t.noTicketsHint} />
        </div>

        <button
          type="button" disabled aria-label={`${t.createTicket} (${t.comingSoon})`}
          className="mt-2 w-full rounded-2xl bg-gray-200 px-4 py-4 text-base font-bold text-gray-600"
        >
          {t.createTicket}
        </button>
      </div>
    </>
  )
}
