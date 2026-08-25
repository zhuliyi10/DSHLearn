# s20 进阶地图

> *"读完 20 课之后往哪走。"*

**状态：文档课（无代码）** —— 20 课覆盖了 dsh 的主干机制，这一课给出继续深入的路线图，以及如何在**真实的 dsh** 上动手。

## 本仓库没讲、但 dsh 里值得深挖的部分

| 主题 | 一句话说明 | 入口 |
|---|---|---|
| 沙箱 | 包住 spawn 的 argv，把进程关进后端 | `packages/sandbox`、`docs/subsystems/sandbox.md` |
| ACP | Agent Client Protocol，给 approval 提供机器应答者 | `packages/acp` |
| 持久化与崩溃恢复 | 会话日志怎么落盘、回放、checkpoint | `docs/subsystems/persistence.md` |
| 流式与 token 计量 | `assistant/chunk` 逐 token 回放、usage 随行 | `docs/subsystems/llm-streaming.md`、`token-meter.md` |
| 终端与 LSP | PTY 持久终端、LSP seam 跟着执行世界走 | `docs/subsystems/terminal.md`、`lsp.md` |
| Web 应用 | 从 `session/event` 渲染 UI、Chat node | `packages/web`、`docs/subsystems/web.md` |
| 防御性模式 | fail loud、fail closed 等工程纪律 | `docs/defensive-patterns.md` |
| 术语表 | 全部概念的权威定义 | `docs/glossary.md` |

## 在真实 dsh 上动手

1. **跑起来**：在 `../deepseek-harness` 里 `pnpm install && pnpm run build && pnpm dsh web`，打开 `http://127.0.0.1:3080`；
2. **看组合**：`dsh --profile web --dump-config`，对照 s17 理解插件树；
3. **读示例**：`../deepseek-harness/examples/`（headless-agent、web-cordis、mcp-memory、web-schedule…）；
4. **写插件**：跟 `docs/cookbook/`——添加包、添加工具、添加 LLM 适配器、添加 Chat node；
5. **守规矩**：动手前先读 `AGENTS.md` 与 `docs/development.md`。

## 一个毕业练习

给真实 dsh 写一个自己的工具插件（例如 `dsh-tool-dice`），让它：

- 通过 `defineTool` 声明 schema 与规范输出；
- 出现在 `dsh --dump-config` 的组合里；
- 在 Web UI 里被模型成功调用，结果出现在会话日志中。

完成它，你就从「学习 harness」毕业到「构建 harness」了。

上一课：[s19](../s19-goal-loop/) ｜ 返回目录：[README](../README.md)
