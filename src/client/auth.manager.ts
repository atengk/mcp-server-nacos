/**
 * Nacos 3.0 自愈式认证管理器
 *
 * 负责 Token 登录、80% TTL 提前静默续期与长会话保活。
 *
 * @author Ateng
 * @since 2026-10-04
 */

import axios, { type AxiosInstance } from 'axios';
import type { NacosServerConfig } from '../types/index.js';

interface LoginResponse {
  accessToken?: string;
  tokenTtl?: number;
  globalAdmin?: boolean;
}

export class AuthManager {
  private readonly config: NacosServerConfig;
  private readonly client: typeof axios | AxiosInstance;
  private token: string | null = null;
  private tokenTtl = 18000; // 默认 18000 秒
  private expireAt = 0;
  private renewalTimer: NodeJS.Timeout | null = null;
  private inFlightLogin: Promise<string | undefined> | null = null;

  /**
   * 构造自愈式认证管理器
   *
   * @param config 系统运行配置
   * @param customAxios 可选的自定义 Axios 实例（用于测试桩或特殊配置）
   */
  constructor(config: NacosServerConfig, customAxios?: AxiosInstance) {
    this.config = config;
    this.client = customAxios ?? axios;
  }

  /**
   * 检查当前服务是否启用了用户名/密码鉴权
   *
   * @return true 表示已配置凭证需鉴权，false 表示未配置鉴权
   */
  public isAuthEnabled(): boolean {
    return Boolean(this.config.username && this.config.password);
  }

  /**
   * 获取当前有效的 Access Token
   *
   * 若 Token 不存在或已达到 80% TTL 阈值，则触发静默登录刷新。
   *
   * @return 当前可用 Token，未启用鉴权时返回 undefined
   */
  public async getAccessToken(): Promise<string | undefined> {
    if (!this.isAuthEnabled()) {
      return undefined;
    }

    const now = Date.now();
    const nearExpiry = now >= this.expireAt - this.tokenTtl * 0.2 * 1000;

    if (!this.token || nearExpiry) {
      return this.login();
    }

    return this.token ?? undefined;
  }

  /**
   * 执行 Nacos OpenAPI 登录请求
   *
   * @param force 是否强制重新登录（用于 401 拦截自愈）
   * @return 刷新后的 Access Token
   * @throws Error 登录凭证无效或网络异常时抛出业务错误
   */
  public async login(force = false): Promise<string | undefined> {
    if (!this.isAuthEnabled()) {
      return undefined;
    }

    if (!force && this.inFlightLogin) {
      return this.inFlightLogin;
    }

    this.inFlightLogin = (async () => {
      try {
        const loginUrl = `${this.config.serverUrl}/v1/auth/login`;
        const params = new URLSearchParams();
        params.append('username', this.config.username!);
        params.append('password', this.config.password!);

        const response = await this.client.post<LoginResponse>(
          loginUrl,
          params.toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: this.config.timeout,
          }
        );

        if (!response.data || !response.data.accessToken) {
          throw new Error('Nacos 认证响应缺失 accessToken');
        }

        this.token = response.data.accessToken;
        this.tokenTtl = response.data.tokenTtl || 18000;
        this.expireAt = Date.now() + this.tokenTtl * 1000;

        // 80% TTL 提前静默续期调度
        this.scheduleRenewal(this.tokenTtl * 0.8 * 1000);

        return this.token ?? undefined;
      } finally {
        this.inFlightLogin = null;
      }
    })();

    return await this.inFlightLogin;
  }

  /**
   * 调度静默续期定时器
   *
   * @param delayMs 延时触发毫秒数
   */
  private scheduleRenewal(delayMs: number): void {
    if (this.renewalTimer) {
      clearTimeout(this.renewalTimer);
      this.renewalTimer = null;
    }

    this.renewalTimer = setTimeout(async () => {
      try {
        await this.login(true);
      } catch (err) {
        // 静默续期失败时不抛出阻断，交由下次请求前检查或 401 拦截兜底
        console.error('[AuthManager] 静默续期失败，将在下次请求或 401 自动重试:', err);
      }
    }, Math.max(delayMs, 1000));

    if (this.renewalTimer && typeof this.renewalTimer.unref === 'function') {
      this.renewalTimer.unref();
    }
  }

  /**
   * 销毁定时器并释放资源
   */
  public destroy(): void {
    if (this.renewalTimer) {
      clearTimeout(this.renewalTimer);
      this.renewalTimer = null;
    }
  }
}
