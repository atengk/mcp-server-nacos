/**
 * MCP Resources 动态配置资源注册中心
 *
 * 注册 nacos://config/{namespaceId}/{group}/{dataId} 资源协议模板，
 * 提供根据配置扩展名自动适配 MIME 类型的动态挂载能力。
 *
 * @author Ateng
 * @since 2026-10-04
 */

import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NacosClient } from '../client/nacos.client.js';
import { resolveConfigMimeType } from '../utils/mime.util.js';

/**
 * 注册 Nacos 动态配置相关的 MCP Resources
 *
 * @param server MCP 服务端实例
 * @param nacosClient Nacos 客户端门面
 */
export function registerNacosResources(
  server: McpServer,
  nacosClient: NacosClient
): void {
  const configTemplate = new ResourceTemplate(
    'nacos://config/{namespaceId}/{group}/{dataId}',
    {
      list: undefined,
    }
  );

  server.resource(
    'nacos-config',
    configTemplate,
    {
      description:
        '按指定命名空间、分组及 Data ID 读取 Nacos 动态配置快照（URI: nacos://config/{namespaceId}/{group}/{dataId}）',
      mimeType: 'text/plain',
    },
    async (uri, variables) => {
      const rawNamespace = String(variables.namespaceId || '');
      const group = String(variables.group || 'DEFAULT_GROUP');
      const dataId = String(variables.dataId || '');

      // 1. 规范化命名空间租户标识（public 或空串统一映射为 Nacos 默认公共空间 tenant=""）
      const tenant =
        rawNamespace.toLowerCase() === 'public' || rawNamespace === ''
          ? ''
          : rawNamespace;

      // 2. 调用底层 Nacos 客户端读取配置内容
      const content = await nacosClient.getConfig(dataId, group, tenant);
      if (content === null || content === undefined) {
        throw new Error(
          `Nacos 配置集不存在: dataId=${dataId}, group=${group}, namespaceId=${rawNamespace || 'public'}`
        );
      }

      // 3. 动态识别文件扩展名并推导标准 MIME Content-Type
      const mimeType = resolveConfigMimeType(dataId);

      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType,
            text: content,
          },
        ],
      };
    }
  );
}
