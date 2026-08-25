# s14 上下文压缩

> *"摘要遮掉旧日志，锁保证崩溃可见。"*

**状态：已实现** ✅ —— 上下文总会满：用一次摘要调用遮蔽旧日志，且全程事件化、可恢复。

## 本课要解决的问题

长会话迟早撞上上下文上限。dsh 的 compaction seam 是可选能力（Service：`ctx.compaction`，Provider：如 basic 后端，Consumer：`/compact` 命令）。它**不删日志**：先记 `compaction/start` 拿锁，生成摘要写 `compaction/summary`，再用一条带 `surfaceOp: replace` 的合成 user 消息替换被遮蔽区段——唯一的 surface 变更就是这条替换。最后 `compaction/end` 放锁；中途崩溃会留下未匹配的 start，成为可检测的遗留锁。

## 实现要点

- [x] 三个仅日志事件：`compaction/start` / `compaction/summary` / `compaction/end`（声明合并扩展 s04 的事件词汇）；
- [x] 锁语义：start/end 配对，遗留 start = 可检测的操作中断；
- [x] 摘要替换：选旧区段 → 调模型生成摘要 → `deriveMessages` 用摘要遮掉该区段；
- [x] 触发策略：估算 token 超阈值自动触发（自动轮次编号），也支持手动；
- [x] demo：跑一个长任务撑爆阈值，观察压缩前后模型历史的变化与日志的完整记录。

## dsh 中的真实实现

| 主题 | 位置 |
|---|---|
| compaction seam 全貌 | `../deepseek-harness/docs/subsystems/compaction.md` |
| 源码 | `../deepseek-harness/packages/compaction` |

上一课：[s13](../s13-todo/) ｜ 下一课：[s15](../s15-jobs/)
