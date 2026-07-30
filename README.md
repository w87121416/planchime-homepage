# 记上日成官网

`planchime.com` 的独立官网源码。首页介绍记上日成的产品定位、使用方式、可靠性与隐私边界，并提供支持页和发布前法律审查稿。

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

`npm test` 会先完成生产构建，再验证首页、支持页、法律审查稿的搜索状态以及站点地图。

## 发布规则

- 每次同步通过独立分支和 Pull Request 进入 `main`。
- 生产站点使用 Sites 托管，`planchime.com` 仅添加托管平台要求的官网 DNS 记录。
- 现有企业邮箱的 MX、SPF 和 `mail` 记录不得修改。
- 任何密钥、用户数据、付费资源或尚未开放的价格都不得写入仓库。
