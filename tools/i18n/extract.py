"""Достаёт русские фрагменты интерфейса из terminal/ (строки JS, тексты и атрибуты HTML) → strings.json"""
import json, os, re, sys

ROOT = sys.argv[1]
CYR = re.compile(r"[А-Яа-яЁё]")
frags = {}


def add(s, src):
    for part in re.split(r"\$\{(?:[^{}]|\{[^{}]*\})*\}|<[^>]+>|&[a-z]+;|\\n", s):
        for p in re.split(r"(?<=[.!?:])\s{2,}", part):
            p = p.strip(" \t\r\n·•—–-|,;:()[]«»\"'`+=/")
            if CYR.search(p) and len(p) < 600:
                frags.setdefault(p, src)


def strip_comments(code):
    out, i, n = [], 0, len(code)
    while i < n:
        c = code[i]
        if c in "\"'`":
            q = c; j = i + 1
            depth = 0
            while j < n:
                if code[j] == "\\": j += 2; continue
                if q == "`" and code[j:j+2] == "${": depth += 1; j += 2; continue
                if q == "`" and depth and code[j] == "}": depth -= 1; j += 1; continue
                if code[j] == q and not depth: break
                j += 1
            out.append(code[i:j+1]); i = j + 1
        elif code[i:i+2] == "//":
            j = code.find("\n", i); i = n if j < 0 else j
        elif code[i:i+2] == "/*":
            j = code.find("*/", i); i = n if j < 0 else j + 2
        else:
            out.append(c); i += 1
    return "".join(out)


def strings(code):
    code = strip_comments(code)
    i, n = 0, len(code)
    while i < n:
        c = code[i]
        if c in "\"'`":
            q = c; j = i + 1; depth = 0
            while j < n:
                if code[j] == "\\": j += 2; continue
                if q == "`" and code[j:j+2] == "${": depth += 1; j += 2; continue
                if q == "`" and depth and code[j] == "}": depth -= 1; j += 1; continue
                if code[j] == q and not depth: break
                j += 1
            yield code[i+1:j]; i = j + 1
        else:
            i += 1


for fn in sorted(os.listdir(os.path.join(ROOT, "js"))):
    if fn in ("i18n.js",):
        continue
    code = open(os.path.join(ROOT, "js", fn), encoding="utf-8").read()
    for s in strings(code):
        if CYR.search(s):
            # вложенные шаблоны: достать и строки внутри ${}
            for inner in re.findall(r"[\"'`]([^\"'`]*[А-Яа-яЁё][^\"'`]*)[\"'`]", s):
                add(inner, fn)
            add(s, fn)

html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
html = re.sub(r"<script>.*?</script>", "", html, flags=re.S)
html = re.sub(r"<style>.*?</style>", "", html, flags=re.S)
for m in re.findall(r'(?:title|placeholder|content)="([^"]*)"', html):
    add(m, "index.html")
for m in re.findall(r">([^<]+)<", html):
    add(m, "index.html")
known = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "en.json"), encoding="utf-8"))
new = {k: v for k, v in frags.items() if k not in known and "${" not in k and "\n" not in k}
json.dump({k: "" for k in new}, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print(len(frags), "фрагментов, без перевода:", len(new), "→", sys.argv[2])
