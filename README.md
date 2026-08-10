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

## 上线事实配置

App Store 链接、备案号和应用商店价格通过 GitHub 仓库的 Actions Variables 在构建时注入。没有正式值时保持为空，页面会继续显示“iOS 即将上线”，并隐藏备案号与商品价格。

| Variable | 何时填写 |
| --- | --- |
| `PLANCHIME_APP_STORE_URL` | App Store 正式页面可公开访问后，填写 `https://apps.apple.com/...` 链接 |
| `PLANCHIME_ICP_NUMBER` | 取得 ICP 备案号后 |
| `PLANCHIME_PUBLIC_SECURITY_NUMBER` | 取得公安备案号后 |
| `PLANCHIME_PUBLIC_SECURITY_URL` | 取得与公安备案号对应的 `beian.gov.cn` 详情链接后；可留空 |
| `PLANCHIME_APP_FILING_NUMBER` | 取得 App 备案号后 |
| `PLANCHIME_MONTHLY_STORE_PRICE` | 月会员商品在商店创建并核对后，填写商店实际展示文字 |
| `PLANCHIME_ANNUAL_STORE_PRICE` | 年会员商品在商店创建并核对后，填写商店实际展示文字 |
| `PLANCHIME_TOP_UP_STORE_PRICE` | 补充包商品在商店创建并核对后，填写商店实际展示文字 |

价格变量必须抄录应用商店面向用户的完整展示文字，不根据内部定价计划提前填写。修改仓库变量后应重新运行“发布官网”工作流，并在公开页面核对结果。
