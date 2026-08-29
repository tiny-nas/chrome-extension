// 锦盒 TinyNAS 推送助手 — background service worker (MV3, Task 4.2)
// 右键菜单推送下载链接到锦盒 NAS：thunder:// 解码 + NATS(nats.ws) 发布。
// 凭据来自 chrome.storage.local（popup 绑定 UI 写入，见 storage.js）。
import { connectNats, publish, close } from './nats-client.js';
import { getCredentials } from './storage.js';

const MSG = {
  NOT_BOUND: '未绑定设备：请先点击工具栏图标，在弹出窗口中绑定锦盒',
  PUBLISHING: '已推送到锦盒',
  OFFLINE: '设备离线，上线后将自动下载',
  ERROR: '推送失败',
};

const MENU_ID = 'push-tinynas';
const DEFAULT_TARGET_DIR = '/mnt/usb/Downloads';

/**
 * 解码 thunder:// 链接（迅雷专有协议）。
 * 编码规则：thunder:// + base64("AA" + 原始URL + "ZZ")，可带结尾斜杠。
 * 非 thunder 链接或解码失败时原样返回。
 * @param {string} url
 * @returns {string}
 */
export function decodeThunder(url) {
  if (typeof url !== 'string' || !url.startsWith('thunder://')) return url;
  try {
    const b64 = url.slice('thunder://'.length).replace(/\/$/, '');
    const decoded = atob(b64);
    return decoded.startsWith('AA') && decoded.endsWith('ZZ')
      ? decoded.slice(2, -2)
      : decoded;
  } catch {
    return url;
  }
}

function notify(message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/48.png',
    title: '锦盒',
    message,
  });
}

async function handlePush(info) {
  const url = info.linkUrl || info.pageUrl;
  if (!url) return;
  const decoded = decodeThunder(url);
  const creds = await getCredentials();
  if (!creds) {
    notify(MSG.NOT_BOUND);
    return;
  }
  try {
    await connectNats(creds.nats_url, creds.nats_user, creds.nats_pass);
    await publish(creds.publish_subject, {
      type: 'download',
      payload: { url: decoded, target_dir: creds.target_dir || DEFAULT_TARGET_DIR },
      meta: {
        source: 'chrome_extension',
        device_id: creds.device_id,
        timestamp: Date.now(),
      },
    });
    notify(MSG.PUBLISHING + (decoded !== url ? '（thunder 已解码）' : ''));
    // 推送完成后主动关闭，降低 service worker 活跃期内的资源占用
    await close();
  } catch (e) {
    console.error('[tinynas] publish failed:', e);
    notify(MSG.OFFLINE + ' / ' + MSG.ERROR);
  }
}

// 仅在扩展环境注册监听器（vitest 单测导入本模块时 chrome 未定义，跳过注册）
if (typeof chrome !== 'undefined' && chrome.runtime?.onInstalled) {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: '推送到锦盒 NAS',
      contexts: ['link', 'page'],
    });
  });

  chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === MENU_ID) handlePush(info);
  });
}
