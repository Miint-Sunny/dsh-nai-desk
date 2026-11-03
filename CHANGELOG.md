# Changelog

## 0.2.0 · 2026-11-03

- First stable NAI Desk release. The plugin code is 0.2.0-preview.7 unchanged; this release updates version metadata and documentation only.
- Compared with 0.1.6, the 「NAI5 提示词」 preset gains a per-session prompt sheet (稿纸) in the right sidebar: Base prompt/UC and character editors, ordering, enabling, deleting with undo, folding and full-column editing; masking text from the model; version history; and a chat card that reopens the sheet. Models edit the same sheet through `desk_*` tools with revision checks.
- Keep the install identity `dsh-nai5-prompting`, the preset ID `nai5-prompting` and the vendored nai5-prompting v1.2.8 skills, byte-identical to 0.1.6. Requires dsh 0.2.1-rc.5 or newer below 0.3.0. The repository is now dsh-nai-desk; the README covers upgrading from the old address.

## 0.2.0-preview.7 · 2026-11-03

- Show masking with the eye itself: the toggle uses the host's credential reveal artwork, an open eye while the model can read the field or character and a closed eye while it cannot. The text tag is gone. The accessible name stays fixed with `aria-pressed`, and a masked Base/UC field also marks its tab.
- Remove duplicated information: the 「角色 N」 section heading repeated the character cards' own names, and the history bar repeated the version number shown in the header. Space now separates the base card from the characters (24px between groups, 12px within).
- Move up, move down and delete into a per-character 「⋯」 menu adapted from the host Menu. The header keeps masking, the enabled switch and folding, and stays on one line down to 320px. Deleting by keyboard moves focus to Undo.
- Make the full-column tool follow the host's fullscreen button: its label and glyph change with the state instead of relying on a background color.
- Rewrite the panel and chat-card copy to one vocabulary (稿纸, 主提示词, UC, 角色, 版本, 恢复此版本, 返回当前版本, 保存中…/已保存) and record it in docs/ui.md. Format history times with `Intl`, list every changed part, and show a masked span's original text in full.
- History versions keep showing mask and enabled states read-only instead of swapping in text tags.
- Publish versions as Git tags only. The README no longer points to a prerelease page with a `.tgz` package.

## 0.2.0-preview.6 · 2026-11-03

- Open the draft from the conversation: the first model write in a session pushes the right sidebar open on the draft, as the host does for submitted plans; each Turn that wrote the draft ends with a plan-style card whose Open action reopens it.
- Hide text from the model. Mask a selected span, a whole Base/UC field, or a whole character. Model tools see placeholders such as `⟪屏蔽1⟫` and reject writes that drop or invent placeholders or touch masked fields; the editor paints placeholders as chips, deletes them whole, and copies the original text.
- Add draft history: model writes and manual edits are recorded as steps (merged when close together, up to 60), browsable from the panel header in a read-only view and restorable as a new step. History is stored in its own `nai_desk_history` domain.
- Give the base and character cards the composer's glass material: no border, input-major fill, and the elevation shadow whose first layer is the 0.5px translucent stroke; the focused card's stroke takes the accent color.
- Record whether the latest revision came from the editor or the model. Existing drafts load unchanged.
- Add the placeholder rule to the NAI5 preset instructions and draft tool descriptions.

## 0.2.0-preview.5 · 2026-11-02

- Follow the host's own sidebar page layout, not only its colors: a 38px header with the save status and the full-column tool, aligned with the conversation header seam, as on the Workspace files tab.
- Show an icon and the short name "稿纸" on the sidebar tab, so the active tab no longer fades out its title.
- Use the settings-card material for the base and character cards (R20, hairline stroke, no shadow); elevation stays reserved for floating surfaces and the composer.
- Replace the check button with the host Switch for enabling a character, use arrows for moving and chevrons for folding, and keep pressed tools neutral instead of accent-filled.
- Show character names inline, grow prompt fields with their text instead of a resize grip, and mark the focused card with the accent stroke.
- Use the dashed add row from the Models settings page, drop the footer note, and restyle undo, error and conflict notices with host state colors.
- Preserve draft operations, API contracts, stored data and all vendored skills.

## 0.2.0-preview.4 · 2026-11-02

- Correct the editor surface to use the host composer's input-major fill, l2 elevation stroke and soft shadow instead of an ordinary layer-1 card.
- Remove the darker name-field fill and align placeholder color with the composer.
- Compare computed backgrounds, borders and shadows against the real host composer in both themes; all checked values match.

## 0.2.0-preview.3 · 2026-11-02

- Match the editor to DeepSeek Harness themes: semantic colors, shared typography, corner radii, hairline borders and keyboard focus.
- Adapt the host's Button, Input, SegmentedControl and selected icons locally, following its third-party plugin guidance; no internal Client-module imports.
- Add arrow-key and Home/End navigation to prompt tabs with associated panels and roving focus.
- Follow the host's text font and content size settings; keep character actions usable in narrow panels.
- Preserve draft operations, API contracts, installed identifiers and all vendored skills.

## 0.2.0-preview.2 · 2026-11-02

### Changed

- Separate the user guide, API contract, architecture notes and verification records.
- Define preset visibility controls separately from host permissions and process isolation.
- Document the single-host scope of revision checks, uncommitted edit lifetime, storage limits and error handling.
- Standardize plugin and tool descriptions around drafts, fields, revisions and observable effects.
- Correct editor status labels so connection errors are not presented as proof of unsaved data; use a fixed ON-state label for the character toggle.
- Preserve API paths, request fields, error codes, stored schema and vendored skills. No data migration is required.

## 0.2.0-preview.1 · 2026-11-02

- Rename the repository to dsh-nai-desk and the plugin display name to NAI Desk.
- Keep the dsh-nai5-prompting installation identity, nai5-prompting preset ID, legacy isolation entry, history and stable tags.
- Ship the NAI5-only editable prompt sidebar in the existing preset package.
- Add Base/UC and per-character editors, ordering, enable/disable, delete/undo, folding and full-column editing.
- Add persistent session drafts, revision conflict protection and authenticated read/write/watch interfaces.
- Keep all 11 nai5-prompting v1.2.8 skills byte-identical.
- Require dsh 0.2.1-rc.5 or newer below 0.3.0. Installation uses prebuilt JavaScript without build hooks.
- No dice, clipboard scripts, website filling, OC, blocks, MCP or W.O.F integration.

Earlier releases remain in Git history and tags, including stable v0.1.6.
