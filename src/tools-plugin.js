import { createDeskTools } from './tools.js'

export const name = 'nai-desk-preset-tools'
export const inject = ['naiDesk', 'tools']

/** Mount this entry inside NAI5's preset scope, never as a global tool plugin. */
export function apply(ctx) {
  ctx.effect(() => {
    const disposers = createDeskTools(ctx.naiDesk).map(tool => ctx.tools.register(tool))
    return () => { for (const dispose of disposers.reverse()) dispose() }
  }, 'nai-desk: preset tools')
}
