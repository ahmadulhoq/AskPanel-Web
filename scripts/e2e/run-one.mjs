// Runs one panel job in its own process, so a scenario can kill it mid-run.
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const { runPanelJob } = await import(pathToFileURL(path.join(ROOT, 'lib/agents/runner.ts')).href)
await runPanelJob(process.argv[2])
