# 编辑器样式

稿纸使用 dsh 的主题变量，不维护独立配色或浅色／深色分支。当前适配依据为官方 `dsh-v0.2.1-rc.5`，与实际验证的宿主版本一致。

- 文字、边框和交互状态使用 `--dsw-alias-*`。主提示词与角色编辑区使用和宿主输入框相同的 `--dsw-specific-input-major`，不以普通背景层代替输入框表面。
- 字体使用 `--dsw-font-*`；提示词正文随宿主的 `--dsh-content-font-size` 设置调整。
- 普通按钮、角色名称输入框和 Base/UC 分段控件参照官方 Button、Input、SegmentedControl。保留键盘操作、可访问名称和焦点反馈。
- 圆角使用 `--dsw-radius-*`，普通中性边框使用 0.5px；编辑区采用宿主输入框的 l2 描边及 `--dsw-elevation-soft` 阴影，不叠加实体外边框。分段指示器使用宿主阴影。
- 宽度不足时，角色操作区换行；输入文本在编辑区内换行。

官方仓库内的功能包可以直接复用 `ui-primitives`。面向第三方插件的 `cordis-plugin-development` 指南则明确要求避免运行时加载内部 Client 模块，改为在插件内适配默认控件，并以主题变量作为共享样式依赖。本插件遵循后者：控件位于 `src/controls.jsx`，所用图标位于 `src/host-icons.jsx`，均保留 MIT 归属说明。

参考：

- [第三方插件开发实践](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/preset/agent-preset/skills/cordis-plugin-development/references/practices.md)
- [官方 Web 样式规范](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/docs/web-styling.md)
- [默认组件目录](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-primitives/README.md#component-catalog)
- [圆角规范](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/docs/ui-radius.md)
- [宿主输入框表面与占位文字](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/skeleton/InputBar.module.css)

检查记录见 [preview.3 验证记录](verification-0.2.0-preview.3.md) 和 [preview.4 色差核对](verification-0.2.0-preview.4.md)。
