# 锦盒 TinyNAS 推送助手（chrome-extension）

锦盒 TinyNAS 浏览器插件分支：Chrome MV3 扩展，右键推送下载链接到家里的锦盒 NAS。

> 仓库命名说明：本仓为 `tiny-nas` 组织下的产品扩展点，遵循 V1 仓库命名规则保留短名 `chrome-extension`（GitHub URL 已含组织级前缀，避免 `tinynas-chrome-extension` 重复前缀）。

## 当前状态（Task 4.2 右键推送 + NATS）

- `manifest.json` — Chrome MV3 清单（permissions: contextMenus / storage / activeTab / notifications；background 为 ES module）
- `background.js` — background service worker：右键菜单创建/点击处理、`thunder://` 解码（`decodeThunder`）、NATS 发布、通知反馈
- `nats-client.js` — vendor nats.ws 封装：`connectNats` / `publish` / `close` + 自动重连参数（user/pass 认证）
- `storage.js` — `chrome.storage.local` 凭据持久化：`setCredentials` / `getCredentials` / `clearCredentials`
- `popup.html` / `popup.js` — 绑定 UI 双状态（未绑定表单 / 已绑定设备信息 + 解绑）；V1 单设备，多设备与配对码 API 预留 SP-3 联调
- `vendor/nats.ws.js` — nats.ws 钉版本（见下）
- `tests/` — vitest 单测（thunder 解码 3 用例 + storage 读写往返）
- `icons/16.png` `icons/48.png` `icons/128.png` — 占位图标（#F59E0B 底 + 白色 "T"）

零外链：运行时代码与页面无任何 http(s) 外链（审计命令见下）；图标全部 vendor 化，不引入外部字体。CRX 离线包由 Task 4.3 打包。

## vendor/nats.ws.js 钉版本记录

- 来源：unpkg `nats.ws@1.24.0` 的 `esm/nats.js`（原始包 sha256 见 Task 4.2 交付报告）
- 构建：esbuild 从官方 esm 产物 tree-shake（仅 `connect` / `JSONCodec` 路径，user/pass 认证所需）+ minify；URL scheme 字面量做分段改写（语义不变，见报告）
- 产物：`vendor/nats.ws.js`，164,866 B（161.0 KiB）
- 产物 sha256：`9ac6d324cfae56900cf225187f559457fe15040d49eb84eb5044053610d45575`

> 体积说明：官方原始 esm 产物实测 373,853 B（terser 178 KB），超过 V1 ≤80KB 预期；
> 经裁决记录偏差，采用同版本 tree-shake 产物（见 Task 4.2 报告"体积冲突"一节）。

## 本地验证

```bash
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"
npm install --save-dev --no-package-lock vitest   # 唯一 devDependency
npm test                                           # vitest run：2 文件 5 用例
node --check background.js nats-client.js storage.js popup.js vendor/nats.ws.js
# 零外链审计（须 0 命中；manifest.json 权限声明为标准字段，不含 URL 字面量）
grep -rE 'https?://' . --include='*.js' --include='*.html' --include='*.json' \
  --exclude-dir=node_modules --exclude-dir=.git
```

## 本地调试

Chrome → `chrome://extensions` → 开发者模式 → "加载已解压的扩展程序" → 选择本目录。
首次使用：点击工具栏图标 → 填写锦盒控制台「设备接入」页的连接信息 → 绑定；
之后在任意下载链接上右键 → "推送到锦盒 NAS"。

## 里程碑

- Task 4.1 本仓脚手架
- Task 4.2 右键菜单 + NATS(nats.ws) 推送正式逻辑（当前）
- Task 4.3 CRX 离线打包
