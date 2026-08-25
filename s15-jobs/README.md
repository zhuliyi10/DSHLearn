# s15 后台任务

> *"慢操作丢后台，完成后注入通知。"*

**状态：已实现** ✅ —— agent 不该干等慢命令：把它丢进后台 job，完成后注入一条上下文叫醒 agent。

## 本课要解决的问题

跑测试、装依赖这类操作动辄几分钟，同步等待浪费整个循环。dsh 的 `ctx.jobs` 是长时任务运行时：kind 可扩展（`bash`、`subagent`），id 形如 `bash-1`；面向模型的 `job_*` 工具负责收集输出与停止任务；任务完成后的结果以注入上下文的形式进入 agent 的下一轮。访问控制靠拥有者授权，不靠 id 保密。

## 实现要点

- [x] `JobRegistry`：`start(kind, run)` 返回 JobId，状态机 `running → done/failed/stopped`；
- [x] 工具族：`bash_background`（启动）、`job_collect`（取输出）、`job_stop`（停止）；
- [x] 完成通知：job 结束时把结果摘要 `inject` 进 agent 收件箱（复用 s04/s05 的注入机制）；
- [x] 循环改造：无欠着的工具结果但有注入通知时，唤醒新一轮；
- [x] demo：agent 后台跑 `sleep + 输出`，同时继续处理别的提问，稍后收到完成通知并汇总。

## dsh 中的真实实现

| 主题 | 位置 |
|---|---|
| jobs 运行时 | `../deepseek-harness/docs/subsystems/jobs.md` |
| 源码 | `../deepseek-harness/packages/jobs` |
| 收件箱与注入 | `../deepseek-harness/docs/subsystems/core.md`（Agent 句柄） |

上一课：[s14](../s14-compaction/) ｜ 下一课：[s16](../s16-schedule/)
