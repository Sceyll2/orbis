"use strict";
// ================= расчёты =================
const A = {
  sma(a,n){ const o=Array(a.length).fill(null); let s=0,c=0,q=[]; for(let i=0;i<a.length;i++){ const v=a[i]; if(v==null||!isFinite(v)){ s=0;c=0;q=[]; continue; } q.push(v); s+=v; if(q.length>n) s-=q.shift(); if(q.length===n) o[i]=s/n; } return o; },
  ema(a,n){ const o=Array(a.length).fill(null), k=2/(n+1); let e=null,s=0,c=0; for(let i=0;i<a.length;i++){ const v=a[i]; if(v==null||!isFinite(v)) continue;
    if(e===null){ s+=v; c++; if(c===n){ e=s/n; o[i]=e; } } else { e=v*k+e*(1-k); o[i]=e; } } return o; },
  rma(a,n){ const o=Array(a.length).fill(null); let e=null,s=0,c=0; for(let i=0;i<a.length;i++){ const v=a[i]; if(v==null||!isFinite(v)) continue;
    if(e===null){ s+=v; c++; if(c===n){ e=s/n; o[i]=e; } } else { e=(e*(n-1)+v)/n; o[i]=e; } } return o; },
  wma(a,n){ const o=Array(a.length).fill(null), den=n*(n+1)/2; for(let i=n-1;i<a.length;i++){ let s=0,ok=true; for(let j=0;j<n;j++){ const v=a[i-n+1+j]; if(v==null){ok=false;break;} s+=v*(j+1);} if(ok) o[i]=s/den; } return o; },
  std(a,n){ const o=Array(a.length).fill(null); for(let i=n-1;i<a.length;i++){ let s=0,s2=0,ok=true; for(let j=i-n+1;j<=i;j++){ const v=a[j]; if(v==null){ok=false;break;} s+=v; s2+=v*v; } if(ok){ const m=s/n; o[i]=Math.sqrt(Math.max(0,s2/n-m*m)); } } return o; },
  hh(a,n){ const o=Array(a.length).fill(null); for(let i=n-1;i<a.length;i++){ let m=-Infinity; for(let j=i-n+1;j<=i;j++) if(a[j]!=null&&a[j]>m) m=a[j]; o[i]=isFinite(m)?m:null; } return o; },
  ll(a,n){ const o=Array(a.length).fill(null); for(let i=n-1;i<a.length;i++){ let m=Infinity; for(let j=i-n+1;j<=i;j++) if(a[j]!=null&&a[j]<m) m=a[j]; o[i]=isFinite(m)?m:null; } return o; },
  sub(a,b){ return a.map((v,i)=> v==null||b[i]==null?null:v-b[i]); },
  tr(d){ return d.map((x,i)=> i===0? x.high-x.low : Math.max(x.high-x.low, Math.abs(x.high-d[i-1].close), Math.abs(x.low-d[i-1].close))); },
  rsi(c,n){ const ch=c.map((x,i)=>i&&x!=null&&c[i-1]!=null?x-c[i-1]:null), g=A.rma(ch.map(v=>v==null?null:Math.max(v,0)),n), l=A.rma(ch.map(v=>v==null?null:Math.max(-v,0)),n);
    return g.map((v,i)=>v==null||l[i]==null?null:100-100/(1+v/(l[i]||1e-12))); },
  sum(a,n){ const o=Array(a.length).fill(null); let s=0,q=0; for(let i=0;i<a.length;i++){ const v=a[i]; if(v==null){ s=0;q=0; continue; } s+=v; q++; if(q>n){ s-=a[i-n]; q=n; } if(q===n) o[i]=s; } return o; },
  swma(a){ return a.map((v,i)=> i<3||v==null||a[i-1]==null||a[i-2]==null||a[i-3]==null?null:(a[i-3]+2*a[i-2]+2*a[i-1]+v)/6); },
  roc(a,n){ return a.map((v,i)=> i<n||v==null||!a[i-n]?null:100*(v/a[i-n]-1)); },
  chg(a){ return a.map((v,i)=> !i||v==null||a[i-1]==null?null:v-a[i-1]); },
  mul(a,k){ return a.map(v=>v==null?null:v*k); },
  add(a,b){ return a.map((v,i)=> v==null||b[i]==null?null:v+b[i]); },
  ref(a,n){ return a.map((_,i)=> i<n?null:a[i-n]); },
  cum(a){ let s=0; return a.map(v=>{ if(v!=null) s+=v; return s; }); },
  tsi(c,r,s){ const m=A.chg(c), num=A.ema(A.ema(m,r),s), den=A.ema(A.ema(m.map(v=>v==null?null:Math.abs(v)),r),s); return num.map((v,i)=>v==null||!den[i]?null:100*v/den[i]); },
  adl(d){ let s=0; return d.map(x=>{ const r=x.high-x.low; s+= r? ((x.close-x.low)-(x.high-x.close))/r*x.volume : 0; return s; }); },
};
const IH2 = d => d.map(x=>(x.high+x.low)/2), ICL = d => d.map(x=>x.close);
const C = ["#2962ff","#f7a600","#e040fb","#00bcd4","#ff5252","#66bb6a","#ffeb3b","#ff9800","#9c27b0","#26c6da"];

// ================= свои формулы (безопасный разбор, без eval) =================
// пример: ema(close,9) - ema(close,21)   ·   rsi(close,14) < 30 and close > sma(close,200)
const EXTRA_NAMES = ["funding","oi","premium","dvol","vix","spx","ust10","ust2","real10","fng","stables","tvl","mvrv","netflow","aaddr","lsr","delta"];
const F_HELP = "Ряды: open high low close volume hl2 hlc3 ohlc4 · внешние данные: funding (финансирование фьючерса), oi (открытый интерес), "
  + "premium (премия Coinbase), dvol (волатильность опционов), vix, spx, ust10, ust2, real10 (доходности), fng (страх/жадность), stables (стейблкоины, млрд $), "
  + "tvl (деньги в сети, млн $), mvrv, netflow (приток на биржи), aaddr (активные адреса), lsr (лонг/шорт), delta (покупки − продажи) · функции: sma ema wma rsi std hh ll atr roc "
  + "ref change abs max min cross crossunder · операции: + - * / > < >= <= == and or not";
function formulaNames(expr){ return [...new Set((String(expr).match(/[A-Za-z_][A-Za-z0-9_]*/g) || []).map(x=>x.toLowerCase()))]; }
function evalFormula(expr, d, env){
  const toks = []; const re = /\s*(\d+\.?\d*|[A-Za-z_][A-Za-z0-9_]*|>=|<=|==|!=|&&|\|\||[-+*/(),<>!])/y; let m, pos = 0;
  while (pos < expr.length) { re.lastIndex = pos; m = re.exec(expr); if (!m || m.index !== pos) { if (/^\s*$/.test(expr.slice(pos))) break; throw new Error(`непонятный символ: «${expr.slice(pos, pos+8)}»`); } toks.push(m[1]); pos = re.lastIndex; }
  let i = 0; const n = d.length; const peek = () => toks[i], take = t => { if (t && toks[i] !== t) throw new Error(`ожидалось «${t}»`); return toks[i++]; };
  const S0 = { open:d.map(x=>x.open), high:d.map(x=>x.high), low:d.map(x=>x.low), close:d.map(x=>x.close), volume:d.map(x=>x.volume),
    hl2:d.map(x=>(x.high+x.low)/2), hlc3:d.map(x=>(x.high+x.low+x.close)/3), ohlc4:d.map(x=>(x.open+x.high+x.low+x.close)/4) };
  const arr = v => Array.isArray(v) ? v : Array(n).fill(v);
  const bin = (a, b, f) => { a = arr(a); b = arr(b); return a.map((x,k)=> x==null||b[k]==null ? null : f(x, b[k])); };
  const num = v => { if (Array.isArray(v)) throw new Error("здесь нужно число (период), а не ряд"); return Math.max(1, Math.round(v)); };
  const FN = {
    sma:(x,p)=>A.sma(arr(x),num(p)), ema:(x,p)=>A.ema(arr(x),num(p)), wma:(x,p)=>A.wma(arr(x),num(p)), rsi:(x,p)=>A.rsi(arr(x),num(p)),
    std:(x,p)=>A.std(arr(x),num(p)), hh:(x,p)=>A.hh(arr(x),num(p)), ll:(x,p)=>A.ll(arr(x),num(p)), atr:(p)=>A.rma(A.tr(d),num(p)),
    roc:(x,p)=>{ x=arr(x); const k=num(p); return x.map((v,j)=> j<k||v==null||x[j-k]==null?null:100*(v/x[j-k]-1)); },
    ref:(x,p)=>{ x=arr(x); const k=num(p); return x.map((_,j)=> j<k?null:x[j-k]); },
    change:(x)=>{ x=arr(x); return x.map((v,j)=> !j||v==null||x[j-1]==null?null:v-x[j-1]); },
    abs:(x)=>arr(x).map(v=>v==null?null:Math.abs(v)), max:(a,b)=>bin(a,b,Math.max), min:(a,b)=>bin(a,b,Math.min),
    cross:(a,b)=>{ a=arr(a); b=arr(b); return a.map((v,j)=> !j||v==null||b[j]==null||a[j-1]==null||b[j-1]==null?null:(a[j-1]<=b[j-1]&&v>b[j]?1:0)); },
    crossunder:(a,b)=>{ a=arr(a); b=arr(b); return a.map((v,j)=> !j||v==null||b[j]==null||a[j-1]==null||b[j-1]==null?null:(a[j-1]>=b[j-1]&&v<b[j]?1:0)); },
  };
  function primary(){
    const t = take(); if (t == null) throw new Error("формула оборвалась");
    if (/^\d/.test(t)) return parseFloat(t);
    if (t === "(") { const v = orE(); take(")"); return v; }
    if (/^[A-Za-z_]/.test(t)) { const name = t.toLowerCase();
      if (peek() === "(") { take("("); const args = []; if (peek() !== ")") { args.push(orE()); while (peek() === ",") { take(","); args.push(orE()); } } take(")");
        if (!FN[name]) throw new Error(`нет функции «${t}»`); return FN[name](...args); }
      if (env && env[name] !== undefined) return env[name];
      if (S0[name]) return S0[name];
      if (EXTRA_NAMES.includes(name)) throw new Error(`ряд «${name}» ещё загружается — повторите через пару секунд`);
      throw new Error(`неизвестное имя «${t}»`); }
    throw new Error(`лишний символ «${t}»`);
  }
  function unary(){ const t = peek(); if (t === "-") { take(); return bin(0, unary(), (a,b)=>a-b); } if (t === "!" || (t && t.toLowerCase() === "not")) { take(); return arr(unary()).map(v=>v==null?null:(v?0:1)); } return primary(); }
  function mul(){ let v = unary(); while (peek() === "*" || peek() === "/") { const op = take(); const r = unary(); v = bin(v, r, op === "*" ? (a,b)=>a*b : (a,b)=> b===0?null:a/b); } return v; }
  function add(){ let v = mul(); while (peek() === "+" || peek() === "-") { const op = take(); const r = mul(); v = bin(v, r, op === "+" ? (a,b)=>a+b : (a,b)=>a-b); } return v; }
  function cmp(){ let v = add(); const ops = {">":(a,b)=>a>b?1:0, "<":(a,b)=>a<b?1:0, ">=":(a,b)=>a>=b?1:0, "<=":(a,b)=>a<=b?1:0, "==":(a,b)=>a===b?1:0, "!=":(a,b)=>a!==b?1:0};
    if (ops[peek()]) { const op = take(); v = bin(v, add(), ops[op]); } return v; }
  function andE(){ let v = cmp(); while (peek() && (peek().toLowerCase() === "and" || peek() === "&&")) { take(); v = bin(v, cmp(), (a,b)=>a&&b?1:0); } return v; }
  function orE(){ let v = andE(); while (peek() && (peek().toLowerCase() === "or" || peek() === "||")) { take(); v = bin(v, andE(), (a,b)=>a||b?1:0); } return v; }
  if (!toks.length) throw new Error("пустая формула");
  const out = orE(); if (i < toks.length) throw new Error(`лишнее в конце: «${toks.slice(i).join(" ")}»`);
  return arr(out).map(v => v == null || !isFinite(v) ? null : v);
}

// ================= индикаторы =================
// calc(d, p, ctx) -> {lines:[{name, data (значения по барам), color, type:"hist", width, style, shift, dots}]}
const IND = [
  { id:"sma", name:"SMA — простая скользящая средняя", short:"SMA", cat:"Средние", main:true, params:{period:20}, calc:(d,p)=>({lines:[{name:"SMA",data:A.sma(d.map(x=>x.close),p.period)}]}) },
  { id:"ema", name:"EMA — экспоненциальная средняя", short:"EMA", cat:"Средние", main:true, params:{period:21}, calc:(d,p)=>({lines:[{name:"EMA",data:A.ema(d.map(x=>x.close),p.period)}]}) },
  { id:"wma", name:"WMA — взвешенная средняя", short:"WMA", cat:"Средние", main:true, params:{period:20}, calc:(d,p)=>({lines:[{name:"WMA",data:A.wma(d.map(x=>x.close),p.period)}]}) },
  { id:"hma", name:"HMA — средняя Халла", short:"HMA", cat:"Средние", main:true, params:{period:21},
    calc:(d,p)=>{ const c=d.map(x=>x.close), n=p.period; const raw=A.sub(A.wma(c,Math.round(n/2)).map(v=>v==null?null:2*v), A.wma(c,n)); return {lines:[{name:"HMA",data:A.wma(raw,Math.round(Math.sqrt(n)))}]}; } },
  { id:"dema", name:"DEMA — двойная экспоненциальная", short:"DEMA", cat:"Средние", main:true, params:{period:21},
    calc:(d,p)=>{ const e1=A.ema(d.map(x=>x.close),p.period), e2=A.ema(e1,p.period); return {lines:[{name:"DEMA",data:e1.map((v,i)=>v==null||e2[i]==null?null:2*v-e2[i])}]}; } },
  { id:"tema", name:"TEMA — тройная экспоненциальная", short:"TEMA", cat:"Средние", main:true, params:{period:21},
    calc:(d,p)=>{ const e1=A.ema(d.map(x=>x.close),p.period), e2=A.ema(e1,p.period), e3=A.ema(e2,p.period); return {lines:[{name:"TEMA",data:e1.map((v,i)=>v==null||e2[i]==null||e3[i]==null?null:3*v-3*e2[i]+e3[i])}]}; } },
  { id:"vwma", name:"VWMA — средняя, взвешенная по объёму", short:"VWMA", cat:"Средние", main:true, params:{period:20},
    calc:(d,p)=>{ const pv=A.sma(d.map(x=>x.close*x.volume),p.period), v=A.sma(d.map(x=>x.volume),p.period); return {lines:[{name:"VWMA",data:pv.map((x,i)=>x==null||!v[i]?null:x/v[i])}]}; } },
  { id:"vwap", name:"VWAP — средняя цена по объёму (за сутки UTC)", short:"VWAP", cat:"Средние", main:true, params:{},
    calc:(d)=>{ let day=null,pv=0,vv=0; return {lines:[{name:"VWAP",color:"#ff9800",data:d.map(x=>{ const dd=Math.floor(x.time/86400); if(dd!==day){day=dd;pv=0;vv=0;} pv+=(x.high+x.low+x.close)/3*x.volume; vv+=x.volume; return vv?pv/vv:null; })}]}; } },
  { id:"linreg", name:"Линейная регрессия (скользящая)", short:"LinReg", cat:"Средние", main:true, params:{period:50},
    calc:(d,p)=>{ const c=d.map(x=>x.close), n=p.period; return {lines:[{name:"LinReg",data:c.map((_,i)=>{ if(i<n-1) return null; let sx=0,sy=0,sxy=0,sxx=0; for(let j=0;j<n;j++){ const y=c[i-n+1+j]; sx+=j; sy+=y; sxy+=j*y; sxx+=j*j; } const b=(n*sxy-sx*sy)/(n*sxx-sx*sx); return (sy-b*sx)/n+b*(n-1); })}]}; } },
  { id:"bb", name:"Полосы Боллинджера", short:"BB", cat:"Каналы", main:true, params:{period:20, mult:2},
    calc:(d,p)=>{ const c=d.map(x=>x.close), m=A.sma(c,p.period), s=A.std(c,p.period); return {lines:[
      {name:"верх",data:m.map((v,i)=>v==null?null:v+p.mult*s[i]),color:"#2196f3",width:1},{name:"середина",data:m,color:"#ff9800",width:1},{name:"низ",data:m.map((v,i)=>v==null?null:v-p.mult*s[i]),color:"#2196f3",width:1}]}; } },
  { id:"kc", name:"Канал Кельтнера", short:"KC", cat:"Каналы", main:true, params:{period:20, atr:10, mult:2},
    calc:(d,p)=>{ const m=A.ema(d.map(x=>x.close),p.period), at=A.rma(A.tr(d),p.atr); return {lines:[
      {name:"верх",data:m.map((v,i)=>v==null||at[i]==null?null:v+p.mult*at[i]),color:"#26a69a",width:1},{name:"середина",data:m,color:"#26a69a",width:1,style:2},{name:"низ",data:m.map((v,i)=>v==null||at[i]==null?null:v-p.mult*at[i]),color:"#26a69a",width:1}]}; } },
  { id:"dc", name:"Канал Дончиана", short:"DC", cat:"Каналы", main:true, params:{period:20},
    calc:(d,p)=>{ const u=A.hh(d.map(x=>x.high),p.period), l=A.ll(d.map(x=>x.low),p.period); return {lines:[
      {name:"верх",data:u,color:"#7e57c2",width:1},{name:"середина",data:u.map((v,i)=>v==null?null:(v+l[i])/2),color:"#7e57c2",width:1,style:2},{name:"низ",data:l,color:"#7e57c2",width:1}]}; } },
  { id:"env", name:"Конверты (Envelopes)", short:"ENV", cat:"Каналы", main:true, params:{period:20, pct:2.5},
    calc:(d,p)=>{ const m=A.sma(d.map(x=>x.close),p.period); return {lines:[
      {name:"верх",data:m.map(v=>v==null?null:v*(1+p.pct/100)),color:"#ec407a",width:1},{name:"середина",data:m,color:"#ec407a",width:1,style:2},{name:"низ",data:m.map(v=>v==null?null:v*(1-p.pct/100)),color:"#ec407a",width:1}]}; } },
  { id:"ichi", name:"Облако Ишимоку", short:"Ichimoku", cat:"Тренд", main:true, params:{tenkan:9, kijun:26, senkou:52},
    calc:(d,p)=>{ const h=d.map(x=>x.high), l=d.map(x=>x.low); const mid=n=>{ const a=A.hh(h,n), b=A.ll(l,n); return a.map((v,i)=>v==null?null:(v+b[i])/2); };
      const t=mid(p.tenkan), k=mid(p.kijun), sb=mid(p.senkou), sa=t.map((v,i)=>v==null||k[i]==null?null:(v+k[i])/2);
      return {lines:[{name:"тенкан",data:t,color:"#2962ff",width:1},{name:"киджун",data:k,color:"#b71c1c",width:1},{name:"сенкоу A",data:sa,color:"#43a047",width:1,shift:p.kijun},
        {name:"сенкоу B",data:sb,color:"#e53935",width:1,shift:p.kijun},{name:"чикоу",data:d.map(x=>x.close),color:"#9e9e9e",width:1,shift:-p.kijun}]}; } },
  { id:"psar", name:"Parabolic SAR", short:"SAR", cat:"Тренд", main:true, params:{step:0.02, max:0.2},
    calc:(d,p)=>{ const o=Array(d.length).fill(null); if(d.length<3) return {lines:[]}; let up=d[1].close>d[0].close, sar=up?d[0].low:d[0].high, ep=up?d[1].high:d[1].low, af=p.step;
      for(let i=1;i<d.length;i++){ sar=sar+af*(ep-sar); if(up){ sar=Math.min(sar,d[i-1].low,i>1?d[i-2].low:d[i-1].low); if(d[i].low<sar){ up=false; sar=ep; ep=d[i].low; af=p.step; } else if(d[i].high>ep){ ep=d[i].high; af=Math.min(af+p.step,p.max); } }
        else { sar=Math.max(sar,d[i-1].high,i>1?d[i-2].high:d[i-1].high); if(d[i].high>sar){ up=true; sar=ep; ep=d[i].high; af=p.step; } else if(d[i].low<ep){ ep=d[i].low; af=Math.min(af+p.step,p.max); } } o[i]=sar; }
      return {lines:[{name:"SAR",data:o,color:"#ab47bc",dots:true}]}; } },
  { id:"st", name:"Supertrend", short:"Supertrend", cat:"Тренд", main:true, params:{atr:10, mult:3},
    calc:(d,p)=>{ const at=A.rma(A.tr(d),p.atr); const up=Array(d.length).fill(null), dn=Array(d.length).fill(null); let fu=null,fl=null,trend=1;
      for(let i=0;i<d.length;i++){ if(at[i]==null) continue; const m=(d[i].high+d[i].low)/2, bu=m+p.mult*at[i], bl=m-p.mult*at[i];
        fu = fu==null||bu<fu||d[i-1].close>fu ? bu : fu; fl = fl==null||bl>fl||d[i-1].close<fl ? bl : fl;
        if(trend===1 && d[i].close<fl) trend=-1; else if(trend===-1 && d[i].close>fu) trend=1; if(trend===1) up[i]=fl; else dn[i]=fu; }
      return {lines:[{name:"вверх",data:up,color:"#089981",width:2},{name:"вниз",data:dn,color:"#f23645",width:2}]}; } },
  { id:"rsi", name:"RSI — индекс относительной силы", short:"RSI", cat:"Осцилляторы", params:{period:14}, levels:[70,30], range:[0,100],
    calc:(d,p)=>({lines:[{name:"RSI",data:A.rsi(d.map(x=>x.close),p.period),color:"#7e57c2"}]}) },
  { id:"macd", name:"MACD", short:"MACD", cat:"Осцилляторы", params:{fast:12, slow:26, signal:9}, levels:[0], crossLine:1,
    calc:(d,p)=>{ const c=d.map(x=>x.close), m=A.sub(A.ema(c,p.fast),A.ema(c,p.slow)), s=A.ema(m,p.signal); return {lines:[{name:"гистограмма",data:A.sub(m,s),type:"hist"},{name:"MACD",data:m,color:"#2962ff"},{name:"сигнал",data:s,color:"#ff6d00"}]}; } },
  { id:"stoch", name:"Стохастик", short:"Stoch", cat:"Осцилляторы", params:{k:14, smoothK:3, d:3}, levels:[80,20], range:[0,100],
    calc:(d,p)=>{ const hh=A.hh(d.map(x=>x.high),p.k), ll=A.ll(d.map(x=>x.low),p.k); const raw=d.map((x,i)=>hh[i]==null?null:100*(x.close-ll[i])/((hh[i]-ll[i])||1e-12));
      const k=A.sma(raw,p.smoothK); return {lines:[{name:"%K",data:k,color:"#2962ff"},{name:"%D",data:A.sma(k,p.d),color:"#ff6d00"}]}; } },
  { id:"srsi", name:"Stoch RSI", short:"StochRSI", cat:"Осцилляторы", params:{rsi:14, stoch:14, k:3, d:3}, levels:[80,20], range:[0,100],
    calc:(d,p)=>{ const r=A.rsi(d.map(x=>x.close),p.rsi), hh=A.hh(r,p.stoch), ll=A.ll(r,p.stoch); const raw=r.map((v,i)=>v==null||hh[i]==null?null:100*(v-ll[i])/((hh[i]-ll[i])||1e-12));
      const k=A.sma(raw,p.k); return {lines:[{name:"%K",data:k,color:"#2962ff"},{name:"%D",data:A.sma(k,p.d),color:"#ff6d00"}]}; } },
  { id:"cci", name:"CCI — индекс товарного канала", short:"CCI", cat:"Осцилляторы", params:{period:20}, levels:[100,-100],
    calc:(d,p)=>{ const tp=d.map(x=>(x.high+x.low+x.close)/3), m=A.sma(tp,p.period); return {lines:[{name:"CCI",color:"#26a69a",data:tp.map((v,i)=>{ if(m[i]==null) return null; let md=0; for(let j=i-p.period+1;j<=i;j++) md+=Math.abs(tp[j]-m[i]); md/=p.period; return (v-m[i])/(0.015*(md||1e-12)); })}]}; } },
  { id:"wr", name:"Williams %R", short:"%R", cat:"Осцилляторы", params:{period:14}, levels:[-20,-80], range:[-100,0],
    calc:(d,p)=>{ const hh=A.hh(d.map(x=>x.high),p.period), ll=A.ll(d.map(x=>x.low),p.period); return {lines:[{name:"%R",color:"#ec407a",data:d.map((x,i)=>hh[i]==null?null:-100*(hh[i]-x.close)/((hh[i]-ll[i])||1e-12))}]}; } },
  { id:"ao", name:"Awesome Oscillator (Билл Вильямс)", short:"AO", cat:"Осцилляторы", params:{fast:5, slow:34}, levels:[0],
    calc:(d,p)=>{ const m=d.map(x=>(x.high+x.low)/2); return {lines:[{name:"AO",data:A.sub(A.sma(m,p.fast),A.sma(m,p.slow)),type:"hist"}]}; } },
  { id:"roc", name:"ROC — скорость изменения, %", short:"ROC", cat:"Осцилляторы", params:{period:12}, levels:[0], calc:(d,p)=>({lines:[{name:"ROC",color:"#29b6f6",data:d.map((x,i)=>i<p.period?null:100*(x.close/d[i-p.period].close-1))}]}) },
  { id:"mom", name:"Momentum — импульс", short:"MOM", cat:"Осцилляторы", params:{period:10}, levels:[0], calc:(d,p)=>({lines:[{name:"MOM",color:"#9ccc65",data:d.map((x,i)=>i<p.period?null:x.close-d[i-p.period].close)}]}) },
  { id:"trix", name:"TRIX", short:"TRIX", cat:"Осцилляторы", params:{period:15}, levels:[0],
    calc:(d,p)=>{ const e=A.ema(A.ema(A.ema(d.map(x=>x.close),p.period),p.period),p.period); return {lines:[{name:"TRIX",color:"#ef5350",data:e.map((v,i)=>v==null||!e[i-1]?null:10000*(v/e[i-1]-1))}]}; } },
  { id:"adx", name:"ADX / DMI — сила тренда", short:"ADX", cat:"Тренд", params:{period:14}, levels:[25],
    calc:(d,p)=>{ const pdm=d.map((x,i)=>{ if(!i) return null; const u=x.high-d[i-1].high, dn=d[i-1].low-x.low; return u>dn&&u>0?u:0; }), ndm=d.map((x,i)=>{ if(!i) return null; const u=x.high-d[i-1].high, dn=d[i-1].low-x.low; return dn>u&&dn>0?dn:0; });
      const tr=A.rma(A.tr(d).map((v,i)=>i?v:null),p.period), pd=A.rma(pdm,p.period), nd=A.rma(ndm,p.period);
      const pdi=pd.map((v,i)=>v==null||!tr[i]?null:100*v/tr[i]), ndi=nd.map((v,i)=>v==null||!tr[i]?null:100*v/tr[i]);
      const dx=pdi.map((v,i)=>v==null||ndi[i]==null?null:100*Math.abs(v-ndi[i])/((v+ndi[i])||1e-12));
      return {lines:[{name:"ADX",data:A.rma(dx,p.period),color:"#ff9800",width:2},{name:"+DI",data:pdi,color:"#089981",width:1},{name:"−DI",data:ndi,color:"#f23645",width:1}]}; } },
  { id:"aroon", name:"Aroon", short:"Aroon", cat:"Тренд", params:{period:25}, range:[0,100],
    calc:(d,p)=>{ const n=p.period, u=[], dn=[]; for(let i=0;i<d.length;i++){ if(i<n){u.push(null);dn.push(null);continue;} let hi=i,lo=i; for(let j=i-n;j<=i;j++){ if(d[j].high>=d[hi].high) hi=j; if(d[j].low<=d[lo].low) lo=j; } u.push(100*(n-(i-hi))/n); dn.push(100*(n-(i-lo))/n); }
      return {lines:[{name:"вверх",data:u,color:"#089981"},{name:"вниз",data:dn,color:"#f23645"}]}; } },
  { id:"atr", name:"ATR — средний истинный диапазон", short:"ATR", cat:"Волатильность", params:{period:14}, calc:(d,p)=>({lines:[{name:"ATR",color:"#ef5350",data:A.rma(A.tr(d),p.period)}]}) },
  { id:"hv", name:"Историческая волатильность, % годовых", short:"HV", cat:"Волатильность", params:{period:20},
    calc:(d,p,ctx)=>{ const r=d.map((x,i)=>i?Math.log(x.close/d[i-1].close):null), s=A.std(r,p.period), k=Math.sqrt(365*86400/ctx.barSec); return {lines:[{name:"HV",color:"#26c6da",data:s.map(v=>v==null?null:100*v*k)}]}; } },
  { id:"sd", name:"Стандартное отклонение", short:"StdDev", cat:"Волатильность", params:{period:20}, calc:(d,p)=>({lines:[{name:"σ",color:"#8d6e63",data:A.std(d.map(x=>x.close),p.period)}]}) },
  { id:"bbw", name:"Ширина полос Боллинджера, %", short:"BBW", cat:"Волатильность", params:{period:20, mult:2},
    calc:(d,p)=>{ const c=d.map(x=>x.close), m=A.sma(c,p.period), s=A.std(c,p.period); return {lines:[{name:"BBW",color:"#42a5f5",data:m.map((v,i)=>v==null?null:100*2*p.mult*s[i]/v)}]}; } },
  { id:"obv", name:"OBV — балансовый объём", short:"OBV", cat:"Объём", params:{},
    calc:(d)=>{ let o=0; return {lines:[{name:"OBV",color:"#5c6bc0",data:d.map((x,i)=>{ if(i){ if(x.close>d[i-1].close) o+=x.volume; else if(x.close<d[i-1].close) o-=x.volume; } return o; })}]}; } },
  { id:"mfi", name:"MFI — индекс денежного потока", short:"MFI", cat:"Объём", params:{period:14}, levels:[80,20], range:[0,100],
    calc:(d,p)=>{ const tp=d.map(x=>(x.high+x.low+x.close)/3); return {lines:[{name:"MFI",color:"#ffa726",data:d.map((x,i)=>{ if(i<p.period) return null; let pos=0,neg=0; for(let j=i-p.period+1;j<=i;j++){ const f=tp[j]*d[j].volume; if(tp[j]>tp[j-1]) pos+=f; else if(tp[j]<tp[j-1]) neg+=f; } return 100-100/(1+pos/(neg||1e-12)); })}]}; } },
  { id:"cmf", name:"CMF — денежный поток Чайкина", short:"CMF", cat:"Объём", params:{period:20}, levels:[0],
    calc:(d,p)=>{ const mfv=d.map(x=>((x.close-x.low)-(x.high-x.close))/((x.high-x.low)||1e-12)*x.volume); const a=A.sma(mfv,p.period), b=A.sma(d.map(x=>x.volume),p.period); return {lines:[{name:"CMF",color:"#26a69a",data:a.map((v,i)=>v==null||!b[i]?null:v/b[i])}]}; } },
  { id:"vosc", name:"Осциллятор объёма, %", short:"VolOsc", cat:"Объём", params:{fast:5, slow:10}, levels:[0],
    calc:(d,p)=>{ const v=d.map(x=>x.volume), f=A.ema(v,p.fast), s=A.ema(v,p.slow); return {lines:[{name:"VolOsc",color:"#ffca28",data:f.map((x,i)=>x==null||!s[i]?null:100*(x-s[i])/s[i])}]}; } },
  // ===== как в TradingView: средние и линии на графике цены =====
  { id:"smma", name:"SMMA — сглаженная скользящая средняя", short:"SMMA", cat:"Средние", main:true, params:{period:7}, calc:(d,p)=>({lines:[{name:"SMMA",data:A.rma(ICL(d),p.period)}]}) },
  { id:"alma", name:"ALMA — средняя Арно Легу", short:"ALMA", cat:"Средние", main:true, params:{period:9, offset:0.85, sigma:6},
    calc:(d,p)=>{ const c=ICL(d), n=Math.round(p.period), m=p.offset*(n-1), s=n/p.sigma, w=Array.from({length:n},(_,j)=>Math.exp(-((j-m)**2)/(2*s*s))), ws=w.reduce((a,b)=>a+b,0);
      return {lines:[{name:"ALMA",data:c.map((_,i)=>{ if(i<n-1) return null; let t=0; for(let j=0;j<n;j++) t+=w[j]*c[i-n+1+j]; return t/ws; })}]}; } },
  { id:"kama", name:"KAMA — адаптивная средняя Кауфмана", short:"KAMA", cat:"Средние", main:true, params:{period:10, fast:2, slow:30},
    calc:(d,p)=>{ const c=ICL(d), n=p.period, f=2/(p.fast+1), sl=2/(p.slow+1), o=Array(c.length).fill(null); let k=null;
      for(let i=n;i<c.length;i++){ let vol=0; for(let j=i-n+1;j<=i;j++) vol+=Math.abs(c[j]-c[j-1]); const er=vol?Math.abs(c[i]-c[i-n])/vol:0, sc=(er*(f-sl)+sl)**2; k = k==null?c[i]:k+sc*(c[i]-k); o[i]=k; }
      return {lines:[{name:"KAMA",data:o}]}; } },
  { id:"mcg", name:"McGinley Dynamic", short:"McGinley", cat:"Средние", main:true, params:{period:14},
    calc:(d,p)=>{ const c=ICL(d), e=A.ema(c,p.period), o=Array(c.length).fill(null); let m=null;
      for(let i=0;i<c.length;i++){ if(m==null){ if(e[i]!=null) m=e[i]; } else m = m + (c[i]-m)/(p.period*Math.pow(c[i]/m,4)); o[i]=m; } return {lines:[{name:"McGinley",data:o}]}; } },
  { id:"ribbon", name:"Лента скользящих средних (20/50/100/200)", short:"MA Ribbon", cat:"Средние", main:true, params:{a:20, b:50, c:100, e:200},
    calc:(d,p)=>{ const c=ICL(d); return {lines:[{name:"MA1",data:A.sma(c,p.a),color:"#f7a600",width:1},{name:"MA2",data:A.sma(c,p.b),color:"#ff7043",width:1},{name:"MA3",data:A.sma(c,p.c),color:"#e040fb",width:1},{name:"MA4",data:A.sma(c,p.e),color:"#2962ff",width:1.5}]}; } },
  { id:"macross", name:"Пересечение скользящих (MA Cross)", short:"MA Cross", cat:"Средние", main:true, params:{fast:9, slow:21},
    calc:(d,p)=>{ const c=ICL(d); return {lines:[{name:"быстрая",data:A.sma(c,p.fast),color:"#26a69a"},{name:"медленная",data:A.sma(c,p.slow),color:"#ef5350"}]}; } },
  { id:"alligator", name:"Аллигатор Билла Вильямса", short:"Alligator", cat:"Тренд", main:true, params:{jaw:13, teeth:8, lips:5},
    calc:(d,p)=>{ const m=IH2(d); return {lines:[{name:"челюсть",data:A.rma(m,p.jaw),color:"#2962ff",shift:8},{name:"зубы",data:A.rma(m,p.teeth),color:"#e91e63",shift:5},{name:"губы",data:A.rma(m,p.lips),color:"#66bb6a",shift:3}]}; } },
  { id:"fractals", name:"Фракталы Билла Вильямса", short:"Fractals", cat:"Тренд", main:true, params:{n:2},
    calc:(d,p)=>{ const n=p.n, up=Array(d.length).fill(null), dn=Array(d.length).fill(null);
      for(let i=n;i<d.length-n;i++){ let u=true,l=true; for(let j=1;j<=n;j++){ if(!(d[i].high>d[i-j].high&&d[i].high>d[i+j].high)) u=false; if(!(d[i].low<d[i-j].low&&d[i].low<d[i+j].low)) l=false; } if(u) up[i]=d[i].high; if(l) dn[i]=d[i].low; }
      return {lines:[{name:"вверх",data:up,color:"#26a69a",dots:true},{name:"вниз",data:dn,color:"#ef5350",dots:true}]}; } },
  { id:"zigzag", name:"ZigZag — развороты на N%", short:"ZigZag", cat:"Тренд", main:true, params:{pct:5},
    calc:(d,p)=>{ const dev=p.pct/100, piv=[]; if(d.length<3) return {lines:[]}; let dir=0, ext=0, exI=0, base=d[0].close;
      for(let i=1;i<d.length;i++){ const h=d[i].high, l=d[i].low;
        if(dir>=0 && h>(dir? ext:base)){ if(dir===0&&h>=base*(1+dev)){ piv.push([0,d[0].low]); dir=1; ext=h; exI=i; } else if(dir===1){ ext=h; exI=i; } }
        if(dir<=0 && l<(dir? ext:base)){ if(dir===0&&l<=base*(1-dev)){ piv.push([0,d[0].high]); dir=-1; ext=l; exI=i; } else if(dir===-1){ ext=l; exI=i; } }
        if(dir===1 && l<=ext*(1-dev)){ piv.push([exI,ext]); dir=-1; ext=l; exI=i; } else if(dir===-1 && h>=ext*(1+dev)){ piv.push([exI,ext]); dir=1; ext=h; exI=i; } }
      if(dir) piv.push([exI,ext]); const o=Array(d.length).fill(null);
      for(let k=1;k<piv.length;k++){ const [i0,p0]=piv[k-1], [i1,p1]=piv[k]; for(let i=i0;i<=i1;i++) o[i]= i1===i0?p1:p0+(p1-p0)*(i-i0)/(i1-i0); }
      return {lines:[{name:"ZigZag",data:o,color:"#f7a600",width:2}]}; } },
  { id:"pivots", name:"Точки разворота (Pivot Points Standard)", short:"Pivots", cat:"Каналы", main:true, params:{},
    calc:(d,p,ctx)=>{ const key = t => ctx.barSec < 86400 ? Math.floor(t/86400) : ctx.barSec < 604800 ? Math.floor((t/86400+3)/7) : new Date(t*1000).getUTCFullYear()*12+new Date(t*1000).getUTCMonth();
      const L={P:[],R1:[],R2:[],R3:[],S1:[],S2:[],S3:[]}; let cur=null, H=-Infinity, Lo=Infinity, Cl=null, prev=null;
      for(const x of d){ const k=key(x.time); if(k!==cur){ if(cur!==null) prev={H,L:Lo,C:Cl}; cur=k; H=-Infinity; Lo=Infinity; } H=Math.max(H,x.high); Lo=Math.min(Lo,x.low); Cl=x.close;
        if(!prev){ for(const z in L) L[z].push(null); continue; } const P=(prev.H+prev.L+prev.C)/3, r=prev.H-prev.L;
        L.P.push(P); L.R1.push(2*P-prev.L); L.S1.push(2*P-prev.H); L.R2.push(P+r); L.S2.push(P-r); L.R3.push(prev.H+2*(P-prev.L)); L.S3.push(prev.L-2*(prev.H-P)); }
      const col={P:"#f7a600",R1:"#ef5350",R2:"#ef5350",R3:"#ef5350",S1:"#26a69a",S2:"#26a69a",S3:"#26a69a"};
      return {lines:Object.keys(L).map(z=>({name:z,data:L[z],color:col[z],width:1,step:true}))}; } },
  { id:"lrc", name:"Канал линейной регрессии", short:"LR Channel", cat:"Каналы", main:true, params:{period:100, mult:2},
    calc:(d,p)=>{ const c=ICL(d), n=p.period, mid=IND.find(x=>x.id==="linreg").calc(d,{period:n}).lines[0].data, s=A.std(c,n);
      return {lines:[{name:"верх",data:mid.map((v,i)=>v==null?null:v+p.mult*s[i]),color:"#42a5f5",width:1},{name:"центр",data:mid,color:"#42a5f5",width:1,style:2},{name:"низ",data:mid.map((v,i)=>v==null?null:v-p.mult*s[i]),color:"#42a5f5",width:1}]}; } },
  { id:"ckstop", name:"Chande Kroll Stop", short:"ChandeKroll", cat:"Тренд", main:true, params:{p:10, x:1, q:9},
    calc:(d,p)=>{ const at=A.rma(A.tr(d),p.p), fh=A.hh(d.map(x=>x.high),p.p).map((v,i)=>v==null||at[i]==null?null:v-p.x*at[i]), fl=A.ll(d.map(x=>x.low),p.p).map((v,i)=>v==null||at[i]==null?null:v+p.x*at[i]);
      return {lines:[{name:"стоп шорт",data:A.hh(fh,p.q),color:"#ef5350",width:1},{name:"стоп лонг",data:A.ll(fl,p.q),color:"#26a69a",width:1}]}; } },
  { id:"chandelier", name:"Chandelier Exit", short:"Chandelier", cat:"Тренд", main:true, params:{period:22, mult:3},
    calc:(d,p)=>{ const at=A.rma(A.tr(d),p.period); return {lines:[{name:"выход лонг",data:A.hh(d.map(x=>x.high),p.period).map((v,i)=>v==null||at[i]==null?null:v-p.mult*at[i]),color:"#26a69a",width:1,style:2},
      {name:"выход шорт",data:A.ll(d.map(x=>x.low),p.period).map((v,i)=>v==null||at[i]==null?null:v+p.mult*at[i]),color:"#ef5350",width:1,style:2}]}; } },
  { id:"vp", name:"Профиль объёма (видимый диапазон)", short:"Vol Profile", cat:"Объём", main:true, vp:true, params:{rows:30, va:70}, calc:()=>({lines:[]}) },
  // ===== как в TradingView: осцилляторы и объём (отдельные панели) =====
  { id:"pctb", name:"Bollinger Bands %B", short:"%B", cat:"Осцилляторы", params:{period:20, mult:2}, levels:[1,0.5,0],
    calc:(d,p)=>{ const c=ICL(d), m=A.sma(c,p.period), s=A.std(c,p.period); return {lines:[{name:"%B",color:"#26c6da",data:c.map((v,i)=>m[i]==null||!s[i]?null:(v-(m[i]-p.mult*s[i]))/(2*p.mult*s[i]))}]}; } },
  { id:"ac", name:"Accelerator Oscillator (Билл Вильямс)", short:"AC", cat:"Осцилляторы", params:{}, levels:[0],
    calc:(d)=>{ const m=IH2(d), ao=A.sub(A.sma(m,5),A.sma(m,34)); return {lines:[{name:"AC",data:A.sub(ao,A.sma(ao,5)),type:"hist"}]}; } },
  { id:"bop", name:"Balance of Power — баланс сил", short:"BOP", cat:"Осцилляторы", params:{period:14}, levels:[0], range:[-1,1],
    calc:(d,p)=>({lines:[{name:"BOP",color:"#ef5350",data:A.sma(d.map(x=>x.high>x.low?(x.close-x.open)/(x.high-x.low):0),p.period)}]}) },
  { id:"cmo", name:"Chande Momentum Oscillator", short:"CMO", cat:"Осцилляторы", params:{period:9}, levels:[50,0,-50], range:[-100,100],
    calc:(d,p)=>{ const m=A.chg(ICL(d)), su=A.sum(m.map(v=>v==null?null:Math.max(v,0)),p.period), sd=A.sum(m.map(v=>v==null?null:Math.max(-v,0)),p.period);
      return {lines:[{name:"CMO",color:"#29b6f6",data:su.map((v,i)=>v==null||sd[i]==null||!(v+sd[i])?null:100*(v-sd[i])/(v+sd[i]))}]}; } },
  { id:"chop", name:"Choppiness Index — «пила» или тренд", short:"CHOP", cat:"Волатильность", params:{period:14}, levels:[61.8,38.2], range:[0,100],
    calc:(d,p)=>{ const n=p.period, s=A.sum(A.tr(d),n), hh=A.hh(d.map(x=>x.high),n), ll=A.ll(d.map(x=>x.low),n);
      return {lines:[{name:"CHOP",color:"#5c6bc0",data:s.map((v,i)=>v==null||hh[i]==null||hh[i]===ll[i]?null:100*Math.log10(v/(hh[i]-ll[i]))/Math.log10(n))}]}; } },
  { id:"crsi", name:"Connors RSI", short:"CRSI", cat:"Осцилляторы", params:{rsi:3, streak:2, rank:100}, levels:[90,10], range:[0,100],
    calc:(d,p)=>{ const c=ICL(d); let st=0; const streak=c.map((v,i)=>{ if(!i) return 0; st = v>c[i-1] ? (st>0?st+1:1) : v<c[i-1] ? (st<0?st-1:-1) : 0; return st; });
      const r1=A.rsi(c,p.rsi), r2=A.rsi(streak,p.streak), roc1=A.roc(c,1);
      const pr=roc1.map((v,i)=>{ if(i<p.rank||v==null) return null; let k=0; for(let j=i-p.rank;j<i;j++) if(roc1[j]!=null&&roc1[j]<v) k++; return 100*k/p.rank; });
      return {lines:[{name:"CRSI",color:"#7e57c2",data:r1.map((v,i)=>v==null||r2[i]==null||pr[i]==null?null:(v+r2[i]+pr[i])/3)}]}; } },
  { id:"coppock", name:"Coppock Curve", short:"Coppock", cat:"Осцилляторы", params:{wma:10, long:14, short:11}, levels:[0],
    calc:(d,p)=>{ const c=ICL(d); return {lines:[{name:"Coppock",color:"#26a69a",data:A.wma(A.add(A.roc(c,p.long),A.roc(c,p.short)),p.wma)}]}; } },
  { id:"dpo", name:"DPO — осциллятор без тренда", short:"DPO", cat:"Осцилляторы", params:{period:21}, levels:[0],
    calc:(d,p)=>{ const c=ICL(d), m=A.sma(c,p.period), b=Math.floor(p.period/2)+1; return {lines:[{name:"DPO",color:"#66bb6a",data:c.map((v,i)=>i<b||m[i-b]==null?null:v-m[i-b])}]}; } },
  { id:"eom", name:"Ease of Movement — лёгкость движения", short:"EOM", cat:"Объём", params:{period:14}, levels:[0],
    calc:(d,p)=>{ const h=IH2(d); return {lines:[{name:"EOM",color:"#26a69a",data:A.sma(d.map((x,i)=>!i||!x.volume?null:10000*(h[i]-h[i-1])*(x.high-x.low)/x.volume),p.period)}]}; } },
  { id:"efi", name:"Elder Force Index — индекс силы", short:"EFI", cat:"Объём", params:{period:13}, levels:[0],
    calc:(d,p)=>({lines:[{name:"EFI",color:"#ef5350",data:A.ema(d.map((x,i)=>i?(x.close-d[i-1].close)*x.volume:null),p.period)}]}) },
  { id:"fisher", name:"Fisher Transform", short:"Fisher", cat:"Осцилляторы", params:{period:9}, levels:[1.5,0,-1.5],
    calc:(d,p)=>{ const h=IH2(d), hh=A.hh(h,p.period), ll=A.ll(h,p.period), f=Array(d.length).fill(null), tr=Array(d.length).fill(null); let v=0, fi=0;
      for(let i=0;i<d.length;i++){ if(hh[i]==null) continue; v = 0.66*((h[i]-ll[i])/((hh[i]-ll[i])||1e-12)-0.5) + 0.67*v; v=Math.max(-0.999,Math.min(0.999,v)); const prev=fi; fi = 0.5*Math.log((1+v)/(1-v)) + 0.5*fi; f[i]=fi; tr[i]=prev; }
      return {lines:[{name:"Fisher",data:f,color:"#2962ff"},{name:"сигнал",data:tr,color:"#ff6d00"}]}; } },
  { id:"klinger", name:"Klinger Oscillator", short:"Klinger", cat:"Объём", params:{fast:34, slow:55, signal:13}, levels:[0],
    calc:(d,p)=>{ const tp=d.map(x=>(x.high+x.low+x.close)/3), sv=d.map((x,i)=>!i?null:(tp[i]>=tp[i-1]?x.volume:-x.volume)), k=A.sub(A.ema(sv,p.fast),A.ema(sv,p.slow));
      return {lines:[{name:"KO",data:k,color:"#2962ff"},{name:"сигнал",data:A.ema(k,p.signal),color:"#26a69a"}]}; } },
  { id:"kst", name:"Know Sure Thing", short:"KST", cat:"Осцилляторы", params:{signal:9}, levels:[0],
    calc:(d,p)=>{ const c=ICL(d), r=(n,m)=>A.sma(A.roc(c,n),m), k=A.add(A.add(r(10,10),A.mul(r(15,10),2)),A.add(A.mul(r(20,10),3),A.mul(r(30,15),4)));
      return {lines:[{name:"KST",data:k,color:"#26a69a"},{name:"сигнал",data:A.sma(k,p.signal),color:"#ef5350"}]}; } },
  { id:"mass", name:"Mass Index — индекс массы", short:"Mass", cat:"Волатильность", params:{period:10}, levels:[27,26.5],
    calc:(d,p)=>{ const sp=d.map(x=>x.high-x.low), e1=A.ema(sp,9), e2=A.ema(e1,9); return {lines:[{name:"Mass",color:"#ab47bc",data:A.sum(e1.map((v,i)=>v==null||!e2[i]?null:v/e2[i]),p.period)}]}; } },
  { id:"netvol", name:"Net Volume — чистый объём", short:"NetVol", cat:"Объём", params:{}, levels:[0],
    calc:(d)=>({lines:[{name:"NetVol",type:"hist",data:d.map((x,i)=>!i?null:x.close>d[i-1].close?x.volume:x.close<d[i-1].close?-x.volume:0)}]}) },
  { id:"ppo", name:"PPO — процентный осциллятор цены", short:"PPO", cat:"Осцилляторы", params:{fast:12, slow:26, signal:9}, levels:[0], crossLine:1,
    calc:(d,p)=>{ const c=ICL(d), f=A.ema(c,p.fast), s=A.ema(c,p.slow), v=f.map((x,i)=>x==null||!s[i]?null:100*(x-s[i])/s[i]), sg=A.ema(v,p.signal);
      return {lines:[{name:"гистограмма",data:A.sub(v,sg),type:"hist"},{name:"PPO",data:v,color:"#2962ff"},{name:"сигнал",data:sg,color:"#ff6d00"}]}; } },
  { id:"po", name:"Price Oscillator — осциллятор цены", short:"PO", cat:"Осцилляторы", params:{fast:10, slow:21}, levels:[0],
    calc:(d,p)=>{ const c=ICL(d), f=A.sma(c,p.fast), s=A.sma(c,p.slow); return {lines:[{name:"PO",color:"#26a69a",data:f.map((x,i)=>x==null||!s[i]?null:100*(x-s[i])/s[i])}]}; } },
  { id:"pvt", name:"PVT — тренд цены и объёма", short:"PVT", cat:"Объём", params:{},
    calc:(d)=>({lines:[{name:"PVT",color:"#2962ff",data:A.cum(d.map((x,i)=>!i?null:(x.close/d[i-1].close-1)*x.volume))}]}) },
  { id:"adlx", name:"Accumulation/Distribution — накопление/распределение", short:"A/D", cat:"Объём", params:{},
    calc:(d)=>({lines:[{name:"A/D",color:"#7e57c2",data:A.adl(d)}]}) },
  { id:"chosc", name:"Chaikin Oscillator", short:"ChaikinOsc", cat:"Объём", params:{fast:3, slow:10}, levels:[0],
    calc:(d,p)=>{ const a=A.adl(d); return {lines:[{name:"CO",color:"#ef5350",data:A.sub(A.ema(a,p.fast),A.ema(a,p.slow))}]}; } },
  { id:"rvgi", name:"Relative Vigor Index — индекс бодрости", short:"RVGI", cat:"Осцилляторы", params:{period:10}, levels:[0],
    calc:(d,p)=>{ const num=A.sum(A.swma(d.map(x=>x.close-x.open)),p.period), den=A.sum(A.swma(d.map(x=>x.high-x.low)),p.period), r=num.map((v,i)=>v==null||!den[i]?null:v/den[i]);
      return {lines:[{name:"RVGI",data:r,color:"#26a69a"},{name:"сигнал",data:A.swma(r),color:"#ef5350"}]}; } },
  { id:"rvi", name:"Relative Volatility Index — индекс относительной волатильности", short:"RVI", cat:"Волатильность", params:{std:10, period:14}, levels:[80,20], range:[0,100],
    calc:(d,p)=>{ const c=ICL(d), s=A.std(c,p.std), u=A.ema(c.map((v,i)=>!i||s[i]==null?null:(v>c[i-1]?s[i]:0)),p.period), l=A.ema(c.map((v,i)=>!i||s[i]==null?null:(v<c[i-1]?s[i]:0)),p.period);
      return {lines:[{name:"RVI",color:"#ab47bc",data:u.map((v,i)=>v==null||l[i]==null||!(v+l[i])?null:100*v/(v+l[i]))}]}; } },
  { id:"smierg", name:"SMI Ergodic Indicator", short:"SMI Ergodic", cat:"Осцилляторы", params:{short:5, long:20, signal:5}, levels:[0],
    calc:(d,p)=>{ const e=A.tsi(ICL(d),p.long,p.short); return {lines:[{name:"SMI",data:e,color:"#2962ff"},{name:"сигнал",data:A.ema(e,p.signal),color:"#ff6d00"}]}; } },
  { id:"smi", name:"Stochastic Momentum Index", short:"SMI", cat:"Осцилляторы", params:{period:10, smooth:3, signal:10}, levels:[40,-40],
    calc:(d,p)=>{ const hh=A.hh(d.map(x=>x.high),p.period), ll=A.ll(d.map(x=>x.low),p.period), rr=d.map((x,i)=>hh[i]==null?null:x.close-(hh[i]+ll[i])/2), rg=hh.map((v,i)=>v==null?null:v-ll[i]);
      const a=A.ema(A.ema(rr,p.smooth),p.smooth), b=A.ema(A.ema(rg,p.smooth),p.smooth), s=a.map((v,i)=>v==null||!b[i]?null:200*v/b[i]);
      return {lines:[{name:"SMI",data:s,color:"#2962ff"},{name:"сигнал",data:A.ema(s,p.signal),color:"#ff6d00"}]}; } },
  { id:"tsi", name:"True Strength Index — индекс истинной силы", short:"TSI", cat:"Осцилляторы", params:{long:25, short:13, signal:13}, levels:[0],
    calc:(d,p)=>{ const t=A.tsi(ICL(d),p.long,p.short); return {lines:[{name:"TSI",data:t,color:"#2962ff"},{name:"сигнал",data:A.ema(t,p.signal),color:"#ef5350"}]}; } },
  { id:"uo", name:"Ultimate Oscillator — окончательный осциллятор", short:"UO", cat:"Осцилляторы", params:{a:7, b:14, c:28}, levels:[70,30], range:[0,100],
    calc:(d,p)=>{ const bp=d.map((x,i)=>!i?null:x.close-Math.min(x.low,d[i-1].close)), tr=d.map((x,i)=>!i?null:Math.max(x.high,d[i-1].close)-Math.min(x.low,d[i-1].close));
      const av=n=>{ const sb=A.sum(bp,n), st=A.sum(tr,n); return sb.map((v,i)=>v==null||!st[i]?null:v/st[i]); }; const a=av(p.a), b=av(p.b), c=av(p.c);
      return {lines:[{name:"UO",color:"#f23645",data:a.map((v,i)=>v==null||b[i]==null||c[i]==null?null:100*(4*v+2*b[i]+c[i])/7)}]}; } },
  { id:"vortex", name:"Vortex Indicator — вихрь", short:"Vortex", cat:"Тренд", params:{period:14}, levels:[1],
    calc:(d,p)=>{ const tr=A.sum(A.tr(d).map((v,i)=>i?v:null),p.period), vp=A.sum(d.map((x,i)=>i?Math.abs(x.high-d[i-1].low):null),p.period), vm=A.sum(d.map((x,i)=>i?Math.abs(x.low-d[i-1].high):null),p.period);
      return {lines:[{name:"VI+",data:vp.map((v,i)=>v==null||!tr[i]?null:v/tr[i]),color:"#2962ff"},{name:"VI−",data:vm.map((v,i)=>v==null||!tr[i]?null:v/tr[i]),color:"#e91e63"}]}; } },
  { id:"bbp", name:"Bull Bear Power — сила быков и медведей", short:"BBP", cat:"Осцилляторы", params:{period:13}, levels:[0],
    calc:(d,p)=>{ const e=A.ema(ICL(d),p.period); return {lines:[{name:"BBP",type:"hist",data:d.map((x,i)=>e[i]==null?null:x.high+x.low-2*e[i])}]}; } },
  { id:"ulcer", name:"Ulcer Index — индекс «язвы» (глубина просадок)", short:"Ulcer", cat:"Волатильность", params:{period:14},
    calc:(d,p)=>{ const c=ICL(d), hh=A.hh(c,p.period), dd=c.map((v,i)=>hh[i]==null?null:(100*(v-hh[i])/hh[i])**2); return {lines:[{name:"Ulcer",color:"#ef5350",data:A.sma(dd,p.period).map(v=>v==null?null:Math.sqrt(v))}]}; } },
  { id:"volma", name:"Объём со средней", short:"Volume", cat:"Объём", params:{period:20},
    calc:(d,p)=>({lines:[{name:"объём",type:"hist",data:d.map(x=>x.volume)},{name:"средний",data:A.sma(d.map(x=>x.volume),p.period),color:"#f7a600"}]}) },
  { id:"adr", name:"Средний дневной диапазон (ADR)", short:"ADR", cat:"Волатильность", params:{period:14},
    calc:(d,p)=>({lines:[{name:"ADR",color:"#26c6da",data:A.sma(d.map(x=>x.high-x.low),p.period)}]}) },
  // свои формулы: на графике цены или в отдельной панели
  { id:"formula", name:"Своя формула — на графике цены", short:"ƒ", cat:"Свои", main:true, params:{name:"Моя линия", expr:"(ema(close,9)+ema(close,21))/2"},
    calc:(d,p)=>({lines:[{name:p.name,data:evalFormula(p.expr,d,typeof extrasFor==="function"?extrasFor(d,p.expr):null)}]}) },
  { id:"formula_pane", name:"Своя формула — в отдельной панели", short:"ƒ", cat:"Свои", params:{name:"Мой осциллятор", expr:"ema(close,9) - ema(close,21)"}, levels:[0],
    calc:(d,p)=>({lines:[{name:p.name,data:evalFormula(p.expr,d,typeof extrasFor==="function"?extrasFor(d,p.expr):null)}]}) },
  { id:"x_funding", name:"Финансирование фьючерса Binance, % за 8 ч", short:"Funding", cat:"Внешние данные", params:{}, levels:[0],
    calc:(d)=>({lines:[{name:"funding",type:"hist",data:(extrasFor(d,"funding").funding)}]}) },
  { id:"x_premium", name:"Премия Coinbase к Binance, % (дневная)", short:"Premium", cat:"Внешние данные", params:{}, levels:[0],
    calc:(d)=>({lines:[{name:"premium",color:"#26a69a",data:extrasFor(d,"premium").premium}]}) },
  { id:"x_dvol", name:"DVOL — волатильность по опционам Deribit (BTC/ETH)", short:"DVOL", cat:"Внешние данные", params:{},
    calc:(d)=>({lines:[{name:"DVOL",color:"#ff9800",data:extrasFor(d,"dvol").dvol}]}) },
  { id:"x_oi", name:"Открытый интерес фьючерса Binance, $ (30 дней)", short:"OI", cat:"Внешние данные", params:{},
    calc:(d)=>({lines:[{name:"OI",color:"#7e57c2",data:extrasFor(d,"oi").oi}]}) },
  { id:"x_vix", name:"VIX — индекс страха рынка акций", short:"VIX", cat:"Внешние данные", params:{},
    calc:(d)=>({lines:[{name:"VIX",color:"#ef5350",data:extrasFor(d,"vix").vix}]}) },
  { id:"x_ust10", name:"Доходность 10-летних облигаций США, %", short:"UST10", cat:"Внешние данные", params:{},
    calc:(d)=>({lines:[{name:"10 лет",color:"#42a5f5",data:extrasFor(d,"ust10 real10").ust10},{name:"реальная",color:"#ab47bc",data:extrasFor(d,"ust10 real10").real10}]}) },
  // ---- 12.10.2026: под наши проверки (пробои на объёме, волатильность для Polymarket, потоки денег) ----
  { id:"rvol", name:"RVOL — относительный объём (объём / средний)", short:"RVOL", cat:"Объём", params:{period:20}, levels:[1,2],
    calc:(d,p)=>{ const v=d.map(x=>x.volume), m=A.sma(v,p.period); return {lines:[{name:"RVOL",type:"hist",data:v.map((x,i)=>m[i]?x/m[i]-1:null).map(x=>x==null?null:x+1)}]}; } },
  { id:"avwap", name:"Якорный VWAP (от даты или от минимума/максимума)", short:"AVWAP", cat:"Средние", main:true, params:{anchor:"мин 200", bands:1},
    calc:(d,p)=>{ const n=d.length; let s=0; const a=String(p.anchor||"").trim().toLowerCase(), m=a.match(/^(мин|макс|min|max)\s*(\d+)$/);
      if (m) { const k=Math.min(n,+m[2]); let best=n-k; for (let i=n-k;i<n;i++) if (/^(мин|min)/.test(m[1]) ? d[i].low<d[best].low : d[i].high>d[best].high) best=i; s=best; }
      else if (a) { const t=Date.parse(a.replace(" ","T")+(a.length<=10?"T00:00":"")+"Z")/1000; if (!isFinite(t)) throw new Error("якорь: дата «2026-10-01 12:00» или «мин 200» / «макс 200»"); s=d.findIndex(x=>x.time>=t); if (s<0) s=n-1; }
      const vw=Array(n).fill(null), up=Array(n).fill(null), dn=Array(n).fill(null); let pv=0, vv=0, p2=0;
      for (let i=s;i<n;i++){ const tp=(d[i].high+d[i].low+d[i].close)/3, v=d[i].volume||0; pv+=tp*v; vv+=v; p2+=tp*tp*v; if (!vv) continue; const w=pv/vv, sd=Math.sqrt(Math.max(0,p2/vv-w*w)); vw[i]=w; if (p.bands>0){ up[i]=w+p.bands*sd; dn[i]=w-p.bands*sd; } }
      return {lines:[{name:"AVWAP",data:vw,width:2},...(p.bands>0?[{name:"+σ",data:up,style:2,color:"#7e8794"},{name:"−σ",data:dn,style:2,color:"#7e8794"}]:[])]}; } },
  { id:"squeeze", name:"Сжатие волатильности (Боллинджер внутри Кельтнера)", short:"Squeeze", cat:"Волатильность", params:{period:20, bb:2, kc:1.5}, levels:[0],
    calc:(d,p)=>{ const c=ICL(d), n=p.period, ma=A.sma(c,n), sd=A.std(c,n), atr=A.sma(A.tr(d),n), hh=A.hh(d.map(x=>x.high),n), ll=A.ll(d.map(x=>x.low),n);
      const src=c.map((v,i)=>ma[i]==null||hh[i]==null?null:v-((hh[i]+ll[i])/2+ma[i])/2), mom=Array(c.length).fill(null);
      for (let i=n-1;i<c.length;i++){ let sx=0,sy=0,sxy=0,sxx=0,ok=true; for (let j=0;j<n;j++){ const y=src[i-n+1+j]; if (y==null){ok=false;break;} sx+=j; sy+=y; sxy+=j*y; sxx+=j*j; } if (!ok) continue; const b=(n*sxy-sx*sy)/(n*sxx-sx*sx); mom[i]=(sy-b*sx)/n+b*(n-1); }
      const on=c.map((_,i)=> ma[i]==null||atr[i]==null ? null : (ma[i]+p.bb*sd[i] < ma[i]+p.kc*atr[i] && ma[i]-p.bb*sd[i] > ma[i]-p.kc*atr[i]) ? 0 : null);
      return {lines:[{name:"импульс",type:"hist",data:mom},{name:"сжатие",data:on,dots:true,color:"#ff5252"}]}; } },
  { id:"x_cvd", name:"CVD — накопленная дельта покупок и продаж (спот Binance)", short:"CVD", cat:"Объём", params:{},
    calc:(d)=>{ const x=extrasFor(d,"delta").delta; let s=0, any=false; return {lines:[{name:"CVD",color:"#26c6da",data:x.map(v=>{ if (v==null) return any?s:null; any=true; s+=v; return s; })}]}; } },
  { id:"x_delta", name:"Дельта бара: агрессивные покупки − продажи (спот Binance)", short:"Delta", cat:"Объём", params:{}, levels:[0],
    calc:(d)=>({lines:[{name:"дельта",type:"hist",data:extrasFor(d,"delta").delta}]}) },
  { id:"x_lsr", name:"Лонг/шорт: отношение счетов на фьючерсах Binance (30 дней)", short:"L/S", cat:"Внешние данные", params:{}, levels:[1],
    calc:(d)=>({lines:[{name:"лонг/шорт",color:"#ffa726",data:extrasFor(d,"lsr").lsr}]}) },
  { id:"x_vrp", name:"Ожидаемая (DVOL) против реальной волатильности, % годовых (BTC/ETH)", short:"DVOL−HV", cat:"Волатильность", params:{days:30},
    calc:(d,p,ctx)=>{ const bs=(ctx&&ctx.barSec)||3600, n=Math.max(5,Math.round(p.days*86400/bs)), lr=d.map((x,i)=>i?Math.log(x.close/d[i-1].close):null), sd=A.std(lr,n), k=Math.sqrt(365*86400/bs)*100;
      return {lines:[{name:"DVOL",color:"#ff9800",data:extrasFor(d,"dvol").dvol},{name:"реальная",color:"#42a5f5",data:sd.map(v=>v==null?null:v*k)}]}; } },
  { id:"x_fng", name:"Индекс страха и жадности (alternative.me, дневной)", short:"F&G", cat:"Фундаментал", params:{}, levels:[75,50,25], range:[0,100],
    calc:(d)=>({lines:[{name:"F&G",color:"#ffca28",data:extrasFor(d,"fng").fng,step:true}]}) },
  { id:"x_stables", name:"Стейблкоины: изменение общего предложения за N дней, %", short:"Stables", cat:"Фундаментал", params:{days:30}, levels:[0],
    calc:(d,p,ctx)=>{ const s=extrasFor(d,"stables").stables, bs=(ctx&&ctx.barSec)||3600, k=Math.max(1,Math.round(p.days*86400/bs));
      return {lines:[{name:"изм., %",type:"hist",data:s.map((v,i)=>i<k||v==null||!s[i-k]?null:100*(v/s[i-k]-1))}]}; } },
  { id:"x_mvrv", name:"MVRV: рыночная цена / средняя цена покупки монет (CoinMetrics)", short:"MVRV", cat:"Фундаментал", params:{}, levels:[3.5,1],
    calc:(d)=>({lines:[{name:"MVRV",color:"#ab47bc",data:extrasFor(d,"mvrv").mvrv,step:true}]}) },
  { id:"x_netflow", name:"Чистый приток монет на биржи за день (+ занесли, − вывели)", short:"Netflow", cat:"Фундаментал", params:{}, levels:[0],
    calc:(d)=>({lines:[{name:"приток",type:"hist",data:extrasFor(d,"netflow").netflow}]}) },
  { id:"x_aaddr", name:"Активные адреса сети за день (CoinMetrics)", short:"Адреса", cat:"Фундаментал", params:{period:7},
    calc:(d,p,ctx)=>{ const a=extrasFor(d,"aaddr").aaddr, k=Math.max(1,Math.round(p.period*86400/((ctx&&ctx.barSec)||3600))); return {lines:[{name:"адреса",color:"#66bb6a",data:a,step:true},{name:"средн.",color:"#9e9e9e",data:A.sma(a,k)}]}; } },
  { id:"x_tvl", name:"TVL — деньги в DeFi сети монеты, млн $ (DefiLlama)", short:"TVL", cat:"Фундаментал", params:{},
    calc:(d)=>({lines:[{name:"TVL",color:"#29b6f6",data:extrasFor(d,"tvl").tvl,step:true}]}) },
];
const CATS = ["Все", "Средние", "Каналы", "Тренд", "Осцилляторы", "Волатильность", "Объём", "Внешние данные", "Фундаментал", "Свои"];
// Набор «Аналитика» (12.10.2026): то, что прошло наши проверки или нужно для риска. Включается кнопкой во вкладке «Сводка».
const IND_PRESETS = {
  analysis: { name:"Чистый", inds:[                       // минимум на графике; остальное — в «Сводке»
    {id:"ema", params:{period:50}, color:"#f7a600"}, {id:"ema", params:{period:200}, color:"#e040fb"},
    {id:"avwap", params:{anchor:"мин 200", bands:0}, color:"#00bcd4"},
    {id:"rvol", params:{period:20}, ph:70}, {id:"x_cvd", ph:80} ] },
  flow: { name:"Объём и уровни", inds:[
    {id:"ema", params:{period:50}, color:"#f7a600"}, {id:"avwap", params:{anchor:"мин 200", bands:1}, color:"#00bcd4"}, {id:"vp"},
    {id:"rvol", params:{period:20}, ph:60}, {id:"x_cvd", ph:70}, {id:"x_oi", ph:70}, {id:"x_funding", ph:60, pcol:1} ] },
  macro: { name:"Фон рынка", inds:[
    {id:"ema", params:{period:50}, color:"#f7a600"}, {id:"ema", params:{period:200}, color:"#e040fb"},
    {id:"x_fng", ph:65}, {id:"x_stables", params:{days:30}, ph:65}, {id:"x_mvrv", ph:65}, {id:"x_netflow", ph:65, pcol:1} ] },
  vol: { name:"Волатильность (Polymarket)", inds:[
    {id:"bb", params:{period:20, mult:2}}, {id:"squeeze", ph:75}, {id:"x_vrp", params:{days:30}, ph:80}, {id:"atr", params:{period:14}, ph:60, pcol:1} ] },
};
