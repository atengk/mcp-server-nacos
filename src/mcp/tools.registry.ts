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
import type { NacosClient } from '../client/nacos.client.js';
import { NamespaceHandler } from '../handlers/namespace.handler.js';
import { ConfigHandler } from '../handlers/config.handler.js';

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
    async () => {
      try {
        const text = await NamespaceHandler.listNamespaces(nacosClient);
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
              text: `[命名空间列表查询失败]: ${errorMsg}`,
            },
          ],
        };
      }
    }
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
    async (args) => {
      try {
        const text = await NamespaceHandler.createNamespace(nacosClient, args);
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
              text: `[命名空间创建失败]: ${errorMsg}`,
            },
          ],
        };
      }
    }
  );

  // 3. nacos_delete_namespace: 删除指定命名空间
  server.tool(
    'nacos_delete_namespace',
    '删除 Nacos 中指定的命名空间（公共命名空间 public 受保护不可删除）',
    {
      namespaceId: z.string().describe('待删除的命名空间 Tenant ID'),
    },
    async (args) => {
      try {
        const text = await NamespaceHandler.deleteNamespace(nacosClient, args);
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
              text: `[命名空间删除失败]: ${errorMsg}`,
            },
          ],
        };
      }
    }
  );
}

/**
 * 注册配置管理领域的 MCP 原子工具
 *
 * @param server MCP 服务端实例
 * @param nacosClient Nacos 客户端门面
 */
export function registerConfigTools(
  server: McpServer,
  nacosClient: NacosClient
): void {
  // 1. nacos_get_config: 查询配置全文（支持按行切片和大文本防爆）
  server.tool(
    'nacos_get_config',
    '根据配置集 ID (Data ID) 和配置分组 (Group) 查询配置全文（支持大文本自动截断保护与 startLine/endLine 按行切片读取）',
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
        .describe('按行切片读取的起始行号（1-indexed，包含）'),
      endLine: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('按行切片读取的结束行号（1-indexed，包含）'),
    },
    async (args) => {
      try {
        const text = await ConfigHandler.getConfig(nacosClient, args);
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
              text: `[配置获取失败]: ${errorMsg}`,
            },
          ],
        };
      }
    }
  );

  // 2. nacos_publish_config: 发布/更新配置（内置语法安全守卫）
  server.tool(
    'nacos_publish_config',
    '在 Nacos 中创建或更新配置内容（客户端内置 JSON/YAML 语法强安全守卫拦截）',
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
      content: z.string().describe('配置项全文内容'),
      type: z
        .string()
        .optional()
        .describe('配置格式类型（yaml, json, properties, text, xml 等）'),
      desc: z.string().optional().describe('配置项业务用途描述'),
      appName: z.string().optional().describe('归属应用服务名'),
    },
    async (args) => {
      try {
        const text = await ConfigHandler.publishConfig(nacosClient, args);
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
              text: `[配置发布失败]: ${errorMsg}`,
            },
          ],
        };
      }
    }
  );

  // 3. nacos_delete_config: 删除指定配置
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
    async (args) => {
      try {
        const text = await ConfigHandler.deleteConfig(nacosClient, args);
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
              text: `[配置删除失败]: ${errorMsg}`,
            },
          ],
        };
      }
    }
  );

  // 4. nacos_list_configs: 分页模糊搜索配置列表
  server.tool(
    'nacos_list_configs',
    '分页模糊搜索 Nacos 配置项列表',
    {
      dataId: z.string().optional().describe('配置集 ID 模糊检索关键词'),
      group: z.string().optional().describe('配置分组模糊检索关键词'),
      appName: z.string().optional().describe('归属应用名称'),
      namespaceId: z
        .string()
        .optional()
        .describe('命名空间 Tenant ID，留空或 public 为公共空间'),
      pageNo: z.number().int().positive().optional().default(1).describe('查询页码（从 1 开始）'),
      pageSize: z.number().int().positive().optional().default(20).describe('每页条数'),
    },
    async (args) => {
      try {
        const text = await ConfigHandler.listConfigs(nacosClient, args);
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
              text: `[配置搜索失败]: ${errorMsg}`,
            },
          ],
        };
      }
    }
  );

  // 5. nacos_get_config_history: 查询配置历史修订版本清单
  server.tool(
    'nacos_get_config_history',
    '查询指定配置的历史修订版本记录列表（含操作人、变更时间与历史快照 ID）',
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
      pageNo: z.number().int().positive().optional().default(1).describe('查询页码（从 1 开始）'),
      pageSize: z.number().int().positive().optional().default(20).describe('每页条数'),
    },
    async (args) => {
      try {
        const text = await ConfigHandler.getConfigHistory(nacosClient, args);
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
              text: `[配置历史查询失败]: ${errorMsg}`,
            },
          ],
        };
      }
    }
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
    async (args) => {
      try {
        const text = await ConfigHandler.rollbackConfig(nacosClient, args);
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
              text: `[配置回滚失败]: ${errorMsg}`,
            },
          ],
        };
      }
    }
  );
}


