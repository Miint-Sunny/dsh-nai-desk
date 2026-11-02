# NAI Desk

中文 | [English](README.en.md)

NAI Desk 是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的提示词编写插件，面向 NovelAI Diffusion V5。插件提供「NAI5 提示词」预设和会话草稿编辑器；模型工具与编辑器操作同一份草稿。图像生成仍在 NovelAI 网站完成。

当前版本：**0.2.0-preview.5**（预发布）。

## 功能

- 编辑主提示词（Base Prompt）和草稿级负面提示词（UC）。
- 界面沿用 dsh 的主题、字体和默认控件规范，随宿主切换浅色与深色；实现依据见 [编辑器样式](docs/ui.md)。
- 管理角色提示词：正向文本、角色级 UC、显示名称、顺序、启用状态、删除撤销和折叠。
- 模型通过 `desk_*` 工具更新草稿；编辑器自动提交手动修改，并在连接可用时接收已提交的更新。
- 草稿按会话保存，重启后从宿主存储恢复。旧会话不会自动从历史回复提取草稿。
- 使用内置的 nai5-prompting 技能指导提示词编写。当前快照为 v1.2.8，包含 11 个技能；来源和校验值见 [VENDOR.md](VENDOR.md) 与 [vendor.json](vendor.json)。

本插件不执行图像生成或网站表单操作，也不包含外部连接器。界面保留原生文本选择，供手动复制。

## 安装与升级

可在 DeepSeek Harness 的插件管理器中添加安装源，也可使用配套的 `dsh` CLI。使用以下 CLI 命令前，请完全退出桌面端及 TUI；macOS 使用 **⌘Q**。

```sh
dsh plugin --profile desktop add github:Miint-Sunny/dsh-nai-desk#v0.2.0-preview.5
```

也可安装 [预发布页](https://github.com/Miint-Sunny/dsh-nai-desk/releases/tag/v0.2.0-preview.5) 的 `.tgz` 文件。发布包包含编译产物，安装过程不执行本插件的构建脚本。开发环境可使用 `link:/absolute/path/to/checkout`；链接安装会直接使用该工作区的文件，切换版本或构建前应退出 dsh。

### 标识符兼容

| 标识 | 值 | 用途 |
|---|---|---|
| 仓库与产品名 | `dsh-nai-desk` / NAI Desk | 项目地址与界面展示 |
| 包与安装标识 | `dsh-nai5-prompting` | 延续已有依赖和 profile 配置 |
| 预设 ID | `nai5-prompting` | 延续已有会话的预设关联 |

这是一份插件包，不需要同时安装独立的面板包。保留安装标识的原因与入口兼容方式见 [架构说明](docs/architecture.md)。

如果 profile 覆盖了整个 `preset-nai5-prompting` 配置行，宿主会优先采用该覆盖。升级时需对照 [默认配置](cordis.patch.yml) 合并草稿工具和环境说明，不能假定上游配置会自动合入自定义行。

从旧仓库地址升级时，如果包管理器报告旧 GitHub 归档的完整性校验失败，可在备份 profile 配置后移除旧依赖，再从新仓库安装：

```sh
dsh plugin --profile desktop remove dsh-nai5-prompting
dsh plugin --profile desktop add github:Miint-Sunny/dsh-nai-desk#v0.2.0-preview.5
```

不要修改归档校验值来绕过错误。回退到稳定版时，使用新仓库地址下的 `v0.1.6` 标签；旧版不提供草稿编辑器。

## 使用

1. 选择用于提示词编写的工作区。长期偏好可写在 `NAI.md` 中，格式见 [配置示例](examples/studio/NAI.md)。
2. 新建或继续使用「NAI5 提示词」预设的会话。
3. 打开右侧栏，选择「提示词稿纸」。
4. 描述需求，或要求修改指定字段。可直接编辑草稿中的文本，再手动复制到 NovelAI 网站。

只需要构思时，明确要求“仅提供方案”。需要完整文本出现在聊天中时，明确要求输出文本。图像输入是否可用取决于所选模型。

编辑器自动保存草稿；工作区文件由文件工具按请求写入。角色的启用状态随草稿保存，切换状态不会改写主提示词。

## 同步与数据边界

- 同一宿主实例内，写入按会话串行执行，并检查 `revision`。客户端仅在目标字段未被另一端改动时重放更新；同字段冲突需要选择保留的版本。
- 写入成功以宿主存储返回成功为准。未提交的编辑保留在当前客户端内存中，不提供跨刷新或强制退出的恢复保证。
- 当前没有跨进程锁、跨进程更新通知、草稿版本历史或会话分叉时的草稿继承。不要让多个宿主进程同时写同一份草稿存储。
- 本插件控制预设中的工具和技能可见性；这不是进程隔离或权限沙箱。文件访问、工具授权及网络权限仍由 dsh 管理。

数据格式、长度单位、错误响应和重试规则见 [API 参考](docs/api.md)。

模型调用草稿工具时，工具返回完整草稿，包括停用角色的文本，供模型继续处理。手动编辑和自动保存本身不会发起模型请求。

## 预设配置

默认预设挂载提示词技能、文件读写、图像读取、用户提问、宿主可用的网页工具、草稿工具和上下文压缩组件。全局工具与技能默认不加入该预设的可见集合。

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
| 草稿 HTTP 接口 | `/api/nai-desk/v1` |
| 草稿数据格式 | `schemaVersion: 1` |

安装器声明的版本范围不等于每个版本都经过验证。自动测试、隔离环境检查与实际模型质量评估是不同层次的证据。详见 [验证记录](docs/verification-0.2.0-preview.5.md) 和 [变更记录](CHANGELOG.md)。

## 开发

```sh
npm ci --ignore-scripts
npm test
npm pack
```

`npm test` 先构建，再运行测试；`npm pack` 只打包当前文件。发布前应确保 `lib/` 与源码一致。不要直接编辑构建产物。

`skills/` 是上游版本快照，须与 `vendor.json` 的校验值一致。更新使用 `node scripts/sync-skills.mjs <tag>`，不直接修改技能正文。

## 许可

GPL-3.0-only，见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)。内置技能来自 [nai5-prompting](https://github.com/Miint-Sunny/nai5-prompting)。随包分发的第三方代码保留各自许可声明。
