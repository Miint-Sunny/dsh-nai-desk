import { z } from 'zod'
import { DeskStore, LIMITS, validateRecord } from './desk.js'
import { API_PATH, createDeskHandler } from './host-api.js'
import { PRESET_ID } from './protocol.js'

export const name = 'nai-desk'
export const inject = ['storageDomain', 'sessionQuery', 'agentPresets']

const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/)
const textSchema = z.string().max(LIMITS.fieldCharacters)
const characterSchema = z.object({
  id: idSchema, name: z.string().max(LIMITS.nameCharacters), prompt: textSchema, uc: textSchema, enabled: z.boolean(),
  position: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict().optional(),
}).strict()
const recordSchema = z.object({
  schemaVersion: z.literal(1), sessionId: idSchema, revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  main: textSchema, uc: textSchema, characters: z.array(characterSchema).max(LIMITS.characters),
}).strict().superRefine((value, context) => {
  try { validateRecord(value, value.sessionId) }
  catch (error) { context.addIssue({ code: 'custom', message: error.message }) }
})

// Public DomainSpec shape. Keeping this declaration structural avoids shipping
// a second copy of dsh core packages into a user's profile.
export const draftDomain = {
  name: 'nai_desk', version: 1, layout: 'per-record',
  tables: { drafts: { valueSchema: recordSchema } },
}

export async function apply(ctx) {
  const domain = await ctx.storageDomain.open(draftDomain)
  const table = domain.table('drafts')
  const store = new DeskStore({ persistence: { read: id => table.get(id), write: (id, value) => table.put(id, value) } })
  let unprovide = () => {}, connectionScope
  const isNaiSession = async (id, signal) => {
    let observation
    try {
      observation = await ctx.sessionQuery.observeSession(id, { signal })
      return observation.projections?.values?.agentPreset === PRESET_ID
    } catch (error) {
      if (typeof error?.code === 'string' && error.code.includes('NOT_FOUND')) return false
      throw error
    } finally { observation?.[Symbol.dispose]?.() }
  }
  try {
    unprovide = ctx.reflect.provide('naiDesk', store)
    connectionScope = ctx.inject(['connection'], connected => {
      connected.effect(() => connected.connection.fetch.register({
        path: API_PATH,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: createDeskHandler({ store, isNaiSession }),
      }), 'nai-desk: authenticated route')
    })
    ctx.effect(() => async () => {
      await connectionScope.dispose()
      unprovide()
      await store.close()
      await domain.close()
    }, 'nai-desk: durable draft service')
  } catch (error) {
    await connectionScope?.dispose()
    unprovide()
    await store.close()
    await domain.close()
    throw error
  }
}
