/**
 * 配置历史审计与原子化一键回滚 MCP 集成测试 (Highest Testing Seam)
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

describe('Tool Dispatch Seam: 配置历史与原子回滚集成测试', () => {
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

  it('工具清单应当正确注册历史查询与原子回滚原子工具', async () => {
    const response = await client.listTools();
    const toolNames = response.tools.map((t) => t.name);

    expect(toolNames).toContain('nacos_get_config_history');
    expect(toolNames).toContain('nacos_rollback_config');
  });

  it('nacos_get_config_history 应当成功拉取历史版本快照列表与修订元数据', async () => {
    const result = (await client.callTool({
      name: 'nacos_get_config_history',
      arguments: {
        dataId: 'application.yaml',
        group: 'DEFAULT_GROUP',
        namespaceId: 'public',
      },
    })) as any;

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('application.yaml');
    expect(result.content[0].text).toContain('101');
    expect(result.content[0].text).toContain('102');
    expect(result.content[0].text).toContain('nacos');
  });

  it('nacos_rollback_config 应当基于 historyId 提取历史全文并原子发布恢复配置', async () => {
    // 初始状态下 application.yaml 端口是 8080
    const beforeResult = (await client.callTool({
      name: 'nacos_get_config',
      arguments: {
        dataId: 'application.yaml',
      },
    })) as any;
    expect(beforeResult.content[0].text).toContain('8080');

    // 执行回滚至快照 101（内容为 port: 8079）
    const rollbackResult = (await client.callTool({
      name: 'nacos_rollback_config',
      arguments: {
        dataId: 'application.yaml',
        group: 'DEFAULT_GROUP',
        historyId: '101',
      },
    })) as any;

    expect(rollbackResult.isError).toBeFalsy();
    expect(rollbackResult.content[0].text).toContain('回滚成功');
    expect(rollbackResult.content[0].text).toContain('101');

    // 验证当前生效配置已被原子更新为 101 的内容 (8079)
    const afterResult = (await client.callTool({
      name: 'nacos_get_config',
      arguments: {
        dataId: 'application.yaml',
      },
    })) as any;
    expect(afterResult.content[0].text).toContain('8079');
  });

  it('nacos_rollback_config 面对不存在的历史版本快照应当优雅返回结构化错误', async () => {
    const result = (await client.callTool({
      name: 'nacos_rollback_config',
      arguments: {
        dataId: 'application.yaml',
        historyId: '999999',
      },
    })) as any;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('历史版本快照不存在');
  });
});
