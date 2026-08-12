@echo off
setlocal
set "PATH=C:\Users\admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;C:\Users\admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback;%PATH%"
cd /d "D:\CodexProjects\deploy-life-log-v2-20260805\cloud-sync"
echo A browser window will open for a one-time Cloudflare authorization.
echo After you approve it, return to this window.
echo.
call pnpm.cmd dlx wrangler@latest login
echo.
if errorlevel 1 (
  echo Authorization did not finish. You can run this file again.
) else (
  echo Authorization finished. Return to Codex and say: authorization complete.
)
pause
