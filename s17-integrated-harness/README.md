# s17 集成 harness

> *"profile = 按序叠放的 bundle 层。"*

**状态：已实现** ✅ —— 把前 16 课的机制装回一个 harness，并复刻 dsh 的组合方式：profile 叠 bundle，逐层打 patch，一切可替换。

## 本课要解决的问题

dsh 运行起来就是一棵**由配置在启动时合成的插件树**。profile 是存在 harness home 里的具名组合，列出它叠放的 bundle；bundle 是 Cordis 配置行与其代码的分发格式。层按顺序应用到空条目列表：profile 的 bundle 顺序 → profile 的 `cordis.patch.yml` → home 级 → `--patch` 覆盖。patch 按 id 替换整行配置或插入新行——**任何一行都能被上层的你替换**。

## 实现要点

- [x] 配置行 + 层合成：`layers: ConfigRow[][]` 按序 apply，同 id 后层覆盖前层；
- [x] bundle：一组配置行 + 挂载代码的命名包（把 s02–s16 的插件各归入 `dsh-base` 风格的 base bundle）；
- [x] profile：`web` / `headless` 两个模板，headless 版无服务器一次性跑完；
- [x] patch：`patch.yml` 按 id 替换某行（例如把模型适配器换成另一家）；
- [x] `--dump-config`：打印最终合成的插件树；
- [x] demo：同一份 base，两个 profile 分别叠不同 patch，跑出两种行为。

## dsh 中的真实实现

| 主题 | 位置 |
|---|---|
| Profiles and bundles | `../deepseek-harness/docs/architecture.md` |
| 启动合成 | `../deepseek-harness/packages/boot` |
| bundle 定义 | `../deepseek-harness/packages/bundle` |
| 配置目录 | `../deepseek-harness/docs/config-catalog.md` |

上一课：[s16](../s16-schedule/) ｜ 下一课：[s18](../s18-workflow/)
