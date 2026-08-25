/**
 * s05-system-prompt —— 系统提示词组装：提示词是插件注册的段落，不是写死的字符串
 *
 * dsh 的 ctx.systemPrompt 负责 prompt-section 与 tool-schema 组装：
 * 环境信息、行为守则、skill 目录……来自不同插件，每个 step 现装配。
 * 插件挂载/卸载立刻反映在提示词里。组装结果快照写入日志（request/header）。
 *
 * 本课不联网：pnpm s05 直接看段落注册、组装与卸载的效果。
 */

type Dispose = () => void

/** 提示词段落注册表：段落按注册顺序拼接 */
class SystemPromptAssembler {
  private sections = new Map<string, () => string>()

  /** 注册一个段落渲染器；返回注销函数（注册即 effect） */
  section(id: string, render: () => string): Dispose {
    this.sections.set(id, render)
    return () => {
      this.sections.delete(id)
    }
  }

  /** 每个 step 前现装配：所有活跃段落按序拼接 */
  assemble(): string {
    return [...this.sections.entries()]
      .map(([id, render]) => `## ${id}\n\n${render()}`)
      .join('\n\n')
  }
}

// ---------------------------------------------------------------------------
// 演示：三个插件各注册一段；卸载一段，下一次组装立刻变化
// ---------------------------------------------------------------------------

const assembler = new SystemPromptAssembler()

// 工具 schema 也走同一条组装路（这里用占位数据代表 ctx.tools.schemas() 的输出）
const toolSchemas = [
  { name: 'bash', description: 'Run a shell command.' },
  { name: 'read_file', description: 'Read a file.' },
]

console.log('\n① 三个插件各自注册一个段落')
const offEnv = assembler.section('environment', () => `cwd: ${process.cwd()}\nplatform: ${process.platform}`)
assembler.section('conduct', () => 'Act, don\'t explain. Never run destructive commands without approval.')
const offClock = assembler.section('clock', () => `current time: ${new Date().toISOString()}`)
console.log('  已注册段落: environment, conduct, clock')

function simulateStep(step: number): void {
  const system = assembler.assemble()
  // dsh 里组装结果会作为 request/header 事件快照进日志，便于回放重建
  const headerSnapshot = { event: 'request/header', systemTokens: Math.ceil(system.length / 4), tools: toolSchemas.map((t) => t.name) }
  console.log(`\n--- step ${step}: 组装请求前缀（request/header 快照）---`)
  console.log(JSON.stringify(headerSnapshot))
  console.log(system)
}

simulateStep(1)

console.log('\n② 卸载 clock 段落插件（回卷它的注册）')
offClock()
simulateStep(2)

console.log('\n③ 再卸载 environment 段落')
offEnv()
simulateStep(3)

console.log('\n要点：循环不拥有提示词。每个 step 读到的前缀是当场组装的，')
console.log('所以任何插件的挂载/卸载都立刻生效——不需要重启、不需要改循环。\n')
