# NAI Desk

中文 | [English](README.en.md)

NAI Desk 是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的提示词编写插件，面向 NovelAI Diffusion V5。插件提供「NAI5 提示词」预设和按会话保存的稿纸；模型工具与稿纸编辑的是同一份内容。图像生成仍在 NovelAI 网站完成。

当前源码版本：**0.2.0**。新的 scoped 包正在准备，尚未发布。

## 系统要求

- DSH App：`>=0.2.1-rc.5 <0.3.0-0`，与 `package.json` 的 `engines.dsh` 一致。
- 目前仅支持 macOS；Windows 还不支持。
- 使用模型编写提示词需要在 DSH 中配置可用模型。手动编辑稿纸不发起模型请求。

## 功能

- 编辑主提示词（NovelAI 的 Base Prompt）和负面提示词（UC）。
- 界面沿用 dsh 的主题、字体和默认控件规范，随宿主切换浅色与深色；实现依据见 [编辑器样式](https://github.com/Miint-Sunny/dsh-nai-desk/blob/main/docs/ui.md)。
- 管理角色：提示词、角色的 UC、名称、启用状态和折叠；上移、下移和删除在角色标题栏的「⋯」菜单里，删除后可撤销。
- 向模型屏蔽：选中一段文字屏蔽，或用标题栏的眼睛按钮屏蔽整栏、整个角色。闭眼图标表示模型不可见，被整栏屏蔽的页签上也有同样的标记。模型只看到 `⟪屏蔽N⟫` 这类占位，知道那里有内容但读不到，也不能改掉；手动复制时得到原文。
- 版本历史：模型每次写入和手动修改都记成一个版本，可在稿纸顶部前后翻看，用「恢复此版本」把旧版本恢复为当前内容。
- 模型通过 `desk_*` 工具更新稿纸；编辑器自动提交手动修改，并在连接可用时接收已提交的更新。模型在一个会话里第一次写稿时，右侧栏自动推开到稿纸；之后每轮写过稿的回复末尾有一张卡片，点「打开」即可再次打开。
- 稿纸按会话保存，重启后从宿主存储恢复。旧会话不会自动从历史回复提取内容。
- 使用内置的 nai5-prompting 技能指导提示词编写。当前快照为 v1.2.8，包含 11 个技能；来源和校验值见 [VENDOR.md](VENDOR.md) 与 [vendor.json](vendor.json)。

本插件不执行图像生成或网站表单操作，也不包含外部连接器。界面保留原生文本选择，供手动复制。

## 安装

包名为 `@miint-sunny/dsh-nai-desk`。该作用域包尚未发布到 npm；既有 GitHub `v0.2.0` 标签对应旧包名。

发布前，从提供插件的人取得 `.tgz` 文件。在 DSH「插件」页选择「添加插件」，填入文件的绝对路径，例如 `/path/to/miint-sunny-dsh-nai-desk-0.2.0.tgz`，完成安装。相对路径和 `~` 不能代替绝对路径。

npm 发布后，在同一位置填写 `@miint-sunny/dsh-nai-desk`。也可使用 DSH App 自带的命令行；先退出使用目标 profile 的宿主，再执行（将示例路径替换为实际文件）：

```sh
dsh plugin --profile desktop add /path/to/miint-sunny-dsh-nai-desk-0.2.0.tgz
```

本插件可独立安装，归档包含已构建的运行文件。安装完成后启动对应的 DSH profile，在插件页核对组件状态。

### 从旧包名迁移

从旧包迁移时，先备份目标 profile，在同一次停止宿主的窗口中移除旧包，再添加新包：

```sh
dsh plugin --profile desktop remove dsh-nai5-prompting
dsh plugin --profile desktop add @miint-sunny/dsh-nai-desk
```

### 标识符兼容

| 标识 | 值 | 用途 |
|---|---|---|
| 仓库与产品名 | `dsh-nai-desk` / NAI Desk | 项目地址与界面展示 |
| 包与安装标识 | `@miint-sunny/dsh-nai-desk` | 新安装与模块解析 |
| 配置行 ID | `nai-desk` / `preset-nai5-prompting` 等原值 | 延续 profile 覆盖 |
| 预设 ID | `nai5-prompting` | 延续已有会话的预设关联 |

配置行 ID、接口路径、服务标识与稿纸存储格式保持不变，详见[架构说明](https://github.com/Miint-Sunny/dsh-nai-desk/blob/main/docs/architecture.md)。自定义行如显式写有旧模块名，改成新包名或 `@miint-sunny/dsh-nai-desk/tools`，并保留行 ID 和配置值。

如果 profile 覆盖了整个 `preset-nai5-prompting` 配置行，宿主会优先采用该覆盖。升级时需对照[默认配置](cordis.patch.yml) 合并模块名、稿纸工具和环境说明，不能假定上游配置会自动合入自定义行。

## 更新与卸载

通过 npm 包名安装后，可在 DSH「插件」页使用更新按钮。本地 `.tgz` 安装没有更新按钮；取得新归档后，先在插件页卸载旧包，再以新文件的绝对路径重新安装。

卸载使用插件页的「卸载」。停用组件只停止该组件，不等同于卸载整个包。卸载插件不会替你整理已保存的私人稿纸；重要内容请先自行备份。命令行卸载前先退出对应宿主：

```sh
dsh plugin --profile desktop remove @miint-sunny/dsh-nai-desk
```

## 使用

1. 选择用于提示词编写的工作区。长期偏好可写在 `NAI.md` 中，格式见 [配置示例](https://github.com/Miint-Sunny/dsh-nai-desk/blob/main/examples/studio/NAI.md)。
2. 新建或继续使用「NAI5 提示词」预设的会话。
3. 模型第一次写稿时稿纸会自动打开；也可以点回复末尾的「稿纸」卡片，或在右侧栏「+」里选「提示词稿纸」。
4. 描述需求，或要求修改指定字段。可直接编辑稿纸中的文本，再手动复制到 NovelAI 网站。

只需要构思时，明确要求“仅提供方案”。需要完整文本出现在聊天中时，明确要求输出文本。图像输入是否可用取决于所选模型。

稿纸自动保存；工作区文件由文件工具按请求写入。角色的启用状态随稿纸保存，切换状态不会改写主提示词。

## 已知限制

- 同一宿主实例内，写入按会话串行执行，并检查 `revision`。客户端仅在目标字段未被另一端改动时重放更新；同字段冲突需要选择保留的版本。
- 写入成功以宿主存储返回成功为准。未提交的编辑保留在当前客户端内存中，不提供跨刷新或强制退出的恢复保证。
- 当前没有跨进程锁、跨进程更新通知或会话分叉时的稿纸继承。版本历史最多保留 60 个版本。不要让多个宿主进程同时写同一份稿纸存储。
- 本插件控制预设中的工具和技能可见性；这不是进程隔离或权限沙箱。文件访问、工具授权及网络权限仍由 dsh 管理。

数据格式、长度单位、错误响应和重试规则见 [API 参考](https://github.com/Miint-Sunny/dsh-nai-desk/blob/main/docs/api.md)。

模型调用稿纸工具时，工具返回稿纸的模型视图：屏蔽的内容只以占位出现，其余文本（包括停用角色）照常返回。手动编辑和自动保存本身不会发起模型请求。

## 预设配置

默认预设挂载提示词技能、文件读写、图像读取、用户提问、宿主可用的网页工具、稿纸工具和上下文压缩组件。全局工具与技能默认不加入该预设的可见集合。

| 配置项 | 默认值 | 含义 |
|---|---|---|
| `hideGlobalTools` | `true` | 从本预设中隐藏全局工具 |
| `keepGlobalTools` | `[]` | 隐藏规则的工具例外列表 |
| `hideGlobalSkills` | `true` | 从本预设中隐藏全局技能 |
| `keepGlobalSkills` | `[]` | 隐藏规则的技能例外列表 |

项目说明文件入口为 `NAI.md`。宿主级说明和权限策略仍按 dsh 自身规则处理。模型的交稿习惯由预设说明与技能共同约定；插件不保证任何模型都能正确遵循这些说明。

## 版本与验证范围

| 项目 | 当前声明 |
|---|---|
| 安装器声明范围 | dsh `>=0.2.1-rc.5 <0.3.0-0` |
| 实际验证的宿主 | dsh `0.2.1-rc.5` |
| 稿纸 HTTP 接口 | `/api/nai-desk/v1` |
| 稿纸数据格式 | `schemaVersion: 1` |

安装器声明的版本范围不等于每个版本都经过验证。自动测试、隔离环境检查与实际模型质量评估是不同层次的证据。详见 [验证记录](https://github.com/Miint-Sunny/dsh-nai-desk/blob/main/docs/verification-0.2.0.md) 和 [变更记录](https://github.com/Miint-Sunny/dsh-nai-desk/blob/main/CHANGELOG.md)。

## 问题反馈

熟人试用时，请直接联系提供插件的人。公开反馈使用 [GitHub Issues](https://github.com/Miint-Sunny/dsh-nai-desk/issues)。请附上：

- DSH App 版本、插件名和版本。
- macOS 版本和芯片类型（Apple silicon 或 Intel）。
- 操作步骤、实际结果与期望结果。
- 插件页里未运行的组件行和完整报错；可附截图。

提交前遮盖密钥、令牌、私人聊天和稿纸内容；用自编的最小示例复现。仅出现于某个模型的输出问题，请注明模型名，不要附 API 密钥。

## 许可

GPL-3.0-only，见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)。内置技能来自 [nai5-prompting](https://github.com/Miint-Sunny/nai5-prompting)。随包分发的第三方代码保留各自许可声明。

开发、测试和更新上游技能快照的说明在源码仓库的 `AGENTS.md` 和 `VENDOR.md`。
