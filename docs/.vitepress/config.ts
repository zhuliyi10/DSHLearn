import { defineConfig } from 'vitepress'

const lessonTitles: Record<string, string> = {
  's01-agent-loop': 'Agent Loop',
  's02-cordis-context': '迷你 Cordis 上下文',
  's03-events-bus': '类型化事件总线',
  's04-session-log': '会话日志',
  's05-system-prompt': '系统提示词组装',
  's06-tool-pipeline': '工具注册与执行流水线',
  's07-approval-guard': '用户审批',
  's08-bash-seam': 'Bash seam',
  's09-fs-seam': '文件系统 seam',
  's10-mcp-seam': 'MCP 接入',
  's11-subagent': 'Subagent',
  's12-skill-loading': 'Skill 加载',
  's13-todo': 'Todo',
  's14-compaction': '上下文压缩',
  's15-jobs': '后台任务',
  's16-schedule': '定时提醒',
  's17-integrated-harness': '集成 harness',
  's18-workflow': '工作流',
  's19-goal-loop': '目标循环',
  's20-beyond': '进阶地图',
}

const groups: { text: string; items: string[] }[] = [
  { text: 'Part I · 底座：迷你 Cordis', items: ['s01-agent-loop', 's02-cordis-context', 's03-events-bus'] },
  { text: 'Part II · 主干：循环与会话', items: ['s04-session-log', 's05-system-prompt', 's06-tool-pipeline'] },
  { text: 'Part III · 治理', items: ['s07-approval-guard'] },
  { text: 'Part IV · 能力 seam', items: ['s08-bash-seam', 's09-fs-seam', 's10-mcp-seam'] },
  { text: 'Part V · 委派与知识', items: ['s11-subagent', 's12-skill-loading', 's13-todo', 's14-compaction'] },
  { text: 'Part VI · 自治', items: ['s15-jobs', 's16-schedule', 's17-integrated-harness'] },
  { text: 'Part VII · 编排', items: ['s18-workflow', 's19-goal-loop', 's20-beyond'] },
]

const lessonTitle = (dir: string) => {
  const num = dir.slice(0, 3)
  return `${num} ${lessonTitles[dir] ?? dir}`
}

export default defineConfig({
  title: 'DSHLearn',
  description: '用 20 节渐进式小实现，拆解 DeepSeek Harness（dsh）的机制',
  lang: 'zh-CN',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: true,

  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }]],

  themeConfig: {
    nav: [
      { text: '课程', link: '/s01-agent-loop', activeMatch: '/s\\d{2}' },
      { text: 'GitHub', link: 'https://github.com/zhuliyi10/DSHLearn' },
    ],

    sidebar: {
      '/': [
        { text: '课程总览', link: '/', items: [] },
        ...groups.map((g) => ({
          text: g.text,
          items: g.items.map((dir) => ({ text: lessonTitle(dir), link: `/${dir}` })),
        })),
      ],
    },

    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一课', next: '下一课' },
    lastUpdated: { text: '最后更新' },
    search: { provider: 'local', options: { translations: { button: { buttonText: '搜索', buttonAriaLabel: '搜索' } } } },

    footer: { message: 'MIT Licensed', copyright: 'DSHLearn' },
  },

  markdown: { theme: { light: 'github-light', dark: 'github-dark' } },
})
