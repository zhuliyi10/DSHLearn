/**
 * s10-mcp-seam —— MCP 接入：外部工具插进同一个工具池
 *
 * 迷你 MCP 服务器（JSON-RPC 词汇：tools/list、tools/call）+ 桥接插件：
 * 把远端工具逐个注册进同一个注册表——对循环来说，MCP 工具与内置工具
 * 没有任何区别，守卫、审计走同一条流水线。
 *
 * 本课用进程内 JSON-RPC 通道（真实 dsh 走 stdio/远程传输，词汇相同）。
 * 不联网：pnpm s10 直接看桥接与卸载。
 */

// ---------------------------------------------------------------------------
// 迷你 MCP 服务器：JSON-RPC 消息处理
// ---------------------------------------------------------------------------

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params?: unknown
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number
  result?: unknown
  error?: { code: number; message: string }
}

interface McpToolSpec {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

class MiniMcpServer {
  constructor(
    readonly serverName: string,
    private tools: Record<string, { spec: McpToolSpec; handler: (args: any) => unknown }>,
  ) {}

  /** 模拟一次 JSON-RPC 往返（真实实现里这是 stdio 上的一行 JSON） */
  handle(request: JsonRpcRequest): JsonRpcResponse {
    const ok = (result: unknown): JsonRpcResponse => ({ jsonrpc: '2.0', id: request.id, result })
    const fail = (code: number, message: string): JsonRpcResponse => ({
      jsonrpc: '2.0',
      id: request.id,
      error: { code, message },
    })
    switch (request.method) {
      case 'initialize':
        return ok({ serverInfo: { name: this.serverName } })
      case 'tools/list':
        return ok({ tools: Object.values(this.tools).map((t) => t.spec) })
      case 'tools/call': {
        const { name, arguments: args } = request.params as { name: string; arguments: unknown }
        const tool = this.tools[name]
        if (!tool) return fail(-32601, `unknown tool: ${name}`)
        return ok({ content: [{ type: 'text', text: JSON.stringify(tool.handler(args)) }] })
      }
      default:
        return fail(-32601, `unknown method: ${request.method}`)
    }
  }
}

// ---------------------------------------------------------------------------
// 迷你 MCP 客户端
// ---------------------------------------------------------------------------

class MiniMcpClient {
  private nextId = 1

  constructor(private transport: (req: JsonRpcRequest) => JsonRpcResponse) {}

  private call(method: string, params?: unknown): unknown {
    const res = this.transport({ jsonrpc: '2.0', id: this.nextId++, method, params })
    if (res.error) throw new Error(`MCP error ${res.error.code}: ${res.error.message}`)
    return res.result
  }

  listTools(): McpToolSpec[] {
    return (this.call('tools/list') as { tools: McpToolSpec[] }).tools
  }

  callTool(name: string, args: unknown): string {
    const result = this.call('tools/call', { name, arguments: args }) as {
      content: { type: string; text: string }[]
    }
    return result.content.map((c) => c.text).join('\n')
  }
}

// ---------------------------------------------------------------------------
// 同一个工具池（s06 形态的简化注册表）
// ---------------------------------------------------------------------------

interface RegisteredTool {
  name: string
  description: string
  execute(args: unknown): Promise<string>
}

class ToolPool {
  private tools = new Map<string, RegisteredTool>()

  register(tool: RegisteredTool): () => void {
    this.tools.set(tool.name, tool)
    return () => this.tools.delete(tool.name)
  }

  names(): string[] {
    return [...this.tools.keys()]
  }

  async dispatch(name: string, args: unknown): Promise<string> {
    const tool = this.tools.get(name)
    if (!tool) throw new Error(`UNKNOWN_TOOL: ${name}`)
    return tool.execute(args)
  }
}

// ---------------------------------------------------------------------------
// 桥接插件：把 MCP 服务器的工具注册进工具池；卸载即回卷
// ---------------------------------------------------------------------------

function mountMcpBridge(pool: ToolPool, serverName: string, client: MiniMcpClient): () => void {
  const unregisters: (() => void)[] = []
  for (const spec of client.listTools()) {
    unregisters.push(
      pool.register({
        name: `${serverName}.${spec.name}`, // 命名空间防冲突
        description: spec.description,
        execute: async (args) => client.callTool(spec.name, args),
      }),
    )
  }
  console.log(`  [bridge] ${serverName}: 桥接了 ${unregisters.length} 个工具`)
  return () => {
    for (const un of unregisters.reverse()) un() // 逆序回卷
    console.log(`  [bridge] ${serverName}: 已卸载，工具全部回卷`)
  }
}

// ---------------------------------------------------------------------------
// 演示
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const server = new MiniMcpServer('demo-utils', {
    get_time: {
      spec: { name: 'get_time', description: 'Get current UTC time', inputSchema: { type: 'object' } },
      handler: () => ({ time: new Date().toISOString() }),
    },
    add: {
      spec: {
        name: 'add',
        description: 'Add two numbers',
        inputSchema: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } } },
      },
      handler: (args: { a: number; b: number }) => ({ sum: args.a + args.b }),
    },
  })

  // 进程内传输：一来一回都是完整的 JSON-RPC 消息
  const client = new MiniMcpClient((req) => JSON.parse(JSON.stringify(server.handle(req))))

  const pool = new ToolPool()
  pool.register({
    name: 'bash',
    description: 'Run a shell command.',
    execute: async (args) => `[bash] ${(args as { command: string }).command}`,
  })

  console.log('\n① 桥接前：池里只有内置工具')
  console.log('  ', pool.names())

  console.log('\n② 挂载桥接插件：MCP 工具进入同一个池')
  const unmount = mountMcpBridge(pool, 'demo-utils', client)
  console.log('  ', pool.names())

  console.log('\n③ 循环不区分来源：内置与 MCP 工具走同一条 dispatch')
  console.log('  ', await pool.dispatch('bash', { command: 'echo hi' }))
  console.log('  ', await pool.dispatch('demo-utils.add', { a: 2, b: 40 }))
  console.log('  ', await pool.dispatch('demo-utils.get_time', {}))

  console.log('\n④ 卸载桥接插件：外部工具全部回卷')
  unmount()
  console.log('  ', pool.names())

  console.log('\n要点：MCP 工具不是二等公民——注册进同一个池，')
  console.log('权限、审批、审计对它同样生效。\n')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
