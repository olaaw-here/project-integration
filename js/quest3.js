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
  const PLAYER_ANGRY  = 'images/player-dimarahin.png';

  let state = { budget:0, trust:100, completed:{} };
  let playerHP = 100;
  const PLAYER_MAX_HP = 100;
  const MONSTER_MAX_HP = 40;
  const HIT_DAMAGE = 40;
  const PLAYER_DAMAGE = 25;
  let monsterIndex = 0;
  let monsterHP = MONSTER_MAX_HP;
  let awaitingAnswer = false;

  const MONSTER_IMG = 'images/monster.png';
  const monsters = [
    {
      name:'KEGAGALAN MIGRASI DATA', emoji:'🗃️',
      line:'"Data dari sistem lama memiliki format berbeda!"',
      risk:'Risiko Migrasi Data',
      options:[
        { key:'A', text:'Migrasikan seluruh data sekaligus', correct:false, reply:'Migrasi ngawur tanpa validasi — data korup di tengah jalan!' },
        { key:'B', text:'Lakukan pemetaan data, pembersihan, pengujian, dan validasi', correct:true, reply:'Pendekatan sistematis. Risiko migrasi berhasil ditekan.' },
        { key:'C', text:'Abaikan data lama', correct:false, reply:'Data lama tetap dibutuhkan — mengabaikannya bukan solusi.' },
      ]
    },
    {
      name:'RESISTENSI TERHADAP PERUBAHAN', emoji:'😤',
      line:'"Dosen dan staf menolak menggunakan sistem baru!"',
      risk:'Risiko Resistensi Perubahan',
      options:[
        { key:'A', text:'Paksa semua pengguna memakainya', correct:false, reply:'Paksaan tanpa pendekatan hanya menambah resistensi.' },
        { key:'B', text:'Pelatihan + komunikasi + keterlibatan pemangku kepentingan', correct:true, reply:'Pengguna merasa dilibatkan. Resistensi mulai mereda.' },
        { key:'C', text:'Biarkan mereka tetap pakai sistem lama', correct:false, reply:'Kalau dibiarkan, sistem baru tidak akan pernah terpakai.' },
      ]
    },
    {
      name:'ANGGARAN MELEBIHI ESTIMASI', emoji:'💸',
      line:'"Biaya proyek ternyata lebih besar dari estimasi!"',
      risk:'Risiko Pembengkakan Anggaran',
      options:[
        { key:'A', text:'Tambah pengeluaran tanpa evaluasi', correct:false, reply:'Menambah biaya tanpa evaluasi hanya memperbesar lubang anggaran.' },
        { key:'B', text:'Pemantauan biaya + prioritas + cadangan', correct:true, reply:'Anggaran kembali terkendali dengan cadangan yang jelas.' },
        { key:'C', text:'Kurangi pengujian untuk menghemat biaya', correct:false, reply:'Mengorbankan pengujian hanya memindahkan risiko ke tahap produksi.' },
      ]
    },
    {
      name:'PELANGGARAN KEAMANAN', emoji:'🔓',
      line:'"Ditemukan celah keamanan pada sistem yang baru terintegrasi!"',
      risk:'Risiko Keamanan',
      options:[
        { key:'A', text:'Abaikan karena sistem baru saja diluncurkan', correct:false, reply:'Celah yang dibiarkan terbuka adalah undangan untuk serangan berikutnya.' },
        { key:'B', text:'Audit keamanan, perbaiki celah, dan perkuat kontrol akses', correct:true, reply:'Celah keamanan berhasil ditutup sebelum dieksploitasi.' },
        { key:'C', text:'Matikan seluruh sistem tanpa investigasi', correct:false, reply:'Mematikan sistem tanpa investigasi hanya menunda masalah, bukan menyelesaikannya.' },
      ]
    },
  ];
  const mitigated = [];

  const gameEl = document.getElementById('game');
  const playerImg = document.getElementById('player-img');
  const playerFighter = document.getElementById('player-fighter');
  const monsterFighter = document.getElementById('monster-fighter');
  const monsterEmoji = document.getElementById('monster-emoji');
  const monsterName = document.getElementById('monster-name');
  const monsterLine = document.getElementById('monster-line');
  const monsterHpLabel = document.getElementById('monster-hp-label');
  const choicesEl = document.getElementById('choices');
  const playerHpBar = document.getElementById('player-hp-bar');
  const playerHpNum = document.getElementById('player-hp-num');
  const monsterHpBar = document.getElementById('monster-hp-bar');
  const monsterHpNum = document.getElementById('monster-hp-num');
  const hudProgress = document.getElementById('hud-progress');
  const bannerEl = document.getElementById('banner');
  const introPanel = document.getElementById('intro-panel');
  const victoryPanel = document.getElementById('victory-panel');
  const failPanel = document.getElementById('fail-panel');

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

  function hpColor(pct){
    if(pct > 55) return 'var(--hp-good)';
    if(pct > 25) return 'var(--hp-mid)';
    return 'var(--hp-low)';
  }
  function updatePlayerHP(){
    const pct = Math.max(0, playerHP) / PLAYER_MAX_HP * 100;
    playerHpBar.style.width = pct + '%';
    playerHpBar.style.background = hpColor(pct);
    playerHpNum.textContent = Math.max(0, playerHP) + '/' + PLAYER_MAX_HP;
  }
  function updateMonsterHP(){
    const pct = Math.max(0, monsterHP) / MONSTER_MAX_HP * 100;
    monsterHpBar.style.width = pct + '%';
    monsterHpBar.style.background = hpColor(pct);
    monsterHpNum.textContent = Math.max(0, monsterHP) + '/' + MONSTER_MAX_HP;
  }

  function screenShake(){
    gameEl.classList.add('screenshake');
    setTimeout(()=> gameEl.classList.remove('screenshake'), 320);
  }
  function floatDamage(target, amount){
    const el = document.createElement('div');
    el.className = 'dmg-float ' + (target === 'monster' ? 'on-monster' : 'on-player');
    el.textContent = '-' + amount;
    document.getElementById('scene').appendChild(el);
    setTimeout(()=> el.remove(), 1000);
  }
  function showBanner(title, sub, isWrong){
    document.getElementById('banner-title').textContent = title;
    document.getElementById('banner-sub').textContent = sub;
    bannerEl.classList.toggle('wrong', !!isWrong);
    bannerEl.classList.add('show');
    setTimeout(()=> bannerEl.classList.remove('show'), 1500);
  }

  function loadMonster(idx){
    const m = monsters[idx];
    monsterHP = MONSTER_MAX_HP;
    updateMonsterHP();
    monsterEmoji.src = MONSTER_IMG;
    monsterName.textContent = m.name;
    monsterHpLabel.textContent = m.name;
    monsterLine.textContent = m.line;
    hudProgress.textContent = 'MONSTER ' + (idx+1) + ' / ' + monsters.length;
    monsterFighter.classList.remove('dying');
    monsterFighter.classList.add('entering');
    setTimeout(()=> monsterFighter.classList.remove('entering'), 500);
    renderChoices(m);
    playerImg.src = PLAYER_NORMAL;
  }

  function renderChoices(m){
    choicesEl.innerHTML = '';
    m.options.forEach(opt=>{
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.innerHTML = `<span class="tag">${opt.key}</span>${opt.text}`;
      btn.addEventListener('click', ()=> handleAnswer(opt, btn, m));
      choicesEl.appendChild(btn);
    });
    awaitingAnswer = true;
  }

  function handleAnswer(opt, btn, m){
    if(!awaitingAnswer) return;
    awaitingAnswer = false;
    const allBtns = document.querySelectorAll('.choice-btn');
    allBtns.forEach(b=> b.disabled = true);

    if(opt.correct){
      btn.classList.add('correct');
      playerImg.src = PLAYER_TALK;
      playerFighter.classList.add('lunge-right');
      setTimeout(()=>{
        monsterFighter.classList.add('hit-flash');
        screenShake();
        monsterHP -= HIT_DAMAGE;
        updateMonsterHP();
        floatDamage('monster', HIT_DAMAGE);
      }, 180);
      setTimeout(()=>{
        playerFighter.classList.remove('lunge-right');
        monsterFighter.classList.remove('hit-flash');
      }, 420);
      showBanner('⚔️ BENAR!', m.risk.toUpperCase() + ' -' + HIT_DAMAGE, false);
      mitigated.push(m.risk);

      setTimeout(()=>{
        monsterFighter.classList.add('dying');
        setTimeout(()=> nextMonster(), 550);
      }, 900);
    } else {
      btn.classList.add('wrong');
      monsterFighter.classList.add('lunge-left');
      setTimeout(()=>{
        playerFighter.classList.add('hit-flash');
        playerImg.src = PLAYER_ANGRY;
        screenShake();
        playerHP -= PLAYER_DAMAGE;
        updatePlayerHP();
        floatDamage('player', PLAYER_DAMAGE);
      }, 180);
      setTimeout(()=>{
        monsterFighter.classList.remove('lunge-left');
        playerFighter.classList.remove('hit-flash');
      }, 420);
      showBanner('💥 KEPUTUSAN SALAH!', opt.reply, true);

      setTimeout(()=>{
        state.dungeonHP = Math.max(0, playerHP);
        saveState();
        if(playerHP <= 0){
          showFail();
        } else {
          playerImg.src = PLAYER_NORMAL;
          allBtns.forEach(b=>{ b.disabled = false; });
          btn.classList.remove('wrong');
          awaitingAnswer = true;
        }
      }, 1600);
    }
  }

  function nextMonster(){
    monsterIndex++;
    if(monsterIndex >= monsters.length){
      showVictory();
    } else {
      loadMonster(monsterIndex);
    }
  }

  function persistFinalHP(){
    state.dungeonHP = Math.max(0, playerHP);
    state.completed = state.completed || {};
    state.completed.quest3 = true;
    saveState();
  }

  function showVictory(){
    document.getElementById('risk-summary').innerHTML =
      mitigated.map(r=> `<li>✅ ${r} — mitigated</li>`).join('');
    state.risksMitigated = mitigated;
    persistFinalHP();
    victoryPanel.classList.add('show');
  }

  function showFail(){
    persistFinalHP();
    failPanel.classList.add('show');
  }

  function resetDungeon(){
    playerHP = PLAYER_MAX_HP;
    monsterIndex = 0;
    mitigated.length = 0;
    updatePlayerHP();
    failPanel.classList.remove('show');
    loadMonster(0);
  }

  document.getElementById('start-btn').addEventListener('click', ()=>{
    introPanel.classList.remove('show');
    updatePlayerHP();
    loadMonster(0);
  });
  document.getElementById('retry-btn').addEventListener('click', resetDungeon);
  document.getElementById('next-btn').addEventListener('click', ()=>{
    state.dungeonHP = Math.max(0, playerHP);
    saveState();
    window.location.href = 'quest4.html';
  });

  loadState();
})();