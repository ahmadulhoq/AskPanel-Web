'use client'

import { useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase/client'

const googleProvider = new GoogleAuthProvider()

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(getFirebaseAuth(), (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  async function signInWithGoogle() {
    const result = await signInWithPopup(getFirebaseAuth(), googleProvider)
    await exchangeTokenForSession(result.user)
    return result.user
  }

  async function signInWithEmail(email: string, password: string) {
    const result = await signInWithEmailAndPassword(getFirebaseAuth(), email, password)
    await exchangeTokenForSession(result.user)
    return result.user
  }

  async function signUpWithEmail(email: string, password: string) {
    const result = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password)
    await exchangeTokenForSession(result.user)
    return result.user
  }

  async function signOut() {
    await firebaseSignOut(getFirebaseAuth())
    await fetch('/api/auth/session', { method: 'DELETE' })
  }

  return { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut }
}

async function exchangeTokenForSession(user: User) {
  const idToken = await user.getIdToken()
  await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
}
