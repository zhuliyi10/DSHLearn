# s06 工具注册与执行流水线

> *"schema 给模型，execute 留给宿主。"*

**状态：已实现** ✅ —— 把 s01 里内联的工具执行，换成 dsh 的带作用域注册表与受保护执行流水线。

## 本课要解决的问题

dsh 的 `ToolDefinition` 严格区分「模型可见」与「宿主私有」：面向模型的只有 name/description/parameters；`execute`、超时、并发安全性、UI 呈现绝不泄漏进模型请求。执行本身走一条可被插件包裹的流水线。

## 实现要点

- [x] `defineTool()`：声明 schema + 规范输出 + `execute`；注册进 `ctx.tools`；
- [x] `schemas()`：显式允许列表投影——只导出 name/description/parameters；
- [x] 执行流水线 waterfall：`tools/pre-execute` → `tools/execute` → `tools/post-execute`，任一环节可拦截或改写；
- [x] 结果规范化：execute 只返回声明过的 JSON 值，由 `output.render` 投影成模型内容；
- [x] demo：注册 bash + read_file 两个工具，并用一个「审计插件」包裹 `tools/execute` 打印每次调用。

## dsh 中的真实实现

| 主题 | 位置 |
|---|---|
| `ToolDefinition` 与 schema DSL | `../deepseek-harness/docs/subsystems/tools.md` |
| 执行流水线 | `../deepseek-harness/docs/tool-execution-pipeline.md` |
| 源码 | `../deepseek-harness/packages/core/tools` |
| 添加工具指南 | `../deepseek-harness/docs/cookbook/adding-a-tool.md` |

**关键差异**：dsh 还有 `finalizeContent`、`isConcurrencySafe` 并行分组、超时预算策略等；本课只取注册 + 白名单 + 流水线三件事。

上一课：[s05](../s05-system-prompt/) ｜ 下一课：[s07](../s07-approval-guard/)
