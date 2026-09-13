(function(){
  const MUSIC_SRC = 'music/music.mp3';
  const PREF_KEY = 'pi_music_on';

  const audio = document.createElement('audio');
  audio.id = 'bg-music';
  audio.src = MUSIC_SRC;
  audio.loop = false;
  audio.volume = 0.35;
  audio.preload = 'auto';
  document.body.appendChild(audio);

  function getProgress(){
    try{
      const raw = sessionStorage.getItem('pi_music_progress');
      if(raw === null || raw === '') return null;
      const value = Number(raw);
      return Number.isFinite(value) ? value : null;
    }catch(e){ return null; }
  }

  function saveProgress(){
    try{
      if(Number.isFinite(audio.currentTime)){
        sessionStorage.setItem('pi_music_progress', String(audio.currentTime));
      }
    }catch(e){}
  }

  const savedProgress = getProgress();
  if(savedProgress !== null){
    audio.currentTime = savedProgress;
  }

  audio.addEventListener('timeupdate', saveProgress);
  window.addEventListener('beforeunload', saveProgress);
  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState === 'hidden') saveProgress();
  });

  const btn = document.createElement('button');
  btn.id = 'music-toggle-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Toggle musik');

  const hud = document.querySelector('#hud');
  if (hud) {
    const anchor = hud.querySelector('.budget, .slots, #hud-day');
    if (anchor) {
      hud.insertBefore(btn, anchor);
    } else {
      hud.appendChild(btn);
    }
  } else {
    document.body.appendChild(btn);
  }

  function getPref(){
    try{ return localStorage.getItem(PREF_KEY); }catch(e){ return null; }
  }
  function setPref(v){
    try{ localStorage.setItem(PREF_KEY, v); }catch(e){}
  }

  // default ON the first time; after that, respect the user's last choice
  let musicOn = getPref();
  if(musicOn === null) musicOn = 'on';

  function updateBtn(){
    btn.textContent = musicOn === 'on' ? '🔊' : '🔇';
    btn.title = musicOn === 'on' ? 'Matikan musik' : 'Nyalakan musik';
  }

  function safePlay(){
    const saved = getProgress();
    if(saved !== null && !audio.seeking && audio.currentTime < 0.5){
      audio.currentTime = saved;
    }
    const p = audio.play();
    if(p && typeof p.catch === 'function'){
      p.catch(()=>{ /* blocked until the user interacts with the page */ });
    }
  }

  function applyState(){
    if(musicOn === 'on'){
      safePlay();
    } else {
      audio.pause();
    }
  }

  updateBtn();
  applyState();

  btn.addEventListener('click', ()=>{
    musicOn = musicOn === 'on' ? 'off' : 'on';
    setPref(musicOn);
    updateBtn();
    applyState();
  });

  // Most browsers block autoplay with sound until the user interacts with
  // the page at least once — resume playback on the very first interaction
  // if the user's saved preference was "on".
  function resumeOnInteract(){
    if(musicOn === 'on' && audio.paused){
      safePlay();
    }
    document.removeEventListener('click', resumeOnInteract);
    document.removeEventListener('touchstart', resumeOnInteract);
    document.removeEventListener('keydown', resumeOnInteract);
  }
  document.addEventListener('click', resumeOnInteract);
  document.addEventListener('touchstart', resumeOnInteract);
  document.addEventListener('keydown', resumeOnInteract);
})();
