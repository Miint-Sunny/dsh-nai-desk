/** Versioned data seam for the model, native panel and future connectors. */
export interface DeskPosition { x: number; y: number }
export interface DeskCharacter {
  id: string
  name: string
  prompt: string
  uc: string
  enabled: boolean
  position?: DeskPosition
}
export interface DeskSnapshot {
  schemaVersion: 1
  sessionId: string
  revision: number
  main: string
  uc: string
  characters: DeskCharacter[]
}
export type CharacterPatch = Partial<Omit<DeskCharacter, 'id' | 'position'>> & { position?: DeskPosition | null }
export type DeskOperation =
  | { type: 'set_main' | 'set_uc'; text: string }
  | { type: 'add_character'; character?: Partial<DeskCharacter>; index?: number }
  | { type: 'set_character'; id: string; patch: CharacterPatch }
  | { type: 'remove_character'; id: string }
  | { type: 'move_character'; id: string; index: number }
export type DeskRequest =
  | { action: 'read'; sessionId: string }
  | { action: 'mutate'; sessionId: string; expectedRevision: number; operation: DeskOperation }
  | { action: 'watch'; sessionId: string; revision: number }
export interface DeskService {
  read(sessionId: string): Promise<DeskSnapshot>
  mutate(sessionId: string, expectedRevision: number, operation: DeskOperation): Promise<DeskSnapshot>
  watch(sessionId: string, revision: number, options?: { signal?: AbortSignal; timeoutMs?: number }): Promise<DeskSnapshot>
}
export interface DeskFailure {
  error: { code: string; message: string; current?: DeskSnapshot }
}
