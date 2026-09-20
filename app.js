const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let db;
const openDB=()=>new Promise((res,rej)=>{const r=indexedDB.open('progettoMangaV2',1);r.onupgradeneeded=()=>{const d=r.result;['assets','project'].forEach(n=>{if(!d.objectStoreNames.contains(n))d.createObjectStore(n,{keyPath:'id'})})};r.onsuccess=()=>{db=r.result;res()};r.onerror=()=>rej(r.error)});
const st=(n,m='readonly')=>db.transaction(n,m).objectStore(n);
const put=(n,v)=>new Promise((res,rej)=>{let r=st(n,'readwrite').put(v);r.onsuccess=res;r.onerror=()=>rej(r.error)});
const all=n=>new Promise((res,rej)=>{let r=st(n).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const get=(n,id)=>new Promise((res,rej)=>{let r=st(n).get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const esc=s=>(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
$$('nav button').forEach(b=>b.onclick=()=>{$$('.view').forEach(v=>v.classList.toggle('active',v.id===b.dataset.view));$$('nav button').forEach(x=>x.classList.toggle('active',x===b));if(b.dataset.view==='library')renderAssets()});
async function pdfText(file){
 const buf=await file.arrayBuffer(); const pdf=await pdfjsLib.getDocument({data:buf}).promise; let text='', previews=[];
 for(let i=1;i<=pdf.numPages;i++){const p=await pdf.getPage(i);const tc=await p.getTextContent();const t=tc.items.map(x=>x.str).join(' ').trim();text+=`\n[PAGINA ${i}] ${t}`;}
 return {text:text.trim(),pages:pdf.numPages};
}
$('#libraryFiles').onchange=async e=>{
 const files=[...e.target.files]; if(!files.length)return;
 $('#status').textContent='Lettura…';
 for(const f of files){
   let kind=f.type==='application/pdf'?'PDF':'IMMAGINE', text='', pages=1;
   try{if(kind==='PDF'){const r=await pdfText(f);text=r.text;pages=r.pages}}
   catch(err){text='';}
   await put('assets',{id:crypto.randomUUID(),name:f.name,kind,text,pages,size:f.size,created:Date.now()});
 }
 e.target.value=''; $('#status').textContent='Locale'; renderAssets();
};
async function renderAssets(){
 const a=await all('assets');
 $('#assetList').innerHTML=a.length?a.sort((x,y)=>y.created-x.created).map(x=>`<div class="card"><b>${esc(x.name)}</b><small>${x.kind}${x.kind==='PDF'?` · ${x.pages} pagine`:''}</small><div><span class="tag">CANONICO</span>${x.kind==='PDF'?`<span class="tag">${x.text? 'testo letto':'nessun testo estraibile'}</span>`:''}</div>${x.text?`<small>${esc(x.text.slice(0,180))}${x.text.length>180?'…':''}</small>`:''}</div>`).join(''):'<p class="muted">Nessun file caricato.</p>';
}
function tokens(s){return (s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9]+/g)||[]).filter(w=>w.length>2)}
function candidates(scene, assets){
 const corpus=assets.map(a=>({a,words:new Set(tokens(a.name+' '+(a.text||'')))}));
 const lines=scene.split(/\n+/).map(x=>x.trim()).filter(Boolean);
 const proper=[...new Set((scene.match(/\b[A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ]{2,}\b/g)||[]).filter(x=>!/^Vignetta$/i.test(x)))];
 const missing=[];
 for(const name of proper){const n=tokens(name)[0];if(!corpus.some(c=>c.words.has(n)))missing.push(name)}
 return {lines,proper,missing,found:proper.filter(n=>!missing.includes(n))};
}
$('#preflight').onclick=async()=>{
 const scene=$('#scene').value.trim(); if(!scene)return alert('Scrivi prima la scena o le vignette.');
 const assets=await all('assets'); const r=candidates(scene,assets);
 let html='<div class="check"><h2>Controllo prima della generazione</h2>';
 if(!assets.length) html+=`<div class="warn"><b>Libreria vuota.</b><br>Prima di generare, carica PDF o immagini canoniche.<div class="actions"><button onclick="document.querySelector('[data-view=library]').click()">Carica file</button></div></div>`;
 else{
   html+=`<div class="ok"><b>${assets.length} file canonici disponibili.</b><br>${r.found.length?'Riconosciuti nella richiesta: '+r.found.map(esc).join(', '):'Nessun nome proprio riconosciuto con certezza.'}</div>`;
   if(r.missing.length) html+=r.missing.map(n=>`<div class="warn"><b>Manca: ${esc(n)}</b><br>Non verrà inventato automaticamente.<div class="actions"><button onclick="document.querySelector('[data-view=library]').click()">Carica file</button><button onclick="alert('Generazione reference: provider AI non ancora collegato.')">Genera reference</button></div></div>`).join('');
   else html+=`<div class="ok"><b>Preflight completato.</b><br>Le reference nominate risultano presenti. Il prossimo modulo collegherà questa richiesta al generatore immagini e controllerà anche viste/dettagli mancanti (es. piede, schiena, suola).</div>`;
 }
 html+=`<div class="card"><b>Vignette rilevate: ${r.lines.length}</b><small>${r.lines.map(esc).join('<br>')}</small></div></div>`;
 $('#checkResult').innerHTML=html;
};
$('#clearScene').onclick=()=>{$('#scene').value='';$('#checkResult').innerHTML=''};
$('#saveProject').onclick=async()=>{await put('project',{id:'main',title:$('#title').value,rules:$('#rules').value,updated:Date.now()});$('#saved').textContent='Salvato ✓ '+new Date().toLocaleTimeString()};
(async()=>{await openDB();const p=await get('project','main');if(p){$('#title').value=p.title||'';$('#rules').value=p.rules||''}renderAssets();if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js')})();