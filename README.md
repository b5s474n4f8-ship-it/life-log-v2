# Life Log v4

这是 Life Log 的生活流重构版。

## 这版包含

- 睡眠记录增强：入睡困难、躺下无睡意、早醒、环境噪音、鸟叫、睡前活动、午睡/补觉和恢复感。
- 闲暇类型补全：剧、综艺、游戏、书、纪录片、视频、电影、其他。

- 今日页自动跟随真实日期，不需要每天手动改日期。
- 今日页改成 to-dos、快速捕捉和生活流卡片。
- 新增闲暇模块，用来记录剧、综艺、书、电影和其他轻内容。
- 周复盘基于最近 7 天的卡片、to-dos、运动、睡眠、庶务、灵修、关系和闲暇整理。
- 导出 Markdown 使用 UTF-8，并隐藏内部字段名。
- 本地优先保存，不需要登录、云同步、数据库或 AI API。

## 上传到 GitHub Pages

把这个文件夹里的所有文件上传到仓库根目录：

```text
index.html
app.js
styles.css
icon.svg
manifest.webmanifest
sw.js
README.md
_redirects
netlify.toml
.nojekyll
```

然后在 GitHub 仓库：

```text
Settings -> Pages -> Build and deployment -> Deploy from a branch
Branch: main
Folder: /root
```

保存后等待 Pages 发布完成。

## iPhone 使用

用 Safari 打开发布后的网址，然后点分享按钮，选择“添加到主屏幕”。

记录保存在 iPhone 浏览器本地。换手机、清理浏览器数据或换浏览器前，请先导出 JSON 备份。

