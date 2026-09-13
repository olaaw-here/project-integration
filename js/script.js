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
  const dialogueEl = document.getElementById('dialogue-text');
  const speakerEl = document.getElementById('speaker');
  const nextCue = document.getElementById('next-cue');
  const skipHint = document.getElementById('skip-hint');
  const choicesEl = document.getElementById('choices');
  const bannerEl = document.getElementById('banner');
  const resultEl = document.getElementById('result');
  const titleCard = document.getElementById('title-card');
  const startBtn = document.getElementById('start-btn');
  const hudBudget = document.getElementById('hud-budget');
  const budgetCount = document.getElementById('budget-count');
  const nextBtn = document.getElementById('next-btn');
  const cue = document.getElementById('cue');

  let state = { budget: 0, trust: 100, quest1_attempts: 0, completed: {} };

  const playerImg = document.getElementById('player-img');
  const rektorImg = document.getElementById('rektor-img');
  const playerChar = document.getElementById('player-char');
  const rektorChar = document.getElementById('rektor-char');

    const PLAYER_NORMAL = 'images/player-normal.png';
    const PLAYER_TALK = 'images/player-ngomong.png';
    const PLAYER_ANGRY = 'images/player-dimarahin.png';
    const REKTOR_NORMAL = 'images/rektor-normal.png';
    const REKTOR_TALK = 'images/rektor-ngomong.png';
    const REKTOR_ANGRY = 'images/rektor-marah.png';

  function setPlayer(mood){
    playerImg.src = mood === 'talk' ? PLAYER_TALK : mood === 'angry' ? PLAYER_ANGRY : PLAYER_NORMAL;
  }
  function setRektor(mood){
    rektorImg.src = mood === 'talk' ? REKTOR_TALK : mood === 'angry' ? REKTOR_ANGRY : REKTOR_NORMAL;
  }
  setPlayer('normal');
  setRektor('normal');

  function formatRp(n){
    return 'Rp ' + n.toLocaleString('id-ID');
  }

  async function loadState(){
    try{
      const res = await storageGet(STORAGE_KEY);
      if(res && res.value){
        state = Object.assign(state, JSON.parse(res.value));
      }
    }catch(e){ /* no saved state yet */ }
    hudBudget.textContent = formatRp(state.budget);
    // Quest 1 selalu dimainkan ulang dari awal (title card)
  }

  async function saveState(){
    try{ await storageSet(STORAGE_KEY, JSON.stringify(state)); }
    catch(e){ console.error('save failed', e); }
  }

  function showAlreadyDone(){
    titleCard.style.display = 'none';
    budgetCount.textContent = formatRp(state.budget);
    resultEl.classList.add('show');
    document.querySelector('#result h1').textContent = 'QUEST 01 — ALREADY COMPLETE';
    // enable navigation to Quest 02
    nextBtn.classList.remove('locked');
    nextBtn.addEventListener('click', ()=> { window.location.href = 'quest2.html'; });
  }

  // ---- typewriter ----
  let typing = false, currentLine = '', charIndex = 0, typeTimer = null;
  function typeLine(text, speaker, onDone){
    speakerEl.textContent = speaker;
    dialogueEl.textContent = '';
    currentLine = text; charIndex = 0; typing = true;
    nextCue.style.visibility = 'hidden';
    clearInterval(typeTimer);
    typeTimer = setInterval(()=>{
      charIndex++;
      dialogueEl.textContent = currentLine.slice(0, charIndex);
      if(charIndex >= currentLine.length){
        clearInterval(typeTimer);
        typing = false;
        nextCue.style.visibility = 'visible';
        if(onDone) onDone();
      }
    }, 18);
  }
  function finishTyping(){
    clearInterval(typeTimer);
    dialogueEl.textContent = currentLine;
    typing = false;
    nextCue.style.visibility = 'visible';
  }

  // ---- dialogue script ----
  const script = [
    { speaker:'NARATOR', text:'Kamu dipanggil untuk bertemu Rektor. Beliau mengatakan, ada dokumen anggaran yang belum ditandatangani.' },
    { speaker:'REKTOR', text:'Saya punya anggaran untuk proyek integrasi sistem ini. Tapi sebelum saya menyetujuinya, saya ingin tahu satu hal.' },
    { speaker:'REKTOR', text:'Mengapa universitas ini harus melakukan proyek ini?' },
    { speaker:'NARATOR', text:'Susun jawabanmu. Pilih tujuan strategis yang paling tepat untuk meyakinkan Rektor.' },
  ];
  let scriptIndex = 0;

  function advance(){
    if(typing){ finishTyping(); return; }
    scriptIndex++;
    if(scriptIndex < script.length){
      const line = script[scriptIndex];
      typeLine(line.text, line.speaker);
      cue.style.display = line.speaker === 'REKTOR' ? 'flex' : 'none';
      if(line.speaker === 'REKTOR'){ setRektor('talk'); setPlayer('normal'); }
      else { setRektor('normal'); setPlayer('normal'); }
    } else {
      showChoices();
    }
  }

  document.getElementById('dialogue-box').addEventListener('click', ()=>{
    if(choicesEl.classList.contains('show')) return;
    advance();
  });

  // ---- choices ----
  const options = [
    { key:'A', text:'Mengganti aplikasi lama dengan aplikasi yang lebih modern', correct:false,
      rebuttal:'Rektor mengernyit. "Saya tanya soal alasan bisnisnya."' },
    { key:'B', text:'Mengintegrasikan data dan proses akademik untuk meningkatkan efisiensi dan kualitas layanan', correct:true },
    { key:'C', text:'Membuat universitas terlihat lebih digital', correct:false,
      rebuttal:'Rektor menggeleng. "Citra bukan alasan yang cukup kuat untuk anggaran sebesar ini."' },
    { key:'D', text:'Mengikuti universitas lain yang sudah menggunakan sistem terintegrasi', correct:false,
      rebuttal:'Rektor menghela napas. "Ikut-ikutan bukan strategi."' },
  ];

  function showChoices(){
    dialogueEl.textContent = 'Pilih jawabanmu:';
    speakerEl.textContent = 'PILIHAN';
    nextCue.style.visibility = 'hidden';
    skipHint.style.visibility = 'hidden';
    cue.style.display = 'none';
    choicesEl.innerHTML = '';
    options.forEach(opt=>{
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.innerHTML = `<span class="tag">${opt.key}</span>${opt.text}`;
      btn.addEventListener('click', ()=> handleChoice(opt, btn));
      choicesEl.appendChild(btn);
    });
    choicesEl.classList.add('show');
  }

  function handleChoice(opt, btn){
    const allBtns = document.querySelectorAll('.choice-btn');
    allBtns.forEach(b=> b.disabled = true);
    state.quest1_attempts++;

    // player states their answer
    setPlayer('talk');
    setRektor('normal');

    if(opt.correct){
      setTimeout(()=>{ setRektor('talk'); }, 350);
      btn.classList.add('correct');
      showBanner('✨ STRATEGIC ALIGNMENT ACHIEVED!', 'APPROVED ✓', false);
      state.budget += 5000000000;
      state.completed.quest1 = true;
      saveState();
      setTimeout(()=>{
        bannerEl.classList.remove('show');
        choicesEl.classList.remove('show');
        showResult();
      }, 1600);
    } else {
      setTimeout(()=>{
        setRektor('angry');
        setPlayer('angry');
        rektorChar.classList.add('shake');
        setTimeout(()=> rektorChar.classList.remove('shake'), 350);
      }, 350);
      btn.classList.add('wrong');
      showBanner('⚠ NOT QUITE', opt.rebuttal, true);
      setTimeout(()=>{
        bannerEl.classList.remove('show');
        btn.classList.remove('wrong');
        allBtns.forEach(b=> b.disabled = false);
        setPlayer('normal');
        setRektor('normal');
      }, 2200);
    }
  }

  function showBanner(title, sub, isWrong){
    document.getElementById('banner-title').textContent = title;
    document.getElementById('banner-sub').textContent = sub;
    bannerEl.classList.toggle('wrong', !!isWrong);
    bannerEl.classList.add('show');
  }

  function showResult(){
    resultEl.classList.add('show');
    hudBudget.textContent = formatRp(state.budget);
    // animate budget counter
    let n = 0; const target = 5000000000; const step = target/40;
    const t = setInterval(()=>{
      n += step;
      if(n >= target){ n = target; clearInterval(t); }
      budgetCount.textContent = formatRp(Math.round(n));
    }, 20);
    // enable navigation to Quest 02
    nextBtn.classList.remove('locked');
    nextBtn.addEventListener('click', ()=> { window.location.href = 'quest2.html'; });
  }

  startBtn.addEventListener('click', ()=>{
    titleCard.style.display = 'none';
    setPlayer('normal'); setRektor('normal');
    typeLine(script[0].text, script[0].speaker);
  });

  document.addEventListener('keydown', (e)=>{
    if(e.code === 'Space' || e.code === 'Enter'){
      if(titleCard.style.display !== 'none'){ startBtn.click(); }
      else if(!choicesEl.classList.contains('show')) advance();
    }
  });

  loadState();
})();