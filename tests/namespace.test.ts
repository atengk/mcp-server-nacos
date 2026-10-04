/**
 * 命名空间 MCP 工具协议端到端集成测试 (Highest Testing Seam)
 *
 * 在 Tool Dispatch Seam 上通过模拟大模型工具调用输入，断言 MCP 响应契约与自愈行为。
 *
 * @author Ateng
 * @since 2026-10-04
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import axios from 'axios';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../src/server.js';
import { NacosClient } from '../src/client/nacos.client.js';
import { AuthManager } from '../src/client/auth.manager.js';
import { createHttpClient } from '../src/client/http.client.js';
import type { NacosServerConfig } from '../types/index.js';
import { MockNacosServer } from './fixtures/mock-nacos.js';

describe('Tool Dispatch Seam: 命名空间与认证集成测试', () => {
  let client: Client;
  let server: ReturnType<typeof createMcpServer>;
  let nacosClient: NacosClient;
  let authManager: AuthManager;
  let mockServer: MockNacosServer;
  let mockConfig: NacosServerConfig;

  beforeEach(async () => {
    mockConfig = {
      serverUrl: 'http://127.0.0.1:8848/nacos',
      consoleUrl: 'http://127.0.0.1:8080',
      username: 'nacos',
      password: 'nacos_password',
      namespaceId: '',
      timeout: 5000,
      port: 3000,
      transport: 'stdio',
    };

    mockServer = new MockNacosServer();
    const mockAdapter = mockServer.createAdapter();

    const authAxios = axios.create();
    authAxios.defaults.adapter = mockAdapter;
    authManager = new AuthManager(mockConfig, authAxios);

    const httpClient = createHttpClient(mockConfig, authManager);
    httpClient.axiosInstance.defaults.adapter = mockAdapter;

    nacosClient = new NacosClient(mockConfig, httpClient);

    server = createMcpServer(mockConfig, nacosClient);
    client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
    authManager.destroy();
  });

  it('工具清单应当正确注册 3 个命名空间原子工具', async () => {
    const response = await client.listTools();
    const toolNames = response.tools.map((t) => t.name);

    expect(toolNames).toContain('nacos_list_namespaces');
    expect(toolNames).toContain('nacos_create_namespace');
    expect(toolNames).toContain('nacos_delete_namespace');
  });

  it('nacos_list_namespaces 应当正确查询并格式化命名空间列表', async () => {
    const result = (await client.callTool({
      name: 'nacos_list_namespaces',
      arguments: {},
    })) as any;

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('public');
    expect(result.content[0].text).toContain('dev-env');
    expect(result.content[0].text).toContain('开发测试环境');
  });

  it('nacos_create_namespace 应当成功创建新命名空间', async () => {
    const result = (await client.callTool({
      name: 'nacos_create_namespace',
      arguments: {
        namespaceId: 'prod-cluster',
        namespaceName: '生产隔离区',
        namespaceDesc: '核心生产集群命名空间',
      },
    })) as any;

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('prod-cluster');
    expect(result.content[0].text).toContain('成功');

    // 验证 mock 服务器状态已更新
    const found = mockServer.namespaces.find((ns) => ns.namespace === 'prod-cluster');
    expect(found).toBeDefined();
    expect(found?.namespaceShowName).toBe('生产隔离区');
  });

  it('nacos_create_namespace 尝试创建 public 命名空间时应被防御拦截', async () => {
    const result = (await client.callTool({
      name: 'nacos_create_namespace',
      arguments: {
        namespaceId: 'public',
        namespaceName: '公共空间',
      },
    })) as any;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('公共命名空间 (public) 为系统内置保留空间');
  });

  it('nacos_delete_namespace 应当成功删除指定自定义命名空间', async () => {
    const result = (await client.callTool({
      name: 'nacos_delete_namespace',
      arguments: {
        namespaceId: 'dev-env',
      },
    })) as any;

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('dev-env');
    expect(result.content[0].text).toContain('成功');

    const found = mockServer.namespaces.find((ns) => ns.namespace === 'dev-env');
    expect(found).toBeUndefined();
  });

  it('nacos_delete_namespace 尝试删除 public 命名空间时应被防御拦截', async () => {
    const result = (await client.callTool({
      name: 'nacos_delete_namespace',
      arguments: {
        namespaceId: 'public',
      },
    })) as any;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('公共命名空间 (public) 为系统保留空间，严禁删除');
  });

  it('遭遇 401 鉴权失效时应当在工具调用过程中透明自愈并成功执行', async () => {
    // 模拟首次请求遇到 401，拦截器自动重新获取 Token 后回放
    mockServer.authFailuresRemaining = 1;

    const result = (await client.callTool({
      name: 'nacos_list_namespaces',
      arguments: {},
    })) as any;

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('dev-env');
    expect(mockServer.authFailuresRemaining).toBe(0);
  });

  it('当网络异常或 Nacos 超时时工具调用应优雅返回结构化错误而非导致进程崩溃', async () => {
    mockServer.options.simulateTimeout = true;

    const result = (await client.callTool({
      name: 'nacos_list_namespaces',
      arguments: {},
    })) as any;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Nacos 集群节点连接超时');
  });
});
