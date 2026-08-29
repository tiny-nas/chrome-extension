// nats-client.js 手写 NATS over WS 客户端单测 (Task 4.2 fix round 1)
// 以内存 MockWebSocket 模拟服务器：捕获客户端字节输出 + 注入服务器帧。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { connectNats, publish, close, isConnected, onError, _getServerInfo } from '../nats-client.js';

const te = new TextEncoder();

class MockWebSocket {
  static instances = [];
  constructor(url, protocols) {
    this.url = url;
    this.protocols = protocols;
    this.sent = [];
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    MockWebSocket.instances.push(this);
  }
  send(data) {
    this.sent.push(data);
  }
  close() {
    this.onclose?.();
  }
  // 测试辅助：服务器下行一帧 / 触发断线
  serverSend(frame) {
    this.onmessage?.({ data: frame });
  }
  serverClose() {
    this.onclose?.();
  }
}

async function handshake(ws, user = 'edge', pass = 's3cret') {
  // 服务器先下 INFO；客户端回 CONNECT+PING；服务器再回 PONG 完成握手
  ws.serverSend('INFO {"server_id":"N1-test","version":"2.10.0","jetstream":true}\r\n');
  ws.serverSend('PONG\r\n');
}

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal('WebSocket', MockWebSocket);
  onError(null);
});

afterEach(async () => {
  await close();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('hand-rolled nats ws client', () => {
  it('INFO 帧解析：存储 serverInfo 并回 CONNECT(user/pass)+PING 握手', async () => {
    const p = connectNats('wss://192.168.1.10:9222', 'edge', 's3cret');
    const ws = MockWebSocket.instances[0];
    expect(ws.protocols).toBe('nats');

    ws.serverSend('INFO {"server_id":"N1-test","jetstream":true}\r\n');
    expect(_getServerInfo()).toEqual({ server_id: 'N1-test', jetstream: true });

    const out = ws.sent.join('');
    expect(out).toContain('CONNECT ');
    const connectLine = out.split('\r\n')[0];
    const conn = JSON.parse(connectLine.slice('CONNECT '.length));
    expect(conn).toMatchObject({ verbose: false, name: 'tinynas-extension', user: 'edge', pass: 's3cret' });
    expect(out).toContain('PING\r\n');

    ws.serverSend('PONG\r\n');
    await p;
    expect(isConnected()).toBe(true);
  });

  it('PUB 帧编码：subject + 字节数 + JSON payload，行尾 CRLF 正确', async () => {
    const p = connectNats('wss://192.168.1.10:9222', 'edge', 's3cret');
    const ws = MockWebSocket.instances[0];
    await handshake(ws);
    await p;
    ws.sent.length = 0;

    const payload = { type: 'download', payload: { url: 'magnet:?xt=urn:btih:abc' }, meta: { device_id: 'n1' } };
    await publish('tinynas.downloads', payload);

    const data = JSON.stringify(payload);
    const expected = `PUB tinynas.downloads ${te.encode(data).byteLength}\r\n${data}\r\n`;
    expect(ws.sent).toEqual([expected]);

    // 未连接时 publish 必须抛错
    await close();
    await expect(publish('tinynas.downloads', {})).rejects.toThrow('not connected');
  });

  it('断线重连：onclose 后不立即重连，2s 延迟后以原参数新建连接', async () => {
    vi.useFakeTimers();
    const p = connectNats('wss://192.168.1.10:9222', 'edge', 's3cret');
    const ws = MockWebSocket.instances[0];
    await handshake(ws);
    await p;
    expect(MockWebSocket.instances).toHaveLength(1);

    ws.serverClose();
    expect(isConnected()).toBe(false);
    // 未到 2s：不新建连接
    await vi.advanceTimersByTimeAsync(1999);
    expect(MockWebSocket.instances).toHaveLength(1);
    // 到 2s：以相同 url/子协议自动重连
    await vi.advanceTimersByTimeAsync(1);
    expect(MockWebSocket.instances).toHaveLength(2);
    expect(MockWebSocket.instances[1].url).toBe('wss://192.168.1.10:9222');
    expect(MockWebSocket.instances[1].protocols).toBe('nats');

    // close() 主动关闭后不再重连
    const ws2 = MockWebSocket.instances[1];
    await close();
    ws2.serverClose();
    await vi.advanceTimersByTimeAsync(5000);
    expect(MockWebSocket.instances).toHaveLength(2);
  });
});
