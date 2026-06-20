# 腾讯云部署指南

> **当前服务器**: 腾讯轻量云 193.112.163.147
> **规格**: 4核 / 4GB / 40GB SSD / Ubuntu
> **部署模式**: 演示环境（低内存优化版）
> **最后更新**: 2026-06-20

---

## 一、服务器资源评估

| 资源 | 实配 | 需求 | 状态 |
|:---|:---:|:---:|:---:|
| CPU | 4核 | ≥2核 | ✅ 充足 |
| 内存 | 4GB | 预期占用 ~2.3GB | ⚠️ 需要 swap |
| 磁盘 | 40GB | 预期占用 ~20GB | ⚠️ 需要日志轮转 |
| 带宽 | 3Mbps+ | ≥2Mbps | ✅ 足够 |

### 容器内存预算

| 容器 | 限制 | 保留 | 说明 |
|:---|:---:|:---:|:---|
| nginx | 64MB | 32MB | alpine 极轻 |
| business-api (Go) | 256MB | 128MB | GIN release 模式 |
| ai-service (Python) | 768MB | 256MB | FastAPI + LangChain |
| postgres (pgvector) | 1024MB | 512MB | shared_buffers=256MB |
| redis | 96MB | 48MB | maxmemory=64MB, no AOF |
| reset-cron | 32MB | 16MB | 日终数据重置 |
| **容器合计** | **~2.2GB** | **~1.0GB** | |
| **OS 基础** | **~400MB** | | systemd + docker |
| **Swap** | **4GB** | | 安全缓冲 |
| **总计可用** | **~1.4GB 余量** | | |

---

## 二、首次部署

### 2.1 SSH 登录

```bash
ssh root@193.112.163.147
```

### 2.2 安装 Docker

```bash
curl -fsSL https://get.docker.com | bash
systemctl enable docker && systemctl start docker --now

# 安装 Docker Compose 插件
apt-get install -y docker-compose-plugin

# 安装 jq（日志配置用）
apt-get install -y jq git curl htop
```

### 2.3 设置时区

```bash
timedatectl set-timezone Asia/Shanghai
```

### 2.4 防火墙（腾讯云安全组已开放 22/80/443）

```bash
# 系统层面确认
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
ufw enable
```

### 2.5 拉取代码

```bash
mkdir -p /opt/zhiwei
cd /opt/zhiwei
git clone <仓库地址> .
```

### 2.6 配置 API Key

```bash
# 编辑环境变量，填入真实 DashScope API Key
vim deploy/demo/.env.demo
# 修改: DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxx
```

### 2.7 一键部署

```bash
cd /opt/zhiwei
bash deploy/demo/deploy.sh
```

部署脚本自动完成：
1. 环境预检（内存/磁盘/Docker）
2. 创建 4GB swap + 调优 swappiness=10
3. Docker 日志轮转（10MB × 3文件）
4. 构建前端
5. 启动 6 个容器（含内存限制）
6. 健康检查验证

---

## 三、日常运维

### 查看运行状态

```bash
# 容器状态
cd /opt/zhiwei
docker compose -f deploy/demo/docker-compose.demo.yml ps

# 资源占用
docker stats --no-stream

# 系统内存
free -h

# 磁盘
df -h /
```

### 查看日志

```bash
# 所有服务
docker compose -f deploy/demo/docker-compose.demo.yml logs -f --tail=100

# 单个服务
docker logs zhiwei-demo-api -f --tail=50
docker logs zhiwei-demo-ai -f --tail=50
docker logs zhiwei-demo-db -f --tail=50
```

### 重启服务

```bash
cd /opt/zhiwei
docker compose -f deploy/demo/docker-compose.demo.yml restart
```

### 更新代码

```bash
cd /opt/zhiwei
git pull origin main
bash deploy/demo/deploy.sh
```

### 数据重置

演示环境每日 02:00 自动重置数据。手动重置：

```bash
docker exec zhiwei-demo-reset /reset.sh
```

---

## 四、域名与 SSL

### DNS 解析（腾讯云 DNSPod）

| 域名 | 类型 | 值 |
|:---|:---:|:---|
| `demo.ziwi.cn` | A | 193.112.163.147 |
| `school.ziwi.cn` | A | 193.112.163.147（暂指同一台） |

### SSL 证书

```bash
# Let's Encrypt
apt-get install -y certbot
certbot certonly --standalone -d demo.ziwi.cn
certbot certonly --standalone -d school.ziwi.cn

# 证书路径
# /etc/letsencrypt/live/demo.ziwi.cn/
# /etc/letsencrypt/live/school.ziwi.cn/

# 自动续期
echo "0 3 * * * certbot renew --quiet && docker compose -f /opt/zhiwei/deploy/demo/docker-compose.demo.yml restart nginx" | crontab -
```

---

## 五、监控与告警

### 内存告警脚本

```bash
cat > /opt/zhiwei/scripts/check-memory.sh << 'EOF'
#!/bin/bash
USED_PCT=$(free | awk '/Mem:/ {printf "%.0f", $3/$2*100}')
if [ "$USED_PCT" -gt 85 ]; then
    echo "[$(date)] WARNING: Memory usage ${USED_PCT}%" >> /var/log/zhiwei-alert.log
    docker compose -f /opt/zhiwei/deploy/demo/docker-compose.demo.yml restart ai-service
fi
EOF
chmod +x /opt/zhiwei/scripts/check-memory.sh

# 每 30 分钟检查
echo "*/30 * * * * /opt/zhiwei/scripts/check-memory.sh" | crontab -
```

### 磁盘清理

```bash
# 清理未使用的 Docker 资源（建议周执行）
echo "0 4 * * 0 docker system prune -af --volumes" | crontab -

# 清理 PostgreSQL 日志
echo "0 3 * * 0 find /var/lib/docker/volumes/demo_pg_data/_data/log/ -name '*.log' -mtime +7 -delete" | crontab -
```

---

## 六、性能调优参考

| 参数 | 当前值 | 说明 |
|:---|:---|:---|
| PostgreSQL shared_buffers | 256MB | 约总内存 6%，SSD 适用 |
| PostgreSQL work_mem | 8MB | 单操作内存，低并发安全 |
| PostgreSQL max_connections | 20 | 演示环境够用 |
| Redis maxmemory | 64MB | allkeys-lru 淘汰策略 |
| Redis AOF | 关闭 | 演示环境不需要持久化 |
| Docker log max-size | 10MB | 每个容器最多 20MB 日志 |
| Swap | 4GB | 安全缓冲，swappiness=10 |
| vm.swappiness | 10 | 尽量用物理内存 |

---

## 七、扩容路径

当需要升级到 SaaS 多租户环境时：

| 升级项 | 当前 | SaaS 目标 | 月成本增量 |
|:---|:---:|:---:|:---:|
| CVM | 4C4G | 4C16G | +¥350 |
| 磁盘 | 40GB | 80GB SSD | +¥40 |
| 带宽 | 3Mbps | 5Mbps | +¥115 |
| COS | 无 | 50GB 标准存储 | +¥10 |
| EdgeOne | 无 | 基础版 CDN+WAF | +¥59 |
| **合计** | | | **+¥574/月** |

---

## 八、故障排查

### 容器无法启动

```bash
# 查看详细日志
docker compose -f deploy/demo/docker-compose.demo.yml logs

# 检查 OOM（内存不足被杀死）
dmesg | grep -i "out of memory"

# 检查端口冲突
ss -tlnp | grep -E '80|5432|6379|8000|8080'
```

### AI 服务无响应

```bash
# 检查 DashScope API Key
docker exec zhiwei-demo-ai env | grep DASHSCOPE

# 测试连通性
curl http://localhost/ai/health

# 如果内存不足，手动重启 AI 服务
docker restart zhiwei-demo-ai
```

### PostgreSQL 连接满

```bash
# 查看当前连接数
docker exec zhiwei-demo-db psql -U zhiwei -c "SELECT count(*) FROM pg_stat_activity;"

# 终止空闲连接
docker exec zhiwei-demo-db psql -U zhiwei -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state='idle' AND pid <> pg_backend_pid();"
```
