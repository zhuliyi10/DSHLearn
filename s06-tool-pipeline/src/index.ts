/**
 * s06-tool-pipeline —— 工具注册与执行流水线：schema 给模型，execute 留给宿主
 *
 * dsh 的 ToolDefinition 严格区分「模型可见」与「宿主私有」：
 * schemas() 只导出 name/description/parameters；execute、超时、并发安全绝不进请求。
 * 执行走 tools/pre-execute → tools/execute → tools/post-execute 的 waterfall，可被插件包裹。
 *
 * 本课不联网：pnpm s06 直接看注册表、白名单投影与被拦截的执行。
 */

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue }
type Next<P> = (payload?: P) => Promise<P>
type WaterfallListener<P> = (payload: P, next: Next<P>) => Promise<P>

/** 极简 waterfall（s03 的复用形态） */
class WaterfallBus {
  private falls = new Map<string, WaterfallListener<any>[]>()

  intercept<P>(event: string, listener: WaterfallListener<P>): () => void {
    const list = this.falls.get(event) ?? []
    list.push(listener)
    this.falls.set(event, list)
    return () => {
      const i = list.indexOf(listener)
      if (i >= 0) list.splice(i, 1)
    }
  }

  async waterfall<P>(event: string, payload: P, fallback: (p: P) => Promise<P>): Promise<P> {
    const listeners = this.falls.get(event) ?? []
    const run = (i: number, p: P): Promise<P> =>
      i >= listeners.length ? fallback(p) : listeners[i](p, (np = p) => run(i + 1, np))
    return run(0, payload)
  }
}

// ---------------------------------------------------------------------------
// ToolDefinition 与注册表
// ---------------------------------------------------------------------------

interface ToolOutput {
  /** 把规范 JSON 值投影成面向模型的内容 */
  render(value: JsonValue): string
}

interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown> // JSON Schema
  output: ToolOutput
  execute(args: unknown): Promise<JsonValue> // 宿主私有：绝不进模型请求
}

class ToolDeniedError extends Error {}

interface ExecPayload {
  name: string
  args: unknown
  content?: string
  denied?: string
}

class ToolRegistry {
  private defs = new Map<string, ToolDefinition>()

  constructor(private bus: WaterfallBus) {}

  register(def: ToolDefinition): () => void {
    this.defs.set(def.name, def)
    return () => {
      this.defs.delete(def.name)
    }
  }

  /** 显式允许列表投影：只有这三个字段能进模型请求 */
  schemas(): { name: string; description: string; parameters: unknown }[] {
    return [...this.defs.values()].map((d) => ({
      name: d.name,
      description: d.description,
      parameters: d.parameters,
    }))
  }

  /** 受保护的执行流水线 */
  async dispatch(name: string, rawArgs: string): Promise<string> {
    const def = this.defs.get(name)
    if (!def) throw new Error(`UNKNOWN_TOOL: ${name}`) // fail loud
    let args: unknown
    try {
      args = JSON.parse(rawArgs)
    } catch {
      throw new Error(`BAD_ARGS: ${name}`)
    }

    // ① pre-execute：守卫们在这里拦截
    const pre = await this.bus.waterfall<ExecPayload>('tools/pre-execute', { name, args }, async (p) => p)
    if (pre.denied) return `[denied] ${pre.denied}`

    // ② execute：最内层是真正的执行 + 规范输出投影；外层插件可包裹
    const exec = await this.bus.waterfall<ExecPayload>(
      'tools/execute',
      { name, args },
      async (p) => {
        const value = await def.execute(p.args)
        return { ...p, content: def.output.render(value) }
      },
    )

    // ③ post-execute：结果出闸前的最后一道包裹
    const post = await this.bus.waterfall<ExecPayload>('tools/post-execute', exec, async (p) => p)
    return post.content ?? ''
  }
}

// ---------------------------------------------------------------------------
// 演示
// ---------------------------------------------------------------------------

const bus = new WaterfallBus()
const tools = new ToolRegistry(bus)

tools.register({
  name: 'bash',
  description: 'Run a shell command.',
  parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
  output: { render: (v) => `$ ${(v as { cmd: string }).cmd}\n${(v as { out: string }).out}` },
  execute: async (args) => ({ cmd: (args as { command: string }).command, out: '(simulated output)' }),
})
tools.register({
  name: 'read_file',
  description: 'Read a file.',
  parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
  output: { render: (v) => `file: ${(v as { path: string }).path} => (simulated content)` },
  execute: async (args) => ({ path: (args as { path: string }).path }),
})

// 审计插件：包裹 tools/execute 计时——不改循环、不改工具
bus.intercept<ExecPayload>('tools/execute', async (p, next) => {
  const t0 = Date.now()
  const out = await next(p)
  console.log(`\x1b[2m  [audit] ${p.name} 执行耗时 ${Date.now() - t0}ms\x1b[0m`)
  return out
})

// 守卫插件：pre-execute 拦截危险命令
bus.intercept<ExecPayload>('tools/pre-execute', async (p, next) => {
  const cmd = (p.args as { command?: string }).command ?? ''
  if (p.name === 'bash' && cmd.includes('rm -rf')) {
    return { ...p, denied: 'dangerous command blocked by guard' } // 短路
  }
  return next(p)
})

async function main(): Promise<void> {
  console.log('\n① schemas()：发给模型的只有白名单字段')
  console.log(JSON.stringify(tools.schemas(), null, 2))

  console.log('\n② 正常分发：bash echo hello')
  console.log('  结果:', await tools.dispatch('bash', '{"command":"echo hello"}'))

  console.log('\n③ pre-execute 拦截：bash rm -rf /tmp/x')
  console.log('  结果:', await tools.dispatch('bash', '{"command":"rm -rf /tmp/x"}'))

  console.log('\n④ fail loud：未知工具与坏参数都是类型化错误')
  for (const [name, args] of [
    ['no_such_tool', '{}'],
    ['bash', 'not-json'],
  ] as const) {
    try {
      await tools.dispatch(name, args)
    } catch (err) {
      console.log('  ', (err as Error).message)
    }
  }

  console.log('\n要点：模型只见 schema，宿主独占 execute。')
  console.log('审计、守卫、超时都是挂在流水线上的插件，谁也不必改循环。\n')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
