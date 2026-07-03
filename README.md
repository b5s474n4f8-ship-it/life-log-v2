# Life Log v5

一个本地优先、叙事驱动的生命力日志。

## 这一版包含

- 今日只有一个自然记录入口，内容自动保存到设备。
- 睡眠、运动、庶务、闲暇和灵修按需展开，不必每天填完整。
- 每日记录按日期持续保留，可查看、编辑、追溯和单日导出。
- 闲暇支持剧、综艺、游戏、书、文章、纪录片、视频、电影和其他。
- JSON 备份和 Markdown 导出只生成副本，不会删除 app 内数据。
- AI 整理按需调用；原始记录和 AI 结果分开保存，并保留最近 5 个旧版本。

## 已有历史记录

两个 Markdown 文件中的历史已经制成 `history-v1.enc.json` 加密包，可安全放在公开网站目录中。第一次打开新版 App 时输入单独保存的解锁口令，11 天历史记录和 4 个闲暇条目会自动写入当前设备。之后打开即可直接查看，无需重复解锁。

解锁口令不在本仓库中。私人原始 Markdown 和明文 JSON 也不在公开网站目录中。

## GitHub Pages

1. 上传公开包里的全部文件到仓库根目录。
2. 不要上传 `life-log-private-history-20260630.json`、解锁口令文件或原始 Markdown。
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