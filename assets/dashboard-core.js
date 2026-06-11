(function () {
'use strict';
const D = window.DASH_DATA;
const fmt   = n => (+n).toLocaleString('nl-NL',{minimumFractionDigits:0,maximumFractionDigits:0});
const fmtE  = n => '€ ' + (+n).toLocaleString('nl-NL',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtP  = (n,d=2) => (+n).toLocaleString('nl-NL',{minimumFractionDigits:d,maximumFractionDigits:d})+'%';
const fmtP1 = n => fmtP(n,1);

const CH = {
  'Meta See':     { color:'#0081FB', dataKey:'metaSee',   obj:'See',   phase:'See' },
  'Meta Think':   { color:'#4267B2', dataKey:'metaThink', obj:'Think', phase:'Think' },
  'TikTok Think': { color:'#EE1D52', dataKey:'tiktok',    obj:'Think', phase:'Think' },
  'Meta Do':      { color:'#3578E5', dataKey:'metaDo',    obj:'Do',    phase:'Do' },
};

const CHARTS = {};
function mkChart(id, cfg) {
  if (CHARTS[id]) { CHARTS[id].destroy(); }
  const el = document.getElementById(id);
  if (!el) return null;
  CHARTS[id] = new Chart(el, cfg);
  return CHARTS[id];
}

const LEGEND = { position:'bottom', labels:{ boxWidth:10, padding:12, font:{size:11} } };

let activeCampaign = 'avondkaart';
const chMetric = { see:'imp', think:'imp', tiktok:'imp', do:'imp' };
let gaMetric = 'sessions';

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
  renderAll();
});

// ── HELPERS ───────────────────────────────────────────────
function sumDaily(data, key) {
  return Object.values(data).reduce((s, d) => s + (d[key] || 0), 0);
}
function dailyDates(data) {
  return Object.keys(data).sort();
}
function cumulative(vals) {
  let s = 0;
  return vals.map(v => (s += v));
}
function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
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
    set('kpi-imp',     '82.297');
    set('kpi-imp-sub', 'DOOH impressies');
    set('kpi-reach',   '—');
    set('kpi-reach-sub', 'geen bereik meting');
    set('kpi-clicks',  '—');
    set('kpi-clicks-sub', 'DOOH · geen click tracking');
    set('kpi-spent',   '€ 694,17');
    set('kpi-spent-sub', 'media kosten totaal');
    set('kpi-ctr',     '—');
    set('kpi-ctr-sub', 'niet beschikbaar');
    set('kpi-cpm',     '€ 8,44');
    set('kpi-cpm-sub', 'kosten per 1.000 imp.');
    return;
  }
  const perf = D.performance;
  const totImp    = perf.reduce((s,p) => s+p.imp, 0);
  const totReach  = perf.reduce((s,p) => s+p.reach, 0);
  const totClicks = perf.reduce((s,p) => s+p.clicks, 0);
  const totSpend  = perf.reduce((s,p) => s+p.spend, 0);
  const ctr       = totImp > 0 ? totClicks/totImp*100 : 0;
  const cpm       = totImp > 0 ? totSpend/totImp*1000 : 0;
  const budget    = D.pacing.reduce((s,p) => s+p.budget, 0);

  set('kpi-imp',      totImp >= 1e6 ? (totImp/1e6).toFixed(2).replace('.',',')+' M' : fmt(totImp));
  set('kpi-imp-sub',  'alle kanalen gecombineerd');
  set('kpi-reach',    totReach >= 1e6 ? (totReach/1e6).toFixed(2).replace('.',',')+' M' : fmt(totReach));
  set('kpi-reach-sub','unieke personen');
  set('kpi-clicks',   fmt(totClicks));
  set('kpi-clicks-sub','link clicks');
  set('kpi-spent',    fmtE(totSpend));
  set('kpi-spent-sub','van '+fmtE(budget)+' budget');
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

  const perf = D.performance;
  let html = '';
  perf.forEach(p => {
    const badgeCls = p.obj==='See' ? 'b-blue' : p.obj==='Think' ? 'b-orange' : 'b-green';
    html += `<tr>
      <td><span class="ch-dot" style="background:${CH[p.channel].color}"></span><strong>${p.channel}</strong></td>
      <td><span class="badge ${badgeCls}">${p.obj}</span></td>
      <td class="num">${fmt(p.imp)}</td>
      <td class="num">${fmt(p.reach)}</td>
      <td class="num">${p.freq.toFixed(2)}</td>
      <td class="num">${fmt(p.clicks)}</td>
      <td class="num">${fmtP(p.ctr)}</td>
      <td class="num">${fmtE(p.cpm)}</td>
      <td class="num">${fmtE(p.spend)}</td>
    </tr>`;
  });

  const ti = perf.reduce((s,p)=>s+p.imp,0);
  const tr = perf.reduce((s,p)=>s+p.reach,0);
  const tc = perf.reduce((s,p)=>s+p.clicks,0);
  const ts = perf.reduce((s,p)=>s+p.spend,0);
  html += `<tr class="total-row">
    <td colspan="2"><strong>Totaal</strong></td>
    <td class="num"><strong>${fmt(ti)}</strong></td>
    <td class="num"><strong>${fmt(tr)}</strong></td>
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
          <div>
            <div class="pacing-ch-name"><span class="ch-dot" style="background:${p.color}"></span>${p.name}</div>
            <div class="pacing-ch-sub">${p.venue}</div>
          </div>
          <span class="badge b-green">Afgerond</span>
        </div>
        <div class="pacing-stats">
          Impressies: <strong>${fmt(p.imp)}</strong><br>
          Kosten: <strong>${fmtE(p.cost)}</strong> &nbsp;·&nbsp; CPM: <strong>${fmtE(cpm)}</strong>
        </div>
      </div>`;
    }).join('');
    return;
  }

  grid.innerHTML = D.pacing.map(p => {
    const pct = p.spentPct;
    const left = p.budget - p.spent;
    let badgeCls = 'b-green', badgeTxt = 'Op schema';
    if (pct < 85)      { badgeCls = 'b-red';    badgeTxt = 'Significant achter'; }
    else if (pct < 95) { badgeCls = 'b-orange'; badgeTxt = 'Licht achter'; }
    const fillCls = pct > 100 ? 'over' : pct < 85 ? 'warn' : '';
    return `<div class="pacing-card">
      <div class="pacing-card-head">
        <div>
          <div class="pacing-ch-name"><span class="ch-dot" style="background:${p.color}"></span>${p.channel}</div>
          <div class="pacing-ch-sub">${p.platform} · ${p.obj}</div>
        </div>
        <span class="badge ${badgeCls}">${badgeTxt}</span>
      </div>
      <div class="pacing-prog">
        <div class="prog-wrap">
          <div class="prog-bg"><div class="prog-fill ${fillCls}" style="width:${Math.min(100,pct)}%"></div></div>
          <span class="prog-txt">${fmtP1(pct)}</span>
        </div>
      </div>
      <div class="pacing-stats">
        Besteed: <strong>${fmtE(p.spent)}</strong><br>
        Budget: <strong>${fmtE(p.budget)}</strong> &nbsp;·&nbsp; Resterend: <strong>${fmtE(Math.max(0,left))}</strong>
      </div>
    </div>`;
  }).join('');
}

// ── FUNNEL CHART ──────────────────────────────────────────
function renderFunnelChart() {
  const see   = D.performance.find(p=>p.channel==='Meta See');
  const think = [D.performance.find(p=>p.channel==='Meta Think'), D.performance.find(p=>p.channel==='TikTok Think')];
  const doP   = D.performance.find(p=>p.channel==='Meta Do');

  mkChart('funnel-chart', {
    type: 'bar',
    data: {
      labels: ['See (Meta)', 'Think (Meta + TikTok)', 'Do (Meta)'],
      datasets: [{
        label: 'Bereik',
        data: [
          see ? see.reach : 0,
          think.reduce((s,p) => s+(p?p.reach:0), 0),
          doP ? doP.reach : 0
        ],
        backgroundColor: ['#0081FBCC','#7B61FFCC','#3578E5CC'],
        borderRadius: 4,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ' Bereik: ' + fmt(ctx.raw) } }
      },
      scales: {
        x: { ticks: { font:{size:10}, callback: v => v>=1e6 ? (v/1e6).toFixed(1)+'M' : v>=1e3 ? (v/1e3).toFixed(0)+'K' : v } },
        y: { ticks: { font:{size:11} } }
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
      data:{ labels:pubs.map(p=>p.name), datasets:[{ data:pubs.map(p=>p.cost), backgroundColor:pubs.map(p=>p.color), borderWidth:2 }] },
      options:{ cutout:'65%', plugins:{ legend:LEGEND, tooltip:{ callbacks:{ label: ctx=>' '+ctx.label+': '+fmtE(ctx.raw) } } } }
    });
    return;
  }
  mkChart('spend-donut', {
    type:'doughnut',
    data:{
      labels: D.performance.map(p=>p.channel),
      datasets:[{ data:D.performance.map(p=>p.spend), backgroundColor:D.performance.map(p=>CH[p.channel].color), borderWidth:2 }]
    },
    options:{ cutout:'65%', plugins:{ legend:LEGEND, tooltip:{ callbacks:{ label: ctx=>' '+ctx.label+': '+fmtE(ctx.raw) } } } }
  });
  const totSpend = D.performance.reduce((s,p)=>s+p.spend,0);
  set('spend-donut-sub','Totaal: '+fmtE(totSpend));
}

// ── PER-CHANNEL CHARTS ────────────────────────────────────
const CH_CHART_MAP = {
  see:    { dataKey:'metaSee',   color:'#0081FB', id:'chart-meta-see',   spendId:'chart-meta-see-spend',   cumId:'chart-meta-see-reach' },
  think:  { dataKey:'metaThink', color:'#4267B2', id:'chart-meta-think', spendId:'chart-meta-think-spend', cumId:null },
  tiktok: { dataKey:'tiktok',    color:'#EE1D52', id:'chart-tiktok',     spendId:'chart-tiktok-spend',     cumId:null },
  do:     { dataKey:'metaDo',    color:'#3578E5', id:'chart-meta-do',    spendId:'chart-meta-do-spend',    cumId:'chart-meta-do-cumclicks' },
};

const metricLabels = { imp:'Impressies', reach:'Bereik', clicks:'Clicks', cost:'Spend (€)', sessions:'Sessies', engaged:'Betrokken', atc:'Add-to-cart', checkouts:'Checkouts' };

function renderChannelCharts() {
  Object.entries(CH_CHART_MAP).forEach(([key, cfg]) => {
    const raw = D[cfg.dataKey];
    const dates = dailyDates(raw);
    const metric = chMetric[key];
    const color = cfg.color;

    mkChart(cfg.id, {
      type:'line',
      data:{
        labels: dates.map(d=>d.slice(5)),
        datasets:[{
          label: metricLabels[metric],
          data: dates.map(d => raw[d]?raw[d][metric]||0:0),
          borderColor: color, backgroundColor: color+'20',
          borderWidth:2, fill:true, tension:0.3, pointRadius:2,
        }]
      },
      options:{
        responsive:true,
        scales:{ x:{ticks:{maxTicksLimit:15,font:{size:10}}}, y:{ticks:{font:{size:10}}} },
        plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label: ctx=>' '+metricLabels[metric]+': '+fmt(ctx.raw) } } }
      }
    });

    mkChart(cfg.spendId, {
      type:'bar',
      data:{
        labels: dates.map(d=>d.slice(5)),
        datasets:[{
          label:'Spend (€)',
          data: dates.map(d => raw[d]?raw[d].cost||0:0),
          backgroundColor: color+'CC', borderRadius:3,
        }]
      },
      options:{
        responsive:true,
        scales:{ x:{ticks:{maxTicksLimit:15,font:{size:10}}}, y:{ticks:{font:{size:10}}} },
        plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label: ctx=>' €'+ctx.raw.toFixed(2) } } }
      }
    });

    if (cfg.cumId) {
      const cumKey = key === 'do' ? 'clicks' : 'reach';
      const cumVals = cumulative(dates.map(d => raw[d]?raw[d][cumKey]||0:0));
      mkChart(cfg.cumId, {
        type:'line',
        data:{
          labels: dates.map(d=>d.slice(5)),
          datasets:[{
            label: key==='do' ? 'Cumulatieve Clicks' : 'Cumulatief Bereik',
            data: cumVals,
            borderColor: color, backgroundColor: color+'20',
            borderWidth:2, fill:true, tension:0.1, pointRadius:2,
          }]
        },
        options:{
          responsive:true,
          scales:{
            x:{ticks:{maxTicksLimit:15,font:{size:10}}},
            y:{ticks:{font:{size:10},callback:v=>v>=1e6?(v/1e6).toFixed(1)+'M':v>=1e3?(v/1e3).toFixed(0)+'K':v}}
          },
          plugins:{ legend:{display:false}, tooltip:{callbacks:{label:ctx=>' '+fmt(ctx.raw)}} }
        }
      });
    }
  });

  renderTikTokVV();
  renderChannelKPIs();
}

function renderTikTokVV() {
  const dates = dailyDates(D.tiktok);
  mkChart('chart-tiktok-vv', {
    type:'line',
    data:{
      labels: dates.map(d=>d.slice(5)),
      datasets:[
        { label:'Video Views', data:dates.map(d=>D.tiktok[d].vv||0), borderColor:'#EE1D52', backgroundColor:'#EE1D5220', borderWidth:2, fill:true, tension:0.3, pointRadius:2 },
        { label:'100% Views',  data:dates.map(d=>D.tiktok[d].vv100||0), borderColor:'#FF6B8A', backgroundColor:'transparent', borderWidth:1.5, borderDash:[4,3], fill:false, tension:0.3, pointRadius:2 }
      ]
    },
    options:{
      responsive:true,
      scales:{ x:{ticks:{maxTicksLimit:15,font:{size:10}}}, y:{ticks:{font:{size:10}}} },
      plugins:{ legend:LEGEND }
    }
  });
}

function renderChannelKPIs() {
  const chDefs = [
    { elId:'kpi-meta-see',   perf:D.performance.find(p=>p.channel==='Meta See') },
    { elId:'kpi-meta-think', perf:D.performance.find(p=>p.channel==='Meta Think') },
    { elId:'kpi-tiktok',     perf:D.performance.find(p=>p.channel==='TikTok Think'), vtr:true },
    { elId:'kpi-meta-do',    perf:D.performance.find(p=>p.channel==='Meta Do') },
  ];
  chDefs.forEach(({elId, perf, vtr}) => {
    const el = document.getElementById(elId);
    if (!el || !perf) return;
    const extraVal = vtr ? fmtP(perf.vtr||0,1)+' VTR' : fmt(perf.reach)+' bereik';
    el.innerHTML = `
      <div class="kpi-card"><div class="kpi-label">Impressies</div><div class="kpi-val" style="font-size:18px">${fmt(perf.imp)}</div><div class="kpi-sub">${extraVal}</div></div>
      <div class="kpi-card orange"><div class="kpi-label">Clicks</div><div class="kpi-val" style="font-size:18px">${fmt(perf.clicks)}</div><div class="kpi-sub">CTR: ${fmtP(perf.ctr)}</div></div>
      <div class="kpi-card green"><div class="kpi-label">Besteed</div><div class="kpi-val" style="font-size:18px">${fmtE(perf.spend)}</div><div class="kpi-sub">CPC: ${fmtE(perf.cpc)}</div></div>
      <div class="kpi-card purple"><div class="kpi-label">CPM</div><div class="kpi-val" style="font-size:18px">${fmtE(perf.cpm)}</div><div class="kpi-sub">Freq: ${perf.freq.toFixed(2)}</div></div>
    `;
  });
}

// ── DOOH CHARTS ───────────────────────────────────────────
function renderDoohCharts() {
  const dates = dailyDates(D.dooh);
  mkChart('chart-dooh-daily', {
    type:'bar',
    data:{
      labels: dates.map(d=>d.slice(5)),
      datasets:[{ label:'DOOH Impressies', data:dates.map(d=>D.dooh[d].imp||0), backgroundColor:'#9B59B6CC', borderRadius:4 }]
    },
    options:{ responsive:true, scales:{ x:{ticks:{font:{size:10}}}, y:{ticks:{font:{size:10}}} }, plugins:{ legend:{display:false} } }
  });
  mkChart('chart-dooh-donut', {
    type:'doughnut',
    data:{ labels:D.doohPublishers.map(p=>p.name), datasets:[{ data:D.doohPublishers.map(p=>p.imp), backgroundColor:D.doohPublishers.map(p=>p.color), borderWidth:2 }] },
    options:{ cutout:'65%', plugins:{ legend:LEGEND, tooltip:{callbacks:{label:ctx=>' '+ctx.label+': '+fmt(ctx.raw)+' imp'}} } }
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
  const dates = dailyDates(D.ga4);
  const colors = { sessions:'#3182ce', engaged:'#38b2ac', atc:'#ed8936', checkouts:'#48bb78' };
  const col = colors[gaMetric];

  mkChart('chart-ga4', {
    type:'line',
    data:{
      labels: dates.map(d=>d.slice(5)),
      datasets:[{
        label: metricLabels[gaMetric],
        data: dates.map(d => D.ga4[d]?D.ga4[d][gaMetric]||0:0),
        borderColor: col, backgroundColor: col+'20',
        borderWidth:2, fill:true, tension:0.3, pointRadius:2,
      }]
    },
    options:{ responsive:true, scales:{ x:{ticks:{maxTicksLimit:15,font:{size:10}}}, y:{ticks:{font:{size:10}}} }, plugins:{ legend:{display:false} } }
  });

  const vals = Object.values(D.ga4);
  const totS = vals.reduce((s,v)=>s+(v.sessions||0),0);
  const totE = vals.reduce((s,v)=>s+(v.engaged||0),0);
  const totA = vals.reduce((s,v)=>s+(v.atc||0),0);
  const totC = vals.reduce((s,v)=>s+(v.checkouts||0),0);

  mkChart('chart-ga4-funnel', {
    type:'bar',
    data:{
      labels:['Sessies','Betrokken','Add-to-cart','Checkouts'],
      datasets:[{ data:[totS,totE,totA,totC], backgroundColor:['#3182ceCC','#38b2acCC','#ed8936CC','#48bb78CC'], borderRadius:4 }]
    },
    options:{
      responsive:true,
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:ctx=>' '+fmt(ctx.raw)}} },
      scales:{ x:{ticks:{font:{size:11}}}, y:{ticks:{font:{size:10},callback:v=>v>=1e3?(v/1e3).toFixed(0)+'K':v}} }
    }
  });

  const rateData = dates.map(d => {
    const row = D.ga4[d];
    if (!row || !row.sessions) return 0;
    return +(row.checkouts/row.sessions*100).toFixed(2);
  });
  mkChart('chart-ga4-rate', {
    type:'line',
    data:{
      labels: dates.map(d=>d.slice(5)),
      datasets:[{ label:'Checkout Rate %', data:rateData, borderColor:'#48bb78', backgroundColor:'#48bb7820', borderWidth:2, fill:true, tension:0.3, pointRadius:2 }]
    },
    options:{
      responsive:true,
      scales:{ x:{ticks:{maxTicksLimit:15,font:{size:10}}}, y:{ticks:{font:{size:10},callback:v=>v+'%'}} },
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:ctx=>' '+ctx.raw+'%'}} }
    }
  });
}

function renderGaKPIs() {
  const vals = Object.values(D.ga4);
  set('ga-sessions',  fmt(vals.reduce((s,v)=>s+(v.sessions||0),0)));
  set('ga-engaged',   fmt(vals.reduce((s,v)=>s+(v.engaged||0),0)));
  set('ga-atc',       fmt(vals.reduce((s,v)=>s+(v.atc||0),0)));
  set('ga-checkouts', fmt(vals.reduce((s,v)=>s+(v.checkouts||0),0)));
}

// ── GLOBAL METRIC TOGGLES ─────────────────────────────────
window.setChMetric = function(ch, metric) {
  chMetric[ch] = metric;
  const prefixMap = { see:'ms', think:'mt', tiktok:'tt', do:'md' };
  const prefix = prefixMap[ch];
  ['imp','reach','clicks','cost'].forEach(m => {
    const btn = document.getElementById(prefix+'-m-'+m);
    if (btn) btn.classList.toggle('active', m===metric);
  });
  renderChannelCharts();
};

// ── INIT ─────────────────────────────────────────────────
renderAll();

})();
