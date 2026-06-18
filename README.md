# Life Log

这是去掉 Priming 页面的生命力日志稳定版。它是纯静态网页，本地优先保存，不需要登录、数据库或 AI API。

## 这版改了什么

- 删除 Priming / 热启动界面。
- 每个记录小项目底部都有“顶部”和“底部”，方便快速回到目录或保存区。
- 封面里的 Life 改成矢量线条，不再依赖手机字体，避免 iPhone 显示变形。
- 保留本地保存、历史记录、周复盘、JSON/Markdown 导出和导入备份。

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

## 上传到 Netlify

如果用 Netlify，直接部署这个文件夹即可。它不需要构建命令。

```text
Build command: 留空
Publish directory: .
```

## iPhone 使用

用 Safari 打开发布后的网址，然后点分享按钮，选择“添加到主屏幕”。

记录保存在 iPhone 浏览器本地。换手机、清理浏览器数据或换浏览器前，请先导出 JSON 备份。
