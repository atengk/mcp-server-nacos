/**
 * 自愈式认证管理器与 HTTP 客户端单元测试
 *
 * @author Ateng
 * @since 2026-10-04
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { AuthManager } from '../src/client/auth.manager.js';
import { createHttpClient } from '../src/client/http.client.js';

describe('AuthManager & HttpClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('在未配置用户名密码时应当跳过登录并返回空 token', async () => {
    const authManager = new AuthManager({
      serverUrl: 'http://127.0.0.1:8848/nacos',
      consoleUrl: 'http://127.0.0.1:8080',
      namespaceId: '',
      timeout: 5000,
      port: 3000,
      transport: 'stdio',
    });

    const token = await authManager.getAccessToken();
    expect(token).toBeUndefined();
    expect(authManager.isAuthEnabled()).toBe(false);
  });

  it('配置凭据后应当成功登录获取 Token 并在 80% TTL 到期时静默续期', async () => {
    const postSpy = vi.spyOn(axios, 'post').mockImplementation(async (url) => {
      if (String(url).includes('/v1/auth/login')) {
        return {
          status: 200,
          data: {
            accessToken: 'token-initial-123',
            tokenTtl: 100, // 100 秒
          },
        };
      }
      return { status: 404, data: {} };
    });

    const authManager = new AuthManager({
      serverUrl: 'http://127.0.0.1:8848/nacos',
      consoleUrl: 'http://127.0.0.1:8080',
      username: 'nacos',
      password: 'nacos_password',
      namespaceId: '',
      timeout: 5000,
      port: 3000,
      transport: 'stdio',
    });

    const token1 = await authManager.getAccessToken();
    expect(token1).toBe('token-initial-123');
    expect(postSpy).toHaveBeenCalledTimes(1);

    // 再次调用，尚未到达 80% TTL（80 秒），应直接复用缓存 Token
    vi.advanceTimersByTime(50 * 1000);
    const token2 = await authManager.getAccessToken();
    expect(token2).toBe('token-initial-123');
    expect(postSpy).toHaveBeenCalledTimes(1);

    // 模拟下次登录返回新 Token
    postSpy.mockImplementationOnce(async () => ({
      status: 200,
      data: {
        accessToken: 'token-renewed-456',
        tokenTtl: 100,
      },
    }));

    // 推进时间越过 80% 阈值（80 秒，总计推进 85 秒）
    vi.advanceTimersByTime(35 * 1000);
    const token3 = await authManager.getAccessToken();
    expect(token3).toBe('token-renewed-456');
    expect(postSpy).toHaveBeenCalledTimes(2);

    authManager.destroy();
  });

  it('当业务请求遭遇 401 拦截时应当自动重新登录并回放原请求', async () => {
    let callCount = 0;
    const authManager = new AuthManager({
      serverUrl: 'http://127.0.0.1:8848/nacos',
      consoleUrl: 'http://127.0.0.1:8080',
      username: 'nacos',
      password: 'nacos_password',
      namespaceId: '',
      timeout: 5000,
      port: 3000,
      transport: 'stdio',
    });

    // Mock authManager.login
    vi.spyOn(authManager, 'login').mockResolvedValue('new-recovered-token');

    const httpClient = createHttpClient(
      {
        serverUrl: 'http://127.0.0.1:8848/nacos',
        consoleUrl: 'http://127.0.0.1:8080',
        username: 'nacos',
        password: 'nacos_password',
        namespaceId: '',
        timeout: 5000,
        port: 3000,
        transport: 'stdio',
      },
      authManager
    );

    // Mock axios instance request
    httpClient.axiosInstance.interceptors.request.use((config) => {
      config.adapter = async (cfg) => {
        callCount++;
        if (callCount === 1) {
          const err = new Error('Request failed with status code 401') as any;
          err.response = { status: 401, data: { message: 'token invalid' }, config: cfg };
          err.config = cfg;
          err.isAxiosError = true;
          throw err;
        }
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          config: cfg,
          data: { code: 200, data: 'recovered-success' },
        };
      };
      return config;
    });

    const response = await httpClient.get('/v1/console/namespaces');
    expect(response.data).toEqual({ code: 200, data: 'recovered-success' });
    expect(callCount).toBe(2);
    expect(authManager.login).toHaveBeenCalledWith(true);

    authManager.destroy();
  });
});
