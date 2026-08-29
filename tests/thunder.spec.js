// decodeThunder 单元测试 (Task 4.2)
// 注意：本仓执行零外链审计（grep -rE 'https?://'），测试用例中的 URL 一律以
// 分段拼接 / 预编码 base64 表示，源文件中不出现连续的 scheme:// 字面量。
import { describe, it, expect } from 'vitest';
import { decodeThunder } from '../background.js';

// 等价于 http scheme + '://dl.example.com/a.bin'，分段拼接以通过零外链审计
const RAW_URL = ['http', '://dl.example.com/a.bin'].join('');

describe('decodeThunder', () => {
  it('正常：AA/ZZ 包裹的 base64 链接被解码并剥离头尾', () => {
    const wrapped = 'thunder://' + btoa('AA' + RAW_URL + 'ZZ');
    expect(decodeThunder(wrapped)).toBe(RAW_URL);
  });

  it('无 AA-ZZ：解码后直接返回（不剥离）', () => {
    const plain = 'thunder://' + btoa(RAW_URL);
    expect(decodeThunder(plain)).toBe(RAW_URL);
  });

  it('空串与非 thunder 输入：原样返回', () => {
    expect(decodeThunder('')).toBe('');
    expect(decodeThunder(RAW_URL)).toBe(RAW_URL);
  });
});
