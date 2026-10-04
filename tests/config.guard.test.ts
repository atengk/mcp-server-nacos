/**
 * 客户端配置语法守卫与大文本切片单元测试
 *
 * @author Ateng
 * @since 2026-10-04
 */

import { describe, expect, it } from 'vitest';
import { validateConfigSyntax } from '../src/utils/syntax.guard.js';
import { sliceConfigContent } from '../src/utils/text.slice.js';

describe('Syntax Guardrails (语法安全守卫)', () => {
  it('合法的 JSON 配置应当通过守卫校验', () => {
    const validJson = JSON.stringify({ app: 'order-service', port: 8080 }, null, 2);
    const result = validateConfigSyntax(validJson, 'json');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('语法畸形、缺括号的 JSON 配置应当被守卫拦截并输出诊断说明', () => {
    const invalidJson = '{\n  "app": "order-service",\n  "port": \n}';
    const result = validateConfigSyntax(invalidJson, 'json');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('JSON 语法校验失败');
  });

  it('合法的 YAML 配置应当通过守卫校验', () => {
    const validYaml = `
server:
  port: 8080
spring:
  application:
    name: user-service
`;
    const result = validateConfigSyntax(validYaml, 'yaml');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('缩进错误或格式非法的 YAML 配置应当被守卫拦截并输出行号诊断', () => {
    const invalidYaml = `
server:
  port: 8080
 spring: # 缩进错误
application: name
`;
    const result = validateConfigSyntax(invalidYaml, 'yaml');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('YAML 语法校验失败');
  });

  it('普通文本与 properties 配置应当直接放行', () => {
    const properties = 'server.port=8080\nspring.application.name=demo';
    const result = validateConfigSyntax(properties, 'properties');
    expect(result.valid).toBe(true);
  });
});

describe('Token Bloat Protection (大文本防爆与按行切片)', () => {
  it('普通长度配置应当原样完整输出且不标记截断', () => {
    const shortText = 'line 1\nline 2\nline 3';
    const result = sliceConfigContent(shortText);
    expect(result.isTruncated).toBe(false);
    expect(result.content).toBe(shortText);
    expect(result.totalLines).toBe(3);
  });

  it('超过 30,000 字符的超长配置应当自动截断并附带切片指引说明', () => {
    // 生成超过 30,000 字符的大文本（1000 行，每行约 50 字符）
    const lines = Array.from({ length: 1000 }, (_, i) => `config.item.property.key.${i}=sample-value-data-${i}`);
    const largeText = lines.join('\n');
    expect(largeText.length).toBeGreaterThan(30000);

    const result = sliceConfigContent(largeText);
    expect(result.isTruncated).toBe(true);
    expect(result.totalLines).toBe(1000);
    expect(result.totalChars).toBe(largeText.length);
    expect(result.note).toContain('超长配置已启用大模型安全保护');
    expect(result.note).toContain('startLine');
    expect(result.content.split('\n').length).toBeLessThanOrEqual(205);
  });

  it('显式指定 startLine 与 endLine 时应当精准截取对应行片段', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `Line-${i + 1}`);
    const text = lines.join('\n');

    const result = sliceConfigContent(text, 10, 15);
    expect(result.isTruncated).toBe(false);
    expect(result.content).toBe('Line-10\nLine-11\nLine-12\nLine-13\nLine-14\nLine-15');
    expect(result.note).toContain('第 10 行至第 15 行');
  });
});
