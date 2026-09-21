import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const PORT = Number(process.env.PORT || 10000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, ".data");
const MEMBERS_FILE = path.join(DATA_DIR, "members.json");
const TD_KEY = process.env.TWELVE_DATA_API_KEY;
const TD_BASE = "https://api.twelvedata.com";
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
const SESSION_SECRET = process.env.SESSION_SECRET || "development-only-change-me";

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(MEMBERS_FILE)) fs.writeFileSync(MEMBERS_FILE, JSON.stringify({members:[]}, null, 2));

const INSTRUMENTS = {
  XAUUSD:{name:"Gold",dataSymbol:process.env.TD_XAUUSD_SYMBOL||"XAU/USD",chart:"OANDA:XAUUSD",decimals:2},
  EURUSD:{name:"EUR/USD",dataSymbol:"EUR/USD",chart:"OANDA:EURUSD",decimals:5},
  GBPUSD:{name:"GBP/USD",dataSymbol:"GBP/USD",chart:"OANDA:GBPUSD",decimals:5},
  USDJPY:{name:"USD/JPY",dataSymbol:"USD/JPY",chart:"OANDA:USDJPY",decimals:3},
  AUDUSD:{name:"AUD/USD",dataSymbol:"AUD/USD",chart:"OANDA:AUDUSD",decimals:5},
  NAS100:{name:"Nasdaq 100",dataSymbol:process.env.TD_NAS100_SYMBOL||"NDX",chart:"NASDAQ:NDX",decimals:2},
  US30:{name:"Dow Jones 30",dataSymbol:process.env.TD_US30_SYMBOL||"DJI",chart:"DJ:DJI",decimals:2},
  JPN225:{name:"Japan 225",dataSymbol:process.env.TD_JPN225_SYMBOL||"N225",chart:"TVC:NI225",decimals:0}
};

function loadMembers(){try{return JSON.parse(fs.readFileSync(MEMBERS_FILE,"utf8"));}catch{return {members:[]};}}
function saveMembers(db){fs.writeFileSync(MEMBERS_FILE, JSON.stringify(db,null,2));}
function b64(s){return Buffer.from(s).toString("base64url");}
function sign(payload){return crypto.createHmac("sha256",SESSION_SECRET).update(payload).digest("base64url");}
function issueSession(member){const body=b64(JSON.stringify({email:member.email,plan:member.plan,exp:Date.now()+1000*60*60*24*30}));return `${body}.${sign(body)}`;}
function verifySession(token){try{const [body,sig]=String(token||"").split(".");if(!body||!sig||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(sign(body))))return null;const p=JSON.parse(Buffer.from(body,"base64url").toString());if(p.exp<Date.now())return null;return p;}catch{return null;}}
function auth(req,res,next){const p=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");const s=verifySession(p);if(!s)return res.status(401).json({error:"Member login required"});req.member=s;next();}

app.use(cors({origin:(process.env.CORS_ORIGIN||"").split(",").map(x=>x.trim()).filter(Boolean).length?(process.env.CORS_ORIGIN||"").split(",").map(x=>x.trim()):true}));
app.use(express.json({limit:"1mb"}));
app.use(express.static(path.join(__dirname,"public")));
app.use("/downloads",express.static(path.join(__dirname,"docs")));
app.use("/certificates",express.static(path.join(__dirname,"certificates")));

async function td(pathname,params={}){
  if(!TD_KEY) throw new Error("TWELVE_DATA_API_KEY is not configured");
  const u=new URL(TD_BASE+pathname);Object.entries({...params,apikey:TD_KEY}).forEach(([k,v])=>u.searchParams.set(k,String(v)));
  const r=await fetch(u,{headers:{Accept:"application/json"}});const j=await r.json();
  if(!r.ok||j.status==="error"||j.code)throw new Error(j.message||`Twelve Data ${r.status}`);return j;
}
function nums(rows,key){return rows.map(x=>Number(x[key])).filter(Number.isFinite).reverse();}
function ema(v,p){if(v.length<p)return null;const k=2/(p+1);let e=v.slice(0,p).reduce((a,b)=>a+b,0)/p;for(let i=p;i<v.length;i++)e=v[i]*k+e*(1-k);return e;}
function rsi(v,p=14){if(v.length<p+1)return null;let g=0,l=0;for(let i=1;i<=p;i++){const d=v[i]-v[i-1];g+=Math.max(d,0);l+=Math.max(-d,0)}let ag=g/p,al=l/p;for(let i=p+1;i<v.length;i++){const d=v[i]-v[i-1];ag=(ag*(p-1)+Math.max(d,0))/p;al=(al*(p-1)+Math.max(-d,0))/p}return al===0?100:100-100/(1+ag/al);}
function atr(rows,p=14){const h=nums(rows,"high"),l=nums(rows,"low"),c=nums(rows,"close"),tr=[];for(let i=1;i<h.length;i++)tr.push(Math.max(h[i]-l[i],Math.abs(h[i]-c[i-1]),Math.abs(l[i]-c[i-1])));return tr.length<p?null:tr.slice(-p).reduce((a,b)=>a+b,0)/p;}
function adx(rows,p=14){if(rows.length<p*2+5)return null;const h=nums(rows,"high"),l=nums(rows,"low"),c=nums(rows,"close"),tr=[],pd=[],md=[];for(let i=1;i<h.length;i++){const up=h[i]-h[i-1],dn=l[i-1]-l[i];tr.push(Math.max(h[i]-l[i],Math.abs(h[i]-c[i-1]),Math.abs(l[i]-c[i-1])));pd.push(up>dn&&up>0?up:0);md.push(dn>up&&dn>0?dn:0)}let a=tr.slice(0,p).reduce((x,y)=>x+y,0)/p,pp=pd.slice(0,p).reduce((x,y)=>x+y,0)/p,mm=md.slice(0,p).reduce((x,y)=>x+y,0)/p;const dx=[];for(let i=p;i<tr.length;i++){a=(a*(p-1)+tr[i])/p;pp=(pp*(p-1)+pd[i])/p;mm=(mm*(p-1)+md[i])/p;const dip=100*pp/a,dim=100*mm/a;dx.push(100*Math.abs(dip-dim)/Math.max(dip+dim,1e-9));}return dx.length<p?null:dx.slice(-p).reduce((x,y)=>x+y,0)/p;}
function macd(v){const e12=ema(v,12),e26=ema(v,26);if(e12==null||e26==null)return null;return e12-e26;}
function bollinger(v,p=20,m=2){if(v.length<p)return null;const s=v.slice(-p),mid=s.reduce((a,b)=>a+b,0)/p,sd=Math.sqrt(s.reduce((a,b)=>a+(b-mid)**2,0)/p);return {middle:mid,upper:mid+m*sd,lower:mid-m*sd};}
function swings(rows,n=40){const h=nums(rows,"high").slice(-n),l=nums(rows,"low").slice(-n);let highs=[],lows=[];for(let i=2;i<h.length-2;i++){if(h[i]>h[i-1]&&h[i]>h[i-2]&&h[i]>=h[i+1]&&h[i]>=h[i+2])highs.push(h[i]);if(l[i]<l[i-1]&&l[i]<l[i-2]&&l[i]<=l[i+1]&&l[i]<=l[i+2])lows.push(l[i]);}return {highs,lows};}
function candlePattern(rows){const r=rows.slice(-4).map(x=>({o:+x.open,h:+x.high,l:+x.low,c:+x.close}));if(r.length<2)return "None";const a=r.at(-2),b=r.at(-1),body=Math.abs(b.c-b.o),range=Math.max(b.h-b.l,1e-9),upper=b.h-Math.max(b.o,b.c),lower=Math.min(b.o,b.c)-b.l;const bull=b.c>b.o,bear=b.c<b.o;const engulf=bull&&a.c<a.o&&b.o<=a.c&&b.c>=a.o||bear&&a.c>a.o&&b.o>=a.c&&b.c<=a.o;if(engulf)return bull?"Bullish engulfing":"Bearish engulfing";if(lower>body*2&&upper<body*.8)return "Hammer / rejection";if(upper>body*2&&lower<body*.8)return "Shooting star / rejection";if(body/range<.12)return "Doji";if(body/range>.65)return bull?"Strong bullish candle":"Strong bearish candle";return "None";}
function analyze(rows){
  const v=nums(rows,"close"),price=v.at(-1),e20=ema(v,20),e50=ema(v,50),e200=ema(v,200),rv=rsi(v),ax=adx(rows),a=atr(rows),mc=macd(v),bb=bollinger(v),sw=swings(rows),pattern=candlePattern(rows);
  let trend=0,momentum=0,strength=0,structure=0,patternScore=0,breakout=0,risk=0,reasons=[];
  if(e20&&e50){if(price>e20&&e20>e50){trend+=15;reasons.push("price is above EMA 20 and EMA 20 is above EMA 50");}else if(price<e20&&e20<e50){trend+=15;reasons.push("price is below EMA 20 and EMA 20 is below EMA 50");}else reasons.push("EMA alignment is mixed");}
  if(e50&&e200){if(price>e50&&e50>e200){trend+=10;reasons.push("EMA 50 is above EMA 200");}else if(price<e50&&e50<e200){trend+=10;reasons.push("EMA 50 is below EMA 200");}}
  if(rv!=null){if(rv>=52&&rv<=70){momentum+=10;reasons.push(`RSI ${rv.toFixed(1)} supports bullish momentum`);}else if(rv>=30&&rv<=48){momentum+=10;reasons.push(`RSI ${rv.toFixed(1)} supports bearish momentum`);}else reasons.push(`RSI ${rv.toFixed(1)} is neutral/extended`);}
  if(mc!=null){if(mc>0){momentum+=10;reasons.push("MACD is positive");}else{momentum+=10;reasons.push("MACD is negative");}}
  if(ax!=null){if(ax>=25){strength=15;reasons.push(`ADX ${ax.toFixed(1)} confirms trend strength`);}else if(ax>=20){strength=8;reasons.push(`ADX ${ax.toFixed(1)} shows moderate trend strength`);}else reasons.push(`ADX ${ax.toFixed(1)} suggests a range/weaker trend`);}
  if(e50&&sw.highs.length>=2&&sw.lows.length>=2){const hh=sw.highs.at(-1)>sw.highs.at(-2),hl=sw.lows.at(-1)>sw.lows.at(-2),lh=sw.highs.at(-1)<sw.highs.at(-2),ll=sw.lows.at(-1)<sw.lows.at(-2);if(hh&&hl){structure=15;reasons.push("market structure shows HH/HL");}else if(lh&&ll){structure=15;reasons.push("market structure shows LH/LL");}else structure=7;}
  if(/Bullish|Hammer|Strong bullish/.test(pattern)){patternScore=10;reasons.push(pattern+" detected");}else if(/Bearish|Shooting|Strong bearish/.test(pattern)){patternScore=10;reasons.push(pattern+" detected");}else if(pattern!=="None"){patternScore=5;reasons.push(pattern+" detected");}
  const nearUpper=bb&&price>bb.upper*.998,nearLower=bb&&price<bb.lower*1.002; if((nearUpper||nearLower)&&ax!=null&&ax>=20){breakout=7;reasons.push("price is expanding outside the recent Bollinger range");}
  const dirBull=(e50&&price>e50)||(rv!=null&&rv>50)||(mc!=null&&mc>0);const direction=dirBull?"BUY":"SELL";
  const raw=trend+momentum+strength+structure+patternScore+breakout;const score=Math.min(100,Math.round(raw));
  const stopDist=a?Math.max(a*1.2,price*0.001):null;let entry=price,stopLoss=null,tp1=null,tp2=null;
  if(score>=60&&stopDist){if(direction==="BUY"){stopLoss=price-stopDist;tp1=price+stopDist*1.5;tp2=price+stopDist*2.5;}else{stopLoss=price+stopDist;tp1=price-stopDist*1.5;tp2=price-stopDist*2.5;}risk=5;}
  const finalScore=Math.min(100,score+risk);let signal="WAIT";if(finalScore>=75)signal=direction;else if(finalScore>=60)signal=direction;const label=finalScore>=85?"HIGH-CONFLUENCE SETUP":finalScore>=75?"STRONG SETUP":finalScore>=60?"VALID SETUP":finalScore>=40?"WEAK SETUP":"WAIT";
  if(finalScore<60||!stopDist){signal="WAIT";entry=null;stopLoss=null;tp1=null;tp2=null;}
  return {direction:signal,score:finalScore,scoreLabel:label,price,entry,stopLoss,tp1,tp2,indicators:{rsi:rv,adx:ax,ema20:e20,ema50:e50,ema200:e200,atr:a,macd:mc,bollinger:bb,pattern,structure:sw.highs.length>=2&&sw.lows.length>=2?"confirmed swing structure":"developing"},reasons,recommendation:signal==="WAIT"?"Wait for stronger confluence, clearer structure, or a confirmed continuation setup.":`Technical bias: ${direction}. Wait for your own execution confirmation before entering.`,timestamp:new Date().toISOString()};
}
async function signalFor(key,interval=process.env.MARKET_INTERVAL||"15min"){const cfg=INSTRUMENTS[key];const d=await td("/time_series",{symbol:cfg.dataSymbol,interval,outputsize:300,timezone:"UTC"});if(!d.values?.length)throw new Error("No market data returned");const s=analyze(d.values);const c=nums(d.values,"close");s.percentChange=c.length>1?((c.at(-1)-c.at(-2))/c.at(-2))*100:0;s.sourceSymbol=cfg.dataSymbol;s.interval=interval;return s;}

app.get("/api/health",(req,res)=>res.json({ok:true,time:new Date().toISOString(),technicalOnly:true,twelveDataConfigured:Boolean(TD_KEY),paypalConfigured:Boolean(process.env.PAYPAL_CLIENT_ID&&process.env.PAYPAL_CLIENT_SECRET),instruments:Object.keys(INSTRUMENTS)}));
app.get("/api/instruments",(req,res)=>res.json(INSTRUMENTS));
app.get("/api/preview",(req,res)=>res.json({public:true,message:"Public preview. Member-only signal details require an active membership session."}));
app.get("/api/signals",async(req,res)=>{if(!TD_KEY)return res.status(503).json({error:"TWELVE_DATA_API_KEY is not configured"});const out={};await Promise.all(Object.keys(INSTRUMENTS).map(async k=>{try{out[k]=await signalFor(k);}catch(e){out[k]={direction:"WAIT",score:0,scoreLabel:"DATA UNAVAILABLE",price:null,entry:null,stopLoss:null,tp1:null,tp2:null,indicators:{},reasons:[],recommendation:"Market data unavailable for this instrument.",error:e.message,timestamp:new Date().toISOString()};}}));res.json(out);});
app.get("/api/member/signals",auth,async(req,res)=>{if(!TD_KEY)return res.status(503).json({error:"TWELVE_DATA_API_KEY is not configured"});const out={};await Promise.all(Object.keys(INSTRUMENTS).map(async k=>{try{out[k]=await signalFor(k);}catch(e){out[k]={direction:"WAIT",score:0,scoreLabel:"DATA UNAVAILABLE",error:e.message};}}));res.json(out);});
app.get("/api/strategy",(req,res)=>res.json({name:"BluEmaTrend Trade",author:"Iyaloo ‘Risky’",handle:"@riskybankss",priceNow:20,priceNextJanuary:200,ema:[20,50],timeframes:["4H","1H","15M","5M","1M"],document:"/downloads/BluEmaTrend_Trade_Polished.docx"}));

async function paypalToken(){const base=process.env.PAYPAL_ENV==="sandbox"?"https://api-m.sandbox.paypal.com":"https://api-m.paypal.com";const auth=Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");const r=await fetch(`${base}/v1/oauth2/token`,{method:"POST",headers:{Authorization:`Basic ${auth}`,"Content-Type":"application/x-www-form-urlencoded"},body:"grant_type=client_credentials"});const j=await r.json();if(!r.ok)throw new Error(j.error_description||"PayPal authentication failed");return {token:j.access_token,base};}
app.post("/api/paypal/order",async(req,res)=>{try{const {plan,email}=req.body;if(!["lifetime","monthly"].includes(plan)||!email) return res.status(400).json({error:"plan and email are required"});if(!process.env.PAYPAL_CLIENT_ID||!process.env.PAYPAL_CLIENT_SECRET)return res.status(503).json({error:"PayPal is not configured on the server"});if(plan==="monthly"){if(!process.env.PAYPAL_MONTHLY_PLAN_ID)return res.status(503).json({error:"PAYPAL_MONTHLY_PLAN_ID is not configured"});const pp=await paypalToken();const r=await fetch(`${pp.base}/v1/billing/subscriptions`,{method:"POST",headers:{Authorization:`Bearer ${pp.token}`,"Content-Type":"application/json"},body:JSON.stringify({plan_id:process.env.PAYPAL_MONTHLY_PLAN_ID,custom_id:String(email).trim().toLowerCase(),application_context:{brand_name:"QUANT-ALPHA",user_action:"SUBSCRIBE_NOW",return_url:`${APP_URL}/?payment=subscription&email=${encodeURIComponent(email)}`,cancel_url:`${APP_URL}/?payment=cancelled`}})});const j=await r.json();if(!r.ok)throw new Error(j.message||"Unable to create PayPal subscription");return res.json({id:j.id,approveUrl:j.links?.find(x=>x.rel==="approve")?.href});}const pp=await paypalToken();const r=await fetch(`${pp.base}/v2/checkout/orders`,{method:"POST",headers:{Authorization:`Bearer ${pp.token}`,"Content-Type":"application/json"},body:JSON.stringify({intent:"CAPTURE",purchase_units:[{amount:{currency_code:"USD",value:"200.00"},description:"Quant-Alpha Lifetime Access"}],application_context:{brand_name:"QUANT-ALPHA",user_action:"PAY_NOW",return_url:`${APP_URL}/?payment=success&email=${encodeURIComponent(email)}`,cancel_url:`${APP_URL}/?payment=cancelled`}})});const j=await r.json();if(!r.ok)throw new Error(j.message||"Unable to create PayPal order");res.json({id:j.id,approveUrl:j.links?.find(x=>x.rel==="approve")?.href});}catch(e){res.status(500).json({error:e.message});}});
app.post("/api/paypal/capture",async(req,res)=>{try{const {orderId,email}=req.body;if(!orderId||!email)return res.status(400).json({error:"orderId and email are required"});const pp=await paypalToken();const r=await fetch(`${pp.base}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,{method:"POST",headers:{Authorization:`Bearer ${pp.token}`,"Content-Type":"application/json"}});const j=await r.json();if(!r.ok||j.status!=="COMPLETED")return res.status(400).json({error:j.message||"Payment not completed"});const db=loadMembers();const member={email:String(email).trim().toLowerCase(),plan:"lifetime",status:"active",paypalOrderId:orderId,activatedAt:new Date().toISOString()};const existing=db.members.findIndex(m=>m.email===member.email);if(existing>=0)db.members[existing]={...db.members[existing],...member};else db.members.push(member);saveMembers(db);res.json({ok:true,token:issueSession(member),member:{email:member.email,plan:member.plan}});}catch(e){res.status(500).json({error:e.message});}});

app.post("/api/paypal/subscription/activate",async(req,res)=>{try{const {subscriptionId,email}=req.body;if(!subscriptionId||!email)return res.status(400).json({error:"subscriptionId and email are required"});const pp=await paypalToken();const r=await fetch(`${pp.base}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,{headers:{Authorization:`Bearer ${pp.token}`,Accept:"application/json"}});const j=await r.json();if(!r.ok||j.status!=="ACTIVE")return res.status(400).json({error:`Subscription status is ${j.status||"unknown"}`});const db=loadMembers();const member={email:String(email).trim().toLowerCase(),plan:"monthly",status:"active",paypalSubscriptionId:subscriptionId,activatedAt:new Date().toISOString()};const existing=db.members.findIndex(m=>m.email===member.email);if(existing>=0)db.members[existing]={...db.members[existing],...member};else db.members.push(member);saveMembers(db);res.json({ok:true,token:issueSession(member),member:{email:member.email,plan:member.plan}});}catch(e){res.status(500).json({error:e.message});}});

app.post("/api/member/verify",(req,res)=>{const s=verifySession(req.body?.token);if(!s)return res.status(401).json({error:"Invalid or expired session"});res.json({ok:true,member:{email:s.email,plan:s.plan}});});

app.get("/{*splat}",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`QUANT-ALPHA V3 listening on ${PORT}`));
