/**
 * MCP SSE (Server-Sent Events) 双模传输服务实现
 *
 * 提供基于 HTTP 的标准 SSE 流式接入通道与 POST 消息收发端点，
 * 支持云端部署、Dify、FastGPT 及多智能体平台接入。
 *
 * @author Ateng
 * @since 2026-10-04
 */

import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NacosServerConfig } from '../types/index.js';
import type { NacosClient } from '../client/nacos.client.js';
import { createMcpServer } from '../server.js';

export interface SseServerInstance {
  server: http.Server;
  port: number;
  close: () => Promise<void>;
}

interface SseSession {
  transport: SSEServerTransport;
  server: McpServer;
}

/**
 * 注入标准 CORS 跨域安全响应头
 *
 * @param res HTTP 响应对象
 */
function setCorsHeaders(res: http.ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Accept, X-Requested-With'
  );
}

/**
 * 启动并运行 MCP SSE HTTP 传输服务
 *
 * @param config 系统运行配置
 * @param nacosClient Nacos 核心客户端门面
 * @return 运行中的 SSE 实例与关闭句柄
 */
export async function startSseServer(
  config: NacosServerConfig,
  nacosClient: NacosClient
): Promise<SseServerInstance> {
  const sessions = new Map<string, SseSession>();

  const httpServer = http.createServer(async (req, res) => {
    const host = req.headers.host || `127.0.0.1:${config.port || 3000}`;
    const url = new URL(req.url || '/', `http://${host}`);
    const pathname = url.pathname;

    // 1. 处理 OPTIONS 跨域预检请求
    if (req.method === 'OPTIONS') {
      setCorsHeaders(res);
      res.writeHead(204);
      res.end();
      return;
    }

    // 2. 健康检查与状态探针端点: GET /health 或 GET /
    if (req.method === 'GET' && (pathname === '/health' || pathname === '/')) {
      setCorsHeaders(res);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'UP',
          service: 'mcp-server-nacos',
          version: '0.1.0',
          transport: 'sse',
          activeSessions: sessions.size,
          nacosServer: config.serverUrl,
        })
      );
      return;
    }

    // 3. 建立 SSE 流式连接端点: GET /sse
    if (req.method === 'GET' && pathname === '/sse') {
      setCorsHeaders(res);

      const server = createMcpServer(config, nacosClient);
      const transport = new SSEServerTransport('/message', res);

      const session: SseSession = { transport, server };
      sessions.set(transport.sessionId, session);

      transport.onclose = () => {
        sessions.delete(transport.sessionId);
      };

      // connect 内部会自动调用 transport.start()
      await server.connect(transport);
      return;
    }

    // 4. 接收客户端发送指令与请求端点: POST /message
    if (req.method === 'POST' && pathname === '/message') {
      setCorsHeaders(res);

      const sessionId = url.searchParams.get('sessionId');
      const session = sessionId ? sessions.get(sessionId) : undefined;

      if (!session) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'Session not found or expired',
            sessionId: sessionId || null,
          })
        );
        return;
      }

      await session.transport.handlePostMessage(req, res);
      return;
    }

    // 5. 兜底 404 路由
    setCorsHeaders(res);
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Not Found: ${req.method} ${pathname}` }));
  });

  const targetPort = config.port ?? 3000;

  await new Promise<void>((resolve, reject) => {
    httpServer.listen(targetPort, '0.0.0.0', () => resolve());
    httpServer.on('error', reject);
  });

  const actualPort = (httpServer.address() as AddressInfo).port;

  const close = async (): Promise<void> => {
    // 1. 关闭所有活跃 SSE 传输会话
    for (const [id, session] of sessions.entries()) {
      try {
        await session.transport.close();
      } catch {
        // 忽略已关闭连接异常
      }
      sessions.delete(id);
    }

    // 2. 关闭 HTTP 监听服务
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  };

  return {
    server: httpServer,
    port: actualPort,
    close,
  };
}
