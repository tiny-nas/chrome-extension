// 锦盒 TinyNAS 推送助手 — popup 绑定 UI (Task 4.2)
// 双状态：未绑定（凭据表单）/ 已绑定（目标设备信息 + 解绑）。
// V1 单设备：凭据手动录入并写入 chrome.storage.local。
// SP-3 联调扩展预留：
//   1) 配对码自动换凭据（brief Step 6 的 pair API）——受零外链约束，V1 不在插件内
//      硬编码任何 https 服务地址，待联调阶段确认走局域网直连或用户可配置后再启用；
//   2) 多设备：storage.js 的 KEY 可演进为设备数组，本 UI 增加设备列表渲染。
import { getCredentials, setCredentials, clearCredentials } from './storage.js';

const $ = (id) => document.getElementById(id);

function show(state) {
  $('unbound').classList.toggle('hidden', state !== 'unbound');
  $('bound').classList.toggle('hidden', state !== 'bound');
}

function renderBound(creds) {
  $('device-info').innerHTML = '';
  const rows = [
    ['设备 ID', creds.device_id],
    ['NATS 地址', creds.nats_url],
    ['推送 subject', creds.publish_subject],
    ['下载目录', creds.target_dir],
    ['绑定时间', creds.bound_at ? new Date(creds.bound_at).toLocaleString() : '-'],
  ];
  for (const [k, v] of rows) {
    const div = document.createElement('div');
    div.textContent = `${k}：${v ?? '-'}`;
    $('device-info').appendChild(div);
  }
  show('bound');
}

function validate(creds) {
  if (!creds.device_id) return '设备 ID 不能为空';
  if (!/^(wss?):\/\/.+/.test(creds.nats_url)) return 'NATS 地址需以 ws:// 或 wss:// 开头';
  if (!creds.nats_user) return 'NATS 用户名不能为空';
  if (!creds.nats_pass) return 'NATS 密码不能为空';
  return null;
}

async function init() {
  const creds = await getCredentials();
  if (creds && creds.device_id) {
    renderBound(creds);
  } else {
    show('unbound');
  }

  $('bind-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const creds = {
      device_id: $('device_id').value.trim(),
      nats_url: $('nats_url').value.trim(),
      nats_user: $('nats_user').value.trim(),
      nats_pass: $('nats_pass').value,
      publish_subject: $('publish_subject').value.trim() || 'tinynas.downloads',
      target_dir: $('target_dir').value.trim() || '/mnt/usb/Downloads',
      bound_at: Date.now(),
    };
    const err = validate(creds);
    if (err) {
      $('error').textContent = err;
      return;
    }
    await setCredentials(creds);
    $('error').textContent = '';
    renderBound(creds);
  });

  $('unbind').addEventListener('click', async () => {
    await clearCredentials();
    show('unbound');
  });
}

init();
