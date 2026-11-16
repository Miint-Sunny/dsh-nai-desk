# 验证记录：0.2.1

日期：2026-11-16。宿主：dsh 0.2.2-rc.3（桌面端自带的命令行）。

## 与 0.2.0 的差异

只换了内置技能。

- 用 `scripts/sync-skills.mjs v1.2.9` 把 `skills/` 和 `vendor.json` 整份换成 nai5-prompting v1.2.9（提交 `a5f3df8`）。脚本先按那个发布自带的 `SHA256SUMS.txt` 逐个校验。
- 实际有变化的技能文件：
  - nai5-reverse-prompt 的 `SKILL.md` 和 `references/reverse.md`；
  - nai5-writing 的 `references/conventions.md` 和 `references/illustration.md`；
  - 11 份 `SOURCE.json` 的版本号。
- 另改了版本号、README、VENDOR.md、CHANGELOG 和本记录。
- `lib/`、`src/`、预设配置和稿纸都没有变化。界面、模型写入、屏蔽和版本历史的实测见 [preview.7 验证记录](verification-0.2.0-preview.7.md)，本版没有重做这部分。

## 自动检查

- `npm test`：构建后 `lib/` 没有变化，68 项测试通过。
- 67 个技能文件逐个对上 `vendor.json`（v1.2.9）。

## 临时 DSH_HOME 验收

用 `npm pack` 打出 0.2.1 包（118 个文件），在全新的临时 DSH_HOME 里用 `dsh plugin --profile web add` 安装。日常 `~/.dsh` 桌面端 profile 的配置前后校验值不变。

- 安装：web profile 装上了 0.2.1，装上的 67 个技能文件逐个对上 `vendor.json`。
- 组合配置：`dsh --profile web --dump-config` 的结果里有 `nai-desk` 入口和「NAI5 提示词」预设。
- 插件代码没变，这次没有启动 Web 宿主，也没有重做稿纸接口和 headless profile 的检查。0.2.0 的结果见 [0.2.0 验证记录](verification-0.2.0.md)。

本轮没有模型请求，也没有调用图像生成服务。技能内容的模型实测写在 nai5-prompting v1.2.9 的发布说明里。此记录不代表已测试其它宿主版本。
