#!/bin/bash
# 构建 H5 工具库 mjs 供本地自测（不破坏 qa/dist-h5 下的 katex 等资源）。
set -e
cd /Users/sipon/CodeBuddy/AI教案/code/frontend
sed -i '' "s#../../qa/dist-h5#../../qa/dist-h5-tmp#" vite.lib.config.ts
npx vite build --config vite.lib.config.ts > /tmp/lib_build.log 2>&1
cp ../qa/dist-h5-tmp/courseware-h5.mjs ../qa/dist-h5/courseware-h5.mjs
rm -rf ../qa/dist-h5-tmp
sed -i '' "s#../../qa/dist-h5-tmp#../../qa/dist-h5#" vite.lib.config.ts
ls -la ../qa/dist-h5/courseware-h5.mjs
echo LIB_DONE
