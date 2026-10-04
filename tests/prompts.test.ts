/**
 * MCP Prompts 交互式运维模板集成测试 (Highest Testing Seam)
 *
 * 验证 nacos_service_inspection（微服务拓扑与异常节点体检）与
 * nacos_config_drift_check（配置漂移与 Unified Git Diff 比对）模板。
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
import type { NacosServerConfig } from '../src/types/index.js';
import { MockNacosServer } from './fixtures/mock-nacos.js';

describe('Prompt Seam: Nacos 交互式运维 Prompts 测试', () => {
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

  it('应当正确注册 nacos_service_inspection 与 nacos_config_drift_check 两个运维模板', async () => {
    const response = await client.listPrompts();
    const promptNames = response.prompts.map((p) => p.name);

    expect(promptNames).toContain('nacos_service_inspection');
    expect(promptNames).toContain('nacos_config_drift_check');
  });

  it('nacos_service_inspection 应当生成涵盖服务拓扑、健康实例与异常节点的体检 Prompt', async () => {
    const result = await client.getPrompt({
      name: 'nacos_service_inspection',
      arguments: {},
    });

    expect(result.messages).toHaveLength(1);
    const message = result.messages[0];
    expect(message.role).toBe('user');

    const promptText = (message.content as any).text as string;
    expect(promptText).toContain('user-service');
    expect(promptText).toContain('order-service');
    // 包含健康与异常实例标识
    expect(promptText).toContain('192.168.1.10');
    expect(promptText).toContain('192.168.1.11');
    expect(promptText).toContain('异常');
    // 包含指导模型输出体检结论与修复建议的指令
    expect(promptText).toContain('微服务架构健康度与拓扑体检');
  });

  it('nacos_config_drift_check 应当根据指定 historyId 生成包含 Unified Git Diff 的漂移比对 Prompt', async () => {
    const result = await client.getPrompt({
      name: 'nacos_config_drift_check',
      arguments: {
        dataId: 'application.yaml',
        historyId: '101',
      },
    });

    expect(result.messages).toHaveLength(1);
    const message = result.messages[0];
    expect(message.role).toBe('user');

    const promptText = (message.content as any).text as string;
    expect(promptText).toContain('application.yaml');
    expect(promptText).toContain('配置漂移比对');
    // 验证 Git Diff 内容
    expect(promptText).toContain('---');
    expect(promptText).toContain('+++');
    expect(promptText).toContain('-  port: 8079');
    expect(promptText).toContain('+  port: 8080');
    // 验证包含模型引导评估指令
    expect(promptText).toContain('漂移风险评估');
  });

  it('nacos_config_drift_check 未指定 historyId 时应当自动获取最近历史版本进行比对', async () => {
    const result = await client.getPrompt({
      name: 'nacos_config_drift_check',
      arguments: {
        dataId: 'application.yaml',
      },
    });

    expect(result.messages).toHaveLength(1);
    const message = result.messages[0];
    const promptText = (message.content as any).text as string;
    expect(promptText).toContain('application.yaml');
    expect(promptText).toContain('配置漂移比对');
  });
});
