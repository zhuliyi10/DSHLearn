# s03 类型化事件总线

> *"waterfall 管拦截，serial 管通知。"*

**状态：已实现** ✅ —— dsh 的扩展点不是回调表，而是分域的类型化事件。本课实现迷你事件总线，把「通知」与「拦截」两种语义分开。

## 本课要解决的问题

dsh 里拦截一次模型请求、拒绝一条输入、包裹一次工具执行，都不是改循环代码，而是监听对应事件。事件分两种形状：

- **waterfall（瀑布式）**：监听器必须调用 `next()` 才会向下传递，可以改写负载或短路——用于拦截（`agent/pre-step`、`agent/request`、`llm/stream`、`tools/*`）；
- **serial（串行）**：只通知、不拦截，没有 `next()`——用于观察（`agent/turn-stopping`、`session/event`）。

## 实现要点

- [x] `bus.on(name, listener)` 返回注销函数（注册即 effect，与 s02 的 ctx 集成）；
- [x] `bus.serial(name)`：按注册顺序逐个 await 监听器；
- [x] `bus.waterfall(name, payload)`：链式调用监听器，每个监听器拿 `(payload, next)`，可改写、可短路；
- [x] 事件域划分：`agent/*`、`tools/*`、`session/*` 三域，类型上互不混用；
- [x] demo：给 s01 的循环挂上 `agent/pre-step`（记录每步入场消息）与 `tools/execute`（包裹执行计时）。

## dsh 中的真实实现

| 主题 | 位置 |
|---|---|
| 事件全景（每个事件的产生方/消费方） | `../deepseek-harness/docs/event-producer-consumer.md` |
| turn flow 中各事件的位置 | `../deepseek-harness/docs/architecture.md`（Turn flow 一节） |
| 会话事件广播 `session/event` | `../deepseek-harness/packages/core/session` |

**关键差异**：dsh 的事件由 Cordis 托管生命周期（随插件卸载回卷），会话事件还要求无损 JSON 可持久化；本课只取调度语义。

上一课：[s02](../s02-cordis-context/) ｜ 下一课：[s04](../s04-session-log/)
