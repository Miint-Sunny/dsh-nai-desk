# NAI Desk

用中文沟通。此仓库同时提供 NAI5 提示词预设、隔离规则、原样 vendored 的 11 个技能，以及右侧可编辑稿纸。

- GitHub 仓库名为 dsh-nai-desk。npm/安装标识暂保留 dsh-nai5-prompting，预设 ID 保留 nai5-prompting，兼容旧安装与旧会话。
- 稿纸只做纯文字主提示词/UC、角色提示词/UC、名称、排序、启停、删除撤销、折叠、全栏编辑、向模型屏蔽和版本历史。没有骰子、复制按钮、自动填词、OC、块库、MCP 或 W.O.F 连接。
- 界面文字和版式交付前按 better-writing、better-layout、better-accessibility 自查；用词以 [docs/ui.md](docs/ui.md)「界面用词」为准，同一个东西只用一个名字，不写口语。
- skills/ 与 vendor.json 必须保持对应上游版本的原始字节；不要在这里编辑技能正文，用 scripts/sync-skills.mjs 同步。
- 后台、模型工具和面板使用同一份按会话隔离的数据，revision 冲突不得静默覆盖。
- 本地接口只注册到 dsh 认证 Connection，不另开裸 HTTP 服务。
- npm test 先构建，包含原有隔离/技能校验和稿纸测试。发布包必须含预构建 lib，安装不执行构建。
- 发布前同时更新 README.md / README.en.md、版本和 CHANGELOG，运行完整检查与临时 DSH_HOME 验收。
- 不读 .env 或真实凭据，不提交私人数据、测试运行记录或个人绝对路径。
- 修改日常 ~/.dsh 前须由用户确认 ⌘Q 完全退出；先备份配置。仓库改名、推送和发布以会话中的用户授权为准，不重复索取已给出的授权。
