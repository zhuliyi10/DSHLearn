# s16 定时提醒

> *"提醒持久化，回到原会话变成一轮对话。"*

**状态：已实现** ✅ —— 时间触发：agent 给自己设闹钟，到点时提醒作为普通后续轮次回到原会话。

## 本课要解决的问题

agent 不该只在有人说话时才工作。dsh 的 schedule 拥有**持久提醒**：session 内唯一的 ScheduleId，支持 `after`（延时）、`at`（绝对时刻）、`every`（固定间隔，最小五分钟）；创建时一切目标规范化为 RFC 3339 UTC。到点后提醒以**对话式交付**回到原 live Session——没有回执边界，就是一次普通的后续轮次。

## 实现要点

- [x] `ScheduleRecord`：三种 kind（`after` / `at` / `every`），持久化到文件（重启不丢）；
- [x] 调度器：定时扫描到期项，触发交付；
- [x] 交付 = 注入：到期提醒作为一条合成 user 消息进入原会话的下一轮（复用 s15 的唤醒路径）；
- [x] 工具族：`schedule_create` / `schedule_list` / `schedule_cancel`；
- [x] demo：让 agent「5 秒后提醒我查看测试结果」，期间继续对话，到点看到提醒触发新一轮。

## dsh 中的真实实现

| 主题 | 位置 |
|---|---|
| schedule 子系统 | `../deepseek-harness/docs/subsystems/schedule.md` |
| 源码 | `../deepseek-harness/packages/schedule` |
| web 端定时示例 | `../deepseek-harness/examples/web-schedule` |

**关键差异**：dsh 强调显式时区边界与浏览器本地解释；本课用进程内定时器取骨架语义。

上一课：[s15](../s15-jobs/) ｜ 下一课：[s17](../s17-integrated-harness/)
