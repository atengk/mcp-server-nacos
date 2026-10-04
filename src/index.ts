/**
 * mcp-server-nacos 主启动装配入口 (Coordinator)
 *
 * 负责 CLI 选项解析、环境变量加载、基础设施装配及 Stdio 传输层启动。
 *
 * @author Ateng
 * @since 2026-10-04
 */

import { Command } from 'commander';
import dotenv from 'dotenv';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { parseConfig } from './config/env.config.js';
import { AuthManager } from './client/auth.manager.js';
import { createHttpClient } from './client/http.client.js';
import { NacosClient } from './client/nacos.client.js';
import { createMcpServer } from './server.js';
import { startSseServer, type SseServerInstance } from './transport/sse.server.js';
import type { RawCliOptions } from './types/index.js';

// 1. 加载本地 .env 文件环境配置
dotenv.config();

const program = new Command();

program
  .name('mcp-server-nacos')
  .description('Model Context Protocol (MCP) server for Nacos 3.0')
  .version('0.1.0')
  .option('--server-url <url>', 'Nacos 核心 OpenAPI 地址（如 http://127.0.0.1:8848/nacos）')
  .option('--console-url <url>', 'Nacos 控制台地址（如 http://127.0.0.1:8080）')
  .option('--server-addr <addr>', 'Nacos 简写地址（如 127.0.0.1:8848）')
  .option('--username <username>', 'Nacos 鉴权访问用户名')
  .option('--password <password>', 'Nacos 鉴权访问密码')
  .option('--namespace <id>', '默认租户命名空间 ID')
  .option('--timeout <ms>', 'HTTP 请求超时时间（毫秒）')
  .option('--port <port>', '网络服务端口')
  .option('--transport <mode>', '传输层协议模式 (stdio | sse)', 'stdio')
  .action(async (options: RawCliOptions) => {
    let sseApp: SseServerInstance | null = null;
    let authManager: AuthManager | null = null;
    let server: ReturnType<typeof createMcpServer> | null = null;

    try {
      // 2. 解析与强类型校验配置
      const config = parseConfig(process.env, options);

      // 3. 实例化认证中心、HTTP 客户端与 Nacos 客户端门面
      authManager = new AuthManager(config);
      const httpClient = createHttpClient(config, authManager);
      const nacosClient = new NacosClient(config, httpClient);

      // 4. 传输层适配与启动
      if (config.transport === 'stdio') {
        server = createMcpServer(config, nacosClient);
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error(
          `[mcp-server-nacos] 服务已通过 Stdio 协议成功启动，对接 Nacos 控制面: ${config.serverUrl}`
        );
      } else {
        sseApp = await startSseServer(config, nacosClient);
        console.error(
          `[mcp-server-nacos] 服务已通过 SSE 协议成功启动，监听端口: ${sseApp.port}，接入端点: http://0.0.0.0:${sseApp.port}/sse`
        );
      }

      // 5. 优雅停机信号捕获
      const shutdown = async (): Promise<void> => {
        if (sseApp) {
          await sseApp.close();
        }
        if (server) {
          await server.close();
        }
        if (authManager) {
          authManager.destroy();
        }
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[mcp-server-nacos] 启动失败: ${errorMsg}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
