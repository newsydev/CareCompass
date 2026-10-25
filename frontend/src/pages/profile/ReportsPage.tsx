import { EmptyState, SoonButton } from '../../components/profile/EmptyState'
import { SubPageHeader } from '../../components/profile/SubPageHeader'
import type { ProfileStrings } from '../../components/profile/strings'

export function ReportsPage({ t, onBack }: { t: ProfileStrings; onBack: () => void }) {
  return (
    <>
      <SubPageHeader
        title={t.myReports} backLabel={t.back} onBack={onBack}
        action={<SoonButton icon="plus" label={t.upload} soon={t.comingSoon} />}
      />
      <EmptyState icon="doc" title={t.noReports} hint={t.noReportsHint} />
    </>
  )
}
