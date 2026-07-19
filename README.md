# 生命力日志正式版

本地优先的生活原文与月历痕迹 PWA。正式网页不包含私人记录，也不需要账号、云数据库或 AI。

## 发布到 GitHub Pages

1. 将本目录中的全部文件上传到 life-log-v2 仓库根目录。
2. 在 GitHub 仓库 Settings > Pages 中选择 Deploy from a branch。
3. Branch 选择 main，Folder 选择 / (root)，保存。
4. 发布完成后用 iPhone Safari 打开 Pages 地址。
5. 点击 Safari 分享按钮，选择“添加到主屏幕”。

## 私人历史

life-log-private-import-20260719.json 位于本目录之外，不能上传 GitHub。部署完成后，在 iPhone 的“备份”页面选择“导入备份”即可。

## 数据保护

- 日常记录保存在当前设备的 IndexedDB，并同步一份 localStorage 镜像。
- “备份全部记录”导出的 JSON 才能跨设备恢复。
- 建议每周或重要记录后导出一次完整备份。