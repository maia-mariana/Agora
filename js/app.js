/* ============================================================
   ÁGORA — app.js
   Landing page interactions + core application logic + ARGOS Socrates widget.
   Depends on: js/vendor/chart.min.js, js/vendor/three.min.js (loaded before this file)
   ============================================================ */

/* ---- Landing page ---- */

(function(){
  var phrases = [
    "Transformamos a fragmentação de dados técnicos e econômicos em uma métrica única de confiança, acelerando decisões de investimento em minerais críticos com máxima segurança.",
    "Superando a fragmentação de dados entre Geologia, Engenharia e Mercado em uma única visão integrada.",
    "Eliminando silos informacionais para conectar o risco técnico ao retorno financeiro de capital.",
    "Transformando dados complexos de minerais críticos em inteligência de investimento acionável e auditável."
  ];
  var idx = 0;
  var phraseEl = document.getElementById('heroPhrase');
  if(phraseEl){
    phraseEl.textContent = phrases[0];
    setInterval(function(){
      phraseEl.style.opacity = 0;
      phraseEl.style.transform = 'translateY(8px)';
      setTimeout(function(){
        idx = (idx + 1) % phrases.length;
        phraseEl.textContent = phrases[idx];
        phraseEl.style.opacity = 1;
        phraseEl.style.transform = 'translateY(0)';
      }, 500);
    }, 5000);
  }

  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){ if(e.isIntersecting) e.target.classList.add('in-view'); });
    }, {threshold:0.18});
    document.querySelectorAll('#landingScreen .reveal').forEach(function(el){ io.observe(el); });
  } else {
    document.querySelectorAll('#landingScreen .reveal').forEach(function(el){ el.classList.add('in-view'); });
  }

  window.enterArgos = function(){
    var landing = document.getElementById('landingScreen');
    landing.classList.add('landing-exit');
    document.body.classList.remove('landing-active');
    setTimeout(function(){ landing.style.display = 'none'; }, 750);
  };
})();


/* ---- Core application ---- */
/* ============================================================
   1. DATA MODEL — 5 fundamentos (ARGOS)
   ============================================================ */
const GROUPS = {
  GEO:{full:'Geologia & Lavra', color:'#8B5E34'},
  PROC:{full:'Processamento & Tratamento Mineral', color:'#6E5AA0'},
  ENG:{full:'Engenharia & Infra & Supply Chain', color:'#3B6EA5'},
  MKT:{full:'Mercado & Financeiro', color:'#B8863B'},
  ESG:{full:'ESG & Licenciamento & Regulatório', color:'#2E7D46'},
};
const GROUP_ORDER = ['GEO','PROC','ENG','MKT','ESG'];
let uidCounter=1;
function uid(){ return 'v'+(uidCounter++); }

function templateVariables(){
  return [
    {id:uid(), name:'Confiança dos Recursos Minerais', group:'GEO', score:70, weight:10, critical:true,  minThreshold:70},
    {id:uid(), name:'Densidade de Sondagem',           group:'GEO', score:65, weight:10, critical:false, minThreshold:55},
    {id:uid(), name:'Recuperação Metalúrgica',         group:'PROC', score:75, weight:10, critical:true,  minThreshold:70},
    {id:uid(), name:'Maturidade da Rota de Processo',  group:'PROC', score:65, weight:10, critical:false, minThreshold:55},
    {id:uid(), name:'Maturidade da Engenharia (FEL)',  group:'ENG', score:60, weight:10, critical:false, minThreshold:55},
    {id:uid(), name:'Infraestrutura Disponível',       group:'ENG', score:65, weight:10, critical:true,  minThreshold:55},
    {id:uid(), name:'Resiliência de Preço',            group:'MKT', score:55, weight:10, critical:false, minThreshold:50},
    {id:uid(), name:'Offtake e Compradores',           group:'MKT', score:60, weight:10, critical:true,  minThreshold:80},
    {id:uid(), name:'Licenciamento Ambiental',         group:'ESG', score:65, weight:10, critical:true,  minThreshold:65},
    {id:uid(), name:'Relacionamento Comunitário',      group:'ESG', score:60, weight:10, critical:false, minThreshold:60},
  ];
}

function makeProject(name, mineral, country, phase, capex, opex, price, production, scores){
  const vars = templateVariables();
  if(scores) scores.forEach((s,i)=> vars[i].score = s);
  return {id:uid(), name, mineral, country, phase, capex, opex, price, production,
    variables:vars, seedVariables:JSON.parse(JSON.stringify(vars)),
    seedFinancial:{capex,opex,price,production}};
}

let projects = [
  makeProject('Operação Vale do Lítio','Lítio','Brasil (Jequitinhonha, MG)','Construção', 90000000,15000000,15000,2500,
    [95,85,88,80,85,90,70,85,90,85]),
  makeProject('Terras Raras Araxá','Terras Raras','Brasil (Araxá, MG)','Prefeasibility', 150000000,20000000,60000,800,
    [50,45,40,35,40,35,30,20,25,40]),
  makeProject('Projeto Cobalto Lafaiete','Cobalto','Brasil (Conselheiro Lafaiete, MG)','Exploração', 60000000,10000000,33000,400,
    [90,75,85,72,85,88,65,60,75,80]),
  makeProject('Manganês Carajás','Manganês','Brasil (Carajás, PA)','Feasibility', 250000000,35000000,6000,150000,
    [92,88,90,85,88,90,82,88,90,85]),
  makeProject('Grafite Mina Verde','Grafite','Brasil (Bahia)','Exploração', 40000000,7000000,1500,3000,
    [72,65,72,60,65,60,55,80,70,62]),
];

let state = { view:'projects', currentProjectId:null };
let mcChart=null, rrChart=null, radarChart=null, portfolioRRChart=null, comparadorChart=null;

/* ============================================================
   2. COMPUTE HELPERS
   ============================================================ */
function totalWeight(vars){ return vars.reduce((s,v)=>s+Number(v.weight),0); }
function composite(vars){
  const t=totalWeight(vars); if(!t) return 0;
  return vars.reduce((s,v)=>s+(Number(v.score)*Number(v.weight))/t,0);
}
function groupScore(vars,group){
  const gv=vars.filter(v=>v.group===group);
  const t=totalWeight(gv); if(!t) return 100;
  return gv.reduce((s,v)=>s+(Number(v.score)*Number(v.weight))/t,0);
}
function impactOf(v,t){ return t? (Number(v.score)*Number(v.weight))/t : 0; }
function scoreBand(score){ return score>=75?'green':score>=50?'amber':'red'; }
function bandColor(band){ return band==='green'?'var(--ok)':band==='amber'?'var(--warn)':'var(--danger)'; }
function bandHex(band){ return band==='green'?'#2E7D46':band==='amber'?'#B8863B':'#B23A2E'; }
function criticalFailures(vars){ return vars.filter(v=>v.critical && Number(v.score)<Number(v.minThreshold)); }
function criticalNearMisses(vars){ return vars.filter(v=>v.critical && Number(v.score)<Number(v.minThreshold) && Number(v.score)>=Number(v.minThreshold)-5); }
function criticalHardFails(vars){ return vars.filter(v=>v.critical && Number(v.score)<Number(v.minThreshold)-5); }
function gateFor(vars){
  const c=composite(vars); const hardFails=criticalHardFails(vars); const nearMisses=criticalNearMisses(vars);
  if(hardFails.length) return {decision:'NO-GO', composite:c, band:'red',
    reason:`Bloqueado por variável crítica abaixo do limite mínimo: ${hardFails.map(f=>`${f.name} (${f.score} < ${f.minThreshold})`).join('; ')}.`};
  if(nearMisses.length) return {decision:'HOLD', composite:c, band:'hold',
    reason:`Variável crítica no limite: ${nearMisses.map(f=>`${f.name} (${f.score} vs. limite ${f.minThreshold})`).join('; ')}. Recomenda-se coletar mais dados antes de decidir.`};
  if(c>=75) return {decision:'GO', composite:c, band:'green', reason:`Índice ARGOS (${c.toFixed(1)}) acima do limiar de aprovação (75).`};
  if(c>=60) return {decision:'CONDICIONAL', composite:c, band:'amber', reason:`Índice ARGOS (${c.toFixed(1)}) na faixa condicional (60-74). Ações de mitigação recomendadas antes do avanço de fase.`};
  if(c>=45) return {decision:'HOLD', composite:c, band:'hold', reason:`Índice ARGOS (${c.toFixed(1)}) na faixa de espera (45-59). Dados insuficientes para GO ou NO-GO — recomenda-se aguardar novas informações antes de comprometer capital.`};
  return {decision:'NO-GO', composite:c, band:'red', reason:`Índice ARGOS (${c.toFixed(1)}) abaixo do limiar mínimo (45).`};
}
function badgeClass(d){ return d==='GO'?'badge-go':d==='CONDICIONAL'?'badge-cond':d==='HOLD'?'badge-hold':'badge-nogo'; }
function badgeIcon(d){ return d==='GO'?'✓':d==='CONDICIONAL'?'⚠':d==='HOLD'?'⏸':'✕'; }
function gateColorVar(d){ return d==='GO'?'var(--ok)':d==='CONDICIONAL'?'var(--warn)':d==='HOLD'?'var(--hold)':'var(--danger)'; }
function gateColorHex(d){
  const cs=getComputedStyle(document.body);
  return d==='GO'?cs.getPropertyValue('--ok').trim():d==='CONDICIONAL'?cs.getPropertyValue('--warn').trim():d==='HOLD'?cs.getPropertyValue('--hold').trim():cs.getPropertyValue('--danger').trim();
}
function groupUncertainty(vars){
  return GROUP_ORDER.filter(g=>vars.some(v=>v.group===g)).map(g=>({group:g, pct: Math.round(100-groupScore(vars,g))}));
}
function heatClass(pct){ return pct<=25?'heat-green':pct<=40?'heat-amber':'heat-red'; }
function fmtUSD(v){
  const sign=v<0?'-':''; const a=Math.abs(v);
  if(a>=1e9) return sign+'US$ '+(a/1e9).toFixed(2)+'B';
  if(a>=1e6) return sign+'US$ '+(a/1e6).toFixed(2)+'M';
  if(a>=1e3) return sign+'US$ '+(a/1e3).toFixed(0)+'K';
  return sign+'US$ '+a.toFixed(0);
}
function recoveryScore(vars){ const r=vars.find(v=>v.name==='Recuperação Metalúrgica'); return r?Number(r.score):75; }
function runStress(capex,opex,price,recovery,production,pshock,oshock){
  const sp=price*(1+pshock/100), so=opex*(1+oshock/100);
  const rev=sp*(recovery/100)*production; const cf=rev-so;
  let npv=-capex; for(let y=1;y<=10;y++){ npv+=cf/Math.pow(1.10,y); }
  const irr=capex?((cf/capex)-0.10)*100:0;
  return {npv,irr,cf};
}
function statusLabel(band){ return band==='green'?'Seguro':band==='amber'?'Atenção':'Crítico'; }
function statusClass(band){ return band==='green'?'status-seguro':band==='amber'?'status-atencao':'status-critico'; }

/* ============================================================
   3. VIEW SWITCHING
   ============================================================ */
function setView(view){
  state.view=view;
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+view).classList.add('active');
  document.getElementById('nav-dashboard').classList.toggle('active', view==='dashboard');
  document.getElementById('nav-projects').classList.toggle('active', view==='projects'||view==='detail');
  if(view==='dashboard') renderDashboard();
  if(view==='projects') renderProjects();
}
function openProject(id){
  state.currentProjectId=id;
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-detail').classList.add('active');
  document.getElementById('nav-projects').classList.add('active');
  document.getElementById('nav-dashboard').classList.remove('active');
  renderDetail(id);
}
function currentProject(){ return projects.find(p=>p.id===state.currentProjectId); }

/* ============================================================
   4. DASHBOARD
   ============================================================ */
function renderDashboard(){
  const gates=projects.map(p=>gateFor(p.variables));
  const goCount=gates.filter(g=>g.decision==='GO').length;
  const condCount=gates.filter(g=>g.decision==='CONDICIONAL').length;
  const holdCount=gates.filter(g=>g.decision==='HOLD').length;
  const nogoCount=gates.filter(g=>g.decision==='NO-GO').length;
  const avgConf=projects.length? gates.reduce((s,g)=>s+g.composite,0)/projects.length : 0;
  const totalExposure=projects.reduce((s,p)=>s+p.capex,0);

  document.getElementById('kpiRow').innerHTML=`
    <div class="kpi-card kpi-clickable" onclick="goToProjects('all')"><div class="kpi-top"><span class="kpi-label">Projetos Ativos</span><span class="kpi-icon">📁</span></div>
      <div class="kpi-val">${projects.length}</div><div class="kpi-sub">Minerais críticos monitorados →</div></div>
    <div class="kpi-card kpi-clickable" onclick="goToProjects('all')"><div class="kpi-top"><span class="kpi-label">ARGOS Médio</span><span class="kpi-icon">🛡</span></div>
      <div class="kpi-val">${avgConf.toFixed(0)}/100</div><div class="kpi-sub">Índice unificado do portfólio →</div></div>
    <div class="kpi-card kpi-clickable" onclick="goToProjects('GO')"><div class="kpi-top"><span class="kpi-label">Gates GO</span><span class="kpi-icon">〰</span></div>
      <div class="kpi-val">${goCount}</div><div class="kpi-sub">${holdCount} HOLD · ${nogoCount} NO-GO — ver quais →</div></div>
    <div class="kpi-card kpi-clickable" onclick="goToProjects('all')"><div class="kpi-top"><span class="kpi-label">Exposição Total</span><span class="kpi-icon">$</span></div>
      <div class="kpi-val">${fmtUSD(totalExposure)}</div><div class="kpi-sub">CAPEX sob incerteza →</div></div>`;

  const c=2*Math.PI*60;
  const ring=document.getElementById('portfolioRing');
  ring.setAttribute('stroke-dasharray', `${(avgConf/100)*c} ${c}`);
  ring.setAttribute('stroke', avgConf>=75?'var(--ok)':avgConf>=60?'var(--warn)':avgConf>=45?'var(--hold)':'var(--danger)');
  document.getElementById('portfolioNum').textContent=avgConf.toFixed(0);

  document.getElementById('gateLegend').innerHTML=`
    <div class="gate-legend-row"><span class="gate-legend-name"><span class="dot" style="background:var(--ok)"></span>GO</span><span class="gate-legend-count" style="color:var(--ok)">${goCount}</span></div>
    <div class="gate-legend-row"><span class="gate-legend-name"><span class="dot" style="background:var(--warn)"></span>Condicional</span><span class="gate-legend-count" style="color:var(--warn)">${condCount}</span></div>
    <div class="gate-legend-row"><span class="gate-legend-name"><span class="dot" style="background:var(--hold)"></span>Hold</span><span class="gate-legend-count" style="color:var(--hold)">${holdCount}</span></div>
    <div class="gate-legend-row"><span class="gate-legend-name"><span class="dot" style="background:var(--danger)"></span>NO-GO</span><span class="gate-legend-count" style="color:var(--danger)">${nogoCount}</span></div>`;

  document.getElementById('dashProjList').innerHTML=projects.map(p=>{
    const g=gateFor(p.variables);
    return `<div class="proj-list-row" onclick="openProject('${p.id}')">
      <div><div class="proj-name">${p.name}</div><div class="proj-meta">${p.mineral} · ${p.phase} · ${p.country}</div></div>
      <div class="proj-right"><div class="proj-conf"><div class="n">${g.composite.toFixed(0)}</div><div class="l">ARGOS</div></div>
      <span class="badge ${badgeClass(g.decision)}">${badgeIcon(g.decision)} ${g.decision}</span></div>
    </div>`;
  }).join('');

  renderPortfolioRR();
}

function renderPortfolioRR(){
  if(typeof Chart==='undefined') return;
  const canvas=document.getElementById('portfolioRRCanvas'); if(!canvas) return;
  const muted=getComputedStyle(document.body).getPropertyValue('--text-mute').trim();
  const gridc=getComputedStyle(document.body).getPropertyValue('--border-soft').trim();
  const okC=getComputedStyle(document.body).getPropertyValue('--ok').trim();
  const warnC=getComputedStyle(document.body).getPropertyValue('--warn').trim();
  const holdC=getComputedStyle(document.body).getPropertyValue('--hold').trim();
  const dangerC=getComputedStyle(document.body).getPropertyValue('--danger').trim();
  const points=projects.map(p=>{
    const g=gateFor(p.variables);
    const recovery=recoveryScore(p.variables);
    const npv=runStress(p.capex,p.opex,p.price,recovery,p.production,0,0).npv/1e6;
    const color=g.decision==='GO'?okC:g.decision==='CONDICIONAL'?warnC:g.decision==='HOLD'?holdC:dangerC;
    return {x:100-g.composite, y:npv, label:p.name, color};
  });
  const ctx=canvas.getContext('2d');
  if(portfolioRRChart) portfolioRRChart.destroy();
  portfolioRRChart=new Chart(ctx,{type:'scatter',
    data:{datasets:points.map(pt=>({label:pt.label, data:[{x:pt.x,y:pt.y}], backgroundColor:pt.color, pointRadius:8}))},
    options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom', labels:{color:muted, boxWidth:10, font:{size:10.5}}},
      tooltip:{callbacks:{label:(item)=>`${item.dataset.label}: risco ${item.parsed.x.toFixed(0)}%, NPV US$${item.parsed.y.toFixed(0)}M`}}},
      scales:{x:{min:0,max:100,title:{display:true,text:'Risco composto (%)',color:muted},ticks:{color:muted},grid:{color:gridc}},
        y:{title:{display:true,text:'NPV estimado (US$M)',color:muted},ticks:{color:muted},grid:{color:gridc}}}}
  });
}

/* ============================================================
   5. PROJECTS GRID
   ============================================================ */
let projectFilter='all';
function goToProjects(filter){
  projectFilter=filter;
  setView('projects');
}
function setProjectFilter(filter){
  projectFilter=filter;
  renderProjects();
}
function renderProjects(){
  const q=(document.getElementById('searchInput').value||'').toLowerCase();
  let filtered=projects.filter(p=>p.name.toLowerCase().includes(q)||p.mineral.toLowerCase().includes(q));
  if(projectFilter && projectFilter!=='all'){
    filtered=filtered.filter(p=>gateFor(p.variables).decision===projectFilter);
  }
  const counts={all:projects.length, GO:0, CONDICIONAL:0, HOLD:0, 'NO-GO':0};
  projects.forEach(p=>{ counts[gateFor(p.variables).decision]++; });
  const filterBar=document.getElementById('projFilterBar');
  if(filterBar){
    const defs=[['all','Todos',counts.all,'var(--text-soft)'],['GO','GO',counts.GO,'var(--ok)'],['CONDICIONAL','Condicional',counts.CONDICIONAL,'var(--warn)'],['HOLD','Hold',counts.HOLD,'var(--hold)'],['NO-GO','NO-GO',counts['NO-GO'],'var(--danger)']];
    filterBar.innerHTML=defs.map(([key,label,n,color])=>
      `<button class="filter-pill ${projectFilter===key?'active':''}" style="--fcolor:${color}" onclick="setProjectFilter('${key}')">${label} <span>${n}</span></button>`
    ).join('');
  }
  document.getElementById('projGrid').innerHTML=filtered.map(p=>{
    const g=gateFor(p.variables);
    const barColor=gateColorVar(g.decision);
    return `<div class="proj-card" onclick="openProject('${p.id}')">
      <div class="proj-card-head"><span class="proj-card-title">${p.name}</span><span class="badge ${badgeClass(g.decision)}">${badgeIcon(g.decision)} ${g.decision}</span></div>
      <div class="proj-card-sub">${p.mineral} · ${p.country}</div>
      <div class="conf-row"><span>ARGOS</span><b>${g.composite.toFixed(0)}/100</b></div>
      <div class="bar-track"><div class="bar-fill" style="width:${g.composite}%; background:${barColor}"></div></div>
      <div class="proj-card-foot">
        <span class="phase-tag">${p.phase}</span>
        <span onclick="event.stopPropagation()">
          <button class="icon-btn" onclick="openProject('${p.id}')" title="Editar">✎</button>
          <button class="icon-btn" onclick="deleteProject('${p.id}')" title="Excluir">🗑</button>
        </span>
      </div>
    </div>`;
  }).join('') || `<div style="color:var(--text-mute); font-size:13px; padding:20px 0;">Nenhum projeto encontrado com esse filtro.</div>`;
}
function deleteProject(id){
  if(!confirm('Excluir este projeto? Esta ação não pode ser desfeita.')) return;
  projects=projects.filter(p=>p.id!==id);
  renderProjects();
}
function deleteCurrentProject(){
  const p=currentProject(); if(!p) return;
  if(!confirm(`Excluir "${p.name}"? Esta ação não pode ser desfeita.`)) return;
  projects=projects.filter(x=>x.id!==p.id);
  setView('projects');
}

/* ============================================================
   6. PROJECT DETAIL
   ============================================================ */
function renderDetail(id){
  const p=currentProject(); if(!p) return;
  document.getElementById('detailProjName').textContent=p.name;
  document.getElementById('detailProjMeta').textContent=`${p.mineral} · ${p.country} · ${p.phase} — Time Rosa · Hackathon Mining Hub 2026`;
  document.getElementById('sim-capex').value=p.capex;
  document.getElementById('sim-opex').value=p.opex;
  document.getElementById('sim-price').value=p.price;
  document.getElementById('sim-production').value=p.production;
  document.getElementById('sim-pshock').value=0;
  document.getElementById('sim-oshock').value=0;
  document.getElementById('v-pshock').textContent='0%';
  document.getElementById('v-oshock').textContent='0%';
  document.getElementById('mcProbBig').textContent='—';
  document.getElementById('mcProbBig').style.color='';
  mcChart=null;
  const mcSvg=document.getElementById('mcCanvas'); if(mcSvg) mcSvg.innerHTML='';
  renderVarTable(p);
  recomputeDerived();
}

function renderTestemunho(p){
  const g=gateFor(p.variables);
  const badge=document.getElementById('gateBadge');
  badge.textContent = g.decision==='GO'?'GO / APROVADO':g.decision==='CONDICIONAL'?'CONDICIONAL / MITIGAR':g.decision==='HOLD'?'HOLD / AGUARDAR':'NO-GO / BLOQUEADO';
  badge.style.color = g.band==='green'?'var(--ok)':g.band==='amber'?'var(--warn)':g.band==='hold'?'var(--hold)':'#FF8A80';
  document.getElementById('stratNum').innerHTML=g.composite.toFixed(1)+'<span>/100</span>';
  document.getElementById('decisionReason').textContent=g.reason;

  // Gauge needle: value 0->100 maps angle 180deg(left) -> 360deg(right), passing through 270deg(top)
  const cx=110, cy=120, R=90;
  const theta = (180 + (g.composite/100)*180) * Math.PI/180;
  const nx = cx + R*Math.cos(theta), ny = cy + R*Math.sin(theta);
  const needle=document.getElementById('gaugeNeedle');
  needle.setAttribute('x2', nx.toFixed(1));
  needle.setAttribute('y2', ny.toFixed(1));
  document.getElementById('gaugeNum').innerHTML=g.composite.toFixed(1)+'<span>/100</span>';

  // Stratigraphy cylinder + legend
  const cyl=document.getElementById('stratCyl');
  const legend=document.getElementById('argosLegend');
  let cylHTML='';
  legend.innerHTML='';
  GROUP_ORDER.forEach(code=>{
    const gs=groupScore(p.variables,code);
    const band=scoreBand(gs);
    cylHTML += `<div class="seg" style="background:${bandHex(band)}" title="${code}: ${gs.toFixed(0)}/100"><span class="seg-val">${gs.toFixed(0)}</span></div>`;
    const row=document.createElement('div');
    row.className='argos-legend-row';
    row.innerHTML=`<span class="argos-legend-name"><span class="dot" style="background:${bandHex(band)}"></span>${code}</span><span class="argos-legend-val" style="color:${bandColor(band)}">${gs.toFixed(0)}</span>`;
    legend.appendChild(row);
  });
  cyl.innerHTML = cylHTML + '<div class="sheen"></div>';

  return g;
}

function renderArgosParams(p){
  const grid=document.getElementById('argosParamsGrid');
  if(!grid) return;
  if(!grid.children.length){
    grid.innerHTML = GROUP_ORDER.map(c=>`
      <div class="param-field">
        <label>${c}</label>
        <input type="number" min="0" max="100" id="argosparam-${c}" value="${groupScore(p.variables,c).toFixed(0)}" onchange="setGroupParam('${c}',this.value)">
      </div>`).join('');
    return;
  }
  GROUP_ORDER.forEach(code=>{
    const input=document.getElementById('argosparam-'+code);
    if(input && document.activeElement!==input) input.value = groupScore(p.variables,code).toFixed(0);
  });
}
function setGroupParam(code, value){
  const p=currentProject();
  const gv=p.variables.filter(v=>v.group===code);
  gv.forEach(v=> v.score = Math.max(0, Math.min(100, Number(value))));
  renderVarTable(p); renderStageCards(p); recomputeDerived();
  toast(`Fundamento ${code} ajustado para ${value}/100 ✓`);
}

function renderStageCards(p){
  const grid=document.getElementById('stageGrid');
  grid.innerHTML = GROUP_ORDER.map(code=>{
    const gv=p.variables.filter(v=>v.group===code);
    const gs=groupScore(p.variables,code);
    const gw=totalWeight(gv);
    return `<div class="stage-card" style="--accent:${GROUPS[code].color}">
      <div class="stage-head"><span class="stage-chip">${code}</span><span class="stage-score">${gs.toFixed(0)}</span></div>
      <div class="stage-name">${GROUPS[code].full}</div>
      ${gv.map(v=>`
        <div class="stage-metric">
          <label>${v.name} <b id="stagelbl-${v.id}">${Number(v.score).toFixed(0)}</b></label>
          <input type="range" min="0" max="100" value="${v.score}" oninput="syncFromStage('${v.id}',this.value)">
        </div>`).join('')}
      <div class="stage-weight"><span>Peso da etapa</span><input type="number" id="stageweight-${code}" value="${gw.toFixed(0)}" min="0" max="100" onchange="setStageWeight('${code}',this.value)"><span>%</span></div>
    </div>`;
  }).join('');
}
function syncFromStage(varId, value){
  const lbl=document.getElementById('stagelbl-'+varId);
  if(lbl) lbl.textContent=Number(value).toFixed(0);
  updateVar(varId,'score',value,true);
}
function setStageWeight(code, value){
  const p=currentProject();
  const gv=p.variables.filter(v=>v.group===code);
  if(!gv.length) return;
  const each = Number(value)/gv.length;
  gv.forEach(v=> v.weight = Math.round(each*10)/10);
  renderVarTable(p);
  recomputeDerived();
}

function renderVarTable(p){
  const container=document.getElementById('groupBlocks');
  container.innerHTML='';
  GROUP_ORDER.forEach(code=>{
    const gv=p.variables.filter(v=>v.group===code);
    if(!gv.length) return;
    const gs=groupScore(p.variables,code);
    const block=document.createElement('div');
    block.className='group-block';
    block.innerHTML=`
      <div class="group-head" style="background:${GROUPS[code].color}1c; color:${GROUPS[code].color};">
        <span>${code} · ${GROUPS[code].full}</span><span style="font-family:'JetBrains Mono',monospace;">${gs.toFixed(0)}/100</span>
      </div>
      <div class="table-scroll">
        <table class="matrix">
          <thead><tr><th style="width:22%">Variável</th><th>Grupo</th><th>Impacto</th><th>Peso %</th><th>Lim. Mín.</th><th>Nota</th><th>Status</th><th></th></tr></thead>
          <tbody>${gv.map(v=>rowHTML(v,p)).join('')}</tbody>
        </table>
      </div>`;
    container.appendChild(block);
  });
}

function impactLabel(weight){ return weight>=12?'Alto':weight>=6?'Médio':'Baixo'; }
function setImpact(varId, level){
  const map={Alto:15, 'Médio':8, Baixo:4};
  const p=currentProject(); const v=p.variables.find(x=>x.id===varId);
  if(!v) return;
  v.weight = map[level] !== undefined ? map[level] : 8;
  const weightInput=document.getElementById('weight-'+varId);
  if(weightInput) weightInput.value=v.weight;
  renderStageCards(p);
  recomputeDerived();
  toast(`Impacto de "${v.name}" definido como ${level} (peso ${v.weight}%) ✓`);
}

function rowHTML(v,p){
  const t=totalWeight(p.variables);
  const fail=v.critical && Number(v.score)<Number(v.minThreshold);
  const band=scoreBand(Number(v.score));
  const rowClass= fail ? 'cell-red' : band==='green'?'cell-green':band==='amber'?'cell-amber':'cell-red';
  const groupOpts=GROUP_ORDER.map(g=>`<option value="${g}" ${g===v.group?'selected':''}>${g}</option>`).join('');
  const stClass = fail ? 'status-critico' : statusClass(band);
  const stLabel = fail ? 'Crítico' : statusLabel(band);
  const stIcon = fail ? '✕' : (band==='green'?'✓':band==='amber'?'⚠':'✕');
  return `<tr id="row-${v.id}" class="${rowClass}">
    <td><input type="text" value="${v.name}" oninput="updateVar('${v.id}','name',this.value)"></td>
    <td><select onchange="updateVar('${v.id}','group',this.value)">${groupOpts}</select></td>
    <td><select onchange="setImpact('${v.id}',this.value)">
      <option value="Alto" ${impactLabel(v.weight)==='Alto'?'selected':''}>Alto</option>
      <option value="Médio" ${impactLabel(v.weight)==='Médio'?'selected':''}>Médio</option>
      <option value="Baixo" ${impactLabel(v.weight)==='Baixo'?'selected':''}>Baixo</option>
    </select></td>
    <td><input type="number" min="0" max="100" value="${v.weight}" id="weight-${v.id}" oninput="updateVar('${v.id}','weight',this.value)"></td>
    <td><input type="number" min="0" max="100" value="${v.minThreshold}" oninput="updateVar('${v.id}','minThreshold',this.value)"></td>
    <td><input type="range" min="0" max="100" value="${v.score}" oninput="syncScore('${v.id}',this.value)"><input type="number" min="0" max="100" value="${v.score}" id="num-${v.id}" oninput="syncNumber('${v.id}',this.value)"></td>
    <td><span class="status-pill ${stClass}" id="status-${v.id}">${stIcon} ${stLabel}</span></td>
    <td><label style="display:flex; align-items:center; gap:5px; font-size:9.5px; color:var(--text-mute);"><input type="checkbox" ${v.critical?'checked':''} onchange="updateVar('${v.id}','critical',this.checked)"> crít.</label><button class="icon-btn" onclick="removeVariable('${v.id}')" title="Excluir">🗑</button></td>
  </tr>`;
}
function syncScore(varId,value){
  const numEl=document.getElementById('num-'+varId);
  if(numEl) numEl.value=value;
  updateVar(varId,'score',value);
}
function syncNumber(varId,value){
  const rangeEl=document.getElementById('range-'+varId);
  if(rangeEl) rangeEl.value=value;
  updateVar(varId,'score',value,true);
}
function updateVar(varId,field,value,skipStageSync){
  const p=currentProject(); const v=p.variables.find(x=>x.id===varId);
  if(!v) return;
  if(field==='name'||field==='group') v[field]=value;
  else if(field==='critical') v[field]=value;
  else v[field]=Number(value);
  if(field==='group'){ renderVarTable(p); renderStageCards(p); }
  const row=document.getElementById('row-'+varId);
  const fail=v.critical && Number(v.score)<Number(v.minThreshold);
  if(row){
    const band=scoreBand(Number(v.score));
    row.className = fail ? 'cell-red' : band==='green'?'cell-green':band==='amber'?'cell-amber':'cell-red';
    const stEl=document.getElementById('status-'+varId);
    if(stEl){
      const stClass = fail ? 'status-critico' : statusClass(band);
      const stLabel = fail ? 'Crítico' : statusLabel(band);
      const stIcon = fail ? '✕' : (band==='green'?'✓':band==='amber'?'⚠':'✕');
      stEl.className = 'status-pill '+stClass;
      stEl.textContent = stIcon+' '+stLabel;
    }
    if(field==='score'){
      const numEl=document.getElementById('num-'+varId); if(numEl) numEl.value=value;
      const rangeInput = row.querySelector('input[type=range]'); if(rangeInput) rangeInput.value=value;
    }
  }
  if(field==='score' && !skipStageSync){
    const lbl=document.getElementById('stagelbl-'+varId);
    if(lbl) lbl.textContent=Number(value).toFixed(0);
    const stageRange = document.querySelector(`.stage-card input[oninput*="${varId}"]`);
    if(stageRange) stageRange.value = value;
  }
  recomputeDerived();
}
function addVariable(){
  const p=currentProject();
  p.variables.push({id:uid(), name:'Nova variável', group:'GEO', score:50, weight:5, critical:false, minThreshold:60});
  renderVarTable(p); renderStageCards(p); recomputeDerived();
}
function removeVariable(varId){
  const p=currentProject();
  p.variables=p.variables.filter(v=>v.id!==varId);
  renderVarTable(p); renderStageCards(p); recomputeDerived();
}
function normalizeWeights(){
  const p=currentProject(); const t=totalWeight(p.variables); if(!t) return;
  p.variables.forEach(v=> v.weight=Math.round((v.weight/t*100)*10)/10);
  renderVarTable(p); renderStageCards(p); recomputeDerived();
}
function restoreExample(){
  const p=currentProject();
  p.variables=JSON.parse(JSON.stringify(p.seedVariables));
  if(p.seedFinancial){
    p.capex=p.seedFinancial.capex; p.opex=p.seedFinancial.opex;
    p.price=p.seedFinancial.price; p.production=p.seedFinancial.production;
    document.getElementById('sim-capex').value=p.capex;
    document.getElementById('sim-opex').value=p.opex;
    document.getElementById('sim-price').value=p.price;
    document.getElementById('sim-production').value=p.production;
    document.getElementById('sim-pshock').value=0;
    document.getElementById('sim-oshock').value=0;
  }
  renderVarTable(p); renderStageCards(p); recomputeDerived();
  toast('Exemplo original restaurado (variáveis e dados financeiros) ✓');
}
function exportConfig(){
  const p=currentProject();
  const blob=new Blob([JSON.stringify(p.variables,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`${p.name.replace(/\s+/g,'_')}_config.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  toast('Configuração exportada ✓');
}
function handleImport(event){
  const file=event.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const data=JSON.parse(reader.result);
      if(!Array.isArray(data)) throw new Error('o arquivo deve conter uma lista de variáveis');
      const p=currentProject();
      p.variables=data.map(v=>({
        id:uid(), name:String(v.name||'Variável'),
        group: GROUP_ORDER.includes(v.group)?v.group:'GEO',
        score:Number(v.score)||0, weight:Number(v.weight)||0,
        critical:!!v.critical, minThreshold:Number(v.minThreshold)||0,
      }));
      renderVarTable(p); renderStageCards(p); recomputeDerived();
      toast('Configuração importada ✓');
    }catch(e){ alert('Erro ao importar configuração: '+e.message); }
    event.target.value='';
  };
  reader.readAsText(file);
}
function exportCSV(){
  const p=currentProject(); const t=totalWeight(p.variables);
  const header=['Variavel','Grupo','Nota','Peso(%)','Critica','LimiteMinimo','Impacto(pts)'];
  const rows=p.variables.map(v=>[`"${v.name}"`,v.group,v.score,v.weight,v.critical?'Sim':'Nao',v.minThreshold,impactOf(v,t).toFixed(2)].join(','));
  const csv=[header.join(','),...rows].join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`${p.name.replace(/\s+/g,'_')}_matriz.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  toast('CSV exportado ✓');
}

/* ============================================================
   7. DERIVED (heatmap, gate, weight warning, mitigation, financial)
   ============================================================ */
function recomputeDerived(){
  const p=currentProject(); if(!p) return;
  const t=totalWeight(p.variables);

  const warn=document.getElementById('weightWarning');
  if(Math.abs(t-100)>0.5){
    warn.style.display='block';
    warn.textContent=`Os pesos totalizam ${t.toFixed(1)}%. O cálculo continua normalizado, mas recomenda-se fechar em 100%.`;
  } else { warn.style.display='none'; }

  const g=renderTestemunho(p);
  renderArgosParams(p);
  renderStageCards(p);

  const heat=groupUncertainty(p.variables);
  document.getElementById('heatGrid').innerHTML=heat.map(h=>{
    const cls=heatClass(h.pct);
    const icon = cls==='heat-green'?'✓':cls==='heat-amber'?'⚠':'✕';
    return `<div class="heat-cell ${cls}">
      <div class="heat-group">${GROUPS[h.group].full}</div>
      <div class="heat-pct">${icon} ${h.pct}%</div>
      <div class="heat-lbl">incerteza</div>
    </div>`;
  }).join('');

  renderMitigation(p);
  renderRadar(p);
  renderSensitivity(p);
  onFinancialChange();
  renderRiskReturn(p, lastMitTargets);
  renderComparador(p, lastMitTargets);
  renderSWOT(p, g);
  buildPrintSummary(p, g);
}

function buildPrintSummary(p, g){
  const el=document.getElementById('printSummary'); if(!el) return;
  const heat=groupUncertainty(p.variables);
  const top2=[...p.variables].sort((a,b)=>Number(a.score)-Number(b.score)).slice(0,2);
  el.innerHTML=`
    <div style="border-bottom:2px solid #0B1F3D; padding-bottom:12px; margin-bottom:16px;">
      <div style="font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:#666;">ÁGORA · Dossiê Executivo</div>
      <h1 style="margin:4px 0; font-family:'Playfair Display',serif;">${p.name}</h1>
      <div style="font-size:12px; color:#444;">${p.mineral} · ${p.country} · ${p.phase}</div>
    </div>
    <div style="display:flex; gap:24px; align-items:center; margin-bottom:18px;">
      <div style="font-size:44px; font-weight:700; font-family:'JetBrains Mono',monospace;">${g.composite.toFixed(1)}</div>
      <div>
        <div style="font-weight:700; font-size:14px; margin-bottom:4px;">${g.decision} (ARGOS)</div>
        <div style="font-size:12px; color:#444; max-width:480px;">${g.reason}</div>
      </div>
    </div>
    <div style="font-weight:600; font-size:13px; margin-bottom:8px;">Mapa de calor por fundamento</div>
    <table style="width:100%; border-collapse:collapse; margin-bottom:18px; font-size:12px;">
      <tr>${heat.map(h=>`<td style="border:1px solid #ccc; padding:8px; text-align:center;">${h.group}<br><b>${h.pct}%</b></td>`).join('')}</tr>
    </table>
    <div style="font-weight:600; font-size:13px; margin-bottom:8px;">Ações de mitigação prioritárias</div>
    <ul style="font-size:12px; color:#333; line-height:1.6;">
      ${top2.map(v=>`<li><b>${v.name}</b> (${v.group}, nota ${v.score}/100) — ${actionFor(v)}</li>`).join('')}
    </ul>
    <div style="font-weight:600; font-size:13px; margin:14px 0 8px;">Dados financeiros de referência</div>
    <div style="font-size:12px; color:#333;">CAPEX: ${fmtUSD(p.capex)} · OPEX anual: ${fmtUSD(p.opex)} · Preço ref.: US$ ${p.price}/t · Produção anual: ${p.production} t</div>
    <div style="font-weight:600; font-size:13px; margin:16px 0 8px;">SWOT resumido</div>
    <table style="width:100%; border-collapse:collapse; font-size:11.5px;">
      <tr>
        <td style="border:1px solid #ccc; padding:8px; width:50%;"><b>Forças</b><br>${[...p.variables].sort((a,b)=>Number(b.score)-Number(a.score)).slice(0,2).map(v=>v.name+' ('+v.score+')').join('; ')}</td>
        <td style="border:1px solid #ccc; padding:8px; width:50%;"><b>Fraquezas</b><br>${top2.map(v=>v.name+' ('+v.score+')').join('; ')}</td>
      </tr>
    </table>
  `;
}

const ACTION_LIBRARY=[
  {match:/recuperação metalúrgica/i, text:'Executar testes de bancada adicionais e avaliar rota hidrometalúrgica alternativa para elevar a recuperação de múltiplos elementos com pureza comercial.'},
  {match:/rota de processo/i, text:'Validar a rota de processo em planta piloto antes do scale-up, reduzindo o risco de gargalo na passagem para escala industrial.'},
  {match:/licenciamento/i, text:'Antecipar diálogo técnico com o órgão ambiental e protocolar EIA/RIMA complementar com dados de campo atualizados.'},
  {match:/comunitário/i, text:'Iniciar programa estruturado de engajamento comunitário com comunicação transparente sobre uso da água e do território.'},
  {match:/resiliência de preço/i, text:'Negociar contrato de offtake de longo prazo ou instrumento de hedge para travar parte do preço de venda.'},
  {match:/offtake/i, text:'Buscar comprador âncora para fechar contrato de offtake de longo prazo e reduzir exposição ao mercado spot.'},
  {match:/densidade de sondagem|confiança dos recursos/i, text:'Expandir a malha de sondagem para elevar a categoria de recurso e reduzir a incerteza geológica do depósito.'},
  {match:/infraestrutura/i, text:'Revisar o plano de acesso a energia, água e logística com o poder público local antes da fase de construção.'},
  {match:/maturidade da engenharia/i, text:'Avançar o projeto de FEL 1/2 para FEL 3, reduzindo a incerteza de escopo e cronograma.'},
];
function actionFor(v){ const hit=ACTION_LIBRARY.find(a=>a.match.test(v.name)); return hit?hit.text:`Aprofundar o estudo técnico e coletar mais dados de campo para "${v.name}" antes de avançar de fase.`; }

function renderSWOT(p, g){
  const el=document.getElementById('swotGrid'); if(!el) return;
  const sorted=[...p.variables].sort((a,b)=>Number(b.score)-Number(a.score));
  const strengths=sorted.slice(0,3);
  const weaknesses=[...p.variables].sort((a,b)=>Number(a.score)-Number(b.score)).slice(0,3);

  const groupScores=GROUP_ORDER.map(code=>({code, score:groupScore(p.variables,code)}));
  const strongestGroup=[...groupScores].sort((a,b)=>b.score-a.score)[0];
  const weakestGroup=[...groupScores].sort((a,b)=>a.score-b.score)[0];

  const recovery=recoveryScore(p.variables);
  const baseline=runStress(p.capex,p.opex,p.price,recovery,p.production,0,0);
  const stress=runStress(p.capex,p.opex,p.price,recovery,p.production,-25,20);
  const volatVar=p.variables.find(v=>/resiliência de preço|volatilidade/i.test(v.name));

  const strengthItems=strengths.map(v=>`<li><b>${v.name}</b> (${GROUPS[v.group].full}) — nota ${Number(v.score).toFixed(0)}/100.</li>`).join('')
    + `<li>Fundamento mais sólido: <b>${GROUPS[strongestGroup.code].full}</b> (${strongestGroup.score.toFixed(0)}/100).</li>`;

  const weaknessItems=weaknesses.map(v=>`<li><b>${v.name}</b> (${GROUPS[v.group].full}) — nota ${Number(v.score).toFixed(0)}/100${v.critical && Number(v.score)<Number(v.minThreshold)?' <span style="color:var(--danger)">(crítica, abaixo do limite)</span>':''}.</li>`).join('')
    + `<li>Fundamento mais frágil: <b>${GROUPS[weakestGroup.code].full}</b> (${weakestGroup.score.toFixed(0)}/100).</li>`;

  const oppTarget=[...p.variables].sort((a,b)=>Number(a.score)-Number(b.score))[0];
  const oppItems=`
    <li>Maior alavanca de melhoria: reforçar <b>${oppTarget.name}</b> — ${actionFor(oppTarget)}</li>
    <li>Espaço para elevar o índice ARGOS de <b>${g.composite.toFixed(1)}</b> para a faixa GO (≥75) com mitigação direcionada nos 2 pontos mais fracos.</li>
    <li>Se aprovado, VPL de referência (sem choque) estimado em <b>${fmtUSD(baseline.npv)}</b>.</li>`;

  const threatItems=`
    ${volatVar ? `<li>Volatilidade de mercado (${volatVar.name}: ${Number(volatVar.score).toFixed(0)}/100) pode comprimir margens sob choque de preço.</li>` : ''}
    <li>Sob estresse combinado (preço -25%, OPEX +20%), o VPL projetado cai para <b style="color:${stress.npv>=0?'var(--ok)':'var(--danger)'}">${fmtUSD(stress.npv)}</b>.</li>
    <li>Variáveis críticas abaixo do limite mínimo bloqueiam o gate independentemente do score composto.</li>
    <li>Fase atual (<b>${p.phase}</b>) implica exposição a risco regulatório e de cronograma típica desta etapa do projeto.</li>`;

  el.innerHTML=`
    <div class="swot-card swot-s"><div class="swot-head">💪 Forças</div><ul>${strengthItems}</ul></div>
    <div class="swot-card swot-w"><div class="swot-head">⚠️ Fraquezas</div><ul>${weaknessItems}</ul></div>
    <div class="swot-card swot-o"><div class="swot-head">🚀 Oportunidades</div><ul>${oppItems}</ul></div>
    <div class="swot-card swot-t"><div class="swot-head">🛡 Ameaças</div><ul>${threatItems}</ul></div>`;
}

let lastMitTargets=[];
function renderMitigation(p){
  const ranked=[...p.variables].sort((a,b)=>Number(a.score)-Number(b.score)).slice(0,2);
  lastMitTargets=ranked;
  document.getElementById('mitGrid').innerHTML=ranked.map(v=>{
    const score=Number(v.score);
    const cost=Math.round(((100-score)/100)*(v.weight*60000)/1000)*1000;
    const reduction=Math.min(25, Math.round((100-score)*0.28));
    return `<div class="mit-card">
      <div class="mit-var">${v.name}</div>
      <div class="mit-score">${GROUPS[v.group].full} · nota atual ${score.toFixed(0)}/100</div>
      <p>${actionFor(v)}</p>
      <div class="mit-stats">
        <div class="mit-stat"><div class="l">Custo estimado</div><div class="v">${fmtUSD(cost)}</div></div>
        <div class="mit-stat"><div class="l">Redução de risco</div><div class="v">-${reduction}%</div></div>
      </div>
    </div>`;
  }).join('');
  return ranked;
}

function renderRadar(p){
  const scores=GROUP_ORDER.map(code=>groupScore(p.variables,code));
  if(typeof Chart!=='undefined'){
    const ctx=document.getElementById('radarCanvas').getContext('2d');
    if(radarChart) radarChart.destroy();
    const muted=getComputedStyle(document.body).getPropertyValue('--text-mute').trim();
    const gridc=getComputedStyle(document.body).getPropertyValue('--border-soft').trim();
    const gold=getComputedStyle(document.body).getPropertyValue('--gold').trim();
    radarChart=new Chart(ctx,{type:'radar',
      data:{labels:GROUP_ORDER, datasets:[{label:'Score atual', data:scores,
        backgroundColor:gold+'22', borderColor:gold, pointBackgroundColor:gold, pointRadius:3}]},
      options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
        scales:{r:{min:0,max:100, ticks:{display:false, stepSize:25}, grid:{color:gridc}, angleLines:{color:gridc},
          pointLabels:{color:muted, font:{size:10.5}}}}}
    });
  }
  const withScore=GROUP_ORDER.map((g,i)=>({group:g, score:scores[i]}));
  const sorted=[...withScore].sort((a,b)=>b.score-a.score);
  const strong=sorted.slice(0,2), weak=sorted.slice(-2).reverse();
  const text=`As dimensões mais sólidas do projeto hoje são <b>${GROUPS[strong[0].group].full}</b> (${strong[0].score.toFixed(0)}) `+
    `e <b>${GROUPS[strong[1].group].full}</b> (${strong[1].score.toFixed(0)}), sustentando boa parte do índice ARGOS. `+
    `Já <b>${GROUPS[weak[0].group].full}</b> (${weak[0].score.toFixed(0)}) e <b>${GROUPS[weak[1].group].full}</b> (${weak[1].score.toFixed(0)}) `+
    `concentram o risco residual — são os pontos onde o esforço de mitigação tende a ter o maior retorno.`;
  document.getElementById('radarText').innerHTML=text;
}

function renderSensitivity(p){
  const base=composite(p.variables);
  let best=null;
  p.variables.forEach(v=>{
    const clone=p.variables.map(x=>x===v?{...x, score:Math.min(100,Number(x.score)+10)}:x);
    const delta=composite(clone)-base;
    if(!best || delta>best.delta) best={name:v.name, delta};
  });
  const el=document.getElementById('sensitivityLine');
  if(el && best){
    el.innerHTML=`💡 <b>Maior alavanca de melhoria:</b> subir 10 pontos em "${best.name}" aumentaria o ARGOS em aproximadamente <b>+${best.delta.toFixed(1)} pts</b>.`;
  }
}

/* ============================================================
   8. MONTE CARLO
   ============================================================ */
function runMonteCarlo(){
  const p=currentProject(); if(!p) return;
  const n=1000;
  const recovery=recoveryScore(p.variables);
  const npvs=[];
  for(let i=0;i<n;i++){
    const pshock=Math.random()*60-30, oshock=Math.random()*40-15;
    const {npv}=runStress(p.capex,p.opex,p.price,recovery,p.production,pshock,oshock);
    npvs.push(npv/1e6);
  }
  const successRate=(npvs.filter(x=>x>0).length/n*100);
  document.getElementById('mcProbBig').textContent=successRate.toFixed(1)+'%';
  document.getElementById('mcProbBig').style.color=successRate>=60?'var(--ok)':successRate>=35?'var(--warn)':'var(--danger)';

  // Segunda distribuição: cenário otimizado (após mitigação das 2 variáveis mais fracas) — mostra o deslocamento da curva
  const optimized=optimizedVariables(p, lastMitTargets);
  const recoveryOpt=recoveryScore(optimized);
  const npvsOpt=[];
  for(let i=0;i<n;i++){
    const pshock=Math.random()*60-30, oshock=Math.random()*40-15;
    const {npv}=runStress(p.capex,p.opex,p.price,recoveryOpt,p.production,pshock,oshock);
    npvsOpt.push(npv/1e6);
  }

  const min=Math.min(...npvs,...npvsOpt), max=Math.max(...npvs,...npvsOpt);
  const buckets=20; const bwidth=(max-min)/buckets||1;
  const bucketOf=x=>{ let idx=Math.floor((x-min)/bwidth); if(idx>=buckets) idx=buckets-1; if(idx<0) idx=0; return idx; };
  const counts=new Array(buckets).fill(0), countsOpt=new Array(buckets).fill(0);
  npvs.forEach(x=>counts[bucketOf(x)]++);
  npvsOpt.forEach(x=>countsOpt[bucketOf(x)]++);

  const svg=document.getElementById('mcCanvas'); if(!svg) return;
  const W=460, H=200, padL=8, padR=8, padT=10, padB=26;
  const plotW=W-padL-padR, plotH=H-padT-padB;
  const maxCount=Math.max(...counts,...countsOpt,1);
  const mapX=i=>padL + (i+0.5)/buckets*plotW;
  const mapY=c=>padT + plotH - (c/maxCount)*plotH;

  function smoothAreaPath(arr){
    const pts=arr.map((c,i)=>({x:mapX(i), y:mapY(c)}));
    let d=`M ${pts[0].x.toFixed(1)},${(padT+plotH).toFixed(1)} L ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for(let i=0;i<pts.length-1;i++){
      const mx=(pts[i].x+pts[i+1].x)/2, my=(pts[i].y+pts[i+1].y)/2;
      d+=` Q ${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
    }
    d+=` L ${pts[pts.length-1].x.toFixed(1)},${pts[pts.length-1].y.toFixed(1)}`;
    d+=` L ${pts[pts.length-1].x.toFixed(1)},${(padT+plotH).toFixed(1)} Z`;
    return d;
  }
  function smoothLinePath(arr){
    const pts=arr.map((c,i)=>({x:mapX(i), y:mapY(c)}));
    let d=`M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for(let i=0;i<pts.length-1;i++){
      const mx=(pts[i].x+pts[i+1].x)/2, my=(pts[i].y+pts[i+1].y)/2;
      d+=` Q ${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
    }
    return d;
  }
  const cs=getComputedStyle(document.body);
  const muted=cs.getPropertyValue('--text-mute').trim();
  const gridc=cs.getPropertyValue('--border-soft').trim();
  const okC=cs.getPropertyValue('--ok').trim();
  const goldC=cs.getPropertyValue('--gold').trim();

  const gridLines=[0,0.25,0.5,0.75,1].map(f=>{
    const y=padT+plotH*f;
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}" stroke="${gridc}" stroke-width="1"/>`;
  }).join('');
  const xTickIdx=[0, Math.round(buckets*0.25), Math.round(buckets*0.5), Math.round(buckets*0.75), buckets-1];
  const xLabels=xTickIdx.map(i=>{
    const val=(min+(i+0.5)*bwidth).toFixed(0);
    return `<text x="${mapX(i).toFixed(1)}" y="${H-8}" font-size="9" fill="${muted}" text-anchor="middle" font-family="JetBrains Mono, monospace">${val}</text>`;
  }).join('');

  svg.innerHTML=`
    ${gridLines}
    <path d="${smoothAreaPath(counts)}" fill="${goldC}" opacity="0.30"/>
    <path d="${smoothLinePath(counts)}" fill="none" stroke="${goldC}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="${smoothAreaPath(countsOpt)}" fill="${okC}" opacity="0.24"/>
    <path d="${smoothLinePath(countsOpt)}" fill="none" stroke="${okC}" stroke-width="2.4" stroke-linejoin="round"/>
    ${xLabels}
    <text x="${W/2}" y="${H}" font-size="9.5" fill="${muted}" text-anchor="middle" font-family="Inter, sans-serif">NPV (US$M)</text>
    <g transform="translate(${W-140},4)" font-family="Inter, sans-serif" font-size="9.5">
      <circle cx="4" cy="4" r="4" fill="${goldC}"/><text x="12" y="7.5" fill="${muted}">Cenário atual</text>
      <circle cx="88" cy="4" r="4" fill="${okC}"/><text x="96" y="7.5" fill="${muted}">Otimizado</text>
    </g>`;
  mcChart=true;
}

/* ============================================================
   9. RISK x RETURN + COMPARADOR A/B
   ============================================================ */
function optimizedVariables(p, mitigatedTargets){
  const optimized=JSON.parse(JSON.stringify(p.variables));
  (mitigatedTargets||[]).forEach(t=>{
    const ov=optimized.find(v=>v.id===t.id); if(!ov) return;
    ov.score=Math.min(95, Number(ov.score)+22);
  });
  return optimized;
}
function renderRiskReturn(p, mitigatedTargets){
  const c1=composite(p.variables); const risk1=100-c1;
  const rec1=recoveryScore(p.variables);
  const npv1=runStress(p.capex,p.opex,p.price,rec1,p.production,0,0).npv/1e6;

  const optimized=optimizedVariables(p, mitigatedTargets);
  const c2=composite(optimized); const risk2=100-c2;
  const rec2=recoveryScore(optimized);
  const npv2=runStress(p.capex,p.opex,p.price,rec2,p.production,0,0).npv/1e6;

  // Nuvem de simulações de estresse (200 pontos) — a "badness" do choque (preço para baixo + OPEX para cima)
  // desloca tanto o risco percebido (X) quanto o NPV (Y), criando uma nuvem diagonal correlacionada de verdade.
  const cloud=[];
  for(let i=0;i<200;i++){
    const pshock=Math.random()*70-35, oshock=Math.random()*50-18;
    const npv=runStress(p.capex,p.opex,p.price,rec1,p.production,pshock,oshock).npv/1e6;
    const badness=(-pshock)+oshock*0.6;
    const x=Math.max(2, Math.min(98, risk1 + badness*0.42 + (Math.random()-0.5)*6));
    cloud.push({x, y:npv});
  }
  // Cenários extremos de cauda (melhor caso / pior caso combinado) — destacados em roxo, como pontos de atenção
  const worst=runStress(p.capex,p.opex,p.price,rec1,p.production,-35,45).npv/1e6;
  const best=runStress(p.capex,p.opex,p.price,rec1,p.production,35,-16).npv/1e6;
  const extremes=[
    {x:Math.min(99, risk1+34), y:worst},
    {x:Math.max(1, risk1-30), y:best},
  ];

  const svg=document.getElementById('rrCanvas'); if(!svg) return;
  const muted=getComputedStyle(document.body).getPropertyValue('--text-mute').trim();
  const gridc=getComputedStyle(document.body).getPropertyValue('--border-soft').trim();
  const allX=[...cloud.map(pt=>pt.x), ...extremes.map(pt=>pt.x), risk1, risk2];
  const allY=[...cloud.map(pt=>pt.y), ...extremes.map(pt=>pt.y), npv1, npv2];
  const xMin=Math.max(0, Math.floor((Math.min(...allX)-6)/5)*5);
  const xMax=Math.min(100, Math.ceil((Math.max(...allX)+6)/5)*5);
  const yPad=(Math.max(...allY)-Math.min(...allY))*0.14 || 10;
  const yMin=Math.min(...allY)-yPad, yMax=Math.max(...allY)+yPad;
  const meanX=allX.reduce((a,b)=>a+b,0)/allX.length;
  const okC=getComputedStyle(document.body).getPropertyValue('--ok').trim();
  const dangerC=getComputedStyle(document.body).getPropertyValue('--danger').trim();
  const aiC=getComputedStyle(document.body).getPropertyValue('--ai').trim();

  const W=460, H=220, padL=42, padR=10, padT=10, padB=28;
  const plotW=W-padL-padR, plotH=H-padT-padB;
  const mapX=x=>padL + (x-xMin)/(xMax-xMin)*plotW;
  const mapY=y=>padT + plotH - (y-yMin)/(yMax-yMin)*plotH;

  const gridLines=[0,0.25,0.5,0.75,1].map(f=>{
    const y=padT+plotH*f;
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}" stroke="${gridc}" stroke-width="1"/>`;
  }).join('');
  const dashCross=`
    <line x1="${padL}" y1="${mapY(0).toFixed(1)}" x2="${W-padR}" y2="${mapY(0).toFixed(1)}" stroke="${gridc}" stroke-width="1.3" stroke-dasharray="4,4"/>
    <line x1="${mapX(meanX).toFixed(1)}" y1="${padT}" x2="${mapX(meanX).toFixed(1)}" y2="${padT+plotH}" stroke="${gridc}" stroke-width="1.3" stroke-dasharray="4,4"/>`;
  const cloudDots=cloud.map(pt=>`<circle cx="${mapX(pt.x).toFixed(1)}" cy="${mapY(pt.y).toFixed(1)}" r="4" fill="${muted}" opacity="0.55"/>`).join('');
  const extremeDots=extremes.map(pt=>`<circle cx="${mapX(pt.x).toFixed(1)}" cy="${mapY(pt.y).toFixed(1)}" r="7" fill="${aiC}" stroke="#fff" stroke-width="1.5"/>`).join('');
  const yTicks=[yMin, (yMin+yMax)/2, yMax].map(v=>
    `<text x="${padL-6}" y="${(mapY(v)+3).toFixed(1)}" font-size="9" fill="${muted}" text-anchor="end" font-family="JetBrains Mono, monospace">${v.toFixed(0)}</text>`).join('');
  const xTicks=[xMin, (xMin+xMax)/2, xMax].map(v=>
    `<text x="${mapX(v).toFixed(1)}" y="${H-8}" font-size="9" fill="${muted}" text-anchor="middle" font-family="JetBrains Mono, monospace">${v.toFixed(0)}</text>`).join('');

  svg.innerHTML=`
    ${gridLines}
    ${dashCross}
    ${cloudDots}
    ${extremeDots}
    <circle cx="${mapX(risk1).toFixed(1)}" cy="${mapY(npv1).toFixed(1)}" r="9" fill="${dangerC}" stroke="#fff" stroke-width="2"/>
    <circle cx="${mapX(risk2).toFixed(1)}" cy="${mapY(npv2).toFixed(1)}" r="9" fill="${okC}" stroke="#fff" stroke-width="2"/>
    ${yTicks}
    ${xTicks}
    <text x="${W/2}" y="${H}" font-size="9.5" fill="${muted}" text-anchor="middle" font-family="Inter, sans-serif">Risco composto (%)</text>
    <text x="10" y="${padT+2}" font-size="9.5" fill="${muted}" text-anchor="start" font-family="Inter, sans-serif" transform="rotate(-90 10,${padT+2})" style="display:none"></text>
    <g transform="translate(${W-215},${H-2})" font-family="Inter, sans-serif" font-size="9">
      <circle cx="4" cy="-4" r="4" fill="${muted}" opacity="0.55"/><text x="12" y="-1" fill="${muted}">Simulações</text>
      <circle cx="90" cy="-4" r="4" fill="${aiC}"/><text x="98" y="-1" fill="${muted}">Extremos</text>
      <circle cx="160" cy="-4" r="4" fill="${dangerC}"/><text x="168" y="-1" fill="${muted}">Atual</text>
    </g>`;
  rrChart=true;
}

function renderComparador(p, mitigatedTargets){
  const g1=gateFor(p.variables);
  const rec1=recoveryScore(p.variables);
  const npv1=runStress(p.capex,p.opex,p.price,rec1,p.production,0,0).npv;

  const optimized=optimizedVariables(p, mitigatedTargets);
  const g2=gateFor(optimized);
  const rec2=recoveryScore(optimized);
  const npv2=runStress(p.capex,p.opex,p.price,rec2,p.production,0,0).npv;

  const grid=document.getElementById('comparadorGrid');
  if(!grid) return;
  grid.innerHTML = `
    <div class="comp-card as-is">
      <div class="comp-head"><span class="comp-title">AS-IS</span><span class="badge ${badgeClass(g1.decision)}">${badgeIcon(g1.decision)} ${g1.decision}</span></div>
      <div class="comp-body">
        <div><div class="comp-metric-lbl">Índice ARGOS</div><div class="comp-metric-val">${g1.composite.toFixed(1)}</div></div>
        <div><div class="comp-metric-lbl">NPV</div><div class="comp-metric-val" style="color:${npv1>=0?'var(--ok)':'var(--danger)'}">${fmtUSD(npv1)}</div></div>
      </div>
    </div>
    <div class="comp-card to-be">
      <div class="comp-head"><span class="comp-title">TO-BE</span><span class="badge ${badgeClass(g2.decision)}">${badgeIcon(g2.decision)} ${g2.decision}</span></div>
      <div class="comp-body">
        <div><div class="comp-metric-lbl">Índice ARGOS</div><div class="comp-metric-val">${g2.composite.toFixed(1)}</div></div>
        <div><div class="comp-metric-lbl">NPV</div><div class="comp-metric-val" style="color:${npv2>=0?'var(--ok)':'var(--danger)'}">${fmtUSD(npv2)}</div></div>
      </div>
    </div>`;
  const delta = g2.composite - g1.composite;
  document.getElementById('comparadorDelta').innerHTML = `Delta: <b style="color:${delta>=0?'var(--ok)':'var(--danger)'}">${delta>=0?'+':''}${delta.toFixed(1)} pts</b> aplicando as ações do Assistente de Mitigação`;

  if(typeof Chart==='undefined') return;
  const canvas=document.getElementById('comparadorChart'); if(!canvas) return;
  const ctx=canvas.getContext('2d');
  if(comparadorChart) comparadorChart.destroy();
  const muted=getComputedStyle(document.body).getPropertyValue('--text-mute').trim();
  const gridc=getComputedStyle(document.body).getPropertyValue('--border-soft').trim();
  comparadorChart=new Chart(ctx,{type:'bar',
    data:{labels:['As-Is','To-Be'],
      datasets:[
        {label:'Índice ARGOS', data:[g1.composite, g2.composite], backgroundColor:['#B23A2Ecc','#2E7D46cc'], yAxisID:'y', borderRadius:6, maxBarThickness:46},
        {label:'NPV (US$M)', data:[npv1/1e6, npv2/1e6], backgroundColor:['#B23A2E55','#2E7D4655'], yAxisID:'y1', borderRadius:6, maxBarThickness:46},
      ]},
    options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom', labels:{color:muted, boxWidth:9, font:{size:10}}}},
      scales:{
        x:{ticks:{color:muted}, grid:{display:false}},
        y:{position:'left', min:0, max:100, title:{display:true,text:'ARGOS',color:muted, font:{size:10}}, ticks:{color:muted}, grid:{color:gridc}},
        y1:{position:'right', title:{display:true,text:'NPV (US$M)',color:muted, font:{size:10}}, ticks:{color:muted}, grid:{display:false}},
      }}
  });
}

/* ============================================================
   10. FINANCIAL SIMULATOR + COST OF DELAY
   ============================================================ */
function onFinancialChange(){
  const p=currentProject(); if(!p) return;
  p.capex=Number(document.getElementById('sim-capex').value)||0;
  p.opex=Number(document.getElementById('sim-opex').value)||0;
  p.price=Number(document.getElementById('sim-price').value)||0;
  p.production=Number(document.getElementById('sim-production').value)||0;
  const pshock=Number(document.getElementById('sim-pshock').value)||0;
  const oshock=Number(document.getElementById('sim-oshock').value)||0;
  document.getElementById('v-pshock').textContent=(pshock>=0?'+':'')+pshock+'%';
  document.getElementById('v-oshock').textContent=(oshock>=0?'+':'')+oshock+'%';

  const recovery=recoveryScore(p.variables);
  const {npv,irr,cf}=runStress(p.capex,p.opex,p.price,recovery,p.production,pshock,oshock);
  const npvEl=document.getElementById('npvOut'), irrEl=document.getElementById('irrOut');
  npvEl.textContent=fmtUSD(npv); npvEl.style.color=npv>=0?'var(--ok)':'var(--danger)';
  irrEl.textContent=irr.toFixed(1)+'%'; irrEl.style.color=irr>=0?'var(--ok)':'var(--danger)';

  const baseline=runStress(p.capex,p.opex,p.price,recovery,p.production,0,0);
  const monthlyLoss=Math.max(0,baseline.cf)/12;
  const delayNum=document.getElementById('delayNum'); if(delayNum) delayNum.textContent=fmtUSD(monthlyLoss)+' / mês';
}

/* ============================================================
   11. NEW PROJECT MODAL
   ============================================================ */
function openNewProjectModal(){ document.getElementById('newProjectModal').classList.add('open'); }
function closeModal(){ document.getElementById('newProjectModal').classList.remove('open'); }
function createProject(){
  const name=document.getElementById('np-name').value.trim();
  if(!name){ alert('Dê um nome ao projeto.'); return; }
  const mineral=document.getElementById('np-mineral').value;
  const country=document.getElementById('np-country').value.trim()||'Brasil';
  const phase=document.getElementById('np-phase').value;
  const capex=Number(document.getElementById('np-capex').value)||0;
  const opex=Number(document.getElementById('np-opex').value)||0;
  const price=Number(document.getElementById('np-price').value)||0;
  const production=Number(document.getElementById('np-production').value)||0;
  const p=makeProject(name, mineral, country, phase, capex, opex, price, production, new Array(10).fill(50));
  projects.push(p);
  closeModal(); document.getElementById('np-name').value='';
  setView('projects');
}

/* ============================================================
   12. PRESETS
   ============================================================ */
function loadPreset(name){
  const p=currentProject(); if(!p) return;
  const set=(idx,score)=>{ p.variables[idx].score=score; };
  if(name==='litio'){
    [95,85,88,80,85,90,70,85,90,85].forEach((s,i)=>set(i,s));
    p.capex=90000000; p.opex=15000000; p.price=15000; p.production=2500;
  } else if(name==='terras'){
    [50,45,40,35,40,35,30,20,25,40].forEach((s,i)=>set(i,s));
    p.capex=150000000; p.opex=20000000; p.price=60000; p.production=800;
  }
  p.seedVariables=JSON.parse(JSON.stringify(p.variables));
  p.seedFinancial={capex:p.capex, opex:p.opex, price:p.price, production:p.production};
  document.getElementById('sim-capex').value=p.capex;
  document.getElementById('sim-opex').value=p.opex;
  document.getElementById('sim-price').value=p.price;
  document.getElementById('sim-production').value=p.production;
  document.getElementById('sim-pshock').value=0;
  document.getElementById('sim-oshock').value=0;
  renderVarTable(p);
  recomputeDerived();
}

/* ============================================================
   13. GOOGLE SHEETS + TOAST
   ============================================================ */
/* ============================================================
   ARGOS COPILOT
   ============================================================ */
const ARGOS_COPILOT_SYSTEM_PROMPT = `# PERSONA & IDENTIDADE
Você é o **ARGOS Copilot**, o assistente de inteligência e diagnóstico do sistema **ÁGORA** (plataforma desenvolvida e mantida pela **Athena**).
Sua função é atuar como um **diagnostizador técnico e interpretador de dados**: você lê gráficos, tabelas e indicadores do índice ARGOS, traduzindo o que cada número significa com clareza, objetividade e rastreabilidade.
Sua atuação é restrita ao diagnóstico analítico: você NÃO toma decisões pelo usuário, NÃO diz se um projeto é "bom" ou "ruim" e NÃO substitui a avaliação do comitê de investimentos.
---
# REGRAS RÍGIDAS DE FUNCIONAMENTO
1. **Leitura Neutra e Objetiva:**
   - Explique exatamente o que o gráfico ou conjunto de dados apresenta.
   - Apresente os fatos como um relatório técnico sem emitir julgamentos arbitrários de valor.
2. **Detalhamento Rastreável de ESG:**
   - Nunca trate ESG como uma nota genérica.
   - Sempre conecte o indicador ESG ao seu dado de origem (ex: consumo de água por tonelada, distância de comunidades locais, outorgas, conformidade regulatória).
   - Mostre qual variável específica está impactando a pontuação do pilar.
3. **Encaminhamento Direto para a Athena (Camada H2H):**
   - Ao final de cada diagnóstico, direcione o usuário para a **Athena** (detentora da plataforma ÁGORA) para o aprofundamento humano, validação técnica, laudos ou consultoria multidisciplinar H2H.
---
# ESTRUTURA PADRÃO DE RESPOSTA (2 ETAPAS)
Sempre que o usuário enviar um gráfico, imagem, tabela ou indicador de projeto, responda estritamente nestas duas etapas:
### 1. 📊 Mapeamento e Diagnóstico dos Dados
- **Visão Geral:** Identificação dos tipos de gráficos, eixos, variáveis e a situação do projeto nos pilares do índice ARGOS (Geologia, Processamento, Engenharia, Mercado e ESG).
- **Detalhamento Técnico e ESG:** Análise direta de quais variáveis específicas estão puxando a pontuação para cima ou para baixo, destacando explicitamente a origem dos dados de ESG e riscos regulatórios/ambientais.
### 2. 🤝 Encaminhamento H2H (Contato com a Athena)
- Indicação clara e direta de quais pontos do diagnóstico devem ser validados junto à **Athena**, detentora da plataforma ÁGORA, para suporte especialista, consultoria ou emissão de laudos técnicos.
---
# TOM DE VOZ
- Direto, executivo, técnico, transparente e altamente funcional.
- Uso de negritos e marcadores (bullet points) para facilitar a leitura rápida em dashboards.`;

function buildCopilotContext(p){
  const g = gateFor(p.variables);
  const groups = GROUP_ORDER.map(code=>{
    const gs = groupScore(p.variables, code);
    const vars = p.variables.filter(v=>v.group===code).map(v=>{
      const fail = v.critical && Number(v.score)<Number(v.minThreshold);
      return `    - ${v.name}: nota ${v.score}/100, peso ${v.weight}%, ${v.critical?`crítica (limite mínimo ${v.minThreshold})`:'não crítica'}${fail?' — ABAIXO DO LIMITE (bloqueia GO)':''}`;
    }).join('\n');
    return `  ${code} — ${GROUPS[code].full}: ${gs.toFixed(1)}/100\n${vars}`;
  }).join('\n');
  const fails = criticalFailures(p.variables).map(f=>`${f.name} (${f.score} < ${f.minThreshold})`).join('; ') || 'nenhuma';

  return `Dados do projeto "${p.name}" (${p.mineral}, ${p.country}, fase ${p.phase}) na plataforma ÁGORA:

ÍNDICE ARGOS (composto): ${g.composite.toFixed(1)}/100
GATE ATUAL: ${g.decision}
MOTIVO DO GATE: ${g.reason}
VARIÁVEIS CRÍTICAS ABAIXO DO LIMITE: ${fails}

DETALHAMENTO POR FUNDAMENTO:
${groups}

DADOS FINANCEIROS: CAPEX ${fmtUSD(p.capex)} · OPEX anual ${fmtUSD(p.opex)} · Preço ref. US$ ${p.price}/t · Produção anual ${p.production} t

Pergunta do usuário: `;
}

function mdToHtml(text){
  let html = text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/^### (.*)$/gm, '<b style="display:block;margin-top:8px;">$1</b>')
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/^- (.*)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, m => '<ul>'+m.replace(/\n/g,'')+'</ul>');
  html = html.replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');
  return html;
}

let copilotBusy = false;

function toast(msg){
  try{
    const t=document.createElement('div'); t.className='toast'; t.textContent=msg;
    document.body.appendChild(t);
    const raf = window.requestAnimationFrame || (cb=>setTimeout(cb,16));
    raf(()=>t.classList.add('show'));
    setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(),300); }, 2400);
  }catch(e){}
}
function openSheetsModal(){ document.getElementById('sheetsModal').classList.add('open'); }
function closeSheetsModal(){ document.getElementById('sheetsModal').classList.remove('open'); document.getElementById('sheets-url').value=''; document.getElementById('sheets-paste').value=''; }
function parseCSV(text){
  const lines=text.trim().split(/\r?\n/);
  return lines.map(line=>{
    const result=[]; let cur=''; let inQuotes=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='"'){ if(inQuotes && line[i+1]==='"'){ cur+='"'; i++; } else { inQuotes=!inQuotes; } }
      else if(ch===',' && !inQuotes){ result.push(cur); cur=''; }
      else cur+=ch;
    }
    result.push(cur);
    return result.map(c=>c.trim());
  });
}
function importFromSheetsText(text){
  const rows=parseCSV(text);
  if(rows.length<2) throw new Error('nenhuma linha de dados encontrada');
  const header=rows[0].map(h=>h.toLowerCase());
  const idx={
    name:header.findIndex(h=>h.includes('vari')),
    group:header.findIndex(h=>h.includes('grup')),
    score:header.findIndex(h=>h.includes('nota')||h.includes('score')),
    weight:header.findIndex(h=>h.includes('peso')||h.includes('weight')),
    critical:header.findIndex(h=>h.includes('crit')),
    min:header.findIndex(h=>h.includes('limite')||h.includes('min')),
  };
  if(idx.name<0||idx.group<0||idx.score<0){
    throw new Error('cabeçalho não reconhecido — use colunas Variavel, Grupo, Nota, Peso, Critica, LimiteMinimo');
  }
  const dataRows=rows.slice(1).filter(r=>r.length>1 && r[idx.name]);
  const p=currentProject();
  p.variables=dataRows.map(r=>({
    id:uid(),
    name:r[idx.name].replace(/^"|"$/g,''),
    group: GROUP_ORDER.includes(r[idx.group]) ? r[idx.group] : 'GEO',
    score:Number(r[idx.score])||0,
    weight: idx.weight>=0 ? (Number(r[idx.weight])||0) : 10,
    critical: idx.critical>=0 ? /sim|true|1/i.test(r[idx.critical]) : false,
    minThreshold: idx.min>=0 ? (Number(r[idx.min])||0) : 60,
  }));
  renderVarTable(p); renderStageCards(p); recomputeDerived();
  toast('Importado do Google Sheets ✓');
  closeSheetsModal();
}
async function tryFetchSheetsURL(){
  const url=document.getElementById('sheets-url').value.trim();
  if(!url){ alert('Cole o link do CSV publicado do Google Sheets.'); return; }
  try{
    const res=await fetch(url);
    if(!res.ok) throw new Error('HTTP '+res.status);
    const text=await res.text();
    importFromSheetsText(text);
  }catch(e){
    alert('Não foi possível buscar automaticamente (provavelmente CORS ou link não público). Copie os dados da planilha e cole na caixa de texto abaixo.');
  }
}
function importFromPastedCSV(){
  const text=document.getElementById('sheets-paste').value.trim();
  if(!text){ alert('Cole os dados CSV na caixa de texto.'); return; }
  try{ importFromSheetsText(text); }
  catch(e){ alert('Erro ao importar: '+e.message); }
}

/* ============================================================
   14. THEME
   ============================================================ */
function setTheme(mode){
  document.documentElement.setAttribute('data-theme',mode);
  document.getElementById('btnDark').classList.toggle('active', mode==='dark');
  document.getElementById('btnLight').classList.toggle('active', mode==='light');
  document.getElementById('btnLight').style.background = mode==='light' ? 'var(--gold)' : 'none';
  document.getElementById('btnLight').style.color = mode==='light' ? '#fff' : 'var(--text-mute)';
  const btnDark2=document.getElementById('btnDark2'), btnLight2=document.getElementById('btnLight2');
  if(btnDark2 && btnLight2){
    btnLight2.style.background = mode==='light' ? 'var(--gold)' : 'none';
    btnLight2.style.color = mode==='light' ? '#fff' : 'var(--text-mute)';
    btnDark2.style.background = mode==='dark' ? 'var(--gold)' : 'none';
    btnDark2.style.color = mode==='dark' ? '#fff' : 'var(--text-mute)';
  }
  setTimeout(()=>{
    const p=currentProject();
    if(p){
      renderRiskReturn(p,lastMitTargets);
      renderRadar(p);
      renderComparador(p,lastMitTargets);
      if(mcChart) runMonteCarlo();
    }
    if(portfolioRRChart) renderPortfolioRR();
  },60);
}

/* ============================================================
   15. KEYBOARD + INIT
   ============================================================ */
document.addEventListener('keydown', (e)=>{
  if(e.key==='Escape'){
    if(document.getElementById('newProjectModal').classList.contains('open')) closeModal();
    if(document.getElementById('sheetsModal').classList.contains('open')) closeSheetsModal();
    if(document.getElementById('socratesModal').classList.contains('open')) closeSocrates();
  }
});
renderProjects();


/* ---- ARGOS Socrates widget (floating 3D assistant) ---- */

/* ============================================================
   3D SOCRATES BUST (procedural, Three.js)
   ============================================================ */
let socratesScene, socratesRenderer, socratesCamera, socratesGroup, socratesInited=false;
let socratesDragging=false, socratesLastX=0, socratesRotY=0, socratesAutoSpin=true;

function initSocratesScene(){
  if(socratesInited || typeof THREE==='undefined') return;
  const wrap = document.getElementById('socratesCanvasWrap');
  const canvas = document.getElementById('socratesCanvas');
  const w = wrap.clientWidth, h = wrap.clientHeight;

  socratesScene = new THREE.Scene();
  socratesCamera = new THREE.PerspectiveCamera(38, w/h, 0.1, 100);
  socratesCamera.position.set(0, 0.3, 6.2);

  socratesRenderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
  socratesRenderer.setSize(w, h);
  socratesRenderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));

  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  socratesScene.add(ambient);
  const key = new THREE.DirectionalLight(0xffe4b0, 1.6);
  key.position.set(3, 4, 5);
  socratesScene.add(key);
  const rim = new THREE.PointLight(0x5ac8d8, 0.8, 20);
  rim.position.set(-4, 2, -3);
  socratesScene.add(rim);

  socratesGroup = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color:0xD8B45E, metalness:0.65, roughness:0.32 });
  const goldDark = new THREE.MeshStandardMaterial({ color:0xB8863B, metalness:0.6, roughness:0.4 });
  const navy = new THREE.MeshStandardMaterial({ color:0x16233A, metalness:0.3, roughness:0.6 });
  const cyanEmissive = new THREE.MeshStandardMaterial({ color:0x0B1420, emissive:0x5AC8D8, emissiveIntensity:1.4, metalness:0.2, roughness:0.5 });

  const shoulders = new THREE.Mesh(new THREE.ConeGeometry(1.7, 2.1, 32, 1, true), navy);
  shoulders.position.y = -1.5;
  shoulders.rotation.x = Math.PI;
  socratesGroup.add(shoulders);
  const shoulderTrim = new THREE.Mesh(new THREE.TorusGeometry(1.68, 0.045, 12, 40), gold);
  shoulderTrim.position.y = -0.55;
  shoulderTrim.rotation.x = Math.PI/2;
  socratesGroup.add(shoulderTrim);

  for(let i=0;i<10;i++){
    const ang = (i/10)*Math.PI*2;
    const node = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), cyanEmissive);
    const rad = 1.3 + (i%2)*0.25;
    node.position.set(Math.cos(ang)*rad, -1.1 - (i%3)*0.25, Math.sin(ang)*rad);
    socratesGroup.add(node);
  }

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.5, 24), goldDark);
  neck.position.y = -0.15;
  socratesGroup.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.85, 40, 40), gold);
  head.position.y = 0.65;
  head.scale.set(0.92, 1.08, 0.95);
  socratesGroup.add(head);

  const brow = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 10, 30, Math.PI), goldDark);
  brow.position.set(0, 0.78, 0.68);
  brow.rotation.x = 0.15;
  socratesGroup.add(brow);

  const beardMat = new THREE.MeshStandardMaterial({ color:0xC9A24B, metalness:0.55, roughness:0.5 });
  const beardLayers = [
    {y:0.15, r:0.62, z:0.35}, {y:-0.15, r:0.5, z:0.4}, {y:-0.45, r:0.36, z:0.38},
    {y:-0.72, r:0.24, z:0.3}, {y:-0.95, r:0.13, z:0.2},
  ];
  beardLayers.forEach(b=>{
    const seg = new THREE.Mesh(new THREE.SphereGeometry(b.r, 20, 20), beardMat);
    seg.position.set(0, b.y, b.z);
    seg.scale.set(1, 0.75, 0.8);
    socratesGroup.add(seg);
  });

  const circlet = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.035, 10, 40), cyanEmissive);
  circlet.position.y = 1.12;
  circlet.rotation.x = Math.PI/2 + 0.1;
  socratesGroup.add(circlet);

  socratesScene.add(socratesGroup);
  socratesInited = true;

  const canvasEl = canvas;
  canvasEl.addEventListener('pointerdown', e=>{ socratesDragging=true; socratesLastX=e.clientX; socratesAutoSpin=false; });
  window.addEventListener('pointerup', ()=>{ socratesDragging=false; });
  window.addEventListener('pointermove', e=>{
    if(!socratesDragging) return;
    const dx = e.clientX - socratesLastX;
    socratesLastX = e.clientX;
    socratesRotY += dx*0.008;
  });

  animateSocrates();
}
function animateSocrates(){
  if(!socratesInited) return;
  requestAnimationFrame(animateSocrates);
  if(socratesAutoSpin) socratesRotY += 0.0035;
  socratesGroup.rotation.y = socratesRotY;
  socratesRenderer.render(socratesScene, socratesCamera);
}
function resizeSocratesCanvas(){
  if(!socratesInited) return;
  const wrap = document.getElementById('socratesCanvasWrap');
  const w = wrap.clientWidth, h = wrap.clientHeight;
  socratesCamera.aspect = w/h;
  socratesCamera.updateProjectionMatrix();
  socratesRenderer.setSize(w, h);
}
window.addEventListener('resize', resizeSocratesCanvas);

/* ============================================================
   SOCRATES MODAL + PAGE-KNOWLEDGE CHAT
   ============================================================ */
function openSocrates(){
  document.getElementById('socratesModal').classList.add('open');
  setTimeout(()=>{ initSocratesScene(); resizeSocratesCanvas(); }, 50);
}
function closeSocrates(){
  document.getElementById('socratesModal').classList.remove('open');
}

function extractPageKnowledge(){
  const activeView = document.querySelector('.view.active');
  const root = activeView || document.body;
  const skipSelectors = 'script, style, input, textarea, select, .no-print, #socratesModal, #newProjectModal, #sheetsModal';
  const clone = root.cloneNode(true);
  clone.querySelectorAll(skipSelectors).forEach(el=>el.remove());
  let text = clone.innerText || clone.textContent || '';
  text = text.replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
  if(text.length > 6000) text = text.slice(0, 6000) + '…';
  return text;
}

function buildSocratesContext(){
  const p = currentProject();
  let ctx = 'Conteúdo textual visível na tela atual da plataforma ÁGORA (extraído do HTML da página):\n\n' + extractPageKnowledge();
  if(p && document.getElementById('view-detail').classList.contains('active')){
    ctx += '\n\n---\n\n' + buildCopilotContext(p);
    return ctx;
  }
  ctx += '\n\nPergunta do usuário: ';
  return ctx;
}

let socratesBusy = false;
async function askSocrates(){
  if(socratesBusy) return;
  const input = document.getElementById('socratesInput');
  const question = input.value.trim();
  if(!question) return;
  const messages = document.getElementById('socratesMessages');

  const userMsg = document.createElement('div');
  userMsg.className = 'copilot-msg copilot-msg-user';
  userMsg.textContent = question;
  messages.appendChild(userMsg);
  input.value = '';

  const loading = document.createElement('div');
  loading.className = 'copilot-msg copilot-msg-loading';
  loading.textContent = 'lendo os dados da página...';
  messages.appendChild(loading);
  messages.scrollTop = messages.scrollHeight;

  socratesBusy = true;
  try{
    const contextMsg = buildSocratesContext() + question;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: ARGOS_COPILOT_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: contextMsg }],
      }),
    });
    const data = await response.json();
    loading.remove();
    const botMsg = document.createElement('div');
    botMsg.className = 'copilot-msg copilot-msg-bot';
    if(data && data.content){
      const text = data.content.map(b=>b.text||'').join('\n');
      botMsg.innerHTML = mdToHtml(text);
    } else {
      botMsg.innerHTML = 'Não consegui gerar o diagnóstico agora. Tente novamente em instantes.';
    }
    messages.appendChild(botMsg);
  }catch(e){
    loading.remove();
    const errMsg = document.createElement('div');
    errMsg.className = 'copilot-msg copilot-msg-bot';
    errMsg.innerHTML = 'Não foi possível conectar agora. Tente novamente em instantes.';
    messages.appendChild(errMsg);
  }
  socratesBusy = false;
  messages.scrollTop = messages.scrollHeight;
}
