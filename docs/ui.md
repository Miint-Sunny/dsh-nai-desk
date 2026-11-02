# 编辑器样式

稿纸使用 dsh 的主题变量，不维护独立配色或浅色／深色分支。当前适配依据为官方 `dsh-v0.2.1-rc.5`，与实际验证的宿主版本一致。

颜色只是其中一层。官方第三方插件指南要求从同类宿主页面照搬间距、字号和行布局；稿纸按下面几处宿主页面组织：

| 部位 | 参照的宿主页面 | 做法 |
|---|---|---|
| 页签与标题栏 | 右侧栏「Workspace files」 | 页签为 16px 图标加短名「稿纸」；38px 标题栏，底部 0.5px `border-l3` 分隔线与对话标题栏对齐；左侧 12px 三级文字显示保存状态，右侧为 28px 工具按钮 |
| 主提示词和角色卡 | 对话输入框、对话里的问答卡片 | 玻璃描边：`border: 0`，填充 `--dsw-specific-input-major`，`box-shadow: var(--dsw-elevation-panel)`。这组阴影的第一层就是 0.5px 半透明描边，颜色由 `--dsw-elevation-stroke-color` 按元素绑定（平时 `border-l2`，文本框聚焦时换成强调色）。R20 |
| 添加角色栏 | 设置页「Add model provider」 | 1px 虚线 `border-l3`、R16、高 44px |
| 回复末尾的稿纸卡片 | 方案卡片 | 高 60px、R16、0.5px `border-l1`，40px 图标块，右侧「打开」 |
| 模型写稿后打开稿纸 | 方案审阅 | `ctx.sidebarRight.openTab`，右侧栏按宿主的推开方式展开；每个会话只自动打开一次 |

控件参照官方 Button、Switch、SegmentedControl 和面板工具按钮：

- 角色启停用 36×20 的 Switch，状态只由 `aria-checked` 表达。
- 工具按钮平时为二级文字色，悬停或按下时转为一级文字色并加悬停底色，不使用强调色填充；删除按钮悬停时用错误色。
- 角色名称直接显示为 14px 中粗体，悬停出现底色，聚焦时出现与输入框相同的强调色细边。
- 提示词文本框按内容增高，不显示拖拽手柄；文本框获得焦点时，所在卡片描边换成强调色。正文随宿主的 `--dsh-content-font-size` 设置调整。
- 移动用带杆箭头，折叠用 V 形箭头，两者不混用。
- 屏蔽占位在文本框里仍是普通文字，方便编辑和输入法；文本框后面垫一层同字体、同换行的绘制层，把占位画成灰条。退格或删除碰到占位时整段删除；复制或剪切时剪贴板里是原文。
- 光标或选区落在文本里时，卡片底部出现一行：选中文字时可「向模型屏蔽」，光标在占位旁时显示原文和「取消屏蔽」。整栏和整个角色的屏蔽用卡片标题栏的眼睛按钮，屏蔽后显示「模型看不到」标签。
- 标题栏右侧的「‹ 第几步 ›」翻看历史。看旧步骤时内容只读，顶部提示条给出来源、时间和改了哪些栏，可「用这一版」或「回到最新」；正在加载的步骤先保留上一步的画面并减淡，不闪白。
- 宽度不足时，角色操作区换行；输入文本在编辑区内换行。

官方仓库内的功能包可以直接复用 `ui-primitives`。面向第三方插件的 `cordis-plugin-development` 指南则明确要求避免运行时加载内部 Client 模块，改为在插件内适配默认控件，并以主题变量作为共享样式依赖。本插件遵循后者：控件位于 `src/controls.jsx`，所用图标位于 `src/host-icons.jsx` 和 `src/panel.jsx`，均保留 MIT 归属说明。

参考：

- [第三方插件开发实践](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/preset/agent-preset/skills/cordis-plugin-development/references/practices.md)
- [官方 Web 样式规范](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/docs/web-styling.md)
- [默认组件目录](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-primitives/README.md#component-catalog)
- [圆角与设置卡片规范](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/docs/ui-radius.md)
- [浮起表面与描边（Web 样式规范）](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/docs/web-styling.md#component-rules)
- [方案卡片与自动打开](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-plan/README.md)
- [右侧栏页签与标题](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-sidebar-right/README.md)

检查记录见 [preview.6 验证记录](verification-0.2.0-preview.6.md) 和 [preview.5](verification-0.2.0-preview.5.md)；更早的配色核对见 [preview.3](verification-0.2.0-preview.3.md) 和 [preview.4](verification-0.2.0-preview.4.md)。
