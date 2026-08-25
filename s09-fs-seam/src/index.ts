/**
 * s09-fs-seam —— 文件系统 seam：fs 和 subprocess 共享一个执行世界
 *
 * 第二个 seam：ctx.fs Provider 提供读写，fs/write waterfall 承载访问策略，
 * 面向模型的 read_file / write_file 是 Consumer。
 * Provider 换成"根目录锁定的世界"，工具代码不改。
 *
 * 本课不联网：pnpm s09 看本地 Provider 与受限 Provider 的差异、策略拦截写操作。
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// ---------------------------------------------------------------------------
// Service Definition
// ---------------------------------------------------------------------------

interface FsBackend {
  readonly name: string
  read(path: string): string
  write(path: string, content: string): void
  list(dir: string): string[]
}

// ---------------------------------------------------------------------------
// Provider A：本地 node:fs
// ---------------------------------------------------------------------------

const localFs: FsBackend = {
  name: 'local-fs',
  read: (p) => readFileSync(p, 'utf-8'),
  write: (p, c) => writeFileSync(p, c),
  list: (d) => readdirSync(d),
}

// ---------------------------------------------------------------------------
// Provider B：根目录锁定的"囚禁"世界（越界即报错）
// ---------------------------------------------------------------------------

function jailedFs(root: string): FsBackend {
  const inside = (p: string): string => {
    const abs = resolve(p)
    if (!abs.startsWith(resolve(root))) throw new Error(`jailed-fs: ${p} 越出根目录 ${root}`)
    return abs
  }
  return {
    name: `jailed-fs(${root})`,
    read: (p) => readFileSync(inside(p), 'utf-8'),
    write: (p, c) => writeFileSync(inside(p), c),
    list: (d) => readdirSync(inside(d)),
  }
}

// ---------------------------------------------------------------------------
// fs/write 策略 waterfall（s03 形态）：监听器可拒绝写入
// ---------------------------------------------------------------------------

type WritePolicy = (path: string, content: string) => string | undefined // 返回拒绝原因或放行

const writePolicies: WritePolicy[] = []

function guardedWrite(fs: FsBackend, path: string, content: string): string {
  for (const policy of writePolicies) {
    const reason = policy(path, content)
    if (reason) return `[blocked] ${reason}`
  }
  fs.write(path, content)
  return `[written] ${path}`
}

// ---------------------------------------------------------------------------
// Consumer：文件工具只认识接口
// ---------------------------------------------------------------------------

function readFileTool(fs: FsBackend, path: string): string {
  try {
    return fs.read(path)
  } catch (err) {
    return `Error: ${(err as Error).message}`
  }
}

// ---------------------------------------------------------------------------
// 演示
// ---------------------------------------------------------------------------

const world = mkdtempSync(join(tmpdir(), 'dshlearn-s09-'))
mkdirSync(join(world, 'sub'), { recursive: true })
writeFileSync(join(world, 'hello.txt'), 'hello dsh')
writeFileSync(join(world, 'app.secret'), 'TOP-SECRET')

// 策略：任何 *.secret 文件禁止写入
writePolicies.push((p) => (p.endsWith('.secret') ? 'policy: *.secret 文件禁止写入' : undefined))

console.log('\n① 本地 Provider：正常读写')
console.log('  read hello.txt =', readFileTool(localFs, join(world, 'hello.txt')))
console.log('  write notes.txt =', guardedWrite(localFs, join(world, 'notes.txt'), 'note'))

console.log('\n② 策略 waterfall 拦截：写 app.secret 被拒')
console.log('  write app.secret =', guardedWrite(localFs, join(world, 'app.secret'), 'x'))

console.log('\n③ 换囚禁 Provider：同一段工具代码，越界即失败')
const jailed = jailedFs(world)
console.log('  read hello.txt =', readFileTool(jailed, join(world, 'hello.txt')))
console.log('  read /etc/passwd =', readFileTool(jailed, '/etc/passwd'))
console.log('  list 根外目录 =', readFileTool(jailed, '/tmp'))

rmSync(world, { recursive: true })

console.log('\n要点：fs Provider 和 subprocess Provider 指向同一个执行世界。')
console.log('一起指向远程沙箱时，文件与命令自动落到同一端——不存在 Provider 分叉。\n')
