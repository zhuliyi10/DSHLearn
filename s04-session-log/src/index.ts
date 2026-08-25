/**
 * s04-session-log —— 会话日志：模型可见的，必须能从日志重建
 *
 * 拆掉 s01 的 messages[]：Session 是一份仅追加的 SessionEvent 日志，
 * 模型历史由 deriveMessages() 从日志派生；回放 = 从同一组事件重新派生。
 *
 * 本课不联网：pnpm s04 直接看日志追加、派生与 JSONL 回放。
 */

import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// 事件词汇：取 dsh SessionEventMap 的核心子集
// ---------------------------------------------------------------------------

type SessionEvent =
  | { seq: number; type: 'turn/start'; turn: number }
  | { seq: number; type: 'turn/end'; turn: number; reason: string }
  | { seq: number; type: 'step/start'; turn: number; step: number }
  | { seq: number; type: 'step/end'; turn: number; step: number }
  | { seq: number; type: 'user/message'; message: { role: 'user'; content: string } }
  | { seq: number; type: 'assistant/message'; message: { role: 'assistant'; content: string } }
  | { seq: number; type: 'tool/call'; callId: string; name: string; arguments: string }
  | { seq: number; type: 'tool/result'; callId: string; content: string }

/** 从日志派生出的模型可见消息 */
type ModelMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string }
  | { role: 'assistant-tool-call'; callId: string; name: string; arguments: string }
  | { role: 'tool'; callId: string; content: string }

/** 去掉 seq 的事件（对联合类型逐个分发 Omit） */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
type NewEvent = DistributiveOmit<SessionEvent, 'seq'>

class Session {
  private log: SessionEvent[] = []

  /** 仅追加：seq 连续递增，负载必须是无损 JSON——不合法在源头就拒绝 */
  append(event: NewEvent): SessionEvent {
    // JSON 往返校验：函数/循环引用等不可序列化值在这里被拒绝
    JSON.parse(JSON.stringify(event))
    const full = { seq: this.log.length + 1, ...event } as SessionEvent
    this.log.push(full)
    return full
  }

  get events(): readonly SessionEvent[] {
    return this.log
  }

  static fromEvents(events: SessionEvent[]): Session {
    const s = new Session()
    for (const e of events) {
      const copy = { ...e } as Partial<SessionEvent>
      delete copy.seq
      s.append(copy as NewEvent)
    }
    return s
  }
}

/** 投影规则：只有产生消息的事件进入模型历史，turn/step 标记不参与 */
function deriveMessages(events: readonly SessionEvent[]): ModelMessage[] {
  const out: ModelMessage[] = []
  for (const e of events) {
    switch (e.type) {
      case 'user/message':
        out.push({ role: 'user', content: e.message.content })
        break
      case 'assistant/message':
        out.push({ role: 'assistant', content: e.message.content })
        break
      case 'tool/call':
        out.push({ role: 'assistant-tool-call', callId: e.callId, name: e.name, arguments: e.arguments })
        break
      case 'tool/result':
        out.push({ role: 'tool', callId: e.callId, content: e.content })
        break
      default:
        break // turn/*、step/* 是边界标记，模型不可见
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// 演示：一个脚本化轮次 + JSONL 回放 + 不变式守护
// ---------------------------------------------------------------------------

const session = new Session()

console.log('\n① 按 dsh 的 turn flow 追加事件（turn=1，两个 step）')
session.append({ type: 'turn/start', turn: 1 })
session.append({ type: 'user/message', message: { role: 'user', content: '统计当前目录的文件数' } })

session.append({ type: 'step/start', turn: 1, step: 1 })
session.append({ type: 'assistant/message', message: { role: 'assistant', content: '我先列一下目录。' } })
session.append({ type: 'tool/call', callId: 'call_1', name: 'bash', arguments: '{"command":"ls | wc -l"}' })
session.append({ type: 'tool/result', callId: 'call_1', content: '42' })
session.append({ type: 'step/end', turn: 1, step: 1 })

session.append({ type: 'step/start', turn: 1, step: 2 })
session.append({ type: 'assistant/message', message: { role: 'assistant', content: '共 42 个文件。' } })
session.append({ type: 'step/end', turn: 1, step: 2 })
session.append({ type: 'turn/end', turn: 1, reason: 'no-tools-owed' })

for (const e of session.events) {
  console.log(`  seq=${String(e.seq).padStart(2)} ${e.type}`)
}

console.log('\n② deriveMessages：模型历史从日志派生（turn/step 标记被过滤）')
for (const m of deriveMessages(session.events)) {
  console.log('  ', m)
}

console.log('\n③ 回放：写 JSONL → 读回 → 重建 Session → 派生结果完全一致')
const dir = mkdtempSync(join(tmpdir(), 'dshlearn-s04-'))
const file = join(dir, 'session.jsonl')
writeFileSync(file, session.events.map((e) => JSON.stringify(e)).join('\n'))
const replayed = Session.fromEvents(
  readFileSync(file, 'utf-8')
    .split('\n')
    .map((line) => JSON.parse(line) as SessionEvent),
)
const equal = JSON.stringify(deriveMessages(session.events)) === JSON.stringify(deriveMessages(replayed.events))
console.log(`  派生结果一致: ${equal ? '✅' : '❌'}`)
rmSync(dir, { recursive: true })

console.log('\n④ 不变式守护：非 JSON 负载在源头被拒绝')
try {
  // @ts-expect-error 故意传入不可序列化值
  session.append({ type: 'user/message', message: { role: 'user', content: () => 'fn' } })
} catch (err) {
  console.log('  预期的错误：', (err as Error).message)
}

console.log('\n要点：日志是唯一真源。模型可见 = 日志可重建。')
console.log('dsh 里 fork、resume、transcript、持久化全部从这条流派生。\n')
