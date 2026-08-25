# DSHLearn -- 学习 DeepSeek Harness

用 20 节渐进式小实现，把 [DeepSeek Harness（`dsh`）](../deepseek-harness) 的机制一层一层拆开重写，直到你能读懂它的全部架构。

> 参考了 [learn-claude-code](../learn-claude-code) 的教学方式：每节课一个最小可运行实现，只加一个机制，配一份讲清楚「dsh 里对应的真实实现」的 README。

## 为什么学 dsh

Agency 来自模型，agent 产品 = 模型 + Harness。`dsh` 是 DeepSeek 开源的 agent harness，它给出了一个比「单体循环 + 一堆硬编码功能」更进一步的工程答案：

```
dsh = everything is a plugin
    模型适配器是插件、工具注册表是插件、会话日志是插件、
    agent 循环本身也是插件 —— 一切都可以在配置里替换。
```

支撑这件事的底座是 [Cordis](https://github.com/cordiverse/cordis)：插件向共享上下文（`ctx`）贡献**服务**、**类型化事件**和**可回卷的副作用**（effect）。没有需要打补丁的特权核心，扩展 = 在别人旁边再挂一个插件，插件卸载时它的注册自动回卷。

学完本仓库，你应该能：

1. 不看文档说出 dsh 的 turn/step 流转、会话日志、工具流水线是怎么跑的；
2. 理解 capability seam（Service Definition / Provider / Consumer 三角色）为什么能让「换一个 provider 就改变整个产品」；
3. 自己写一个 dsh 插件，挂到真实的 dsh 上跑。

## 怎么用这个仓库

1. `pnpm install`（或 `npm install`）；
2. 只有 s01 需要真实模型：`cp .env.example .env`，填入 `ANTHROPIC_API_KEY` / `MODEL_ID`（走 Anthropic 兼容端点，可接官方、DeepSeek、GLM 等）；
3. 从 s01 开始，每节课先读 README，再读 `src/` 里的代码，然后 `pnpm sXX` 跑起来（s02–s19 均为离线脚本化演示，无需联网与 Key）；
4. 每节课的 README 末尾都列出了 dsh 源码中对应的真实实现位置，读完小实现后回去对照源码。

课程代码刻意保持「单文件可读」的规模：不是 dsh 的复刻，而是把 dsh 每个机制的**骨架形状**抽出来。术语（`ctx`、`SessionEvent`、turn/step、seam、waterfall……）与 dsh 保持一致，方便对照。

## 课程地图

按 dsh 的架构分层编排：先造底座（迷你 Cordis），再造主干（循环与会话日志），然后逐层加上治理、能力、委派与自治。

### Part I -- 底座：迷你 Cordis

> dsh 里一切皆插件，所以先造那个「一切都能挂上去」的上下文。

| 课 | 主题 | 格言 | dsh 对应 |
|---|---|---|---|
| [s01](./s01-agent-loop/) | Agent Loop | *一个循环 + 工具 = agent 的最小形状* | `packages/core/agent-loop` |
| [s02](./s02-cordis-context/) | 迷你 Cordis 上下文 | *没有特权核心，一切皆插件* | Cordis：`ctx`、服务注册、effect 回卷 |
| [s03](./s03-events-bus/) | 类型化事件总线 | *waterfall 管拦截，serial 管通知* | `docs/event-producer-consumer.md` |

### Part II -- 主干：循环与会话

> dsh 的循环不存「消息数组」，它存日志，消息从日志派生。

| 课 | 主题 | 格言 | dsh 对应 |
|---|---|---|---|
| [s04](./s04-session-log/) | 会话日志 | *模型可见的，必须能从日志重建* | `packages/core/session` |
| [s05](./s05-system-prompt/) | 系统提示词组装 | *提示词是插件注册的段落，不是写死的字符串* | `packages/core/system-prompt` |
| [s06](./s06-tool-pipeline/) | 工具注册与执行流水线 | *schema 给模型，execute 留给宿主* | `packages/core/tools` |

### Part III -- 治理

| 课 | 主题 | 格言 | dsh 对应 |
|---|---|---|---|
| [s07](./s07-approval-guard/) | 用户审批 | *除了 allowed-once，一律拒绝* | `packages/interaction/user-approval`、`packages/guard` |

### Part IV -- 能力 seam

> 一个能力 = Service Definition + Provider + Consumer。换 Provider，整条能力跟着搬家。

| 课 | 主题 | 格言 | dsh 对应 |
|---|---|---|---|
| [s08](./s08-bash-seam/) | Bash seam | *执行器可换：本地 spawn 或远程沙箱* | `packages/shell`、`docs/subsystems/shell.md` |
| [s09](./s09-fs-seam/) | 文件系统 seam | *fs 和 subprocess 共享一个执行世界* | `packages/fs`、`docs/subsystems/filesystem.md` |
| [s10](./s10-mcp-seam/) | MCP 接入 | *外部工具插进同一个工具池* | `packages/mcp` |

### Part V -- 委派与知识

| 课 | 主题 | 格言 | dsh 对应 |
|---|---|---|---|
| [s11](./s11-subagent/) | Subagent | *子 agent 有自己的会话和深度上限* | `packages/subagent` |
| [s12](./s12-skill-loading/) | Skill 加载 | *目录常驻，正文按需注入* | `packages/skill` |
| [s13](./s13-todo/) | Todo | *计划是日志里的一次全量快照* | `packages/todo` |
| [s14](./s14-compaction/) | 上下文压缩 | *摘要遮掉旧日志，锁保证崩溃可见* | `packages/compaction` |

### Part VI -- 自治

| 课 | 主题 | 格言 | dsh 对应 |
|---|---|---|---|
| [s15](./s15-jobs/) | 后台任务 | *慢操作丢后台，完成后注入通知* | `packages/jobs` |
| [s16](./s16-schedule/) | 定时提醒 | *提醒持久化，回到原会话变成一轮对话* | `packages/schedule` |
| [s17](./s17-integrated-harness/) | 集成 harness | *profile = 按序叠放的 bundle 层* | `packages/boot`、`packages/bundle` |

### Part VII -- 编排

| 课 | 主题 | 格言 | dsh 对应 |
|---|---|---|---|
| [s18](./s18-workflow/) | 工作流 | *编排形状固定时，就把它写成脚本* | `packages/workflow` |
| [s19](./s19-goal-loop/) | 目标循环 | *目标决定循环什么时候真正结束* | `packages/goal` |
| [s20](./s20-beyond/) | 进阶地图 | *读完 20 课之后往哪走* | sandbox / ACP / web / telemetry… |

## 与 dsh 架构的对应关系

```text
dsh 启动 = 一棵由配置合成的插件树（profile 叠 bundle，逐层打 patch）

    ┌─ Part VII  编排：workflow 引擎、同会话 goal 续跑        s18-s19
    ├─ Part VI   自治：jobs 后台、schedule 定时、profile 合成  s15-s17
    ├─ Part V    委派：subagent、skill、todo、compaction       s11-s14
    ├─ Part IV   能力 seam：bash / fs / mcp 三角色可插拔       s08-s10
    ├─ Part III  治理：approval waterfall，fail closed          s07
    ├─ Part II   主干：session 日志 → system-prompt → tools     s04-s06
    └─ Part I    底座：ctx + 插件 + 事件总线（迷你 Cordis）      s01-s03
```

一个 **turn**（轮次）= 认领输入 → 组装提示词 → 若干 **step**（一次模型请求 + 它的工具调用）→ 关闭；每个模型可见的事实都追加进仅追加的会话日志。这条主干在 s04-s06 建成后，后面所有课程都只是「往这棵插件树上再挂一个插件」。

## 前置要求

- Node.js ≥ 18；
- 仅 s01 需要一个 Anthropic 兼容接口的 API Key（官方 / DeepSeek / GLM 等，见 `.env.example`）；
- 建议把 `../deepseek-harness` 克隆在相邻目录，随时对照源码与 `docs/`。

## 许可

MIT
