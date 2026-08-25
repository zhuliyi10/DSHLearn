/**
 * s12-skill-loading —— Skill 加载：目录常驻，正文按需注入
 *
 * skill 的 name/description 作为提示词段落常驻（便宜），正文用到时才
 * 由 skill 工具注入——注入后成为一条合成 user 消息进入下一轮。
 * skill 是可选指令而非会话事件。
 *
 * 本课自带 skills/ 目录（commit-style、code-review 两个 SKILL）。
 * 不联网：pnpm s12 看目录常驻与按需注入。
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ---------------------------------------------------------------------------
// SKILL.md 约定：frontmatter（name/description）+ markdown 正文
// ---------------------------------------------------------------------------

interface Skill {
  name: string
  description: string
  body: string
}

function parseSkillFile(path: string): Skill {
  const raw = readFileSync(path, 'utf-8')
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) throw new Error(`invalid SKILL file: ${path}`)
  const frontmatter: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx > 0) frontmatter[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  if (!frontmatter.name || !frontmatter.description) throw new Error(`missing frontmatter: ${path}`)
  return { name: frontmatter.name, description: frontmatter.description, body: match[2].trim() }
}

// ---------------------------------------------------------------------------
// filesystem Provider：发现目录下的 skill
// ---------------------------------------------------------------------------

function filesystemProvider(dir: string): { list(): Skill[] } {
  return {
    list() {
      return readdirSync(dir)
        .filter((f) => f.endsWith('.md'))
        .map((f) => parseSkillFile(join(dir, f)))
        .sort((a, b) => a.name.localeCompare(b.name))
    },
  }
}

// ---------------------------------------------------------------------------
// 目录常驻：skill 清单作为一个提示词段落（s05 形态）
// ---------------------------------------------------------------------------

function catalogSection(skills: Skill[]): string {
  const lines = skills.map((s) => `- ${s.name}: ${s.description}`)
  return ['可用 skills（用 skill 工具按需加载正文）:', ...lines].join('\n')
}

// ---------------------------------------------------------------------------
// skill 工具：正文按需注入为下一条合成 user 消息（agent.inject 语义）
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const skillsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills')
  const provider = filesystemProvider(skillsDir)
  const catalog = provider.list()

  console.log('\n① 目录常驻：每个请求的提示词都带 skill 清单（只有名字和一句话）')
  console.log('--- system prompt 段落 ---')
  console.log(catalogSection(catalog))

  // 注入队列：skill 正文在这里等待进入下一轮（dsh 里经 agent.inject() 落进收件箱）
  const inbox: { role: 'user'; content: string; source: string }[] = []

  const skillTool = async (args: unknown): Promise<string> => {
    const { name } = args as { name: string }
    const skill = catalog.find((s) => s.name === name)
    if (!skill) return `Error: unknown skill "${name}"`
    inbox.push({ role: 'user', content: skill.body, source: 'skill' })
    return `skill "${name}" 已注入下一轮上下文（${skill.body.length} 字符）`
  }

  console.log('\n② 脚本化模型的决策：先决定加载 commit-style')
  console.log('  [step 1] 调用 skill ->', await skillTool({ name: 'commit-style' }))
  console.log('  [step 2] 注入的正文成为下一条合成 user 消息：')
  for (const msg of inbox) {
    console.log(`    source=${msg.source}`)
    console.log(msg.content.split('\n').map((l) => `    | ${l}`).join('\n'))
  }

  console.log('\n③ 未加载的 skill 不占上下文：code-review 正文从未进入会话')
  console.log(`  inbox 中的消息数: ${inbox.length}（只有被请求的那个）`)

  console.log('\n④ 未知 skill：fail loud')
  console.log('  ', await skillTool({ name: 'no-such-skill' }))

  console.log('\n要点：知识不前置塞入。agent 知道有什么可用，然后自己拉取所需。\n')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
