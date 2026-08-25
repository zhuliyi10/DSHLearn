# s04 会话日志

> *"模型可见的，必须能从日志重建。"*

**状态：已实现** ✅ —— 拆掉 s01 的 `messages[]`，换成 dsh 的真源：一份仅追加的 `SessionEvent` 日志，模型历史从日志**派生**。

## 本课要解决的问题

dsh 不存「对话数组」。`Session` 是一份仅追加的类型化事件日志，是 agent 完整交互历史的唯一真源；LLM 消息历史由 `deriveMessages()` 从日志派生，回放、fork、持久化都从同一条流重建。不变式：**任何到达模型请求的内容，都必须能从日志重建**。

## 实现要点

- [x] `SessionEvent` 词汇（取核心子集）：`turn/start`、`turn/end`、`step/start`、`step/end`、`user/message`、`assistant/message`、`tool/call`、`tool/result`；
- [x] `session.append(event)`：仅追加，seq 连续递增，负载必须可 JSON 序列化（不合法直接拒绝）；
- [x] `deriveMessages(log)`：从日志投影出模型可见的消息历史（只有产生消息的事件参与）；
- [x] 用日志驱动 s01 的循环：turn 开启 → step 内追加事件 → 下一个 step 从日志重新派生历史；
- [x] 回放 demo：把日志写到 JSONL 文件，从文件重建同一份 `deriveMessages` 结果。

## dsh 中的真实实现

| 主题 | 位置 |
|---|---|
| 事件词汇与派生规则 | `../deepseek-harness/docs/subsystems/session.md` |
| `SessionEventMap` 类型 | `../deepseek-harness/packages/core/session/src/types.ts` |
| 投影细节 | `../deepseek-harness/docs/subsystems/session-projection.md` |
| 持久化（崩溃恢复） | `../deepseek-harness/docs/subsystems/persistence.md` |

**关键差异**：dsh 还保留 `assistant/chunk` 原始流块以支持逐 token 回放，并有 `request/header` 等日志专用事件；本课只保留派生所需的最小集。

上一课：[s03](../s03-events-bus/) ｜ 下一课：[s05](../s05-system-prompt/)
