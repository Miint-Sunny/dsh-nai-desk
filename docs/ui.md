# 编辑器样式

稿纸使用 dsh 的主题变量，不维护独立配色或浅色／深色分支。当前适配依据为官方 `dsh-v0.2.1-rc.5`，与实际验证的宿主版本一致。

颜色只是其中一层。官方第三方插件指南要求从同类宿主页面照搬间距、字号和行布局；稿纸按下面几处宿主页面组织：

| 部位 | 参照的宿主页面 | 做法 |
|---|---|---|
| 页签与标题栏 | 右侧栏「Workspace files」 | 页签为 16px 图标加短名「稿纸」；38px 标题栏，底部 0.5px `border-l3` 分隔线与对话标题栏对齐；左侧 12px 三级文字显示保存状态，右侧为 28px 工具按钮 |
| 主提示词和角色卡 | 对话输入框、对话里的问答卡片 | 玻璃描边：`border: 0`，填充 `--dsw-specific-input-major`，`box-shadow: var(--dsw-elevation-panel)`。这组阴影的第一层就是 0.5px 半透明描边，颜色由 `--dsw-elevation-stroke-color` 按元素绑定（平时 `border-l2`，文本框聚焦时换成强调色）。R20 |
| 添加角色 | 设置页「Add model provider」 | 1px 虚线 `border-l3`、R16、高 44px |
| 角色的上移、下移、删除 | 宿主 `Menu`（MenuSurface 材质） | 标题栏的「⋯」工具按钮打开；R16 半透明卡片、`elevation-prominent`、34px 行、删除行用错误色并以分隔线隔开；空间不够时向上展开 |
| 回复末尾的稿纸卡片 | 方案卡片 | 高 60px、R16、0.5px `border-l1`，40px 图标块；标题「稿纸」，说明「已修改：…」，右侧「打开」 |
| 模型写稿后打开稿纸 | 方案审阅 | `ctx.sidebarRight.openTab`，右侧栏按宿主的推开方式展开；每个会话只自动打开一次 |

控件参照官方 Button、Switch、SegmentedControl 和面板工具按钮：

- 角色启停用 36×20 的 Switch，状态只由 `aria-checked` 表达。
- 工具按钮平时为二级文字色，悬停或按下时转为一级文字色并加悬停底色，不使用强调色填充。
- 角色名称直接显示为 14px 中粗体，悬停出现底色，聚焦时出现与输入框相同的强调色细边。
- 提示词文本框按内容增高，不显示拖拽手柄；文本框获得焦点时，所在卡片描边换成强调色。正文随宿主的 `--dsh-content-font-size` 设置调整。
- 角色标题栏只放状态类控件（屏蔽、启停）、「⋯」菜单和折叠；上移、下移、删除收在菜单里。移动用带杆箭头，折叠用 V 形箭头，两者不混用。
- 屏蔽占位在文本框里仍是普通文字，方便编辑和输入法；文本框后面垫一层同字体、同换行的绘制层，把占位画成灰条。退格或删除碰到占位时整段删除；复制或剪切时剪贴板里是原文。
- 光标或选区落在文本里时，卡片底部出现一行：选中文字时可「向模型屏蔽」，光标在占位旁时显示原文（完整换行显示，不截断）和「取消屏蔽」。
- 整栏和整个角色的屏蔽用卡片标题栏的眼睛按钮，图形取自宿主「显示密钥／隐藏密钥」的眼睛：睁眼表示模型可见，闭眼表示模型不可见，不另加文字标签。按钮的可访问名称固定为「向模型屏蔽…」，状态由 `aria-pressed` 表达，悬停提示写点击后的动作（「向模型屏蔽」／「取消屏蔽」）。整栏屏蔽时对应页签后面也带一个闭眼标记，切到另一个页签时仍看得到。
- 标题栏右侧的「‹ 3 / 5 ›」翻看版本历史。看旧版本时内容只读，顶部提示条给出来源、时间和改了哪些栏（不再重复版本序号），可「恢复此版本」或「返回当前版本」；正在加载的版本先保留上一个画面并减淡，不闪白。只读时屏蔽和启停仍按原样显示状态，但不可操作，「⋯」菜单隐藏。
- 全栏编辑按钮照宿主右侧栏的全屏按钮：标签和图形随状态切换（「全栏编辑」／「退出全栏编辑」），不用 `aria-pressed`。
- 角色标题栏在 320px 宽度内保持一行；输入文本在编辑区内换行。

## 界面用词

界面文字按 better-writing 的规则写：同一个东西只用一个名字，按钮动词开头，状态用「…中」「已…」，报错说清怎么办，不用口语。下表是稿纸的用词；新增界面文字先查这张表。

| 对象或动作 | 用 | 不用 |
|---|---|---|
| 右侧面板和它保存的内容 | 稿纸 | 草稿、提示词草稿 |
| 主提示词栏 | 主提示词 | Base Prompt、主串 |
| 负面提示词 | UC（悬停说明「负面提示词」） | 总负面、草稿级 UC、角色级 UC |
| 角色 | 角色、角色 N | 角色栏、角色提示词条目、角色条目 |
| 角色的正面提示词 | 提示词 | Prompt、正向提示词 |
| 屏蔽 | 向模型屏蔽、取消屏蔽；状态说「模型不可见」「模型可见」 | 模型看不到、让模型看到 |
| 历史 | 版本、版本历史、上一个版本、下一个版本 | 步、第几步、上一步、下一步 |
| 历史操作 | 恢复此版本、返回当前版本 | 用这一版、回到最新 |
| 删除与添加 | 删除（提示「已删除…」并给「撤销」）、添加 | 移除、新增 |
| 保存状态 | 保存中…、已保存、无法同步、保存冲突 | 等待保存…、已同步、同步异常、存在版本冲突 |
| 全栏 | 全栏编辑、退出全栏编辑 | 展开编辑区、还原编辑区 |

角色名是数据，模型或用户写成「Character 1」也照原样显示；界面自己的文字一律用「角色 1」。模型工具的说明和预设提示词面向模型，不受这张表约束。

## 版式检查

按 better-layout 和 better-accessibility 的规则自查：

- 同一个信息只出现一次。卡片名已经写了「Character 1」，就不再加「角色 1」小标题；标题栏已有「3 / 5」，提示条就不再写「第 3 步」。
- 分组靠间距，不靠标题和分隔线：主提示词卡与角色组之间 24px，角色卡之间 12px。
- 一行里的次要操作超过 3 个就收进菜单。
- 状态不能只靠颜色：切换按钮要换图形或文字。图形表示状态的切换按钮，可访问名称保持不变，用 `aria-pressed`；标签随状态变化的按钮（宿主全屏按钮的写法）不加 `aria-pressed`。
- 截断的内容要有办法看到全文；只靠悬停提示不算。
- 日期和时间用 `Intl` 格式化，不手拼。
- 交付前在隔离宿主里截图核对浅色、深色和 320px 宽度。

官方仓库内的功能包可以直接复用 `ui-primitives`。面向第三方插件的 `cordis-plugin-development` 指南则明确要求避免运行时加载内部 Client 模块，改为在插件内适配默认控件，并以主题变量作为共享样式依赖。本插件遵循后者：控件位于 `src/controls.jsx`，所用图标位于 `src/host-icons.jsx` 和 `src/panel.jsx`，均保留 MIT 归属说明。

参考：

- [第三方插件开发实践](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/preset/agent-preset/skills/cordis-plugin-development/references/practices.md)
- [官方 Web 样式规范](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/docs/web-styling.md)
- [默认组件目录](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-primitives/README.md#component-catalog)
- [圆角与设置卡片规范](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/docs/ui-radius.md)
- [浮起表面与描边（Web 样式规范）](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/docs/web-styling.md#component-rules)
- [显示密钥的眼睛图标](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-secret-mask/src/client/SecretText.tsx)
- [方案卡片与自动打开](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-plan/README.md)
- [右侧栏页签与标题](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-sidebar-right/README.md)

检查记录见 [preview.7 验证记录](verification-0.2.0-preview.7.md)、[preview.6](verification-0.2.0-preview.6.md) 和 [preview.5](verification-0.2.0-preview.5.md)；更早的配色核对见 [preview.3](verification-0.2.0-preview.3.md) 和 [preview.4](verification-0.2.0-preview.4.md)。
