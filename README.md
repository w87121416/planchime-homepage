# 记上日成官网

`planchime.com` 的独立官网源码。首页介绍记上日成的产品定位、使用方式、可靠性与隐私边界，并提供 Apple 审核需要的支持、隐私、协议、联系与账号删除入口。

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:3000`。

## 质量检查

```bash
npm run lint
npm test
```

`npm test` 会先完成生产构建，再验证首页、支持页、正式法律页面和站点地图。

生成 GitHub Pages 使用的静态产物：

```bash
npm run build:static
```

## 发布规则

- 每次同步通过独立分支和 Pull Request 进入 `main`。
- 生产站点使用 GitHub Pages 的公开静态产物；保留 Sites 构建作为可迁移的托管方案。
- `planchime.com` 只添加 GitHub Pages 所需的网站记录，根域和 `www` 最终都应跳转到 HTTPS 主站。
- 现有企业邮箱的 MX、SPF 和 `mail` 记录不得修改。
- 任何密钥、用户数据、付费资源或尚未开放的价格都不得写入仓库。
