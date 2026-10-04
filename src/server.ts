/**
 * MCP Server 实例工厂与装配入口
 *
 * @author Ateng
 * @since 2026-10-04
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NacosServerConfig } from './types/index.js';
import type { NacosClient } from './client/nacos.client.js';
import {
  registerConfigTools,
  registerNamespaceTools,
  registerNamingTools,
} from './mcp/tools.registry.js';

/**
 * 创建并配置 MCP Server 实例
 *
 * 注册各领域工具契约，暴露标准生命周期接口。
 *
 * @param config 系统运行配置
 * @param nacosClient Nacos 客户端门面
 * @return 装配完毕的 McpServer 实例
 */
export function createMcpServer(
  _config: NacosServerConfig,
  nacosClient: NacosClient
): McpServer {
  const server = new McpServer(
    {
      name: 'mcp-server-nacos',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  // 1. 注册命名空间原子工具
  registerNamespaceTools(server, nacosClient);

  // 2. 注册配置中心原子工具
  registerConfigTools(server, nacosClient);

  // 3. 注册服务发现与实例动态治理原子工具
  registerNamingTools(server, nacosClient);

  return server;
}
