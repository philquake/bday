/* ── DOM references ── */
const flameWraps = [
  document.getElementById('fw0'),
  document.getElementById('fw1'),
  document.getElementById('fw2'),
];
const levelBar      = document.getElementById('level-bar');
const micBtn        = document.getElementById('mic-btn');
const cakeWrap      = document.getElementById('cake-wrap');
const hintEl        = document.getElementById('hint');
const revealEl      = document.getElementById('reveal');
const simSlider     = document.getElementById('sim-slider');
const simBlowBtn    = document.getElementById('sim-blow');
const resetBtn      = document.getElementById('reset-btn');
const canvas        = document.getElementById('confetti-canvas');
const ctx           = canvas.getContext('2d');

/* ── State ── */
let blown         = false;
let blowLevel     = 0;
const BLOW_THRESHOLD = 0.6;

let audioCtx, analyser, micStream, animFrame;
let listening     = false;

let confettiPieces  = [];
let confettiRunning = false;

/* ── Canvas sizing ── */
function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

/* ── Flame helpers ── */
function setFlameForLevel(fw, level) {
  const flames = fw.querySelectorAll('.fl');
  const opacity = Math.max(0, 1 - level * 2.2);
  const shift   = level * 6;

  flames.forEach(f => {
    f.style.opacity   = opacity;
    f.style.transform = `scaleX(${1 - level * 0.5}) translateX(${shift}px)`;
  });

  fw.querySelector('.cglow').style.opacity = opacity;
}

function extinguishFlame(fw) {
  setFlameForLevel(fw, 1);
  fw.style.visibility = 'hidden';
}

function restoreFlame(fw) {
  fw.style.visibility = '';
  setFlameForLevel(fw, 0);
}

/* ── Smoke puffs ── */
function addSmoke(fw) {
  const smokeWrap = fw.querySelector('.smoke-wrap');

  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      const puff = document.createElement('div');
      puff.className = 'smoke-puff';
      const size = 14 + Math.random() * 12;
      puff.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        left: ${-size / 2 + (Math.random() - 0.5) * 12}px;
        top: 0;
      `;
      smokeWrap.appendChild(puff);
      setTimeout(() => puff.remove(), 1400);
    }, i * 180);
  }
}

/* ── Microphone ── */
async function toggleMic() {
  if (blown) return;

  if (!listening) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioCtx  = new (window.AudioContext || window.webkitAudioContext)();
      analyser  = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      audioCtx.createMediaStreamSource(micStream).connect(analyser);

      listening = true;
      micBtn.classList.add('listening');
      micBtn.textContent = '🎤 Listening… blow!';
      hintEl.innerHTML   = '<strong>Blow!</strong><br>Big steady breath — blow out all three candles!';

      listenLoop();
    } catch (e) {
      hintEl.innerHTML = 'Mic access denied. Use the slider below to simulate a blow.';
    }
  } else {
    stopMic();
  }
}

function listenLoop() {
  if (!listening) return;

  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteTimeDomainData(data);

  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += Math.abs(data[i] - 128);

  blowLevel = Math.min((sum / data.length / 128) * 4.2, 1);
  levelBar.style.width = (blowLevel * 100) + '%';
  flameWraps.forEach(fw => setFlameForLevel(fw, blowLevel));

  if (blowLevel > BLOW_THRESHOLD && !blown) {
    blowOut();
    return;
  }

  animFrame = requestAnimationFrame(listenLoop);
}

function stopMic() {
  listening = false;
  micBtn.classList.remove('listening');
  micBtn.textContent = '🎤 Hold to blow';

  if (micStream) micStream.getTracks().forEach(t => t.stop());
  if (audioCtx)  audioCtx.close();
  if (animFrame) cancelAnimationFrame(animFrame);
}

/* ── Blow-out sequence ── */
function blowOut() {
  blown = true;
  stopMic();
  levelBar.style.width = '0%';

  flameWraps.forEach((fw, i) => {
    setTimeout(() => {
      extinguishFlame(fw);
      addSmoke(fw);
    }, i * 150);
  });

  setTimeout(() => {
    startConfetti();
    cakeWrap.style.opacity   = '0';
    cakeWrap.style.transform = 'scale(0.85) translateY(16px)';
    hintEl.style.transition  = 'opacity .5s';
    hintEl.style.opacity     = '0';
    micBtn.style.display     = 'none';
    document.getElementById('level-bar-wrap').style.display = 'none';
    document.getElementById('sim-wrap').style.display       = 'none';
  }, 700);

  setTimeout(() => {
    cakeWrap.style.display = 'none';
    hintEl.style.display   = 'none';
    revealEl.style.display = 'flex';
  }, 1600);
}

/* ── Reset ── */
function resetCake() {
  blown         = false;
  blowLevel     = 0;
  confettiRunning = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  revealEl.style.display   = 'none';
  cakeWrap.style.display   = '';
  cakeWrap.style.opacity   = '1';
  cakeWrap.style.transform = '';

  flameWraps.forEach(fw => restoreFlame(fw));

  hintEl.style.display   = '';
  hintEl.style.opacity   = '1';
  hintEl.innerHTML       = '<strong>Make a wish!</strong><br>Click below and blow into your mic, or use the slider.';

  micBtn.style.display = '';
  document.getElementById('level-bar-wrap').style.display = '';
  document.getElementById('sim-wrap').style.display       = '';

  simSlider.value      = 0;
  levelBar.style.width = '0%';
}

/* ── Confetti ── */
function startConfetti() {
  const colors = [
    '#f472b6', '#60a5fa', '#34d399',
    '#fb923c', '#a78bfa', '#fbbf24',
    '#f87171', '#38bdf8',
  ];

  confettiPieces = Array.from({ length: 130 }, () => ({
    x:        Math.random() * canvas.width,
    y:        -10 - Math.random() * canvas.height * 0.3,
    r:        5 + Math.random() * 6,
    d:        2.2 + Math.random() * 3,
    color:    colors[Math.floor(Math.random() * colors.length)],
    rot:      Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.13,
    vx:       (Math.random() - 0.5) * 3.5,
    w:        8 + Math.random() * 9,
    h:        4 + Math.random() * 5,
    shape:    Math.random() > 0.45 ? 'rect' : 'circle',
  }));

  confettiRunning = true;
  drawConfetti();
}

function drawConfetti() {
  if (!confettiRunning) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let alive = 0;

  for (const p of confettiPieces) {
    p.y   += p.d;
    p.x   += p.vx;
    p.rot += p.rotSpeed;
    if (p.y < canvas.height + 20) alive++;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle   = p.color;
    ctx.globalAlpha = Math.min(1, (canvas.height - p.y + 80) / 100);

    if (p.shape === 'rect') {
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.r / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  if (alive > 0) {
    requestAnimationFrame(drawConfetti);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    confettiRunning = false;

    document.querySelectorAll('#revealContent, .reveal').forEach(el => {
    el.style.display = 'block';
  });
    }
}

/* ── Slider simulation ── */
simSlider.addEventListener('input', () => {
  blowLevel = simSlider.value / 100;
  levelBar.style.width = (blowLevel * 100) + '%';
  flameWraps.forEach(fw => setFlameForLevel(fw, blowLevel));
});

simBlowBtn.addEventListener('click', () => {
  if (blown) return;
  if (blowLevel > BLOW_THRESHOLD) {
    blowOut();
  } else {
    hintEl.innerHTML = '<strong>Not quite!</strong><br>Drag the slider higher and try again.';
  }
});

/* ── Mic button events ── */
micBtn.addEventListener('mousedown',  toggleMic);
micBtn.addEventListener('touchstart', e => { e.preventDefault(); toggleMic(); });
micBtn.addEventListener('mouseup',    () => { if (listening && !blown) stopMic(); });
micBtn.addEventListener('touchend',   () => { if (listening && !blown) stopMic(); });

/* ── Reset button ── */
resetBtn.addEventListener('click', resetCake);


