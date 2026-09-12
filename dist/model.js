(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.AnodeflexModel=api})(typeof globalThis!=="undefined"?globalThis:this,function(){
  const IDS=["11","12","21","22"];
  const sum=values=>values.reduce((a,b)=>a+b,0);
  const parallel=values=>1/sum(values.map(value=>1/value));
  function dimension({V,Rc1,Rc2,currents}){
    const values=[V,Rc1,Rc2,...IDS.map(id=>currents[id])];
    if(!values.every(Number.isFinite)||V<=0||Rc1<0||Rc2<0||IDS.some(id=>currents[id]<=0))throw new Error("invalid-input");
    const It=sum(IDS.map(id=>currents[id])),I2=currents["21"]+currents["22"],V1=V-It*Rc1,V2=V1-I2*Rc2;
    if(V1<=0||V2<=0)throw new Error("voltage-exhausted");
    const fixed={11:V1/currents["11"],12:V1/currents["12"],21:V2/currents["21"],22:V2/currents["22"]};
    return {V,Rc1,Rc2,currents:{...currents},It,I2,V1,V2,fixed};
  }
  function simulate({V,Rc1,Rc2,fixed,rheostats}){
    if(!Number.isFinite(V)||V<0)throw new Error("invalid-input");
    const branch=Object.fromEntries(IDS.map(id=>[id,fixed[id]+Math.max(0,rheostats[id]||0)]));
    if(IDS.some(id=>!Number.isFinite(branch[id])||branch[id]<=0))throw new Error("invalid-resistance");
    const rp1=parallel([branch["11"],branch["12"]]),rp2=parallel([branch["21"],branch["22"]]),path2=Rc2+rp2,eqNode1=parallel([branch["11"],branch["12"],path2]),Rt=Rc1+eqNode1;
    const It=V/Rt,V1=V-It*Rc1,I11=V1/branch["11"],I12=V1/branch["12"],I2=V1/path2,V2=V1-I2*Rc2,I21=V2/branch["21"],I22=V2/branch["22"],currents={11:I11,12:I12,21:I21,22:I22};
    const pCable=It*It*Rc1+I2*I2*Rc2,pBranches=sum(IDS.map(id=>currents[id]*currents[id]*branch[id])),pSource=V*It;
    return {V,Rc1,Rc2,rheostats:{...rheostats},branch,rp1,rp2,Rt,It,V1,V2,I2,currents,pCable,pBranches,pSource,pError:pSource-pCable-pBranches};
  }
  function adjust({V,Rc1,Rc2,fixed,targets,maxReo}){
    if(!IDS.every(id=>Number.isFinite(targets[id])&&targets[id]>0)||!Number.isFinite(maxReo)||maxReo<=0)throw new Error("invalid-target");
    const It=sum(IDS.map(id=>targets[id])),I2=targets["21"]+targets["22"],V1=V-It*Rc1,V2=V1-I2*Rc2;
    if(V1<=0||V2<=0)return {feasible:false,reason:"voltage",V1,V2};
    const rheostats=Object.fromEntries(IDS.map(id=>[id,(id[0]==="1"?V1:V2)/targets[id]-fixed[id]])),negative=IDS.filter(id=>rheostats[id]<-1e-8),over=IDS.filter(id=>rheostats[id]>maxReo+1e-8);
    return {feasible:negative.length===0&&over.length===0,V1,V2,rheostats,negative,over};
  }
  return {IDS,dimension,simulate,adjust};
});
