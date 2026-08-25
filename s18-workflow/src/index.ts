/**
 * s18-workflow —— 工作流：编排形状固定时，就把它写成脚本
 *
 * dsh 的 workflow seam：模型产出 { script, meta, args }；meta/args 是
 * 普通 JSON 数据，引擎做 schema 校验，绝不靠对脚本文本求值获取它们；
 * 脚本里 agent() 启动的每个子 agent 都归属于必填的 parent。Provider 是
 * 隔离执行（dsh 用 worker + vm），本课用 node:vm 模拟。
 *
 * 不联网：pnpm s18 看引擎校验数据、隔离执行脚本、编排两个子 agent。
 */

import * as vm from 'node:vm'

// ---------------------------------------------------------------------------
// WorkflowSpec：模型产出的三件套
// ---------------------------------------------------------------------------

interface WorkflowSpec {
  script: string // 编排脚本（在隔离环境执行）
  meta: { name: string; description: string } // 普通数据：走 schema 校验
  args: Record<string, unknown> // 普通数据：走 schema 校验
}

/** schema 校验：meta/args 是数据不是代码，不合格直接拒绝 */
function validate(spec: WorkflowSpec): void {
  if (typeof spec.script !== 'string' || spec.script.length === 0) throw new Error('script must be a non-empty string')
  if (typeof spec.meta?.name !== 'string' || spec.meta.name.length === 0) throw new Error('meta.name is required (non-empty string)')
  if (typeof spec.meta?.description !== 'string' || spec.meta.description.length === 0) throw new Error('meta.description is required (non-empty string)')
  if (spec.args === null || typeof spec.args !== 'object') throw new Error('args must be a JSON object')
  JSON.parse(JSON.stringify(spec.args)) // 负载必须无损 JSON
}

// ---------------------------------------------------------------------------
// 子 agent（s11 的极简版）：每个都必须有 parent
// ---------------------------------------------------------------------------

interface AgentRequest {
  parent: string // 必填归属，缺了直接报错
  prompt: string
}

const FAKE_AGENT: Record<string, string> = {
  '调研 dsh 的 session 事件词汇': '结论：核心是 turn/step/user/assistant/tool 五类事件',
  '把事件词汇写成 TypeScript 联合类型': '产出：type SessionEvent = ... (联合类型代码)',
}

function runSubAgent(req: AgentRequest): string {
  if (!req.parent) throw new Error('agent() requires a parent (归属必填)')
  const answer = FAKE_AGENT[req.prompt] ?? '（子 agent 的一般回答）'
  console.log(`      [subagent parent=${req.parent}] "${req.prompt.slice(0, 24)}…" -> ${answer.slice(0, 20)}…`)
  return answer
}

// ---------------------------------------------------------------------------
// 引擎：脚本跑在 vm 隔离上下文里，只暴露 args 与 agent 两个全局
// ---------------------------------------------------------------------------

class WorkflowEngine {
  async run(spec: WorkflowSpec): Promise<string> {
    validate(spec) // 数据先过 schema，绝不对脚本文本求值取 meta/args
    console.log(`  引擎装载 workflow "${spec.meta.name}"，args=${JSON.stringify(spec.args)}`)

    // 包成 async 函数表达式：脚本内可用 await、可 return 结果（顶层不能直接 return）
    const body = `(async () => { ${spec.script} })()`
    const context = vm.createContext({ args: spec.args, agent: runSubAgent })
    const result = await vm.runInContext(body, context, { timeout: 1000 })
    if (typeof result !== 'string') throw new Error('workflow script must return a string')
    return result
  }
}

// ---------------------------------------------------------------------------
// 演示：模型写编排脚本，引擎隔离执行
// ---------------------------------------------------------------------------

const engine = new WorkflowEngine()

console.log('\n① 合法编排：调研 + 实现两个子 agent 串行，结果合成')
const good: WorkflowSpec = {
  meta: { name: 'learn-session-events', description: '调研并实现会话事件词汇' },
  args: { topic: 'session 事件词汇' },
  script: `
    const findings = await agent({ parent: 'workflow', prompt: '调研 dsh 的 session 事件词汇' })
    const code = await agent({ parent: 'workflow', prompt: '把事件词汇写成 TypeScript 联合类型' })
    return '调研: ' + findings + ' | 实现: ' + code
  `,
}
console.log('  ', await engine.run(good))

console.log('\n② meta/args 是数据：schema 不合格在引擎入口就被拒绝')
try {
  await engine.run({ meta: { name: '', description: 'x' } as WorkflowSpec['meta'], args: {}, script: 'return "x"' })
} catch (err) {
  console.log('  预期的拒绝：', (err as Error).message)
}

console.log('\n③ 归属必填：脚本里的 agent() 缺 parent 直接报错')
try {
  await engine.run({
    meta: { name: 'orphan', description: '缺 parent 的反例' },
    args: {},
    script: `return await agent({ prompt: '没有归属的子任务' })`,
  })
} catch (err) {
  console.log('  预期的错误：', (err as Error).message)
}

console.log('\n④ 隔离性：脚本摸不到宿主全局（process 不可见）')
try {
  await engine.run({
    meta: { name: 'escape', description: '逃逸尝试' },
    args: {},
    script: `return String(typeof process)`,
  })
} catch {
  // typeof 不会抛错，这里演示的是返回 "undefined" —— 见输出
}
const probe = await engine.run({
  meta: { name: 'probe', description: '探测宿主全局' },
  args: {},
  script: `return 'typeof process = ' + (typeof process)`,
})
console.log('  ', probe, '（宿主全局不可见）')

console.log('\n要点：探索交给 agent loop，固定形状交给 workflow 脚本。')
console.log('数据走 schema，脚本走隔离执行，子 agent 必须有 parent。\n')
