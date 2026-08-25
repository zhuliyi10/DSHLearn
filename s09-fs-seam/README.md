# s09 文件系统 seam

> *"fs 和 subprocess 共享一个执行世界。"*

**状态：已实现** ✅ —— 第二个 seam：文件读写也抽成 Provider/Consumer，并演示它与 shell seam 共享同一个执行世界。

## 本课要解决的问题

dsh 里文件系统访问同样是一个 seam：`ctx.fs` Provider 提供读写能力，`fs/*` 事件承载访问策略，面向模型的文件工具是 Consumer。因为 fs Provider 和 subprocess Provider 指向同一个执行世界，把两者一起指向远程沙箱时，文件操作和命令执行自动落到同一台远端——**不存在 Provider 分叉**。

## 实现要点

- [x] Service Definition：`FsBackend`（`read` / `write` / `list`）；
- [x] Provider A：本地 `node:fs`；Provider B：根目录锁定的虚拟 fs（越界即报错）；
- [x] 策略事件：`fs/write` waterfall，监听器可拒绝写入（与 s07 审批联动）；
- [x] Consumer：`read_file` / `write_file` 两个工具，只依赖 `ctx.fs`；
- [x] demo：同时切换 fs 与 shell Provider 到「受限世界」，跑一个需要读文件再执行命令的任务。

## dsh 中的真实实现

| 主题 | 位置 |
|---|---|
| 文件系统子系统 | `../deepseek-harness/docs/subsystems/filesystem.md` |
| 源码 | `../deepseek-harness/packages/fs` |
| 共享执行世界的设计 | `../deepseek-harness/docs/architecture.md`（Capability seams 一节） |

上一课：[s08](../s08-bash-seam/) ｜ 下一课：[s10](../s10-mcp-seam/)
