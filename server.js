const express=require("express");
const path=require("path");
const app=express();
const PORT=process.env.PORT||3000;
const cache=new Map();
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
async function driffleToken(){
  const key=process.env.DRIFFLE_API_KEY;
  if(!key) return null;
  const r=await fetch("https://services.driffle.com/api/seller/legacy/token",{
    method:"POST",
    headers:{"Content-Type":"application/json","User-Agent":"Deals4Gamerz/1.0"},
    body:JSON.stringify({apiKey:key})
  });
  if(!r.ok) return null;
  const j=await r.json();
  return j?.data?.token||null;
}
async function driffleSearch(q,currency,fx){
  const token=await driffleToken();
  if(!token) return [];
  try{
    const url="https://services.driffle.com/api/seller/legacy/products?searchPhrase="+encodeURIComponent(q)+"&productType=game&limit=10";
    const r=await fetch(url,{headers:{Authorization:"Bearer "+token,"User-Agent":"Deals4Gamerz/1.0"}});
    if(!r.ok) return [];
    const j=await r.json();
    const products=Array.isArray(j?.data)?j.data:[];
    const out=[];
    for(const p of products.slice(0,5)){
      try{
        const cr=await fetch(
          "https://services.driffle.com/api/seller/legacy/products/"+encodeURIComponent(p.productId)+"/competitions",
          {headers:{Authorization:"Bearer "+token,"User-Agent":"Deals4Gamerz/1.0"}}
        );
        if(!cr.ok) continue;
        const cj=await cr.json();
        for(const o of (cj?.competitions?.offers||[])){
          const amount=Number(o?.price?.amount);
          if(!(amount>0)||o?.canBePurchased!==true||o?.isInStock===false) continue;
          const from=String(o?.price?.currency||"USD").toUpperCase();
          let converted=0;
          if(from===currency) converted=amount;
          else if(from==="USD") converted=amount*Number(fx?.rates?.[currency]||0);
          else {
            const local=await rates(from).catch(()=>null);
            converted=amount*Number(local?.rates?.[currency]||0);
          }
          if(!(converted>0)) continue;
          out.push({
            storeName:"Driffle",
            storeId:"driffle",
            convertedPrice:converted,
            salePrice:amount,
            originalPrice:amount,
            currency:from,
            discount:0,
            url:"https://driffle.com/product/"+encodeURIComponent(p.slug||p.title),
            region:p.regionName||"Various",
            platform:p.platform||"PC",
            activation:p.platform||"Digital Key",
            source:"marketplace",
            type:"Game Key",
            availability:"In stock",
            stock:null,
            verified:true
          });
        }
      }catch{}
    }
    return out;
  }catch{return []}
}
async function playstationSearch(q,currency,region){
  const key=process.env.PLATPRICES_API_KEY;
  if(!key)return [];
  const requestedRegion=String(region||"za").toLowerCase();
  try{
    const url="https://platprices.com/api/v2/games/search?q="+encodeURIComponent(q)+"&region="+encodeURIComponent(requestedRegion)+"&fields=PPID,ProductName,Img,PSStoreURL,BasePrice,SalePrice,DiscPerc,PriceCurrency,region";
    const r=await fetch(url,{headers:{"X-API-Key":key,"User-Agent":"Deals4Gamerz/1.0"}});
    if(!r.ok)return [];
    const j=await r.json();
    if(j?.success===false||!Array.isArray(j.data))return [];
    const from=String(j?.meta?.region||j?.data?.[0]?.PriceCurrency||"USD").toUpperCase();
    const fx=from===currency?1:Number(((await rates(from).catch(()=>null))||{}).rates?.[currency]||0);
    if(!(fx>0))return [];
    return j.data.slice(0,8).map(function(p){
      const raw=Number(p.SalePrice??p.BasePrice);
      const base=Number(p.BasePrice??raw);
      if(!(raw>=0)||!p.PSStoreURL)return null;
      const local=raw/100;
      const original=base/100;
      return {
        storeName:"PlayStation Store",
        storeId:"playstation",
        convertedPrice:local*fx,
        salePrice:local,
        originalPrice:original*fx,
        currency:from,
        discount:Number(p.DiscPerc)||0,
        url:p.PSStoreURL,
        region:String(p.region||requestedRegion).toUpperCase(),
        platform:(p.IsPS5&&p.IsPS4)?"PlayStation":(p.IsPS5?"PS5":"PS4"),
        activation:"PlayStation Store",
        verified:true,
        source:"official",
        type:"Official digital store",
        availability:"Available",
        stock:null
      };
    }).filter(Boolean);
  }catch(e){
    console.error("PlatPrices error:",e?.message||e);
    return [];
  }
}

app.get("/api/capabilities",(req,res)=>{
  res.json({
    platforms:["PC",...(process.env.PLATPRICES_API_KEY?["PlayStation"]:[])],
    stores:["Steam"],
    marketplaceLive:Boolean(process.env.DRIFFLE_API_KEY),
    playstationLive:Boolean(process.env.PLATPRICES_API_KEY),
    xboxLive:false
  });
});
app.get("/health",(req,res)=>res.json({ok:true,name:"Deals4Gamerz"}));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,"0.0.0.0",()=>console.log("Deals4Gamerz listening on "+PORT));
