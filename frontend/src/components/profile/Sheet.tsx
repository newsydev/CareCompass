import { useEffect, useId, useRef, type ReactNode } from 'react'

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => dialog?.close()
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={(e) => { if (!e.currentTarget.open) onClose() }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-full overflow-y-auto rounded-t-3xl bg-white p-0 text-gray-900 shadow-xl backdrop:bg-black/40 sm:m-auto sm:max-w-md sm:rounded-3xl"
    >
      <div className="px-5 pb-6 pt-5">
        <h2 id={titleId} className="text-lg font-bold">{title}</h2>
        {children}
      </div>
    </dialog>
  )
}
