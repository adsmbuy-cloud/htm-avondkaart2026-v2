(function () {
'use strict';
const D = window.DASH_DATA;
const fmt   = n => (+n).toLocaleString('nl-NL',{minimumFractionDigits:0,maximumFractionDigits:0});
const fmtE  = n => '€ ' + (+n).toLocaleString('nl-NL',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtP  = (n,d=2) => (+n).toLocaleString('nl-NL',{minimumFractionDigits:d,maximumFractionDigits:d})+'%';
const fmtP1 = n => fmtP(n,1);

const CH_META = {
  'Meta See':     { color:'#0081FB', key:'meta-see',   dataKey:'metaSee'   },
  'Meta Think':   { color:'#4267B2', key:'meta-think', dataKey:'metaThink' },
  'TikTok Think': { color:'#EE1D52', key:'tiktok',     dataKey:'tiktok'    },
  'Meta Do':      { color:'#3578E5', key:'meta-do',    dataKey:'metaDo'    },
};

// ── STATE ─────────────────────────────────────────────────
let activeCampaign  = 'avondkaart';
let activeDateRange = 'all';          // 'all' | 'last1' | 'last7' | 'last30'
const activeChannels = { 'meta-see': true, 'meta-think': true, 'tiktok': true, 'meta-do': true };
const chMetric = { see:'imp', think:'imp', tiktok:'imp', do:'imp' };
let gaMetric = 'sessions';

// ── CHARTS ────────────────────────────────────────────────
const CHARTS = {};
function mkChart(id, cfg) {
  if (CHARTS[id]) CHARTS[id].destroy();
  const el = document.getElementById(id);
  if (!el) return null;
  CHARTS[id] = new Chart(el, cfg);
  return CHARTS[id];
}
const LEGEND = { position:'bottom', labels:{ boxWidth:10, padding:12, font:{size:11} } };

// ── DATE HELPERS ──────────────────────────────────────────
function allCampaignDates() {
  const s = new Set();
  ['metaSee','metaThink','tiktok','metaDo'].forEach(k => Object.keys(D[k]).forEach(d => s.add(d)));
  return [...s].sort();
}

function lastCampaignDate() {
  return allCampaignDates().slice(-1)[0];
}

function getDateBounds() {
  const all  = allCampaignDates();
  const last = lastCampaignDate();
  if (activeDateRange === 'all')    return { start: all[0], end: last };
  if (activeDateRange === 'last1')  return { start: last, end: last };
  const lastD = new Date(last);
  if (activeDateRange === 'last7') {
    const s = new Date(lastD); s.setDate(s.getDate() - 6);
    return { start: s.toISOString().slice(0,10), end: last };
  }
  if (activeDateRange === 'last30') {
    const s = new Date(lastD); s.setDate(s.getDate() - 29);
    return { start: s.toISOString().slice(0,10), end: last };
  }
  return { start: all[0], end: last };
}

function filterKeys(dataObj, start, end) {
  return Object.keys(dataObj).filter(d => d >= start && d <= end).sort();
}

function dateRangeLabel() {
  if (activeDateRange === 'all')    return 'Volledige campagne';
  if (activeDateRange === 'last1')  return 'Laatste dag';
  if (activeDateRange === 'last7')  return 'Afgelopen 7 dagen';
  if (activeDateRange === 'last30') return 'Afgelopen 30 dagen';
}

// ── FILTERED PERFORMANCE AGGREGATION ─────────────────────
// Recalculate channel metrics from daily data for current date range + active channels
function getFilteredPerf() {
  const { start, end } = getDateBounds();
  return D.performance
    .filter(p => activeChannels[CH_META[p.channel].key])
    .map(p => {
      const raw   = D[CH_META[p.channel].dataKey];
      const dates = filterKeys(raw, start, end);
      if (activeDateRange === 'all') return p; // use pre-aggregated full totals
      const imp    = dates.reduce((s,d) => s+(raw[d].imp||0), 0);
      const clicks = dates.reduce((s,d) => s+(raw[d].clicks||0), 0);
      const spend  = dates.reduce((s,d) => s+(raw[d].cost||0), 0);
      const reach  = dates.reduce((s,d) => s+(raw[d].reach||0), 0);
      const ctr    = imp > 0 ? clicks/imp*100 : 0;
      const cpm    = imp > 0 ? spend/imp*1000 : 0;
      const cpc    = clicks > 0 ? spend/clicks : 0;
      const freq   = reach > 0 ? imp/reach : 0;
      return { ...p, imp, clicks, spend, reach, ctr, cpm, cpc, freq };
    });
}

// ── TABS ─────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    setTimeout(renderCharts, 50);
  });
});

// ── CAMPAIGN FILTER ───────────────────────────────────────
document.getElementById('campaign-filter').addEventListener('change', function() {
  activeCampaign = this.value;
  updateChannelUI();
  renderAll();
});

// ── DATE RANGE BUTTONS ────────────────────────────────────
document.querySelectorAll('.date-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeDateRange = btn.dataset.range;
    document.querySelectorAll('.date-btn').forEach(b => b.classList.toggle('active', b.dataset.range === activeDateRange));
    renderAll();
  });
});

// ── CHANNEL CHECKBOXES ────────────────────────────────────
function bindChannelCheckboxes() {
  document.querySelectorAll('.channel-check[data-ch]').forEach(lbl => {
    const inp = lbl.querySelector('input');
    if (inp) inp.addEventListener('change', () => {
      activeChannels[lbl.dataset.ch] = inp.checked;
      renderAll();
    });
  });
  const allBtn  = document.getElementById('ch-select-all');
  const noneBtn = document.getElementById('ch-select-none');
  if (allBtn) allBtn.addEventListener('click', () => {
    Object.keys(activeChannels).forEach(k => activeChannels[k] = true);
    document.querySelectorAll('.channel-check[data-ch] input').forEach(i => i.checked = true);
    renderAll();
  });
  if (noneBtn) noneBtn.addEventListener('click', () => {
    Object.keys(activeChannels).forEach(k => activeChannels[k] = false);
    document.querySelectorAll('.channel-check[data-ch] input').forEach(i => i.checked = false);
    renderAll();
  });
}
bindChannelCheckboxes();

function updateChannelUI() {
  // Show/hide channel filter section based on campaign
  const chSection = document.getElementById('channel-filter-section');
  if (chSection) chSection.style.display = activeCampaign === 'dooh' ? 'none' : 'flex';
}

// ── HELPERS ───────────────────────────────────────────────
function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function cumulative(vals) {
  let s = 0; return vals.map(v => (s += v));
}

// ── RENDER ALL ────────────────────────────────────────────
function renderAll() {
  renderKPIs();
  renderOverviewTable();
  renderPacingCards();
  renderCharts();
  renderGaKPIs();
}
function renderCharts() {
  renderFunnelChart();
  renderSpendDonut();
  renderChannelCharts();
  renderDoohCharts();
  renderGa4Charts();
}

// ── KPIs ─────────────────────────────────────────────────
function renderKPIs() {
  if (activeCampaign === 'dooh') {
    const { start, end } = getDateBounds();
    const dates = filterKeys(D.dooh, start, end);
    // For DOOH use same date bounds relative to its own last date
    const doohDates = Object.keys(D.dooh).sort();
    const doohLast  = doohDates.slice(-1)[0];
    let doohFiltered;
    if (activeDateRange === 'all') {
      doohFiltered = doohDates;
    } else {
      const lastD = new Date(doohLast);
      const days = activeDateRange === 'last1' ? 0 : activeDateRange === 'last7' ? 6 : 29;
      const s = new Date(lastD); s.setDate(s.getDate() - days);
      doohFiltered = doohDates.filter(d => d >= s.toISOString().slice(0,10));
    }
    const totImp  = doohFiltered.reduce((s,d) => s+(D.dooh[d].imp||0), 0);
    const totCost = doohFiltered.reduce((s,d) => s+(D.dooh[d].cost||0), 0);
    const cpm = totImp > 0 ? totCost/totImp*1000 : 0;
    set('kpi-imp',      fmt(totImp));
    set('kpi-imp-sub',  'DOOH impressies');
    set('kpi-reach',    '—');
    set('kpi-reach-sub','geen bereik meting');
    set('kpi-clicks',   '—');
    set('kpi-clicks-sub','DOOH · geen click tracking');
    set('kpi-spent',    fmtE(totCost));
    set('kpi-spent-sub','media kosten '+dateRangeLabel().toLowerCase());
    set('kpi-ctr',      '—');
    set('kpi-ctr-sub',  'niet beschikbaar');
    set('kpi-cpm',      fmtE(cpm));
    set('kpi-cpm-sub',  'kosten per 1.000 imp.');
    return;
  }

  const perf = getFilteredPerf();
  if (!perf.length) {
    ['kpi-imp','kpi-reach','kpi-clicks','kpi-spent','kpi-ctr','kpi-cpm'].forEach(id => set(id,'—'));
    return;
  }
  const totImp    = perf.reduce((s,p) => s+p.imp, 0);
  const totReach  = perf.reduce((s,p) => s+p.reach, 0);
  const totClicks = perf.reduce((s,p) => s+p.clicks, 0);
  const totSpend  = perf.reduce((s,p) => s+p.spend, 0);
  const ctr = totImp > 0 ? totClicks/totImp*100 : 0;
  const cpm = totImp > 0 ? totSpend/totImp*1000 : 0;
  const budget = D.pacing
    .filter(p => activeChannels[CH_META[p.channel].key])
    .reduce((s,p) => s+p.budget, 0);

  set('kpi-imp',      totImp >= 1e6 ? (totImp/1e6).toFixed(2).replace('.',',')+' M' : fmt(totImp));
  set('kpi-imp-sub',  perf.length+' kanalen actief');
  set('kpi-reach',    totReach >= 1e6 ? (totReach/1e6).toFixed(2).replace('.',',')+' M' : fmt(totReach));
  set('kpi-reach-sub','unieke personen');
  set('kpi-clicks',   fmt(totClicks));
  set('kpi-clicks-sub','link clicks');
  set('kpi-spent',    fmtE(totSpend));
  set('kpi-spent-sub', activeDateRange === 'all' ? 'van '+fmtE(budget)+' budget' : dateRangeLabel().toLowerCase());
  set('kpi-ctr',      fmtP(ctr));
  set('kpi-ctr-sub',  'gem. click-through rate');
  set('kpi-cpm',      fmtE(cpm));
  set('kpi-cpm-sub',  'kosten per 1.000 imp.');
}

// ── OVERVIEW TABLE ────────────────────────────────────────
function renderOverviewTable() {
  const tbody = document.getElementById('overview-tbody');
  if (!tbody) return;

  if (activeCampaign === 'dooh') {
    tbody.innerHTML = D.doohPublishers.map(p => `
      <tr>
        <td><span class="ch-dot" style="background:${p.color}"></span>${p.name}</td>
        <td><span class="badge b-grey">DOOH</span></td>
        <td class="num">${fmt(p.imp)}</td>
        <td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">—</td>
        <td class="num">${fmtE(p.cost/p.imp*1000)}</td>
        <td class="num">${fmtE(p.cost)}</td>
      </tr>`).join('') +
      `<tr class="total-row">
        <td colspan="2"><strong>Totaal</strong></td>
        <td class="num"><strong>82.297</strong></td>
        <td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">—</td>
        <td class="num"><strong>€ 8,44</strong></td>
        <td class="num"><strong>€ 694,17</strong></td>
      </tr>`;
    return;
  }

  const perf = getFilteredPerf();
  if (!perf.length) { tbody.innerHTML = '<tr><td colspan="9" class="no-data">Geen kanalen geselecteerd</td></tr>'; return; }

  let html = '';
  perf.forEach(p => {
    const badgeCls = p.obj==='See' ? 'b-blue' : p.obj==='Think' ? 'b-orange' : 'b-green';
    html += `<tr>
      <td><span class="ch-dot" style="background:${CH_META[p.channel].color}"></span><strong>${p.channel}</strong></td>
      <td><span class="badge ${badgeCls}">${p.obj}</span></td>
      <td class="num">${fmt(p.imp)}</td>
      <td class="num">${fmt(p.reach)}</td>
      <td class="num">${(+p.freq).toFixed(2)}</td>
      <td class="num">${fmt(p.clicks)}</td>
      <td class="num">${fmtP(p.ctr)}</td>
      <td class="num">${fmtE(p.cpm)}</td>
      <td class="num">${fmtE(p.spend)}</td>
    </tr>`;
  });
  const ti = perf.reduce((s,p)=>s+p.imp,0), tr2 = perf.reduce((s,p)=>s+p.reach,0);
  const tc = perf.reduce((s,p)=>s+p.clicks,0), ts = perf.reduce((s,p)=>s+p.spend,0);
  html += `<tr class="total-row">
    <td colspan="2"><strong>Totaal</strong></td>
    <td class="num"><strong>${fmt(ti)}</strong></td>
    <td class="num"><strong>${fmt(tr2)}</strong></td>
    <td class="num">—</td>
    <td class="num"><strong>${fmt(tc)}</strong></td>
    <td class="num"><strong>${fmtP(ti>0?tc/ti*100:0)}</strong></td>
    <td class="num"><strong>${fmtE(ti>0?ts/ti*1000:0)}</strong></td>
    <td class="num"><strong>${fmtE(ts)}</strong></td>
  </tr>`;
  tbody.innerHTML = html;
}

// ── PACING CARDS ──────────────────────────────────────────
function renderPacingCards() {
  const grid = document.getElementById('pacing-grid');
  if (!grid) return;

  if (activeCampaign === 'dooh') {
    grid.innerHTML = D.doohPublishers.map(p => {
      const cpm = p.cost/p.imp*1000;
      return `<div class="pacing-card">
        <div class="pacing-card-head">
          <div><div class="pacing-ch-name"><span class="ch-dot" style="background:${p.color}"></span>${p.name}</div>
          <div class="pacing-ch-sub">${p.venue}</div></div>
          <span class="badge b-green">Afgerond</span>
        </div>
        <div class="pacing-stats">Impressies: <strong>${fmt(p.imp)}</strong><br>
        Kosten: <strong>${fmtE(p.cost)}</strong> &nbsp;·&nbsp; CPM: <strong>${fmtE(cpm)}</strong></div>
      </div>`;
    }).join('');
    return;
  }

  const { start, end } = getDateBounds();
  const isFiltered = activeDateRange !== 'all';

  grid.innerHTML = D.pacing
    .filter(p => activeChannels[CH_META[p.channel].key])
    .map(p => {
      const raw = D[CH_META[p.channel].dataKey];
      let periodSpend = p.spent;
      if (isFiltered) {
        const dates = filterKeys(raw, start, end);
        periodSpend = dates.reduce((s,d) => s+(raw[d].cost||0), 0);
      }
      const pct = p.budget > 0 ? periodSpend/p.budget*100 : 0;
      const fullPct = p.spentPct;
      let badgeCls = 'b-green', badgeTxt = 'Op schema';
      if (fullPct < 85)      { badgeCls = 'b-red';    badgeTxt = 'Significant achter'; }
      else if (fullPct < 95) { badgeCls = 'b-orange'; badgeTxt = 'Licht achter'; }
      const fillCls = pct > 100 ? 'over' : pct < 50 ? 'warn' : '';
      const barPct  = Math.min(100, pct);
      return `<div class="pacing-card">
        <div class="pacing-card-head">
          <div><div class="pacing-ch-name"><span class="ch-dot" style="background:${p.color}"></span>${p.channel}</div>
          <div class="pacing-ch-sub">${p.platform} · ${p.obj}</div></div>
          <span class="badge ${badgeCls}">${badgeTxt}</span>
        </div>
        <div class="pacing-prog">
          <div class="prog-wrap">
            <div class="prog-bg"><div class="prog-fill ${fillCls}" style="width:${barPct}%"></div></div>
            <span class="prog-txt">${fmtP1(pct)}</span>
          </div>
        </div>
        <div class="pacing-stats">
          ${isFiltered ? 'Periode spend' : 'Besteed'}: <strong>${fmtE(periodSpend)}</strong><br>
          Budget: <strong>${fmtE(p.budget)}</strong> &nbsp;·&nbsp; ${isFiltered ? 'Totaal spend' : 'Resterend'}: <strong>${isFiltered ? fmtE(p.spent) : fmtE(Math.max(0,p.budget-p.spent))}</strong>
        </div>
      </div>`;
    }).join('');

  if (!grid.innerHTML) grid.innerHTML = '<p style="color:var(--muted);font-size:12px;padding:12px">Geen kanalen geselecteerd.</p>';
}

// ── FUNNEL CHART ──────────────────────────────────────────
function renderFunnelChart() {
  const perf = getFilteredPerf();
  const see   = perf.find(p=>p.channel==='Meta See');
  const think = perf.filter(p=>p.obj==='Think');
  const doP   = perf.find(p=>p.channel==='Meta Do');
  mkChart('funnel-chart', {
    type:'bar',
    data:{
      labels:['See (Meta)','Think (Meta + TikTok)','Do (Meta)'],
      datasets:[{ label:'Bereik',
        data:[see?see.reach:0, think.reduce((s,p)=>s+p.reach,0), doP?doP.reach:0],
        backgroundColor:['#0081FBCC','#7B61FFCC','#3578E5CC'], borderRadius:4, borderSkipped:false }]
    },
    options:{
      indexAxis:'y', responsive:true,
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:ctx=>' Bereik: '+fmt(ctx.raw)}} },
      scales:{
        x:{ticks:{font:{size:10},callback:v=>v>=1e6?(v/1e6).toFixed(1)+'M':v>=1e3?(v/1e3).toFixed(0)+'K':v}},
        y:{ticks:{font:{size:11}}}
      }
    }
  });
}

// ── SPEND DONUT ───────────────────────────────────────────
function renderSpendDonut() {
  if (activeCampaign === 'dooh') {
    const pubs = D.doohPublishers;
    mkChart('spend-donut', {
      type:'doughnut',
      data:{labels:pubs.map(p=>p.name),datasets:[{data:pubs.map(p=>p.cost),backgroundColor:pubs.map(p=>p.color),borderWidth:2}]},
      options:{cutout:'65%',plugins:{legend:LEGEND,tooltip:{callbacks:{label:ctx=>' '+ctx.label+': '+fmtE(ctx.raw)}}}}
    });
    return;
  }
  const perf = getFilteredPerf();
  if (!perf.length) return;
  mkChart('spend-donut', {
    type:'doughnut',
    data:{labels:perf.map(p=>p.channel),datasets:[{data:perf.map(p=>p.spend),backgroundColor:perf.map(p=>CH_META[p.channel].color),borderWidth:2}]},
    options:{cutout:'65%',plugins:{legend:LEGEND,tooltip:{callbacks:{label:ctx=>' '+ctx.label+': '+fmtE(ctx.raw)}}}}
  });
  const totSpend = perf.reduce((s,p)=>s+p.spend,0);
  set('spend-donut-sub','Totaal: '+fmtE(totSpend));
}

// ── PER-CHANNEL CHARTS ────────────────────────────────────
const CH_CHART_MAP = {
  see:    {dataKey:'metaSee',   color:'#0081FB', id:'chart-meta-see',   spendId:'chart-meta-see-spend',   cumId:'chart-meta-see-reach',     chKey:'meta-see'},
  think:  {dataKey:'metaThink', color:'#4267B2', id:'chart-meta-think', spendId:'chart-meta-think-spend', cumId:null,                       chKey:'meta-think'},
  tiktok: {dataKey:'tiktok',    color:'#EE1D52', id:'chart-tiktok',     spendId:'chart-tiktok-spend',     cumId:null,                       chKey:'tiktok'},
  do:     {dataKey:'metaDo',    color:'#3578E5', id:'chart-meta-do',    spendId:'chart-meta-do-spend',    cumId:'chart-meta-do-cumclicks',  chKey:'meta-do'},
};
const metricLabels = {imp:'Impressies',reach:'Bereik',clicks:'Clicks',cost:'Spend (€)',sessions:'Sessies',engaged:'Betrokken',atc:'Add-to-cart',checkouts:'Checkouts'};

function renderChannelCharts() {
  const { start, end } = getDateBounds();
  Object.entries(CH_CHART_MAP).forEach(([key, cfg]) => {
    const raw   = D[cfg.dataKey];
    const dates = filterKeys(raw, start, end);
    const metric = chMetric[key];
    const color  = cfg.color;

    mkChart(cfg.id, {
      type:'line',
      data:{
        labels:dates.map(d=>d.slice(5)),
        datasets:[{label:metricLabels[metric],data:dates.map(d=>raw[d]?raw[d][metric]||0:0),
          borderColor:color,backgroundColor:color+'20',borderWidth:2,fill:true,tension:0.3,pointRadius:2}]
      },
      options:{responsive:true,
        scales:{x:{ticks:{maxTicksLimit:15,font:{size:10}}},y:{ticks:{font:{size:10}}}},
        plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>' '+metricLabels[metric]+': '+fmt(ctx.raw)}}}}
    });

    mkChart(cfg.spendId, {
      type:'bar',
      data:{
        labels:dates.map(d=>d.slice(5)),
        datasets:[{label:'Spend (€)',data:dates.map(d=>raw[d]?raw[d].cost||0:0),backgroundColor:color+'CC',borderRadius:3}]
      },
      options:{responsive:true,
        scales:{x:{ticks:{maxTicksLimit:15,font:{size:10}}},y:{ticks:{font:{size:10}}}},
        plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>' €'+ctx.raw.toFixed(2)}}}}
    });

    if (cfg.cumId) {
      const cumKey  = key === 'do' ? 'clicks' : 'reach';
      const cumVals = cumulative(dates.map(d=>raw[d]?raw[d][cumKey]||0:0));
      mkChart(cfg.cumId, {
        type:'line',
        data:{labels:dates.map(d=>d.slice(5)),datasets:[{
          label:key==='do'?'Cumulatieve Clicks':'Cumulatief Bereik',data:cumVals,
          borderColor:color,backgroundColor:color+'20',borderWidth:2,fill:true,tension:0.1,pointRadius:2}]
        },
        options:{responsive:true,
          scales:{x:{ticks:{maxTicksLimit:15,font:{size:10}}},y:{ticks:{font:{size:10},callback:v=>v>=1e6?(v/1e6).toFixed(1)+'M':v>=1e3?(v/1e3).toFixed(0)+'K':v}}},
          plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>' '+fmt(ctx.raw)}}}}
      });
    }
  });

  renderTikTokVV();
  renderChannelKPIs();
}

function renderTikTokVV() {
  const { start, end } = getDateBounds();
  const dates = filterKeys(D.tiktok, start, end);
  mkChart('chart-tiktok-vv', {
    type:'line',
    data:{labels:dates.map(d=>d.slice(5)),datasets:[
      {label:'Video Views',data:dates.map(d=>D.tiktok[d].vv||0),borderColor:'#EE1D52',backgroundColor:'#EE1D5220',borderWidth:2,fill:true,tension:0.3,pointRadius:2},
      {label:'100% Views', data:dates.map(d=>D.tiktok[d].vv100||0),borderColor:'#FF6B8A',backgroundColor:'transparent',borderWidth:1.5,borderDash:[4,3],fill:false,tension:0.3,pointRadius:2}
    ]},
    options:{responsive:true,scales:{x:{ticks:{maxTicksLimit:15,font:{size:10}}},y:{ticks:{font:{size:10}}}},plugins:{legend:LEGEND}}
  });
}

function renderChannelKPIs() {
  const perf = getFilteredPerf();
  const defs = [
    {elId:'kpi-meta-see',   ch:'Meta See'},
    {elId:'kpi-meta-think', ch:'Meta Think'},
    {elId:'kpi-tiktok',     ch:'TikTok Think', vtr:true},
    {elId:'kpi-meta-do',    ch:'Meta Do'},
  ];
  defs.forEach(({elId, ch, vtr}) => {
    const el = document.getElementById(elId);
    if (!el) return;
    const p = perf.find(x=>x.channel===ch) || D.performance.find(x=>x.channel===ch);
    if (!p) return;
    const extraVal = vtr ? fmtP(p.vtr||0,1)+' VTR' : fmt(p.reach)+' bereik';
    el.innerHTML = `
      <div class="kpi-card"><div class="kpi-label">Impressies</div><div class="kpi-val" style="font-size:18px">${fmt(p.imp)}</div><div class="kpi-sub">${extraVal}</div></div>
      <div class="kpi-card orange"><div class="kpi-label">Clicks</div><div class="kpi-val" style="font-size:18px">${fmt(p.clicks)}</div><div class="kpi-sub">CTR: ${fmtP(p.ctr)}</div></div>
      <div class="kpi-card green"><div class="kpi-label">Besteed</div><div class="kpi-val" style="font-size:18px">${fmtE(p.spend)}</div><div class="kpi-sub">CPC: ${fmtE(p.cpc)}</div></div>
      <div class="kpi-card purple"><div class="kpi-label">CPM</div><div class="kpi-val" style="font-size:18px">${fmtE(p.cpm)}</div><div class="kpi-sub">Freq: ${(+p.freq).toFixed(2)}</div></div>`;
  });
}

// ── DOOH CHARTS ───────────────────────────────────────────
function renderDoohCharts() {
  const doohDates = Object.keys(D.dooh).sort();
  const doohLast  = doohDates.slice(-1)[0];
  let dates;
  if (activeDateRange === 'all') {
    dates = doohDates;
  } else {
    const lastD = new Date(doohLast);
    const days  = activeDateRange === 'last1' ? 0 : activeDateRange === 'last7' ? 6 : 29;
    const s = new Date(lastD); s.setDate(s.getDate() - days);
    dates = doohDates.filter(d => d >= s.toISOString().slice(0,10));
  }
  mkChart('chart-dooh-daily', {
    type:'bar',
    data:{labels:dates.map(d=>d.slice(5)),datasets:[{label:'DOOH Impressies',data:dates.map(d=>D.dooh[d].imp||0),backgroundColor:'#9B59B6CC',borderRadius:4}]},
    options:{responsive:true,scales:{x:{ticks:{font:{size:10}}},y:{ticks:{font:{size:10}}}},plugins:{legend:{display:false}}}
  });
  mkChart('chart-dooh-donut', {
    type:'doughnut',
    data:{labels:D.doohPublishers.map(p=>p.name),datasets:[{data:D.doohPublishers.map(p=>p.imp),backgroundColor:D.doohPublishers.map(p=>p.color),borderWidth:2}]},
    options:{cutout:'65%',plugins:{legend:LEGEND,tooltip:{callbacks:{label:ctx=>' '+ctx.label+': '+fmt(ctx.raw)+' imp'}}}}
  });
}

// ── GA4 CHARTS ────────────────────────────────────────────
window.setGaMetric = function(m) {
  gaMetric = m;
  ['sessions','engaged','atc','checkouts'].forEach(x => {
    const btn = document.getElementById('ga-m-'+x);
    if (btn) btn.classList.toggle('active', x===m);
  });
  renderGa4Charts();
};

function renderGa4Charts() {
  const ga4Dates = Object.keys(D.ga).sort();
  const ga4Last  = ga4Dates.slice(-1)[0];
  let dates;
  if (activeDateRange === 'all') {
    dates = ga4Dates;
  } else {
    const lastD = new Date(ga4Last);
    const days  = activeDateRange === 'last1' ? 0 : activeDateRange === 'last7' ? 6 : 29;
    const s = new Date(lastD); s.setDate(s.getDate() - days);
    dates = ga4Dates.filter(d => d >= s.toISOString().slice(0,10));
  }
  const colors = {sessions:'#3182ce',engaged:'#38b2ac',atc:'#ed8936',checkouts:'#48bb78'};
  const col = colors[gaMetric];
  mkChart('chart-ga4', {
    type:'line',
    data:{labels:dates.map(d=>d.slice(5)),datasets:[{
      label:metricLabels[gaMetric],data:dates.map(d=>D.ga[d]?D.ga[d][gaMetric]||0:0),
      borderColor:col,backgroundColor:col+'20',borderWidth:2,fill:true,tension:0.3,pointRadius:2}]
    },
    options:{responsive:true,scales:{x:{ticks:{maxTicksLimit:15,font:{size:10}}},y:{ticks:{font:{size:10}}}},plugins:{legend:{display:false}}}
  });
  const vals  = dates.map(d=>D.ga[d]).filter(Boolean);
  const totS  = vals.reduce((s,v)=>s+(v.sessions||0),0);
  const totE  = vals.reduce((s,v)=>s+(v.engaged||0),0);
  const totA  = vals.reduce((s,v)=>s+(v.atc||0),0);
  const totC  = vals.reduce((s,v)=>s+(v.checkouts||0),0);
  mkChart('chart-ga4-funnel', {
    type:'bar',
    data:{labels:['Sessies','Betrokken','Add-to-cart','Checkouts'],datasets:[{data:[totS,totE,totA,totC],backgroundColor:['#3182ceCC','#38b2acCC','#ed8936CC','#48bb78CC'],borderRadius:4}]},
    options:{responsive:true,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>' '+fmt(ctx.raw)}}},scales:{x:{ticks:{font:{size:11}}},y:{ticks:{font:{size:10},callback:v=>v>=1e3?(v/1e3).toFixed(0)+'K':v}}}}
  });
  const rateData = dates.map(d=>{const r=D.ga[d];return r&&r.sessions?+(r.checkouts/r.sessions*100).toFixed(2):0;});
  mkChart('chart-ga4-rate', {
    type:'line',
    data:{labels:dates.map(d=>d.slice(5)),datasets:[{label:'Checkout Rate %',data:rateData,borderColor:'#48bb78',backgroundColor:'#48bb7820',borderWidth:2,fill:true,tension:0.3,pointRadius:2}]},
    options:{responsive:true,scales:{x:{ticks:{maxTicksLimit:15,font:{size:10}}},y:{ticks:{font:{size:10},callback:v=>v+'%'}}},plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>' '+ctx.raw+'%'}}}}
  });
}

function renderGaKPIs() {
  const ga4Dates = Object.keys(D.ga).sort();
  const ga4Last  = ga4Dates.slice(-1)[0];
  let dates;
  if (activeDateRange === 'all') {
    dates = ga4Dates;
  } else {
    const lastD = new Date(ga4Last);
    const days  = activeDateRange === 'last1' ? 0 : activeDateRange === 'last7' ? 6 : 29;
    const s = new Date(lastD); s.setDate(s.getDate() - days);
    dates = ga4Dates.filter(d => d >= s.toISOString().slice(0,10));
  }
  const vals = dates.map(d=>D.ga[d]).filter(Boolean);
  set('ga-sessions',  fmt(vals.reduce((s,v)=>s+(v.sessions||0),0)));
  set('ga-engaged',   fmt(vals.reduce((s,v)=>s+(v.engaged||0),0)));
  set('ga-atc',       fmt(vals.reduce((s,v)=>s+(v.atc||0),0)));
  set('ga-checkouts', fmt(vals.reduce((s,v)=>s+(v.checkouts||0),0)));
}

// ── GLOBAL METRIC TOGGLES ─────────────────────────────────
window.setChMetric = function(ch, metric) {
  chMetric[ch] = metric;
  const prefixMap = {see:'ms',think:'mt',tiktok:'tt',do:'md'};
  const prefix = prefixMap[ch];
  ['imp','reach','clicks','cost'].forEach(m => {
    const btn = document.getElementById(prefix+'-m-'+m);
    if (btn) btn.classList.toggle('active', m===metric);
  });
  renderChannelCharts();
};

// ── AD CREATIVES ─────────────────────────────────────────
const adMetric = { see:'imp', think:'imp', tiktok:'imp', do:'clicks' };

const AD_COLORS = {
  see:    ['#0081FB','#3399FF','#66B3FF','#99CCFF'],
  think:  ['#4267B2','#6B8FD4','#94B7F5'],
  tiktok: ['#EE1D52','#F5547A','#F98FA8'],
  do:     ['#3578E5','#5A95EE','#84B2F5'],
};

function renderAdCreatives() {
  const configs = [
    { ch:'see',    key:'meta-see',    chartId:'chart-ads-see',    tableId:'ads-see-table',    tagsId:'ads-see-tags'    },
    { ch:'think',  key:'meta-think',  chartId:'chart-ads-think',  tableId:'ads-think-table',  tagsId:'ads-think-tags'  },
    { ch:'tiktok', key:'tiktok',      chartId:'chart-ads-tiktok', tableId:'ads-tiktok-table', tagsId:'ads-tiktok-tags' },
    { ch:'do',     key:'meta-do',     chartId:'chart-ads-do',     tableId:'ads-do-table',     tagsId:'ads-do-tags'     },
  ];

  configs.forEach(({ ch, key, chartId, tableId, tagsId }) => {
    const ads = D.adCreatives[key];
    if (!ads) return;
    const metric = adMetric[ch];

    // Sort by chosen metric descending
    const sorted = [...ads].sort((a, b) => (b[metric]||0) - (a[metric]||0));
    const labels = sorted.map(a => a.label);
    const values = sorted.map(a => a[metric] || 0);
    const colors = AD_COLORS[ch] || ['#3182ce'];

    // Horizontal bar chart
    mkChart(chartId, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors.slice(0, labels.length),
          borderRadius: 4,
          barThickness: 28,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: { legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const v = ctx.parsed.x;
                if (metric === 'cpm' || metric === 'cpc') return ' € ' + v.toLocaleString('nl-NL', {minimumFractionDigits:2, maximumFractionDigits:2});
                if (metric === 'ctr' || metric === 'vtr') return ' ' + v.toLocaleString('nl-NL', {minimumFractionDigits:2, maximumFractionDigits:2}) + '%';
                return ' ' + v.toLocaleString('nl-NL');
              }
            }
          }
        },
        scales: {
          x: { grid: { color:'#f1f5f9' }, ticks: { font:{size:10}, color:'#94a3b8' } },
          y: { grid: { display:false }, ticks: { font:{size:11,weight:'600'}, color:'#374151' } }
        }
      }
    });

    // Table
    const tableEl = document.getElementById(tableId);
    if (!tableEl) return;
    const isTikTok = ch === 'tiktok';
    const isDo     = ch === 'do';
    const isSee    = ch === 'see';

    let thead, rows;
    if (isTikTok) {
      thead = `<thead><tr>
        <th>Advertentie</th>
        <th class="num">Impressies</th>
        <th class="num">Views 100%</th>
        <th class="num">VTR</th>
        <th class="num">CPM</th>
        <th class="num">Spend</th>
      </tr></thead>`;
      rows = ads.map(a => `<tr>
        <td><strong>${a.label}</strong></td>
        <td class="num">${fmt(a.imp)}</td>
        <td class="num">${fmt(a.vv100||0)}</td>
        <td class="num">${fmtP1(a.vtr||0)}</td>
        <td class="num">${fmtE(a.cpm)}</td>
        <td class="num">${fmtE(a.cost)}</td>
      </tr>`).join('');
    } else if (isDo) {
      thead = `<thead><tr>
        <th>Advertentie</th>
        <th class="num">Impressies</th>
        <th class="num">Clicks</th>
        <th class="num">CTR</th>
        <th class="num">CPC</th>
        <th class="num">Spend</th>
      </tr></thead>`;
      rows = ads.map(a => `<tr>
        <td><strong>${a.label}</strong></td>
        <td class="num">${fmt(a.imp)}</td>
        <td class="num">${fmt(a.clicks)}</td>
        <td class="num">${fmtP(a.ctr,2)}</td>
        <td class="num">${fmtE(a.cpc)}</td>
        <td class="num">${fmtE(a.cost)}</td>
      </tr>`).join('');
    } else {
      thead = `<thead><tr>
        <th>Advertentie</th>
        <th class="num">Impressies</th>
        <th class="num">Bereik</th>
        <th class="num">CPM</th>
        <th class="num">CTR</th>
        <th class="num">Spend</th>
      </tr></thead>`;
      rows = ads.map(a => `<tr>
        <td><strong>${a.label}</strong></td>
        <td class="num">${fmt(a.imp)}</td>
        <td class="num">${fmt(a.reach)}</td>
        <td class="num">${fmtE(a.cpm)}</td>
        <td class="num">${fmtP(a.ctr,2)}</td>
        <td class="num">${fmtE(a.cost)}</td>
      </tr>`).join('');
    }
    tableEl.innerHTML = `<table>${thead}<tbody>${rows}</tbody></table>`;
  });
}

window.setAdMetric = function(ch, metric) {
  adMetric[ch] = metric;
  // Update active button in the tags container
  const tagsId = `ads-${ch}-tags`;
  const tagsEl = document.getElementById(tagsId);
  if (tagsEl) {
    tagsEl.querySelectorAll('.chart-tag').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${metric}'`));
    });
  }
  renderAdCreatives();
};

// ── INIT ─────────────────────────────────────────────────
renderAll();
renderAdCreatives();

})();
