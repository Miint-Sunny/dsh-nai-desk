# NAI Desk

[中文](README.md) | English

NAI Desk is a prompt-authoring plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), targeting NovelAI Diffusion V5. It provides an NAI5 preset and a session draft editor. Model tools and the editor operate on the same draft; image generation remains on the NovelAI website.

Current version: **0.2.0-preview.5** (prerelease).

## Features

- Edit the Base Prompt and draft-level Undesired Content (UC).
- Follow dsh's theme, fonts and default control patterns in light and dark mode; see [editor styling (Chinese)](docs/ui.md).
- Manage character prompts: positive text, character-level UC, display names, order, enabled state, delete/undo, and folding.
- Submit manual edits automatically and receive committed updates when connected. Models update drafts through the `desk_*` tools.
- Persist drafts by session and load them after restart. Existing chat history is not automatically converted into a draft.
- Use the bundled nai5-prompting skills. The current snapshot is v1.2.8 with 11 skills; provenance and checksums are recorded in [VENDOR.md](VENDOR.md) and [vendor.json](vendor.json).

The plugin does not perform image generation or website form operations and includes no external connector. Text remains selectable for manual copying.

## Installation and upgrades

Add an installation source in the DeepSeek Harness plugin manager, or use its CLI. Before running the CLI command below, fully quit the desktop app and TUI (⌘Q on macOS).

```sh
dsh plugin --profile desktop add github:Miint-Sunny/dsh-nai-desk#v0.2.0-preview.5
```

A `.tgz` package is available on the [prerelease page](https://github.com/Miint-Sunny/dsh-nai-desk/releases/tag/v0.2.0-preview.5). Release packages contain compiled output and do not run this plugin's build during installation. Development installations can use `link:/absolute/path/to/checkout`; linked installs use working-tree files directly, so quit dsh before rebuilding or switching versions.

### Stable identifiers

| Identifier | Value | Purpose |
|---|---|---|
| Repository and product | `dsh-nai-desk` / NAI Desk | Project location and display name |
| Package/install identity | `dsh-nai5-prompting` | Existing dependency and profile compatibility |
| Preset ID | `nai5-prompting` | Existing session associations |

This is one plugin package; no separate sidebar package is required. See the [architecture notes (Chinese)](docs/architecture.md) for the compatibility rationale.

A profile override of the entire `preset-nai5-prompting` row takes precedence over the bundled row. Compare custom overrides with [cordis.patch.yml](cordis.patch.yml) when upgrading; upstream configuration is not automatically merged into them.

If an upgrade from the old repository address fails an integrity check for the old GitHub archive, back up the profile, remove the old dependency, and install from the new address:

```sh
dsh plugin --profile desktop remove dsh-nai5-prompting
dsh plugin --profile desktop add github:Miint-Sunny/dsh-nai-desk#v0.2.0-preview.5
```

Do not replace integrity hashes to suppress an error. Stable `v0.1.6` remains available under the new repository address for rollback; it does not provide the draft editor.

## Usage

1. Select a prompt-authoring workspace. Optional long-term preferences belong in `NAI.md`; see the [example](examples/studio/NAI.md).
2. Start or continue an **NAI5 提示词** session.
3. Open the right sidebar and select **提示词稿纸**.
4. Describe the request or identify fields to change. Edit the resulting draft and manually copy text into NovelAI.

Request planning only when that is the intended output. Ask for the complete text in chat when needed. Image-input availability depends on the selected model.

The editor saves drafts automatically; file tools write workspace files when requested. A character's enabled state is saved with the draft. Changing it does not rewrite the Base Prompt.

## Synchronization and data boundaries

- Within one host instance, writes are serialized per session and checked against `revision`. The client replays an update only when its target field has not changed remotely. Same-field conflicts require a version choice.
- A write is acknowledged after host storage reports success. Uncommitted edits exist in client memory and are not guaranteed to survive refresh or forced termination.
- There is no cross-process lock or notification mechanism, draft revision history, or automatic draft inheritance when a session is forked. Multiple host processes must not write the same draft storage concurrently.
- Preset isolation controls tool and skill visibility; it is not a process or permission sandbox. dsh remains responsible for file access, tool authorization, and network policy.

See the [API reference (Chinese)](docs/api.md) for data structures, length units, error responses, and retry rules.

Draft tools return the complete draft to the model, including text from disabled characters. Manual editing and autosave do not initiate model requests.

## Preset configuration

The default preset mounts prompting skills, file and image tools, user questions, available host web tools, draft tools, and context-compaction components. Global tools and skills are excluded by default.

| Setting | Default | Meaning |
|---|---|---|
| `hideGlobalTools` | `true` | Hide global tools from this preset |
| `keepGlobalTools` | `[]` | Exceptions to the tool visibility rule |
| `hideGlobalSkills` | `true` | Hide global skills from this preset |
| `keepGlobalSkills` | `[]` | Exceptions to the skill visibility rule |

Project instructions use `NAI.md`. Host-level instructions and permissions still follow dsh policy. Prompt delivery is guided by the preset instructions and skills; the plugin does not guarantee that every model follows them correctly.

## Compatibility and verification

| Item | Current declaration |
|---|---|
| Installer engine range | dsh `>=0.2.1-rc.5 <0.3.0-0` |
| Host actually verified | dsh `0.2.1-rc.5` |
| Draft HTTP API | `/api/nai-desk/v1` |
| Stored draft schema | `schemaVersion: 1` |

An engine range is not a claim that every matching release was tested. Automated tests, isolated-host checks, and model-quality evaluation provide different evidence. See the [verification record](docs/verification-0.2.0-preview.5.md) and [changelog](CHANGELOG.md).

## Development

```sh
npm ci --ignore-scripts
npm test
npm pack
```

`npm test` builds before testing. `npm pack` packages existing files; ensure `lib/` matches the source before release. Do not edit generated bundles directly.

`skills/` is an upstream snapshot checked against `vendor.json`. Update it with `node scripts/sync-skills.mjs <tag>`, not direct edits.

## License

GPL-3.0-only; see [LICENSE](LICENSE) and [NOTICE](NOTICE). Skills originate from [nai5-prompting](https://github.com/Miint-Sunny/nai5-prompting). Bundled third-party code retains its own license notices.
