# s12 Skill 加载

> *"目录常驻，正文按需注入。"*

**状态：已实现** ✅ —— 知识按需加载：skill 的名称与描述常驻提示词，正文用到时才注入会话。

## 本课要解决的问题

把所有领域知识塞进系统提示词会撑爆上下文。dsh 的 skill 能力族：Provider（如 filesystem）发现本地/随包 skill，`ctx.skills` 合并各层目录，面向模型的 `skill` 工具按需展开正文——skill 内容是**可选指令而非会话事件**，注入后成为一条合成 user 消息。

## 实现要点

- [x] `SKILL.md` 约定：frontmatter（name/description）+ markdown 正文，可带 references/scripts；
- [x] filesystem Provider：扫描 `.dsh/skills/` 目录，`list()` 返回候选（名称 + 一句描述）；
- [x] 目录常驻：skill 清单作为一个提示词段落（复用 s05）进入每个请求；
- [x] `skill` 工具：`load(name)` 把正文作为注入上下文送入下一轮（对应 dsh 的 `agent.inject()` 语义）；
- [x] demo：放两个 skill（如 commit 规范、代码审查清单），让 agent 自己决定何时加载哪个。

## dsh 中的真实实现

| 主题 | 位置 |
|---|---|
| skill 能力族 | `../deepseek-harness/docs/subsystems/skills.md` |
| 源码（服务/提供方/工具） | `../deepseek-harness/packages/skill` |
| 注入上下文进模型 | `../deepseek-harness/docs/architecture.md`（`agent.inject()`） |

**关键差异**：dsh 的注册表是宿主层 + 按 scope 分层合并、带失效缓存的；本课只取单层目录 + 按需注入。

上一课：[s11](../s11-subagent/) ｜ 下一课：[s13](../s13-todo/)
