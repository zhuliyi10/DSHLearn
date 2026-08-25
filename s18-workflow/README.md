# s18 工作流

> *"编排形状固定时，就把它写成脚本。"*

**状态：已实现** ✅ —— 当多 agent 编排的形状是确定的，就不必每步都问模型：让模型写一段编排脚本，由引擎在隔离环境里执行。

## 本课要解决的问题

探索性工作交给 agent loop，形状固定的编排交给 workflow。dsh 的 workflow seam：Service `ctx.workflowEngine`（每个 ctx 一个引擎），Provider 是 worker-thread 实现（每个 run 一个 worker，脚本跑在 vm 上下文里），Consumer 是面向模型的 `workflow` 工具。模型产出 `{ script, meta, args }`；`meta`/`args` 是普通 JSON 数据，引擎做 schema 校验，**绝不靠对脚本文本求值获取它们**；脚本里 `agent()` 启动的每个子 agent 都归属于必填的 `parent`。

## 实现要点

- [x] `WorkflowEngine` 接口 + 一个 worker/vm 风格的 Provider（本课可用受限 eval 模拟）；
- [x] 脚本词汇：全局 `args`、`agent(prompt)` 启动子 agent（复用 s11）、顶层 await、`return <json>`；
- [x] `meta`/`args` schema 校验：无效数据在工作开始前明确拒绝；
- [x] 策略边界：`maxTotalAgents` 上限、子 agent 深度继承，脚本观察不到也改不了策略；
- [x] demo：模型写一个「3 个子 agent 并行调研 + 汇总」的脚本，引擎执行并返回结构化结果。

## dsh 中的真实实现

| 主题 | 位置 |
|---|---|
| workflow seam 全貌 | `../deepseek-harness/docs/subsystems/workflow.md` |
| 源码（seam + worker-thread 引擎 + 工具） | `../deepseek-harness/packages/workflow` |

上一课：[s17](../s17-integrated-harness/) ｜ 下一课：[s19](../s19-goal-loop/)
