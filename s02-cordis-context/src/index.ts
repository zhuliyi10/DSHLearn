/**
 * s02-cordis-context —— 迷你 Cordis 上下文：没有特权核心，一切皆插件
 *
 * dsh 的地基：插件向共享上下文 ctx 贡献服务，注册本身是"副作用"，
 * 插件卸载时它的注册按逆序回卷（unwind）。同键重复注册 = 替换，旧注册先回卷。
 *
 * 本课不联网、不需要 API Key：pnpm s02 直接看生命周期演示。
 */

type Dispose = () => void

const log = (msg: string): void => console.log(`\x1b[2m  ${msg}\x1b[0m`)

/** 极简上下文：服务按键挂载，注册即可回卷 */
class Context {
  private services = new Map<string, unknown>()
  private owners = new Map<string, string>() // key -> 拥有它的插件
  private pluginRegs = new Map<string, { key: string; dispose: Dispose }[]>()

  constructor(readonly name: string) {}

  /** 挂载插件；返回卸载函数——卸载是一种 capability，只有持有者能拆 */
  plugin(pluginName: string, apply: (ctx: Context) => void): Dispose {
    if (this.pluginRegs.has(pluginName)) throw new Error(`插件 "${pluginName}" 已挂载`)
    this.pluginRegs.set(pluginName, [])
    apply(this)
    log(`[${this.name}] 插件 "${pluginName}" 挂载完成`)
    return () => this.unload(pluginName)
  }

  /** 以插件身份注册服务；同键即替换，旧注册先回卷 */
  register<T>(key: string, value: T, pluginName: string, onUnwind: Dispose = () => {}): void {
    const regs = this.pluginRegs.get(pluginName)
    if (!regs) throw new Error(`注册必须发生在插件 "${pluginName}" 的 apply 内`)
    const prev = this.owners.get(key)
    if (prev) this.unwindKey(key, prev)
    this.services.set(key, value)
    this.owners.set(key, pluginName)
    regs.push({ key, dispose: onUnwind })
    log(`[${this.name}] "${pluginName}" 注册 ${key}${prev ? `（替换 "${prev}"，旧注册已回卷）` : ''}`)
  }

  /** 消费服务；没有就报错——fail loud，不静默降级 */
  use<T>(key: string): T {
    if (!this.services.has(key)) throw new Error(`上下文 "${this.name}" 上没有服务 "${key}"`)
    return this.services.get(key) as T
  }

  has(key: string): boolean {
    return this.services.has(key)
  }

  /** 卸载插件：它的所有注册按注册逆序回卷 */
  unload(pluginName: string): void {
    const regs = this.pluginRegs.get(pluginName)
    if (!regs) return
    for (const reg of regs.slice().reverse()) {
      if (this.owners.get(reg.key) === pluginName) {
        this.services.delete(reg.key)
        this.owners.delete(reg.key)
      }
      reg.dispose()
      log(`[${this.name}] 回卷 "${pluginName}" 对 ${reg.key} 的注册`)
    }
    this.pluginRegs.delete(pluginName)
    log(`[${this.name}] 插件 "${pluginName}" 已卸载`)
  }

  private unwindKey(key: string, owner: string): void {
    const regs = this.pluginRegs.get(owner) ?? []
    const idx = regs.findLastIndex((r) => r.key === key)
    if (idx >= 0) {
      const [reg] = regs.splice(idx, 1)
      reg.dispose()
    }
    this.services.delete(key)
    this.owners.delete(key)
  }
}

// ---------------------------------------------------------------------------
// 演示：模型适配器、工具注册表都是插件；替换与卸载都自动回卷
// ---------------------------------------------------------------------------

interface LlmAdapter {
  name: string
}

const ctx = new Context('root')

console.log('\n① 挂载两个插件：模型适配器 + 工具注册表')
ctx.plugin('dsh-llm-deepseek', (c) => {
  c.register<LlmAdapter>('ctx.llm', { name: 'deepseek-chat' }, 'dsh-llm-deepseek', () =>
    log('deepseek 适配器：断开连接'),
  )
})
ctx.plugin('dsh-tools-base', (c) => {
  c.register<string[]>('ctx.tools', ['bash', 'read_file'], 'dsh-tools-base', () =>
    log('工具注册表：清空'),
  )
})

console.log('\n② 消费服务：循环只认识 ctx，不认识具体插件')
console.log('  ctx.llm =', ctx.use<LlmAdapter>('ctx.llm').name)
console.log('  ctx.tools =', ctx.use<string[]>('ctx.tools'))

console.log('\n③ 替换：新适配器插件注册同一个键，旧注册自动回卷')
ctx.plugin('dsh-llm-mock', (c) => {
  c.register<LlmAdapter>('ctx.llm', { name: 'scripted-mock' }, 'dsh-llm-mock', () =>
    log('mock 适配器：dispose'),
  )
})
console.log('  ctx.llm =', ctx.use<LlmAdapter>('ctx.llm').name)

console.log('\n④ 卸载工具插件：注册逆序回卷，服务消失')
ctx.unload('dsh-tools-base')
try {
  ctx.use('ctx.tools')
} catch (err) {
  console.log('  预期的错误：', (err as Error).message)
}

console.log('\n⑤ 未挂载插件的消费——dsh 的组合永远显式声明依赖')
console.log('  ctx 上还剩 ctx.llm =', ctx.has('ctx.llm'))

console.log('\n要点：没有需要打补丁的特权核心。')
console.log('扩展 dsh = 在别人旁边再挂一个插件；卸载 = 注册自动回卷。\n')

export { Context }
