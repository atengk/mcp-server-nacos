/**
 * 配置中心核心生命周期与语法守卫 MCP 协议集成测试 (Highest Testing Seam)
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

describe('Tool Dispatch Seam: 配置中心与语法守卫集成测试', () => {
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

  it('工具清单应当正确注册 4 个配置中心原子工具', async () => {
    const response = await client.listTools();
    const toolNames = response.tools.map((t) => t.name);

    expect(toolNames).toContain('nacos_get_config');
    expect(toolNames).toContain('nacos_publish_config');
    expect(toolNames).toContain('nacos_delete_config');
    expect(toolNames).toContain('nacos_list_configs');
  });

  it('nacos_get_config 应当能正确获取普通配置全文并静默归一化 public 命名空间', async () => {
    const result = (await client.callTool({
      name: 'nacos_get_config',
      arguments: {
        dataId: 'application.yaml',
        group: 'DEFAULT_GROUP',
        namespaceId: 'public', // 测试静默归一化
      },
    })) as any;

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('demo-app');
    expect(result.content[0].text).toContain('server:');
  });

  it('nacos_get_config 当配置项不存在时应当返回语义化错误描述', async () => {
    const result = (await client.callTool({
      name: 'nacos_get_config',
      arguments: {
        dataId: 'non-existent.yaml',
      },
    })) as any;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('配置项不存在');
  });

  it('nacos_get_config 面对超长配置 (>30,000 字符) 应当自动截断并给出按行切片参数提示', async () => {
    // 注入超大配置项
    const bigLines = Array.from({ length: 1200 }, (_, i) => `dubbo.service.provider.method.${i}=callValue-${i}`);
    mockServer.configs.push({
      dataId: 'big-service.properties',
      group: 'DEFAULT_GROUP',
      tenant: '',
      content: bigLines.join('\n'),
      type: 'properties',
    });

    const result = (await client.callTool({
      name: 'nacos_get_config',
      arguments: {
        dataId: 'big-service.properties',
      },
    })) as any;

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('超长配置已启用大模型安全保护');
    expect(result.content[0].text).toContain('startLine');
    expect(result.content[0].text).toContain('endLine');
  });

  it('nacos_get_config 显式传入 startLine 与 endLine 时应当按行精准切片', async () => {
    const lines = Array.from({ length: 60 }, (_, i) => `config.line.${i + 1}=val-${i + 1}`);
    mockServer.configs.push({
      dataId: 'sliced-service.properties',
      group: 'DEFAULT_GROUP',
      tenant: '',
      content: lines.join('\n'),
      type: 'properties',
    });

    const result = (await client.callTool({
      name: 'nacos_get_config',
      arguments: {
        dataId: 'sliced-service.properties',
        startLine: 10,
        endLine: 15,
      },
    })) as any;

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('config.line.10=val-10');
    expect(result.content[0].text).toContain('config.line.15=val-15');
    expect(result.content[0].text).not.toContain('config.line.16');
  });

  it('nacos_publish_config 应当成功发布合法的 YAML 配置', async () => {
    const yamlContent = 'logging:\n  level:\n    root: INFO';
    const result = (await client.callTool({
      name: 'nacos_publish_config',
      arguments: {
        dataId: 'logger.yaml',
        group: 'DEFAULT_GROUP',
        content: yamlContent,
        type: 'yaml',
        desc: '日志配置',
      },
    })) as any;

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('logger.yaml');
    expect(result.content[0].text).toContain('成功');

    const published = mockServer.configs.find((c) => c.dataId === 'logger.yaml');
    expect(published).toBeDefined();
    expect(published?.content).toBe(yamlContent);
  });

  it('nacos_publish_config 当 JSON 语法畸形时应当被客户端守卫就地拦截，不发起 Nacos 请求', async () => {
    const initialConfigCount = mockServer.configs.length;
    const badJson = '{\n  "name": "faulty",\n  "version": \n}';

    const result = (await client.callTool({
      name: 'nacos_publish_config',
      arguments: {
        dataId: 'faulty.json',
        content: badJson,
        type: 'json',
      },
    })) as any;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('[语法安全守卫] JSON 语法校验失败');
    expect(mockServer.configs.length).toBe(initialConfigCount);
  });

  it('nacos_publish_config 当 YAML 缩进错误时应当被客户端守卫就地拦截，不发起 Nacos 请求', async () => {
    const initialConfigCount = mockServer.configs.length;
    const badYaml = 'root:\n  child: 1\n bad_indent: 2';

    const result = (await client.callTool({
      name: 'nacos_publish_config',
      arguments: {
        dataId: 'faulty.yaml',
        content: badYaml,
        type: 'yaml',
      },
    })) as any;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('[语法安全守卫] YAML 语法校验失败');
    expect(mockServer.configs.length).toBe(initialConfigCount);
  });

  it('nacos_delete_config 应当成功删除指定配置', async () => {
    const result = (await client.callTool({
      name: 'nacos_delete_config',
      arguments: {
        dataId: 'user-service.json',
        group: 'DEFAULT_GROUP',
        namespaceId: 'public',
      },
    })) as any;

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('user-service.json');
    expect(result.content[0].text).toContain('成功');

    const found = mockServer.configs.find((c) => c.dataId === 'user-service.json');
    expect(found).toBeUndefined();
  });

  it('nacos_list_configs 应当支持分页模糊搜索并输出结构化列表', async () => {
    const result = (await client.callTool({
      name: 'nacos_list_configs',
      arguments: {
        dataId: 'application',
      },
    })) as any;

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('application.yaml');
    expect(result.content[0].text).toContain('DEFAULT_GROUP');
  });
});
