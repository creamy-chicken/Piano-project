const scrollMeter = document.querySelector(".scroll-meter");
const revealItems = document.querySelectorAll("[data-reveal]");
const canvas = document.querySelector("#heroCanvas");
const ctx = canvas?.getContext("2d");
const pianoModel = document.querySelector("[data-piano-model]");
const pianoImage = document.querySelector("[data-piano-image]");
const pianoButtons = document.querySelectorAll("[data-key-index]");
const currentNote = document.querySelector("[data-current-note]");
const currentFrequency = document.querySelector("[data-current-frequency]");

const state = {
  width: 0,
  height: 0,
  pointerX: 0.5,
  pointerY: 0.5,
  time: 0,
};

const pianoKeyCount = 8;
const pianoOffImage = "assets/piano/off.jpg";
const pianoNotes = [
  { name: "C4", frequency: 261.63, image: "assets/piano/key1.jpg" },
  { name: "D4", frequency: 293.66, image: "assets/piano/key2.jpg" },
  { name: "E4", frequency: 329.63, image: "assets/piano/key3.jpg" },
  { name: "F4", frequency: 349.23, image: "assets/piano/key4.jpg" },
  { name: "G4", frequency: 392.0, image: "assets/piano/key5.jpg" },
  { name: "A4", frequency: 440.0, image: "assets/piano/key6.jpg" },
  { name: "B4", frequency: 493.88, image: "assets/piano/key7.jpg" },
  { name: "C5", frequency: 523.27, image: "assets/piano/key8.jpg" },
];
const AudioContextClass = window.AudioContext || window.webkitAudioContext;

let audioContext;
let pianoReleaseTimer;
let startupTuneIndex = 0;
let startupTuneTimer;
let startupTuneHasRun = false;

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.16 }
);

revealItems.forEach((item) => revealObserver.observe(item));

function updateScrollUi() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
  scrollMeter.style.width = `${progress * 100}%`;
}

function resizeCanvas() {
  if (!canvas || !ctx) {
    return;
  }

  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  state.width = canvas.clientWidth;
  state.height = canvas.clientHeight;
  canvas.width = Math.floor(state.width * ratio);
  canvas.height = Math.floor(state.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function drawRoundedRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawHero() {
  if (!canvas || !ctx) {
    return;
  }

  const { width, height, pointerX, pointerY, time } = state;
  ctx.clearRect(0, 0, width, height);

  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#101315");
  background.addColorStop(0.5, "#26312f");
  background.addColorStop(1, "#151719");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.34;
  ctx.strokeStyle = "#6ff0d1";
  ctx.lineWidth = 1;

  const gridSize = 54;
  const driftX = ((time * 16) % gridSize) - gridSize;
  const driftY = ((time * 10) % gridSize) - gridSize;

  for (let x = driftX; x < width + gridSize; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + pointerX * 24, height);
    ctx.stroke();
  }

  for (let y = driftY; y < height + gridSize; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y + pointerY * 18);
    ctx.stroke();
  }
  ctx.restore();

  const boardW = Math.min(width * 0.34, 420);
  const boardH = boardW * 0.62;
  const boardX = width * (0.62 + (pointerX - 0.5) * 0.04);
  const boardY = height * (0.22 + (pointerY - 0.5) * 0.03);

  ctx.save();
  ctx.translate(boardX, boardY);
  ctx.rotate(-0.14);
  drawRoundedRect(0, 0, boardW, boardH, 8);
  ctx.fillStyle = "#0f766e";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  drawRoundedRect(boardW * 0.18, boardH * 0.18, boardW * 0.34, boardH * 0.44, 6);
  ctx.fill();

  ctx.fillStyle = "#f3bd3f";
  for (let i = 0; i < pianoKeyCount; i += 1) {
    ctx.beginPath();
    ctx.arc(boardW * 0.72, boardH * 0.16 + i * boardH * 0.058, 3.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const baseY = height * 0.74;
  const keyGap = Math.max(5, width * 0.006);
  const keyW = Math.min(78, (width * 0.72) / pianoKeyCount);
  const pianoW = pianoKeyCount * keyW + (pianoKeyCount - 1) * keyGap;
  const startX = width * 0.55 - pianoW / 2 + (pointerX - 0.5) * 24;

  for (let i = 0; i < pianoKeyCount; i += 1) {
    const pulse = Math.sin(time * 2.2 + i * 0.8) * 0.5 + 0.5;
    const x = startX + i * (keyW + keyGap);
    const h = height * (0.28 + pulse * 0.028);
    drawRoundedRect(x, baseY - h, keyW, h, 5);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.78 + pulse * 0.14})`;
    ctx.fill();
    ctx.fillStyle = "rgba(22, 22, 22, 0.12)";
    ctx.fillRect(x, baseY - 18, keyW, 18);
  }

  ctx.save();
  ctx.globalAlpha = 0.7;
  const wireColors = ["#d8422f", "#4267d6", "#f3bd3f", "#6ff0d1"];
  for (let i = 0; i < pianoKeyCount; i += 1) {
    const fromX = boardX + Math.cos(-0.14) * boardW * 0.1;
    const fromY = boardY + boardH * (0.24 + i * 0.055);
    const toX = startX + i * (keyW + keyGap) + keyW * 0.5;
    const toY = baseY - height * 0.25;
    ctx.strokeStyle = wireColors[i % wireColors.length];
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.bezierCurveTo(width * 0.62, height * 0.52 + i * 7, width * 0.5, height * 0.54 - i * 3, toX, toY);
    ctx.stroke();
  }
  ctx.restore();

  state.time += 0.012;
  requestAnimationFrame(drawHero);
}

function getAudioContext() {
  if (!AudioContextClass) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  return audioContext;
}

function createBuzzerCurve(amount = 72) {
  const samples = 512;
  const curve = new Float32Array(samples);

  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
  }

  return curve;
}

function preloadPianoImages() {
  [pianoOffImage, ...pianoNotes.map((note) => note.image)].forEach((src) => {
    const image = new Image();
    image.src = src;
  });
}

function playBuzzerTone(frequency) {
  const context = getAudioContext();

  if (!context) {
    if (currentFrequency) {
      currentFrequency.textContent = "Audio is not supported in this browser";
    }
    return;
  }

  if (context.state === "suspended") {
    context
      .resume()
      .then(() => {
        if (context.state === "running") {
          playBuzzerTone(frequency);
        }
      })
      .catch(() => {});
    return;
  }

  if (context.state !== "running") {
    return;
  }

  const now = context.currentTime;
  const carrier = context.createOscillator();
  const rasp = context.createOscillator();
  const pulse = context.createOscillator();
  const pulseDepth = context.createGain();
  const raspGain = context.createGain();
  const shaper = context.createWaveShaper();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();

  carrier.type = "square";
  carrier.frequency.setValueAtTime(frequency, now);
  rasp.type = "sawtooth";
  rasp.frequency.setValueAtTime(frequency * 2.03, now);
  pulse.type = "square";
  pulse.frequency.setValueAtTime(42, now);
  pulseDepth.gain.setValueAtTime(5, now);
  raspGain.gain.setValueAtTime(0.28, now);
  shaper.curve = createBuzzerCurve();
  shaper.oversample = "none";
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(Math.min(frequency * 3.3, 2400), now);
  filter.Q.setValueAtTime(2.8, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.34, now + 0.008);
  gain.gain.setValueAtTime(0.3, now + 0.16);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);

  pulse.connect(pulseDepth);
  pulseDepth.connect(carrier.frequency);
  pulseDepth.connect(rasp.frequency);
  carrier.connect(shaper);
  rasp.connect(raspGain);
  raspGain.connect(shaper);
  shaper.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);

  carrier.start(now);
  rasp.start(now);
  pulse.start(now);
  carrier.stop(now + 0.36);
  rasp.stop(now + 0.36);
  pulse.stop(now + 0.36);

  carrier.addEventListener("ended", () => {
    carrier.disconnect();
    rasp.disconnect();
    pulse.disconnect();
    pulseDepth.disconnect();
    raspGain.disconnect();
    shaper.disconnect();
    filter.disconnect();
    gain.disconnect();
  });
}

function setActivePianoKey(index) {
  const note = pianoNotes[index];

  if (!note) {
    return;
  }

  if (pianoImage) {
    pianoImage.src = note.image;
  }

  if (currentNote) {
    currentNote.textContent = note.name;
  }

  if (currentFrequency) {
    currentFrequency.textContent = `${note.frequency.toFixed(2)} Hz`;
  }

  pianoButtons.forEach((button) => {
    const isActive = Number(button.dataset.keyIndex) === index;
    button.classList.toggle("is-active", isActive);
  });

  window.clearTimeout(pianoReleaseTimer);
  pianoReleaseTimer = window.setTimeout(() => {
    if (pianoImage) {
      pianoImage.src = pianoOffImage;
    }

    pianoButtons.forEach((button) => button.classList.remove("is-active"));
  }, 520);
}

function playPianoKey(index, options = {}) {
  const note = pianoNotes[index];

  if (!note) {
    return;
  }

  setActivePianoKey(index);

  if (options.sound !== false) {
    playBuzzerTone(note.frequency);
  }
}

function stopStartupTune() {
  window.clearTimeout(startupTuneTimer);
  startupTuneTimer = undefined;
}

function playStartupTuneStep() {
  if (startupTuneIndex >= pianoNotes.length) {
    return;
  }

  setActivePianoKey(startupTuneIndex);
  startupTuneIndex += 1;

  if (startupTuneIndex < pianoNotes.length) {
    startupTuneTimer = window.setTimeout(playStartupTuneStep, 380);
  }
}

function startStartupTune() {
  if (!pianoModel || startupTuneHasRun) {
    return;
  }

  stopStartupTune();
  startupTuneHasRun = true;
  startupTuneIndex = 0;
  startupTuneTimer = window.setTimeout(playStartupTuneStep, 450);
}

function setupInteractivePiano() {
  if (!pianoModel) {
    return;
  }

  preloadPianoImages();

  pianoButtons.forEach((button) => {
    button.addEventListener("click", () => {
      stopStartupTune();
      playPianoKey(Number(button.dataset.keyIndex));
    });
  });

  window.addEventListener("keydown", (event) => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    const numberKey = Number(event.key);

    if (numberKey >= 1 && numberKey <= pianoKeyCount) {
      event.preventDefault();
      stopStartupTune();
      playPianoKey(numberKey - 1);
      pianoButtons[numberKey - 1]?.focus({ preventScroll: true });
    }
  });

  window.setTimeout(startStartupTune, 350);
}

function setupProcessCarousels() {
  document.querySelectorAll("[data-carousel]").forEach((carousel) => {
    const slides = Array.from(carousel.querySelectorAll(".carousel-frame img, .carousel-frame video"));
    const previous = carousel.querySelector("[data-carousel-previous]");
    const next = carousel.querySelector("[data-carousel-next]");
    let activeIndex = Math.max(
      0,
      slides.findIndex((slide) => slide.classList.contains("is-active"))
    );

    function showSlide(index) {
      activeIndex = (index + slides.length) % slides.length;
      slides.forEach((slide, slideIndex) => {
        slide.classList.toggle("is-active", slideIndex === activeIndex);
        if (slideIndex !== activeIndex && slide.tagName === "VIDEO") {
          slide.pause();
        }
      });
    }

    previous?.addEventListener("click", () => showSlide(activeIndex - 1));
    next?.addEventListener("click", () => showSlide(activeIndex + 1));
  });
}

window.addEventListener("scroll", updateScrollUi, { passive: true });
window.addEventListener("resize", resizeCanvas);
window.addEventListener("pointermove", (event) => {
  state.pointerX = event.clientX / window.innerWidth;
  state.pointerY = event.clientY / window.innerHeight;
});

resizeCanvas();
updateScrollUi();
setupInteractivePiano();
setupProcessCarousels();
drawHero();
