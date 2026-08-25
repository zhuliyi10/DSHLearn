/**
 * s11-subagent —— Subagent：子 agent 有自己的会话和深度上限
 *
 * 委派机制：子任务交给全新会话的子 agent，杂乱观察留在子会话里，
 * 父会话只收到一条结论。Provider 用静态能力描述符公布功能，
 * 缺能力明确报错（fail loud，绝不静默降级）。
 *
 * 本课用脚本化模型驱动父子两个循环。不联网：pnpm s11。
 */

// ---------------------------------------------------------------------------
// 极简会话（s04 形态）与脚本化循环
// ---------------------------------------------------------------------------

interface SessionLog {
  events: { type: string; detail?: string }[]
}

/** 脚本化模型：按预定脚本逐步产出工具调用/最终文本 */
type ScriptedStep =
  | { kind: 'tool'; name: string; args: unknown }
  | { kind: 'text'; text: string }

function runLoop(session: SessionLog, label: string, script: ScriptedStep[], tools: Map<string, (args: unknown) => Promise<string>>): Promise<string> {
  return (async () => {
    let step = 0
    for (const s of script) {
      step += 1
      session.events.push({ type: 'step/start' })
      if (s.kind === 'tool') {
        session.events.push({ type: 'tool/call', detail: s.name })
        const tool = tools.get(s.name)
        if (!tool) throw new Error(`UNKNOWN_TOOL: ${s.name}`)
        const result = await tool(s.args)
        session.events.push({ type: 'tool/result' })
        console.log(`\x1b[2m  [${label} step ${step}] 调用 ${s.name} -> ${result.slice(0, 60)}...\x1b[0m`)
      } else {
        session.events.push({ type: 'assistant/message', detail: s.text })
        console.log(`\x1b[2m  [${label} step ${step}] 最终文本: ${s.text}\x1b[0m`)
        session.events.push({ type: 'turn/end' })
        return s.text
      }
    }
    throw new Error('script exhausted without final text')
  })()
}

// ---------------------------------------------------------------------------
// Subagent seam：Provider 接口 + 按名称注册（可共存多个）
// ---------------------------------------------------------------------------

interface SubagentRequest {
  prompt: string
  parent: string
  depth: number
}

interface SubagentProvider {
  name: string
  /** 静态能力描述符：启动时功能，服务在 run 之前就检查 */
  capabilities: { continuable: boolean }
  start(req: SubagentRequest): Promise<{ text: string; childEvents: number }>
}

class SubagentService {
  private providers = new Map<string, SubagentProvider>()
  readonly maxDepth = 2

  registerProvider(p: SubagentProvider): void {
    this.providers.set(p.name, p)
  }

  async run(providerName: string, req: SubagentRequest): Promise<{ text: string; childEvents: number }> {
    const provider = this.providers.get(providerName)
    if (!provider) throw new Error(`SubagentError('UNKNOWN_PROVIDER'): ${providerName}`)
    if (req.depth >= this.maxDepth) {
      // fail loud：明确拒绝，绝不接受后静默忽略
      throw new Error(`SubagentError('DEPTH_LIMIT'): depth ${req.depth} >= ${this.maxDepth}`)
    }
    return provider.start(req)
  }
}

// ---------------------------------------------------------------------------
// in-process Provider：子 agent = 全新会话 + 自己的脚本化循环
// ---------------------------------------------------------------------------

function inProcessProvider(childScript: ScriptedStep[]): SubagentProvider {
  return {
    name: 'spawn-in-process',
    capabilities: { continuable: false },
    async start(req) {
      const childSession: SessionLog = { events: [{ type: 'session/created', detail: `parent=${req.parent}` }] }
      childSession.events.push({ type: 'user/message', detail: req.prompt })
      const tools = new Map<string, (args: unknown) => Promise<string>>()
      tools.set('bash', async (a) => `(child executed: ${(a as { command: string }).command})`)
      const text = await runLoop(childSession, 'child', childScript, tools)
      return { text, childEvents: childSession.events.length }
    },
  }
}

// ---------------------------------------------------------------------------
// 演示
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const subagents = new SubagentService()
  subagents.registerProvider(
    inProcessProvider([
      { kind: 'tool', name: 'bash', args: { command: 'find . -type d' } },
      { kind: 'tool', name: 'bash', args: { command: 'ls -la' } },
      { kind: 'text', text: '目录含 20 个课程目录，结构规整。' },
    ]),
  )

  const parentSession: SessionLog = { events: [] }
  parentSession.events.push({ type: 'user/message', detail: '探索目录结构并总结' })

  console.log('\n① 父 agent 把探索工作委派给子 agent（spawn-in-process）')
  const taskTool = async (args: unknown): Promise<string> => {
    const { prompt } = args as { prompt: string }
    const result = await subagents.run('spawn-in-process', { prompt, parent: 'parent-session', depth: 0 })
    console.log(`\x1b[2m  [child] 子会话内部产生了 ${result.childEvents} 条事件\x1b[0m`)
    return result.text
  }

  const tools = new Map<string, (args: unknown) => Promise<string>>()
  tools.set('subagent', taskTool)

  const finalText = await runLoop(
    parentSession,
    'parent',
    [
      { kind: 'tool', name: 'subagent', args: { prompt: '探索当前目录结构并总结' } },
      { kind: 'text', text: '子 agent 报告：目录含 20 个课程目录，结构规整。' },
    ],
    tools,
  )

  console.log('\n② 父会话日志：过程全部留在子会话，父日志只有一条 tool/result')
  console.log('  父会话事件数:', parentSession.events.length)
  for (const e of parentSession.events) console.log(`    ${e.type}${e.detail ? ` (${e.detail})` : ''}`)
  console.log('  父的最终文本:', finalText)

  console.log('\n③ 深度上限：fail loud，明确报错')
  try {
    await subagents.run('spawn-in-process', { prompt: 'x', parent: 'p', depth: 2 })
  } catch (err) {
    console.log('  ', (err as Error).message)
  }

  console.log('\n④ 未知 Provider：同样明确报错，不静默降级')
  try {
    await subagents.run('no-such-provider', { prompt: 'x', parent: 'p', depth: 0 })
  } catch (err) {
    console.log('  ', (err as Error).message)
  }

  console.log('\n要点：委派 = 给子任务一个全新会话。父上下文只承担一条结论的重量。\n')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
