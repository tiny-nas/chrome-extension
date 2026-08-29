// 锦盒 TinyNAS 推送助手 — 手写极简 NATS over WebSocket 客户端 (Task 4.2 fix round 1)
// 控制器裁决：移除 nats.ws vendor，按 V1"少依赖、产品级"原则自实现。
// 协议：NATS 1.0 text protocol over WebSocket（子协议 Sec-WebSocket-Protocol: nats）。
// 实现范围（V1 用不到的特性一律不引入）：
//   - CONNECT（user/pass 认证，verbose:false）+ PING/PONG 握手
//   - PUB <subject> <#bytes>\r\n<payload>\r\n（payload 为 JSON 字符串，与 task 3.3 N1 consumer 一致；
//     NATS Server 端 JetStream 会自动捕获落入 stream subject 的普通 PUB，无需 JS 协议）
//   - 服务器帧处理：INFO / PING(回 PONG) / PONG / +OK / -ERR；MSG 不处理（V1 无 SUB，预留注释见下）
//   - 断线单次延迟 2s 自动重连（内部 setTimeout，不暴露 reconnect API）
// 公开 API：connectNats(url, user, pass) / publish(subject, payload) / close() / isConnected() / onError(fn)
const RECONNECT_DELAY_MS = 2000;
const CLIENT_INFO = {
  verbose: false,
  pedantic: false,
  name: 'tinynas-extension',
  lang: 'js',
  version: '1.0.0',
};
const te = new TextEncoder();
const td = new TextDecoder();

let ws = null;           // 当前 WebSocket 实例
let creds = null;        // 最近一次的连接参数（供自动重连复用）
let serverInfo = null;   // 服务器 INFO 帧内容
let rxBuf = '';          // 未处理完的接收缓冲（帧可能跨消息分片）
let opened = false;      // 握手完成（收到 PONG）后置 true
let manualClose = false; // close() 主动关闭标记，抑制自动重连
let reconnectTimer = null;
let pendingResolve = null;
let pendingReject = null;
let errorHandler = null;

function send(line) {
  try {
    ws.send(line);
  } catch (e) {
    // chrome.runtime.lastError 友好降级：发送异常不抛出到 SW 顶层，走 error 回调
    errorHandler?.(e);
  }
}

// 逐行处理服务器帧；buf 中为完整的 "\r\n" 分隔行
function handleLine(line) {
  if (line.startsWith('INFO ')) {
    try {
      serverInfo = JSON.parse(line.slice(5));
    } catch {
      serverInfo = null;
    }
    // 收到 INFO 即发起 CONNECT + PING 握手
    send('CONNECT ' + JSON.stringify({ ...CLIENT_INFO, user: creds.user, pass: creds.pass }) + '\r\nPING\r\n');
  } else if (line === 'PING') {
    send('PONG\r\n');
  } else if (line === 'PONG') {
    opened = true;
    pendingResolve?.(ws);
    pendingResolve = pendingReject = null;
  } else if (line.startsWith('-ERR')) {
    const err = new Error('nats server error: ' + line);
    if (pendingReject) {
      pendingReject(err);
      pendingResolve = pendingReject = null;
    } else {
      errorHandler?.(err);
    }
  }
  // +OK（verbose:false 时不会有）、MSG（V1 无 SUB 不产生；V2 加订阅时在此扩展）忽略
}

function handleData(data) {
  rxBuf += typeof data === 'string' ? data : td.decode(data);
  let idx;
  while ((idx = rxBuf.indexOf('\r\n')) >= 0) {
    const line = rxBuf.slice(0, idx);
    rxBuf = rxBuf.slice(idx + 2);
    if (line) handleLine(line);
  }
}

function handleClose() {
  opened = false;
  ws = null;
  rxBuf = '';
  const reject = pendingReject;
  pendingResolve = pendingReject = null;
  if (reject) {
    reject(new Error('nats connection closed during handshake'));
    return;
  }
  // 断线自动重连：单次延迟 2s，重连失败会再次进入本函数（等效于固定间隔重试）
  if (!manualClose && creds) {
    reconnectTimer = setTimeout(() => {
      connectNats(creds.url, creds.user, creds.pass).catch((e) => errorHandler?.(e));
    }, RECONNECT_DELAY_MS);
  }
}

/**
 * 建立 NATS 连接（重复调用会先关闭旧连接）。
 * @param {string} url ws:// 或 wss:// 地址（用户绑定时填写，非硬编码外链）
 * @param {string} user NATS 用户名
 * @param {string} pass NATS 密码
 * @returns {Promise<WebSocket>} 握手完成（收到服务器 PONG）后 resolve
 */
export function connectNats(url, user, pass) {
  return new Promise((resolve, reject) => {
    manualClose = false;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      try { ws.close(); } catch { /* 忽略旧连接关闭异常 */ }
      ws = null;
      opened = false;
    }
    creds = { url, user, pass };
    pendingResolve = resolve;
    pendingReject = reject;
    try {
      ws = new WebSocket(url, 'nats');
    } catch (e) {
      pendingResolve = pendingReject = null;
      creds = null;
      reject(e);
      return;
    }
    ws.onmessage = (ev) => handleData(ev.data);
    ws.onclose = handleClose;
    ws.onerror = () => {
      // onerror 后浏览器必发 onclose，握手期间的 reject 由 handleClose 统一处理
      if (!pendingReject) errorHandler?.(new Error('nats websocket error'));
    };
  });
}

/**
 * 发布消息（JSON 编码）。
 * @param {string} subject 如 'tinynas.downloads'
 * @param {object} payload 任意可 JSON 序列化对象
 */
export async function publish(subject, payload) {
  if (!ws || !opened) throw new Error('not connected');
  const data = JSON.stringify(payload);
  send(`PUB ${subject} ${te.encode(data).byteLength}\r\n${data}\r\n`);
}

/** 主动关闭连接并抑制自动重连。 */
export async function close() {
  manualClose = true;
  creds = null;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    try { ws.close(); } catch { /* 忽略 */ }
    ws = null;
  }
  opened = false;
  rxBuf = '';
  serverInfo = null;
}

/** 当前是否处于已连接（握手完成）状态。 */
export function isConnected() {
  return opened && ws !== null;
}

/** 注册错误回调（发送异常 / 服务器 -ERR / 重连失败）。 */
export function onError(fn) {
  errorHandler = fn;
}

// 测试辅助：读取最近一次服务器 INFO（vitest 用，不占运行时逻辑）
export function _getServerInfo() {
  return serverInfo;
}
