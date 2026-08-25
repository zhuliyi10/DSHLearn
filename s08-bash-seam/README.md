# s08 Bash seam

> *"执行器可换：本地 spawn 或远程沙箱。"*

**状态：已实现** ✅ —— 第一次完整走一遍 capability seam 的三角色结构：Service Definition、Service Provider、Consumer。

## 本课要解决的问题

到目前为止 bash 的实现焊死在工具里。dsh 把它抽成一个 seam：`ctx.shell` 是接口（Service Definition），本地 spawn 是一个 Provider，远程沙箱是另一个 Provider，面向模型的 bash 工具是 Consumer。**换 Provider，Bash/PTY/LSP 整条执行世界跟着搬家，工具代码一行不改。**

## 实现要点

- [x] Service Definition：`ShellBackend` 接口（`run(command, opts): ShellResult`），每个 ctx 只允许一个激活实现；
- [x] Provider A：本地 `spawn` 执行；Provider B：带白名单目录的「受限沙箱」模拟；
- [x] Consumer：bash 工具只调用 `ctx.shell`，不再碰 `child_process`；
- [x] demo：同一条 agent 任务，切换 Provider 重跑，观察行为差异（如沙箱拒绝越界路径）；
- [x] 体现「替换而非并存」：注册第二个 Provider 即替换第一个。

## dsh 中的真实实现

| 主题 | 位置 |
|---|---|
| shell/subprocess 子系统 | `../deepseek-harness/docs/subsystems/shell.md`、`subprocess.md` |
| 沙箱后端 | `../deepseek-harness/docs/subsystems/sandbox.md`、`packages/sandbox` |
| capability seam 概念 | `../deepseek-harness/docs/capability-seams.md` |
| bash 工具 | `../deepseek-harness/packages/shell/tool-bash` |

上一课：[s07](../s07-approval-guard/) ｜ 下一课：[s09](../s09-fs-seam/)
