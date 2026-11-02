import z from '@deepseek-ai/schemastery'
import { apply as applyHost, inject as hostInject } from './host.js'
import { apply as applyIsolation, Config as IsolationConfig } from './isolation.js'

export { hideGlobalTools, hideGlobalSkills, shadowCandidates, SHADOW_PROVIDER, SHADOW_RANK } from './isolation.js'
export const name = 'nai-desk'
export const inject = [...hostInject, 'tools', 'skills']
export const Config = z.union([z.object({ mode: z.const('desk').required() }), IsolationConfig])

/** A root mount makes the client discoverable; old preset mounts retain isolation semantics. */
export function apply(ctx, config) {
  const resolved = new Config(config ?? {})
  return resolved.mode === 'desk' ? applyHost(ctx) : applyIsolation(ctx, resolved)
}
