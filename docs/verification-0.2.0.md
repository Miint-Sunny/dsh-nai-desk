# 验证记录：0.2.0

日期：2026-11-03。宿主：dsh 0.2.1-rc.5（桌面端自带的命令行）。

## 与 preview.7 的差异

插件代码与 0.2.0-preview.7 相同：`lib/`、`src/`、预设配置和内置技能都没有变化。本版只改版本号、README、CHANGELOG 和本记录。界面、模型写入、屏蔽和版本历史的实测见 [preview.7 验证记录](verification-0.2.0-preview.7.md)，本版没有重做这部分。

## 自动检查

- `npm test`：构建后 `lib/` 没有变化，68 项测试通过。
- 内置技能、vendor.json 和 VENDOR.md 与 0.1.6 所含的 nai5-prompting v1.2.8 快照逐字节一致。

## 临时 DSH_HOME 验收

用 `npm pack` 打出的 0.2.0 包（116 个文件），在全新的临时 DSH_HOME 里用 `dsh plugin --profile <名称> add` 安装。日常 `~/.dsh` 的 profile 配置前后校验值不变。

- 安装：web 和 headless 两个 profile 都装上了 0.2.0。安装没有执行构建脚本，也没有安装对等依赖。
- 组合配置：`dsh --dump-config` 的结果里有 `nai-desk` 入口和「NAI5 提示词」预设。
- Web 宿主：启动日志里没有未激活的条目。不带令牌的请求返回 401，跨 Origin 的请求返回 403。带上本机测试宿主的令牌后，稿纸接口用自己的错误格式应答：字段不符合约定返回 400 `invalid_input`，不是 JSON 返回 415 `unsupported_media_type`，不存在的会话返回 403 `wrong_preset`。不存在的路径由宿主返回 404。
- headless profile 不提供预设服务，`nai-desk` 入口和「NAI5 提示词」预设停在等待状态，没有激活。

本轮唯一的模型请求发往本机假模型（headless 的普通模式，接口不匹配，没有完成）。没有外部模型请求，也没有调用图像生成服务。此记录不代表已测试其它宿主版本或所有第三方主题。
