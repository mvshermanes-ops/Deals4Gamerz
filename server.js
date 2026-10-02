const express=require("express");
const path=require("path");
const app=express();
const PORT=process.env.PORT||3000;
const cache=new Map();
const TTL=10*60*1000;

app.use(express.static(path.join(__dirname,"public")));

async function getJSON(url){
  const r=await fetch(url,{headers:{"User-Agent":"Deals4Gamerz/1.0"}});
  if(!r.ok) throw new Error("Upstream "+r.status);
  return r.json();
}
async function rates(base){
  const key="fx:"+base, hit=cache.get(key);
  if(hit&&Date.now()-hit.t<TTL)return hit.v;
  const v=await getJSON("https://open.er-api.com/v6/latest/"+encodeURIComponent(base));
  cache.set(key,{t:Date.now(),v}); return v;
}
app.get("/api/search",async(req,res)=>{
  const q=String(req.query.q||"").trim();
  const currency=String(req.query.currency||"ZAR").toUpperCase();
  const country=String(req.query.country||"ZA").toUpperCase();
  if(!q)return res.status(400).json({error:"Missing search query"});
  const key="s:"+q.toLowerCase()+":"+currency+":"+country, hit=cache.get(key);
  if(hit&&Date.now()-hit.t<TTL)return res.json(hit.v);
  try{
    const [games,fx,stores]=await Promise.all([
      getJSON("https://www.cheapshark.com/api/1.0/games?title="+encodeURIComponent(q)+"&limit=8"),
      rates("USD"),
      getJSON("https://www.cheapshark.com/api/1.0/stores")
    ]);
    const storeMap=Object.fromEntries((stores||[]).map(s=>[String(s.storeID),s.storeName]));
    const detailed=await Promise.all((games||[]).slice(0,6).map(async g=>{
      try{
        const detail=await getJSON("https://www.cheapshark.com/api/1.0/games?id="+encodeURIComponent(g.gameID));
        const deals=(detail.deals||[]).map(d=>{
          const rawSale=d.salePrice ?? d.price ?? d.sale_price ?? d.normalPrice ?? d.normal_price ?? 0;
          const rawNormal=d.normalPrice ?? d.retailPrice ?? d.normal_price ?? rawSale;
          const sale=Number.parseFloat(String(rawSale).replace(/,/g,"")) || 0;
          const normal=Number.parseFloat(String(rawNormal).replace(/,/g,"")) || sale;
          const rate=Number(fx?.rates?.[currency]);
          const converted=rate>0 ? sale*rate : sale;
          return {
            storeName:storeMap[String(d.storeID)]||("Store "+d.storeID),
            storeId:d.storeID,
            convertedPrice:converted,
            salePrice:sale,
            originalPrice:normal,
            currency:"USD",
            discount:normal?Math.max(0,(1-sale/normal)*100):0,
            url:"https://www.cheapshark.com/redirect?dealID="+encodeURIComponent(d.dealID),
            region:country,
            platform:"PC",
            activation:storeMap[String(d.storeID)]||"PC Store",
            verified:true
          };
        });
        return {title:detail.info?.title||g.external,cover:detail.info?.thumb||g.thumb,platform:"PC",edition:"Digital",deals};
      }catch{return null}
    }));
    const results=detailed.filter(Boolean).filter(g=>g.deals.length);
    const out={country,currency,results};
    cache.set(key,{t:Date.now(),v:out});
    res.json(out);
  }catch(e){console.error(e);res.status(502).json({error:"Live deal provider unavailable"});}
});
app.get("/health",(req,res)=>res.json({ok:true,name:"Deals4Gamerz"}));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,"0.0.0.0",()=>console.log("Deals4Gamerz listening on "+PORT));
