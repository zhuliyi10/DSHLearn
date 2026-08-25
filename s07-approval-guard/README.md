# s07 用户审批

> *"除了 allowed-once，一律拒绝。"*

**状态：已实现** ✅ —— 在工具流水线上挂第一道治理闸门：破坏性操作先问人，答案闭合、fail closed。

## 本课要解决的问题

dsh 的 `ctx.approval` 只回答一个问题：**这个具体操作能不能继续？** 请求经 `approval/request` waterfall 找到应答者（终端里的人、UI、自动化桥），结果为 `allowed-once` 才放行，其余一切（超时、无人应答、`denied`）都拒绝。每次询问/决定各写一条审计事件。

## 实现要点

- [x] `ApprovalResult`：`allowed-once` / `denied`（dsh 还支持 per-session 的 `ask`/`never` 记忆策略）；
- [x] `approval.request(op)`：生成请求 id，走 waterfall 找应答者，无应答者 = 拒绝；
- [x] 终端应答者：在 REPL 里弹出 `y/N` 确认；
- [x] 审计事件对：`approval/asked` / `approval/decided` 追加进会话日志；
- [x] 接入 s06：把审批包进 `tools/pre-execute`——bash 的危险命令（写文件、删除、sudo）强制过闸。

## dsh 中的真实实现

| 主题 | 位置 |
|---|---|
| 审批 seam 全貌 | `../deepseek-harness/docs/subsystems/approval.md` |
| 源码 | `../deepseek-harness/packages/interaction/user-approval` |
| 守卫与预设策略 | `../deepseek-harness/packages/guard`、`docs/subsystems/permission-presets.md` |

上一课：[s06](../s06-tool-pipeline/) ｜ 下一课：[s08](../s08-bash-seam/)
