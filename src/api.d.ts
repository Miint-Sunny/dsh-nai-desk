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
  /** Present and true when the user hid this whole character from the model. */
  masked?: true
}
/** Placeholder such as `⟪屏蔽1⟫`; the text it stands for lives in `secrets`. */
export type MaskToken = `⟪屏蔽${number}⟫`
export interface DeskSnapshot {
  schemaVersion: 1
  sessionId: string
  /** Per-draft optimistic concurrency version, not a timestamp or content hash. */
  revision: number
  main: string
  uc: string
  characters: DeskCharacter[]
  /** Fields the user hid from the model as a whole. */
  mask?: { main?: true; uc?: true }
  /** Original text of each masked span. Returned to the editor only, never to model tools. */
  secrets?: Record<MaskToken, string>
  /** Who made the latest revision. */
  updatedBy?: 'user' | 'model'
}
/** Editor field ids: main, uc, character:<id>:prompt or character:<id>:uc. */
export type DeskTextField = 'main' | 'uc' | `character:${string}:prompt` | `character:${string}:uc`
export type CharacterPatch = Partial<Omit<DeskCharacter, 'id' | 'position' | 'masked'>> & { position?: DeskPosition | null; masked?: boolean }
export type DeskOperation =
  | { type: 'set_main' | 'set_uc'; text: string }
  | { type: 'add_character'; character?: Partial<DeskCharacter>; index?: number }
  | { type: 'set_character'; id: string; patch: CharacterPatch }
  | { type: 'remove_character'; id: string }
  | { type: 'move_character'; id: string; index: number }
  | { type: 'set_mask'; field: 'main' | 'uc'; masked: boolean }
  | { type: 'mask_span'; field: DeskTextField; text: string; token: MaskToken; secret: string }
  | { type: 'unmask'; token: MaskToken }
  | { type: 'restore'; revision: number }
export interface DeskHistoryStep {
  /** Draft revision at the end of this step. */
  revision: number
  /** Milliseconds since the epoch; null for the baseline of a draft written before history existed. */
  at: number | null
  source: 'user' | 'model' | 'earlier'
  /** Short labels of what changed, such as 主提示词 or 新增 Character 2. */
  parts: string[]
  restored?: true
}
export interface DeskHistory { sessionId: string; revision: number; steps: DeskHistoryStep[] }
export type DeskVersion = Pick<DeskSnapshot, 'sessionId' | 'revision' | 'main' | 'uc' | 'characters' | 'mask' | 'secrets'>
export type DeskRequest =
  | { action: 'read'; sessionId: string }
  | { action: 'mutate'; sessionId: string; expectedRevision: number; operation: DeskOperation }
  | { action: 'watch'; sessionId: string; revision: number }
  | { action: 'history'; sessionId: string }
  | { action: 'version'; sessionId: string; revision: number }
export interface DeskService {
  /** Read committed state held by this host instance. */
  read(sessionId: string): Promise<DeskSnapshot>
  /** Compare the revision and persist one operation; rejects on conflict or failure. */
  mutate(sessionId: string, expectedRevision: number, operation: DeskOperation, options?: { source?: 'user' | 'model' }): Promise<DeskSnapshot>
  /** Step list without draft bodies, oldest first. */
  history(sessionId: string): Promise<DeskHistory>
  /** Draft body of one history step. */
  version(sessionId: string, revision: number): Promise<DeskVersion>
  /** Wait for a different revision or timeout; cancellation does not roll back writes. */
  watch(sessionId: string, revision: number, options?: { signal?: AbortSignal; timeoutMs?: number }): Promise<DeskSnapshot>
}
/** Plugin-level HTTP errors only. Host authentication errors may use another format. */
export interface DeskFailure {
  error: { code: string; message: string; current?: DeskSnapshot }
}
