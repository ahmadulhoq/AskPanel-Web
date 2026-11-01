'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, Share2 } from 'lucide-react'

interface Props {
  url: string
}

export function ShareButton({ url }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    try {
      if (navigator.share) {
        await navigator.share({ url })
      } else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // User cancelled native share or clipboard was denied — silent fail.
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleShare}>
      {copied ? (
        <>
          <Check className="mr-1.5 h-3.5 w-3.5 text-green-600" />
          Copied
        </>
      ) : (
        <>
          <Share2 className="mr-1.5 h-3.5 w-3.5" />
          Share
        </>
      )}
    </Button>
  )
}
