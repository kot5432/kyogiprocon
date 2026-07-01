import './style.css'
import { StateManager } from './state'
import { drawHexGrid } from './draw'
import type { VisualizerData } from './types'

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

// New UI Elements
const fuelGaugesContainer = document.getElementById('fuel-gauges') as HTMLDivElement;
const decisionPanel = document.getElementById('decision-panel') as HTMLDivElement;
const scoreCanvas = document.getElementById('score-canvas') as HTMLCanvasElement;
const scoreCtx = scoreCanvas.getContext('2d')!;
const ourScoreDisplay = document.getElementById('our-score') as HTMLSpanElement;
const opponentScoreDisplay = document.getElementById('opponent-score') as HTMLSpanElement;
const turnLogContainer = document.getElementById('turn-log') as HTMLDivElement;

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
  
  // Also resize score canvas
  if (scoreCanvas.width !== scoreCanvas.clientWidth || scoreCanvas.height !== scoreCanvas.clientHeight) {
    scoreCanvas.width = scoreCanvas.clientWidth;
    scoreCanvas.height = scoreCanvas.clientHeight;
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
  updateFuelGauges();
  updateDecisionPanel();
  updateScoreGraph();
  updateTurnLog();
}

function updateFuelGauges() {
  if (!stateManager) return;

  const numAgents = stateManager.data.mapData?.agents.length || 0;
  const fuelLimit = stateManager.getFuelLimit();

  fuelGaugesContainer.innerHTML = '';

  for (let agentId = 0; agentId < numAgents; agentId++) {
    const fuel = stateManager.getAgentFuel(currentStep, agentId);
    const agentType = stateManager.getAgentType(agentId, currentStep);
    const percentage = (fuel / fuelLimit) * 100;

    const gaugeDiv = document.createElement('div');
    gaugeDiv.className = 'fuel-gauge';

    const headerDiv = document.createElement('div');
    headerDiv.className = 'fuel-gauge-header';
    headerDiv.innerHTML = `
      <span>${agentType === 0 ? '🔵 巡回車' : '🟢 補給車'} #${agentId}</span>
      <span>${fuel}/${fuelLimit}</span>
    `;

    const barDiv = document.createElement('div');
    barDiv.className = 'fuel-bar';

    const fillDiv = document.createElement('div');
    fillDiv.className = 'fuel-fill';
    fillDiv.style.width = `${percentage}%`;

    if (percentage > 50) {
      fillDiv.classList.add('high');
    } else if (percentage > 20) {
      fillDiv.classList.add('medium');
    } else if (percentage > 0) {
      fillDiv.classList.add('low');
    } else {
      fillDiv.classList.add('critical');
    }

    barDiv.appendChild(fillDiv);
    gaugeDiv.appendChild(headerDiv);
    gaugeDiv.appendChild(barDiv);
    fuelGaugesContainer.appendChild(gaugeDiv);
  }
}

function updateDecisionPanel() {
  if (!stateManager) return;

  const extendedInfo = stateManager.data.days[0]?.extendedInfo;
  const decisions = extendedInfo?.decisions;

  if (!decisions || decisions.length === 0) {
    decisionPanel.innerHTML = '<p class="placeholder">No decision data available</p>';
    return;
  }

  decisionPanel.innerHTML = '';

  decisions.forEach((decision, index) => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'decision-item';

    const targetDiv = document.createElement('div');
    targetDiv.className = 'decision-target';
    targetDiv.textContent = `Agent ${index}: ${decision.target}`;

    const reasonsUl = document.createElement('ul');
    reasonsUl.className = 'decision-reasons';

    decision.reasons.forEach(reason => {
      const li = document.createElement('li');
      li.textContent = reason;
      reasonsUl.appendChild(li);
    });

    itemDiv.appendChild(targetDiv);
    itemDiv.appendChild(reasonsUl);
    decisionPanel.appendChild(itemDiv);
  });
}

function updateScoreGraph() {
  if (!stateManager) return;

  const scoreHistory = stateManager.getScoreHistory();
  const currentScore = stateManager.getCurrentScore(currentStep);

  ourScoreDisplay.textContent = currentScore.ourScore.toString();
  opponentScoreDisplay.textContent = currentScore.opponentScore.toString();

  // Draw score graph
  const width = scoreCanvas.width = scoreCanvas.clientWidth;
  const height = scoreCanvas.height = scoreCanvas.clientHeight;

  scoreCtx.clearRect(0, 0, width, height);

  if (scoreHistory.length < 2) return;

  const maxScore = Math.max(
    ...scoreHistory.map(h => Math.max(h.ourScore, h.opponentScore)),
    100
  );
  const padding = 10;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;

  const getX = (turn: number) => padding + (turn / scoreHistory.length) * graphWidth;
  const getY = (score: number) => height - padding - (score / maxScore) * graphHeight;

  // Draw our score line
  scoreCtx.beginPath();
  scoreCtx.strokeStyle = '#3b82f6';
  scoreCtx.lineWidth = 2;
  scoreHistory.forEach((h, i) => {
    const x = getX(i);
    const y = getY(h.ourScore);
    if (i === 0) scoreCtx.moveTo(x, y);
    else scoreCtx.lineTo(x, y);
  });
  scoreCtx.stroke();

  // Draw opponent score line
  scoreCtx.beginPath();
  scoreCtx.strokeStyle = '#ef4444';
  scoreCtx.lineWidth = 2;
  scoreHistory.forEach((h, i) => {
    const x = getX(i);
    const y = getY(h.opponentScore);
    if (i === 0) scoreCtx.moveTo(x, y);
    else scoreCtx.lineTo(x, y);
  });
  scoreCtx.stroke();
}

function updateTurnLog() {
  if (!stateManager) return;

  turnLogContainer.innerHTML = '';

  // Add recent turn entries (last 10)
  const recentTurns = Math.max(0, currentStep - 9);
  for (let turn = recentTurns; turn <= currentStep; turn++) {
    const entryDiv = document.createElement('div');
    entryDiv.className = 'log-entry';

    const turnDiv = document.createElement('div');
    turnDiv.className = 'log-turn';
    turnDiv.textContent = `Turn ${turn}`;

    const actionDiv = document.createElement('div');
    actionDiv.className = 'log-action';
    actionDiv.textContent = 'Actions logged...';

    entryDiv.appendChild(turnDiv);
    entryDiv.appendChild(actionDiv);
    turnLogContainer.appendChild(entryDiv);
  }

  // Auto-scroll to bottom
  turnLogContainer.scrollTop = turnLogContainer.scrollHeight;
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
      // Parse action plan data
      if (Array.isArray(data)) {
        // Action plan format: [[agent1_actions], [agent2_actions], ...]
        vizData.agentTypes = data.map((_, i) => i % 2 === 0 ? 0 : 1); // Simple assignment: even=patrol, odd=supply
        
        if (stateManager && vizData.mapData) {
          const numDays = vizData.mapData.daySteps.length;
          vizData.days = [];
          
          for (let day = 0; day < numDays; day++) {
            const daySteps = vizData.mapData.daySteps[day];
            const actions: number[][] = [];
            
            data.forEach((agentActions: number[]) => {
              const dayActions = agentActions.slice(0, daySteps);
              actions.push(dayActions);
            });
            
            vizData.days.push({
              info: {
                endsAt: 0,
                day: day,
                agents: [],
                others: [],
                traffics: []
              },
              actions: actions
            });
          }
          
          stateManager = new StateManager(vizData);
          currentStep = 0;
          updateControls();
          draw();
        }
      } else if (data.agents !== undefined && data.day !== undefined) {
        // Day info format (like sample_day.json)
        // This is a single day's state, not actions
        // We'll store it as day info
        if (!vizData.mapData) {
          alert("Please load map data first");
          return;
        }
        
        const dayInfo = data;
        vizData.days.push({
          info: dayInfo,
          actions: null
        });
        
        stateManager = new StateManager(vizData);
        currentStep = 0;
        updateControls();
        draw();
      } else if (data.agentTypes !== undefined) {
        // Extended format with agent types and decisions
        vizData.agentTypes = data.agentTypes;
        if (data.scoreHistory) {
          vizData.scoreHistory = data.scoreHistory;
        }
        if (data.days) {
          vizData.days = data.days;
        }
        
        if (stateManager) {
          stateManager = new StateManager(vizData);
          currentStep = 0;
          updateControls();
          draw();
        }
      }
      console.log("Loaded action data", data);
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
