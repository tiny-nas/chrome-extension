// 锦盒 TinyNAS 推送助手 — NATS(WebSocket) 客户端封装 (Task 4.2)
// 基于 vendor 化 nats.ws@1.24.0（见 vendor/nats.ws.js 头部注释与 README 钉版本记录）。
// 仅封装 connect / close / publish 三个函数 + 自动重连参数；user/pass 认证。
import { connect, JSONCodec } from './vendor/nats.ws.js';

let nc = null;
const jc = JSONCodec();

/**
 * 建立（或重建）NATS 连接。
 * @param {string} url  WebSocket NATS 地址，如 wss://nas.example.lan:9222（用户绑定设备时填写，非外链硬编码）
 * @param {string} user NATS 用户名
 * @param {string} pass NATS 密码
 * @returns {Promise<import('./vendor/nats.ws.js').NatsConnection>}
 */
export async function connectNats(url, user, pass) {
  if (nc) await nc.close();
  nc = await connect({
    servers: url,
    user,
    pass,
    // 自动重连参数：MV3 service worker 可能被回收，重连参数兜底活跃期内的断线
    reconnect: true,
    maxReconnectAttempts: -1,
    reconnectTimeWait: 5000,
    pingInterval: 30000,
    timeout: 5000,
  });
  return nc;
}

/**
 * 发布 JSON 消息。
 * @param {string} subject
 * @param {object} payload
 */
export async function publish(subject, payload) {
  if (!nc) throw new Error('not connected');
  await nc.publish(subject, jc.encode(payload));
}

/** 关闭连接并重置句柄。 */
export async function close() {
  if (nc) {
    await nc.close();
    nc = null;
  }
}

/** 测试辅助：判断当前是否持有连接。 */
export function isConnected() {
  return nc !== null && !nc.isClosed();
}
