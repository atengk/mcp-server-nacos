/**
 * MCP 工具注册中心与路由分发
 *
 * 声明各领域原子工具契约、Zod 强类型入参校验与异常兜底收敛。
 *
 * @author Ateng
 * @since 2026-10-04
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { NacosClient } from '../client/nacos.client.js';
import { NamespaceHandler } from '../handlers/namespace.handler.js';
import { ConfigHandler } from '../handlers/config.handler.js';
import { NamingHandler } from '../handlers/naming.handler.js';

/**
 * 统一执行工具业务逻辑并收敛结构化异常 (DRY 辅助函数)
 *
 * @param actionName 操作业务名称（如 "命名空间列表查询"）
 * @param handler 业务执行回调
 * @return MCP 统一响应格式
 */
async function safeToolCall(
  actionName: string,
  handler: () => Promise<string>
): Promise<CallToolResult> {
  try {
    const text = await handler();
    return {
      content: [
        {
          type: 'text',
          text,
        },
      ],
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `[${actionName}失败]: ${errorMsg}`,
        },
      ],
    };
  }
}

/**
 * 注册命名空间领域相关的 MCP 工具
 *
 * @param server MCP 服务端实例
 * @param nacosClient Nacos 客户端门面
 */
export function registerNamespaceTools(
  server: McpServer,
  nacosClient: NacosClient
): void {
  // 1. nacos_list_namespaces: 查询全量命名空间
  server.tool(
    'nacos_list_namespaces',
    '查询 Nacos 集群所有命名空间列表及隔离元数据',
    {},
    () => safeToolCall('命名空间列表查询', () => NamespaceHandler.listNamespaces(nacosClient))
  );

  // 2. nacos_create_namespace: 创建自定义命名空间
  server.tool(
    'nacos_create_namespace',
    '在 Nacos 中创建新的命名空间隔离环境（支持指定命名空间 ID、名称与描述）',
    {
      namespaceId: z
        .string()
        .describe('命名空间租户唯一标识符 (Tenant ID)，不可使用保留关键字 public'),
      namespaceName: z.string().describe('命名空间显示名称'),
      namespaceDesc: z.string().optional().describe('命名空间业务用途描述信息'),
    },
    (args) =>
      safeToolCall('命名空间创建', () => NamespaceHandler.createNamespace(nacosClient, args))
  );

  // 3. nacos_delete_namespace: 删除指定命名空间
  server.tool(
    'nacos_delete_namespace',
    '删除 Nacos 中指定的命名空间（公共命名空间 public 受保护不可删除）',
    {
      namespaceId: z.string().describe('待删除的命名空间 Tenant ID'),
    },
    (args) =>
      safeToolCall('命名空间删除', () => NamespaceHandler.deleteNamespace(nacosClient, args))
  );
}

/**
 * 注册配置中心领域相关的 MCP 工具
 *
 * @param server MCP 服务端实例
 * @param nacosClient Nacos 客户端门面
 */
export function registerConfigTools(
  server: McpServer,
  nacosClient: NacosClient
): void {
  // 1. nacos_get_config: 读取配置项内容
  server.tool(
    'nacos_get_config',
    '获取 Nacos 配置项全文内容，支持超长文本智能截断与按行切片精准读取',
    {
      dataId: z.string().describe('配置集 ID (Data ID)'),
      group: z
        .string()
        .optional()
        .default('DEFAULT_GROUP')
        .describe('配置分组 (Group)，默认 DEFAULT_GROUP'),
      namespaceId: z
        .string()
        .optional()
        .describe('命名空间 Tenant ID，留空或 public 为公共空间'),
      startLine: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('切片起始行号（从 1 开始，用于大文本分块读取）'),
      endLine: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('切片结束行号（闭区间，必须大于等于起始行）'),
    },
    (args) => safeToolCall('配置读取', () => ConfigHandler.getConfig(nacosClient, args))
  );

  // 2. nacos_publish_config: 发布或更新配置项
  server.tool(
    'nacos_publish_config',
    '发布或更新 Nacos 配置项内容（内置 JSON/YAML 语法格式合法性前置拦截校验）',
    {
      dataId: z.string().describe('目标配置集 ID (Data ID)'),
      group: z
        .string()
        .optional()
        .default('DEFAULT_GROUP')
        .describe('配置分组 (Group)，默认 DEFAULT_GROUP'),
      namespaceId: z
        .string()
        .optional()
        .describe('命名空间 Tenant ID，留空或 public 为公共空间'),
      content: z.string().describe('待发布的配置内容全文'),
      type: z
        .enum(['text', 'json', 'xml', 'yaml', 'html', 'properties', 'toml'])
        .optional()
        .describe('配置格式类型（支持 text/json/xml/yaml/html/properties/toml）'),
      desc: z.string().optional().describe('配置描述信息'),
      appName: z.string().optional().describe('所属应用名称 (App Name)'),
    },
    (args) =>
      safeToolCall('配置发布', () => ConfigHandler.publishConfig(nacosClient, args))
  );

  // 3. nacos_delete_config: 删除配置项
  server.tool(
    'nacos_delete_config',
    '删除 Nacos 中指定的配置项',
    {
      dataId: z.string().describe('待删除的配置集 ID (Data ID)'),
      group: z
        .string()
        .optional()
        .default('DEFAULT_GROUP')
        .describe('配置分组 (Group)，默认 DEFAULT_GROUP'),
      namespaceId: z
        .string()
        .optional()
        .describe('命名空间 Tenant ID，留空或 public 为公共空间'),
    },
    (args) => safeToolCall('配置删除', () => ConfigHandler.deleteConfig(nacosClient, args))
  );

  // 4. nacos_list_configs: 分页模糊搜索配置集
  server.tool(
    'nacos_list_configs',
    '分页模糊搜索配置集列表（支持按 Data ID 或 Group 模糊匹配）',
    {
      dataId: z.string().optional().describe('配置集 ID 模糊匹配关键字'),
      group: z.string().optional().describe('配置分组模糊匹配关键字'),
      appName: z.string().optional().describe('应用名称模糊匹配关键字'),
      namespaceId: z
        .string()
        .optional()
        .describe('命名空间 Tenant ID，留空或 public 为公共空间'),
      pageNo: z.number().int().positive().optional().describe('分页查询页码，默认 1'),
      pageSize: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('每页查询数量，默认 20，上限 100'),
    },
    (args) =>
      safeToolCall('配置列表检索', () => ConfigHandler.listConfigs(nacosClient, args))
  );

  // 5. nacos_get_config_history: 查询历史版本清单
  server.tool(
    'nacos_get_config_history',
    '分页查询特定配置项的历史修改版本清单与审计快照元数据',
    {
      dataId: z.string().describe('目标配置集 ID (Data ID)'),
      group: z
        .string()
        .optional()
        .default('DEFAULT_GROUP')
        .describe('配置分组 (Group)，默认 DEFAULT_GROUP'),
      namespaceId: z
        .string()
        .optional()
        .describe('命名空间 Tenant ID，留空或 public 为公共空间'),
      pageNo: z.number().int().positive().optional().describe('分页查询页码，默认 1'),
      pageSize: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('每页查询数量，默认 20，上限 100'),
    },
    (args) =>
      safeToolCall('配置历史查询', () =>
        ConfigHandler.getConfigHistory(nacosClient, args)
      )
  );

  // 6. nacos_rollback_config: 原子化一键回滚配置
  server.tool(
    'nacos_rollback_config',
    '依据历史快照 ID (historyId) 原子化回滚配置至指定历史版本（自动提取历史快照全文覆盖发布，免去模型长文本搬运风险）',
    {
      dataId: z.string().describe('目标配置集 ID (Data ID)'),
      group: z
        .string()
        .optional()
        .default('DEFAULT_GROUP')
        .describe('配置分组 (Group)，默认 DEFAULT_GROUP'),
      namespaceId: z
        .string()
        .optional()
        .describe('命名空间 Tenant ID，留空或 public 为公共空间'),
      historyId: z
        .union([z.string(), z.number()])
        .describe('目标历史快照唯一标识符 (historyId / nid)'),
    },
    (args) =>
      safeToolCall('配置回滚', () => ConfigHandler.rollbackConfig(nacosClient, args))
  );
}

/**
 * 注册微服务发现与实例动态治理相关的 MCP 工具
 *
 * @param server MCP 服务端实例
 * @param nacosClient Nacos 客户端门面
 */
export function registerNamingTools(
  server: McpServer,
  nacosClient: NacosClient
): void {
  // 1. nacos_list_services: 分页查询微服务列表
  server.tool(
    'nacos_list_services',
    '分页查询 Nacos 微服务列表及服务名称',
    {
      groupName: z
        .string()
        .optional()
        .describe('微服务分组名称 (Group)，默认 DEFAULT_GROUP'),
      namespaceId: z
        .string()
        .optional()
        .describe('命名空间 Tenant ID，留空或 public 为公共空间'),
      pageNo: z.number().int().positive().optional().describe('分页查询页码，默认 1'),
      pageSize: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('每页查询数量，默认 20，上限 100'),
    },
    (args) =>
      safeToolCall('服务列表查询', () => NamingHandler.listServices(nacosClient, args))
  );

  // 2. nacos_get_service: 获取微服务详情与保护阈值
  server.tool(
    'nacos_get_service',
    '查询指定微服务的元数据配置、保护阈值 (protectThreshold) 及集群元数据',
    {
      serviceName: z.string().describe('微服务名称 (Service Name)'),
      groupName: z
        .string()
        .optional()
        .describe('所属分组名称，默认 DEFAULT_GROUP'),
      namespaceId: z
        .string()
        .optional()
        .describe('命名空间 Tenant ID，留空或 public 为公共空间'),
    },
    (args) =>
      safeToolCall('微服务详情查询', () => NamingHandler.getService(nacosClient, args))
  );

  // 3. nacos_list_instances: 查询注册实例列表
  server.tool(
    'nacos_list_instances',
    '查询微服务下注册的实例列表，支持按健康状态过滤',
    {
      serviceName: z.string().describe('微服务名称 (Service Name)'),
      groupName: z
        .string()
        .optional()
        .describe('所属分组名称，默认 DEFAULT_GROUP'),
      namespaceId: z
        .string()
        .optional()
        .describe('命名空间 Tenant ID，留空或 public 为公共空间'),
      healthyOnly: z
        .boolean()
        .optional()
        .describe('是否仅返回健康实例（true: 仅健康节点; false: 返回全部节点，默认 false）'),
      clusters: z
        .string()
        .optional()
        .describe('集群名称列表（多个以逗号分割，如 DEFAULT）'),
    },
    (args) =>
      safeToolCall('服务实例查询', () =>
        NamingHandler.listInstances(nacosClient, args)
      )
  );

  // 4. nacos_register_instance: 注册实例（默认持久化）
  server.tool(
    'nacos_register_instance',
    '向微服务注册新实例（遵循 ADR-0002 规范，默认采用持久化模式 ephemeral=false，可显式声明为临时节点）',
    {
      serviceName: z.string().describe('目标微服务名称 (Service Name)'),
      ip: z.string().describe('实例 IP 地址（如 192.168.1.10）'),
      port: z.number().int().min(1).max(65535).describe('实例监听端口号'),
      groupName: z
        .string()
        .optional()
        .describe('微服务分组，默认 DEFAULT_GROUP'),
      namespaceId: z
        .string()
        .optional()
        .describe('命名空间 Tenant ID，留空或 public 为公共空间'),
      weight: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe('负载均衡权重，取值范围 0.0 ~ 1.0，默认 1.0'),
      enabled: z
        .boolean()
        .optional()
        .describe('是否接受流量调用（true: 启用; false: 隔离下线，默认 true）'),
      healthy: z
        .boolean()
        .optional()
        .describe('实例初始健康度（默认 true）'),
      ephemeral: z
        .boolean()
        .optional()
        .describe('是否为临时节点（根据 ADR-0002 规定默认 false 为持久化节点；若为客户端自注册可显式传 true）'),
      clusterName: z
        .string()
        .optional()
        .describe('集群名称，默认 DEFAULT'),
      metadata: z
        .record(z.string(), z.string())
        .optional()
        .describe('实例自定义扩展元数据键值对 (Key-Value)'),
    },
    (args) =>
      safeToolCall('服务实例注册', () =>
        NamingHandler.registerInstance(nacosClient, args)
      )
  );

  // 5. nacos_deregister_instance: 手动注销实例
  server.tool(
    'nacos_deregister_instance',
    '从微服务中手动注销下线指定的实例节点',
    {
      serviceName: z.string().describe('微服务名称 (Service Name)'),
      ip: z.string().describe('待注销实例的 IP 地址'),
      port: z.number().int().min(1).max(65535).describe('待注销实例的端口号'),
      groupName: z
        .string()
        .optional()
        .describe('微服务分组，默认 DEFAULT_GROUP'),
      namespaceId: z
        .string()
        .optional()
        .describe('命名空间 Tenant ID，留空或 public 为公共空间'),
      clusterName: z
        .string()
        .optional()
        .describe('集群名称，默认 DEFAULT'),
      ephemeral: z
        .boolean()
        .optional()
        .describe('实例是否为临时节点（持久化实例注销传 false 或留空）'),
    },
    (args) =>
      safeToolCall('服务实例注销', () =>
        NamingHandler.deregisterInstance(nacosClient, args)
      )
  );

  // 6. nacos_update_instance: 动态调节权重与上下线
  server.tool(
    'nacos_update_instance',
    '动态更新微服务实例状态（调整流量权重 0.0~1.0、在线/隔离下线开关 enabled、元数据）',
    {
      serviceName: z.string().describe('微服务名称 (Service Name)'),
      ip: z.string().describe('目标实例 IP 地址'),
      port: z.number().int().min(1).max(65535).describe('目标实例端口号'),
      groupName: z
        .string()
        .optional()
        .describe('微服务分组，默认 DEFAULT_GROUP'),
      namespaceId: z
        .string()
        .optional()
        .describe('命名空间 Tenant ID，留空或 public 为公共空间'),
      weight: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe('新权重值，取值范围 0.0 ~ 1.0'),
      enabled: z
        .boolean()
        .optional()
        .describe('是否接受流量调用（true: 启用上线; false: 隔离下线）'),
      clusterName: z
        .string()
        .optional()
        .describe('集群名称，默认 DEFAULT'),
      metadata: z
        .record(z.string(), z.string())
        .optional()
        .describe('更新或覆盖的实例扩展元数据'),
      ephemeral: z
        .boolean()
        .optional()
        .describe('实例是否为临时节点'),
    },
    (args) =>
      safeToolCall('服务实例更新', () =>
        NamingHandler.updateInstance(nacosClient, args)
      )
  );

  // 7. nacos_get_server_status: 探测集群节点状态
  server.tool(
    'nacos_get_server_status',
    '探测 Nacos 集群各节点运行状态、版本与探针健康度',
    {},
    () =>
      safeToolCall('集群状态探测', () =>
        NamingHandler.getServerStatus(nacosClient)
      )
  );
}
