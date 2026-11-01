// Module hooks that let Node run the app's TypeScript directly (type stripping):
// resolves the "@/…" alias and extensionless relative imports the way Next's bundler does.
import { existsSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const ROOT_URL = pathToFileURL(ROOT).href

const tryFile = (base) => {
  if (existsSync(base) && statSync(base).isFile()) return base
  for (const ext of ['.ts', '.tsx', '/index.ts']) if (existsSync(base + ext)) return base + ext
  return null
}

export async function resolve(spec, ctx, next) {
  let base = null
  if (spec.startsWith('@/')) base = path.join(ROOT, spec.slice(2))
  else if (/^\.\.?\//.test(spec) && ctx.parentURL?.startsWith(ROOT_URL)) {
    base = path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), spec)
  }
  if (base) {
    const file = tryFile(base)
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true }
  }
  return next(spec, ctx)
}

export async function load(url, ctx, next) {
  if (url.startsWith(ROOT_URL) && url.endsWith('.ts')) return next(url, { ...ctx, format: 'module-typescript' })
  return next(url, ctx)
}
