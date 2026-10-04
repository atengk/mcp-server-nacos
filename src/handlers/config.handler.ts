/**
 * 配置中心领域原子处理器
 *
 * 负责配置获取、大文本切片、语法守卫校验、配置发布、删除与分页检索。
 *
 * @author Ateng
 * @since 2026-10-04
 */

import type { NacosClient } from '../client/nacos.client.js';
import { normalizeNamespaceId } from '../utils/normalizer.js';
import { validateConfigSyntax } from '../utils/syntax.guard.js';
import { sliceConfigContent } from '../utils/text.slice.js';
import { resolveConfigType } from '../utils/mime.util.js';

export interface GetConfigInput {
  dataId: string;
  group?: string;
  namespaceId?: string;
  startLine?: number;
  endLine?: number;
}

export interface PublishConfigInput {
  dataId: string;
  group?: string;
  namespaceId?: string;
  content: string;
  type?: string;
  desc?: string;
  appName?: string;
}

export interface DeleteConfigInput {
  dataId: string;
  group?: string;
  namespaceId?: string;
}

export interface ListConfigsInput {
  dataId?: string;
  group?: string;
  appName?: string;
  namespaceId?: string;
  pageNo?: number;
  pageSize?: number;
}

export interface GetConfigHistoryInput {
  dataId: string;
  group?: string;
  namespaceId?: string;
  pageNo?: number;
  pageSize?: number;
}

export interface RollbackConfigInput {
  dataId: string;
  group?: string;
  namespaceId?: string;
  historyId: string | number;
}

export class ConfigHandler {
  /**
   * 获取指定配置项全文内容，支持大文本自动摘要截断与按行切片
   *
   * @param client Nacos 核心客户端
   * @param input 查询入参
   * @return 格式化后的配置内容或切片结果
   */
  public static async getConfig(
    client: NacosClient,
    input: GetConfigInput
  ): Promise<string> {
    const group = input.group?.trim() || 'DEFAULT_GROUP';
    const tenant = normalizeNamespaceId(input.namespaceId);

    // 1. 从 Nacos 读取全文
    const rawContent = await client.getConfig(input.dataId.trim(), group, tenant);

    // 2. 执行大文本截断防爆与按行切片处理
    const slice = sliceConfigContent(rawContent, input.startLine, input.endLine);

    const lines: string[] = [
      `### 配置项内容: \`${input.dataId.trim()}\``,
      `- **分组 (Group)**: \`${group}\``,
      `- **命名空间 (Tenant)**: \`${tenant || 'public'}\``,
    ];

    if (slice.note) {
      lines.push('', slice.note);
    }

    lines.push('', '```', slice.content, '```');

    return lines.join('\n');
  }

  /**
   * 发布或更新配置项，前置执行语法安全守卫
   *
   * @param client Nacos 核心客户端
   * @param input 发布入参
   * @return 操作成功说明
   * @throws Error 语法校验失败或提交报错时抛出
   */
  public static async publishConfig(
    client: NacosClient,
    input: PublishConfigInput
  ): Promise<string> {
    const dataId = input.dataId.trim();
    const group = input.group?.trim() || 'DEFAULT_GROUP';
    const tenant = normalizeNamespaceId(input.namespaceId);

    const configType = resolveConfigType(dataId, input.type);

    // 1. 语法安全守卫：客户端前置拦截语法缺陷
    const guard = validateConfigSyntax(input.content, configType, dataId);
    if (!guard.valid) {
      throw new Error(guard.error);
    }

    // 2. 调用 OpenAPI 提交配置变更
    await client.publishConfig({
      dataId,
      group,
      tenant,
      content: input.content,
      type: configType,
      desc: input.desc?.trim(),
      appName: input.appName?.trim(),
    });

    return [
      `✅ 配置发布成功！`,
      `- **配置集 ID (Data ID)**: \`${dataId}\``,
      `- **配置分组 (Group)**: \`${group}\``,
      `- **命名空间 (Tenant)**: \`${tenant || 'public'}\``,
      `- **格式类型 (Type)**: ${configType}`,
      `- **字符总数**: ${input.content.length}`,
    ].join('\n');
  }

  /**
   * 删除指定配置项
   *
   * @param client Nacos 核心客户端
   * @param input 删除入参
   * @return 操作成功说明
   */
  public static async deleteConfig(
    client: NacosClient,
    input: DeleteConfigInput
  ): Promise<string> {
    const dataId = input.dataId.trim();
    const group = input.group?.trim() || 'DEFAULT_GROUP';
    const tenant = normalizeNamespaceId(input.namespaceId);

    await client.deleteConfig(dataId, group, tenant);

    return [
      `🗑️ 配置项删除成功！`,
      `- **配置集 ID (Data ID)**: \`${dataId}\``,
      `- **配置分组 (Group)**: \`${group}\``,
      `- **命名空间 (Tenant)**: \`${tenant || 'public'}\``,
    ].join('\n');
  }

  /**
   * 分页模糊搜索配置项列表
   *
   * @param client Nacos 核心客户端
   * @param input 搜索条件
   * @return 格式化 Markdown 列表与分页元数据
   */
  public static async listConfigs(
    client: NacosClient,
    input: ListConfigsInput
  ): Promise<string> {
    const tenant = normalizeNamespaceId(input.namespaceId);

    const result = await client.listConfigs({
      dataId: input.dataId?.trim(),
      group: input.group?.trim(),
      appName: input.appName?.trim(),
      tenant,
      pageNo: input.pageNo,
      pageSize: input.pageSize,
    });

    if (result.pageItems.length === 0) {
      return `未检索到匹配的配置项（命名空间: \`${tenant || 'public'}\`）。`;
    }

    const lines: string[] = [
      `### Nacos 配置项列表 (当前第 ${result.pageNumber} 页 / 共 ${result.totalCount} 项)`,
      '',
      '| 配置集 ID (Data ID) | 配置分组 (Group) | 所属应用 (App) | 格式 | 命名空间 (Tenant) |',
      '| :--- | :--- | :--- | :--- | :--- |',
    ];

    for (const item of result.pageItems) {
      const app = item.appName || '-';
      const type = item.type || '-';
      const itemTenant = item.tenant === '' ? 'public' : `\`${item.tenant}\``;
      lines.push(
        `| \`${item.dataId}\` | \`${item.group}\` | ${app} | ${type} | ${itemTenant} |`
      );
    }

    return lines.join('\n');
  }

  /**
   * 查询指定配置的历史版本清单与审计元数据
   *
   * @param client Nacos 核心客户端
   * @param input 查询参数
   * @return 格式化后的 Markdown 历史快照表格
   */
  public static async getConfigHistory(
    client: NacosClient,
    input: GetConfigHistoryInput
  ): Promise<string> {
    const dataId = input.dataId.trim();
    const group = input.group?.trim() || 'DEFAULT_GROUP';
    const tenant = normalizeNamespaceId(input.namespaceId);

    const result = await client.getConfigHistory({
      dataId,
      group,
      tenant,
      pageNo: input.pageNo,
      pageSize: input.pageSize,
    });

    if (result.pageItems.length === 0) {
      return `未检索到配置项 \`${dataId}\` 的任何历史版本记录（命名空间: \`${tenant || 'public'}\`）。`;
    }

    const lines: string[] = [
      `### 配置历史版本审计: \`${dataId}\` (共 ${result.totalCount} 次修订)`,
      `- **配置分组 (Group)**: \`${group}\``,
      `- **命名空间 (Tenant)**: \`${tenant || 'public'}\``,
      '',
      '| 快照 ID (History ID) | 上一版本 ID | 操作类型 | 操作者 | 变更时间 | 快照 MD5 |',
      '| :--- | :--- | :--- | :--- | :--- | :--- |',
    ];

    for (const item of result.pageItems) {
      const id = item.id !== undefined ? `\`${item.id}\`` : '-';
      const lastId = item.lastId !== undefined ? `\`${item.lastId}\`` : '-';
      const op = item.opType === 'I' ? '新增 (Insert)' : item.opType === 'U' ? '更新 (Update)' : item.opType === 'D' ? '删除 (Delete)' : item.opType || '-';
      const user = item.srcUser || '-';
      const time = item.lastModifiedTime || item.createdTime || '-';
      const md5 = item.md5 ? `\`${item.md5.slice(0, 10)}...\`` : '-';

      lines.push(`| ${id} | ${lastId} | ${op} | ${user} | ${time} | ${md5} |`);
    }

    lines.push(
      '',
      '💡 **原子回滚指引**: 可调用 `nacos_rollback_config` 工具并传入对应的 `historyId`，系统将自动基于快照全文执行安全原子恢复。'
    );

    return lines.join('\n');
  }

  /**
   * 原子化回滚配置至指定历史版本快照
   *
   * @param client Nacos 核心客户端
   * @param input 回滚参数
   * @return 操作成功说明与快照元数据摘要
   */
  public static async rollbackConfig(
    client: NacosClient,
    input: RollbackConfigInput
  ): Promise<string> {
    const dataId = input.dataId.trim();
    const group = input.group?.trim() || 'DEFAULT_GROUP';
    const tenant = normalizeNamespaceId(input.namespaceId);

    const snapshot = await client.rollbackConfig({
      dataId,
      group,
      tenant,
      historyId: input.historyId,
    });

    return [
      `✅ 配置原子回滚成功！`,
      `- **配置集 ID (Data ID)**: \`${dataId}\``,
      `- **配置分组 (Group)**: \`${group}\``,
      `- **命名空间 (Tenant)**: \`${tenant || 'public'}\``,
      `- **应用基准快照 (History ID)**: \`${input.historyId}\``,
      `- **快照原修改时间**: ${snapshot.lastModifiedTime || snapshot.createdTime || '-'}`,
      `- **快照摘要 MD5**: \`${snapshot.md5 || '-'}\``,
      `- **回滚生效字符数**: ${snapshot.content?.length || 0}`,
    ].join('\n');
  }
}

