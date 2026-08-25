/**
 * s14-compaction —— 上下文压缩：摘要遮掉旧日志，锁保证崩溃可见
 *
 * dsh 的 compaction 不删日志：先记 compaction/start 拿锁，生成摘要写
 * compaction/summary，再用一条带 surfaceOp: replace 的合成 user 消息替换
 * 被遮蔽区段；最后 compaction/end 放锁。中途崩溃会留下未匹配的 start，
 * 成为可检测的遗留锁。
 *
 * 不联网：pnpm s14 看一次完整压缩 + 遗留锁检测。
 */

// ---------------------------------------------------------------------------
// 事件词汇：在 s04 的核心子集上，用声明合并的思路扩展 compaction 三事件
// ---------------------------------------------------------------------------

type SessionEvent =
  | { seq: number; type: 'user/message'; content: string }
  | { seq: number; type: 'assistant/message'; content: string }
  | { seq: number; type: 'tool/call'; callId: string; name: string; arguments: string }
  | { seq: number; type: 'tool/result'; callId: string; content: string }
  // ---- compaction 扩展词汇 ----
  | { seq: number; type: 'compaction/start'; compactionId: string; upToSeq: number }
  | { seq: number; type: 'compaction/summary'; compactionId: string; summary: string }
  | { seq: number; type: 'compaction/end'; compactionId: string }

/** 去掉 seq 的事件（对联合类型逐个分发 Omit） */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
type NewEvent = DistributiveOmit<SessionEvent, 'seq'>

class Session {
  private log: SessionEvent[] = []

  append(event: NewEvent): SessionEvent {
    const full = { seq: this.log.length + 1, ...event } as SessionEvent
    this.log.push(full)
    return full
  }

  get events(): readonly SessionEvent[] {
    return this.log
  }
}

// ---------------------------------------------------------------------------
// 派生规则：compaction/summary 之后的合成替换消息遮蔽旧区段
// ---------------------------------------------------------------------------

type ModelMessage = { role: 'user' | 'assistant'; content: string }

/**
 * 投影：正常事件照常进入历史；一旦日志里出现已成对的 compaction/start+end，
 * 被遮蔽区段（seq <= upToSeq）的消息不再派生，取而代之的是摘要那条合成消息。
 */
function deriveMessages(events: readonly SessionEvent[]): ModelMessage[] {
  // 找到最近一次完成的压缩，确定遮蔽边界
  let maskUpTo = 0
  let summary: string | null = null
  const started = new Set<string>()
  for (const e of events) {
    if (e.type === 'compaction/start') started.add(e.compactionId)
    if (e.type === 'compaction/summary' && started.has(e.compactionId)) summary = e.summary
    if (e.type === 'compaction/end' && started.has(e.compactionId)) {
      // end 事件出现才算完成；对应的 start 记录了遮蔽边界
      const start = events.find((s) => s.type === 'compaction/start' && s.compactionId === e.compactionId)
      if (start && start.type === 'compaction/start') {
        maskUpTo = Math.max(maskUpTo, start.upToSeq)
      }
    }
  }

  const out: ModelMessage[] = []
  if (summary !== null && maskUpTo > 0) {
    // 唯一的 surface 变更：一条带 replace 语义的合成 user 消息顶替旧区段
    out.push({ role: 'user', content: `[previous context compacted]\n${summary}` })
  }
  for (const e of events) {
    if (e.seq <= maskUpTo) continue // 旧区段被遮蔽
    if (e.type === 'user/message') out.push({ role: 'user', content: e.content })
    if (e.type === 'assistant/message') out.push({ role: 'assistant', content: e.content })
    // tool/call / tool/result / compaction/* 在本课简化派生中不展开
  }
  return out
}

// ---------------------------------------------------------------------------
// compaction 服务：start（拿锁）→ summary → end（放锁）
// ---------------------------------------------------------------------------

class CompactionService {
  private seq = 0

  constructor(private session: Session) {}

  /** 拿锁：记 start。返回锁 id；调用方崩溃时它留在日志里可被检测 */
  start(upToSeq: number): string {
    const compactionId = `compact-${++this.seq}`
    this.session.append({ type: 'compaction/start', compactionId, upToSeq })
    return compactionId
  }

  summary(compactionId: string, summary: string): void {
    this.session.append({ type: 'compaction/summary', compactionId, summary })
  }

  end(compactionId: string): void {
    this.session.append({ type: 'compaction/end', compactionId })
  }

  /** 遗留锁检测：有 start 无 end 的压缩 = 上次操作没走完，fail loud */
  staleLocks(): string[] {
    const started: string[] = []
    const ended = new Set<string>()
    for (const e of this.session.events) {
      if (e.type === 'compaction/start') started.push(e.compactionId)
      if (e.type === 'compaction/end') ended.add(e.compactionId)
    }
    return started.filter((id) => !ended.has(id))
  }
}

// ---------------------------------------------------------------------------
// 演示：一次完整压缩 + 模拟崩溃留下的遗留锁
// ---------------------------------------------------------------------------

const session = new Session()
const compaction = new CompactionService(session)

console.log('\n① 长会话：先积累一批旧消息')
session.append({ type: 'user/message', content: '帮我调研这个仓库的结构' })
session.append({ type: 'assistant/message', content: '好的，我先列出目录。' })
session.append({ type: 'tool/call', callId: 'c1', name: 'bash', arguments: '{"command":"ls -R"}' })
session.append({ type: 'tool/result', callId: 'c1', content: '(一长串目录树……)' })
session.append({ type: 'assistant/message', content: '这是一个 20 课的 monorepo。' })
const boundary = session.events.length
console.log(`  旧区段 seq 1..${boundary}，共 ${boundary} 条事件`)

console.log('\n② 压缩三步：start（拿锁）→ summary → end（放锁），全部进日志')
const lockId = compaction.start(boundary)
compaction.summary(lockId, '调研结论：仓库是 20 课渐进式 harness 教学，s01 已完成。')
compaction.end(lockId)
for (const e of session.events.slice(boundary)) {
  console.log(`  seq=${e.seq} ${e.type}`)
}

console.log('\n③ 派生结果：旧区段被一条合成替换消息遮蔽（日志没删任何事件）')
console.log(`  日志事件总数: ${session.events.length}（未变，仅追加）`)
for (const m of deriveMessages(session.events)) {
  console.log(`  [${m.role}] ${m.content.slice(0, 40)}${m.content.length > 40 ? '…' : ''}`)
}

console.log('\n④ 模拟崩溃：只写了 start 就中断 → 遗留锁可检测')
const brokenId = compaction.start(session.events.length)
console.log(`  start(${brokenId.slice(0, 12)}…) 后进程崩溃，没写 summary/end`)
const stale = compaction.staleLocks()
console.log(`  staleLocks() 检出: ${stale.length} 个未闭合压缩 -> ${stale.length > 0 ? '✅ 可发现' : '❌'}`)

console.log('\n要点：不删日志，只遮蔽；start/end 配对 = 锁，遗留 start = 崩溃可见。')
console.log('dsh 里 compaction 是可选 seam：ctx.compaction 服务 + /compact 消费方。\n')
