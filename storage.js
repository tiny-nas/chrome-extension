// 锦盒 TinyNAS 推送助手 — chrome.storage.local 凭据持久化封装 (Task 4.2)
// V1 单设备：凭据对象 { device_id, nats_url, nats_user, nats_pass, publish_subject, target_dir, bound_at }
// 多设备扩展预留（SP-3 联调）：KEY 结构可演进为数组，见 popup.js 注释。
const KEY = 'tinynas_credentials_v1';

/**
 * 写入绑定凭据。
 * @param {object} c 凭据对象
 */
export async function setCredentials(c) {
  return chrome.storage.local.set({ [KEY]: c });
}

/**
 * 读取绑定凭据；未绑定时返回 undefined。
 * @returns {Promise<object|undefined>}
 */
export async function getCredentials() {
  const { [KEY]: c } = await chrome.storage.local.get(KEY);
  return c;
}

/** 解除绑定（popup 解绑按钮使用）。 */
export async function clearCredentials() {
  return chrome.storage.local.remove(KEY);
}
