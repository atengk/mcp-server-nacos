/**
 * 微服务发现与实例动态治理 MCP 协议集成测试 (Highest Testing Seam)
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

describe('Tool Dispatch Seam: 服务发现与实例双模治理集成测试', () => {
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

  it('工具清单应当正确注册 7 个服务发现、实例治理与集群运维原子工具', async () => {
    const response = await client.listTools();
    const toolNames = response.tools.map((t) => t.name);

    expect(toolNames).toContain('nacos_list_services');
    expect(toolNames).toContain('nacos_get_service');
    expect(toolNames).toContain('nacos_list_instances');
    expect(toolNames).toContain('nacos_register_instance');
    expect(toolNames).toContain('nacos_deregister_instance');
    expect(toolNames).toContain('nacos_update_instance');
    expect(toolNames).toContain('nacos_get_server_status');
  });

  it('nacos_list_services 应当能正确分页获取微服务名称列表', async () => {
    const result = (await client.callTool({
      name: 'nacos_list_services',
      arguments: {},
    })) as any;

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('user-service');
    expect(result.content[0].text).toContain('order-service');
  });

  it('nacos_get_service 应当正确获取服务级元数据与保护阈值', async () => {
    const result = (await client.callTool({
      name: 'nacos_get_service',
      arguments: {
        serviceName: 'user-service',
      },
    })) as any;

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('user-service');
    expect(result.content[0].text).toContain('0.6');
  });

  it('nacos_list_instances 应当支持 healthyOnly 过滤健康实例', async () => {
    // 1. 全量查询（包含健康与非健康）
    const allResult = (await client.callTool({
      name: 'nacos_list_instances',
      arguments: {
        serviceName: 'user-service',
        healthyOnly: false,
      },
    })) as any;

    expect(allResult.isError).toBeFalsy();
    expect(allResult.content[0].text).toContain('192.168.1.10');
    expect(allResult.content[0].text).toContain('192.168.1.11');

    // 2. 仅查健康实例
    const healthyResult = (await client.callTool({
      name: 'nacos_list_instances',
      arguments: {
        serviceName: 'user-service',
        healthyOnly: true,
      },
    })) as any;

    expect(healthyResult.isError).toBeFalsy();
    expect(healthyResult.content[0].text).toContain('192.168.1.10');
    expect(healthyResult.content[0].text).not.toContain('192.168.1.11');
  });

  it('nacos_register_instance 注册实例依据 ADR-0002 默认采用持久化模式 (ephemeral=false)', async () => {
    const result = (await client.callTool({
      name: 'nacos_register_instance',
      arguments: {
        serviceName: 'user-service',
        ip: '10.0.0.5',
        port: 8080,
        weight: 1.0,
      },
    })) as any;

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('10.0.0.5:8080');
    expect(result.content[0].text).toContain('持久化节点 (Persistent)');

    // 验证底层 mock 实例列表中属性确认 ephemeral === false
    const registered = mockServer.instances.find((i) => i.ip === '10.0.0.5');
    expect(registered).toBeDefined();
    expect(registered?.ephemeral).toBe(false);
  });

  it('nacos_register_instance 显式声明 ephemeral=true 时应成功以临时实例入库', async () => {
    const result = (await client.callTool({
      name: 'nacos_register_instance',
      arguments: {
        serviceName: 'user-service',
        ip: '10.0.0.6',
        port: 8080,
        ephemeral: true,
      },
    })) as any;

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('临时节点 (Ephemeral)');

    const registered = mockServer.instances.find((i) => i.ip === '10.0.0.6');
    expect(registered?.ephemeral).toBe(true);
  });

  it('nacos_update_instance 应当成功修改实例流量权重与下线开关', async () => {
    const result = (await client.callTool({
      name: 'nacos_update_instance',
      arguments: {
        serviceName: 'user-service',
        ip: '192.168.1.10',
        port: 8080,
        weight: 0.2,
        enabled: false,
      },
    })) as any;

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('修改成功');

    const updated = mockServer.instances.find((i) => i.ip === '192.168.1.10');
    expect(updated?.weight).toBe(0.2);
    expect(updated?.enabled).toBe(false);
  });

  it('nacos_deregister_instance 应当成功注销指定实例', async () => {
    const result = (await client.callTool({
      name: 'nacos_deregister_instance',
      arguments: {
        serviceName: 'user-service',
        ip: '192.168.1.10',
        port: 8080,
      },
    })) as any;

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('注销成功');

    const found = mockServer.instances.find((i) => i.ip === '192.168.1.10');
    expect(found).toBeUndefined();
  });

  it('nacos_get_server_status 应当成功探测 Nacos 集群节点健康度', async () => {
    const result = (await client.callTool({
      name: 'nacos_get_server_status',
      arguments: {},
    })) as any;

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('127.0.0.1:8848');
    expect(result.content[0].text).toContain('UP');
    expect(result.content[0].text).toContain('3.0.0');
  });
});
