/**
 * s07-approval-guard —— 用户审批：除了 allowed-once，一律拒绝
 *
 * dsh 的 ctx.approval 只回答一个问题：这个具体操作能不能继续？
 * 请求经 approval/request waterfall 找应答者；结果为 allowed-once 才放行，
 * 其余一切（denied、无人应答、超时）都拒绝——fail closed。
 * 每次询问/决定各写一条审计事件。
 *
 * 本课不联网、非交互：应答者用脚本化策略模拟"人"。pnpm s07 看闸门行为。
 */

type ApprovalResult = 'allowed-once' | 'denied'

interface Operation {
  tool: string
  summary: string // 给人看的操作描述
}

interface ApprovalRecord {
  requestId: number
  op: Operation
  result: ApprovalResult | 'no-responder'
}

type Responder = (op: Operation) => ApprovalResult | Promise<ApprovalResult>

class ApprovalService {
  private responders: Responder[] = []
  private audit: ApprovalRecord[] = []
  private nextId = 1

  /** 注册应答者（UI、终端、ACP 机器桥……）；返回注销函数 */
  addResponder(r: Responder): () => void {
    this.responders.push(r)
    return () => {
      const i = this.responders.indexOf(r)
      if (i >= 0) this.responders.splice(i, 1)
    }
  }

  /** 请求裁决：第一个应答者闭合结果；无应答者 = 拒绝（fail closed） */
  async request(op: Operation): Promise<ApprovalResult> {
    const requestId = this.nextId++
    console.log(`\x1b[33m  [approval #${requestId}] 询问: ${op.tool} — ${op.summary}\x1b[0m`)
    this.audit.push({ requestId, op, result: 'no-responder' }) // asked

    let result: ApprovalResult = 'denied'
    if (this.responders.length > 0) {
      result = await this.responders[0](op) // waterfall：第一个应答者闭合
    }
    this.audit[this.audit.length - 1].result = result // decided
    console.log(`\x1b[33m  [approval #${requestId}] 决定: ${result}\x1b[0m`)
    return result
  }

  get auditLog(): readonly ApprovalRecord[] {
    return this.audit
  }
}

// ---------------------------------------------------------------------------
// 接入 s06 形态的工具流水线：危险操作强制过闸
// ---------------------------------------------------------------------------

const approval = new ApprovalService()

/** pre-execute 守卫：bash 的危险命令必须先问人 */
async function preExecuteGuard(tool: string, args: unknown): Promise<string | undefined> {
  if (tool !== 'bash') return undefined
  const cmd = (args as { command?: string }).command ?? ''
  const dangerous = ['rm ', 'sudo', 'shutdown', '> /dev/']
  if (!dangerous.some((d) => cmd.includes(d))) return undefined // 安全命令直接放行
  const result = await approval.request({ tool, summary: cmd })
  return result === 'allowed-once' ? undefined : `denied by approval (${result})`
}

async function dispatch(tool: string, args: unknown): Promise<string> {
  const denied = await preExecuteGuard(tool, args)
  if (denied) return `[blocked] ${denied}`
  return `[executed] ${tool} ${JSON.stringify(args)}`
}

// ---------------------------------------------------------------------------
// 演示
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('\n① 无应答者 = 拒绝（fail closed）')
  console.log('  ', await dispatch('bash', { command: 'rm junk.txt' }))

  console.log('\n② 注册"终端里的人"：脚本化策略（echo 放行，rm 拒绝）')
  approval.addResponder((op) => (op.summary.startsWith('rm') ? 'denied' : 'allowed-once'))

  console.log('\n③ 安全命令不进闸门；危险命令逐个过闸')
  console.log('  ', await dispatch('bash', { command: 'echo hello' }))
  console.log('  ', await dispatch('bash', { command: 'rm junk.txt' }))
  console.log('  ', await dispatch('bash', { command: 'sudo apt update' }))

  console.log('\n④ 审计事件对：approval/asked 与 approval/decided 都留痕')
  for (const r of approval.auditLog) {
    console.log(`  #${r.requestId} ${r.op.summary} -> ${r.result}`)
  }

  console.log('\n要点：闸门的答案是闭合的——只有 allowed-once 放行。')
  console.log('调用方拿到结果就用，超时/无人应答/异常都按拒绝处理。\n')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
