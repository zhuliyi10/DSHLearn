# s13 Todo

> *"计划是日志里的一次全量快照。"*

**状态：已实现** ✅ —— 让 agent 先列计划再动手：todo 列表是一次全量写入的会话事件。

## 本课要解决的问题

多步任务里，把目标拆成可见清单能显著提升完成率。dsh 的 `todo/write` 是一条**全量快照**事件：模型每次提交整个列表（而非增量 patch），日志里最新一条写入即当前状态；它是 log-only 的 UI 状态，不参与派生模型历史。

## 实现要点

- [x] `todo/write` 事件：`{ todos: TodoItem[] }`，整表覆盖，追加进会话日志（复用 s04）；
- [x] `todo_write` 工具：校验列表合法性（id 唯一、状态枚举）后写事件；
- [x] 渲染：从日志回放最新快照，在终端画出进度清单；
- [x] 与循环的关系：写 todo 是普通一步，不欠工具结果之外没有特殊控制流；
- [x] demo：给 agent 一个三步任务，观察它维护清单直至全部完成。

## dsh 中的真实实现

| 主题 | 位置 |
|---|---|
| `todo/write` 事件定义 | `../deepseek-harness/packages/core/session/src/types.ts` |
| todo 包 | `../deepseek-harness/packages/todo` |

上一课：[s12](../s12-skill-loading/) ｜ 下一课：[s14](../s14-compaction/)
