# 稿纸 API v1

本接口供 dsh 客户端和后续集成使用。接口路径、稿纸格式版本和插件发布版本分别管理；插件的 `0.2.x` 版本号不等于 HTTP 接口版本。

## 访问方式

`POST /api/nai-desk/v1`，请求体为 JSON，使用 `Content-Type: application/json`。

请求由 dsh Connection 接收。宿主负责调用方认证及 HTTP 传输的 Host/Origin 校验；本插件注册的路由只接受宿主 owner 身份，并检查目标会话是否使用 `nai5-prompting` 预设。请求通过 `sessionId` 指定目标会话；模型工具则固定使用调用者所属会话，不接受可选的会话 ID。

这不是匿名或多租户 API。它不提供独立凭据、用户授权列表或额外监听端口。

## 数据结构

类型定义见 [`src/api.d.ts`](../src/api.d.ts)。成功响应均为完整稿纸快照：

```json
{
  "schemaVersion": 1,
  "sessionId": "session-id",
  "revision": 1,
  "main": "outdoors, soft lighting",
  "uc": "",
  "characters": []
}
```

| 字段 | 含义 |
|---|---|
| `schemaVersion` | 已存数据格式版本，目前为 1 |
| `sessionId` | dsh 会话标识 |
| `revision` | 该稿纸的并发控制版本；每次成功变更递增 |
| `main` | 主提示词全文 |
| `uc` | 主提示词对应的负面提示词（UC）全文，与角色的 UC 分开 |
| `characters` | 有序的角色提示词条目 |
| `mask` | 可选。用户整栏屏蔽的字段，如 `{"main": true}` |
| `secrets` | 可选。被选中屏蔽的原文，键是占位 `⟪屏蔽N⟫`；只返回给编辑器，不进入模型工具 |
| `updatedBy` | 可选。最近一次变更来自 `user`（编辑器）还是 `model`（模型工具） |

角色条目包含 `id`、`name`、`prompt`、`uc`、`enabled`，以及可选的 `position: {x, y}`。

- `id` 在所属稿纸内唯一，排序时不变；名称和数组序号都不是身份标识。
- `name` 是显示名称，不会自动拼接进 `prompt`。
- `enabled` 是保存并返回的稿纸元数据，本版不会据此调用生图服务或改写其它字段。
- `position` 使用 0–1 的归一化坐标：x 从左到右，y 从上到下；当前编辑器不提供位置控件。
- `masked: true` 表示用户把整个角色向模型屏蔽；没有屏蔽时不出现该字段。
- 服务端不对提示词执行去重、词序调整或权重重写。

## 操作

### 读取

```json
{"action":"read","sessionId":"session-id"}
```

返回该宿主实例持有的已提交状态。没有稿纸记录的有效 NAI5 会话返回 revision 为 0 的空稿纸；读取不会创建一份持久化空记录。

### 变更

```json
{
  "action":"mutate",
  "sessionId":"session-id",
  "expectedRevision":1,
  "operation":{"type":"set_main","text":"outdoors, evening"}
}
```

`expectedRevision` 必须等于当前稿纸版本。校验失败或持久化失败时，不发布新版本。操作成功后返回更新后的完整快照。

| `operation.type` | 参数 | 语义 |
|---|---|---|
| `set_main` | `text` | 替换主提示词全文 |
| `set_uc` | `text` | 替换 UC 全文 |
| `add_character` | 可选 `character`、`index` | 插入角色条目；默认追加到末尾 |
| `set_character` | `id`、`patch` | 更新指定角色的字段；未提供的字段保留 |
| `remove_character` | `id` | 移除角色条目 |
| `move_character` | `id`、`index` | 将角色移至指定数组位置 |
| `set_mask` | `field`（`main` 或 `uc`）、`masked` | 整栏向模型屏蔽或取消 |
| `mask_span` | `field`、`text`、`token`、`secret` | 把选中的文字换成占位：`text` 是替换后的整栏，`secret` 是原文，`token` 须为未用过的 `⟪屏蔽N⟫` |
| `unmask` | `token` | 在所有字段里把占位换回原文，并删除这段原文 |
| `restore` | `revision` | 把稿纸恢复成某个历史版本的内容，作为一次新的变更 |

`mask_span` 的 `field` 使用编辑器字段标识：`main`、`uc`、`character:<id>:prompt` 或 `character:<id>:uc`。角色整体屏蔽用 `set_character` 的 `patch.masked`。

HTTP 接口的 `index` 从 **0** 开始。模型工具的 `n`、`to` 从 **1** 开始，并相对于读取到的快照解释。

新增角色默认生成 id、使用 `Character N` 名称、空正负文本和 `enabled: true`。允许携带未占用的 id 恢复已删除条目；不会替换同 id 的现有条目。`set_character.patch.position: null` 清除自定义位置。

每次成功的 `mutate` 都会递增版本，包括重复提交相同内容。它不是带请求去重键的幂等接口；如果写入结果不确定，应先读取当前状态，再决定是否重试。

一次请求只接受一个 operation；连续请求不构成原子批处理。编辑器的删除撤销是使用本地保留的条目再次执行新增操作；要回到更早的整份稿纸，用 `restore`。

### 等待更新

```json
{"action":"watch","sessionId":"session-id","revision":2}
```

版本不同时立即返回当前快照；版本相同时等待本实例内的更新，或约 20 秒后返回未变化的快照。等待可由请求的 AbortSignal 取消。`revision` 不是时间戳，不应跨会话比较。

取消请求不等于回滚已经开始的持久化写入。连接中断后，不应把未收到响应解释为写入一定失败。

### 历史

```json
{"action":"history","sessionId":"session-id"}
```

返回版本列表（`steps`，从旧到新），不含稿纸正文。每个版本记录结束时的 `revision`、时间 `at`、来源 `source`（`user`、`model`，或版本历史上线前已有内容的基线 `earlier`）和改动摘要 `parts`。同一来源在短时间内的连续变更合并为一个版本：模型 45 秒内、编辑器 90 秒内。最多保留 60 个版本、合计 4 MiB，超出时丢弃最旧的版本。

```json
{"action":"version","sessionId":"session-id","revision":1}
```

返回某个版本的稿纸正文（含该版本的屏蔽原文），供编辑器只读显示；版本已被丢弃时返回 `not_found`。历史单独存放在 `nai_desk_history` 存储域，写入失败不影响稿纸本身的变更。

## 并发与一致性范围

服务端在**同一个宿主实例内**按 sessionId 串行处理变更，并在写入前比较版本。版本检查作用于整份稿纸，不只检查目标字段。

编辑器另有字段级处理：目标字段仍等于编辑前的值时，可以在新版本上重放修改；目标字段已变化时保留本地文本并显示冲突。冲突处理操作绑定到界面展示的版本，更新后的远端内容需要重新确认。

本插件不实现跨进程锁、跨进程通知或多个记录之间的事务。宿主存储后端的能力不应被解释为本接口额外提供的保证。外部恢复旧存档后应重启宿主并重新加载客户端。

## 模型工具适配

模型工具从执行上下文取得 sessionId，使用 `expected_revision` 参数执行与 HTTP `expectedRevision` 相同的版本检查。这两个参数名属于各自已发布的接口，不可互换。

| 工具 | 操作 |
|---|---|
| `desk_read` | 读取调用会话的已提交快照 |
| `desk_set_main` | 替换主提示词 |
| `desk_set_uc` | 替换 UC |
| `desk_set_character` | 按当前快照的 n 更新角色，或在末尾新增 |
| `desk_remove_character` | 按当前快照的 n 删除角色条目 |
| `desk_move_character` | 将当前快照的第 n 条移到第 to 位 |

工具读到和写入后返回的是**模型视图**：

- 选中屏蔽的文字只以占位 `⟪屏蔽N⟫` 出现，原文和 `secrets` 不进入模型上下文。改写含占位的字段时，新文本必须保留原有的每个占位，且不能出现稿纸里没有的占位，否则返回 `masked` 错误。
- 整栏屏蔽的字段显示为 `⟪整栏已屏蔽，约 N 字⟫`，并在 `masked` 中标出；整个角色被屏蔽时名称、正向和 UC 都换成占位，并带 `masked: true`。这些字段和角色不能被模型写入；含有屏蔽占位的角色也不能被模型删除。

模型视图包括停用角色的文本。失败格式由 dsh 工具层定义，不使用 HTTP 错误包。服务端检查版本和数据结构，不判断修改是否符合用户的创作意图。

## 限制

| 对象 | 接受上限 |
|---|---|
| 主提示词、UC、角色正向、角色 UC | 各 32,768 个 UTF-16 代码单元（JavaScript `string.length`） |
| 角色显示名称 | 128 个 UTF-16 代码单元 |
| 角色条目 | 22 条，包含停用条目 |
| 请求体 | 1 MiB（1,048,576 字节） |
| 稿纸快照 | `JSON.stringify` 后的 UTF-8 大小不超过 1 MiB |

这些是本插件的存储和请求限制，不代表 NovelAI 的 token 限制，也不保证提示词在生成模型上有效。sessionId 与角色 id 接受 1–128 位 ASCII 字母、数字、下划线和连字符。

## 错误

到达插件处理器的错误使用以下结构：

```json
{"error":{"code":"conflict","message":"稿纸已被修改，请重新读取后提交。","current":{"schemaVersion":1,"sessionId":"session-id","revision":2,"main":"outdoors, evening","uc":"","characters":[]}}}
```

`current` 包含冲突时已提交的完整快照，只在版本冲突响应中提供。

| 状态 | `error.code` | 含义 |
|---|---|---|
| 400 | `invalid_input` | 请求、操作或字段不符合约定 |
| 403 | `wrong_preset` | 目标会话不能作为 NAI5 稿纸访问 |
| 403 | `masked` | 模型工具的写入会读到或覆盖用户屏蔽的内容（只出现在工具失败里） |
| 404 | `not_found` | 目标角色 id、屏蔽占位或历史版本不存在 |
| 409 | `conflict` | expectedRevision 与当前版本不一致 |
| 413 | `limit_exceeded` | 请求或数据超过接受上限 |
| 415 | `unsupported_media_type` | 请求未使用 application/json |
| 500 | `invalid_record` / `storage_error` | 已存记录无法加载，或读写失败 |
| 503 | `closed` | 稿纸服务已关闭 |

宿主层的认证、路由和来源检查可能直接返回 401、403 或其它响应，不保证使用本插件的 JSON 错误结构。取消或关闭也可能表现为连接中断。集成应检查 HTTP 状态及响应格式，依赖稳定的错误码，不能依赖 `message` 文案。模型工具的失败由 dsh 工具层呈现，不使用这里的 HTTP 错误包。

插件不提供存储损坏修复或备份机制。损坏文件的读取和恢复行为还受宿主后端影响。
