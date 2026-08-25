/**
 * s03-events-bus —— 类型化事件总线：waterfall 管拦截，serial 管通知
 *
 * dsh 的扩展点分两种形状：
 *   - waterfall（瀑布式）：监听器必须调用 next() 才向下传递，可改写负载或短路——用于拦截
 *   - serial（串行）：只通知、不拦截，没有 next()——用于观察
 *
 * 本课不联网：pnpm s03 直接看两种事件的调度语义。
 */

type Next<P> = (payload?: P) => Promise<P>
type SerialListener<P> = (payload: P) => void | Promise<void>
type WaterfallListener<P> = (payload: P, next: Next<P>) => Promise<P>

class EventBus {
  // 内部存储用 any：类型安全由 on/intercept/emit/waterfall 的泛型签名保证
  private serials = new Map<string, SerialListener<any>[]>()
  private waterfalls = new Map<string, WaterfallListener<any>[]>()

  /** 订阅 serial 事件；返回注销函数——注册即 effect，可回卷 */
  on<P>(event: string, listener: SerialListener<P>): () => void {
    const list = this.serials.get(event) ?? []
    list.push(listener)
    this.serials.set(event, list)
    return () => {
      const i = list.indexOf(listener)
      if (i >= 0) list.splice(i, 1)
    }
  }

  /** 订阅 waterfall 事件；先注册的在外层 */
  intercept<P>(event: string, listener: WaterfallListener<P>): () => void {
    const list = this.waterfalls.get(event) ?? []
    list.push(listener)
    this.waterfalls.set(event, list)
    return () => {
      const i = list.indexOf(listener)
      if (i >= 0) list.splice(i, 1)
    }
  }

  /** serial：按注册顺序逐个通知，不关心返回值 */
  async emit<P>(event: string, payload: P): Promise<void> {
    for (const listener of this.serials.get(event) ?? []) {
      await listener(payload)
    }
  }

  /** waterfall：链式调用；fallback 是最内层的默认处理 */
  async waterfall<P>(event: string, payload: P, fallback?: (p: P) => Promise<P>): Promise<P> {
    const listeners = this.waterfalls.get(event) ?? []
    const run = (i: number, p: P): Promise<P> => {
      if (i >= listeners.length) return fallback ? fallback(p) : Promise.resolve(p)
      return listeners[i](p, (np = p) => run(i + 1, np))
    }
    return run(0, payload)
  }
}

// ---------------------------------------------------------------------------
// 演示：模拟 dsh 一个 step 的三个扩展点
// ---------------------------------------------------------------------------

interface PreStepPayload {
  messages: string[]
  rejected: boolean
  reason?: string
}

interface ToolExecPayload {
  name: string
  args: string
  result?: string
}

const bus = new EventBus()

// ① serial：session/event 式的审计观察——只记录，绝不拦截
const offAudit = bus.on('session/event', (e: { type: string }) => {
  console.log(`\x1b[2m  [audit] session/event: ${e.type}\x1b[0m`)
})

// ② waterfall 短路：agent/pre-step 拒绝空输入——不调 next() 即拦截
bus.intercept<PreStepPayload>('agent/pre-step', async (p, next) => {
  if (p.messages.every((m) => m.trim() === '')) {
    return { ...p, rejected: true, reason: 'empty input' } // 短路，不调 next
  }
  return next(p)
})

// ③ waterfall 包裹：tools/execute 计时——调用 next() 拿到内层结果再加工
bus.intercept<ToolExecPayload>('tools/execute', async (p, next) => {
  const t0 = Date.now()
  const out = await next(p)
  console.log(`  [计时器] ${p.name} 执行耗时 ${Date.now() - t0}ms`)
  return out
})

async function main(): Promise<void> {
  console.log('\n① 正常输入走完整条瀑布')
  const ok = await bus.waterfall<PreStepPayload>('agent/pre-step', {
    messages: ['统计目录里的文件'],
    rejected: false,
  })
  console.log('  pre-step 结果:', { rejected: ok.rejected })

  console.log('\n② 空输入被拦截（监听器没调 next）')
  const bad = await bus.waterfall<PreStepPayload>('agent/pre-step', { messages: ['  '], rejected: false })
  console.log('  pre-step 结果:', { rejected: bad.rejected, reason: bad.reason })

  console.log('\n③ tools/execute：外层计时，最内层是真正的执行（fallback）')
  const exec = await bus.waterfall<ToolExecPayload>(
    'tools/execute',
    { name: 'bash', args: 'echo hello' },
    async (p) => ({ ...p, result: `executed: ${p.args}` }),
  )
  console.log('  执行结果:', exec.result)

  console.log('\n④ serial 审计事件：只通知，无法被拦截')
  await bus.emit('session/event', { type: 'user/message' })
  await bus.emit('session/event', { type: 'tool/result' })

  offAudit()
  console.log('\n⑤ 注销后不再有审计输出')
  await bus.emit('session/event', { type: 'step/end' })

  console.log('\n要点：要拦截用 waterfall（必须 next），要观察用 serial。')
  console.log('dsh 里 agent/pre-step、agent/request、llm/stream、tools/* 是 waterfall；')
  console.log('agent/turn-stopping、session/event 是 serial。\n')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
