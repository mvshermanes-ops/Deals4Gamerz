const express=require("express");
const path=require("path");
const app=express();
const PORT=process.env.PORT||3000;
const cache=new Map();
const fxCache=new Map();
const FX_TTL=60*60*1000;
const RETAILER_INFO={
  "Fanatical":{source:"official",type:"Authorized retailer"},
  "GreenManGaming":{source:"official",type:"Authorized retailer"},
  "Green Man Gaming":{source:"official",type:"Authorized retailer"},
  "Humble Store":{source:"official",type:"Authorized retailer"},
  "Humble Bundle":{source:"official",type:"Authorized retailer"},
  "Gamesplanet":{source:"official",type:"Authorized retailer"},
  "GameBillet":{source:"official",type:"Authorized retailer"},
  "Gamebillet":{source:"official",type:"Authorized retailer"},
  "2Game":{source:"official",type:"Authorized retailer"},
  "GamersGate":{source:"official",type:"Authorized retailer"},
  "DLGamer":{source:"official",type:"Authorized retailer"},
  "IndieGala":{source:"official",type:"Authorized retailer"},
  "Allyouplay":{source:"official",type:"Authorized retailer"},
  "DreamGame":{source:"official",type:"Authorized retailer"},
  "Gamesload":{source:"official",type:"Authorized retailer"}
};

const TTL=10*60*1000;

app.use(express.static(path.join(__dirname,"public")));

async function getJSON(url){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const r=await fetch(url,{headers:{"User-Agent":"Deals4Gamerz/1.0 (live game deal comparison)"},signal:controller.signal});
    if(!r.ok) throw new Error("Upstream "+r.status);
    return await r.json();
  }finally{clearTimeout(timer)}
}

async function steamRegionalSearch(q,region,currency){
  const cc={za:"za",us:"us",gb:"gb",eu:"de",au:"au",ca:"ca"}[String(region||"").toLowerCase()];
  if(!cc)return [];
  try{
    const url="https://store.steampowered.com/api/storesearch/?term="+encodeURIComponent(q)+"&l=english&cc="+cc;
    const items=await getJSON(url);
    const rows=Array.isArray(items?.items)?items.items:[];
    const out=[];
    for(const p of rows.slice(0,8)){
      if(p?.type!=="app")continue;
      const amount=Number(p?.price?.final)/100;
      if(!(amount>0)||!p?.id)continue;
      const from=String(p?.price?.currency||"USD").toUpperCase();
      const fx=from===currency?1:Number((await rates(from,currency).catch(()=>null))?.rates?.[currency]||0);
      if(!(fx>0))continue;
      out.push({
        storeName:"Steam",
        storeId:"steam",
        convertedPrice:amount*fx,
        salePrice:amount,
        originalPrice:Number(p?.price?.initial||p?.price?.final)/100*fx,
        currency:from,
        discount:Number(p?.price?.discount_percent)||0,
        url:"https://store.steampowered.com/app/"+encodeURIComponent(p.id)+"/",
        region:cc.toUpperCase(),
        platform:"PC",
        activation:"Steam",
        verified:true,
        source:"official",
        type:"Official digital store",
        availability:"Available",
        stock:null,
        title:p.name||q,
        cover:p.tiny_image||""
      });
    }
    return out;
  }catch(e){
    console.error("Steam regional search error:",e?.message||e);
    return [];
  }
}

async function rates(base="USD",quote=null){
  const b=String(base||"USD").toUpperCase();
  const q=quote?String(quote).toUpperCase():null;
  if(!q&&b==="USD")return {rates:{USD:1}};
  if(q&&b===q)return {rates:{[b]:1}};
  const cacheKey=b+":"+String(q||"*");
  const cached=fxCache.get(cacheKey);
  if(cached&&Date.now()-cached.t<FX_TTL)return cached.v;
  const url="https://api.frankfurter.dev/v2/rates?base="+encodeURIComponent(b)+(q?"&quotes="+encodeURIComponent(q):"");
  const r=await fetch(url,{headers:{"User-Agent":"Deals4Gamerz/1.0"},signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw new Error("FX upstream "+r.status);
  const j=await r.json();
  const rows=Array.isArray(j)?j:[];
  const rates={ [b]:1 };
  for(const row of rows){
    if(row?.quote&&Number.isFinite(Number(row.rate)))rates[String(row.quote).toUpperCase()]=Number(row.rate);
  }
  const value={rates};
  fxCache.set(cacheKey,{t:Date.now(),v:value});
  return value;
}

app.get("/api/search",async(req,res)=>{
  const q=String(req.query.q||"").trim();
  const currency=String(req.query.currency||"ZAR").toUpperCase();
  const region=String(req.query.region||"global").toLowerCase();
  if(!q)return res.status(400).json({error:"Missing search query"});
  const key="s:"+q.toLowerCase()+":"+currency+":"+region;
  const hit=cache.get(key);
  if(hit&&Date.now()-hit.t<TTL)return res.json(hit.v);
  try{
    const deals=await getJSON(
      "https://www.cheapshark.com/api/1.0/deals?title="+encodeURIComponent(q)+"&pageSize=60&sortBy=Price&desc=0"
    );
    const fx=await rates("USD",currency);
    const stores=await getJSON("https://www.cheapshark.com/api/1.0/stores").catch(()=>[]);
    const storeMap=Object.fromEntries((Array.isArray(stores)?stores:[]).map(s=>[String(s.storeID),s.storeName]));
    const groups=new Map();
    for(const d of (Array.isArray(deals)?deals:[])){
      const sale=Number.parseFloat(String(d.salePrice??"").replace(/,/g,""));
      const normal=Number.parseFloat(String(d.normalPrice??"").replace(/,/g,""));
      const rate=Number(fx?.rates?.[currency]);
      const converted=Number.isFinite(sale)&&sale>0&&rate>0?sale*rate:0;
      if(!(converted>0)||!d.dealID)continue;
      const storeName=storeMap[String(d.storeID)]||("Store "+d.storeID);
      const info=RETAILER_INFO[storeName]||{source:"official",type:"Store"};
      const deal={
        storeName,storeId:d.storeID,convertedPrice:converted,salePrice:sale,
        originalPrice:Number.isFinite(normal)&&normal>0?normal:sale,currency:"USD",
        discount:Number.parseFloat(d.savings)||0,
        url:"https://www.cheapshark.com/redirect?dealID="+encodeURIComponent(d.dealID),
        region:"Global",
        platform:"PC",activation:storeName,verified:true,source:info.source,type:info.type,
        availability:"Available",stock:null
      };
      const groupKey=String(d.gameID||d.internalName||d.title);
      if(!groups.has(groupKey))groups.set(groupKey,{title:d.title||q,cover:d.thumb||"",platform:"PC",edition:"Digital",deals:[]});
      groups.get(groupKey).deals.push(deal);
    }
    const steamDeals=await steamRegionalSearch(q,region,currency).catch(()=>[]);
    if(steamDeals.length){
      for(const d of steamDeals){
        const groupKey="steam:"+String(d.title||q).toLowerCase();
        if(!groups.has(groupKey))groups.set(groupKey,{title:d.title||q,cover:d.cover||"",platform:"PC",edition:"Digital",deals:[]});
        groups.get(groupKey).deals.push(d);
      }
    }
    const results=[...groups.values()]
      .map(g=>({...g,deals:g.deals.filter(d=>Number(d.convertedPrice)>0&&d.url)}))
      .filter(g=>g.deals.length);
    const out={region,currency,results};
    cache.set(key,{t:Date.now(),v:out});
    res.json(out);
  }catch(e){
    console.error("Deals4Gamerz search error:",e);
    res.status(502).json({error:"Live deal provider unavailable",details:e?.message||"Unknown upstream error"});
  }
});

app.get("/api/capabilities",(req,res)=>{
  res.json({
    platforms:["PC"],
    stores:["Steam"],
    marketplaceLive:false,
    xboxLive:false
  });
});
app.get("/health",(req,res)=>res.json({ok:true,name:"Deals4Gamerz"}));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,"0.0.0.0",()=>console.log("Deals4Gamerz listening on "+PORT));
