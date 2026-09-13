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
  const MAX_SLOTS = 5;
  const ICON_IMG = 'images/player-1.png';
  let state = { budget:0, trust:100, completed:{} };
  let selected = [];

  const candidates = [
    { id:'it', image:'images/player-1.png', icon:'👨‍💻', name:'Spesialis IT', role:'TEKNOLOGI',
      desc:'Menguasai pengembangan dan integrasi sistem — orang yang benar-benar membangun platformnya.',
      stats:{ tech:5, data:2, biz:0, change:0, lead:1 } },
    { id:'academic', image:'images/player-2.png', icon:'👩‍🏫', name:'Perwakilan Akademik', role:'PROSES BISNIS',
      desc:'Memahami proses akademik dari sisi pengguna nyata — dosen, mahasiswa, dan aturan akademik.',
      stats:{ tech:0, data:1, biz:4, change:2, lead:1 } },
    { id:'pm', image:'images/player-3.png', icon:'👨‍💼', name:'Manajer Proyek', role:'KEPEMIMPINAN',
      desc:'Mengatur timeline, koordinasi tim, dan memastikan proyek tetap pada jalurnya.',
      stats:{ tech:1, data:0, biz:2, change:2, lead:5 } },
    { id:'security', image:'images/player-4.png', icon:'🔐', name:'Spesialis Keamanan', role:'TEKNOLOGI',
      desc:'Menjaga keamanan data dan sistem dari celah yang bisa dieksploitasi.',
      stats:{ tech:3, data:2, biz:1, change:0, lead:0 } },
    { id:'data', image:'images/player-5.png', icon:'💾', name:'Spesialis Data', role:'DATA',
      desc:'Menangani migrasi, kebersihan, dan struktur data lintas sistem lama dan baru.',
      stats:{ tech:1, data:6, biz:0, change:0, lead:1 } },
    { id:'change', image:'images/player-6.png', icon:'📢', name:'Manajemen Perubahan', role:'PERUBAHAN',
      desc:'Membantu pengguna beradaptasi dengan sistem baru lewat komunikasi dan pelatihan.',
      stats:{ tech:0, data:0, biz:1, change:6, lead:1 } },
    { id:'finance', image:'images/player-7.png', icon:'💰', name:'Pejabat Keuangan', role:'BISNIS',
      desc:'Mengawasi anggaran, pengeluaran, dan memastikan proyek tetap sesuai budget.',
      stats:{ tech:0, data:1, biz:5, change:1, lead:2 } },
  ];

  const itemsEl = document.getElementById('items');
  const hudSlots = document.getElementById('hud-slots');
  const introEl = document.getElementById('intro');
  const recruitPanel = document.getElementById('recruit-panel');
  const playerImg = document.getElementById('player-img');
  const finalizeBtn = document.getElementById('finalize-btn');
  const infoModal = document.getElementById('info-modal');
  const toastEl = document.getElementById('toast');
  const reportEl = document.getElementById('report');
  const nextBtn = document.getElementById('next-btn');
  let activeCandidate = null;

  async function loadState(){
    try{
      const res = await storageGet(STORAGE_KEY);
      if(res && res.value){ state = Object.assign(state, JSON.parse(res.value)); }
    }catch(e){}
  }
  async function saveState(){
    try{ await storageSet(STORAGE_KEY, JSON.stringify(state)); }
    catch(e){ console.error('save failed', e); }
  }

  function renderGrid(){
    itemsEl.innerHTML = '';
    candidates.forEach(c=>{
      const isSelected = selected.includes(c.id);
      const el = document.createElement('div');
      el.className = 'icon-btn' + (isSelected ? ' selected' : '') + (!isSelected && selected.length >= MAX_SLOTS ? ' disabled' : '');
      el.innerHTML = `<div class="emoji"><img src="${c.image}" alt=""></div><div class="label">${c.name}</div>`;
      el.addEventListener('click', ()=> openInfo(c));
      itemsEl.appendChild(el);
    });
    hudSlots.textContent = selected.length + '/' + MAX_SLOTS;
    finalizeBtn.disabled = selected.length === 0;
  }

  function openInfo(c){
    activeCandidate = c;
    const isSelected = selected.includes(c.id);
    document.getElementById('info-emoji').innerHTML = `<img src="${c.image}" alt="">`;
    document.getElementById('info-name').textContent = c.name;
    document.getElementById('info-role').textContent = c.role;
    document.getElementById('info-desc').textContent = c.desc;
    const chipsEl = document.getElementById('info-chips');
    chipsEl.innerHTML = Object.entries(c.stats)
      .filter(([k,v])=> v > 0)
      .sort((a,b)=> b[1]-a[1])
      .map(([k,v])=> `<span class="stat-chip">${statLabel(k)} +${v}</span>`)
      .join('');
    const btn = document.getElementById('info-select-btn');
    btn.classList.toggle('selected', isSelected);
    btn.textContent = isSelected ? 'BATALKAN' : 'PILIH';
    btn.disabled = !isSelected && selected.length >= MAX_SLOTS;
    infoModal.classList.add('show');
  }
  function closeInfo(){ infoModal.classList.remove('show'); activeCandidate = null; }

  function statLabel(k){
    return { tech:'💻 TEK', data:'💾 DATA', biz:'🏛️ BISNIS', change:'📢 PERUB', lead:'🧭 KEPIM' }[k] || k;
  }

  document.getElementById('info-close-btn').addEventListener('click', closeInfo);
  document.getElementById('info-select-btn').addEventListener('click', ()=>{
    if(!activeCandidate) return;
    const id = activeCandidate.id;
    if(selected.includes(id)){
      selected = selected.filter(x=> x !== id);
    } else {
      if(selected.length >= MAX_SLOTS){
        showToast('⚠ SLOT PENUH', 'Maksimal 5 anggota tim. Batalkan salah satu dulu.');
        return;
      }
      selected.push(id);
    }
    renderGrid();
    closeInfo();
  });

  function showToast(t1, t2){
    document.getElementById('toast-t1').textContent = t1;
    document.getElementById('toast-t2').textContent = t2;
    toastEl.classList.add('show');
    setTimeout(()=> toastEl.classList.remove('show'), 2000);
  }

  function computeSynergy(){
    const total = { tech:0, data:0, biz:0, change:0, lead:0 };
    selected.forEach(id=>{
      const c = candidates.find(x=> x.id === id);
      Object.keys(total).forEach(k=> total[k] += c.stats[k]);
    });
    return total;
  }

  function setBar(key, value){
    document.getElementById('v-'+key).textContent = value;
    const pct = Math.min(100, Math.round((value/10)*100));
    document.getElementById('v-'+key).parentElement; // no-op keep structure
    setTimeout(()=>{ document.getElementById('b-'+key).style.width = pct + '%'; }, 50);
  }

  function finalize(){
    const total = computeSynergy();
    document.getElementById('team-list').innerHTML = selected
      .map(id=> candidates.find(c=> c.id===id))
      .map(c=> `<span><img src="${c.image}" alt="">${c.name}</span>`).join('');

    setBar('tech', total.tech);
    setBar('data', total.data);
    setBar('biz', total.biz);
    setBar('change', total.change);
    setBar('lead', total.lead);

    const dims = [
      { key:'Technology', v: total.tech },
      { key:'Data', v: total.data },
      { key:'Business', v: total.biz },
      { key:'Change', v: total.change },
      { key:'Leadership', v: total.lead },
    ];
    const weak = dims.filter(d=> d.v < 5);
    const verdictEl = document.getElementById('verdict');
    const flavorEl = document.getElementById('report-flavor');
    if(selected.length === MAX_SLOTS && weak.length === 0){
      verdictEl.textContent = 'TIM SIAP ✓';
      verdictEl.className = 'ready';
      flavorEl.textContent = 'Tim ini punya kombinasi kompetensi teknis dan non-teknis yang seimbang — bukan cuma programmer, tapi juga orang yang paham proses bisnis, perubahan, dan kepemimpinan proyek.';
    } else {
      verdictEl.textContent = '⚠️ KEKURANGAN SUMBER DAYA KRITIS';
      verdictEl.className = 'gap';
      const weakNames = weak.map(d=> d.key).join(', ') || 'beberapa area';
      flavorEl.textContent = `Timmu terlalu berat sebelah. Area yang lemah: ${weakNames}. Proyek integrasi butuh lebih dari sekadar kemampuan teknis — kalau sisi bisnis, perubahan, atau kepemimpinan diabaikan, implementasi bisa gagal walau sistemnya sendiri berjalan baik.`;
    }

    state.completed = state.completed || {};
    state.completed.quest4 = true;
    state.team = selected;
    state.synergy = total;
    saveState();

    recruitPanel.classList.remove('show');
    reportEl.classList.add('show');
  }

  document.getElementById('enter-btn').addEventListener('click', ()=>{
    introEl.style.display = 'none';
    playerImg.src = PLAYER_NORMAL;
    recruitPanel.classList.add('show');
  });
  finalizeBtn.addEventListener('click', finalize);
  nextBtn.addEventListener('click', ()=> {
    window.location.href = 'quest5.html';
  });

  loadState().then(renderGrid);
})();