(() => {
  if (window.__d4gReady) return;
  const q=document.getElementById("q"),go=document.getElementById("go"),out=document.getElementById("results"),title=document.getElementById("title"),cur=document.getElementById("currency"),region=document.getElementById("region");
  if(!q||!go||!out)return;
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const money=n=>(cur?.value==="ZAR"?"R":cur?.value==="EUR"?"€":cur?.value==="GBP"?"£":cur?.value==="USD"?"$":(cur?.value||""))+Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  async function search(term){
    term=(term||q.value).trim();if(!term)return;
    q.value=term;title.textContent='Results for “'+term+'”';
    out.innerHTML='<div class="empty"><h3>Searching…</h3><p>Checking live deal data.</p></div>';
    try{
      const r=await fetch("/api/search?q="+encodeURIComponent(term)+"&currency="+encodeURIComponent(cur?.value||"ZAR")+"&region="+encodeURIComponent(region?.value||"global"),{cache:"no-store"});
      const p=await r.json();if(!r.ok)throw new Error(p.error||"Search failed");
      const groups=p.results||[];
      out.innerHTML=groups.length?groups.map(g=>'<article class="group"><div class="game">'+(g.cover?'<img src="'+esc(g.cover)+'" alt="">':'<span class="cover-placeholder"></span>')+'<div><h3>'+esc(g.title)+'</h3><p>'+esc(g.platform||"PC")+' • '+esc(g.edition||"Digital")+'</p></div></div>'+(g.deals||[]).map(d=>'<div class="row"><div class="store"><span class="logo">'+esc((d.storeName||"?").slice(0,2).toUpperCase())+'</span><div><strong>'+esc(d.storeName)+'</strong><small>'+esc(d.activation||"Digital")+'</small></div></div><div class="price">'+money(d.convertedPrice)+'</div><div class="discount">'+(d.discount?"-"+Math.round(d.discount)+"%":"—")+'</div><div class="region">'+esc(d.region||"Global")+'</div><a class="deal" href="'+esc(d.url)+'" target="_blank" rel="noopener noreferrer">View deal →</a></div>').join("")+'</article>').join(""):'<div class="empty"><h3>No matching deals</h3><p>Try another game.</p></div>';
    }catch(e){out.innerHTML='<div class="empty"><h3>Couldn’t load deals</h3><p>'+esc(e.message||"Please try again.")+'</p></div>'}
  }
  go.addEventListener("click",e=>{e.preventDefault();search()});
  q.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();search()}});
  document.querySelectorAll("[data-q]").forEach(b=>b.addEventListener("click",e=>{e.preventDefault();search(b.dataset.q)}));
})();