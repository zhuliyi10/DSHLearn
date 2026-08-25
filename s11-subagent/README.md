# s11 Subagent

> *"子 agent 有自己的会话和深度上限。"*

**状态：已实现** ✅ —— 委派机制：把子任务交给一个全新的子 agent，它有自己的会话日志，最终只把一条结果带回父会话。

## 本课要解决的问题

单会话上下文会被探索性工作塞满。dsh 的 subagent seam 让 agent 把工作委派给子 agent：子 agent 拿到全新会话，过程中的杂乱观察留在子会话里，父会话只收到一条结论。它是**可选能力**，且是 dsh 里少有的「同一 ctx 可共存多个 Provider」的 seam（in-process / fork / ACP / Claude Code / Codex……按名称注册）。

## 实现要点

- [x] `SubagentProvider` 接口：`start(request)` 返回子运行结果；静态能力描述符，缺能力时明确报错（fail loud，不静默降级）；
- [x] in-process Provider：为子任务新建一套（会话日志 + 循环），跑完取最终文本；
- [x] 归属与边界：子 agent 记录 parent、继承 cwd、委派深度 +1，超过深度上限拒绝；
- [x] Consumer：`subagent` 工具注册进 `ctx.tools`；
- [x] demo：父 agent 把「探索目录结构并总结」委派给子 agent，观察父会话日志里只有一条工具结果。

## dsh 中的真实实现

| 主题 | 位置 |
|---|---|
| subagent seam 全貌 | `../deepseek-harness/docs/subsystems/subagent.md` |
| 源码（服务 + 6 个 Provider） | `../deepseek-harness/packages/subagent` |
| 可继续子 agent / report 通道 | 同上目录 `src/continuation.ts` |

上一课：[s10](../s10-mcp-seam/) ｜ 下一课：[s12](../s12-skill-loading/)
