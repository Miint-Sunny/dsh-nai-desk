# NAI Desk

[中文](README.md) | English

Adds an "NAI5 提示词" (NAI5 prompting) agent preset to [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh). The preset plans, designs, and writes NovelAI V5 prompts with the 11 split skills of [nai5-prompting](https://github.com/Miint-Sunny/nai5-prompting). It delivers text only and calls no image-generation API. It does not affect the other dsh presets, and they do not affect it.

## 0.2.0 Preview: one package for the preset and sidebar

Current version: **0.2.0-preview.1**. The repository is now `dsh-nai-desk` and the plugin display name is **NAI Desk**. The installation identity remains `dsh-nai5-prompting` and the preset ID remains `nai5-prompting`, retaining existing installations, sessions, history, and stable tags.

- Base Prompt / UC tabs with full-column editing.
- Per-character Prompt / UC, names, ordering, enable/disable, delete/undo, and folding.
- Per-session persistence shared by model tools and manual edits, with revision conflicts that preserve unsaved local text.
- Open the right sidebar in an NAI5 session and choose **提示词稿纸**. Select and copy text yourself into the NovelAI website.

The default bundle includes everything; no second plugin or manual preset patch is needed. If your profile overrides the entire `preset-nai5-prompting` row, update it using [cordis.patch.yml](cordis.patch.yml). No dice, copy buttons, clipboard scripts, website filling, OC lookup, block library, MCP, or W.O.F connector is included.

Types are in [src/api.d.ts](src/api.d.ts). Authenticated `POST /api/nai-desk/v1` supports read/mutate/watch for NAI5 sessions only. Drafts use the host's `nai_desk` storage domain, not custom session events. Limits: 32,768 characters per field, 1 MiB per draft, 22 characters. Forked sessions currently start with an empty draft; confirm changes are saved before closing or reloading.

See [CHANGELOG.md](CHANGELOG.md) and the [verification report](docs/verification-0.2.0-preview.1.md). This is a prerelease; stable v0.1.6 and earlier tags remain available.

## What the preset contains

Pick "NAI5 提示词" from the preset menu when you start a session (the button that shows "Standard mode" by default).

- **System prompt**: replaced entirely by prompt-writing instructions; the coding instructions never appear. The instructions state what this environment can do: text drafts in dsh, no image generation or website filling, and NovelAI presets assumed off. The method itself comes from the skills.
- **Skills**: only the 11 split skills of nai5-prompting v1.2.8, copied byte for byte (see [VENDOR.md](VENDOR.md)).
- **Tools**: loading skills, reading and writing workspace files, viewing images, asking you questions, web search and fetch for checking tags and character names, and draft read/write tools. There is no terminal, subagent, plan mode, todo list, or MCP. From dsh 0.2.2, a step omits web search when the current model route has no credentials for the search service.
- **Long sessions**: automatic compaction near the context limit, plus a manual `/compact`.

## Isolation

| | NAI5 prompting preset | Other presets (Standard, Creator, …) |
|---|---|---|
| System prompt | only this plugin's instructions | unchanged |
| Skills | only the 11 nai5 skills; `~/.dsh/skills`, `~/.agents/skills`, project skills, and global skills (such as Desktop's Office skills) are hidden | unchanged; the nai5 skills are not visible |
| Tools | only the tools this preset mounts; MCP servers, host plugins, and other global tools are hidden | unchanged |
| Workspace instruction files | only the workspace's `NAI.md`; `AGENTS.md` and `CLAUDE.md` are not read | unchanged; `NAI.md` is not read |

Isolation applies to every session that uses this preset, including a blank session switched to it. The draft route uses the host’s authenticated Connection without a separate listener, writes no custom session events, and does not change the default preset.

Exception: dsh always reads the global instruction files `~/.dsh/AGENTS.md` and `~/.agents/AGENTS.md`, and no preset can turn them off. Keep coding rules in each repository's own `AGENTS.md` instead.

## Install

Requires dsh **0.2.1-rc.5 or later, below 0.3.0** (`engines.dsh` in `package.json`). The 0.2.0 preview is verified on rc.5; other versions need compatibility checks. Historical results below retain their original scope. The plugin is plain JavaScript: installation runs no build and needs no `allowBuilds` entry.

**Desktop**: select **Plugins** in the sidebar (not Settings), then **+ Add plugin** at the top right; the arrow beside it offers the same entry as **Install a third-party plugin**. Enter `github:Miint-Sunny/dsh-nai-desk#v0.2.0-preview.1`, then select **Install**. To guard against a moved tag, replace `v0.2.0-preview.1` with the commit listed on the [release page](https://github.com/Miint-Sunny/dsh-nai-desk/releases). The same field also takes the path of a local checkout. Alternatively, fully quit Desktop (⌘Q) and run its bundled CLI:

```bash
"/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh" plugin --profile desktop add github:Miint-Sunny/dsh-nai-desk#v0.2.0-preview.1
```

**Other profiles** (for example `dsh web`):

```bash
dsh plugin --profile web add github:Miint-Sunny/dsh-nai-desk#v0.2.0-preview.1
```

The release also carries `dsh-nai-desk-0.2.0-preview.1.tgz`; its path works in place of the `github:` spec without fetching the repository. To uninstall, remove the plugin on the Plugins page, or quit Desktop and run `dsh plugin --profile desktop remove dsh-nai5-prompting`. Sessions created with this preset cannot resume while the plugin is uninstalled; reinstalling it restores them.

## Use

1. Make a dedicated directory for prompt work, such as `~/NAI`, and add it as a workspace. Avoid code repositories.
2. Put an `NAI.md` there with long-term preferences, fixed artist strings, your UC, and where your OC sheets live; start from [examples/studio/NAI.md](examples/studio/NAI.md). Every session reads it, and it is read again after compaction.
3. Start a session with the "NAI5 提示词" preset and describe what you want. The default deliverable is a ready-to-copy prompt: given only a subject (such as "a scene with lotus leaves") or a chosen direction, it first states the picture decisions it filled in, in a few lines, then gives the complete prompt, adding a few alternative directions when the subject is open. Say "just give me directions" or "design only" when you want ideas, character or outfit designs, or comic storyboards without a prompt.
4. Ask explicitly when something should be saved ("save this character to the OC library"). Workspace files are written only on request; automatic draft persistence is separate session companion data.
5. Prompt reverse-engineering from an image needs a model with image input, such as `deepseek-flash` in the built-in catalog; dsh refuses image messages for text-only models.

## Memory and context

dsh has no cross-session memory. This preset relies on:

- **`NAI.md`**: long-term preferences and a resource index, read by every session, re-read after compaction, and picked up on the next step after an edit.
- **Workspace files**: OC sheets and finished prompts stored as files and read when needed; artist strings, UC, and locked prompt text stay verbatim.
- **`@` references**: `@` a past session to bring its text in as read-only background; `@file` inserts a path for the model to read.

Semantic memory MCP servers (Memorix, MCP Reference Memory, Engram in the dsh docs) are not recommended here: they paraphrase and retrieve approximately, while the skills require verbatim strings.

Known limitation: dsh's compaction summary prompt is fixed, written for coding sessions, and produces an English summary. It rarely triggers on DeepSeek's long context; after a compaction, `NAI.md` and workspace files restore the long-term facts.

## Configuration

The `isolation` row (this plugin) has four switches:

| Key | Default | Effect |
|---|---|---|
| `hideGlobalTools` | `true` | hide global tools (MCP servers, host plugins, Desktop add-ons) |
| `keepGlobalTools` | `[]` | global tool names to keep visible |
| `hideGlobalSkills` | `true` | hide global skills (such as Desktop's Office skills) |
| `keepGlobalSkills` | `[]` | global skill names to keep visible |

To change anything, including the preset name, the system prompt, or the tools, copy the whole `preset-nai5-prompting` row from [cordis.patch.yml](cordis.patch.yml) into your profile's `cordis.patch.yml` and edit it there. A dsh patch replaces the row's entire config, so a partial row would drop the rest.

## Updating the skills

`skills/` is a byte-for-byte copy of one nai5-prompting release tag; `vendor.json` records the tag, commit, and the SHA-256 of every file. Do not edit the skill files here; the tests reject it. For a new upstream release:

```bash
node scripts/sync-skills.mjs v1.3
```

The script clones the tag, checks every file against the release's own `SHA256SUMS.txt`, replaces `skills/`, and rewrites `vendor.json`. Then update the version in the READMEs, run `npm test`, and commit.

## Development

```bash
npm install --ignore-scripts
npm test
```

## Verified

**0.1.6, 2026-11-02.** Only the vendored skills changed: nai5-prompting v1.2.8 fixes two nai5-writing reference files after Gemini's upstream report (a base prompt alone when the user only wants the action and the scene, two old word-order notes aligned with the template, the closing period note for example sentences); no `SKILL.md` and no plugin code changed. v1.2.8 also ships strict / strict-safe packs for the Gemini web app; this plugin keeps the split skills. Only `npm test` ran for this release; the runtime checks below were not repeated.

**0.1.5, 2026-10-30.** Only the vendored skills changed: nai5-prompting v1.2.7 corrects v1.2.6 so that `source#`, `target#`, and `mutual#` prefixes are written only when the characters interact, not when each does something of their own; it again edits only reference files of nai5-writing and nai5-reverse-prompt. No `SKILL.md` and no plugin code changed. This version ran only `npm test`, not the runtime checks below.

**0.1.4, 2026-10-30.** Only the vendored skills changed: nai5-prompting v1.2.6 edits reference files of nai5-writing and nai5-reverse-prompt (multi-character images always carry `source#`, `target#`, or `mutual#` prefixes); no `SKILL.md` and no plugin code changed. This version ran only `npm test`, not the runtime checks below.

**0.1.3, 2026-10-30.** dsh 0.2.1-rc.3, 0.2.1-rc.5 (Desktop's bundled CLI before and after its update), and 0.2.2-alpha.2 (the official npm package, installed in a scratch directory), each with a scratch `DSH_HOME` `web` profile and the `npm pack` tarball. A local stand-in model endpoint recorded every request, so no real key was used. A test plugin registered a global tool four seconds after startup, the way MCP servers register theirs late:

- The preset appears in the menu, and the `/` menu lists only the 11 nai5 skills.
- An NAI5 session's request carries only this plugin's system prompt, only the tools the preset mounts (8 on 0.2.1; 7 on 0.2.2, which omits `web_search` without search credentials), the workspace `NAI.md` (not `AGENTS.md`), and only nai5 skills. The test's global tool, global skill, and late-registered tool were hidden, including in the first step of a session continued after a server restart.
- 0.1.2 reproduced the late-registration problem on rc.3: the tool appeared in the first step and was removed only in the second. 0.1.3 denies new global tools on every tool-registry change.

**Desktop 0.2.1-rc.3, daily use (0.1.2).** The skill catalog listed only the 11 nai5 skills, with Desktop's Office skills hidden. MCP and Office add-on tools appeared in the first step after each start and were removed in the second: the problem above, fixed in 0.1.3.

**0.1.0, 2026-10-20, dsh 0.2.1-rc.2.** Besides the checks above: a Standard session in the same workspace still saw global tools and skills, read `AGENTS.md` and not `NAI.md`, and listed no nai5 skill; switching a blank session to the preset applied the same isolation; the session logs contained no custom event types.

Skill quality has been exercised only in daily Desktop use, not tested systematically.

## License

GPL-3.0-only; see [LICENSE](LICENSE) and [NOTICE](NOTICE). The skills in `skills/` are copyright Miint-Sunny, from [nai5-prompting](https://github.com/Miint-Sunny/nai5-prompting), also under GPL-3.0-only.
