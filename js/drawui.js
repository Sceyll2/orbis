// Интерфейс рисования (09.10.2026): плавающая панель свойств выделенного рисунка (как у TradingView), список объектов,
// риск для «Лонг/Шорт», окно «📤 На разбор» (вся разметка точными числами — в буфер обмена, для разбора в чате),
// чёткость: зум колесом с Ctrl и щипком масштабирует график, а не страницу (иначе холсты «мылятся»).
const TYPE_NAMES = { trend:"Линия тренда", ray:"Луч", ext:"Продлённая линия", hline:"Уровень", hray:"Горизонтальный луч", vline:"Вертикаль",
  channel:"Канал", rect:"Прямоугольник", arrow:"Стрелка", text:"Текст", callout:"Выноска", brush:"Кисть", measure:"Линейка", fib:"Фибоначчи",
  fibext:"Расширение Фибоначчи", pitchfork:"Вилы Эндрюса", elliott:"Эллиотт 1–5", abc:"Эллиотт ABC", long:"Лонг", short:"Шорт" };
const SWATCH = ["#2962ff", "#26c6da", "#089981", "#f7a600", "#ff9800", "#f23645", "#e040fb", "#d1d4dc"];
S.riskUsd = (() => { try { return +localStorage.getItem("riskUsd") || 10; } catch (e) { return 10; } })();

// ---------- панель свойств ----------
const dtb = document.createElement("div"); dtb.id = "dtb"; $("mainPane").appendChild(dtb);
for (const ev of ["pointerdown", "mousedown", "click", "wheel"]) dtb.addEventListener(ev, e => e.stopPropagation());
function setProp(k, v){ if (!S.sel) return; snap(); if (v === null) delete S.sel[k]; else S.sel[k] = v; saveDrawings(); markDirty(); renderDtb(); }
function renderDtb(){
  const dw = S.sel; if (!dw) { dtb.style.display = "none"; return; }
  const pos = dw.type === "long" || dw.type === "short", txt = dw.type === "text" || dw.type === "callout";
  dtb.innerHTML = `<span class="nm">${TYPE_NAMES[dw.type] || dw.type}</span>`
    + SWATCH.map(c => `<button class="sw${(dw.color || "#2962ff") === c ? " on" : ""}" data-c="${c}" style="background:${c}" title="Цвет"></button>`).join("")
    + `<label class="sw cpick" title="Свой цвет"><input type="color" value="${dw.color || "#2962ff"}"></label><span class="sep"></span>`
    + [1, 2, 3, 4].map(w => `<button class="w${Math.round(dw.width || 1.6) === w || (!dw.width && w === 2) ? " on" : ""}" data-w="${w}" title="Толщина ${w}"><i style="height:${w}px"></i></button>`).join("")
    + `<span class="sep"></span>` + [["solid", "──"], ["dash", "╌╌"], ["dot", "┈┈"]].map(([k, s]) => `<button class="ds${(dw.dash || "solid") === k ? " on" : ""}" data-d="${k}" title="Стиль линии">${s}</button>`).join("")
    + `<span class="sep"></span><button data-a="label" title="${txt ? "Изменить текст" : "Подпись к рисунку"}">Aa</button>`
    + (pos ? `<label class="risk" title="Сколько $ теряете, если сработает стоп — от этого размер позиции">риск $<input type="number" min="1" step="1" value="${S.riskUsd}"></label>` : "")
    + `<button data-a="lock" title="${dw.locked ? "Открепить" : "Закрепить (не двигается, не удаляется клавишей)"}">${dw.locked ? "🔒" : "🔓"}</button>`
    + `<button data-a="clone" title="Копия (Ctrl+D)">⧉</button><button data-a="del" title="Удалить (Delete)">🗑</button>`;
  dtb.style.display = "flex";
  dtb.querySelectorAll("button.sw").forEach(b => b.onclick = () => setProp("color", b.dataset.c));
  dtb.querySelector(".cpick input").oninput = e => { if (S.sel) { S.sel.color = e.target.value; markDirty(); } };
  dtb.querySelector(".cpick input").onchange = e => setProp("color", e.target.value);
  dtb.querySelectorAll("button.w").forEach(b => b.onclick = () => setProp("width", +b.dataset.w));
  dtb.querySelectorAll("button.ds").forEach(b => b.onclick = () => setProp("dash", b.dataset.d === "solid" ? null : b.dataset.d));
  const ri = dtb.querySelector(".risk input");
  if (ri) ri.onchange = () => { S.riskUsd = Math.max(1, +ri.value || 10); try { localStorage.setItem("riskUsd", S.riskUsd); } catch (e) {} markDirty(); };
  dtb.querySelectorAll("button[data-a]").forEach(b => b.onclick = () => {
    const a = b.dataset.a;
    if (a === "label") { const cur = txt ? (dw.text || "") : (dw.label || ""); const v = prompt(txt ? "Текст:" : "Подпись к рисунку (пусто — убрать):", cur);
      if (v === null) return; if (txt) { if (v.trim()) setProp("text", v.replace(/\\n/g, "\n")); } else setProp("label", v.trim() ? v.trim() : null); }
    if (a === "lock") setProp("locked", dw.locked ? null : true);
    if (a === "clone") cloneSelected();
    if (a === "del") { if (dw.locked) { hintFlash("🔒 сначала открепите"); return; } delSelected(); }
  });
}

// ---------- список объектов ----------
const objList = document.createElement("div"); objList.id = "objList"; document.body.appendChild(objList);
for (const ev of ["pointerdown", "mousedown", "click", "wheel"]) objList.addEventListener(ev, e => e.stopPropagation());
function toggleObjList(){ objList.classList.toggle("show"); renderObjList(); renderTools(); }
function drawingSummary(dw){
  const p = dw.pts.map(x => fmtP(x.p));
  if (dw.type === "long" || dw.type === "short") { const pi = posInfo(dw); return `${fmtP(pi.e)} → цель ${fmtP(pi.tg)} / стоп ${fmtP(pi.st)} · R:R ${pi.rr.toFixed(2)}${pi.res ? " · " + pi.res : ""}`; }
  if (dw.type === "hline" || dw.type === "hray") return p[0];
  if (dw.type === "text" || dw.type === "callout") return `«${String(dw.text || "").slice(0, 24)}»`;
  if (dw.type === "brush") return `${dw.pts.length} точек`;
  return p.slice(0, 3).join(" → ") + (p.length > 3 ? " …" : "");
}
function renderObjList(){
  if (!objList.classList.contains("show")) return;
  const rows = S.drawings.map((dw, i) => `<div class="orow${dw === S.sel ? " on" : ""}" data-i="${i}"><span class="dot" style="background:${dw.color || "#2962ff"}"></span>`
    + `<span class="nm">${TYPE_NAMES[dw.type] || dw.type}${dw.label ? ` · ${dw.label}` : ""}</span><span class="k">${drawingSummary(dw)}</span>`
    + `<button data-a="eye" title="${dw.hidden ? "Показать" : "Скрыть"}">${dw.hidden ? "◌" : "👁"}</button><button data-a="del" title="Удалить">🗑</button></div>`).join("");
  objList.innerHTML = `<div class="oh"><b>Объекты на графике</b> <span class="k">${S.drawings.length}</span><button data-a="close">✕</button></div>`
    + (rows || `<div class="k" style="padding:8px">пока пусто — выберите инструмент слева</div>`);
  objList.querySelector("[data-a=close]").onclick = toggleObjList;
  objList.querySelectorAll(".orow").forEach(r => {
    const dw = S.drawings[+r.dataset.i];
    r.onclick = e => { if (e.target.dataset.a) return; select(dw); renderObjList(); };
    r.querySelector("[data-a=eye]").onclick = () => { snap(); if (dw.hidden) delete dw.hidden; else dw.hidden = true; saveDrawings(); markDirty(); };
    r.querySelector("[data-a=del]").onclick = () => { if (dw.locked) { hintFlash("🔒 сначала открепите"); return; } snap(); S.drawings = S.drawings.filter(x => x !== dw); if (S.sel === dw) select(null); saveDrawings(); markDirty(); };
  });
}

// ---------- чёткость и зум ----------
// Ctrl+колесо над графиком — зум графика, а не страницы; щипок на телефоне — тоже график (touch-action в CSS)
$("charts").addEventListener("wheel", e => { if (e.ctrlKey) e.preventDefault(); }, { passive:false });
// смена плотности пикселей (зум браузера, перенос окна на другой монитор) — перерисовать холсты в новом разрешении
(function watchDpr(){ const mq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
  const h = () => { markDirty(); mq.removeEventListener("change", h); watchDpr(); }; mq.addEventListener("change", h); })();

// ---------- боковые панели: ширина правой (тянуть за левый край), скрыть/показать правую и полосу инструментов ----------
const UI = Object.assign({ w:340, side:true, tools:true }, (() => { try { return JSON.parse(localStorage.getItem("uiSide") || "{}"); } catch (e) { return {}; } })());
function applyUI(save){
  const app = document.querySelector(".app");
  app.style.setProperty("--sideW", (UI.side ? UI.w : 0) + "px"); app.style.setProperty("--toolsW", (UI.tools ? 44 : 0) + "px");
  document.body.classList.toggle("side-hidden", !UI.side); document.body.classList.toggle("tools-hidden", !UI.tools);
  if (save) try { localStorage.setItem("uiSide", JSON.stringify(UI)); } catch (e) {}
  setTimeout(() => { setPaneHeights(); markDirty(); }, 30);
}
{ const grip = document.createElement("div"); grip.id = "sideGrip"; grip.title = "Потяните, чтобы изменить ширину панели"; $("side").appendChild(grip);
  grip.addEventListener("pointerdown", e => { e.preventDefault(); grip.setPointerCapture(e.pointerId); document.body.classList.add("sresizing");
    const x0 = e.clientX, w0 = $("side").getBoundingClientRect().width;
    const mv = ev => { UI.w = Math.round(Math.max(220, Math.min(Math.min(720, innerWidth * 0.6), w0 - (ev.clientX - x0)))); applyUI(false); };
    const up = () => { grip.removeEventListener("pointermove", mv); grip.removeEventListener("pointerup", up); document.body.classList.remove("sresizing"); applyUI(true); };
    grip.addEventListener("pointermove", mv); grip.addEventListener("pointerup", up); });
  grip.addEventListener("dblclick", () => { UI.w = 340; applyUI(true); });
  const hide = document.createElement("button"); hide.id = "sideHide"; hide.title = "Скрыть панель (вернуть — язычок у правого края или Alt+])"; hide.textContent = "»";
  document.querySelector("#side .tabs").appendChild(hide); hide.onclick = () => { UI.side = false; applyUI(true); };
  const show = document.createElement("button"); show.id = "sideShow"; show.title = "Показать панель"; show.textContent = "«"; document.body.appendChild(show);
  show.onclick = () => { UI.side = true; applyUI(true); };
  const tShow = document.createElement("button"); tShow.id = "toolsShow"; tShow.title = "Показать инструменты рисования (Alt+[)"; tShow.textContent = "»"; document.body.appendChild(tShow);
  tShow.onclick = () => { UI.tools = true; applyUI(true); };
  const tHide = document.createElement("button"); tHide.className = "tool"; tHide.title = "Скрыть полосу инструментов (Alt+[)"; tHide.innerHTML = "«"; tHide.style.marginTop = "auto";
  $("tools").appendChild(tHide); tHide.onclick = () => { UI.tools = false; applyUI(true); };
  const _rt = renderTools; renderTools = function(){ _rt(); $("tools").appendChild(tHide); };   // кнопка остаётся внизу после перерисовки
  document.addEventListener("keydown", e => { if (["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName) || !e.altKey) return;
    if (e.code === "BracketRight") { e.preventDefault(); UI.side = !UI.side; applyUI(true); }
    if (e.code === "BracketLeft") { e.preventDefault(); UI.tools = !UI.tools; applyUI(true); } });
  applyUI(false); }

// ---------- шкала цены: авто / лог / % (как кнопки в правом нижнем углу TradingView) ----------
const psm = document.createElement("div"); psm.id = "psm"; $("mainPane").appendChild(psm);
for (const ev of ["pointerdown", "mousedown", "wheel"]) psm.addEventListener(ev, e => e.stopPropagation());
S.psMode = (() => { try { return +localStorage.getItem("psMode") || 0; } catch (e) { return 0; } })();
function applyPsm(){ chart.priceScale("right").applyOptions({ mode: S.psMode, autoScale: true });
  psm.innerHTML = [["A", -1, "Автомасштаб (вернуть после ручного растягивания шкалы)"], ["лог", 1, "Логарифмическая шкала"], ["%", 2, "Шкала в процентах от первой видимой свечи"]]
    .map(([t, m, tip]) => `<button data-m="${m}" title="${tip}" class="${m === S.psMode ? "on" : ""}">${t}</button>`).join("");
  psm.querySelectorAll("button").forEach(b => b.onclick = () => { const m = +b.dataset.m;
    if (m >= 0) { S.psMode = S.psMode === m ? 0 : m; try { localStorage.setItem("psMode", S.psMode); } catch (e) {} }
    applyPsm(); markDirty(); }); }
applyPsm();

// ---------- «📤 На разбор» ----------
function analysisText(note, plan){
  const d = S.data, last = d[d.length - 1], ts = new Date();
  const fmtT = t => { const x = new Date(t * 1000); return `${String(x.getUTCDate()).padStart(2,"0")}.${String(x.getUTCMonth()+1).padStart(2,"0")}.${x.getUTCFullYear()} ${String(x.getUTCHours()).padStart(2,"0")}:${String(x.getUTCMinutes()).padStart(2,"0")}`; };
  const lines = ["#РАЗБОР v1",
    `Монета: ${S.base}/${S.quote} · ${EX[S.ex].name} · ${TF.find(x => x[0] === S.tf)[1]} · сейчас ${fmtT(ts.getTime() / 1000)} UTC · цена ${fmtP(last.close)}`];
  if (plan) lines.push(`План: ${plan}`);
  if (note) lines.push(`Мысль: ${note}`);
  const vis = S.drawings.filter(dw => !dw.hidden);
  lines.push(`Разметка (${vis.length}):`);
  vis.forEach((dw, i) => lines.push(`${i + 1}. ${TYPE_NAMES[dw.type] || dw.type}${dw.label ? ` «${dw.label}»` : ""}: `
    + (dw.type === "brush" ? `${dw.pts.length} точек, ${fmtT(dw.pts[0].t)} → ${fmtT(dw.pts[dw.pts.length - 1].t)}` : dw.pts.map(p => `${fmtT(p.t)} @ ${fmtP(p.p)}`).join(" → "))
    + (dw.text ? ` — «${dw.text.replace(/\n/g, " / ")}»` : "")
    + (dw.type === "long" || dw.type === "short" ? ` [R:R ${posInfo(dw).rr.toFixed(2)}${posInfo(dw).res ? ", " + posInfo(dw).res : ""}]` : "")));
  const iv = S.inds.map(inst => { const v = inst.vals.map(a => a && a[a.length - 1]).filter(x => x != null && isFinite(x)); return v.length ? `${instTitle(inst)} = ${v.map(x => +x.toPrecision(6)).join(" / ")}` : null; }).filter(Boolean);
  if (iv.length) lines.push(`Индикаторы: ${iv.join("; ")}`);
  if (typeof LIQ !== "undefined" && LIQ.on && LIQ.live && LIQ.sym === `${S.base}USDT`) {
    let up = 0, dn = 0; for (const g of LIQ.live) { if (Math.abs(g.p / LIQ.price - 1) > 0.1) continue; if (g.s === "S") up += g.usd; else dn += g.usd; }
    lines.push(`Карта ликвидаций ±10%: шорты выше $${(up / 1e6).toFixed(2)}M, лонги ниже $${(dn / 1e6).toFixed(2)}M`); }
  lines.push("JSON: " + JSON.stringify({ ex:S.ex, sym:`${S.base}/${S.quote}`, tf:S.tf, d:vis.map(({ type, pts, text, label }) =>
    ({ type, pts: pts.map(p => [Math.round(p.t), +p.p.toPrecision(8)]), ...(text ? { text } : {}), ...(label ? { label } : {}) })) }));
  return lines.join("\n");
}
function openAnalysis(){
  const pos = (S.sel && (S.sel.type === "long" || S.sel.type === "short")) ? S.sel : [...S.drawings].reverse().find(dw => dw.type === "long" || dw.type === "short");
  let plan = "";
  if (pos) { const pi = posInfo(pos); plan = `${pi.isLong ? "ЛОНГ" : "ШОРТ"} вход ${fmtP(pi.e)}, цель ${fmtP(pi.tg)} (${((pi.tg / pi.e - 1) * 100).toFixed(2)}%), стоп ${fmtP(pi.st)} (${((pi.st / pi.e - 1) * 100).toFixed(2)}%), R:R ${pi.rr.toFixed(2)}`; }
  $("anBox").innerHTML = `<h2>📤 Экспорт разметки</h2>
    <div class="k small">Вся разметка этого графика точными числами уйдёт в буфер обмена — вставьте её в чат (Ctrl+V).</div>
    <label class="col">Твоя мысль: куда пойдёт цена и почему<textarea id="anNote" rows="4" placeholder="например: пробой треугольника вверх на объёме, цель — верх канала"></textarea></label>
    <label class="col">План (вход / цель / стоп)${pos ? " — взят из инструмента «" + TYPE_NAMES[pos.type] + "»" : " — или поставьте инструмент «Лонг/Шорт»"}<input id="anPlan" type="text" value="${plan.replace(/"/g, "&quot;")}"></label>
    <div class="btns"><button id="anCancel">Отмена</button><button class="pri" id="anCopy">📋 Скопировать</button></div><textarea id="anOut" rows="5" style="display:none;width:100%"></textarea>`;
  $("anModal").classList.add("show"); setTimeout(() => $("anNote").focus(), 30);
  $("anCancel").onclick = () => $("anModal").classList.remove("show");
  $("anCopy").onclick = async () => {
    const t = analysisText($("anNote").value.trim(), $("anPlan").value.trim());
    try { await navigator.clipboard.writeText(t); toast("📋 Скопировано — вставьте в чат (Ctrl+V)"); $("anModal").classList.remove("show"); }
    catch (e) { const o = $("anOut"); o.style.display = "block"; o.value = t; o.select(); try { document.execCommand("copy"); toast("📋 Скопировано"); } catch (e2) { toast("Скопируйте текст из поля вручную"); } }
  };
}
$("btnAn").onclick = openAnalysis;
