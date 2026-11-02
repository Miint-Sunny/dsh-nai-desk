# Changelog

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
