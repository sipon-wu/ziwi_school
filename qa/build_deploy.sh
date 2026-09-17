#!/bin/bash
# 一次性：构建 H5 工具库 mjs（本地自测用）+ 构建前端全量并部署 staging。
# trap 保证 vite.lib.config.ts 始终恢复为 qa/dist-h5（避免停留在临时目录）。
cd /Users/sipon/CodeBuddy/AI教案/code/frontend
trap 'sed -i "" "s#../../qa/dist-h5-tmp#../../qa/dist-h5#" vite.lib.config.ts 2>/dev/null || true' EXIT

sed -i '' "s#../../qa/dist-h5#../../qa/dist-h5-tmp#" vite.lib.config.ts
npx vite build --config vite.lib.config.ts > /tmp/lib_build.log 2>&1 || { echo LIB_BUILD_FAIL; tail -20 /tmp/lib_build.log; exit 1; }
cp /Users/sipon/CodeBuddy/AI教案/qa/dist-h5-tmp/courseware-h5.mjs /Users/sipon/CodeBuddy/AI教案/qa/dist-h5/courseware-h5.mjs || { echo CP_FAIL; exit 1; }
rm -rf /Users/sipon/CodeBuddy/AI教案/qa/dist-h5-tmp

npx vite build > /tmp/fe_build.log 2>&1 || { echo FE_BUILD_FAIL; tail -20 /tmp/fe_build.log; exit 1; }
rsync -az dist/ root@193.112.163.147:/var/www/school1.ziwi.cn/ || { echo RSYNC_FAIL; exit 1; }
echo DEPLOYED
