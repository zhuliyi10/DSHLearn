# s01 Agent Loop

> *"一个循环 + 工具 = agent 的最小形状。"*

**状态：已实现** ✅ —— 全部 20 课的起点，唯一需要真实 API Key 的课程（其余各课为离线脚本化演示）。后面每课都会在这份代码的某一块上做替换或扩展。

## 运行

```sh
# 根目录
cp .env.example .env   # 填入 ANTHROPIC_API_KEY / MODEL_ID / ANTHROPIC_BASE_URL
pnpm install
pnpm s01
```

随便输入一个任务（如「统计当前目录有多少个 TypeScript 文件」），观察 agent 一步步调 bash、拿结果、再推理，直到给出答案。

## 核心模式

```text
User --> messages[] --> LLM --> response
                                  |
                        stop_reason == "tool_use"?
                         /                    \
                       yes                     no
                        |                       |
                  执行工具、回灌结果          返回文本，轮次结束
                  loop back --> messages[]
```

对应 dsh 的词汇：

- **turn（轮次）**：一次用户输入的完整处理过程；
- **step（步骤）**：一次模型请求 + 它请求的所有工具调用。有工具结果欠着，就进入下一个 step；
- 模型决定何时调工具、何时停止——循环只是执行模型的要求。

## 代码导读

[src/index.ts](./src/index.ts) 四个部分：

1. **模型连接**：走 Anthropic 兼容端点（官方或 DeepSeek/GLM 等代理）。dsh 里这是 LLM seam 的适配器插件；
2. **工具词汇**：`TOOLS` 只有 schema。dsh 里 `ToolDefinition` 把「模型可见的 schema」和「宿主私有的 execute」严格分开；
3. **`runTurn()`**：核心循环。注意它只用 `stop_reason` 与 `tool_use` 块驱动，没有任何 if-else 编排——agency 在模型里；
4. **REPL**：`messages[]` 是唯一的记忆。

## 本课的三块「将来会被拆掉」的部分

| 现在 | 未来 |
|---|---|
| `messages[]` 数组当记忆 | s04：仅追加会话日志，历史从日志派生 |
| `SYSTEM` 写死字符串 | s05：提示词段落由插件注册、每步组装 |
| `executeBash` 内联在循环里 | s06：注册表 + 执行流水线；s07：先过审批闸 |

## dsh 中的真实实现

| 主题 | 位置 |
|---|---|
| agent loop driver | `../deepseek-harness/packages/core/agent-loop` |
| Agent 接口与句柄 | `../deepseek-harness/packages/core/agent`、`docs/subsystems/core.md` |
| turn flow 全图 | `../deepseek-harness/docs/architecture.md` |
| 最小组合示例 | `../deepseek-harness/examples/headless-agent` |

**关键差异**：dsh 的循环是流式的（`llm/stream` + `assistant/chunk`）、事件化的（每个事实写日志）、可拦截的（`agent/pre-step` 等 waterfall）；本课取它最朴素的同步骨架。

下一课：[s02 迷你 Cordis 上下文](../s02-cordis-context/)
