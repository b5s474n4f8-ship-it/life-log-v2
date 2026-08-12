# 生命力日志 V2.2 · 自动同步候选版

手机作为唯一输入端的本地优先 Life Log PWA。自由原文、Daily Memo、按需预演、快速数据和月历保持原有流程；新增私人云端自动同步与 Codex 只读拉取。

## 日常闭环

    iPhone 随时记录
        ↓
    先写入 IndexedDB 与 localStorage
        ↓
    联网时后台同步完整当前状态
        ↓
    Codex 在 Life Log 任务开始前只读拉取最新副本

- 手机是唯一写入端，不把多设备同时编辑引入日常流程。
- 保存不依赖网络；离线时继续记录，恢复联网、回到前台或再次打开时自动补传。
- 新装或清空本地数据后，连接同一私人同步空间即可恢复云端记录。
- 云端同步失败不会阻断本机保存，界面只显示温和状态。
- 手动 JSON 与 Markdown 导出仍保留，作为应急备份和可读档案。

## 私有同步

- 前端部署在 GitHub Pages。
- 同步 API 使用 Cloudflare Worker，数据写入 D1。
- Worker 只接受配置的 GitHub Pages 来源和私人 Bearer 口令。
- 私人口令使用 Cloudflare Secret 保存，不写入 GitHub。
- iPhone 通过一次性 #sync=... 激活链接连接；页面读取后立即从地址栏移除。
- Codex 通过本机私密配置只读拉取，生成原子更新的 latest 文件和有变化时的快照。
- 当前架构按“一个手机写、Codex 读”设计，不支持多个设备同时写入。

完整的一次性设置见 CLOUD_SYNC_SETUP.md。

## 目录

- index.html、styles.css、app.js：iPhone PWA
- sync-config.js：公开 Worker URL，不含口令
- sw.js：版本化离线缓存
- cloud-sync：Worker、D1 migration 与 Wrangler 配置
- scripts/setup-cloud-sync.ps1：一次性云端部署
- scripts/authorize-cloudflare.cmd：一次性浏览器授权
- scripts/pull-cloud-backup.mjs：Codex 只读拉取
- scripts/test-*.mjs：协议、恢复、离线与 iPhone 交互测试

## 自动读取

完成一次性设置后，Codex 在涉及 Life Log 的任务开始前运行：

    & "C:\Users\admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" "D:\CodexProjects\deploy-life-log-v2-20260805\scripts\pull-cloud-backup.mjs"

最新私密副本位于：

    D:\LifeLog-Private-Archive\cloud\life-log-cloud-latest.json

该目录不属于公开仓库。

## 验证

2026-08-12 已在本地完成：

- Worker Bearer 鉴权、来源限制和 CORS。
- 约 45 万字符（含 emoji）记录的分块保存与无损恢复。
- iPhone 390×844 激活、保存、自动上传、离线继续记录、联网补传。
- 新设备空数据从云端恢复。
- 同步输入字号不低于 16px，页面无横向溢出，主要触控目标不低于 44px。
- Codex latest 文件原子更新；内容无变化时不重复生成快照。
- 源码语法检查与私密内容扫描。

线上 V2.1.1 在云端部署和实机激活完成前保持不变，避免把未配置的同步入口发布给日常使用。
