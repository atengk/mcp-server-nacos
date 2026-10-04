/**
 * 具备 401 拦截自愈能力的 HTTP 客户端
 *
 * @author Ateng
 * @since 2026-10-04
 */

import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import type { NacosServerConfig } from '../types/index.js';
import type { AuthManager } from './auth.manager.js';

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export class HttpClient {
  public readonly axiosInstance: AxiosInstance;
  private readonly config: NacosServerConfig;
  private readonly authManager: AuthManager;

  /**
   * 初始化 HTTP 客户端
   *
   * @param config 系统运行配置
   * @param authManager 自愈式认证管理器
   */
  constructor(config: NacosServerConfig, authManager: AuthManager) {
    this.config = config;
    this.authManager = authManager;

    this.axiosInstance = axios.create({
      baseURL: this.config.serverUrl,
      timeout: this.config.timeout,
    });

    this.setupInterceptors();
  }

  /**
   * 配置请求与响应拦截器
   */
  private setupInterceptors(): void {
    // 1. 请求拦截器：自动注入最新有效 Access Token
    this.axiosInstance.interceptors.request.use(
      async (reqConfig: InternalAxiosRequestConfig) => {
        if (this.authManager.isAuthEnabled()) {
          const token = await this.authManager.getAccessToken();
          if (token) {
            if (reqConfig.params instanceof URLSearchParams) {
              reqConfig.params.set('accessToken', token);
            } else {
              reqConfig.params = {
                ...reqConfig.params,
                accessToken: token,
              };
            }
          }
        }
        return reqConfig;
      },
      (error) => Promise.reject(error)
    );

    // 2. 响应拦截器：401 遭遇时自动重新鉴权并回放原请求
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error) => {
        const originalRequest = error.config as CustomAxiosRequestConfig | undefined;

        if (
          error.response &&
          error.response.status === 401 &&
          originalRequest &&
          !originalRequest._retry &&
          this.authManager.isAuthEnabled()
        ) {
          originalRequest._retry = true;
          try {
            const freshToken = await this.authManager.login(true);
            if (freshToken) {
              if (originalRequest.params instanceof URLSearchParams) {
                originalRequest.params.set('accessToken', freshToken);
              } else {
                originalRequest.params = {
                  ...originalRequest.params,
                  accessToken: freshToken,
                };
              }
            }
            return this.axiosInstance(originalRequest);
          } catch (loginError) {
            return Promise.reject(loginError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * 发起 GET 请求
   *
   * @param url 相对路径或绝对 URL
   * @param config 请求配置项
   * @return 响应结果
   */
  public async get<T = unknown>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.axiosInstance.get<T>(url, config);
  }

  /**
   * 发起 POST 请求
   *
   * @param url 相对路径或绝对 URL
   * @param data 请求体数据
   * @param config 请求配置项
   * @return 响应结果
   */
  public async post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.axiosInstance.post<T>(url, data, config);
  }

  /**
   * 发起 PUT 请求
   *
   * @param url 相对路径或绝对 URL
   * @param data 请求体数据
   * @param config 请求配置项
   * @return 响应结果
   */
  public async put<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.axiosInstance.put<T>(url, data, config);
  }

  /**
   * 发起 DELETE 请求
   *
   * @param url 相对路径或绝对 URL
   * @param config 请求配置项
   * @return 响应结果
   */
  public async delete<T = unknown>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.axiosInstance.delete<T>(url, config);
  }
}

/**
 * 创建 HTTP 客户端工厂函数
 *
 * @param config 系统运行配置
 * @param authManager 自愈式认证管理器
 * @return 组装完毕的 HttpClient
 */
export function createHttpClient(
  config: NacosServerConfig,
  authManager: AuthManager
): HttpClient {
  return new HttpClient(config, authManager);
}
