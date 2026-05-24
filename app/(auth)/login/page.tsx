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
      </div>
    </main>
  )
}
