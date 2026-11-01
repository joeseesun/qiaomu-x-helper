# xhelper.qiaomu.ai 部署说明

乔木 X 助手（Qiaomu X Helper）官网。静态站点，无构建依赖，`website/` 目录即站点根目录。

## 线上信息

- 线上地址：https://xhelper.qiaomu.ai/
- 托管：乔木 VPS（`myvps` / qiaomu-hostinger，`root@76.13.103.27`）Nginx 静态站点
- 站点根目录：`/www/wwwroot/xhelper.qiaomu.ai/`
- Nginx 配置：`/www/server/panel/vhost/nginx/xhelper.qiaomu.ai.conf`（80 跳转 443，含 HSTS、`/healthz`、`/assets/` 7 天缓存）
- TLS：Certbot webroot 签发，证书位于 `/etc/letsencrypt/live/xhelper.qiaomu.ai/`，随 Certbot 自动续期
- DNS：Cloudflare `qiaomu.ai` zone，A 记录 `xhelper.qiaomu.ai → 76.13.103.27`（proxied=false，记录 ID `3ec8a77ec1b90e1b5ab9a4d9ab2c757f`）
- Umami：website ID `287d4961-4fcb-4f64-9163-ae58d4b2fe7b`，tracker `https://umami.qiaomu.ai/script.js`，ID 持久化在 `index.html` 的 `data-website-id` 中（本文件即配置来源）

## 更新发布流程

```bash
cd /Users/joe/Documents/ChatGPT/qiaomu-x-helper/website
# 编辑后本地预览
python3 -m http.server 8917
# 发布到线上（直接覆盖站点根目录）
rsync -az --delete ./ myvps:/www/wwwroot/xhelper.qiaomu.ai/
# 验证
curl -sI https://xhelper.qiaomu.ai/ | head -3
```

注意：`--delete` 会删除服务器上本地没有的文件，仅用于本目录。不要对 `/www/wwwroot` 上级目录使用。

## 内容来源

页面所有功能点、版本号、截图、链接均来自本仓库实证文件：`README.md`、`CHANGELOG.md`、`docs/store/SUBMISSION.md`、`docs/images/`。截图来自实际生产界面（示例数据），概念主视觉由扩展内置生图生成。商店公开版与送审状态以 `docs/store/SUBMISSION.md` 为准。

## 上线验证记录（2026-11-01）

- `curl -I https://xhelper.qiaomu.ai/` → HTTP/2 200，nginx
- 首页 HTML 含 slogan「少刷一点噪音」与 `data-website-id="287d4961-…"`
- `hero-050.jpg`、打赏/公众号二维码、`robots.txt`、`sitemap.xml` 均 200
- 桌面浏览器验收：hero、全部图片、打赏/关注弹窗、无横向溢出、无控制台错误
- 移动视口验收：无横向溢出，弹窗在窄屏内完整显示
- Umami 闭环：生产浏览器带标记访问 `/?qa=launch-20261101`，已在 Umami 数据库读回该事件（2026-11-01 12:05:38 UTC）
