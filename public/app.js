(() => {
"use strict";
const C={ZAR:["R","South African Rand"],USD:["$","US Dollar"],EUR:["€","Euro"],GBP:["£","British Pound"],CAD:["C$","Canadian Dollar"],AUD:["A$","Australian Dollar"],JPY:["¥","Japanese Yen"],BRL:["R$","Brazilian Real"],INR:["₹","Indian Rupee"],KRW:["₩","South Korean Won"],CHF:["CHF","Swiss Franc"],NZD:["NZ$","New Zealand Dollar"],SGD:["S$","Singapore Dollar"],HKD:["HK$","Hong Kong Dollar"],SEK:["kr","Swedish Krona"],NOK:["kr","Norwegian Krone"],DKK:["kr","Danish Krone"],PLN:["zł","Polish Zloty"],CZK:["Kč","Czech Koruna"],MXN:["MX$","Mexican Peso"],TRY:["₺","Turkish Lira"],AED:["د.إ","UAE Dirham"],SAR:["﷼","Saudi Riyal"],ILS:["₪","Israeli New Shekel"]};
const $=id=>document.getElementById(id);
function init(){
  const cur=$("currency"),region=$("region"),q=$("q"),out=$("results"),platform=$("platform"),activation=$("activation"),source=$("source"),sort=$("sort"),title=$("title"),go=$("go");
  if(!cur||!region||!q||!out||!go)return;
  loadCapabilities();
  Object.entries(C).forEach(([k,v])=>{if(!cur.querySelector('option[value="'+k+'"]')){const o=document.createElement("option");o.value=k;o.textContent=v[0]+" "+k+" — "+v[1];cur.appendChild(o)}});
  cur.value=localStorage.d4g_currency||"ZAR";\n  region.value=localStorage.d4g_region||"global";
  let data=[];
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
  const money=n=>(C[cur.value]?.[0]||cur.value)+Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  function render(){
    let groups=data.map(g=>({...g,deals:(g.deals||[]).filter(d=>Number(d.convertedPrice)>0&&d.url&&(platform.value==="all"||d.platform===platform.value)&&(activation.value==="all"||d.activation===activation.value)&&(source.value==="all"||d.source===source.value))})).filter(g=>g.deals.length);
    groups.forEach(g=>g.deals.sort((a,b)=>sort.value==="store"?(a.storeName||"").localeCompare(b.storeName||""):sort.value==="discount"?(b.discount||0)-(a.discount||0):a.convertedPrice-b.convertedPrice));
    if(!groups.length){
      const msg=source.value==="marketplace"?"No live key-marketplace pricing is connected yet. Official-store prices are available when the search returns them.":"No matching deals. Try another game or filter.";
      out.innerHTML='<div class="empty"><h3>No matching deals</h3><p>'+msg+'</p></div>';return;
    }
    out.innerHTML=groups.map(g=>'<article class="group"><div class="game"><img src="'+esc(g.cover)+'" alt=""><div><h3>'+esc(g.title)+'</h3><p>'+esc(g.platform)+' • '+esc(g.edition)+'</p></div><span class="badge">LIVE DATA</span></div><div class="row head"><div>Store</div><div>Price</div><div>Discount</div><div>Region</div><div></div></div>'+g.deals.map(d=>'<div class="row"><div class="store"><span class="logo">'+initials(d.storeName)+'</span><div><strong>'+esc(d.storeName)+'</strong><small>'+esc(d.activation)+'</small></div></div><div class="price">'+money(d.convertedPrice)+'</div><div class="discount">'+(d.discount?'-'+Math.round(d.discount)+'%':'—')+'</div><div class="region">'+esc(d.region)+'</div><a class="deal" href="'+esc(d.url)+'" target="_blank" rel="noopener noreferrer">View deal →</a></div>').join("")+'</article>').join("");
  }
  async function search(){
    const term=q.value.trim();
    if(!term)return;
    out.innerHTML='<div class="empty"><h3>Searching…</h3><p>Checking live deal data.</p></div>';
    title.textContent='Results for “'+term+'”';
    try{
      const r=await fetch('/api/search?q='+encodeURIComponent(term)+'&currency='+encodeURIComponent(cur.value)+'',{cache:"no-store"});
      const payload=await r.json().catch(()=>({}));
      if(!r.ok)throw Error(payload.error||"Live search failed");
      data=payload.results||[];
      const stores=[...new Set(data.flatMap(g=>(g.deals||[]).map(d=>d.storeName)).filter(Boolean))].sort();
      const previous=activation.value;
      activation.innerHTML='<option value="all">All stores</option>'+stores.map(s=>'<option value="'+esc(s)+'">'+esc(s)+'</option>').join("");
      activation.value=stores.includes(previous)?previous:"all";
      render();
    }catch(e){
      out.innerHTML='<div class="empty"><h3>Couldn’t load deals</h3><p>'+esc(e.message||"Search failed. Please try again.")+'</p></div>';
    }
  }
  go.addEventListener("click",e=>{e.preventDefault();search()});
  q.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();search()}});
  document.querySelectorAll("[data-q]").forEach(b=>b.addEventListener("click",e=>{e.preventDefault();q.value=b.dataset.q;search()}));
  [platform,activation,source,sort].forEach(x=>x.addEventListener("change",render));
  cur.addEventListener("change",()=>{localStorage.d4g_currency=cur.value;if(q.value.trim())search()});\n  region.addEventListener("change",()=>{localStorage.d4g_region=region.value;if(q.value.trim())search()});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();