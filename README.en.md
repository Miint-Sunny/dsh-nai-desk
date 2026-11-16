# NAI Desk

[中文](README.md) | English

NAI Desk is a prompt-authoring plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), targeting NovelAI Diffusion V5. It provides an NAI5 preset and a session draft editor. Model tools and the editor operate on the same draft; image generation remains on the NovelAI website.

Current source version: **0.2.1**. The new scoped package is being prepared and has not been published.

## Requirements

- DSH App: `>=0.2.1-rc.5 <0.3.0-0`, matching `engines.dsh` in `package.json`.
- macOS only. Windows is not supported yet.
- Model-assisted writing requires a model configured in DSH. Manual draft editing does not send model requests.

## Features

- Edit the Base Prompt and draft-level Undesired Content (UC).
- Follow dsh's theme, fonts and default control patterns in light and dark mode; see [editor styling (Chinese)](https://github.com/Miint-Sunny/dsh-nai-desk/blob/main/docs/ui.md).
- Manage characters: prompt, character UC, name, enabled state, and folding. Move up, move down, and delete sit in the “⋯” menu of each character header; a deletion can be undone.
- Hide text from the model: mask a selected span, or use the eye button in a card header to mask a whole field or character. A closed eye means the model cannot read it, and a masked field shows the same mark on its tab. The model sees only placeholders such as `⟪屏蔽N⟫`, knows something is there, and cannot read or overwrite it; manual copying yields the original text.
- Version history: each model write and manual edit becomes a version you can browse from the panel header and restore with “恢复此版本” (Restore this version).
- Submit manual edits automatically and receive committed updates when connected. Models update drafts through the `desk_*` tools. The first model write in a session pushes the right sidebar open on the draft; each later turn that wrote the draft ends with a card that reopens it.
- Persist drafts by session and load them after restart. Existing chat history is not automatically converted into a draft.
- Use the bundled nai5-prompting skills. The current snapshot is v1.2.9 with 11 skills; provenance and checksums are recorded in [VENDOR.md](VENDOR.md) and [vendor.json](vendor.json).

The plugin does not perform image generation or website form operations and includes no external connector. Text remains selectable for manual copying.

## Installation

The package name is `@miint-sunny/dsh-nai-desk`. This scoped package has not been published to npm. The existing GitHub `v0.2.0` tag uses the old package name.

Before npm publication, get a `.tgz` file from the person sharing the plugin. Open **Plugins → Add plugin** in DSH, enter its absolute path, for example `/path/to/miint-sunny-dsh-nai-desk-0.2.0.tgz`, and install it. A relative path or `~` is not an absolute path.

After npm publication, enter `@miint-sunny/dsh-nai-desk` in the same field. You can also use the DSH App's bundled command. Quit the host using the target profile first, then replace the example with the actual archive path:

```sh
dsh plugin --profile desktop add /path/to/miint-sunny-dsh-nai-desk-0.2.0.tgz
```

The plugin installs independently and includes its built runtime files. Start the corresponding DSH profile after installation and check component status on the Plugins page.

### Migration from the old package name

To migrate, back up the target profile and remove the old package before adding the new one during the same host shutdown:

```sh
dsh plugin --profile desktop remove dsh-nai5-prompting
dsh plugin --profile desktop add @miint-sunny/dsh-nai-desk
```

### Stable identifiers

| Identifier | Value | Purpose |
|---|---|---|
| Repository and product | `dsh-nai-desk` / NAI Desk | Project location and display name |
| Package/install identity | `@miint-sunny/dsh-nai-desk` | New installations and module resolution |
| Row IDs | Existing values such as `nai-desk` / `preset-nai5-prompting` | Existing profile overrides |
| Preset ID | `nai5-prompting` | Existing session associations |

Row IDs, API paths, service identifiers and stored draft formats stay unchanged; see the [architecture notes (Chinese)](https://github.com/Miint-Sunny/dsh-nai-desk/blob/main/docs/architecture.md). Change explicit old module names in custom rows to the scoped name or `@miint-sunny/dsh-nai-desk/tools` while keeping the row IDs and configuration values.

A profile override of the entire `preset-nai5-prompting` row takes precedence over the bundled row. Compare custom overrides with [cordis.patch.yml](cordis.patch.yml) when upgrading, including module names, draft tools and environment instructions; upstream configuration is not automatically merged into them.

## Updating and uninstalling

Installations made by npm package name have an update button on the DSH Plugins page. Local `.tgz` installations do not: get the new archive, uninstall the old package on the Plugins page, and install the new archive by its absolute path.

Use **Uninstall** on the Plugins page to remove the package. Disabling a component stops that component; it does not uninstall the package. Uninstalling does not manage your saved private drafts. Back up important content first. For command-line removal, quit the corresponding host before running:

```sh
dsh plugin --profile desktop remove @miint-sunny/dsh-nai-desk
```

## Usage

1. Select a prompt-authoring workspace. Optional long-term preferences belong in `NAI.md`; see the [example](https://github.com/Miint-Sunny/dsh-nai-desk/blob/main/examples/studio/NAI.md).
2. Start or continue an **NAI5 提示词** session.
3. The draft opens on the first model write. You can also use the **稿纸** card under a reply, or choose **提示词稿纸** from the right sidebar's **+** menu.
4. Describe the request or identify fields to change. Edit the resulting draft and manually copy text into NovelAI.

Request planning only when that is the intended output. Ask for the complete text in chat when needed. Image-input availability depends on the selected model.

The editor saves drafts automatically; file tools write workspace files when requested. A character's enabled state is saved with the draft. Changing it does not rewrite the Base Prompt.

## Known limitations

- Within one host instance, writes are serialized per session and checked against `revision`. The client replays an update only when its target field has not changed remotely. Same-field conflicts require a version choice.
- A write is acknowledged after host storage reports success. Uncommitted edits exist in client memory and are not guaranteed to survive refresh or forced termination.
- There is no cross-process lock or notification mechanism, or automatic draft inheritance when a session is forked. Draft history keeps up to 60 steps. Multiple host processes must not write the same draft storage concurrently.
- Preset isolation controls tool and skill visibility; it is not a process or permission sandbox. dsh remains responsible for file access, tool authorization, and network policy.

See the [API reference (Chinese)](https://github.com/Miint-Sunny/dsh-nai-desk/blob/main/docs/api.md) for data structures, length units, error responses, and retry rules.

Draft tools return the model's view of the draft: masked content appears only as placeholders; other text, including disabled characters, is returned as stored. Manual editing and autosave do not initiate model requests.

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
| Host actually verified | dsh `0.2.1-rc.5`; 0.2.1 was install-checked on `0.2.2-rc.3` |
| Draft HTTP API | `/api/nai-desk/v1` |
| Stored draft schema | `schemaVersion: 1` |

An engine range is not a claim that every matching release was tested. Automated tests, isolated-host checks, and model-quality evaluation provide different evidence. See the [verification record](https://github.com/Miint-Sunny/dsh-nai-desk/blob/main/docs/verification-0.2.1.md) and [changelog](https://github.com/Miint-Sunny/dsh-nai-desk/blob/main/CHANGELOG.md).

## Reporting problems

For a private trial, contact the person who shared the plugin. For public feedback, use [GitHub Issues](https://github.com/Miint-Sunny/dsh-nai-desk/issues). Include:

- DSH App version, plugin name and version.
- macOS version and chip type (Apple silicon or Intel).
- Steps taken, actual result and expected result.
- Component rows that are not running on the Plugins page and the full error text; screenshots are welcome.

Remove keys, tokens, private chat and draft contents before submitting. Reproduce the problem with a small invented example. For output problems limited to one model, include its name, never its API key.

## License

GPL-3.0-only; see [LICENSE](LICENSE) and [NOTICE](NOTICE). Skills originate from [nai5-prompting](https://github.com/Miint-Sunny/nai5-prompting). Bundled third-party code retains its own license notices.

Development, testing, and upstream skill snapshot update instructions are in `AGENTS.md` and `VENDOR.md` in the source repository.
