#!/usr/bin/env python3
"""把 src/ 里的源文件拼成两个网页：
  index.html          双击就能玩（需要联网加载 3D 引擎）
  dist/artifact.html  发布到 claude.ai 的版本（不带 <html>/<head> 外壳）
改游戏时只改 src/ 里的文件，然后运行：python3 build.py
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
JS_ORDER = [
    "core.js", "holo.js", "models.js", "designer.js", "economy.js", "ui.js",
    "mode-combat.js", "mode-gentle.js", "mode-math.js", "mode-snake.js", "main.js",
]


def read(p):
    return (SRC / p).read_text(encoding="utf-8")


head = read("head.html")
libs = read("libs.html")
body = read("body.html")
css = read("style.css")
js = "\n".join(f"/* ---- {name} ---- */\n" + read("js/" + name) for name in JS_ORDER)
assert "</script" not in js.lower(), "JS 里不能出现 </script>"

style = f"<style>\n{css}\n</style>\n"
script = f"<script>\n{js}\n</script>\n"
artifact = head + style + body + libs + script
local = (
    '<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
    + head + style + "</head>\n<body>\n" + body + libs + script + "</body>\n</html>\n"
)
(ROOT / "dist").mkdir(exist_ok=True)
(ROOT / "dist" / "artifact.html").write_text(artifact, encoding="utf-8")
(ROOT / "index.html").write_text(local, encoding="utf-8")
print(f"已生成 index.html 和 dist/artifact.html（{len(artifact.encode('utf-8')) // 1024} KB）")
