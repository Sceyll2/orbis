"""Собирает js/i18n.js из словаря tools/i18n/en.json (русская строка → английская) и движка перевода.
  python tools/i18n/build_i18n.py js/i18n.js
Новые строки интерфейса: python tools/i18n/extract.py . new.json — покажет фрагменты, которых нет в en.json;
допишите их в en.json и пересоберите."""
import json, os, sys

SCR = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1]
D = json.load(open(os.path.join(SCR, "en.json"), encoding="utf-8"))
print(len(D), "переводов")
ENGINE = r"""
// ================= язык интерфейса: русский / English =================
// Перевод на лету: текст страницы, подсказки (title/placeholder), надписи на canvas, alert/confirm и формат чисел/дат.
// Исходники остаются на русском; словарь ниже собран из всех русских строк интерфейса (build_i18n.py).
(function(){
  const KEY = "orbis_lang";
  let lang = null; try { lang = localStorage.getItem(KEY); } catch (e) {}
  if (lang !== "ru" && lang !== "en") lang = /^ru|^be|^uk|^kk|^hy/i.test(navigator.language || "") ? "ru" : "en";
  window.ORBIS_LANG = lang;
  window.setLang = l => { try { localStorage.setItem(KEY, l); } catch (e) {} location.reload(); };
  document.documentElement.lang = lang;
  const addBtn = () => { const top = document.getElementById("top"), help = document.getElementById("btnHelp"); if (!top || document.getElementById("btnLang")) return;
    const b = document.createElement("button"); b.className = "tb"; b.id = "btnLang"; b.title = lang === "en" ? "Язык: русский" : "Language: English";
    b.textContent = lang === "en" ? "RU" : "EN"; b.style.fontWeight = "600"; b.onclick = () => window.setLang(lang === "en" ? "ru" : "en");
    help ? help.after(b) : top.appendChild(b); };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", addBtn) : addBtn();
  window.T = s => s;
  if (lang !== "en") return;

  const D = __DICT__;
  const CY = "А-Яа-яЁё", HAS = /[А-Яа-яЁё]/;
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const keys = Object.keys(D).sort((a, b) => b.length - a.length);
  const RE = new RegExp("(^|[^" + CY + "])(" + keys.map(esc).join("|") + ")(?=[^" + CY + "]|$)", "g");
  const cache = new Map();
  function tr(s){
    if (typeof s !== "string" || !HAS.test(s)) return s;
    let r = cache.get(s); if (r !== undefined) return r;
    r = s.replace(RE, (m, p, k) => p + D[k]);
    if (cache.size > 20000) cache.clear(); cache.set(s, r); return r;
  }
  window.T = tr;

  const SKIP = { SCRIPT:1, STYLE:1, TEXTAREA:1, INPUT:1, CODE:1 }, ATTRS = ["title", "placeholder", "aria-label", "content"];
  function walk(n){
    if (n.nodeType === 3) { const p = n.parentNode; if (p && SKIP[p.nodeName]) return; const t = tr(n.nodeValue); if (t !== n.nodeValue) n.nodeValue = t; return; }
    if (n.nodeType !== 1 || n.nodeName === "SCRIPT" || n.nodeName === "STYLE") return;
    for (const a of ATTRS) { const v = n.getAttribute(a); if (v && HAS.test(v)) { const t = tr(v); if (t !== v) n.setAttribute(a, t); } }
    if (SKIP[n.nodeName]) return;
    for (let c = n.firstChild; c; c = c.nextSibling) walk(c);
  }
  new MutationObserver(ms => { for (const m of ms) {
    if (m.type === "childList") m.addedNodes.forEach(walk); else walk(m.target); } })
    .observe(document.documentElement, { subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:ATTRS });
  document.addEventListener("DOMContentLoaded", () => walk(document.documentElement));

  // надписи на графиках (canvas): уровни ликвидаций, рисунки, подписи lightweight-charts
  const C2 = CanvasRenderingContext2D.prototype;
  for (const f of ["fillText", "strokeText", "measureText"]) { const o = C2[f]; C2[f] = function(t, ...a){ return o.call(this, tr(t), ...a); }; }
  for (const f of ["alert", "confirm", "prompt"]) { const o = window[f].bind(window); window[f] = (m, ...a) => o(tr(String(m ?? "")), ...a); }
  if (window.Notification) { const N = window.Notification; window.Notification = function(t, o){ return new N(tr(t), o && o.body ? { ...o, body:tr(o.body) } : o); };
    window.Notification.permission = N.permission; window.Notification.requestPermission = N.requestPermission.bind(N); }

  // комментарии в сценариях стратегий (поле ввода, не текст страницы)
  const TA = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
  Object.defineProperty(HTMLTextAreaElement.prototype, "value", { get(){ return TA.get.call(this); },
    set(v){ TA.set.call(this, typeof v === "string" ? v.replace(/^#.*$/gm, l => D[l.trim()] ?? tr(l)) : v); }, configurable:true });

  // числа и даты: «82 761,17» → «82,761.17»
  const loc = l => (l === "ru-RU" || l === "ru") ? "en-US" : l;
  const nl = Number.prototype.toLocaleString; Number.prototype.toLocaleString = function(l, o){ return nl.call(this, loc(l), o); };
  for (const f of ["toLocaleString", "toLocaleDateString", "toLocaleTimeString"]) { const o = Date.prototype[f]; Date.prototype[f] = function(l, opt){ return o.call(this, loc(l), opt); }; }
  const NF = Intl.NumberFormat, DF = Intl.DateTimeFormat;
  Intl.NumberFormat = function(l, o){ return new NF(loc(l), o); }; Intl.NumberFormat.prototype = NF.prototype;
  Intl.DateTimeFormat = function(l, o){ return new DF(loc(l), o); }; Intl.DateTimeFormat.prototype = DF.prototype;
})();
"""
js = ENGINE.replace("__DICT__", json.dumps(D, ensure_ascii=False, indent=0))
open(OUT, "w", encoding="utf-8").write('"use strict";' + js)
print("записан", OUT, os.path.getsize(OUT) // 1024, "КБ")
