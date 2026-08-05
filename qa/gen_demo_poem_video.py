#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""路径α本地演示：把《静夜思》课件程序化合成为 15 秒 mp4 视频课件。

不依赖任何 AI 视频模型 / DASHSCOPE key：
- 画面：ffmpeg lavfi 绘制卡通渐变背景 + 诗句文字（drawtext）
- 配音：macOS `say` 命令生成中文旁白 aiff
- 合成：ffmpeg 把各镜头视轨+音轨 concat 为单个 mp4

前置：brew install ffmpeg（本机需已装）；macOS 自带 say。
用法：python3 qa/gen_demo_poem_video.py
输出：qa/downloads/jingyesi_demo.mp4
"""
import os
import subprocess
import tempfile
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "qa", "downloads")
OUT_MP4 = os.path.join(OUT_DIR, "jingyesi_demo.mp4")

# 镜头定义： (标题, 主文字, 旁白文案, 时长秒, 背景色)
SHOTS = [
    ("静夜思", "李白 · 唐", "同学们好，今天我们一起来学习李白的古诗《静夜思》。", 3,
     "0x1E3A8A"),
    ("床前明月光，", "疑是地上霜。", "床前洒满了明亮的月光，好像地上结了一层白霜。", 4,
     "0x0E7490"),
    ("举头望明月，", "低头思故乡。", "抬起头望着天上的明月，低下头思念远方的家乡。", 5,
     "0x3730A3"),
    ("小结", "思念家乡 · 宁静优美", "这首诗用明月寄托了诗人深深的思乡之情，宁静又优美。", 3,
     "0x14532D"),
]


def run(cmd):
    print("+", " ".join(cmd[:4]), "...")
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print("STDERR:", r.stderr[-800:])
        raise SystemExit(f"命令失败: {cmd[0]}")


def make_audio(text, path):
    # macOS say -> aiff，再转 wav 供 ffmpeg 使用
    aiff = path + ".aiff"
    run(["say", "-v", "Ting-Ting", "-o", aiff, text])
    run(["ffmpeg", "-y", "-i", aiff, path])
    os.remove(aiff)


def main():
    if not shutil.which("ffmpeg"):
        raise SystemExit("ffmpeg 未安装：请先 `brew install ffmpeg`")
    os.makedirs(OUT_DIR, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix="poem_video_")
    clips = []
    try:
        for i, (title, line, narration, dur, bg) in enumerate(SHOTS):
            a_wav = os.path.join(tmp, f"a{i}.wav")
            make_audio(narration, a_wav)
            v_mp4 = os.path.join(tmp, f"v{i}.mp4")
            # 卡通渐变背景 + 标题 + 诗句 文字
            draw = (
                f"drawtext=text='{title}':fontcolor=white:fontsize=64:"
                f"x=(w-tw)/2:y=h*0.28:fontfile=/System/Library/Fonts/PingFang.ttc,"
                f"drawtext=text='{line}':fontcolor=white:fontsize=48:"
                f"x=(w-tw)/2:y=h*0.5:fontfile=/System/Library/Fonts/PingFang.ttc"
            )
            # 用 color 源 + 轻微渐变模拟（lavfi color 为纯色，叠 drawbox 做装饰）
            run([
                "ffmpeg", "-y", "-f", "lavfi", "-i",
                f"color=c={bg}:s=1280x720:d={dur}:r=25",
                "-vf",
                f"drawbox=x=40:y=40:w=iw-80:h=ih-80:color=white@0.25:t=4,{draw}",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-t", str(dur), v_mp4,
            ])
            # 合并音轨
            out = os.path.join(tmp, f"clip{i}.mp4")
            run([
                "ffmpeg", "-y", "-i", v_mp4, "-i", a_wav,
                "-c:v", "copy", "-c:a", "aac", "-shortest", out,
            ])
            clips.append(out)
        # concat
        list_file = os.path.join(tmp, "list.txt")
        with open(list_file, "w") as f:
            for c in clips:
                f.write(f"file '{c}'\n")
        run([
            "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", list_file,
            "-c", "copy", OUT_MP4,
        ])
        size = os.path.getsize(OUT_MP4)
        print(f"\n✅ 生成成功: {OUT_MP4} ({size/1024:.1f} KB)")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
