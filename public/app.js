(() => {
"use strict";
const C={ZAR:["R","South African Rand"],USD:["$","US Dollar"],EUR:["€","Euro"],GBP:["£","British Pound"],CAD:["C$","Canadian Dollar"],AUD:["A$","Australian Dollar"],JPY:["¥","Japanese Yen"],BRL:["R$","Brazilian Real"],INR:["₹","Indian Rupee"],KRW:["₩","South Korean Won"],CHF:["CHF","Swiss Franc"],NZD:["NZ$","New Zealand Dollar"],SGD:["S$","Singapore Dollar"],HKD:["HK$","Hong Kong Dollar"],SEK:["kr","Swedish Krona"],NOK:["kr","Norwegian Krone"],DKK:["kr","Danish Krone"],PLN:["zł","Polish Zloty"],CZK:["Kč","Czech Koruna"],MXN:["MX$","Mexican Peso"],TRY:["₺","Turkish Lira"],AED:["د.إ","UAE Dirham"],SAR:["﷼","Saudi Riyal"],ILS:["₪","Israeli New Shekel"]};
const $=id=>document.getElementById(id);
function init(){
  const cur=$("currency"),region=$("region"),q=$("q"),out=$("results"),platform=$("platform"),activation=$("activation"),source=$("source"),sort=$("sort"),title=$("title"),go=$("go"),alertDialog=$("alertDialog"),alertGame=$("alertGame"),alertPrice=$("alertPrice"),alertStatus=$("alertStatus");
  let pendingAlert=null;
  if(!cur||!region||!q||!out||!go)return;
  loadCapabilities();
  Object.entries(C).forEach(([k,v])=>{if(!cur.querySelector('option[value="'+k+'"]')){const o=document.createElement("option");o.value=k;o.textContent=v[0]+" "+k+" — "+v[1];cur.appendChild(o)}});
  cur.value=C[storageGet("d4g_currency")]?storageGet("d4g_currency"):"ZAR";
  region.value=["global","za","us","gb","eu","au","ca"].includes(storageGet("d4g_region"))?storageGet("d4g_region"):"global";
  let data=[];
  let searchController=null;
  const storageGet=k=>{try{return localStorage.getItem(k)}catch{return null}};
  const storageSet=(k,v)=>{try{localStorage.setItem(k,v)}catch{}};
  const storageKeys=()=>{try{return Object.keys(localStorage)}catch{return[]}};
  async function loadCapabilities(){
    try{
      const r=await fetch("/api/capabilities",{cache:"no-store"});
      if(!r.ok)return;
      const c=await r.json();
      platform.innerHTML='<option value="all">All platforms</option>';
      (c.platforms||[]).forEach(p=>{const o=document.createElement("option");o.value=p;o.textContent=p;platform.appendChild(o)});
      activation.innerHTML='<option value="all">All stores</option>';
      (c.stores||[]).forEach(s=>{const o=document.createElement("option");o.value=s;o.textContent=s;activation.appendChild(o)});
      const marketplace=source.querySelector('option[value="marketplace"]');
      if(marketplace){
        marketplace.disabled=!c.marketplaceLive;
        marketplace.textContent=c.marketplaceLive?"Key marketplaces":"Key marketplaces — awaiting live feed";
      }
    }catch{}
  }
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const initials=s=>String(s).split(/\s+/).map(x=>x[0]).slice(0,2).join("").toUpperCase();
  const moneyFor=(n,currency)=>{const code=currency||cur.value;return (C[code]?.[0]||code)+" "+Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2)};};
  const money=n=>moneyFor(n,cur.value);
  const historyKey=(name,store)=>"d4g_history:"+name.toLowerCase().replace(/[^a-z0-9]+/g,"-")+":"+store.toLowerCase().replace(/[^a-z0-9]+/g,"-")+":"+cur.value+":"+region.value;
  const getHistory=(name,store)=>{try{return JSON.parse(storageGet(historyKey(name,store))||"[]")}catch{return[]}};
  function recordHistory(){const now=new Date().toISOString().slice(0,10);data.forEach(g=>(g.deals||[]).forEach(d=>{if(!(Number(d.convertedPrice)>0))return;const k=historyKey(g.title||q.value,d.storeName||"store"),h=getHistory(g.title||q.value,d.storeName||"store");if(!h.length||h[h.length-1].date!==now)h.push({date:now,price:Number(d.convertedPrice)});else h[h.length-1].price=Number(d.convertedPrice);storageSet(k,JSON.stringify(h.slice(-30)))}))}
  function bestDeal(g){return (g.deals||[]).filter(d=>Number(d.convertedPrice)>0&&d.url).reduce((best,d)=>!best||d.convertedPrice<best.convertedPrice?d:best,null)}
  function alertKey(name){return "d4g_alert:"+name.toLowerCase().replace(/[^a-z0-9]+/g,"-")+":"+cur.value+":"+region.value}
  function getAlert(name){try{return JSON.parse(storageGet(alertKey(name))||"null")}catch{return null}}
  function checkAlerts(){const hits=[];data.forEach(g=>{const al=getAlert(g.title),b=bestDeal(g);if(al&&b&&b.convertedPrice<=al.target)hits.push(g.title+" is now "+money(b.convertedPrice)+" at "+b.storeName+" (alert: "+money(al.target)+").")});alertStatus.innerHTML=hits.map(x=>"<div>"+esc(x)+"</div>").join("");alertStatus.classList.toggle("show",hits.length>0)}
  function openAlert(g){pendingAlert=g;alertGame.textContent=g.title;const al=getAlert(g.title);alertPrice.value=al?Number(al.target).toFixed(2):"";if(alertDialog?.showModal&&!alertDialog.open)alertDialog.showModal();else if(alertDialog)alertDialog.setAttribute("open","")}
  function renderHistory(g){const stores=(g.deals||[]).filter(d=>Number(d.convertedPrice)>0&&d.url).map(d=>({d,h:getHistory(g.title,d.storeName)})).filter(x=>x.h.length);if(!stores.length)return '<div class="history-note">Price history starts tracking from your searches on this device.</div>';const all=stores.flatMap(x=>x.h.map(v=>v.price)),min=Math.min(...all),max=Math.max(...all),range=Math.max(max-min,1);return '<div class="history"><div><strong>Price history</strong><small>Last 30 observations</small></div>'+stores.slice(0,4).map(x=>'<div class="history-store"><span>'+esc(x.d.storeName)+'</span><div class="history-bars">'+x.h.slice(-14).map(v=>'<i title="'+esc(v.date+" — "+money(v.price))+'" style="height:'+Math.max(8,((v.price-min)/range)*52+8)+'px"></i>').join("")+'</div></div>').join("")+'</div>'}
  async function pollSavedAlerts(){
    const keys=storageKeys().filter(k=>k.startsWith("d4g_alert:"));
    const seen=new Set();
    for(const key of keys){
      const raw=storageGet(key);let alert=null;
      try{alert=JSON.parse(raw||"null")}catch{}
      if(!alert?.title||!(Number(alert.target)>0))continue;
      const id=alert.title+"|"+alert.currency+"|"+alert.region;
      if(seen.has(id))continue;seen.add(id);
      try{
        const r=await fetch("/api/search?q="+encodeURIComponent(alert.title)+"&currency="+encodeURIComponent(alert.currency||cur.value)+"&region="+encodeURIComponent(alert.region||region.value),{cache:"no-store"});
        if(!r.ok)continue;
        const payload=await r.json();
        const deals=(payload.results||[]).flatMap(g=>g.deals||[]).filter(d=>Number(d.convertedPrice)>0&&d.url);
        const best=deals.reduce((b,d)=>!b||d.convertedPrice<b.convertedPrice?d:b,null);
        if(best&&best.convertedPrice<=Number(alert.target)){
          const fingerprint=new Date().toISOString().slice(0,10)+"|"+best.storeName+"|"+best.convertedPrice.toFixed(2);
          if(alert.lastNotified!==fingerprint){
            alert.lastNotified=fingerprint;storageSet(key,JSON.stringify(alert));
            if("Notification" in window&&Notification.permission==="granted")new Notification("Deals4Gamerz price alert",{body:alert.title+" is now "+moneyFor(best.convertedPrice,alert.currency)+" at "+best.storeName+"."});
          }
        }
      }catch{}
    }
  }
  function render(){
    let groups=data.map(g=>({...g,deals:(g.deals||[]).filter(d=>Number(d.convertedPrice)>0&&d.url&&(platform.value==="all"||d.platform===platform.value)&&(activation.value==="all"||d.activation===activation.value)&&(source.value==="all"||d.source===source.value))})).filter(g=>g.deals.length);
    groups.forEach(g=>g.deals.sort((a,b)=>sort.value==="store"?(a.storeName||"").localeCompare(b.storeName||""):sort.value==="discount"?(b.discount||0)-(a.discount||0):a.convertedPrice-b.convertedPrice));
    if(!groups.length){
      const msg=source.value==="marketplace"?"No live key-marketplace pricing is connected yet. Official-store prices are available when the search returns them.":"No matching deals. Try another game or filter.";
      out.innerHTML='<div class="empty"><h3>No matching deals</h3><p>'+msg+'</p></div>';return;
    }
    out.innerHTML=groups.map(g=>'<article class="group"><div class="game">'+(g.cover?'<img src="'+esc(g.cover)+'" alt="">':'<span class="cover-placeholder" aria-hidden="true"></span>')+'<div><h3>'+esc(g.title)+'</h3><p>'+esc(g.platform)+' • '+esc(g.edition)+'</p></div><div class="game-actions"><span class="best-pill">BEST DEAL</span><button class="alert-btn" data-alert="'+esc(g.title)+'">🔔 Alert</button></div></div><div class="row head"><div>Store</div><div>Price</div><div>Discount</div><div>Region</div><div></div></div>'+g.deals.map(d=>'<div class="row'+(d===bestDeal(g)?' best-row':'')+'"><div class="store"><span class="logo">'+initials(d.storeName)+'</span><div><strong>'+esc(d.storeName)+'</strong><small>'+esc(d.activation)+'</small></div></div><div class="price">'+money(d.convertedPrice)+'</div><div class="discount">'+(d.discount?'-'+Math.round(d.discount)+'%':'—')+'</div><div class="region">'+esc(d.region)+'</div><a class="deal" href="'+esc(d.url)+'" target="_blank" rel="noopener noreferrer">View deal →</a></div>').join("")+renderHistory(g)+'</article>').join("");
  }
  async function search(){
    const term=q.value.trim();
    if(!term)return;
    if(searchController)searchController.abort();
    searchController=new AbortController();
    out.innerHTML='<div class="empty"><h3>Searching…</h3><p>Checking live deal data.</p></div>';
    title.textContent='Results for “'+term+'”';
    try{
      const r=await fetch('/api/search?q='+encodeURIComponent(term)+'&currency='+encodeURIComponent(cur.value)+'&region='+encodeURIComponent(region.value),{cache:"no-store",signal:searchController.signal});
      const payload=await r.json().catch(()=>({}));
      if(!r.ok)throw Error(payload.error||"Live search failed");
      data=payload.results||[];recordHistory();
      const stores=[...new Set(data.flatMap(g=>(g.deals||[]).map(d=>d.storeName)).filter(Boolean))].sort();
      const previous=activation.value;
      activation.innerHTML='<option value="all">All stores</option>'+stores.map(s=>'<option value="'+esc(s)+'">'+esc(s)+'</option>').join("");
      activation.value=stores.includes(previous)?previous:"all";
      render();checkAlerts();
    }catch(e){
      if(e?.name==="AbortError")return;
      out.innerHTML='<div class="empty"><h3>Couldn’t load deals</h3><p>'+esc(e.message||"Search failed. Please try again.")+'</p></div>';
    }
  }
  go.addEventListener("click",e=>{e.preventDefault();search()});
  q.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();search()}});
  document.querySelectorAll("[data-q]").forEach(b=>b.addEventListener("click",e=>{e.preventDefault();q.value=b.dataset.q;search()}));
  [platform,activation,source,sort].forEach(x=>x.addEventListener("change",render));
  setInterval(pollSavedAlerts,10*60*1000);
  setTimeout(pollSavedAlerts,3000);
  alertDialog?.querySelector("[data-close]")?.addEventListener("click",()=>alertDialog.close());
  alertDialog?.querySelector("[data-save-alert]")?.addEventListener("click",async()=>{if(!pendingAlert)return;const target=Number(alertPrice.value);if(!(target>0))return;const payload={target,created:new Date().toISOString(),title:pendingAlert.title,currency:cur.value,region:region.value};
    const saveKey=alertKey(pendingAlert.title);storageSet(saveKey,JSON.stringify(payload));
    if("Notification" in window&&Notification.permission==="default"){try{await Notification.requestPermission()}catch{}}
    alertDialog.close();checkAlerts();render();pollSavedAlerts()});
  cur.addEventListener("change",()=>{storageSet("d4g_currency",cur.value);if(q.value.trim())search()});
  region.addEventListener("change",()=>{storageSet("d4g_region",region.value);if(q.value.trim())search()});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();