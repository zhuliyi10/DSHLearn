/**
 * s17-integrated-harness —— 集成 harness：profile = 按序叠放的 bundle 层
 *
 * dsh 运行起来就是一棵由配置在启动时合成的插件树。profile 是具名组合，
 * 列出它叠放的 bundle；bundle 是 Cordis 配置行与其代码的分发格式。
 * 层按顺序应用到空条目列表：profile 的 bundle 顺序 → profile 的
 * cordis.patch.yml → home 级 → --patch 覆盖。patch 按 id 替换整行配置
 * 或插入新行——任何一行都能被上层替换。
 *
 * 不联网：pnpm s17 看两个 profile 从同一批 bundle 合成出不同的 harness。
 */

// ---------------------------------------------------------------------------
// 配置行、bundle、patch：dsh 组合机制的最小形状
// ---------------------------------------------------------------------------

/** Cordis 配置行：一行 = 一个要挂载的插件（entry）及其参数 */
interface ConfigRow {
  id: string // patch 用它定位：按 id 替换整行或插入新行
  entry: string // 插件名（对应 bundle 里的挂载代码）
  options?: Record<string, unknown>
}

/** bundle：一组配置行 + 挂载代码的命名分发格式 */
interface Bundle {
  name: string
  rows: ConfigRow[]
}

/** patch：按 id 替换整行配置或插入新行 */
type Patch = ConfigRow[]

// 本课的「挂载代码注册表」：entry 名 → 它给 ctx 贡献的服务
const MOUNT_CODE: Record<string, (ctx: Record<string, string>) => void> = {
  'llm.anthropic': (ctx) => (ctx.llm = 'anthropic-adapter'),
  'session.memory': (ctx) => (ctx.session = 'append-only-log'),
  'tools.bash': (ctx) => (ctx.tools = 'bash,read,write'),
  'tools.fs': (ctx) => (ctx.tools = `${ctx.tools ?? ''}+fs`.replace(/^\+/, '')),
  'approval.terminal': (ctx) => (ctx.approval = 'terminal-asker'),
  'approval.auto': (ctx) => (ctx.approval = 'auto-allow (test only)'),
  'jobs.runtime': (ctx) => (ctx.jobs = 'bash/subagent jobs'),
  'schedule.reminders': (ctx) => (ctx.schedule = 'durable reminders'),
}

// 两个 base bundle：把前 16 课的插件归拢进来
const BUNDLES: Record<string, Bundle> = {
  'dsh-core': {
    name: 'dsh-core',
    rows: [
      { id: 'llm', entry: 'llm.anthropic' },
      { id: 'session', entry: 'session.memory' },
      { id: 'tools', entry: 'tools.bash' },
    ],
  },
  'dsh-governance': {
    name: 'dsh-governance',
    rows: [{ id: 'approval', entry: 'approval.terminal' }],
  },
  'dsh-autonomy': {
    name: 'dsh-autonomy',
    rows: [
      { id: 'jobs', entry: 'jobs.runtime' },
      { id: 'schedule', entry: 'schedule.reminders' },
    ],
  },
}

// ---------------------------------------------------------------------------
// 合成：层按序应用，同 id 后层覆盖前层（任何一行都能被上层替换）
// ---------------------------------------------------------------------------

function compose(layers: { label: string; rows: ConfigRow[] }[]): ConfigRow[] {
  const table = new Map<string, ConfigRow>()
  for (const layer of layers) {
    for (const row of layer.rows) {
      const replaced = table.has(row.id)
      table.set(row.id, row)
      console.log(`    [${layer.label}] ${replaced ? '覆盖' : '插入'} id=${row.id} -> ${row.entry}`)
    }
  }
  return [...table.values()]
}

/** 从最终条目列表合成 ctx：按序执行挂载代码 */
function materialize(rows: ConfigRow[]): Record<string, string> {
  const ctx: Record<string, string> = {}
  for (const row of rows) {
    const mount = MOUNT_CODE[row.entry]
    if (!mount) throw new Error(`unknown entry: ${row.entry}`) // fail loud，不静默跳过
    mount(ctx)
  }
  return ctx
}

/** profile = bundle 顺序 + 自带的 patch 层 */
interface Profile {
  name: string
  bundles: string[]
  patch: Patch
}

function runProfile(profile: Profile, homePatch: Patch, cliPatch: Patch): void {
  console.log(`\n=== profile "${profile.name}" ===`)
  const layers = [
    ...profile.bundles.map((name) => ({ label: `bundle:${name}`, rows: BUNDLES[name].rows })),
    { label: 'profile patch', rows: profile.patch },
    { label: 'home patch', rows: homePatch },
    { label: '--patch', rows: cliPatch },
  ]
  const rows = compose(layers)
  const ctx = materialize(rows)
  console.log('  合成出的 ctx 服务:')
  for (const [k, v] of Object.entries(ctx)) console.log(`    ctx.${k} = ${v}`)
}

// ---------------------------------------------------------------------------
// 演示：同一批 bundle，不同 profile/patch 合成出不同的 harness
// ---------------------------------------------------------------------------

console.log('\n① 默认 profile：core + governance，终端审批')
runProfile(
  { name: 'default', bundles: ['dsh-core', 'dsh-governance'], patch: [] },
  [],
  [],
)

console.log('\n② 测试 profile：叠 autonomy，并用 patch 把审批换成自动放行')
runProfile(
  {
    name: 'ci-test',
    bundles: ['dsh-core', 'dsh-governance', 'dsh-autonomy'],
    patch: [{ id: 'approval', entry: 'approval.auto' }], // 按 id 替换整行
  },
  [],
  [],
)

console.log('\n③ 命令行 --patch 是最后一层：再插入一行 fs 工具')
runProfile(
  { name: 'default', bundles: ['dsh-core', 'dsh-governance'], patch: [] },
  [],
  [{ id: 'tools-fs', entry: 'tools.fs' }], // 新 id = 插入
)

console.log('\n要点：没有特权核心。profile 叠 bundle，patch 逐层覆盖，')
console.log('任何一行配置都能被上层替换——这就是 everything is a plugin 的落地。\n')
