# Life Log v5

一个本地优先、叙事驱动的生命力日志。

## 这一版包含

- 今日只有一个自然记录入口，内容自动保存到设备。
- 睡眠、运动、庶务、闲暇和灵修按需展开，不必每天填完整。
- 每日记录按日期持续保留，可查看、编辑、追溯和单日导出。
- 闲暇支持剧、综艺、游戏、书、文章、纪录片、视频、电影和其他。
- JSON 备份和 Markdown 导出只生成副本，不会删除 app 内数据。
- AI 整理按需调用；原始记录和 AI 结果分开保存，并保留最近 5 个旧版本。

## 私密历史导入

私密历史记录不放在公开网站目录中。部署网站后，在 app 的“备份”页面导入：

`D:\CodexProjects\life-log-private-history-20260630.json`

它包含 2026-06-18 至 2026-06-29 的 11 天历史记录和 4 个闲暇条目，并保留原始 Markdown 来源。导入只需一次，此后记录继续保存在当前设备中。

## GitHub Pages

1. 只上传本目录根部的网页文件，不要上传 `worker` 文件夹。
2. 不要上传上述私密 JSON 或 `life-log-private-source-20260630`。
3. 在 GitHub 仓库的 `Settings > Pages` 中选择 `Deploy from a branch`，分支选 `main`，目录选 `/ (root)`。
4. 等待部署完成后，用 Pages 提供的网址打开。

本项目不依赖 Netlify。

## AI Worker

`worker` 文件夹是独立的 Cloudflare Worker。当前允许来源已配置为：

`https://b5s474n4f8-ship-it.github.io`

部署前需要在 Cloudflare 设置两个 secret：

- `OPENAI_API_KEY`
- `APP_ACCESS_CODE`

部署 Worker 后，在 app 的“备份”页面填写 Worker 的 `/api/organize-log` 地址和访问口令。OpenAI API Key 不得填写到网页前端。Worker 不使用数据库，请求使用 `store: false`。