/**
 * s19-goal-loop —— 目标循环：目标决定循环什么时候真正结束
 *
 * dsh 的 ctx.goals 是事件溯源的目标服务：GoalRef 带修订号做 compare-and-set，
 * 每次获准的持久变更递增修订；持久阶段 active / paused / blocked / complete
 * 回答目标发生了什么。agent 每次想停下时先由目标裁决——没达成就续跑
 * （同会话，不新开 agent），达成/超上限才交还控制权。
 *
 * 不联网：pnpm s19 看一个脚本化 agent 在目标驱动下连跑三轮直至完成。
 */

// ---------------------------------------------------------------------------
// Goal 域：事件溯源 + CAS 修订号
// ---------------------------------------------------------------------------

type GoalPhase = 'active' | 'paused' | 'blocked' | 'complete'

type GoalEvent =
  | { type: 'goal/set'; description: string }
  | { type: 'goal/update'; revision: number; note: string }
  | { type: 'goal/phase'; revision: number; phase: GoalPhase }

interface Goal {
  description: string
  revision: number // 每次获准的持久变更递增
  phase: GoalPhase
  history: GoalEvent[]
}

class GoalService {
  private goal: Goal | null = null

  set(description: string): Goal {
    this.goal = { description, revision: 0, phase: 'active', history: [{ type: 'goal/set', description }] }
    return this.goal
  }

  get current(): Goal {
    if (!this.goal) throw new Error('no goal set')
    return this.goal
  }

  /** compare-and-set：期望修订不匹配 = 并发变更冲突，直接拒绝 */
  private commit(g: Goal, expectedRevision: number): void {
    if (g.revision !== expectedRevision) {
      throw new Error(`revision conflict: expected ${expectedRevision}, current is ${g.revision}`)
    }
    g.revision += 1
  }

  update(expectedRevision: number, note: string): Goal {
    const g = this.current
    this.commit(g, expectedRevision)
    g.history.push({ type: 'goal/update', revision: g.revision, note })
    return g
  }

  transition(expectedRevision: number, phase: GoalPhase): Goal {
    const g = this.current
    this.commit(g, expectedRevision)
    g.phase = phase
    g.history.push({ type: 'goal/phase', revision: g.revision, phase })
    return g
  }
}

// ---------------------------------------------------------------------------
// 停止裁决：turn-stopping 时先问目标——没达成就续跑（同会话）
// ---------------------------------------------------------------------------

type Verdict = { action: 'stop' } | { action: 'continue'; reason: string }

function adjudicate(goal: Goal, lastResult: string, rounds: number, maxRounds: number): Verdict {
  if (goal.phase === 'complete') return { action: 'stop' }
  if (rounds >= maxRounds) return { action: 'stop' } // 超上限才交还控制权
  if (lastResult.includes('DONE')) return { action: 'stop' }
  return { action: 'continue', reason: `goal still ${goal.phase}: "${goal.description}"` }
}

// ---------------------------------------------------------------------------
// 演示：脚本化 agent 在目标驱动下连跑，CAS 冲突可见
// ---------------------------------------------------------------------------

const goals = new GoalService()

console.log('\n① 设定同会话目标（不新开 agent，接着原会话跑）')
const goal = goals.set('把三个测试全部修绿')
console.log(`  goal="${goal.description}" phase=${goal.phase} rev=${goal.revision}`)

console.log('\n② 目标驱动循环：每轮结束想停下时，先由目标裁决')
const scriptedRounds = ['修好 test-a（还有 2 个红的）', '修好 test-b（还有 1 个红的）', '修好 test-c DONE']
let rounds = 0
for (const result of scriptedRounds) {
  rounds += 1
  console.log(`\n  [round ${rounds}] agent 工作: ${result}`)
  goals.update(goals.current.revision, result) // 进展写回目标域（CAS）

  const verdict = adjudicate(goals.current, result, rounds, 10)
  if (verdict.action === 'continue') {
    console.log(`    turn-stopping -> 裁决: 继续。理由: ${verdict.reason}`)
  } else {
    goals.transition(goals.current.revision, 'complete')
    console.log('    turn-stopping -> 裁决: 停止，交还控制权。')
    break
  }
}
console.log(`  最终: phase=${goals.current.phase} rev=${goals.current.revision}`)

console.log('\n③ CAS 修订号：拿旧修订去更新 = 并发冲突，拒绝')
try {
  goals.update(0, '用过时的修订号写入')
} catch (err) {
  console.log('  预期的冲突：', (err as Error).message)
}

console.log('\n④ 事件溯源：目标的完整历史从事件流回放')
for (const e of goals.current.history) {
  console.log(`  ${e.type}${'revision' in e ? ` (rev ${e.revision})` : ''}`)
}

console.log('\n要点：普通轮次止于「没有工具欠着」；目标循环止于「目标说了算」。')
console.log('续跑是同会话的，修订号让并发变更冲突显形。\n')
