/**
 * MCP Prompts 交互式运维模板注册中心
 *
 * 注册 nacos_service_inspection 与 nacos_config_drift_check 运维分析模板，
 * 提供基于实时配置与拓扑数据的自动化分析引导。
 *
 * @author Ateng
 * @since 2026-10-04
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NacosClient } from '../client/nacos.client.js';
import { PromptHandler } from '../handlers/prompt.handler.js';

/**
 * 注册 Nacos 交互式运维相关的 MCP Prompts
 *
 * @param server MCP 服务端实例
 * @param nacosClient Nacos 客户端门面
 */
export function registerNacosPrompts(
  server: McpServer,
  nacosClient: NacosClient
): void {
  // 1. nacos_service_inspection: 微服务架构健康度与拓扑体检
  server.prompt(
    'nacos_service_inspection',
    '自动采集并汇总 Nacos 微服务列表与实例状态，生成微服务架构拓扑与异常节点体检诊断报告',
    {
      namespaceId: z
        .string()
        .optional()
        .describe('命名空间 Tenant ID，留空或 public 为公共空间'),
      groupName: z
        .string()
        .optional()
        .describe('微服务分组名称，默认 DEFAULT_GROUP'),
    },
    async (args) => {
      return PromptHandler.serviceInspectionPrompt(nacosClient, args);
    }
  );

  // 2. nacos_config_drift_check: 配置漂移比对与 Unified Git Diff 分析
  server.prompt(
    'nacos_config_drift_check',
    '拉取当前线上配置与历史版本快照，自动生成 Unified Git Diff 并引导模型评估配置漂移风险',
    {
      dataId: z.string().describe('目标配置集 ID (Data ID)'),
      group: z
        .string()
        .optional()
        .describe('配置分组 (Group)，默认 DEFAULT_GROUP'),
      namespaceId: z
        .string()
        .optional()
        .describe('命名空间 Tenant ID，留空或 public 为公共空间'),
      historyId: z
        .string()
        .optional()
        .describe('指定对比的历史快照 ID (留空则自动选取最近一次历史变更)'),
    },
    async (args) => {
      return PromptHandler.configDriftCheckPrompt(nacosClient, args);
    }
  );
}
