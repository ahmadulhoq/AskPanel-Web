import Link from 'next/link'
import { AuthForm } from '@/components/auth/AuthForm'

export const metadata = { title: 'Sign in — AskPanel' }

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">AskPanel</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI deliberation for questions that matter
          </p>
        </div>
        <AuthForm />
        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to the{' '}
          <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">Terms</Link> and{' '}
          <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">Privacy policy</Link>.
        </p>
      </div>
    </main>
  )
}
