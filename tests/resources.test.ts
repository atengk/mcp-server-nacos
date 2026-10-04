/**
 * MCP Resources 动态配置协议集成测试 (Highest Testing Seam)
 *
 * 验证 nacos://config/{namespaceId}/{group}/{dataId} 资源协议路由、
 * 扩展名 MIME 类型自动推导与配置快照挂载。
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

describe('Resource Seam: nacos://config 动态配置协议测试', () => {
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

  it('应当成功注册 nacos://config/{namespaceId}/{group}/{dataId} 资源模板', async () => {
    const response = await client.listResourceTemplates();
    const templatePatterns = response.resourceTemplates.map((t) => t.uriTemplate);

    expect(templatePatterns).toContain('nacos://config/{namespaceId}/{group}/{dataId}');
  });

  it('读取 YAML 配置资源应当正确返回内容并推导 MIME 类型为 application/yaml', async () => {
    const result = await client.readResource({
      uri: 'nacos://config/public/DEFAULT_GROUP/application.yaml',
    });

    expect(result.contents).toHaveLength(1);
    const content = result.contents[0] as any;
    expect(content.uri).toBe('nacos://config/public/DEFAULT_GROUP/application.yaml');
    expect(content.mimeType).toBe('application/yaml');
    expect(content.text).toContain('server:\n  port: 8080');
    expect(content.text).toContain('demo-app');
  });

  it('读取 JSON 配置资源应当正确返回内容并推导 MIME 类型为 application/json', async () => {
    const result = await client.readResource({
      uri: 'nacos://config/public/DEFAULT_GROUP/user-service.json',
    });

    expect(result.contents).toHaveLength(1);
    const content = result.contents[0] as any;
    expect(content.mimeType).toBe('application/json');
    expect(content.text).toContain('"serviceName": "user-service"');
  });

  it('读取自定义命名空间下的配置资源应当正确传递 tenant 标识', async () => {
    const result = await client.readResource({
      uri: 'nacos://config/dev-env/GATEWAY_GROUP/dev-gateway.yaml',
    });

    expect(result.contents).toHaveLength(1);
    const content = result.contents[0] as any;
    expect(content.mimeType).toBe('application/yaml');
    expect(content.text).toContain('lb://user-service');
  });

  it('读取不存在的配置资源应当抛出错误提示', async () => {
    await expect(
      client.readResource({
        uri: 'nacos://config/public/DEFAULT_GROUP/not-exist.yaml',
      })
    ).rejects.toThrow();
  });
});
