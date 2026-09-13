(function(){
  const STORAGE_KEY = 'pi_state';

  // Hybrid persistence: use Claude artifact storage when available,
  // fall back to localStorage when hosted as a standalone site.
  async function storageGet(key){
    if(typeof window.storage !== 'undefined'){
      try{ return await window.storage.get(key); }catch(e){}
    }
    try{
      const raw = localStorage.getItem(key);
      return raw ? { value: raw } : null;
    }catch(e){ return null; }
  }
  async function storageSet(key, value){
    if(typeof window.storage !== 'undefined'){
      try{ return await window.storage.set(key, value); }catch(e){}
    }
    try{ localStorage.setItem(key, value); return {}; }catch(e){ return null; }
  }
  const PLAYER_NORMAL = 'images/player-normal.png';
  const PLAYER_TALK   = 'images/player-ngomong.png';
  const REKTOR_NORMAL = 'images/rektor-normal.png';
  const REKTOR_TALK   = 'images/rektor-ngomong.png';

  let state = {
    budget: 5000000000, trust: 100, completed:{}, purchases:{},
    metrics:{ pe:0, us:0, dq:0, ds:0 }, dungeonHP: 100,
    team: [], synergy:{ tech:0, data:0, biz:0, change:0, lead:0 }
  };

  function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }

  async function loadState(){
    try{
      const res = await storageGet(STORAGE_KEY);
      if(res && res.value){
        const saved = JSON.parse(res.value);
        state = Object.assign(state, saved);
        state.metrics = Object.assign({pe:0,us:0,dq:0,ds:0}, saved.metrics || {});
        state.synergy = Object.assign({tech:0,data:0,biz:0,change:0,lead:0}, saved.synergy || {});
      }
    }catch(e){ /* use defaults */ }
  }
  async function saveState(){
    try{ await storageSet(STORAGE_KEY, JSON.stringify(state)); }
    catch(e){ console.error('save failed', e); }
  }

  function showScreen(id){
    document.querySelectorAll('.screen').forEach(s=> s.classList.remove('show'));
    document.getElementById(id).classList.add('show');
  }

  // ================= COMPUTE METRICS FROM PAST DECISIONS =================
  let M = {};
  function computeMetrics(){
    const p = state.purchases || {};
    const hasTraining = !!p.training;
    const hasCleansing = !!p.cleansing;
    const hasInfra = !!p.infra;
    const hasChangeMgmt = (state.team||[]).includes('change');
    const hasSecurity = (state.team||[]).includes('security');
    const teamReady = (state.team||[]).length === 5 &&
      Object.values(state.synergy||{}).every(v=> v >= 5);
    const hp = (typeof state.dungeonHP === 'number') ? state.dungeonHP : 100;
    const trust = (typeof state.trust === 'number') ? state.trust : 100;
    const met = state.metrics || {pe:0,us:0,dq:0,ds:0};

    const budgetUtil = clamp(Math.round((5000000000 - state.budget) / 5000000000 * 100), 0, 100);
    const processEff = clamp(Math.round(55 + met.pe), 0, 100);
    const userSat = hasTraining
      ? clamp(Math.round(50 + met.us * 1.4 + (trust - 100) * 0.3), 0, 100)
      : 52;
    const adoption = hasTraining
      ? clamp(Math.round(65 + (hasChangeMgmt ? 15 : 0) + (trust - 100) * 0.2), 0, 100)
      : 52;
    const dataQuality = hasCleansing
      ? clamp(Math.round(90 + (hp - 100) * 0.08), 0, 100)
      : 61;
    const reliability = clamp(Math.round(60 + (hasInfra ? 25 : 0) + (hp - 100) * 0.15), 0, 100);
    const errorReduction = clamp(Math.round(20 + (hasInfra ? 25 : 0) + (hp - 100) * 0.3), 0, 100);
    const securityIncidents = Math.max(0, 2 - (hasSecurity ? 1 : 0) - (hp >= 90 ? 1 : 0));

    return {
      hasTraining, hasCleansing, hasInfra, hasChangeMgmt, hasSecurity, teamReady, hp, trust,
      budgetUtil, processEff, userSat, adoption, dataQuality, reliability, errorReduction, securityIncidents
    };
  }

  // ================= DASHBOARD SNAPSHOT =================
  function renderDashboard(){
    const rows = [
      ['💰 Pemanfaatan Anggaran', M.budgetUtil + '%'],
      ['⏱ Efisiensi Proses', '+' + M.processEff + '%'],
      ['😊 Kepuasan Pengguna', M.userSat + '%'],
      ['👥 Adopsi Sistem', M.adoption + '%'],
      ['💾 Migrasi Data', M.dataQuality + '%'],
      ['🐛 Tingkat Error Sistem', '-' + M.errorReduction + '%'],
      ['🔐 Insiden Keamanan', M.securityIncidents],
    ];
    document.getElementById('dashboard-kpis').innerHTML = rows.map(r=>
      `<div class="kpi-row"><span class="kpi-name">${r[0]}</span><span class="kpi-val">${r[1]}</span></div>`
    ).join('');
  }

  // ================= INDICATOR QUIZ =================
  const indicators = [
    { id:'features', text:'Jumlah fitur yang dibuat', correct:false },
    { id:'proctime', text:'Waktu proses akademik', correct:true, metric:'processEff', label:'⏱ Efisiensi Proses' },
    { id:'satisfaction', text:'Kepuasan pengguna', correct:true, metric:'userSat', label:'😊 Kepuasan Pengguna' },
    { id:'adoption', text:'Tingkat adopsi', correct:true, metric:'adoption', label:'👥 Tingkat Adopsi' },
    { id:'errors', text:'Jumlah error', correct:true, metric:'errorReduction', label:'🐛 Tingkat Error', invert:true },
    { id:'dataquality', text:'Kualitas data', correct:true, metric:'dataQuality', label:'💾 Kualitas Data' },
    { id:'usage', text:'Penggunaan sistem', correct:true, metric:'reliability', label:'🛠️ Keandalan Sistem' },
    { id:'cost', text:'Biaya proyek', correct:true, metric:'budgetUtil', label:'💰 Kinerja Biaya', invert:true },
    { id:'uicolor', text:'Warna tampilan aplikasi', correct:false },
    { id:'newpc', text:'Jumlah komputer baru', correct:false },
  ];
  let quizPicked = [];

  function renderQuiz(){
    const listEl = document.getElementById('check-list');
    listEl.innerHTML = '';
    indicators.forEach(ind=>{
      const el = document.createElement('div');
      el.className = 'check-item';
      el.innerHTML = `<div class="box"></div><div class="txt">${ind.text}</div>`;
      el.addEventListener('click', ()=>{
        if(quizPicked.includes(ind.id)){
          quizPicked = quizPicked.filter(x=> x !== ind.id);
          el.classList.remove('picked');
          el.querySelector('.box').textContent = '';
        } else {
          quizPicked.push(ind.id);
          el.classList.add('picked');
          el.querySelector('.box').textContent = '✓';
        }
      });
      listEl.appendChild(el);
    });
  }

  let indicatorScore = 0;
  function submitQuiz(){
    const listEl = document.getElementById('check-list');
    const items = listEl.querySelectorAll('.check-item');
    let correctPicked = 0, wrongPicked = 0;
    indicators.forEach((ind, i)=>{
      const picked = quizPicked.includes(ind.id);
      const el = items[i];
      if(ind.correct && picked){ el.classList.add('correct'); correctPicked++; }
      else if(ind.correct && !picked){ el.classList.add('incorrect'); }
      else if(!ind.correct && picked){ el.classList.add('incorrect'); wrongPicked++; }
    });
    indicatorScore = correctPicked - wrongPicked;
    document.getElementById('quiz-note').innerHTML =
      `Kamu memilih ${correctPicked}/7 indikator yang relevan dengan benar` +
      (wrongPicked>0 ? `, dan ${wrongPicked} indikator yang sebenarnya tidak mengukur keberhasilan proyek (seperti tampilan atau jumlah perangkat).` : `.`);
    document.getElementById('btn-submit-quiz').style.display = 'none';
    setTimeout(()=>{
      document.getElementById('btn-submit-quiz').textContent = 'LIHAT HASIL INDIKATOR';
      document.getElementById('btn-submit-quiz').style.display = 'block';
      document.getElementById('btn-submit-quiz').onclick = ()=>{ renderMetricDetail(); showScreen('screen-metrics'); };
    }, 900);
  }

  // ================= METRIC DETAIL WITH WARNINGS =================
  function renderMetricDetail(){
    const cards = indicators.filter(i=> i.correct);
    const container = document.getElementById('metric-cards');
    container.innerHTML = '';
    cards.forEach(ind=>{
      const raw = M[ind.metric];
      const displayVal = ind.invert && ind.metric==='errorReduction' ? '-' + raw + '%'
        : ind.invert && ind.metric==='budgetUtil' ? raw + '% terpakai'
        : raw + '%';
      const card = document.createElement('div');
      card.className = 'metric-card';
      card.innerHTML = `
        <div class="top-row"><span class="m-name">${ind.label}</span><span class="m-val">${displayVal}</span></div>
        <div class="metric-bar-outer"><div class="metric-bar-inner" id="bar-${ind.id}"></div></div>
        <div class="metric-warn" id="warn-${ind.id}"></div>
      `;
      container.appendChild(card);
      setTimeout(()=>{
        document.getElementById('bar-'+ind.id).style.width = raw + '%';
      }, 80);

      const warnEl = ()=> document.getElementById('warn-'+ind.id);
      if(ind.metric === 'userSat' && !M.hasTraining){
        warnEl().innerHTML = '⚠️ <b>PERINGATAN</b> — Kepuasan pengguna di bawah target.<br>Penyebab: Pelatihan pengguna belum memadai.';
        warnEl().classList.add('show');
      }
      if(ind.metric === 'adoption' && !M.hasTraining){
        warnEl().innerHTML = '⚠️ <b>PERINGATAN</b> — Adopsi pengguna masih di bawah target.<br>Penyebab: Pelatihan pengguna belum cukup (Quest 02).';
        warnEl().classList.add('show');
      }
      if(ind.metric === 'dataQuality' && !M.hasCleansing){
        warnEl().innerHTML = '⚠️ <b>PERINGATAN</b> — Terdeteksi ketidakkonsistenan data.<br>Realisasi manfaat proyek: BERISIKO. Pembersihan data tidak pernah dibeli di Quest 02.';
        warnEl().classList.add('show');
      }
      if(ind.metric === 'reliability' && !M.hasInfra){
        warnEl().innerHTML = '⚠️ <b>PERINGATAN</b> — Infrastruktur belum cukup kuat untuk menjamin skalabilitas jangka panjang.';
        warnEl().classList.add('show');
      }
      if(ind.metric === 'processEff' && M.hp < 60){
        warnEl().innerHTML = '⚠️ <b>PERINGATAN</b> — Banyak risiko yang tertangani secara reaktif, bukan preventif, sehingga efisiensi proses belum maksimal.';
        warnEl().classList.add('show');
      }
    });
  }

  // ================= FINAL EVALUATION =================
  function renderEvaluation(){
    const strategicOk = !!(state.completed && state.completed.quest1);
    const benefitsOk = ((state.metrics && (state.metrics.pe+state.metrics.us+state.metrics.dq+state.metrics.ds)) || 0) >= 60;
    const riskOk = M.hp >= 50;
    const resourceOk = M.teamReady;
    const kpiOk = indicatorScore >= 6;

    const rows = [
      ['Kesesuaian Strategis', strategicOk],
      ['Manfaat yang Diharapkan', benefitsOk],
      ['Manajemen Risiko', riskOk],
      ['Sumber Daya Kritis', resourceOk],
      ['Indikator Kinerja', kpiOk],
    ];
    document.getElementById('eval-rows').innerHTML = rows.map(r=>
      `<div class="eval-row"><span>${r[0]}</span><span class="mark ${r[1]?'pass':'fail'}">${r[1]?'✓':'⚠'}</span></div>`
    ).join('');

    const passCount = rows.filter(r=> r[1]).length;
    const avgMetric = (M.processEff + M.userSat + M.adoption + M.dataQuality + M.reliability) / 5;
    const score = clamp(Math.round((passCount/5)*40 + avgMetric*0.6), 0, 100);

    const scoreNumEl = document.getElementById('score-num');
    const tierEl = document.getElementById('score-tier');
    let n = 0;
    const t = setInterval(()=>{
      n += 2;
      if(n >= score){ n = score; clearInterval(t); }
      scoreNumEl.textContent = n + ' / 100';
    }, 20);

    let tier, tierClass;
    if(score >= 80){ tier = '🏆 BERHASIL'; tierClass = 'success'; }
    else if(score >= 60){ tier = '⚠️ BERHASIL SEBAGIAN'; tierClass = 'partial'; }
    else { tier = '❌ PROYEK BERISIKO'; tierClass = 'risk'; }
    tierEl.textContent = tier;
    tierEl.className = 'score-tier ' + tierClass;

    state.finalScore = score;
    state.finalTier = tier;
    state.completed = state.completed || {};
    state.completed.quest5 = true;
    saveState();

    return score;
  }

  // ================= ENDING VN =================
  const vnScripts = {
    success: [
      { speaker:'REKTOR', text:'"Jadi... apakah kita berhasil?"' },
      { speaker:'KAMU', text:'"Ya. Tapi bukan hanya karena sistem sudah diluncurkan."' },
      { speaker:'REKTOR', text:'"Lalu kenapa?"' },
      { speaker:'KAMU', text:'"Karena kita mencapai tujuan strategis, menghasilkan manfaat yang terukur, mengendalikan risiko, mengalokasikan sumber daya yang tepat, dan memantau hasilnya."' },
    ],
    partial: [
      { speaker:'REKTOR', text:'"Jadi... apakah kita berhasil?"' },
      { speaker:'KAMU', text:'"Sebagian. Sistem sudah berjalan, tapi ada beberapa hal yang masih kurang."' },
      { speaker:'REKTOR', text:'"Contohnya?"' },
      { speaker:'KAMU', text:'"Beberapa indikator masih di bawah target — tapi kita tahu persis yang mana dan alasannya."' },
      { speaker:'REKTOR', text:'"Jadi ini belum selesai."' },
      { speaker:'KAMU', text:'"Benar. Tapi sekarang kita tahu apa yang harus diperbaiki selanjutnya."' },
    ],
    risk: [
      { speaker:'REKTOR', text:'"Jadi... apakah kita berhasil?"' },
      { speaker:'KAMU', text:'"Sistem sudah diluncurkan. Itu bukan berarti berhasil."' },
      { speaker:'REKTOR', text:'"Apa yang salah?"' },
      { speaker:'KAMU', text:'"Kita kurang berinvestasi pada sisi manusia dan risiko proyek ini — dan itu terlihat di hampir semua indikator."' },
      { speaker:'REKTOR', text:'"Lalu apa yang terjadi sekarang?"' },
      { speaker:'KAMU', text:'"Kita kembali, perbaiki celahnya, dan buktikan manfaatnya dengan benar sebelum menyebutnya selesai."' },
    ],
  };
  let vnScript = vnScripts.success;
  let vnIndex = -1;
  const vnPlayerImg = document.getElementById('vn-player-img');
  const vnRektorImg = document.getElementById('vn-rektor-img');
  const vnText = document.getElementById('vn-text');
  const vnSpeaker = document.getElementById('vn-speaker');
  const vnNext = document.getElementById('vn-next');
  let vnTyping = false, vnChar = 0, vnTimer = null, vnCurrent = '';

  function vnSetMood(speaker){
    if(speaker === 'REKTOR'){ vnRektorImg.src = REKTOR_TALK; vnPlayerImg.src = PLAYER_NORMAL; }
    else { vnPlayerImg.src = PLAYER_TALK; vnRektorImg.src = REKTOR_NORMAL; }
  }
  function vnType(text){
    vnCurrent = text; vnChar = 0; vnTyping = true;
    vnText.textContent = '';
    vnNext.style.visibility = 'hidden';
    clearInterval(vnTimer);
    vnTimer = setInterval(()=>{
      vnChar++;
      vnText.textContent = vnCurrent.slice(0, vnChar);
      if(vnChar >= vnCurrent.length){
        clearInterval(vnTimer); vnTyping = false;
        vnNext.style.visibility = 'visible';
      }
    }, 22);
  }
  function vnAdvance(){
    if(vnTyping){ clearInterval(vnTimer); vnText.textContent = vnCurrent; vnTyping = false; vnNext.style.visibility='visible'; return; }
    vnIndex++;
    if(vnIndex < vnScript.length){
      const line = vnScript[vnIndex];
      vnSpeaker.textContent = line.speaker;
      vnSetMood(line.speaker);
      vnType(line.text);
    } else {
      renderFinalScreen();
      showScreen('screen-final');
    }
  }
  document.getElementById('vn-box').addEventListener('click', vnAdvance);

  function startEnding(){
    vnIndex = -1;
    vnScript = state.finalScore >= 80 ? vnScripts.success
      : state.finalScore >= 60 ? vnScripts.partial
      : vnScripts.risk;
    vnPlayerImg.src = PLAYER_NORMAL;
    vnRektorImg.src = REKTOR_NORMAL;
    showScreen('screen-ending');
    vnAdvance();
  }

  // ================= FINAL SCREEN =================
  function renderFinalScreen(){
    const isSuccess = state.finalScore >= 80;
    const isPartial = state.finalScore >= 60 && state.finalScore < 80;
    const titleEl = document.querySelector('#screen-final h1');
    const taglineEl = document.querySelector('#screen-final p');
    if(isSuccess){
      titleEl.textContent = '🏆 PROYEK SELESAI';
      taglineEl.textContent = 'Proyek TI yang berhasil tidak ditentukan hanya oleh implementasi saja.';
    } else if(isPartial){
      titleEl.textContent = '⚠️ PROYEK SELESAI — DENGAN CELAH';
      taglineEl.textContent = 'Meluncurkan sistem itu mudah. Membuktikan nilainya itu yang sulit.';
    } else {
      titleEl.textContent = '❌ PROYEK BERISIKO';
      taglineEl.textContent = 'Sistem yang berjalan bukan berarti proyek itu berhasil.';
    }
    document.getElementById('final-summary').innerHTML = `
      <div>SKOR PROYEK: ${state.finalScore} / 100</div>
      <div>${state.finalTier}</div>
    `;
  }

  // ================= WIRING =================
  document.getElementById('btn-debug-state').addEventListener('click', async ()=>{
    const out = document.getElementById('debug-output');
    let raw;
    try{ raw = await storageGet(STORAGE_KEY); }catch(e){ raw = { error: e.message }; }
    out.textContent =
      'storageGet("pi_state") mentah:\n' + JSON.stringify(raw, null, 2) +
      '\n\nlocalStorage langsung:\n' + localStorage.getItem(STORAGE_KEY) +
      '\n\nwindow.storage tersedia? ' + (typeof window.storage !== 'undefined') +
      '\norigin: ' + location.origin + location.pathname;
    out.style.display = 'block';
  });
  document.getElementById('btn-enter-dashboard').addEventListener('click', ()=>{
    M = computeMetrics();
    renderDashboard();
    showScreen('screen-dashboard');
  });
  document.getElementById('btn-to-quiz').addEventListener('click', ()=>{
    renderQuiz();
    showScreen('screen-quiz');
  });
  document.getElementById('btn-submit-quiz').addEventListener('click', submitQuiz);
  document.getElementById('btn-to-eval').addEventListener('click', ()=>{
    renderEvaluation();
    showScreen('screen-eval');
  });
  document.getElementById('btn-to-ending').addEventListener('click', startEnding);

  loadState();
})();