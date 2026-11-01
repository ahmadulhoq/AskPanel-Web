import type Anthropic from '@anthropic-ai/sdk'
import type { AgentPrompt } from './prompts'
import { getPersona } from './personas'
import { optionName } from './compareState'

// Compare-options mode (spec §7.3). Separate from the critique prompts, which are unchanged.
// System prompts are static so they cache (cache_control is applied by the callers).

const PROPOSER_SYSTEM = `You are a Proposer in a compare-options panel. Several proposers each put forward one option for the user's decision; then a Critic tests every option against the user's goals and a Judge picks the best one.

Your job: propose exactly ONE concrete, realistic option and make the strongest honest case for it.
- Start with a markdown heading naming the option in a few words, e.g. "### Bootstrap for 12 months".
- Then: what the option is in practice, why it fits this user's situation, the main risks or costs, and when it would be the wrong choice.
- Your option must be clearly different from the options already proposed — not a variation of one.
- Be specific and practical. Under 300 words. Clean markdown.`

const CRITIC_SYSTEM = `You are the Critic in a compare-options panel. Several proposers have each put forward one option. Your job is quality assurance across all of them, not picking a winner.

For each option, in order:
- its strongest point,
- its biggest weakness or risk for this user,
- what would have to be true for it to fail.
Test the options against the user's stated goals and constraints, and call out anything a proposer claimed without support. Be fair: if an option is strong, say so. Do not recommend a winner — the Judge does that. Clean markdown, under 400 words.`

const JUDGE_SYSTEM = `You are the Judge in a compare-options panel. You have the user's question, the options the proposers put forward, and the Critic's assessment. Pick the option that best serves the user, using the judge_options tool.

- Score every option from 1 to 10 for this user, with a one-sentence reason.
- The finalAnswer is what the user reads first: recommend the winner, say why each other option lost, and name the conditions under which you would choose differently. Clean markdown.
- Confidence: "high" if the winner is clearly better, "medium" if it wins on balance, "low" if the call is close or depends on unknowns, "contested" if reasonable people would choose differently.`

type CustomOverride = { label?: string }

// A persona shapes the panel's lens; its critique-specific prompts don't apply here.
function lens(personaKey: string, custom?: CustomOverride): string {
  if (personaKey === 'custom' && custom?.label) return `\n\nLens for this panel: ${custom.label}.`
  if (personaKey === 'general') return ''
  const persona = getPersona(personaKey)
  return `\n\nLens for this panel: ${persona.label} — ${persona.description}.`
}

const optionsBlock = (proposals: string[]) =>
  proposals.map((p, i) => `[OPTION ${i + 1}]\n${p}`).join('\n\n---\n\n')

export function buildProposerPrompt(
  question: string,
  index: number,
  previous: string[],
  personaKey = 'general',
  context?: string,
  custom?: CustomOverride,
): AgentPrompt {
  const taken = previous.length
    ? `\n\nOptions already proposed (yours must be clearly different):\n${previous.map((p, i) => `- ${optionName(p, `Option ${i + 1}`)}`).join('\n')}`
    : ''
  const assignment = `\n\nYou are proposer ${index + 1}. If the question names specific options, argue for option number ${index + 1} of those it names; if it names fewer than ${index + 1}, propose the strongest alternative not yet covered.`
  const user = `${context ? `${context}\n\n` : ''}Question: ${question}${taken}${assignment}`
  return { system: PROPOSER_SYSTEM + lens(personaKey, custom), user }
}

export function buildCompareCriticPrompt(question: string, proposals: string[], personaKey = 'general', context?: string, custom?: CustomOverride): AgentPrompt {
  const user = `${context ? `${context}\n\n` : ''}Question: ${question}\n\nThe options:\n\n${optionsBlock(proposals)}`
  return { system: CRITIC_SYSTEM + lens(personaKey, custom), user }
}

export function buildJudgePrompt(question: string, proposals: string[], critique: string, context?: string): AgentPrompt {
  const user = `${context ? `${context}\n\n` : ''}Question: ${question}\n\nThe options:\n\n${optionsBlock(proposals)}\n\n---\n\n[CRITIC]\n${critique}`
  return { system: JUDGE_SYSTEM, user }
}

export const JUDGE_TOOL: Anthropic.Tool[] = [
  {
    name: 'judge_options',
    description: 'Record the verdict: which option wins, how each scored, and the final answer.',
    input_schema: {
      type: 'object' as const,
      properties: {
        winner: { type: 'integer', description: 'The winning option number (1-based, as labelled [OPTION n]).' },
        scores: {
          type: 'array',
          description: 'One entry per option.',
          items: {
            type: 'object',
            properties: {
              option: { type: 'integer', description: 'Option number (1-based).' },
              score: { type: 'integer', minimum: 1, maximum: 10 },
              summary: { type: 'string', description: 'One sentence: why this score.' },
            },
            required: ['option', 'score', 'summary'],
          },
        },
        reasoning: { type: 'string', description: 'One to three sentences on why the winner wins.' },
        confidence: { type: 'string', enum: ['high', 'medium', 'low', 'contested'] },
        finalAnswer: {
          type: 'string',
          description: 'Markdown for the user: the recommendation, why each other option lost, and when you would choose differently.',
        },
      },
      required: ['winner', 'scores', 'reasoning', 'confidence', 'finalAnswer'],
    },
  },
]
