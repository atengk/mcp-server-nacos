/**
 * 配置解析与校验模块单元测试
 *
 * @author Ateng
 * @since 2026-10-04
 */

import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/config/env.config.js';

describe('env.config', () => {
  it('应当在无自定义环境变量时提供符合规格的默认配置', () => {
    const config = parseConfig({}, {});
    expect(config.serverUrl).toBe('http://127.0.0.1:8848/nacos');
    expect(config.consoleUrl).toBe('http://127.0.0.1:8080');
    expect(config.namespaceId).toBe('');
    expect(config.timeout).toBe(15000);
    expect(config.port).toBe(3000);
    expect(config.transport).toBe('stdio');
    expect(config.username).toBeUndefined();
    expect(config.password).toBeUndefined();
  });

  it('应当正确解析通过环境变量注入的自定义参数', () => {
    const env = {
      MCP_NACOS_SERVER_URL: 'http://192.168.1.100:58848/nacos',
      MCP_NACOS_CONSOLE_URL: 'http://192.168.1.100:57206',
      MCP_NACOS_USERNAME: 'admin',
      MCP_NACOS_PASSWORD: 'secure_password',
      MCP_NACOS_NAMESPACE_ID: 'dev-tenant',
      MCP_NACOS_REQUEST_TIMEOUT: '30000',
      MCP_PORT: '8081',
      MCP_TRANSPORT: 'sse',
    };

    const config = parseConfig(env, {});
    expect(config.serverUrl).toBe('http://192.168.1.100:58848/nacos');
    expect(config.consoleUrl).toBe('http://192.168.1.100:57206');
    expect(config.username).toBe('admin');
    expect(config.password).toBe('secure_password');
    expect(config.namespaceId).toBe('dev-tenant');
    expect(config.timeout).toBe(30000);
    expect(config.port).toBe(8081);
    expect(config.transport).toBe('sse');
  });

  it('当仅提供 MCP_NACOS_SERVER_ADDR 时应当自动推导规范的 serverUrl', () => {
    const config = parseConfig({ MCP_NACOS_SERVER_ADDR: '10.0.0.2:8848' }, {});
    expect(config.serverUrl).toBe('http://10.0.0.2:8848/nacos');
  });

  it('命令行选项应当具有高于环境变量的优先级', () => {
    const env = {
      MCP_NACOS_SERVER_URL: 'http://10.0.0.1:8848/nacos',
      MCP_PORT: '3000',
    };
    const cliOptions = {
      serverUrl: 'http://10.0.0.2:8848/nacos',
      port: 4000,
    };

    const config = parseConfig(env, cliOptions);
    expect(config.serverUrl).toBe('http://10.0.0.2:8848/nacos');
    expect(config.port).toBe(4000);
  });

  it('对非法 URL 或端口应当抛出业务友好的校验异常', () => {
    expect(() => {
      parseConfig({ MCP_NACOS_SERVER_URL: 'invalid-url' }, {});
    }).toThrow();

    expect(() => {
      parseConfig({ MCP_PORT: 'not-a-number' }, {});
    }).toThrow();
  });
});
