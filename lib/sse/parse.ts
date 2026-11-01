// Splits buffered SSE text into complete `data:` payloads and the unfinished remainder.
// Used where EventSource can't be (it only supports GET).
export function drainSSE(buffer: string): { data: string[]; rest: string } {
  const data: string[] = []
  let rest = buffer
  let end: number
  while ((end = rest.indexOf('\n\n')) !== -1) {
    for (const line of rest.slice(0, end).split('\n')) {
      if (line.startsWith('data: ')) data.push(line.slice(6))
    }
    rest = rest.slice(end + 2)
  }
  return { data, rest }
}
