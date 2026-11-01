import Link from 'next/link'
import { LEGAL, legalDraft } from '@/lib/legal'
import { SiteFooter } from '@/components/SiteFooter'

// Shared shell for /privacy and /terms.
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">← AskPanel</Link>
        <h1 className="mt-6 text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Last updated {LEGAL.lastUpdated}</p>
        {legalDraft && (
          <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            Draft: the operator&apos;s legal name, contact address and governing law are still to be added.
          </p>
        )}
        <div className="mt-8 space-y-6 text-sm leading-relaxed [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

export function ContactLine() {
  return LEGAL.contactEmail ? (
    <a className="underline underline-offset-4" href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
  ) : (
    <span>the contact address that will be listed on this page</span>
  )
}

export function Operator() {
  return <>{LEGAL.operator ?? 'the operator of AskPanel'}</>
}
