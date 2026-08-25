/**
 * s08-bash-seam —— Bash seam：执行器可换，本地 spawn 或受限沙箱
 *
 * 第一次完整走 capability seam 的三角色：
 *   Service Definition: ShellBackend 接口（每个 ctx 只允许一个激活实现）
 *   Service Provider:   本地 spawn / 受限沙箱
 *   Consumer:           bash 工具（只调用 ctx.shell，不碰 child_process）
 * 换 Provider，工具代码一行不改。
 *
 * 本课不联网：pnpm s08 看同一个工具在两个 Provider 下的行为差异。
 */

import { spawnSync } from 'node:child_process'

// ---------------------------------------------------------------------------
// Service Definition：接口
// ---------------------------------------------------------------------------

interface ShellResult {
  exitCode: number
  stdout: string
  stderr: string
}

interface ShellBackend {
  readonly name: string
  run(command: string, cwd: string): ShellResult
}

// ---------------------------------------------------------------------------
// Provider A：本地 spawn
// ---------------------------------------------------------------------------

const localShell: ShellBackend = {
  name: 'local-spawn',
  run(command, cwd) {
    const r = spawnSync('bash', ['-c', command], { cwd, encoding: 'utf-8', timeout: 10_000 })
    return { exitCode: r.status ?? -1, stdout: (r.stdout ?? '').trim(), stderr: (r.stderr ?? '').trim() }
  },
}

// ---------------------------------------------------------------------------
// Provider B：受限沙箱（静态检查 + 根目录锁定）
// ---------------------------------------------------------------------------

function sandboxedShell(root: string): ShellBackend {
  return {
    name: `sandbox(${root})`,
    run(command, cwd) {
      // 沙箱策略：拒绝越界路径与敏感命令
      const forbidden = [/\/etc(\/|$)/, /\/root(\/|$)/, /\.\.(\/|$)/, /sudo/, /rm\s+-rf/]
      for (const rule of forbidden) {
        if (rule.test(command)) {
          return { exitCode: 126, stdout: '', stderr: `sandbox: command touches forbidden path/pattern (${rule})` }
        }
      }
      if (!cwd.startsWith(root)) {
        return { exitCode: 126, stdout: '', stderr: `sandbox: cwd outside root ${root}` }
      }
      return localShell.run(command, cwd)
    },
  }
}

// ---------------------------------------------------------------------------
// 极简 ctx：seam 键只允许一个激活实现，注册第二个 = 替换
// ---------------------------------------------------------------------------

const ctx: { shell?: ShellBackend } = {}

function registerShell(backend: ShellBackend): void {
  if (ctx.shell) console.log(`\x1b[2m  [seam] 替换 Provider: ${ctx.shell.name} -> ${backend.name}\x1b[0m`)
  ctx.shell = backend
}

// ---------------------------------------------------------------------------
// Consumer：bash 工具只认识接口
// ---------------------------------------------------------------------------

function bashTool(command: string): string {
  if (!ctx.shell) throw new Error('no shell backend registered')
  const r = ctx.shell.run(command, process.cwd())
  const body = [r.stdout, r.stderr].filter(Boolean).join('\n') || '(no output)'
  return `[${ctx.shell.name}] exit=${r.exitCode}\n${body}`
}

// ---------------------------------------------------------------------------
// 演示
// ---------------------------------------------------------------------------

console.log('\n① 本地 Provider：一切命令照跑')
registerShell(localShell)
console.log(bashTool('pwd'))
console.log(bashTool('head -1 /etc/hosts'))

console.log('\n② 换成沙箱 Provider：同一段工具代码，行为变了')
registerShell(sandboxedShell(process.cwd()))
console.log(bashTool('pwd'))
console.log(bashTool('head -1 /etc/hosts'))
console.log(bashTool('cat ../../secrets.txt'))

console.log('\n要点：Consumer 从未改过一行。dsh 里把 Provider 指向远程沙箱，')
console.log('Bash、PTY、LSP 整条执行世界跟着搬家——没有 Provider 分叉。\n')
