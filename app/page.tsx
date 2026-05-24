import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <nav className="flex items-center justify-between px-6 py-4">
        <span className="font-bold">AskPanel</span>
        <div className="flex gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link href="/login">
            <Button size="sm">Get started free</Button>
          </Link>
        </div>
      </nav>

      <section className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <h1 className="max-w-xl text-4xl font-bold tracking-tight sm:text-5xl">
          AI deliberation for questions that matter
        </h1>
        <p className="mt-4 max-w-md text-muted-foreground">
          A panel of AI agents debates your question — one answers, one critiques, a synthesizer judges. You get a stress-tested answer, not just a fast one.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/login">
            <Button size="lg">Try free — 5 runs included</Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-20">
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              title: 'You use Claude to write an email.',
              body: 'You use AskPanel to decide whether to send it.',
            },
            {
              title: 'You use ChatGPT to explain a concept.',
              body: 'You use AskPanel to pressure-test a strategy.',
            },
            {
              title: 'You use Gemini to summarise a document.',
              body: 'You use AskPanel to stress-test an investment thesis.',
            },
          ].map(({ title, body }) => (
            <div key={title} className="rounded-lg border p-4">
              <p className="text-sm font-medium">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
