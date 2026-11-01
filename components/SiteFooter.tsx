import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="border-t px-4 py-6 text-center text-xs text-muted-foreground">
      <nav className="flex justify-center gap-4">
        <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
        <Link href="/terms" className="hover:text-foreground">Terms</Link>
      </nav>
    </footer>
  )
}
