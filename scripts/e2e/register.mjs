// node --import ./scripts/e2e/register.mjs <script> — see node-hooks.mjs
import { register } from 'node:module'
register('./node-hooks.mjs', import.meta.url)
