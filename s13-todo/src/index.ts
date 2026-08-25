/**
 * s13-todo —— Todo：计划是日志里的一次全量快照
 *
 * dsh 的 todo/write 是全量快照事件：模型每次提交整个列表（不是增量 patch），
 * 日志里最新一条写入即当前状态；它是 log-only 的 UI 状态，不参与派生模型历史。
 *
 * 不联网：pnpm s13 看脚本化模型维护清单直至全部完成。
 */

// ---------------------------------------------------------------------------
// 事件与快照语义
// ---------------------------------------------------------------------------

type TodoStatus = 'pending' | 'in_progress' | 'completed'

interface TodoItem {
  id: string
  content: string
  status: TodoStatus
}

type SessionEvent =
  | { seq: number; type: 'user/message'; content: string }
  | { seq: number; type: 'todo/write'; todos: TodoItem[] }
  | { seq: number; type: 'assistant/message'; content: string }

/** 去掉 seq 的事件（对联合类型逐个分发 Omit） */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

class Session {
  private log: SessionEvent[] = []

  append(event: DistributiveOmit<SessionEvent, 'seq'>): void {
    const { seq: _seq, ...rest } = event as SessionEvent
    this.log.push({ ...rest, seq: this.log.length + 1 } as SessionEvent)
  }

  get events(): readonly SessionEvent[] {
    return this.log
  }

  /** 回放最新快照：全量覆盖语义下，最新一条 todo/write 就是当前状态 */
  latestTodos(): TodoItem[] {
    for (let i = this.log.length - 1; i >= 0; i--) {
      const e = this.log[i]
      if (e.type === 'todo/write') return e.todos
    }
    return []
  }
}

// ---------------------------------------------------------------------------
// todo_write 工具：校验列表合法性后写事件
// ---------------------------------------------------------------------------

function todoWriteTool(session: Session, args: unknown): string {
  const todos = (args as { todos: TodoItem[] }).todos
  if (!Array.isArray(todos) || todos.length === 0) return 'Error: todos must be a non-empty array'
  const ids = new Set<string>()
  for (const t of todos) {
    if (!t.id || !t.content) return 'Error: every todo needs id and content'
    if (!['pending', 'in_progress', 'completed'].includes(t.status)) return `Error: bad status "${t.status}"`
    if (ids.has(t.id)) return `Error: duplicate id "${t.id}"`
    ids.add(t.id)
  }
  session.append({ type: 'todo/write', todos })
  return `ok, ${todos.length} todos written`
}

/** 从日志回放最新快照，渲染进度清单 */
function renderTodos(session: Session): string {
  const icon: Record<TodoStatus, string> = { pending: '[ ]', in_progress: '[~]', completed: '[x]' }
  return session
    .latestTodos()
    .map((t) => `  ${icon[t.status]} ${t.id} ${t.content}`)
    .join('\n')
}

// ---------------------------------------------------------------------------
// 演示：脚本化模型逐步推进清单（每次提交整个列表）
// ---------------------------------------------------------------------------

const session = new Session()
session.append({ type: 'user/message', content: '完成三步任务：调研、实现、测试' })

const snapshots: TodoItem[][] = [
  [
    { id: 't1', content: '调研 dsh 的 todo 事件形状', status: 'in_progress' },
    { id: 't2', content: '实现全量快照写入', status: 'pending' },
    { id: 't3', content: '回放验证', status: 'pending' },
  ],
  [
    { id: 't1', content: '调研 dsh 的 todo 事件形状', status: 'completed' },
    { id: 't2', content: '实现全量快照写入', status: 'in_progress' },
    { id: 't3', content: '回放验证', status: 'pending' },
  ],
  [
    { id: 't1', content: '调研 dsh 的 todo 事件形状', status: 'completed' },
    { id: 't2', content: '实现全量快照写入', status: 'completed' },
    { id: 't3', content: '回放验证', status: 'completed' },
  ],
]

console.log('\n① 模型每步提交整个列表（全量快照，不是增量）')
let step = 0
for (const todos of snapshots) {
  step += 1
  console.log(`\n  [step ${step}] todo_write ->`, todoWriteTool(session, { todos }))
  console.log(renderTodos(session))
}

console.log('\n② 坏列表在工具层被拒绝，日志不产生脏快照')
console.log('  ', todoWriteTool(session, { todos: [{ id: 'a', content: 'x', status: 'weird' }] }))
console.log('  ', todoWriteTool(session, { todos: [] }))

console.log('\n③ 日志回放：最新一条 todo/write 即当前状态')
console.log(`  日志总事件数: ${session.events.length}，回放清单:`)
console.log(renderTodos(session))

console.log('\n要点：全量覆盖 = 无合并冲突、回放即状态。')
console.log('todo 是 log-only UI 状态，不进入模型历史派生。\n')
