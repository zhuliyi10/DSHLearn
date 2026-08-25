# s10 MCP 接入

> *"外部工具插进同一个工具池。"*

**状态：已实现** ✅ —— seam 模式不只能换自家 Provider，还能把**外部进程**的工具接进 `ctx.tools`。

## 本课要解决的问题

MCP（Model Context Protocol）让第三方服务器暴露工具。dsh 的做法符合一贯的 seam 哲学：MCP 客户端是一个插件，它把远端工具**注册进同一个 `ctx.tools`**——对模型和循环来说，MCP 工具和内置工具没有任何区别，权限、审批、审计走同一条流水线。

## 实现要点

- [x] 迷你 MCP 客户端：JSON-RPC over stdio，实现 `tools/list` 与 `tools/call`；
- [x] 写一个迷你 MCP 服务器（比如 `get_time` / `calc` 两个工具）作为被测对象;
- [x] 桥接插件：启动服务器进程，把 `tools/list` 结果逐个注册进 `ctx.tools`，`execute` 转发为 `tools/call`；
- [x] 命名空间与卸载：工具名带 server 前缀；插件卸载时断开进程、注册回卷；
- [x] demo：agent 混用内置 bash 与 MCP 工具完成任务，验证 s06/s07 的流水线对外部工具同样生效。

## dsh 中的真实实现

| 主题 | 位置 |
|---|---|
| MCP 包 | `../deepseek-harness/packages/mcp` |
| 外部工具接入工具池 | `../deepseek-harness/docs/architecture.md`（Where new behavior goes） |

**关键差异**：dsh 的 MCP 集成还要处理服务器生命周期、凭证与远程传输；本课只取 stdio + 工具桥接的骨架。

上一课：[s09](../s09-fs-seam/) ｜ 下一课：[s11](../s11-subagent/)
