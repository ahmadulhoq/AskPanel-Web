import { redirect } from 'next/navigation'

// Conversations live on the dashboard now (v2 M4).
export default function ChatListPage() {
  redirect('/dashboard')
}
