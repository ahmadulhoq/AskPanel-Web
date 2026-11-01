'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'

export function SignOutButton() {
  const router = useRouter()
  const { signOut } = useAuth()

  async function handleSignOut() {
    await signOut()
    router.push('/login')
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground">
      Sign out
    </Button>
  )
}
