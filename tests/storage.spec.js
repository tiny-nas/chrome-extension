// storage.js 凭据读写往返测试 (Task 4.2)
// 以内存对象模拟 chrome.storage.local 的 promise API。
import { describe, it, expect, beforeEach } from 'vitest';
import { setCredentials, getCredentials, clearCredentials } from '../storage.js';

function mockChromeStorage() {
  const data = new Map();
  globalThis.chrome = {
    storage: {
      local: {
        async get(key) {
          return data.has(key) ? { [key]: data.get(key) } : {};
        },
        async set(obj) {
          for (const [k, v] of Object.entries(obj)) data.set(k, v);
        },
        async remove(key) {
          data.delete(key);
        },
      },
    },
  };
}

const SAMPLE = {
  device_id: 'tinynas-home-01',
  nats_url: 'wss://192.168.1.10:9222',
  nats_user: 'edge',
  nats_pass: 's3cret',
  publish_subject: 'tinynas.downloads',
  target_dir: '/mnt/usb/Downloads',
  bound_at: 1780000000000,
};

describe('storage credentials', () => {
  beforeEach(mockChromeStorage);

  it('set/get 往返一致', async () => {
    await setCredentials(SAMPLE);
    expect(await getCredentials()).toEqual(SAMPLE);
  });

  it('clear 后读取为 undefined', async () => {
    await setCredentials(SAMPLE);
    await clearCredentials();
    expect(await getCredentials()).toBeUndefined();
  });
});
