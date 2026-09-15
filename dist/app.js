const ids=["11","12","21","22"];
const state={fixed:null,nominal:null,op:null};
const $=id=>document.getElementById(id);
const n=id=>Number($(id).value);
const fmt=(value,digits=3)=>Number.isFinite(value)?value.toLocaleString("es-EC",{minimumFractionDigits:digits,maximumFractionDigits:digits}):"—";
const powerFmt=value=>Number.isFinite(value)?value.toFixed(2):"—";
const fixedInputs=()=>Object.fromEntries(ids.map(id=>[id,n(`system-r-${id}`)]));

function buildBranches(){
  const defaults={"11":1.2,"12":1,"21":.9,"22":.8};
  $("branch-cards").innerHTML=ids.map(id=>`
    <article class="panel branch tone-${id}" data-id="${id}">
      <div class="branch-head"><div><span>NODO ${id[0]}</span><h3>RAMA ${id}</h3></div><div class="amp" id="amp-${id}">— A</div></div>
      <div class="branch-inputs">
        <label><span class="input-title">Corriente</span><input id="target-${id}" type="number" min="0.001" step="0.01" value="${defaults[id]}"><em>A</em></label>
        <label><span class="input-title"><span>Reo${id}</span><strong id="reo-power-${id}">0.00 W</strong></span><input id="reo-${id}" type="number" min="0" max="10000" step="0.01" value="0"><em>Ω</em></label>
      </div>
      <div class="fixed-note"><span>Resistencia del Sistema R${id}</span><label class="fixed-control"><input id="system-r-${id}" aria-label="Resistencia del Sistema R${id}" type="number" min="0.01" step="0.01"><em>Ω</em></label></div>
    </article>`).join("");
}

function validateInputs(values){return values.every(Number.isFinite)}

function computeFixed(force=false){
  if(state.fixed&&!force){$("confirm-dialog").showModal();return}
  const V=n("nom-v"),Rc1=n("rc1"),Rc2=n("rc2"),curr=Object.fromEntries(ids.map(id=>[id,n(`nom-i${id}`)]));
  if(!validateInputs([V,Rc1,Rc2,...Object.values(curr)])||V<=0||Rc1<0||Rc2<0||Object.values(curr).some(value=>value<=0)){
    showMessage("Revise los datos: el voltaje y las corrientes deben ser mayores que cero; Rc1 y Rc2 no pueden ser negativas.","error");return;
  }
  let result;
  try{result=AnodeflexModel.dimension({V,Rc1,Rc2,currents:curr})}
  catch(error){showMessage(error.message==="voltage-exhausted"?"Las caídas en los cables consumen la tensión disponible. Reduzca corrientes o resistencias de cable, o aumente el voltaje.":"No se pudo obtener un conjunto físico de resistencias.","error");return}
  const {It,I2,V1,V2,fixed}=result;
  state.fixed=fixed;state.nominal={V,Rc1,Rc2,curr,V1,V2,It,I2};
  ids.forEach(id=>{$(`fixed-r${id}`).textContent=`${fmt(fixed[id],2)} Ω`;$(`system-r-${id}`).value=Number(fixed[id]).toFixed(2);$(`target-${id}`).value=curr[id]});
  $("fixed-nodes").textContent=`${fmt(V1,2)} / ${fmt(V2,2)} V`;$("live-v").value=V;
  localStorage.setItem("anodeflex-fixed",JSON.stringify({fixed,stateNominal:state.nominal}));
  showMessage("Resistencias calculadas y fijadas. Ya puede regular el voltaje y los reóstatos.","success");solve();
}

function solve(){
  if(!state.fixed)return;
  const fixed=fixedInputs();
  if(ids.some(id=>!Number.isFinite(fixed[id])||fixed[id]<=0)){showMessage("Las resistencias del sistema deben ser mayores que cero.","error");return}
  state.fixed=fixed;
  const V=n("live-v"),reo=Object.fromEntries(ids.map(id=>[id,Math.max(0,n(`reo-${id}`)||0)]));
  try{state.op=AnodeflexModel.simulate({V,Rc1:state.nominal.Rc1,Rc2:state.nominal.Rc2,fixed:state.fixed,rheostats:reo});render()}
  catch{showMessage("La simulación contiene un valor no válido.","error")}
  localStorage.setItem("anodeflex-fixed",JSON.stringify({fixed:state.fixed,stateNominal:state.nominal}));
}

function render(){
  const o=state.op,tolerance=Math.max(.01,n("tolerance")||2);let allWithin=true;
  $("live-v-out").textContent=`${fmt(o.V,2)} V`;$("head-current").textContent=`${fmt(o.It)} A`;$("health-dot").className="health-dot ok";
  ids.forEach(id=>{const target=n(`target-${id}`),delta=o.currents[id]-target,pct=target>0?100*delta/target:NaN,within=Number.isFinite(pct)&&Math.abs(pct)<=tolerance;allWithin&&=within;$(`amp-${id}`).textContent=`${fmt(o.currents[id])} A`;$(`reo-power-${id}`).textContent=`${powerFmt(o.currents[id]**2*o.rheostats[id])} W`});
  $("health-label").textContent=allWithin?"Objetivos cumplidos":"Simulación válida";
  $("res-it").textContent=`${fmt(o.It)} A`;$("res-i2").textContent=`${fmt(o.I2)} A`;$("res-dv1").textContent=`${fmt(o.It*o.Rc1,3)} V`;$("res-dv2").textContent=`${fmt(o.I2*o.Rc2,3)} V`;$("res-ps").textContent=`${fmt(o.pSource,2)} W`;$("res-pe").textContent=`${fmt(o.pError,6)} W`;
  $("results-body").innerHTML=ids.map(id=>{const target=n(`target-${id}`),delta=o.currents[id]-target,pct=target>0?100*delta/target:NaN,power=o.currents[id]**2*o.branch[id];return `<tr><td>I${id}</td><td>${fmt(o.currents[id])} A</td><td>${fmt(target)} A</td><td class="${Math.abs(pct)<=tolerance?"status-ok":"status-warn"}">${Number.isFinite(pct)?fmt(pct,2)+" %":"—"}</td><td>${fmt(state.fixed[id],2)} Ω</td><td>${fmt(o.rheostats[id])} Ω</td><td>${fmt(power,2)} W</td></tr>`}).join("");
  const errors={"KCL nodo 1":o.It-o.currents["11"]-o.currents["12"]-o.I2,"KCL nodo 2":o.I2-o.currents["21"]-o.currents["22"],"KVL fuente–nodo 1":o.V-o.V1-o.It*o.Rc1,"KVL nodo 1–nodo 2":o.V1-o.V2-o.I2*o.Rc2,"Balance de potencia":o.pError};
  $("checks").innerHTML=Object.entries(errors).map(([label,value])=>`<p><span>${label}</span><b>${fmt(value,8)}</b></p>`).join("");
}

function setRheostat(id,value){$(`reo-${id}`).value=Math.round(Math.max(0,value)*1000)/1000}

function assistedAdjustment(){
  if(!state.fixed){showMessage("Calibre primero las resistencias fijas.","error");return}
  const targets=Object.fromEntries(ids.map(id=>[id,n(`target-${id}`)])),V=n("live-v"),maxReo=n("reo-max");
  if(!Object.values(targets).every(value=>Number.isFinite(value)&&value>0)||!Number.isFinite(maxReo)||maxReo<=0){showMessage("Las cuatro corrientes objetivo y el reóstato máximo deben ser mayores que cero.","error");return}
  let result;
  try{result=AnodeflexModel.adjust({V,Rc1:state.nominal.Rc1,Rc2:state.nominal.Rc2,fixed:state.fixed,targets,maxReo})}
  catch{showMessage("No se pudo calcular el ajuste con los datos ingresados.","error");return}
  if(result.reason==="voltage"){showMessage("Los objetivos consumen más tensión de la disponible considerando Rc1 y Rc2.","error");return}
  if(!result.feasible){const parts=[];if(result.negative.length)parts.push(`Ramas ${result.negative.join(", ")}: requieren reducir la resistencia fija o aumentar la tensión`);if(result.over.length)parts.push(`Ramas ${result.over.join(", ")}: superan el máximo de ${fmt(maxReo,2)} Ω`);showMessage(`Ajuste no alcanzable. ${parts.join(". ")}.`,"error");return}
  ids.forEach(id=>setRheostat(id,result.rheostats[id]));solve();showMessage(`Ajuste calculado para V1=${fmt(result.V1,3)} V y V2=${fmt(result.V2,3)} V.`,"success");
}

function caseData(){return {format:"anodeflex-pc-case",version:1,createdAt:new Date().toISOString(),calibration:{V:state.nominal.V,Rc1:state.nominal.Rc1,Rc2:state.nominal.Rc2,currents:state.nominal.curr,fixed:state.fixed},operation:{V:n("live-v"),targets:Object.fromEntries(ids.map(id=>[id,n(`target-${id}`)])),rheostats:Object.fromEntries(ids.map(id=>[id,n(`reo-${id}`)])),rheostatMax:n("reo-max"),tolerancePercent:n("tolerance")},results:state.op}}
function saveCase(){if(!state.op)return;const blob=new Blob([JSON.stringify(caseData(),null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=`anodeflex-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}

function loadCase(file){
  const reader=new FileReader();
  reader.onload=()=>{try{const data=JSON.parse(reader.result);if(data.format!=="anodeflex-pc-case"||!data.calibration?.fixed||!data.operation)throw new Error();state.fixed=data.calibration.fixed;state.nominal={V:data.calibration.V,Rc1:data.calibration.Rc1,Rc2:data.calibration.Rc2,curr:data.calibration.currents};const currents=data.calibration.currents;state.nominal.It=Object.values(currents).reduce((sum,value)=>sum+value,0);state.nominal.I2=currents["21"]+currents["22"];state.nominal.V1=state.nominal.V-state.nominal.It*state.nominal.Rc1;state.nominal.V2=state.nominal.V1-state.nominal.I2*state.nominal.Rc2;$("nom-v").value=state.nominal.V;$("rc1").value=state.nominal.Rc1;$("rc2").value=state.nominal.Rc2;ids.forEach(id=>{$(`nom-i${id}`).value=currents[id];$(`fixed-r${id}`).textContent=`${fmt(state.fixed[id],2)} Ω`;$(`system-r-${id}`).value=Number(state.fixed[id]).toFixed(2);$(`target-${id}`).value=data.operation.targets[id];setRheostat(id,data.operation.rheostats[id])});$("fixed-nodes").textContent=`${fmt(state.nominal.V1,2)} / ${fmt(state.nominal.V2,2)} V`;$("live-v").value=data.operation.V;$("reo-max").value=data.operation.rheostatMax||100;$("tolerance").value=data.operation.tolerancePercent||2;localStorage.setItem("anodeflex-fixed",JSON.stringify({fixed:state.fixed,stateNominal:state.nominal}));solve();showMessage("Caso importado y recalculado correctamente.","success")}catch{showMessage("El archivo no corresponde a un caso ANODEFLEX válido.","error")}};
  reader.readAsText(file);
}

function showMessage(text,type){const element=$("message");element.textContent=text;element.className=`message show ${type}`}

function wireEvents(){
  $("calculate-fixed").addEventListener("click",()=>computeFixed());$("confirm-dialog").addEventListener("close",event=>{if(event.target.returnValue==="confirm")computeFixed(true)});$("live-v").addEventListener("input",solve);
  ids.forEach(id=>{$(`reo-${id}`).addEventListener("input",solve);$(`target-${id}`).addEventListener("input",solve);$(`system-r-${id}`).addEventListener("input",solve)});
  $("reset-rheostats").addEventListener("click",()=>{ids.forEach(id=>setRheostat(id,0));solve()});$("assist").addEventListener("click",assistedAdjustment);$("tolerance").addEventListener("input",solve);$("save-case").addEventListener("click",saveCase);$("load-case").addEventListener("click",()=>$("case-file").click());$("case-file").addEventListener("change",event=>{if(event.target.files[0])loadCase(event.target.files[0]);event.target.value=""});$("print-report").addEventListener("click",()=>window.print());
}

function restore(){try{const saved=JSON.parse(localStorage.getItem("anodeflex-fixed"));if(saved?.fixed&&saved?.stateNominal){state.fixed=saved.fixed;state.nominal=saved.stateNominal;ids.forEach(id=>{$(`fixed-r${id}`).textContent=`${fmt(state.fixed[id],2)} Ω`;$(`system-r-${id}`).value=Number(state.fixed[id]).toFixed(2)});$("fixed-nodes").textContent=`${fmt(state.nominal.V1,2)} / ${fmt(state.nominal.V2,2)} V`;solve();return}}catch{}computeFixed(true)}

let installPrompt=null;
window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event;$("install-app").hidden=false});
$("install-app").addEventListener("click",async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("install-app").hidden=true});
buildBranches();wireEvents();restore();
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js"));
