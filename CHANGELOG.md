# Changelog

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
