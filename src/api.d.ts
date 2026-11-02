/** Version 1 request and snapshot types for the session draft API. */
export interface DeskPosition { x: number; y: number }
export interface DeskCharacter {
  /** Stable within this draft; name and array position are not identifiers. */
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
  /** Per-draft optimistic concurrency version, not a timestamp or content hash. */
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
  /** Read committed state held by this host instance. */
  read(sessionId: string): Promise<DeskSnapshot>
  /** Compare the revision and persist one operation; rejects on conflict or failure. */
  mutate(sessionId: string, expectedRevision: number, operation: DeskOperation): Promise<DeskSnapshot>
  /** Wait for a different revision or timeout; cancellation does not roll back writes. */
  watch(sessionId: string, revision: number, options?: { signal?: AbortSignal; timeoutMs?: number }): Promise<DeskSnapshot>
}
/** Plugin-level HTTP errors only. Host authentication errors may use another format. */
export interface DeskFailure {
  error: { code: string; message: string; current?: DeskSnapshot }
}
