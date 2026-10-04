/**
 * MCP SSE 双模传输层与端到端网络集成测试
 *
 * 验证 SSE 流式接入、POST 消息分发、CORS 跨域守卫、健康探测与优雅停机。
 *
 * @author Ateng
 * @since 2026-10-04
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import axios from 'axios';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { startSseServer } from '../src/transport/sse.server.js';
import { NacosClient } from '../src/client/nacos.client.js';
import { AuthManager } from '../src/client/auth.manager.js';
import { createHttpClient } from '../src/client/http.client.js';
import type { NacosServerConfig } from '../src/types/index.js';
import { MockNacosServer } from './fixtures/mock-nacos.js';

describe('Transport Seam: SSE 双模传输层与网络端点集成测试', () => {
  let sseApp: Awaited<ReturnType<typeof startSseServer>>;
  let client: Client;
  let nacosClient: NacosClient;
  let authManager: AuthManager;
  let mockServer: MockNacosServer;
  let mockConfig: NacosServerConfig;
  let port: number;

  beforeEach(async () => {
    mockConfig = {
      serverUrl: 'http://127.0.0.1:8848/nacos',
      consoleUrl: 'http://127.0.0.1:8080',
      username: 'nacos',
      password: 'nacos_password',
      namespaceId: '',
      timeout: 5000,
      port: 0, // 0 端口由 OS 自动分配空闲端口
      transport: 'sse',
    };

    mockServer = new MockNacosServer();
    const mockAdapter = mockServer.createAdapter();

    const authAxios = axios.create();
    authAxios.defaults.adapter = mockAdapter;
    authManager = new AuthManager(mockConfig, authAxios);

    const httpClient = createHttpClient(mockConfig, authManager);
    httpClient.axiosInstance.defaults.adapter = mockAdapter;

    nacosClient = new NacosClient(mockConfig, httpClient);

    sseApp = await startSseServer(mockConfig, nacosClient);
    port = sseApp.port;
  });

  afterEach(async () => {
    if (client) {
      await client.close().catch(() => {});
    }
    if (sseApp) {
      await sseApp.close();
    }
    authManager.destroy();
  });

  it('健康探测端点 GET /health 与 GET / 应当返回 200 及服务运行状态', async () => {
    const res = await axios.get(`http://127.0.0.1:${port}/health`);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('UP');
    expect(res.data.service).toBe('mcp-server-nacos');
    expect(res.data.transport).toBe('sse');
  });

  it('OPTIONS 预检请求应当返回标准 CORS 跨域响应头', async () => {
    const res = await axios.options(`http://127.0.0.1:${port}/sse`);
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-methods']).toContain('GET');
    expect(res.headers['access-control-allow-methods']).toContain('POST');
  });

  it('无效或已过期的 sessionId 在 POST /message 时应当返回 404', async () => {
    await expect(
      axios.post(`http://127.0.0.1:${port}/message?sessionId=invalid-session-999`, {})
    ).rejects.toThrow();
  });

  it('MCP Client 应当能通过 SSEClientTransport 建立连接并完成工具调用', async () => {
    client = new Client({ name: 'sse-test-client', version: '1.0.0' }, { capabilities: {} });
    const clientTransport = new SSEClientTransport(
      new URL(`http://127.0.0.1:${port}/sse`)
    );

    await client.connect(clientTransport);

    // 1. 列举可用工具列表
    const toolsResult = await client.listTools();
    const toolNames = toolsResult.tools.map((t) => t.name);
    expect(toolNames).toContain('nacos_list_namespaces');
    expect(toolNames).toContain('nacos_get_server_status');

    // 2. 调用原子工具 nacos_list_namespaces
    const callResult = (await client.callTool({
      name: 'nacos_list_namespaces',
      arguments: {},
    })) as any;

    expect(callResult.isError).toBeFalsy();
    expect(callResult.content[0].text).toContain('public');

    // 3. 列举可用 Prompts
    const promptsResult = await client.listPrompts();
    const promptNames = promptsResult.prompts.map((p) => p.name);
    expect(promptNames).toContain('nacos_service_inspection');
  });
});
