import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const PORT = process.env.PORT || 10000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TD_KEY = process.env.TWELVE_DATA_API_KEY;
const TD_BASE = "https://api.twelvedata.com";

app.use(cors({ origin: process.env.FRONTEND_ORIGIN ? process.env.FRONTEND_ORIGIN.split(",").map(x => x.trim()) : true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const INSTRUMENTS = {
  XAUUSD: { name: "Gold", dataSymbol: process.env.TD_XAUUSD_SYMBOL || "XAU/USD", chart: "OANDA:XAUUSD", decimals: 2 },
  EURUSD: { name: "EUR/USD", dataSymbol: "EUR/USD", chart: "OANDA:EURUSD", decimals: 5 },
  GBPUSD: { name: "GBP/USD", dataSymbol: "GBP/USD", chart: "OANDA:GBPUSD", decimals: 5 },
  USDJPY: { name: "USD/JPY", dataSymbol: "USD/JPY", chart: "OANDA:USDJPY", decimals: 3 },
  AUDUSD: { name: "AUD/USD", dataSymbol: "AUD/USD", chart: "OANDA:AUDUSD", decimals: 5 },
  NAS100: { name: "Nasdaq 100", dataSymbol: process.env.TD_NAS100_SYMBOL || "NDX", chart: "NASDAQ:NDX", decimals: 2 },
  US30: { name: "Dow Jones 30", dataSymbol: process.env.TD_US30_SYMBOL || "DJI", chart: process.env.TV_US30_SYMBOL || "DJ:DJI", decimals: 2 }
};

async function td(pathname, params = {}) {
  if (!TD_KEY) throw new Error("TWELVE_DATA_API_KEY is missing");
  const u = new URL(TD_BASE + pathname);
  Object.entries({ ...params, apikey: TD_KEY }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u, { headers: { Accept: "application/json" } });
  const j = await r.json();
  if (!r.ok || j.status === "error" || j.code) throw new Error(j.message || `Twelve Data ${r.status}`);
  return j;
}

function closes(rows) { return rows.map(x => Number(x.close)).filter(Number.isFinite).reverse(); }
function ema(v, p) { if (v.length < p) return null; const k = 2/(p+1); let e=v.slice(0,p).reduce((a,b)=>a+b,0)/p; for(let i=p;i<v.length;i++) e=v[i]*k+e*(1-k); return e; }
function rsi(v,p=14){ if(v.length<p+1)return null; let g=0,l=0; for(let i=1;i<=p;i++){const d=v[i]-v[i-1];g+=Math.max(d,0);l+=Math.max(-d,0)} let ag=g/p,al=l/p; for(let i=p+1;i<v.length;i++){const d=v[i]-v[i-1];ag=(ag*(p-1)+Math.max(d,0))/p;al=(al*(p-1)+Math.max(-d,0))/p} return al===0?100:100-(100/(1+ag/al)); }
function atr(rows,p=14){const h=rows.map(x=>+x.high).reverse(),l=rows.map(x=>+x.low).reverse(),c=rows.map(x=>+x.close).reverse();const tr=[];for(let i=1;i<h.length;i++)tr.push(Math.max(h[i]-l[i],Math.abs(h[i]-c[i-1]),Math.abs(l[i]-c[i-1])));return tr.length<p?null:tr.slice(-p).reduce((a,b)=>a+b,0)/p;}
function adx(rows,p=14){if(rows.length<p*2+2)return null;const h=rows.map(x=>+x.high).reverse(),l=rows.map(x=>+x.low).reverse(),c=rows.map(x=>+x.close).reverse();const tr=[],pd=[],md=[];for(let i=1;i<h.length;i++){const up=h[i]-h[i-1],dn=l[i-1]-l[i];tr.push(Math.max(h[i]-l[i],Math.abs(h[i]-c[i-1]),Math.abs(l[i]-c[i-1])));pd.push(up>dn&&up>0?up:0);md.push(dn>up&&dn>0?dn:0)}let a=tr.slice(0,p).reduce((x,y)=>x+y,0)/p,pp=pd.slice(0,p).reduce((x,y)=>x+y,0)/p,mm=md.slice(0,p).reduce((x,y)=>x+y,0)/p;const dx=[];for(let i=p;i<tr.length;i++){a=(a*(p-1)+tr[i])/p;pp=(pp*(p-1)+pd[i])/p;mm=(mm*(p-1)+md[i])/p;const diP=100*pp/a,diM=100*mm/a;dx.push(100*Math.abs(diP-diM)/Math.max(diP+diM,1e-9))}return dx.length<p?null:dx.slice(-p).reduce((x,y)=>x+y,0)/p;}
function macd(v){if(v.length<35)return null;const fast=ema(v,12),slow=ema(v,26);if(fast==null||slow==null)return null;const line=fast-slow;return {line};}
function bollinger(v,p=20,m=2){if(v.length<p)return null;const s=v.slice(-p),mean=s.reduce((a,b)=>a+b,0)/p,sd=Math.sqrt(s.reduce((a,b)=>a+(b-mean)**2,0)/p);return {middle:mean,upper:mean+m*sd,lower:mean-m*sd};}
function structure(v,look=20){const s=v.slice(-look);if(s.length<5)return "UNKNOWN";const mid=s.slice(0,-2).reduce((a,b)=>a+b,0)/(s.length-2);return s.at(-1)>mid?"BULLISH":"BEARISH";}
function signal(rows){
  const v=closes(rows), price=v.at(-1), e20=ema(v,20), e50=ema(v,50), e200=ema(v,200), rv=rsi(v), ax=adx(rows), a=atr(rows), mc=macd(v), bb=bollinger(v), st=structure(v);
  let score=50,reasons=[],direction="WAIT";
  if(e20&&e50){ if(price>e20&&e20>e50){score+=18;reasons.push("price above 20 EMA and 20 EMA above 50 EMA");} else if(price<e20&&e20<e50){score-=18;reasons.push("price below 20 EMA and 20 EMA below 50 EMA");} }
  if(e50&&e200){ if(price>e50&&e50>e200){score+=12;reasons.push("50 EMA above 200 EMA");} else if(price<e50&&e50<e200){score-=12;reasons.push("50 EMA below 200 EMA");} }
  if(rv!==null){ if(rv>52&&rv<70){score+=8;reasons.push("RSI supports bullish momentum");} else if(rv<48&&rv>30){score-=8;reasons.push("RSI supports bearish momentum");} }
  if(ax!==null){ if(ax>=25){score += price>(e50??price)?8:-8; reasons.push(`ADX ${ax.toFixed(1)} indicates a stronger trend`);} else if(ax<20){reasons.push(`ADX ${ax.toFixed(1)} indicates a weaker/ranging market`);} }
  if(st==="BULLISH") score+=5; if(st==="BEARISH") score-=5;
  if(mc){ if(mc.line>0) score+=4; else score-=4; }
  score=Math.max(0,Math.min(100,Math.round(score)));
  if(score>=68)direction="BUY"; else if(score<=32)direction="SELL";
  const dist=a?1.5*a:null; const stop=direction==="BUY"&&dist?price-dist:direction==="SELL"&&dist?price+dist:null; const tp1=direction==="BUY"&&dist?price+1.5*dist:direction==="SELL"&&dist?price-1.5*dist:null; const tp2=direction==="BUY"&&dist?price+3*dist:direction==="SELL"&&dist?price-3*dist:null;
  return {price,entry:price,stopLoss:stop,tp1,tp2,direction,score,scoreLabel:score>=85?"HIGH-CONFLUENCE SETUP":score>=75?"STRONG SETUP":score>=60?"VALID SETUP":score>=40?"WEAK SETUP":"WAIT",indicators:{rsi:rv,adx:ax,ema20:e20,ema50:e50,ema200:e200,atr:a,macd:mc?.line??null,bollinger:bb,structure:st},reason:reasons.length?reasons.join(". ")+".":"No strong technical confluence yet; WAIT.",timestamp:new Date().toISOString()};
}
async function signalFor(key){const cfg=INSTRUMENTS[key];const data=await td("/time_series",{symbol:cfg.dataSymbol,interval:process.env.MARKET_INTERVAL||"15min",outputsize:260,timezone:"UTC"});if(!data.values?.length)throw new Error("No market data returned");const s=signal(data.values),v=closes(data.values),prev=v.at(-2);s.percentChange=prev?((s.price-prev)/prev)*100:0;s.sourceSymbol=cfg.dataSymbol;return s;}

app.get("/api/health",(req,res)=>res.json({ok:true,time:new Date().toISOString(),marketProvider:TD_KEY?"twelve-data":"missing",technicalOnly:true,instruments:Object.keys(INSTRUMENTS)}));
app.get("/api/instruments",(req,res)=>res.json(INSTRUMENTS));
app.get("/api/signals",async(req,res)=>{
  if(!TD_KEY)return res.status(503).json({error:"TWELVE_DATA_API_KEY is not configured"});
  const out={};
  await Promise.all(Object.keys(INSTRUMENTS).map(async k=>{
    try { out[k]=await signalFor(k); }
    catch(e) { out[k]={direction:"WAIT",score:0,scoreLabel:"DATA UNAVAILABLE",price:null,entry:null,stopLoss:null,tp1:null,tp2:null,indicators:{},error:true,reason:e.message,timestamp:new Date().toISOString(),sourceSymbol:INSTRUMENTS[k].dataSymbol}; }
  }));
  res.json(out);
});

app.get("/api/strategy",(req,res)=>res.json({name:"BluEmaTrend Trade",author:"Iyaloo “Risky”",handle:"@riskybankss",priceNow:20,priceNextJanuary:200,emAs:[20,50],method:"Trend continuation using price action, market structure, EMA zones, continuation patterns, breakout/retest and ATR-based risk management.",document:"/downloads/BluEmaTrend_Trade_Polished.docx"}));
app.get("/api/preview",(req,res)=>res.json({public:true,message:"Join Quant-Alpha to access live technical signals. Membership payments are intentionally not auto-activated until PayPal credentials and webhook verification are configured."}));

app.get("/{*splat}",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`Quant-Alpha technical server listening on ${PORT}`));
