/**
 * s16-schedule —— 定时提醒：提醒持久化，回到原会话变成一轮对话
 *
 * dsh 的 schedule 拥有持久提醒：session 内唯一的 ScheduleId，支持
 * after（延时）、at（绝对时刻）、every（固定间隔，最小五分钟）；创建时
 * 一切目标规范化为 RFC 3339 UTC。到点后提醒以对话式交付回到原 live
 * Session——没有回执边界，就是一次普通的后续轮次。
 *
 * 不联网：pnpm s16 看脚本化的创建 → 持久化 → 到期交付全流程（时间加速）。
 */

import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// ScheduleRecord：三种 kind，目标时间一律规范化为 RFC 3339 UTC
// ---------------------------------------------------------------------------

type ScheduleKind =
  | { kind: 'after'; delayMs: number }
  | { kind: 'at'; atIso: string }
  | { kind: 'every'; intervalMs: number }

interface ScheduleRecord {
  id: string // session 内唯一
  sessionId: string
  message: string
  /** 规范化后的触发时刻（RFC 3339 UTC）；every 则是下次触发时刻 */
  fireAt: string
  spec: ScheduleKind
}

const MIN_EVERY_MS = 5 * 60 * 1000 // dsh: every 最小五分钟

class ScheduleService {
  private records = new Map<string, ScheduleRecord>()
  private seq = 0

  /** 创建时一切目标规范化为 RFC 3339 UTC */
  create(sessionId: string, message: string, spec: ScheduleKind, now = new Date()): ScheduleRecord {
    let fireAt: Date
    if (spec.kind === 'after') fireAt = new Date(now.getTime() + spec.delayMs)
    else if (spec.kind === 'at') fireAt = new Date(spec.atIso)
    else {
      if (spec.intervalMs < MIN_EVERY_MS) throw new Error(`every interval must be >= ${MIN_EVERY_MS}ms (五分钟)`)
      fireAt = new Date(now.getTime() + spec.intervalMs)
    }
    if (Number.isNaN(fireAt.getTime())) throw new Error('invalid fire time')
    const id = `sch-${++this.seq}`
    const rec: ScheduleRecord = {
      id,
      sessionId,
      message,
      fireAt: fireAt.toISOString(), // RFC 3339 UTC
      spec,
    }
    this.records.set(id, rec)
    return rec
  }

  cancel(id: string): boolean {
    return this.records.delete(id)
  }

  list(): ScheduleRecord[] {
    return [...this.records.values()]
  }

  /** 调度扫描：返回到期项；every 自动滚动到下一个周期，其余触发即移除 */
  due(now = new Date()): ScheduleRecord[] {
    const fired: ScheduleRecord[] = []
    for (const rec of this.records.values()) {
      if (new Date(rec.fireAt).getTime() <= now.getTime()) {
        fired.push(rec)
        if (rec.spec.kind === 'every') {
          rec.fireAt = new Date(new Date(rec.fireAt).getTime() + rec.spec.intervalMs).toISOString()
        } else {
          this.records.delete(rec.id)
        }
      }
    }
    return fired
  }
}

// ---------------------------------------------------------------------------
// 交付 = 普通后续轮次：到期提醒作为合成 user 消息进入原会话
// ---------------------------------------------------------------------------

interface SessionTurn {
  role: 'user' | 'assistant'
  content: string
}

function deliver(session: SessionTurn[], rec: ScheduleRecord): void {
  // 没有回执边界：就是一次普通的后续轮次
  session.push({ role: 'user', content: `[scheduled reminder ${rec.id}] ${rec.message}` })
}

// ---------------------------------------------------------------------------
// 演示（时间加速）：创建 → 持久化到文件 → 重启恢复 → 到期交付回原会话
// ---------------------------------------------------------------------------

const schedules = new ScheduleService()
const session: SessionTurn[] = [{ role: 'user', content: '帮我盯着构建，2 分钟后提醒我看结果' }]

console.log('\n① agent 设闹钟：after / at / every 三种，全部规范化为 UTC ISO')
const t0 = new Date('2026-01-01T00:00:00Z')
const r1 = schedules.create('sess-1', '该看构建结果了', { kind: 'after', delayMs: 2 * 60 * 1000 }, t0)
const r2 = schedules.create('sess-1', '晨会时间', { kind: 'at', atIso: '2026-01-01T00:05:00Z' }, t0)
const r3 = schedules.create('sess-1', '站起来活动一下', { kind: 'every', intervalMs: 30 * 60 * 1000 }, t0)
for (const r of [r1, r2, r3]) console.log(`  ${r.id} fireAt=${r.fireAt} (${r.spec.kind}) "${r.message}"`)

console.log('\n② 非法参数在创建时拒绝：every < 5 分钟')
try {
  schedules.create('sess-1', 'too fast', { kind: 'every', intervalMs: 60 * 1000 }, t0)
} catch (err) {
  console.log('  预期的错误：', (err as Error).message)
}

console.log('\n③ 持久化：写文件 → 模拟重启 → 从文件恢复（提醒不丢）')
const dir = mkdtempSync(join(tmpdir(), 'dshlearn-s16-'))
const file = join(dir, 'schedules.json')
writeFileSync(file, JSON.stringify(schedules.list()))
const restored = new ScheduleService()
for (const rec of JSON.parse(readFileSync(file, 'utf-8')) as ScheduleRecord[]) {
  // 恢复 = 重新注册（此处直接塞回内部状态，略去重复校验）
  ;(restored as unknown as { records: Map<string, ScheduleRecord>; seq: number }).records.set(rec.id, rec)
}
console.log(`  重启后恢复 ${restored.list().length} 条提醒`)
rmSync(dir, { recursive: true })

console.log('\n④ 到点交付：提醒回到原会话，就是一次普通的后续轮次')
const due = restored.due(new Date('2026-01-01T00:05:30Z')) // 时间快进到 00:05:30
for (const rec of due) {
  deliver(session, rec)
  console.log(`  触发 ${rec.id} (${rec.spec.kind})`)
}
console.log('  会话现在是:')
for (const turn of session) console.log(`    [${turn.role}] ${turn.content}`)

console.log('\n⑤ every 自动滚动：触发一次后仍在册，fireAt 已是下一周期')
console.log(`  ${r3.id} -> ${restored.list().find((r) => r.id === r3.id)?.fireAt}`)

console.log('\n要点：提醒持久 + 交付即对话。agent 不必有人说话才工作。')
console.log('dsh 里 ScheduleId session 内唯一，every 最小五分钟，一切 RFC 3339 UTC。\n')
