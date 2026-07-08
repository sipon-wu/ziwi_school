# 知微 QA 回归套件

前端冒烟 / 回归脚本，沉淀自 P0 验证（之前散落在 `/tmp/qa`，现纳入版本库，避免经验丢失）。

## 环境准备（一次性）

```bash
cd qa
npm install
npx playwright install chromium   # 仅首次，下载浏览器二进制（已在 .gitignore 排除）
```

## 运行

默认对 **staging（school1.ziwi.cn）** 跑：

```bash
npm run smoke      # 全路由冒烟：21 个核心页面，捕获 pageerror/console error/白屏
npm run regress    # 重点回归：出题编辑/详情 + G6 知识图谱 canvas 点击（原崩溃点）
```

对 **生产**（school.ziwi.cn）跑（仅在你已确认 staging 通过、且明确要验证 prod 时）：

```bash
BASE=https://school.ziwi.cn npm run smoke
BASE=https://school.ziwi.cn npm run regress
```

可用环境变量：

| 变量 | 默认 | 说明 |
|------|------|------|
| `BASE` | `http://school1.ziwi.cn` | 目标站点 URL |
| `QA_USER` | `13800000002` | 登录账号（教师） |
| `QA_PASS` | `teacher123` | 登录密码 |

## 退出码与产物

- 退出码 `0` = 全部通过；非 `0` = 有失败（可在 CI / 脚本里据此判定）。
- `smoke_report.json` / `regress_report.json`：结构化报告（已 gitignore）。
- `shots/`：失败/过程中的截图（已 gitignore）。

## 与 CI 的关系

`.github/workflows/ci.yml` 只做 **代码闸门**（build/lint/typecheck/test），**不自动部署、也不跑本套件**（本套件需真实环境登录）。
正确流程：push → CI 闸门过 → 手动 `bash code/deploy/deploy.sh staging` → 在 staging 跑 `npm run smoke`/`regress` 验证 → 通过后部署 prod。
