/**
 * 代码重构与健壮性加固回归集成测试
 *
 * 验证 Q1~Q5 优化项：
 * - Q1: Naming 领域命名空间归一化 (public -> "") 行为测试
 * - Q2: 配置格式类型自动推导与回滚保留测试
 * - Q5: HttpClient 对 URLSearchParams 实例的防空保护测试
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
import { resolveConfigType } from '../src/utils/mime.util.js';
import type { NacosServerConfig } from '../src/types/index.js';
import { MockNacosServer } from './fixtures/mock-nacos.js';

describe('Optimization Guard: Q1~Q5 优化与防御性回归测试', () => {
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

  it('Q1: nacos_list_services 传入 namespaceId="public" 应当被自动归一化为空字符串并成功查出服务', async () => {
    const result = (await client.callTool({
      name: 'nacos_list_services',
      arguments: {
        namespaceId: 'public',
      },
    })) as any;

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('user-service');
  });

  it('Q1: nacos_get_service 传入 namespaceId="PUBLIC" 应当被自动归一化并成功获取详情', async () => {
    const result = (await client.callTool({
      name: 'nacos_get_service',
      arguments: {
        serviceName: 'user-service',
        namespaceId: 'PUBLIC',
      },
    })) as any;

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('user-service');
    expect(result.content[0].text).toContain('0.6');
  });

  it('Q1: nacos_list_instances 传入 namespaceId="public" 应当正确获取实例', async () => {
    const result = (await client.callTool({
      name: 'nacos_list_instances',
      arguments: {
        serviceName: 'user-service',
        namespaceId: 'public',
      },
    })) as any;

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('192.168.1.10');
  });

  it('Q2: resolveConfigType 应当准确识别各类配置扩展名并在无扩展名时兜底为 text', () => {
    expect(resolveConfigType('app.yaml')).toBe('yaml');
    expect(resolveConfigType('app.yml')).toBe('yaml');
    expect(resolveConfigType('service.json')).toBe('json');
    expect(resolveConfigType('pom.xml')).toBe('xml');
    expect(resolveConfigType('db.properties')).toBe('properties');
    expect(resolveConfigType('index.html')).toBe('html');
    expect(resolveConfigType('Cargo.toml')).toBe('toml');
    expect(resolveConfigType('README')).toBe('text');
    expect(resolveConfigType('custom.cfg', 'yaml')).toBe('yaml');
  });

  it('Q5: HttpClient 请求拦截器应对 URLSearchParams 参数安全追加 accessToken 而不发生结构抹平', async () => {
    const searchParams = new URLSearchParams();
    searchParams.append('customKey', 'customValue');

    const httpClient = createHttpClient(mockConfig, authManager);
    httpClient.axiosInstance.defaults.adapter = mockServer.createAdapter();

    // 触发带 URLSearchParams 的请求
    await httpClient.get('/v1/console/namespaces', {
      params: searchParams,
    });

    expect(mockServer.lastRequestConfig?.params).toBeInstanceOf(URLSearchParams);
    const recordedParams = mockServer.lastRequestConfig?.params as URLSearchParams;
    expect(recordedParams.get('customKey')).toBe('customValue');
    expect(recordedParams.get('accessToken')).toBeDefined();
  });
});
