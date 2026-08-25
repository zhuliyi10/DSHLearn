# s05 系统提示词组装

> *"提示词是插件注册的段落，不是写死的字符串。"*

**状态：已实现** ✅ —— 把 s01 里写死的 `SYSTEM` 常量，换成 dsh 的组装机制：提示词段落与工具 schema 都由插件注册，循环在每个 step 前现装配。

## 本课要解决的问题

dsh 的 `ctx.systemPrompt` 负责 prompt-section 与 tool-schema 组装。环境信息（cwd、平台）、工具说明、skill 目录、注入上下文……来自不同的插件；每个 step 读到的请求前缀是当场组装的，因此任何插件挂载/卸载都立刻反映在提示词里。

## 实现要点

- [x] `ctx.systemPrompt.section(id, render)`：注册一个段落渲染器（插件身份注册，随插件回卷）；
- [x] `assemble()`：按序拼接所有活跃段落，生成请求前缀；
- [x] 工具 schema 走同一条组装路：`ctx.tools.schemas()` 产出的 schema 列表与段落一起进入请求；
- [x] demo：注册「环境」「行为守则」「当前时间」三个段落插件，观察卸载其中一个后下一个 step 的提示词变化；
- [x] 提示词快照写入日志（对应 dsh 的 `request/header` 事件，便于回放重建）。

## dsh 中的真实实现

| 主题 | 位置 |
|---|---|
| 段落与 schema 组装 | `../deepseek-harness/docs/subsystems/system-prompt.md` |
| 源码 | `../deepseek-harness/packages/core/system-prompt` |
| 工具呈现（哪些字段能进请求） | `../deepseek-harness/packages/core/agent-tool-presentation` |

上一课：[s04](../s04-session-log/) ｜ 下一课：[s06](../s06-tool-pipeline/)
