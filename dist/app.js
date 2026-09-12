const ids=["11","12","21","22"];
const state={fixed:null,nominal:null,op:null};
const $=id=>document.getElementById(id);
const n=id=>Number($(id).value);
const fmt=(v,d=3)=>Number.isFinite(v)?v.toLocaleString("es-EC",{minimumFractionDigits:d,maximumFractionDigits:d}):"—";

function buildBranches(){
  const colors={11:"#38bdf8",12:"#84cc16",21:"#a78bfa",22:"#f472b6"};
  $("branch-cards").innerHTML=ids.map(id=>`<article class="panel branch" data-id="${id}"><div class="branch-head"><h3>RAMA ${id}</h3><span>Nodo ${id[0]}</span></div><div class="amp" id="amp-${id}">— A</div><div class="delta" id="delta-${id}">Esperando calibración</div><div class="target-row"><label>Objetivo <input id="target-${id}" type="number" min="0" step="0.01" value="${id==='11'?1.2:id==='12'?1:id==='21'?.9:.8}"><span>A</span></label><label>R fija <input id="show-r-${id}" type="text" value="—" readonly><span>Ω</span></label></div><div class="rheo"><div class="rheo-top"><span>Reóstato Reo${id}</span><b id="reo-out-${id}">0.00 Ω</b></div><input id="reo-range-${id}" type="range" min="0" max="50" step="0.01" value="0"><label>Entrada directa<input id="reo-${id}" type="number" min="0" max="10000" step="0.01" value="0"><span>Ω</span></label><div class="quick">${[0,1,5,10].map(v=>`<button data-set-reo="${id}" data-value="${v}">${v} Ω</button>`).join("")}</div></div></article>`).join("");
  $("svg-branches").innerHTML=ids.map((id,i)=>{const x=[280,430,790,940][i];const y2=id[0]==='1'?295:295;return `<g style="--accent:${colors[id]}"><path class="branch-line" d="M${x} 75V132l-16 12 32 17-32 17 32 17-16 12v88"/><path class="current-arrow" d="M${x+38} 267V213" marker-end="url(#arrow)"/><text x="${x-24}" y="118" class="svg-label">R${id}</text><text x="${x-30}" y="235" class="svg-label">Reo${id}</text><text id="svg-i-${id}" x="${x+48}" y="250" class="svg-label">I${id}</text></g>`}).join("");
}

function validateInputs(values){return values.every(Number.isFinite)}
function computeFixed(force=false){
  if(state.fixed&&!force){$("confirm-dialog").showModal();return}
  const V=n("nom-v"),Rc1=n("rc1"),Rc2=n("rc2"),curr=Object.fromEntries(ids.map(id=>[id,n(`nom-i${id}`)]));
  const values=[V,Rc1,Rc2,...Object.values(curr)];
  if(!validateInputs(values)||V<=0||Rc1<0||Rc2<0||Object.values(curr).some(v=>v<=0))return showMessage("Revise los datos: V y corrientes deben ser mayores que cero; Rc1 y Rc2 no pueden ser negativas.","error");
  let result;try{result=AnodeflexModel.dimension({V,Rc1,Rc2,currents:curr})}catch(error){return showMessage(error.message==="voltage-exhausted"?"Las caídas en los cables consumen la tensión disponible. Reduzca corrientes o resistencias de cable, o aumente el voltaje.":"No se pudo obtener un conjunto físico de resistencias.","error")}
  const {It,I2,V1,V2,fixed}=result;
  state.fixed=fixed;state.nominal={V,Rc1,Rc2,curr,V1,V2,It,I2};
  ids.forEach(id=>{$(`fixed-r${id}`).textContent=`${fmt(fixed[id])} Ω`;$(`show-r-${id}`).value=fmt(fixed[id]);$(`target-${id}`).value=curr[id]});
  $("fixed-nodes").textContent=`${fmt(V1,2)} / ${fmt(V2,2)} V`;$("live-v").value=V;$("live-v-range").value=Math.min(100,V);
  localStorage.setItem("anodeflex-fixed",JSON.stringify({fixed,stateNominal:state.nominal}));showMessage("Resistencias calculadas y fijadas. Ya puede regular tensión y reóstatos.","success");solve();
}

function solve(){
  if(!state.fixed)return;
  const V=n("live-v"),Rc1=state.nominal.Rc1,Rc2=state.nominal.Rc2;
  const reo=Object.fromEntries(ids.map(id=>[id,Math.max(0,n(`reo-${id}`)||0)]));
  try{state.op=AnodeflexModel.simulate({V,Rc1,Rc2,fixed:state.fixed,rheostats:reo});render()}catch{return showMessage("La simulación contiene un valor no válido.","error")}
}

function render(){const o=state.op;$("live-v-out").textContent=`${fmt(o.V,2)} V`;$("head-current").textContent=`${fmt(o.It)} A`;$("head-power").textContent=`${fmt(o.pSource,2)} W`;$("health-dot").className="health-dot ok";$("health-label").textContent="Modelo válido";$("node-v1").textContent=`${fmt(o.V1,2)} V`;$("node-v2").textContent=`${fmt(o.V2,2)} V`;
  const tolerance=Math.max(.01,n("tolerance")||2);let allWithin=true;
  ids.forEach(id=>{const target=n(`target-${id}`),delta=o.currents[id]-target,pct=target>0?100*delta/target:NaN,within=Number.isFinite(pct)&&Math.abs(pct)<=tolerance;allWithin&&=within;$(`amp-${id}`).textContent=`${fmt(o.currents[id])} A`;$(`delta-${id}`).textContent=target>0?`${delta>=0?'+':''}${fmt(delta)} A · ${delta>=0?'+':''}${fmt(pct,1)} % del objetivo`:`Sin objetivo`;$(`delta-${id}`).className=`delta ${within?'status-ok':'status-warn'}`;$(`reo-out-${id}`).textContent=`${fmt(o.rheostats[id],2)} Ω`;$(`svg-i-${id}`).textContent=`I${id} ${fmt(o.currents[id],2)} A`});
  $("health-label").textContent=allWithin?"Objetivos cumplidos":"Simulación válida";
  $("res-it").textContent=`${fmt(o.It)} A`;$("res-i2").textContent=`${fmt(o.I2)} A`;$("res-dv1").textContent=`${fmt(o.It*o.Rc1,3)} V`;$("res-dv2").textContent=`${fmt(o.I2*o.Rc2,3)} V`;$("res-ps").textContent=`${fmt(o.pSource,2)} W`;$("res-pe").textContent=`${fmt(o.pError,6)} W`;
  $("results-body").innerHTML=ids.map(id=>{const t=n(`target-${id}`),d=o.currents[id]-t,p=t>0?100*d/t:NaN,pr=o.currents[id]**2*o.branch[id];return `<tr><td style="color:var(--${id==='11'?'blue':id==='12'?'lime':id==='21'?'violet':'pink'})">I${id}</td><td>${fmt(o.currents[id])} A</td><td>${fmt(t)} A</td><td class="${Math.abs(p)<=tolerance?'status-ok':'status-warn'}">${Number.isFinite(p)?fmt(p,2)+' %':'—'}</td><td>${fmt(state.fixed[id])} Ω</td><td>${fmt(o.rheostats[id])} Ω</td><td>${fmt(pr,2)} W</td></tr>`}).join("");
  const errors={"KCL nodo 1":o.It-o.currents["11"]-o.currents["12"]-o.I2,"KCL nodo 2":o.I2-o.currents["21"]-o.currents["22"],"KVL fuente–nodo 1":o.V-o.V1-o.It*o.Rc1,"KVL nodo 1–nodo 2":o.V1-o.V2-o.I2*o.Rc2,"Balance de potencia":o.pError};
  $("checks").innerHTML=Object.entries(errors).map(([label,value])=>`<p><span>${label}</span><b>${fmt(value,8)}</b></p>`).join("");
}

function assistedAdjustment(){
  if(!state.fixed)return showMessage("Calibre primero las resistencias fijas.","error");
  const targets=Object.fromEntries(ids.map(id=>[id,n(`target-${id}`)])),V=n("live-v"),maxReo=n("reo-max");
  if(!Object.values(targets).every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(maxReo)||maxReo<=0)return showMessage("Las cuatro corrientes objetivo y el reóstato máximo deben ser mayores que cero.","error");
  let result;try{result=AnodeflexModel.adjust({V,Rc1:state.nominal.Rc1,Rc2:state.nominal.Rc2,fixed:state.fixed,targets,maxReo})}catch{return showMessage("Las cuatro corrientes objetivo y el reóstato máximo deben ser mayores que cero.","error")}
  if(result.reason==="voltage")return showMessage("Los objetivos consumen más tensión de la disponible considerando Rc1 y Rc2.","error");
  if(!result.feasible){const parts=[];if(result.negative.length)parts.push(`Ramas ${result.negative.join(", ")}: requieren reducir la resistencia fija o aumentar la tensión`);if(result.over.length)parts.push(`Ramas ${result.over.join(", ")}: superan el máximo de ${fmt(maxReo,2)} Ω`);return showMessage(`Ajuste no alcanzable. ${parts.join(". ")}.`,"error")}
  ids.forEach(id=>syncPair($(`reo-range-${id}`),$(`reo-${id}`),Math.max(0,result.rheostats[id])));solve();showMessage(`Ajuste calculado para V1=${fmt(result.V1,3)} V y V2=${fmt(result.V2,3)} V.`,"success");
}

function caseData(){return {format:"anodeflex-pc-case",version:1,createdAt:new Date().toISOString(),calibration:{V:state.nominal.V,Rc1:state.nominal.Rc1,Rc2:state.nominal.Rc2,currents:state.nominal.curr,fixed:state.fixed},operation:{V:n("live-v"),targets:Object.fromEntries(ids.map(id=>[id,n(`target-${id}`)])),rheostats:Object.fromEntries(ids.map(id=>[id,n(`reo-${id}`)])),rheostatMax:n("reo-max"),tolerancePercent:n("tolerance")},results:state.op}}
function saveCase(){if(!state.op)return;const blob=new Blob([JSON.stringify(caseData(),null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`anodeflex-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function loadCase(file){const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(reader.result);if(data.format!=="anodeflex-pc-case"||!data.calibration?.fixed||!data.operation)throw new Error();state.fixed=data.calibration.fixed;state.nominal={V:data.calibration.V,Rc1:data.calibration.Rc1,Rc2:data.calibration.Rc2,curr:data.calibration.currents};const c=data.calibration.currents;state.nominal.It=Object.values(c).reduce((a,b)=>a+b,0);state.nominal.I2=c["21"]+c["22"];state.nominal.V1=state.nominal.V-state.nominal.It*state.nominal.Rc1;state.nominal.V2=state.nominal.V1-state.nominal.I2*state.nominal.Rc2;$("nom-v").value=state.nominal.V;$("rc1").value=state.nominal.Rc1;$("rc2").value=state.nominal.Rc2;ids.forEach(id=>{$(`nom-i${id}`).value=c[id];$(`fixed-r${id}`).textContent=`${fmt(state.fixed[id])} Ω`;$(`show-r-${id}`).value=fmt(state.fixed[id]);$(`target-${id}`).value=data.operation.targets[id];syncPair($(`reo-range-${id}`),$(`reo-${id}`),data.operation.rheostats[id])});$("fixed-nodes").textContent=`${fmt(state.nominal.V1,2)} / ${fmt(state.nominal.V2,2)} V`;$("live-v").value=data.operation.V;$("live-v-range").value=Math.min(100,data.operation.V);$("reo-max").value=data.operation.rheostatMax||100;$("tolerance").value=data.operation.tolerancePercent||2;localStorage.setItem("anodeflex-fixed",JSON.stringify({fixed:state.fixed,stateNominal:state.nominal}));solve();showMessage("Caso importado y recalculado correctamente.","success")}catch{showMessage("El archivo no corresponde a un caso ANODEFLEX válido.","error")}};reader.readAsText(file)}

function showMessage(text,type){const el=$("message");el.textContent=text;el.className=`message show ${type}`}
function syncPair(range,input,value){const rounded=Math.round(value*1000)/1000;range.value=Math.min(Number(range.max),rounded);input.value=rounded}
function wireEvents(){
  $("calculate-fixed").addEventListener("click",()=>computeFixed());$("confirm-dialog").addEventListener("close",e=>{if(e.target.returnValue==="confirm")computeFixed(true)});
  $("live-v-range").addEventListener("input",e=>{ $("live-v").value=e.target.value;solve()});$("live-v").addEventListener("input",e=>{ $("live-v-range").value=Math.min(100,Number(e.target.value)||0);solve()});
  ids.forEach(id=>{$(`reo-range-${id}`).addEventListener("input",e=>{ $(`reo-${id}`).value=e.target.value;solve()});$(`reo-${id}`).addEventListener("input",e=>{ $(`reo-range-${id}`).value=Math.min(50,Number(e.target.value)||0);solve()});$(`target-${id}`).addEventListener("input",solve)});
  document.addEventListener("click",e=>{const b=e.target.closest("[data-set-reo]");if(b){const id=b.dataset.setReo;syncPair($(`reo-range-${id}`),$(`reo-${id}`),Number(b.dataset.value));solve()}const s=e.target.closest("[data-scroll]");if(s)$(s.dataset.scroll).scrollIntoView({behavior:"smooth"})});
  $("reset-rheostats").addEventListener("click",()=>{ids.forEach(id=>syncPair($(`reo-range-${id}`),$(`reo-${id}`),0));solve()});
  $("assist").addEventListener("click",assistedAdjustment);$("tolerance").addEventListener("input",solve);$("save-case").addEventListener("click",saveCase);$("load-case").addEventListener("click",()=>$("case-file").click());$("case-file").addEventListener("change",e=>{if(e.target.files[0])loadCase(e.target.files[0]);e.target.value=""});$("print-report").addEventListener("click",()=>window.print());
}
function restore(){try{const saved=JSON.parse(localStorage.getItem("anodeflex-fixed"));if(saved?.fixed&&saved?.stateNominal){state.fixed=saved.fixed;state.nominal=saved.stateNominal;ids.forEach(id=>{$(`fixed-r${id}`).textContent=`${fmt(state.fixed[id])} Ω`;$(`show-r-${id}`).value=fmt(state.fixed[id])});$("fixed-nodes").textContent=`${fmt(state.nominal.V1,2)} / ${fmt(state.nominal.V2,2)} V`;solve();return}}catch{}computeFixed(true)}
let installPrompt=null;window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event;$("install-app").hidden=false});$("install-app").addEventListener("click",async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("install-app").hidden=true});
buildBranches();wireEvents();restore();if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js"));
