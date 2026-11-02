/** Masked spans: the draft keeps a placeholder in the text and the original in `secrets`. Shared by host and editor. */
export const MASK_TOKEN = /⟪屏蔽\d{1,4}⟫/g
export const TOKEN_PATTERN = /^⟪屏蔽\d{1,4}⟫$/
export const maskToken = n => `⟪屏蔽${n}⟫`
export const tokensIn = value => value.match(MASK_TOKEN) ?? []
export const tokenRanges = value => [...value.matchAll(MASK_TOKEN)].map(match => ({ token: match[0], start: match.index, end: match.index + match[0].length }))
export const revealText = (value, secrets) => value.replace(MASK_TOKEN, token => secrets?.[token] ?? token)

/** Next unused placeholder, also skipping numbers that still appear in text after their secret was removed. */
export function nextToken(draft) {
  const texts = [draft.main, draft.uc, ...draft.characters.flatMap(c => [c.prompt, c.uc])]
  const numbers = [...Object.keys(draft.secrets ?? {}), ...texts.flatMap(tokensIn)].map(token => Number(/\d+/.exec(token)[0]))
  return maskToken(Math.max(0, ...numbers) + 1)
}
