# 双环境策略（prod / staging）

> 目标：云端两套相同代码、不同数据。prod 干净（仅引导数据），staging 可放测试数据，供修复与 QA 验证，杜绝测试/修复直接动生产。

## 环境映射
| 域名 | 角色 | 协议 | 数据 | 端口 |
|---|---|---|---|---|
| `school.ziwi.cn` | 生产 prod | HTTPS | 仅引导用例数据（现有 demo 数据待你"清"指令后再清） | backend :8080 |
| `school1.ziwi.cn` | 测试 staging | HTTP（无需证书） | 克隆自 prod + 可加测试数据 | backend :8081 |

## 架构原则
1. **代码同源**：唯一来源 = git `main`。`deploy.sh <env>` 构建同一份产物推到对应环境，保证"代码一模一样"。
2. **数据隔离**：staging 用独立 postgres 库/容器 + 独立 redis，不共享 prod 数据卷。
3. **最小资源**：staging 复用与 prod 同镜像；postgres 限内存 512M；AI 服务独立容器保证功能完整。
4. **不碰 prod**：克隆=新建 staging 资源 + 从 prod 库 dump 到 staging 新库，绝不改 prod 容器/数据。prod 数据清洗需你明确"清"。
5. **前端对照**：两个 docroot 同份 `dist`，`school` vs `school1` 并排便于排查。

## 部署流程
- 前端：本地 `vite build` → scp 到对应 docroot。
- 后端：`docker compose -f docker-compose.<env>.yml up -d --build`。
- DB 初始化：staging 首次 `pg_dump prod | psql staging` 克隆，之后各自独立演进。

## 红线
- 任何对 `school.ziwi.cn` 的数据改动（清库/seed/迁移结构）须你明确指令。
- 证书：prod 维持现有单域证；staging 纯 HTTP，不申请证书。
