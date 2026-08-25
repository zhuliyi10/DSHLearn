# s02 迷你 Cordis 上下文

> *"没有特权核心，一切皆插件。"*

**状态：已实现** ✅ —— 本课造 dsh 的地基：一个极简的 Cordis 风格插件上下文。从这节课起，后面所有课都是「往这个上下文上挂插件」。

## 本课要解决的问题

s01 的循环把一切写死在主函数里：模型客户端、工具、执行逻辑全是模块级常量。dsh 的答案是 Cordis——所有部件都以**插件**身份向共享上下文 `ctx` 注册，注册本身是**副作用**，插件卸载时自动回卷。

## 实现要点

- [x] `Context` 对象：用键挂载服务（如 `ctx.llm`、`ctx.tools`），重复注册同名服务即替换（旧注册回卷）；
- [x] `ctx.plugin(apply)`：挂载一个插件，`apply(ctx)` 返回 dispose 函数；
- [x] 注册即 effect：每次注册产出一个可 `dispose()` 的句柄，卸载插件时按注册逆序回卷；
- [x] 插件树：子上下文（对应 dsh 的 agent-scoped `agent.ctx`），父级卸载连带卸载子级；
- [x] demo：把 s01 的「模型适配器」「bash 工具」改造成两个插件挂到 ctx 上，循环只消费 ctx。

## dsh 中的真实实现

| 主题 | 位置 |
|---|---|
| Cordis 入门 | `../deepseek-harness/docs/cordis-primer.md`、`docs/cordis-tutorial/` |
| 架构总览（插件树、无特权核心） | `../deepseek-harness/docs/architecture.md` |
| 按 agent 作用域的注册原语 | `../deepseek-harness/packages/core/scope` |

**关键差异**：真实 Cordis 还有 fiber、依赖解析、并行生命周期管理；本课只取「注册/替换/回卷」三个语义。

上一课：[s01](../s01-agent-loop/) ｜ 下一课：[s03](../s03-events-bus/)
