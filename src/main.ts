import './style.css'
import type { VisualizerData } from './types'
import { StateManager } from './state'
import { drawHexGrid } from './draw'

// UI Elements
const mapFileInput = document.getElementById('map-file') as HTMLInputElement;
const actionFileInput = document.getElementById('action-file') as HTMLInputElement;

const btnPlay = document.getElementById('btn-play') as HTMLButtonElement;
const btnPause = document.getElementById('btn-pause') as HTMLButtonElement;
const btnStepPrev = document.getElementById('btn-step-prev') as HTMLButtonElement;
const btnStepNext = document.getElementById('btn-step-next') as HTMLButtonElement;

const stepSlider = document.getElementById('step-slider') as HTMLInputElement;
const stepLabel = document.getElementById('step-label') as HTMLSpanElement;
const speedSlider = document.getElementById('speed-slider') as HTMLInputElement;

const canvas = document.getElementById('viz-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

let vizData: VisualizerData = {
  mapData: null,
  agentTypes: null,
  days: []
};
let stateManager: StateManager | null = null;

let isPlaying = false;
let currentStep = 0;
let totalSteps = 0;
let animationId = 0;

function init() {
  resizeCanvas();
  draw();
}

function resizeCanvas() {
  const container = document.getElementById('canvas-container')!;
  if (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight) {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
  }
}

function draw() {
  if (!stateManager) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Load Map Data JSON', canvas.width / 2, canvas.height / 2);
    return;
  }

  drawHexGrid(ctx, canvas, stateManager, currentStep);
}

window.addEventListener('resize', () => {
  resizeCanvas();
  draw();
});

function updateControls() {
  if (stateManager) {
    totalSteps = stateManager.getTotalSteps();
    stepSlider.max = totalSteps.toString();
    stepSlider.disabled = false;
  } else {
    stepSlider.disabled = true;
  }
  stepSlider.value = currentStep.toString();
  stepLabel.innerText = currentStep.toString();

  btnPlay.disabled = isPlaying;
  btnPause.disabled = !isPlaying;
}

function parseFile(file: File, callback: (data: any) => void) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      callback(data);
    } catch (err) {
      console.error("Parse Error", err);
      alert("Invalid JSON file");
    }
  };
  reader.readAsText(file);
}

mapFileInput.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    parseFile(file, (data) => {
      if (data.startsAt !== undefined) {
        vizData.mapData = data;
        stateManager = new StateManager(vizData);
        currentStep = 0;
        updateControls();
        draw();
      } else {
        alert("This doesn't look like Map configuration JSON.");
      }
    });
  }
});

actionFileInput.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    parseFile(file, (data) => {
      // Further parsing logic here based on data shape
      console.log("Loaded additional info", data);
    });
  }
});

// Playback Logic
btnPlay.addEventListener('click', () => {
  isPlaying = true;
  updateControls();

  let lastTime = performance.now();
  const loop = (time: number) => {
    if (!isPlaying) return;

    const speed = parseInt(speedSlider.value);
    const dt = time - lastTime;
    const delay = Math.max(16, 1000 - (speed * 9));

    if (dt > delay) {
      if (currentStep < totalSteps) {
        currentStep++;
        stepSlider.value = currentStep.toString();
        stepLabel.innerText = currentStep.toString();
        draw();
        lastTime = time;
      } else {
        isPlaying = false;
        updateControls();
        return;
      }
    }
    animationId = requestAnimationFrame(loop);
  };
  animationId = requestAnimationFrame(loop);
});

btnPause.addEventListener('click', () => {
  isPlaying = false;
  updateControls();
  cancelAnimationFrame(animationId);
});

btnStepNext.addEventListener('click', () => {
  if (currentStep < totalSteps) {
    currentStep++;
    updateControls();
    draw();
  }
});

btnStepPrev.addEventListener('click', () => {
  if (currentStep > 0) {
    currentStep--;
    updateControls();
    draw();
  }
});

stepSlider.addEventListener('input', (e) => {
  currentStep = parseInt((e.target as HTMLInputElement).value);
  stepLabel.innerText = currentStep.toString();
  draw();
});

init();
