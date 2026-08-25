# s19 目标循环

> *"目标决定循环什么时候真正结束。"*

**状态：已实现** ✅ —— 最后一环：给会话一个同会话目标，agent 每次想停下时先由目标裁决——没达成就继续，达成/不可能/超上限才真正交还控制权。

## 本课要解决的问题

普通轮次在模型不再调工具时就结束。但对「做完为止」的任务，需要一个持久的目标域。dsh 的 `ctx.goals` 是事件溯源的目标服务：`GoalRef` 带修订号做 compare-and-set，每次获准的持久变更递增修订；持久阶段 `active / paused / blocked / complete` 回答目标发生了什么，进程本地的**激活状态**另行回答续跑消费方能否开始下一个 Round。续跑通过 `agent/*` 事件驱动，目标是同会话的——不新开 agent，接着原会话跑。

## 实现要点

- [x] `Goal` 域：`set/update`（CAS 修订号）、阶段机 `active → paused/blocked/complete`；
- [x] 停止裁决：拦截轮次收尾（对应 `agent/turn-stopping` 的位置），目标 active 且判定未完成 → 注入「继续」开启下一轮；
- [x] 独立判断器：是否完成由一次专门的模型判定回答，而非执行 agent 自己说了算；
- [x] 续跑上限与退出条件：不可能、反复失败、超过 round 上限 → 交还用户；
- [x] demo：设一个需要多轮工具调用的目标（如「让测试全绿」），观察 agent 自主续跑直到完成或触顶。

## dsh 中的真实实现

| 主题 | 位置 |
|---|---|
| 同会话目标 | `../deepseek-harness/docs/subsystems/goal.md` |
| 源码 | `../deepseek-harness/packages/goal` |
| `agent/turn-stopping` 语义 | `../deepseek-harness/docs/architecture.md`（Turn flow） |

上一课：[s18](../s18-workflow/) ｜ 下一课：[s20](../s20-beyond/)
