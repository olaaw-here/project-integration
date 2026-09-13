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
  const DEFAULT_BUDGET = 5000000000;
  let state = { budget: DEFAULT_BUDGET, trust: 100, completed:{}, purchases:{} };

  const items = [
    { id:'training', icon:'🧑‍🏫', name:'Pelatihan Pengguna', cost:500000000,
      desc:'Invest ini untuk melatih dosen dan staff supaya nggak gagap pakai sistem baru — biar adopsinya lancar dan nggak banyak yang balik ke cara manual.',
      benefits:['Meningkatkan adopsi','Mengurangi resistensi'], trap:false },
    { id:'cleansing', icon:'🧹', name:'Pembersihan Data', cost:700000000,
      desc:'Invest ini untuk membersihkan dan merapikan data lama sebelum dipindah ke sistem baru — biar laporan dan keputusan nggak salah gara-gara data kotor.',
      benefits:['Meningkatkan kualitas data','Mengurangi kesalahan migrasi'], trap:false },
    { id:'infra', icon:'🖥️', name:'Infrastruktur', cost:1000000000,
      desc:'Invest ini untuk server dan jaringan yang lebih kuat — biar sistem nggak lemot atau down saat dipakai banyak orang sekaligus.',
      benefits:['Meningkatkan keandalan sistem','Mendukung skalabilitas'], trap:false },
    { id:'gedung', icon:'🏢', name:'Gedung Kantor Baru', cost:1500000000,
      desc:'Invest ini untuk gedung kantor yang lebih mewah dan nyaman.',
      benefits:['Kantor lebih nyaman', 'Terlihat modern'], trap:true,
      warn:'Kedengarannya enak, tapi ini nggak menyentuh proses, data, atau keberhasilan sistemnya sama sekali.' },
    { id:'logo', icon:'🎨', name:'Logo Universitas Baru', cost:300000000,
      desc:'Invest ini untuk mengganti logo universitas biar terlihat lebih "modern".',
      benefits:['Tampilan lebih segar'], trap:true,
      warn:'Bukan manfaat strategis — nggak berkaitan sama sekali dengan efisiensi proses atau kualitas layanan.' },
  ];

  const hudBudget = document.getElementById('hud-budget');
  const itemsEl = document.getElementById('items');
  const shopEl = document.getElementById('shop');
  const introEl = document.getElementById('intro');
  const toastEl = document.getElementById('toast');
  const reportEl = document.getElementById('report');
  const playerImg = document.getElementById('player-img');
  const cartBtn = document.getElementById('cart-btn');
  const cartBadge = document.getElementById('cart-badge');
  const cartNotif = document.getElementById('cart-notif');
  
  const PLAYER_NORMAL = 'images/player-normal.png';

  function formatRp(n){ return 'Rp ' + Math.round(n).toLocaleString('id-ID'); }

  async function loadState(){
    try{
      const res = await storageGet(STORAGE_KEY);
      if(res && res.value){ state = Object.assign(state, JSON.parse(res.value)); }
    }catch(e){ /* fresh state, use default budget */ }
    if(typeof state.budget !== 'number') state.budget = DEFAULT_BUDGET;
    state.purchases = state.purchases || {};
    hudBudget.textContent = formatRp(state.budget);
  }
  async function saveState(){
    try{ await storageSet(STORAGE_KEY, JSON.stringify(state)); }
    catch(e){ console.error('save failed', e); }
  }

  const infoModal = document.getElementById('info-modal');
  const infoCard = document.getElementById('info-card');
  let activeItem = null;

  function renderItems(){
    itemsEl.innerHTML = '';
    items.forEach(item=>{
      const bought = !!state.purchases[item.id];
      const el = document.createElement('div');
      el.className = 'icon-btn' + (item.trap ? ' trap' : '') + (bought ? ' bought' : '');
      el.innerHTML = `
        <span class="info-dot">ⓘ</span>
        <div class="emoji">${item.icon}</div>
        <div class="label">${item.name}</div>
        <div class="cost-tag">${formatRp(item.cost)}</div>
      `;
      el.addEventListener('click', ()=> openInfo(item));
      itemsEl.appendChild(el);
    });
  }

  function openInfo(item){
    activeItem = item;
    const bought = !!state.purchases[item.id];
    document.getElementById('info-emoji').textContent = item.icon;
    document.getElementById('info-name').textContent = item.name;
    document.getElementById('info-cost').textContent = formatRp(item.cost);
    document.getElementById('info-desc').textContent = item.desc;
    const warnEl = document.getElementById('info-warn');
    if(item.warn){ warnEl.textContent = '⚠ ' + item.warn; warnEl.style.display = 'block'; }
    else { warnEl.style.display = 'none'; }
    infoCard.classList.toggle('trap', !!item.trap);
    const buyBtn = document.getElementById('info-buy-btn');
    buyBtn.classList.toggle('bought', bought);
    buyBtn.textContent = bought ? 'DIBELI ✓' : 'BELI';
    buyBtn.disabled = bought || item.cost > state.budget;
    infoModal.classList.add('show');
  }
  function closeInfo(){ infoModal.classList.remove('show'); activeItem = null; }

  document.getElementById('info-close-btn').addEventListener('click', closeInfo);
  document.getElementById('info-buy-btn').addEventListener('click', ()=>{
    if(activeItem) buyItem(activeItem);
    closeInfo();
  });

  function buyItem(item){
    if(state.purchases[item.id]) return;
    if(item.cost > state.budget) return;
    state.budget -= item.cost;
    state.purchases[item.id] = true;
    hudBudget.textContent = formatRp(state.budget);
    renderItems();
    saveState();
    if(item.trap){
      showToast('⚠ BUKAN MANFAAT STRATEGIS', `Kamu menghabiskan ${formatRp(item.cost)} — manfaat proyek langsung: +0`);
      state.trust = Math.max(0, (state.trust ?? 100) - 10);
    }
  }

  function showToast(t1, t2){
    document.getElementById('toast-t1').textContent = t1;
    document.getElementById('toast-t2').textContent = t2;
    toastEl.classList.add('show');
    setTimeout(()=> toastEl.classList.remove('show'), 2000);
  }

  function computeMetrics(){
    const p = state.purchases;
    let pe=0, us=0, dq=0, ds=0;
    if(p.training){ pe+=10; us+=15; }
    if(p.infra){ pe+=20; us+=5; ds+=10; }
    if(p.cleansing){ dq+=25; ds+=10; }
    return { pe, us, dq, ds, total: pe+us+dq+ds };
  }

  function finalize(){
    const spentTotal = items.reduce((sum,it)=> sum + (state.purchases[it.id] ? it.cost : 0), 0);
    const m = computeMetrics();

    document.getElementById('r-budget').textContent = formatRp(spentTotal + state.budget);
    document.getElementById('r-spent').textContent = formatRp(spentTotal);
    document.getElementById('r-remaining').textContent = formatRp(state.budget);

    setBar('pe', m.pe, 30);
    setBar('us', m.us, 20);
    setBar('dq', m.dq, 25);
    setBar('ds', m.ds, 20);

    let n = 0;
    const target = m.total;
    const t = setInterval(()=>{
      n += 3;
      if(n >= target){ n = target; clearInterval(t); }
      document.getElementById('value-score').textContent = 'NILAI PROYEK: ' + n;
    }, 30);

    state.completed = state.completed || {};
    state.completed.quest2 = true;
    state.metrics = m;
    saveState();

    shopEl.classList.remove('show');
    reportEl.classList.add('show');
  }

  function setBar(key, value, max){
    document.getElementById('v-'+key).textContent = '+' + value;
    const pct = Math.min(100, Math.round((value/max)*100));
    setTimeout(()=>{ document.getElementById('b-'+key).style.width = pct + '%'; }, 50);
  }

  document.getElementById('enter-btn').addEventListener('click', ()=>{
    introEl.style.display = 'none';
    playerImg.src = PLAYER_NORMAL;
    setTimeout(()=> cartNotif.classList.add('show'), 700);
  });
  cartBtn.addEventListener('click', ()=>{
    cartNotif.classList.remove('show');
    cartBadge.style.display = 'none';
    shopEl.classList.toggle('show');
  });
  document.getElementById('finalize-btn').addEventListener('click', finalize);
  document.getElementById('next-btn').addEventListener('click', ()=> {
    window.location.href = 'quest3.html';
  });

  loadState().then(renderItems);
})();
