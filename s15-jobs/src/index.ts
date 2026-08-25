/**
 * s15-jobs —— 后台任务：慢操作丢后台，完成后注入通知
 *
 * dsh 的 ctx.jobs 是长时任务运行时：kind 可扩展（bash、subagent），
 * id 形如 bash-1；job_* 工具负责收集输出与停止任务；任务完成后的结果
 * 以注入上下文的形式进入 agent 的下一轮。访问控制靠拥有者授权，不靠 id 保密。
 *
 * 不联网：pnpm s15 看一个脚本化 agent 启动后台 job、干别的、被通知叫醒。
 */

// ---------------------------------------------------------------------------
// Job 运行时：注册表 + 状态机 running → done / failed / stopped
// ---------------------------------------------------------------------------

type JobStatus = 'running' | 'done' | 'failed' | 'stopped'

interface Job {
  id: string // kind-N 形式，如 bash-1
  kind: string
  owner: string // 拥有者授权，不靠 id 保密
  status: JobStatus
  output: string[]
  result?: string
}

class JobRegistry {
  private jobs = new Map<string, Job>()
  private counters = new Map<string, number>()

  /** 启动一个 job：run 是一个异步任务，结束时自动落状态 */
  start(kind: string, owner: string, run: (emit: (line: string) => void) => Promise<string>): string {
    const n = (this.counters.get(kind) ?? 0) + 1
    this.counters.set(kind, n)
    const job: Job = { id: `${kind}-${n}`, kind, owner, status: 'running', output: [] }
    this.jobs.set(job.id, job)
    run((line) => job.output.push(line))
      .then((result) => {
        if (job.status === 'running') {
          job.status = 'done'
          job.result = result
        }
      })
      .catch((err) => {
        if (job.status === 'running') {
          job.status = 'failed'
          job.result = String(err)
        }
      })
    return job.id
  }

  /** 收集输出：只有拥有者能看（授权检查，而非猜 id） */
  collect(id: string, by: string): { status: JobStatus; output: string[]; result?: string } {
    const job = this.jobs.get(id)
    if (!job) throw new Error(`no such job: ${id}`)
    if (job.owner !== by) throw new Error(`not authorized: ${by} cannot access ${id}`)
    return { status: job.status, output: job.output, result: job.result }
  }

  stop(id: string, by: string): void {
    const job = this.jobs.get(id)
    if (!job) throw new Error(`no such job: ${id}`)
    if (job.owner !== by) throw new Error(`not authorized: ${by} cannot stop ${id}`)
    if (job.status === 'running') job.status = 'stopped'
  }
}

// ---------------------------------------------------------------------------
// 注入收件箱：job 完成 → 结果变成 agent 下一轮看到的合成 user 消息
// ---------------------------------------------------------------------------

type InboxMessage = { role: 'user'; content: string }

class AgentInbox {
  messages: InboxMessage[] = []
  inject(content: string): void {
    this.messages.push({ role: 'user', content })
  }
  /** 循环开始下一步前先清空收件箱，注入内容进入本轮上下文 */
  drain(): InboxMessage[] {
    return this.messages.splice(0)
  }
}

// ---------------------------------------------------------------------------
// 演示：脚本化 agent —— 启动后台测试 → 继续干别的 → 被完成通知叫醒
// ---------------------------------------------------------------------------

const jobs = new JobRegistry()
const inbox = new AgentInbox()
const OWNER = 'agent'

console.log('\n① agent 把慢命令丢进后台（kind=bash），立刻拿到 id 继续工作')
const jobId = jobs.start('bash', OWNER, async (emit) => {
  // 模拟一条要跑一会儿的测试命令
  await sleep(30)
  emit('running suite: 12 tests')
  await sleep(30)
  emit('12 passed, 0 failed')
  return 'exit 0'
})
console.log(`  bash_background -> ${jobId}（agent 不阻塞，继续主流程）`)

console.log('\n② 中途 job_collect：只看到已有输出，状态还是 running')
await sleep(20)
const mid = jobs.collect(jobId, OWNER)
console.log(`  status=${mid.status}, output=${JSON.stringify(mid.output)}`)

console.log('\n③ job 完成 → 完成通知注入收件箱 → 变成下一轮的合成 user 消息')
await sleep(60)
const final = jobs.collect(jobId, OWNER)
if (final.status === 'done') {
  inbox.inject(`[job ${jobId} finished] ${final.result}; last line: ${final.output.at(-1)}`)
}
console.log('  agent 下一步开始时读到:')
for (const m of inbox.drain()) console.log(`    [${m.role}] ${m.content}`)

console.log('\n④ 授权模型：访问控制靠拥有者，不靠 id 保密')
try {
  jobs.collect(jobId, 'intruder')
} catch (err) {
  console.log('  预期的拒绝：', (err as Error).message)
}

console.log('\n⑤ job_stop：running 的 job 可以被拥有者停下')
const j2 = jobs.start('bash', OWNER, async () => {
  await sleep(1000) // 永远跑不完的那种
  return 'never'
})
jobs.stop(j2, OWNER)
console.log(`  ${j2} -> status=${jobs.collect(j2, OWNER).status}`)

console.log('\n要点：同步等待浪费循环；后台 job + 完成注入 = agent 不干等。')
console.log('dsh 里 kind 可扩展（bash / subagent），工具族 job_* 走同一条授权。\n')

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
