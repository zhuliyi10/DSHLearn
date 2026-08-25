/**
 * s01-agent-loop —— Agent 循环：dsh 的最小形状
 *
 * dsh 里一个 turn（轮次）的骨架：
 *
 *     认领输入 -> 组装请求 -> [step: 一次模型请求 + 它发起的工具调用]* -> 关闭轮次
 *
 * 本课只用 OpenAI 兼容接口 + 一个 bash 工具，把这个骨架跑出来。
 * 后面的课会逐步替换其中每一块：
 *   - 「消息数组」   -> s04 的仅追加会话日志（从日志派生历史）
 *   - 「写死的 system」-> s05 的插件注册段落
 *   - 「内联工具执行」 -> s06 的带守卫工具流水线
 *
 * 运行: pnpm s01  （先在根目录配好 .env）
 */

import * as readline from 'node:readline/promises'
import { spawnSync } from 'node:child_process'
import Anthropic from '@anthropic-ai/sdk'
import 'dotenv/config'

// ---------------------------------------------------------------------------
// 模型连接：走 Anthropic 兼容端点（官方 / DeepSeek 等代理）
// dsh 里这一步由 LLM seam（ctx.llm）的适配器插件完成，见 s02/s05。
// ---------------------------------------------------------------------------
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('缺少 ANTHROPIC_API_KEY：请先 cp .env.example .env 并填入你的 API Key')
  process.exit(1)
}
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
})
const MODEL = process.env.MODEL_ID ?? 'deepseek-chat'

const SYSTEM = `You are a coding agent working in ${process.cwd()}.
Use the bash tool to inspect and modify the environment. Act, don't explain.`

// ---------------------------------------------------------------------------
// 工具词汇：schema 给模型，execute 留给宿主
// dsh 里 ToolDefinition 把两者严格分开（见 s06），这里先放在一个对象里。
// ---------------------------------------------------------------------------
const TOOLS: Anthropic.Tool[] = [
  {
    name: 'bash',
    description: 'Run a shell command in the working directory.',
    input_schema: {
      type: 'object',
      properties: { command: { type: 'string', description: 'The shell command to run' } },
      required: ['command'],
    },
  },
]

function executeBash(command: string): string {
  const dangerous = ['rm -rf /', 'sudo', 'shutdown', 'reboot', '> /dev/']
  if (dangerous.some((d) => command.includes(d))) return 'Error: dangerous command blocked'
  const r = spawnSync('bash', ['-c', command], {
    cwd: process.cwd(),
    encoding: 'utf-8',
    timeout: 120_000,
    maxBuffer: 1 << 20,
  })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim()
  return out ? out.slice(0, 50_000) : '(no output)'
}

// ---------------------------------------------------------------------------
// 核心循环：模型不停，循环就不停
// 对照 dsh：一个 step = 一次模型请求 + 它请求的所有工具调用；
//          有工具结果欠着，就进入下一个 step（见 docs/architecture.md Turn flow）。
// ---------------------------------------------------------------------------
async function runTurn(messages: Anthropic.MessageParam[]): Promise<void> {
  let step = 0
  while (true) {
    step += 1
    console.log(`\x1b[2m--- step ${step} ---\x1b[0m`)

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      messages,
      tools: TOOLS,
    })

    messages.push({ role: 'assistant', content: response.content })

    // 模型没请求工具，轮次结束
    if (response.stop_reason !== 'tool_use') return

    const results: Anthropic.ToolResultBlockParam[] = []
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue
      const command = (block.input as { command: string }).command
      console.log(`\x1b[33m$ ${command}\x1b[0m`)
      const output = executeBash(command)
      console.log(output.slice(0, 200))
      // 工具结果回灌：下一轮请求里模型能看到它
      results.push({ type: 'tool_result', tool_use_id: block.id, content: output })
    }
    messages.push({ role: 'user', content: results })
    // 有工具结果欠着 -> 下一个 step
  }
}

// ---------------------------------------------------------------------------
// 入口：最朴素的多轮 REPL。messages[] 是唯一的"记忆"——s04 会拆掉它。
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log('s01: Agent Loop')
  console.log('输入任务回车执行，q 退出。示例：')
  console.log('  1) 当前目录下有哪些课程目录？用 bash 列出来，并用一句话总结这个仓库是干什么的')
  console.log('  2) 读取 s01-agent-loop/src/index.ts，找出屏蔽危险命令的列表，')
  console.log('     再用 bash 验证 "echo hello" 能执行，最后告诉我这个黑名单机制有什么缺陷\n')
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const messages: Anthropic.MessageParam[] = []

  while (true) {
    let query: string
    try {
      query = await rl.question('\x1b[36ms01 >> \x1b[0m')
    } catch {
      break
    }
    if (!query.trim() || query.trim().toLowerCase() === 'q') break
    messages.push({ role: 'user', content: query })
    await runTurn(messages)
    // 打印模型的最终文本回答
    const last = messages[messages.length - 1]
    if (last.role === 'assistant' && Array.isArray(last.content)) {
      for (const block of last.content) {
        if (block.type === 'text') console.log(`\n${block.text}\n`)
      }
    }
  }
  rl.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
