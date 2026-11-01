import { NextResponse, type NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'

const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB
const MAX_CONTEXT_CHARS = 4000

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = adminDb()
  const userSnap = await db.collection('users').doc(user.uid).get()
  const tier = userSnap.data()?.subscription?.tier ?? 'free'
  if (tier !== 'pro') {
    return NextResponse.json({ error: 'Pro subscription required' }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File must be under 5 MB' }, { status: 400 })
  }

  const fileName = file instanceof File ? file.name.toLowerCase() : ''
  const isPdf = fileName.endsWith('.pdf') || file.type === 'application/pdf'
  const isTxt =
    fileName.endsWith('.txt') ||
    fileName.endsWith('.md') ||
    file.type.startsWith('text/')

  if (!isPdf && !isTxt) {
    return NextResponse.json(
      { error: 'Only .txt, .md, and .pdf files are supported' },
      { status: 400 },
    )
  }

  try {
    let text: string

    if (isPdf) {
      const buffer = Buffer.from(await file.arrayBuffer())
      // Use the Node-specific export to avoid browser-bundle issues
      const { PDFParse } = await import('pdf-parse')
      const parser = new PDFParse({ data: buffer })
      const result = await parser.getText()
      text = result.text
        .replace(/\s{3,}/g, '\n\n')
        .trim()
    } else {
      text = await file.text()
    }

    if (!text.trim()) {
      return NextResponse.json({ error: 'No text could be extracted from the file' }, { status: 422 })
    }

    if (text.length > MAX_CONTEXT_CHARS) {
      text = text.slice(0, MAX_CONTEXT_CHARS) + '…'
    }

    return NextResponse.json({ text })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to parse file'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
