# 锦盒 TinyNAS 推送助手（chrome-extension）

锦盒 TinyNAS 浏览器插件分支：Chrome MV3 扩展，右键推送下载链接到家里的锦盒 NAS。

> 仓库命名说明：本仓为 `tiny-nas` 组织下的产品扩展点，遵循 V1 仓库命名规则保留短名 `chrome-extension`（GitHub URL 已含组织级前缀，避免 `tinynas-chrome-extension` 重复前缀）。

## 当前状态（Task 4.1 脚手架）

- `manifest.json` — Chrome MV3 清单（permissions: contextMenus / storage / activeTab）
- `service_worker.js` — background service worker 空实现（MV3 强制要求；Task 4.2 写入 nats.ws 推送逻辑）
- `popup.html` / `popup.js` — 弹窗占位（"未绑定设备"提示）
- `icons/16.png` `icons/48.png` `icons/128.png` — 占位图标（#F59E0B 底 + 白色 "T"）

零外链：图标全部 vendor 化，不引入外部字体。CRX 离线包由 Task 4.3 打包。

## 本地调试

Chrome → `chrome://extensions` → 开发者模式 → "加载已解压的扩展程序" → 选择本目录。

## 里程碑

- Task 4.1 本仓脚手架（当前）
- Task 4.2 右键菜单 + NATS(nats.ws) 推送正式逻辑
- Task 4.3 CRX 离线打包
