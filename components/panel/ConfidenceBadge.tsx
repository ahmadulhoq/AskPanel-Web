import { Badge } from '@/components/ui/badge'
import type { ConfidenceLevel } from '@/types'

const CONFIG: Record<ConfidenceLevel, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  high: { label: 'High confidence', variant: 'default' },
  medium: { label: 'Medium confidence', variant: 'secondary' },
  low: { label: 'Low confidence', variant: 'outline' },
  contested: { label: 'Contested', variant: 'destructive' },
}

export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const { label, variant } = CONFIG[level]
  return <Badge variant={variant}>{label}</Badge>
}
