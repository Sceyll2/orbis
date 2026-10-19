// «Как в TradingView» (09.10.2026): повтор истории (Bar Replay), контекстное меню, быстрый поиск монеты набором букв,
// стиль инструментов по умолчанию (последний выбранный), клавиатура (← → прокрутка, + − зум, Home, Ctrl+Y повтор).

// ---------- повтор истории ----------
const RP = { on:false, pick:false, full:null, idx:0, timer:null, speed:2 };
const rpl = document.createElement("div"); rpl.id = "rpl"; document.body.appendChild(rpl);
for (const ev of ["pointerdown", "mousedown", "wheel"]) rpl.addEventListener(ev, e => e.stopPropagation());
function rpRender(){
  if (!RP.on && !RP.pick) { rpl.style.display = "none"; $("btnReplay").classList.remove("on"); return; }
  $("btnReplay").classList.add("on"); rpl.style.display = "flex";
  if (RP.pick) { rpl.innerHTML = `<span>⏪ Кликните по свече, с которой начать повтор</span><button data-a="exit">Отмена</button>`; }
  else { const b = S.data[S.data.length - 1], left = RP.full.length - S.data.length;
    rpl.innerHTML = `<button data-a="play" title="Пуск / пауза (пробел)">${RP.timer ? "⏸" : "▶"}</button><button data-a="step" title="Следующая свеча (Shift+→)">⏭</button>`
      + `<select data-a="speed" title="Скорость">${[1, 2, 5, 10, 20].map(v => `<option value="${v}" ${v === RP.speed ? "selected" : ""}>${v} св/с</option>`).join("")}</select>`
      + `<span class="k">${dateStr(b.time)} · впереди ${left} св.</span><button data-a="again" title="Выбрать другую точку начала">↺</button><button data-a="exit" title="Выйти из повтора — вернуть весь график">✕ Выйти</button>`; }
  rpl.querySelectorAll("button").forEach(x => x.onclick = () => rpAction(x.dataset.a));
  const sp = rpl.querySelector("select"); if (sp) sp.onchange = () => { RP.speed = +sp.value; if (RP.timer) { rpPause(); rpPlay(); } };
}
function rpAction(a){
  if (a === "play") RP.timer ? rpPause() : rpPlay();
  if (a === "step") { rpPause(); rpStep(); }
  if (a === "again") { rpExit(); rpStart(); }
  if (a === "exit") rpExit();
}
function rpStart(){ if (!S.data.length) return; rpPause(); RP.pick = true; RP.on = false; hint("⏪ повтор: кликните по свече, с которой начать"); rpRender(); }
function rpBegin(i){
  RP.pick = false; RP.on = true; RP.full = S.data.slice(); RP.idx = Math.max(20, Math.min(i, RP.full.length - 2));
  S.data = RP.full.slice(0, RP.idx + 1); setPriceAll(); renderAllInds(); quote(); hint(""); markDirty();
  chart.timeScale().scrollToRealTime(); rpRender();
}
function rpStep(){
  if (!RP.on) return false; if (S.data.length >= RP.full.length) { rpPause(); hintFlash("⏪ дошли до текущей свечи"); return false; }
  const bar = RP.full[S.data.length]; S.data.push(bar);
  if (S.ctype === "ha") setPriceAll();
  else { price.update((S.ctype === "line" || S.ctype === "area") ? { time:bar.time, value:bar.close } : { time:bar.time, open:bar.open, high:bar.high, low:bar.low, close:bar.close });
    if (S.vol) volS.update({ time:bar.time, value:bar.volume, color:volColor(bar) }); }
  renderAllInds(); quote(); markDirty(); rpRender(); return true;
}
function rpPlay(){ if (!RP.on || RP.timer) return; RP.timer = setInterval(() => { if (!rpStep()) rpPause(); }, 1000 / RP.speed); rpRender(); }
function rpPause(){ if (RP.timer) { clearInterval(RP.timer); RP.timer = null; } rpRender(); }
function rpExit(){
  rpPause(); const was = RP.on; RP.pick = false; RP.on = false; hint("");
  if (was && RP.full) { S.data = RP.full; RP.full = null; setPriceAll(); renderAllInds(); quote(); markDirty(); chart.timeScale().scrollToRealTime(); }
  rpRender();
}
// живые свечи во время повтора копятся в полной истории, на экран не идут; догрузка старой истории — после выхода
{ const _up = upsert; upsert = function(bar){ if (!RP.on) return _up(bar); const f = RP.full, l = f[f.length - 1];
    if (bar.time === l.time) f[f.length - 1] = bar; else if (bar.time > l.time) f.push(bar); };
  const _lo = loadOlder; loadOlder = function(n){ return RP.on || RP.pick ? Promise.resolve(0) : _lo(n); };
  const _ld = load; load = function(fit){ if (RP.on || RP.pick) rpExit(); return _ld(fit); }; }
$("btnReplay").onclick = () => (RP.on || RP.pick) ? rpExit() : rpStart();
$("mainPane").addEventListener("pointerdown", e => {
  if (!RP.pick || e.button !== 0) return; const r = $("mainPane").getBoundingClientRect();
  const lg = chart.timeScale().coordinateToLogical(e.clientX - r.left); if (lg == null) return;
  e.stopPropagation(); e.preventDefault(); rpBegin(Math.round(lg));
}, true);

// ---------- контекстное меню ----------
const ctx = document.createElement("div"); ctx.id = "ctx"; document.body.appendChild(ctx);
for (const ev of ["pointerdown", "mousedown", "wheel"]) ctx.addEventListener(ev, e => e.stopPropagation());
function ctxHide(){ ctx.style.display = "none"; }
document.addEventListener("pointerdown", ctxHide); document.addEventListener("keydown", e => { if (e.key === "Escape") ctxHide(); });
$("mainPane").addEventListener("contextmenu", e => {
  const r = $("mainPane").getBoundingClientRect(), m = { x:e.clientX - r.left, y:e.clientY - r.top };
  if (m.x > plotW() || m.y > plotH() || !S.data.length) return;
  e.preventDefault(); e.stopPropagation();
  const dw = [...S.drawings].reverse().find(d => !d.hidden && hit(d, m)), pt = fromXY(m.x, m.y); if (!pt) return;
  let items;
  if (dw) { select(dw);
    items = [["⧉ Копия", () => cloneSelected()], [dw.locked ? "🔓 Открепить" : "🔒 Закрепить", () => setProp("locked", dw.locked ? null : true)],
      ["Aa Подпись…", () => dtb.querySelector('[data-a="label"]')?.click()], ["◌ Скрыть", () => { snap(); dw.hidden = true; select(null); saveDrawings(); }],
      ["⭐ Сделать стиль по умолчанию для «" + (TYPE_NAMES[dw.type] || dw.type) + "»", () => saveDefStyle(dw)],
      ["🗑 Удалить", () => { if (dw.locked) { hintFlash("🔒 сначала открепите"); return; } delSelected(); }]];
  } else {
    const p = +pt.p.toPrecision(8);
    items = [[`— Уровень ${fmtP(p)}`, () => finishDrawing({ type:"hline", pts:[pt], id:Date.now() })],
      [`🔔 Оповещение при пересечении ${fmtP(p)}`, () => addAlert({ base:S.base, quote:S.quote, type:"cross", level:+p.toFixed(S.prec ?? 2) })],
      ...(tgMode() ? [[`📲 Оповещение в Telegram (работает при закрытом терминале)`, () => window.open(tgAlertLink({ base:S.base, quote:S.quote, type:"cross", level:+p.toFixed(S.prec ?? 2) }), "_blank")]] : []),
      [`📈 Лонг отсюда (${fmtP(p)})`, () => finishDrawing({ type:"long", pts:[pt], id:Date.now() })],
      [`📉 Шорт отсюда (${fmtP(p)})`, () => finishDrawing({ type:"short", pts:[pt], id:Date.now() })],
      ["⏪ Повтор истории с этой свечи", () => { const lg = chart.timeScale().coordinateToLogical(m.x); if (lg != null) { RP.pick = false; rpBegin(Math.round(lg)); } }],
      ["⤢ Показать весь график", () => { chart.timeScale().fitContent(); }], ["⇥ К последней свече", () => chart.timeScale().scrollToRealTime()],
      [S.hidden ? "👁 Показать рисунки" : "◌ Скрыть все рисунки", () => { S.hidden = !S.hidden; renderTools(); markDirty(); }],
      ["📤 Экспорт разметки…", () => openAnalysis()]];
  }
  ctx.innerHTML = items.map(([t], i) => `<div class="ci" data-i="${i}">${t}</div>`).join("");
  ctx.querySelectorAll(".ci").forEach(el => el.onclick = () => { ctxHide(); items[+el.dataset.i][1](); });
  ctx.style.display = "block";
  ctx.style.left = Math.min(e.clientX, innerWidth - ctx.offsetWidth - 6) + "px"; ctx.style.top = Math.min(e.clientY, innerHeight - ctx.offsetHeight - 6) + "px";
});

// ---------- стиль инструмента по умолчанию ----------
function defStyle(type){ try { return JSON.parse(localStorage.getItem("dstyle:" + type) || "null"); } catch (e) { return null; } }
function saveDefStyle(dw){ const st = {}; for (const k of ["color", "width", "dash"]) if (dw[k] != null) st[k] = dw[k];
  try { localStorage.setItem("dstyle:" + dw.type, JSON.stringify(st)); } catch (e) {} hintFlash(`⭐ стиль «${TYPE_NAMES[dw.type] || dw.type}» сохранён по умолчанию`); }
{ const _fd = finishDrawing; finishDrawing = function(dw){ const st = defStyle(dw.type); if (st) for (const k in st) if (dw[k] == null) dw[k] = st[k]; return _fd(dw); };
  // изменил цвет/толщину/пунктир на панели — это и становится стилем по умолчанию для этого инструмента (как в TradingView)
  const _sp = setProp; setProp = function(k, v){ _sp(k, v); if (S.sel && ["color", "width", "dash"].includes(k)) {
    const st = defStyle(S.sel.type) || {}; if (v === null) delete st[k]; else st[k] = v; try { localStorage.setItem("dstyle:" + S.sel.type, JSON.stringify(st)); } catch (e) {} } }; }

// ---------- повтор отменённого (Ctrl+Y / Ctrl+Shift+Z) ----------
S.redo = [];
{ const _snap = snap; snap = function(){ _snap(); S.redo = []; };
  const _undo = undo; undo = function(){ if (S.undo && S.undo.length) S.redo.push(JSON.stringify(S.drawings.map(({ _temp, ...r }) => r))); _undo(); }; }
function redo(){ if (!S.redo.length) { hintFlash("повторять нечего"); return; }
  S.undo = (S.undo || []).slice(-49); S.undo.push(JSON.stringify(S.drawings.map(({ _temp, ...r }) => r)));
  S.drawings = JSON.parse(S.redo.pop()); select(null); saveDrawings(); markDirty(); hintFlash("↷ повторено"); }

// случайно нажатая буква не должна грузить монету «X»: Esc — вернуть прежнюю, ввод короче 2 символов — игнорируется
$("sym").onchange = () => { const s = $("sym"); if (s.value.trim().length < 2) { s.value = s.dataset.prev || `${S.base}/${S.quote}`; return; } load(); };
$("sym").addEventListener("keydown", e => { if (e.key === "Escape") { e.target.value = e.target.dataset.prev || `${S.base}/${S.quote}`; e.target.blur(); } });

// ---------- клавиатура ----------
document.addEventListener("keydown", e => {
  const tag = e.target.tagName; if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
  const ts = chart.timeScale();
  if ((e.ctrlKey || e.metaKey) && (e.code === "KeyY" || (e.shiftKey && e.code === "KeyZ"))) { e.preventDefault(); redo(); return; }
  if (RP.on && e.code === "Space") { e.preventDefault(); RP.timer ? rpPause() : rpPlay(); return; }
  if (RP.on && e.shiftKey && e.code === "ArrowRight") { e.preventDefault(); rpPause(); rpStep(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.code === "ArrowLeft" || e.code === "ArrowRight") { e.preventDefault(); ts.scrollToPosition(ts.scrollPosition() + (e.code === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 30 : 5), false); return; }
  if (e.key === "+" || e.key === "=" || e.key === "-" || e.key === "_") { e.preventDefault(); const r = ts.getVisibleLogicalRange(); if (!r) return;
    const k = (e.key === "+" || e.key === "=") ? 0.8 : 1.25, w = (r.to - r.from) * k; ts.setVisibleLogicalRange({ from: r.to - w, to: r.to }); return; }
  if (e.code === "Home") { e.preventDefault(); ts.scrollToRealTime(); return; }
  // быстрый поиск монеты: начали печатать буквы на графике — открывается поле символа (как в TradingView)
  if (/^[a-zA-Zа-яА-Я0-9]$/.test(e.key) && !e.shiftKey) {
    const map = { ф:"a", и:"b", с:"c", в:"d", у:"e", а:"f", п:"g", р:"h", ш:"i", о:"j", л:"k", д:"l", ь:"m", т:"n", щ:"o", з:"p", й:"q", к:"r", ы:"s", е:"t", г:"u", м:"v", ц:"w", ч:"x", н:"y", я:"z" };
    const ch = (map[e.key.toLowerCase()] || e.key).toUpperCase();
    e.preventDefault(); const s = $("sym"); s.dataset.prev = `${S.base}/${S.quote}`; s.value = ch; s.focus(); s.setSelectionRange(1, 1);
    if (typeof isMobile === "function" && isMobile()) return;
  }
});
