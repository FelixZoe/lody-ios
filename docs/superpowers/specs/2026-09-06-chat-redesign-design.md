# 聊天页重构

承接 `2026-09-06-design-language-design.md`。那份文档明确「聊天页另行讨论」，本文是那次讨论的结果。

优先级由高到低：**内容表达**与**原生手感**并列第一，交互控制次之，结构重构垫底——但内容表达一旦落地，结构重构是它的副产品，不单独排期。

## 问题

`SessionScreen.tsx`（305 行）和 `MessageBubble.tsx`（230 行）目前的实现有三个层次的缺口。

**最外层是死内容。** `projectHistory` 把每个 `MessageContent` 压成 `{type, text, label}`，`text` / `thought` 之外的一切渲染成灰框加一句「完整内容可在电脑上查看」。coding agent 的转录有大半是工具调用，这等于把主体内容扔了。其中 `tool_call.permissionRequest` 被扔掉的后果不是可读性差，是**会话死锁**——agent 停下来等一个手机端永远给不出的答复。

**中间层是手感。** `KeyboardAvoidingView` 包 `ScrollViewMarker` 包 `FlatList`，三层各自算 inset，键盘弹出会抖。滚动跟随是手写的 `following.current` + `onScroll` 阈值 + 两处 `scrollToEnd`。

**最里层是管线。** 每次 doc 更新，data-runtime 执行 `doc.toJSON()` 全量 → 投影整段 history → `JSON.stringify` → WKWebView 桥 → Swift → RN 桥 → `JSON.parse` → 整体替换 state。流式回复时这条链路按 token 批次触发。现在只传三个字段所以还扛得住；一旦把工具内容带上，一个跑了半小时的 session 轻松几 MB，每帧全量序列化一次必卡，`DataRuntime.swift:121` 的 12 MiB 上限也会开始撞。

三层缺口是连着的：不修管线就带不动内容，不带内容就谈不上手感。

## 范围

**做**：`tool_call`（含 `kind` / `status` / `content[]` / `permissionRequest`）、`plan`、`subagent_task`、`thought`、`text` 的渲染；权限内联作答；摘要投影 + 按需详情；键盘与滚动交给系统 API。

**不做**：`image` / `image_group` / `file` 附件（依赖 R2 下载链路，与 UI 重构不是一件事）、`worktree_script`、`system_notice` 的完整渲染、中断正在跑的 turn、消息长按重发与编辑、冷启动缓存。

冷启动白屏（进会话先转圈等服务端 bootstrap）是真实缺口，但 LodyKit 的 SQLite 恢复层正在被另一条线改动，且摘要投影的 schema 要先定稳才谈得上持久化它。本轮只做体面的加载态，并把 snapshot 来源收敛成单一入口，以后接缓存不碰 UI。

## 视觉语言

参照 Codex 的转录呈现。核心是**安静**：整屏只有助手正文有完整对比度，其余全是灰阶层级，没有卡片边框、没有头像、没有「LODY」标签。

```
                                  帮我看下登录为什么会超时     ← 用户，右侧气泡

                                                19:32   ⧉    ← 轮次头：时间 + 复制
已工作 4 分 20 秒                                             ← 灰字
─────────────────────────────────────────────────────────    ← hairline

我先看了 src/auth.ts 的请求链路，超时来自 fetch 没有挂         ← 助手正文，全宽，无气泡
AbortSignal。

􀤋  读取了文件、执行了命令                                ›    ← 活动行，灰字，可点
```

规则：

- 用户消息是右侧气泡（`colors.fill`），助手是全宽正文。**唯一**的气泡在用户侧。
- 轮次头：右上角时间 + 复制图标，下一行「已工作 N 分 M 秒」（`endedAt - Date.parse(timestamp) - permissionWaitMs`），再一条 hairline。
- **工具活动按连续同类聚合**成一行灰字，不是一个 `tool_call` 一张卡。聚合规则见下。
- 活动行点开走**原生 sheet**，不内联展开。
- 零边框零卡片。视觉分层只靠灰度和 hairline。

### 活动行的聚合

连续的 `tool_call` 合成一行，`kind` 决定图标与措辞；被 `text` / `thought` 打断则起新行。

| kind 集合                     | 图标                 | 措辞                       |
| ----------------------------- | -------------------- | -------------------------- |
| `read` / `search`             | `doc.text.magnifyingglass` | 读取了文件             |
| `edit` / `write` / `move` / `delete` | `square.and.pencil` | 编辑了 `<path>` +N −M |
| `execute` / `bash`            | `terminal`           | 执行了命令                 |
| `fetch`                       | `globe`              | 访问了网络                 |
| `mcp` / `other` / `computer`  | `wrench.and.screwdriver` | 调用了工具             |
| 混合                          | `wrench.and.screwdriver` | 逐类顿号连接，最多三类，超出「等」 |

单个 `edit` 独占一行时显示 path 和 `+N −M`（来自 `content[]` 里 `diff` 的行数差）；多个合并时只给类别措辞。

`status: 'in_progress'` 的活动行末尾带一个小 spinner，不换措辞。失败（`status: 'failed'`）的行转 `danger` 色，措辞前缀「失败：」。

`plan` 与 `subagent_task` 各自独占一行，不参与聚合。

## 投影：摘要 + 按需详情

`projectHistory` 停止全量投影，改为**正文全量、工具摘要**。

助手正文本身就是阅读内容，截断它等于读一段话还要二次加载——所以 `text` / `thought` 的 `text` 字段完整进流。工具的 payload 不进流：`content[]`、`rawInput`、`rawOutput`、完整 terminal 输出一律留在 doc 里，用户点开 sheet 时才取。

这条设计和「详情走 sheet」的 UI 决策是同一件事的两面：sheet 本来就是异步呈现，天然容得下一次取数。

### 载荷信封

```
{
  v: 1,
  sessionId, generation, revision,
  status, reason,
  awaitingUserSince?: number,
  entries: [{
    id, rev, role, status, finished,
    timestamp, startedAt?, endedAt?, permissionWaitMs?,
    items: [ItemSummary]
  }]
}
```

`generation` 标识 data-runtime 实例，重启后自增；RN 丢弃 generation 落后于当前的载荷。`revision` 单调递增，用于乱序保护。

`ItemSummary` 按 type 分派，共有字段 `{ itemId, rev, type }`：

| type            | 附加字段                                                                 |
| --------------- | ------------------------------------------------------------------------ |
| `text`          | `text`（全量）                                                           |
| `thought`       | `text`（全量）                                                           |
| `tool_call`     | `kind`, `title`, `status`, `path?`, `added?`, `removed?`, `hasDetail`, `permission?: { requestId, pending }` |
| `plan`          | `entries: [{ content, status, priority }]`                               |
| `subagent_task` | `taskId`, `status`, `actor?`, `description?`                             |
| 其余            | 仅共有字段 —— RN 渲染成一行中性活动，不再出现「请在电脑上查看」          |

`itemId` 优先取持久化 id（`tool_call.toolCallId`），没有的用 LoroList 元素身份，**绝不用数组下标或内容哈希**——下标在并发插入下会漂移，哈希在流式追加时每帧都变，两者都会让 memo 和 sheet 的失效判断失效。

`rev` 在该 item 的任一字段变化时递增。RN 侧的 `memo` 比较 `rev`，sheet 的保鲜判断也比较 `rev`。

Swift 只透传这个信封，不解析 `items`。新增 item type 不需要动 Swift。

### 节流

节流放 data-runtime，`emit` 之前，且**不能只节流 emit**。只挡桥不挡 CPU 的话，每次 doc 更新照样跑一遍 `toJSON` 和全量投影。所以：

1. 按脏 entry 缓存投影结果。doc 订阅给出变更路径，只重投影受影响的 entry，其余复用上次的对象引用（这也让 RN 侧的 memo 直接命中）。
2. 正文追加走尾沿节流：100 ms 尾沿，最长等待 200 ms。
3. **状态翻转、turn 完成、出现待授权请求：立即刷新**，不进节流队列。这三类是用户在等的信号，延迟 200 ms 就能被感知。

Swift 和 RN 不再叠加节流。

### 按需详情

新增 `sessionItemDetail(entryId, itemId, cursor?)`，沿用现有 Swift → WebView `callAsyncJavaScript` 的请求/响应模式。请求带请求编号、`generation`、已知的 `rev`；响应回 `content[]` / `rawInput` / `rawOutput` 的完整内容，超长的 terminal 输出分页（`cursor` + `nextCursor`）。

sheet 打开时**原子地**注册订阅并取快照。之后 data-runtime 只推该 item 的 `rev` 失效通知，sheet 收到后重读——不轮询。sheet 关闭时退订。runtime 重启（`generation` 变化）后重建订阅并丢弃在途的旧响应。

`hasDetail: false` 的 item 不给点击态。

## 权限

`tool_call.permissionRequest` 有 `requestId`、`options[]`，无 `outcome` 即待答。作答就是往 LoroDoc 写 `permissionRequest.outcome`——桌面端 `workspace-writer-impl.ts:148` 就是这么做的，**不走 RPC**。机器订阅 doc 等这个字段。

判断「是否有待答请求」读 `SessionMeta.awaitingUserSince`（`schema.ts:898`），不扫 history。机器在 resolve 时会 `clearAwaitingUser()`。这个字段在会话列表页同样可用来打「等你」角标——收件箱的「需要你」分区目前靠 `sessionStatus()` 推断，改用它更准，但那是收件箱的事，不在本轮范围内，只在此记一笔。

### 何时弹

满足三条时**自动** `present` 一个 `pageSheet`：用户正停留在该会话页、请求是新出现的（本次呈现未展示过该 `requestId`）、`outcome` 仍为空。

`sheetAllowedDetents: 'fitToContents'`，选项按钮直接来自 `options[]`，不硬编码「允许 / 拒绝」。

用户滑掉 sheet **不写任何 outcome**，本次呈现对该 `requestId` 去重不再自动弹；转录里该活动行转 warning 色并显示「等待你的批准 ›」，点击重新打开。

### 写入路径与 `sendTurn` 的区别

| | `sendTurn` | 权限作答 |
| --- | --- | --- |
| history | 新增 entry | 不新增 |
| 后续动作 | Streams RPC `session/dispatch-turn` + 等 ACK | 无 |
| 失败语义 | 已保存待确认 / 结果未知 | 直接失败，可重试 |
| 重启后 | 不自动重放（`autoSent` ref） | 不自动重放，重读 `outcome` |

提交前校验三件事：`requestId` 仍是当前待答的、选中的 option 在 `options[]` 里、`outcome` 仍为空。重复提交同一答案视为成功；`outcome` 已存在且不同则拒绝并以 doc 为准刷新 UI。

结果不明时**先重读 `outcome`**再决定，不盲目重发——符合项目硬规则「Never automatically replay writes across runtime recovery」。

**已知偏差**：机器端 `message-handler.ts:8618` 用 `let resolved = false` 守着，第一个到达的 outcome 生效、后续忽略，所以两台设备同时作答不会执行两次。但 CRDT 是 LWW，doc 里最终显示的 outcome 可能不是机器实际采纳的那个。这是化妆品级偏差，不做补偿。

## 原生手感

三个已验证的事实决定了实现层级：

- `InputAccessoryView` 是 RN 内置的（`react-native/Libraries/Components/TextInput/`），直接挂在 iOS 键盘上。装了它就**不需要 `KeyboardAvoidingView`**，composer 跟随键盘是系统行为。
- `maintainVisibleContentPosition` ScrollView 支持。流式追加用它，可以整段删掉手写的跟随逻辑。
- `PagePresentationOptions` 已经支持 `sheetAllowedDetents: 'fitToContents'`，sheet 自适应高度不用新写原生件。

所以：RN 内置件打底，LodyKit 只补两件真的缺的。

**RN 侧**
- 删 `KeyboardAvoidingView`，composer 移入 `InputAccessoryView`
- 删 `following` / `showJump` / 两处 `scrollToEnd`，换 `maintainVisibleContentPosition`（`autoscrollToTopThreshold` 控制「贴底才跟随」）
- `ScrollViewMarker` 继续包 `FlatList`，`softScrollEdgeEffects` 保留

**LodyKit 新增**
1. `LodyContextMenu` —— `UIContextMenu`，助手正文长按复制。RN 的 `selectable` 在长正文里选择体验差，且拿不到「复制整条」这个动作。
2. 活动行的 SF Symbol —— 复用现有 `LodySymbolButton` 的 symbol 解析路径，不新造组件。

`sheetAllowedDetents` 与 haptic（`selectionFeedback`）用现成的。

## 结构

```
features/sessions/
  SessionScreen.tsx          订阅 + 发送 + 布局，目标 150 行内
  transcript/
    Transcript.tsx           FlatList + 跟随策略
    TurnHeader.tsx           时间 / 已工作 / 复制 / hairline
    UserBubble.tsx
    AssistantProse.tsx       MarkdownBody 的容器
    ActivityRow.tsx          聚合后的一行
    aggregate.ts             ItemSummary[] → 渲染行，纯函数，node test 直跑
  detail/
    itemDetailPage.tsx       definePage，活动行详情 sheet
    permissionPage.tsx       definePage，权限 sheet
ui/
  MarkdownBody.tsx           设计语言文档里挂账的那个组件
```

`aggregate.ts` 是纯函数、零 RN 依赖，与 `inbox.ts` 同样用相对路径 + `.ts` 后缀导入，`node --test` 直接跑。聚合规则、`+N −M` 计算、状态措辞全部在这里，是本轮唯一值得写单测的逻辑。

`MessageBubble.tsx` 删除，内容拆进 `transcript/`。

## 错误与降级

- **载荷超 12 MiB**：Swift 侧现在静默丢弃。改为发一个 `{ truncated: true }` 的信封，RN 在转录顶部显示一行「较早的消息未能同步」。不静默。
- **`sessionItemDetail` 失败**：sheet 显示错误态与重试按钮，不关闭 sheet。
- **权限提交失败**：sheet 保持打开，按钮恢复可点，显示原因。不自动重试。
- **generation 不匹配**：丢弃载荷与在途响应，不报错——runtime 重启是正常的后台恢复路径。
- **未知 item type**：渲染中性活动行，不显示占位文案。

## 已知上限

摘要投影砍掉 payload 之后，12 MiB 上限大概率触不到。但很长的会话（几千条 entry，正文全量进流）理论上仍可能超。本轮不做分页，只做上面那条显式降级。真顶不住时的升级路径是**增量投影**：data-runtime 只发变化的 entry，RN 按 id 合并。这需要在 CRDT 侧做 diff 追踪，单独一轮。

## 实施顺序

1. **投影管线** —— `ItemSummary` schema、脏 entry 缓存、节流、信封。此步会破坏 `MessageBubble` 依赖的 `label` 字段，所以同时把 `MessageBubble` 降级为读 `ItemSummary` 的最小渲染（正文照旧、其余一行灰字），不追求最终形态——目的是让 1 和 3 之间的每一步都能构建、能跑。
2. **`aggregate.ts` + 单测** —— 纯逻辑，无需构建。
3. **转录渲染** —— `MarkdownBody`、`TurnHeader`、`ActivityRow`、拆 `MessageBubble`。
4. **键盘与滚动** —— `InputAccessoryView` + `maintainVisibleContentPosition`，删手写跟随。
5. **`sessionItemDetail` + 详情 sheet** —— 请求/响应、订阅保鲜、分页。
6. **权限 sheet** —— 自动呈现、写 `outcome`、`awaitingUserSince` 接入。
7. **`LodyContextMenu`** —— 长按复制。

1、5、6 涉及 data-runtime，需要 `pnpm native:assets` 重新打包 data-runtime 后再构建。7 涉及原生，需要正常签名的模拟器构建。

## 验证

每步之后：`pnpm check`、`pnpm test`、`pnpm bundle`。1、5、6、7 需要 iOS 模拟器构建。

行为验收（真实账号数据，模拟器）：

- 一段含读文件、编辑、执行命令的真实转录，活动行按连续同类聚合，措辞与 `+N −M` 正确
- 流式回复期间正文平滑追加，贴底时自动跟随，手动上滑后不再被拽回
- 键盘弹出与 interactive dismiss 期间 composer 无跳变
- 点活动行开 sheet，terminal 输出完整可读；sheet 打开期间该 item 仍在追加时，内容会刷新
- agent 请求权限时 sheet 自动弹出；作答后机器继续执行
- 滑掉权限 sheet 不写 outcome，转录留下可点的「等待你的批准」，点回去能作答
- 杀掉 data-runtime 再恢复：不重复发送、不重复作答，UI 以 doc 为准
