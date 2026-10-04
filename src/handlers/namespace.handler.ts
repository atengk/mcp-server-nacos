/**
 * 命名空间领域原子处理器
 *
 * 负责业务入参校验、安全守卫拦截、调用 Nacos 客户端并组装语义化展示。
 *
 * @author Ateng
 * @since 2026-10-04
 */

import type { NacosClient } from '../client/nacos.client.js';

export interface CreateNamespaceInput {
  namespaceId: string;
  namespaceName: string;
  namespaceDesc?: string;
}

export interface DeleteNamespaceInput {
  namespaceId: string;
}

export class NamespaceHandler {
  /**
   * 处理查询命名空间列表
   *
   * @param client Nacos 核心客户端
   * @return 格式化后的命名空间概要文本
   */
  public static async listNamespaces(client: NacosClient): Promise<string> {
    const namespaces = await client.listNamespaces();

    if (namespaces.length === 0) {
      return 'Nacos 集群中暂无任何命名空间。';
    }

    const lines: string[] = [
      `### Nacos 命名空间列表 (共 ${namespaces.length} 个)`,
      '',
      '| 命名空间名称 | 租户标识 (Tenant ID) | 配置项总数 | 描述说明 | 空间类型 |',
      '| :--- | :--- | :--- | :--- | :--- |',
    ];

    for (const ns of namespaces) {
      const showName = ns.namespaceShowName || ns.namespace || '未命名';
      const tenantId = ns.namespace === '' ? '(public 公共空间)' : `\`${ns.namespace}\``;
      const count = ns.configCount ?? 0;
      const desc = ns.namespaceDesc || '无';
      const type = ns.type === 0 ? '系统内置' : '用户自定义';

      lines.push(`| ${showName} | ${tenantId} | ${count} | ${desc} | ${type} |`);
    }

    return lines.join('\n');
  }

  /**
   * 处理创建自定义命名空间
   *
   * @param client Nacos 核心客户端
   * @param input 创建入参
   * @return 操作结果说明
   * @throws Error 当尝试创建保留空间 public 或调用失败时抛出
   */
  public static async createNamespace(
    client: NacosClient,
    input: CreateNamespaceInput
  ): Promise<string> {
    const trimmedId = input.namespaceId.trim();

    // 1. 安全防御守卫：拦截重名创建系统公共空间
    if (trimmedId === '' || trimmedId.toLowerCase() === 'public') {
      throw new Error('公共命名空间 (public) 为系统内置保留空间，无需也不能重复创建。');
    }

    // 2. 执行创建调用
    await client.createNamespace(
      trimmedId,
      input.namespaceName.trim(),
      input.namespaceDesc?.trim()
    );

    return [
      `✅ 命名空间创建成功！`,
      `- **租户标识 (Tenant ID)**: \`${trimmedId}\``,
      `- **显示名称**: ${input.namespaceName.trim()}`,
      `- **业务描述**: ${input.namespaceDesc?.trim() || '无'}`,
    ].join('\n');
  }

  /**
   * 处理删除指定命名空间
   *
   * @param client Nacos 核心客户端
   * @param input 删除入参
   * @return 操作结果说明
   * @throws Error 当尝试删除系统公共空间 public 或调用失败时抛出
   */
  public static async deleteNamespace(
    client: NacosClient,
    input: DeleteNamespaceInput
  ): Promise<string> {
    const trimmedId = input.namespaceId.trim();

    // 1. 安全防御守卫：严禁删除系统内置公共空间
    if (trimmedId === '' || trimmedId.toLowerCase() === 'public') {
      throw new Error('公共命名空间 (public) 为系统保留空间，严禁删除。');
    }

    // 2. 执行删除调用
    await client.deleteNamespace(trimmedId);

    return `🗑️ 命名空间删除成功！租户标识 (Tenant ID): \`${trimmedId}\``;
  }
}
