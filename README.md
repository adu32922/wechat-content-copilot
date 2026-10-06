# WeChat Content Copilot / 公众号内容创作助手

[![CI](https://github.com/adu32922/wechat-content-copilot/actions/workflows/ci.yml/badge.svg)](https://github.com/adu32922/wechat-content-copilot/actions/workflows/ci.yml)

一个面向微信公众号运营者和中小团队的开源内容工作流。输入选题、读者、语气和补充要求，即可生成文章草稿、摘要、封面及微信图文排版，并在人工审核后选择是否保存到公众号草稿箱。

**English:** An open-source, human-in-the-loop content workflow for WeChat Official Account operators and small teams. It turns a topic and editorial settings into an article draft, digest, cover image and WeChat-ready HTML. Publishing always remains a human decision.

## 为什么做这个项目

公众号内容生产常被拆散在选题表、写作工具、图片工具和后台编辑器中。本项目把这些步骤串成一个可审计的本地流程：产物先落盘预览，外部服务失败时保留已经完成的阶段，只有运营者明确选择后才调用微信“新增草稿”接口。

## 当前能力（MVP）

输入一个选题，项目会：

1. 生成约 1500 个中文字符的公众号文章，不符合 1300-1700 字范围时自动重写一次；
2. 生成 2.35:1 横版封面；
3. 保存本地 HTML、JSON 与封面图；
4. 在配置公众号开发凭据后，将图文保存到公众号草稿箱；
5. 支持选题队列，到设定时间自动生成并进入草稿箱；
6. 草稿上传失败时可单独重试，不重复消耗文章和封面生成；
7. 演示模式不需要 API 密钥，也不会访问外部服务。
8. 支持品牌设定和参考素材输入，输出 3 个以上备选标题与可执行排版建议。

项目只调用“新增草稿”接口，不会自动群发或正式发布。

## 项目状态

- 当前阶段：可运行 MVP
- 本地演示流程：已通过自动化测试
- 真实公众号联调：需要使用者自己的账号权限、IP 白名单和凭据
- 社区采用情况：尚未声称任何外部用户、下载量、Star 或生产案例

## 立即运行

```bash
npm install
cp .env.example .env
npm start
```

浏览器打开：<http://localhost:3210>

初始配置为 `DEMO_MODE=true`，无需密钥即可验收完整本地流程。演示模式的文章和封面是本地模板，真正的 AI 生成和公众号草稿上传需要在 `.env` 中填写配置，并把 `DEMO_MODE=false`。

需要 Node.js 20 或更高版本。运行测试：

```bash
npm test
```

## 接入真实服务

1. 在 OpenAI 开发者后台创建 API Key，填入 `OPENAI_API_KEY`。
2. 在微信公众平台进入“设置与开发 → 基本配置”，取得 AppID 和 AppSecret。
3. 将运行本项目的服务器公网 IP 加入公众号 IP 白名单。
4. 确认账号具有素材管理和草稿箱 API 权限。
5. 设置 `DEMO_MODE=false` 后重启项目。
6. 先用“仅生成预览”检查内容，再用“生成并存入草稿箱”联调。

密钥仅从环境变量读取；网页和输出文件不会显示或保存密钥。

## 自动生成

在网页的“自动选题队列”中填写选题与执行时间。服务运行期间会按 `SCHEDULE_CRON` 扫描到期任务，成功后将状态标记为“已完成”，失败会记录原因并保留任务，方便修正后重试。

也可以由系统定时任务单次触发：

```bash
npm run run:due
```

## 输出目录

每次生成会写入独立目录：

```text
outputs/时间-选题/
  article.json
  article.html
  cover.jpg
  result.json
```

`result.json` 会记录是否成功进入公众号草稿箱及对应草稿 `media_id`。

任务会记录以下阶段状态：

- `text_generated`：正文已经保存；
- `cover_generated`：正文和封面已经保存；
- `draft_created`：公众号草稿已经创建；
- `failed`：当前阶段失败，同时保留 `lastSuccessfulState` 和可读错误。

如果公众号草稿上传失败，网页会显示“仅重试上传到草稿箱”。该操作复用已有正文和封面，不会再次调用 AI 生成。

## 本地接口

- `GET /api/status`：查看演示模式、OpenAI 和公众号是否配置；不会返回密钥。
- `POST /api/generate`：生成正文、封面，并按请求决定是否进入草稿箱。
- `POST /api/results/:id/retry-draft`：复用已有结果重新上传草稿。
- `GET /api/topics`、`POST /api/topics`：读取和增加定时选题。

## 安全边界

- 自动化的终点是公众号草稿箱，最终发布由运营者在公众号后台审核后手动完成。
- 不要把 `.env` 上传到网盘、代码仓库或发给他人。
- 真实联调受公众号账号权限、IP 白名单和接口配额影响；本地测试成功不等于公众号侧已验收。
- 失败的文章或封面步骤会保留已完成产物，但系统不会绕过错误伪造成功状态。

## 项目结构

```text
public/          本地操作界面
src/             生成、排版、队列与草稿箱流程
test/            Node.js 自动化测试
docs/            架构、隐私和路线图
data/            本地选题队列（默认空）
outputs/         本地产物（默认不提交）
```

## 参与贡献

欢迎提交缺陷报告、功能建议和 Pull Request。开始前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)、[SECURITY.md](SECURITY.md) 和 [路线图](docs/ROADMAP.md)。

## License

[MIT](LICENSE)
