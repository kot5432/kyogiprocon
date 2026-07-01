import './style.css'
import { StateManager } from './state'
import { drawHexGrid, toggleCellIds } from './draw'
import { serverClient, setLogCallback } from './server'
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

// Load guide elements
const loadGuide = document.getElementById('load-guide') as HTMLDivElement;
const mapStatus = document.getElementById('map-status') as HTMLSpanElement;
const actionStatus = document.getElementById('action-status') as HTMLSpanElement;

// Agent config elements
const agentConfigPanel = document.getElementById('agent-config-panel') as HTMLDivElement;
const patrolCountSlider = document.getElementById('patrol-count') as HTMLInputElement;
const supplyCountSlider = document.getElementById('supply-count') as HTMLInputElement;
const patrolValueDisplay = document.getElementById('patrol-value') as HTMLSpanElement;
const supplyValueDisplay = document.getElementById('supply-value') as HTMLSpanElement;
const totalAgentsDisplay = document.getElementById('total-agents') as HTMLSpanElement;
const maxAgentsDisplay = document.getElementById('max-agents') as HTMLSpanElement;
const btnApplyConfig = document.getElementById('btn-apply-config') as HTMLButtonElement;
const btnExportConfig = document.getElementById('btn-export-config') as HTMLButtonElement;
const agentTypesFile = document.getElementById('agent-types-file') as HTMLInputElement;
const agentTypesStatus = document.getElementById('agent-types-status') as HTMLSpanElement;

// Day info elements
const dayInfoFile = document.getElementById('day-info-file') as HTMLInputElement;
const dayInfoStatus = document.getElementById('day-info-status') as HTMLSpanElement;

// Server UI elements
const serverUrlInput  = document.getElementById('server-url')      as HTMLInputElement | null;
const teamIdInput     = document.getElementById('team-id')         as HTMLInputElement | null;
const btnPing         = document.getElementById('btn-ping')         as HTMLButtonElement | null;
const btnFetchMap     = document.getElementById('btn-fetch-map')    as HTMLButtonElement | null;
const btnFetchDay     = document.getElementById('btn-fetch-day')    as HTMLButtonElement | null;
const btnPostAction   = document.getElementById('btn-post-action')  as HTMLButtonElement | null;
const serverLogEl     = document.getElementById('server-log')       as HTMLDivElement | null;

let patrolCount = 2;
let supplyCount = 2;

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
  setupServerUI();
}

// -------------------------------------------------------
// サーバーUI初期化
// -------------------------------------------------------
function appendServerLog(type: 'send' | 'recv' | 'error', message: string) {
  if (!serverLogEl) return;
  const entry = document.createElement('div');
  entry.className = `server-log-entry ${type}`;
  const time = new Date().toLocaleTimeString('ja-JP', { hour12: false });
  entry.textContent = `[${time}] ${message}`;
  serverLogEl.appendChild(entry);
  // 最大20行
  while (serverLogEl.children.length > 20) serverLogEl.removeChild(serverLogEl.firstChild!);
  serverLogEl.scrollTop = serverLogEl.scrollHeight;
}

function setupServerUI() {
  // ログコールバック登録
  setLogCallback((type, message) => appendServerLog(type, message));

  // URL / TeamID 変更時に設定を反映
  serverUrlInput?.addEventListener('change', () => {
    serverClient.setConfig({ baseUrl: serverUrlInput.value.trim() });
    appendServerLog('send', `URL 変更: ${serverUrlInput.value.trim()}`);
  });
  teamIdInput?.addEventListener('change', () => {
    serverClient.setConfig({ teamId: parseInt(teamIdInput.value) });
    appendServerLog('send', `Team ID 変更: ${teamIdInput.value}`);
  });

  // Ping
  btnPing?.addEventListener('click', async () => {
    btnPing.disabled = true;
    appendServerLog('send', 'Ping...');
    const r = await serverClient.ping();
    appendServerLog(r.ok ? 'recv' : 'error', r.ok ? `Pong! (${r.elapsedMs}ms)` : (r.error ?? 'error'));
    btnPing.disabled = false;
  });

  // Get Map
  btnFetchMap?.addEventListener('click', async () => {
    btnFetchMap.disabled = true;
    const r = await serverClient.fetchMapData();
    if (r.ok && r.data) {
      vizData.mapData = r.data;
      stateManager = new StateManager(vizData);
      currentStep = 0;
      updateControls();
      draw();
      mapStatus.textContent = '✓ Fetched';
      mapStatus.className = 'status success';
    } else {
      appendServerLog('error', r.error ?? 'Failed to fetch map');
    }
    btnFetchMap.disabled = false;
  });

  // Get Day
  btnFetchDay?.addEventListener('click', async () => {
    if (!vizData.mapData) {
      appendServerLog('error', 'マップを先に取得してください');
      return;
    }
    btnFetchDay.disabled = true;
    const r = await serverClient.fetchDayInfo();
    if (r.ok && r.data) {
      vizData.days.push({ info: r.data, actions: null });
      stateManager = new StateManager(vizData);
      currentStep = 0;
      updateControls();
      draw();
      dayInfoStatus.textContent = `✓ Day ${r.data.day}`;
      dayInfoStatus.className = 'status success';
    } else {
      appendServerLog('error', r.error ?? 'Failed to fetch day info');
    }
    btnFetchDay.disabled = false;
  });

  // Post Action (現在のアクションデータがあれば送信)
  btnPostAction?.addEventListener('click', async () => {
    if (!vizData.days.length) {
      appendServerLog('error', 'アクションデータがありません');
      return;
    }
    const lastDay = vizData.days[vizData.days.length - 1];
    if (!lastDay.actions) {
      appendServerLog('error', 'アクションプランをロードしてください');
      return;
    }
    btnPostAction.disabled = true;
    const r = await serverClient.postActionPlan(lastDay.actions);
    appendServerLog(r.ok ? 'recv' : 'error',
      r.ok ? `送信成功 (${r.elapsedMs}ms)` : (r.error ?? 'error'));
    btnPostAction.disabled = false;
  });
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
    mapStatus.textContent = 'Loading...';
    mapStatus.className = 'status loading';
    
    parseFile(file, (data) => {
      if (data.startsAt !== undefined) {
        vizData.mapData = data;
        
        // Update max agents based on map data
        const mapMaxAgents = data.agents.length;
        maxAgentsDisplay.textContent = mapMaxAgents.toString();
        patrolCountSlider.max = mapMaxAgents.toString();
        supplyCountSlider.max = mapMaxAgents.toString();
        
        stateManager = new StateManager(vizData);
        currentStep = 0;
        updateControls();
        draw();
        
        // Update load guide
        mapStatus.textContent = '✓ Loaded';
        mapStatus.className = 'status success';
        const steps = loadGuide.querySelectorAll('.step');
        steps[0].classList.remove('active');
        steps[0].classList.add('completed');
        steps[1].classList.add('active');
        
        // Show agent config panel
        agentConfigPanel.style.display = 'flex';
      } else {
        mapStatus.textContent = '✗ Invalid format';
        mapStatus.className = 'status error';
        alert("This doesn't look like Map configuration JSON.");
      }
    });
  }
});

// Agent configuration UI
patrolCountSlider.addEventListener('input', (e) => {
  patrolCount = parseInt((e.target as HTMLInputElement).value);
  patrolValueDisplay.textContent = patrolCount.toString();
  updateTotalAgents();
});

supplyCountSlider.addEventListener('input', (e) => {
  supplyCount = parseInt((e.target as HTMLInputElement).value);
  supplyValueDisplay.textContent = supplyCount.toString();
  updateTotalAgents();
});

function updateTotalAgents() {
  const total = patrolCount + supplyCount;
  totalAgentsDisplay.textContent = total.toString();
  
  if (total > parseInt(maxAgentsDisplay.textContent)) {
    totalAgentsDisplay.style.color = '#ef4444';
    btnApplyConfig.disabled = true;
  } else {
    totalAgentsDisplay.style.color = '#e5e7eb';
    btnApplyConfig.disabled = false;
  }
}

btnApplyConfig.addEventListener('click', () => {
  const total = patrolCount + supplyCount;
  if (total === 0) {
    alert('Please select at least one agent');
    return;
  }
  
  // Generate agent types array
  vizData.agentTypes = [];
  for (let i = 0; i < patrolCount; i++) {
    vizData.agentTypes.push(0); // Patrol
  }
  for (let i = 0; i < supplyCount; i++) {
    vizData.agentTypes.push(1); // Supply
  }
  
  // Reinitialize state manager with new config
  stateManager = new StateManager(vizData);
  currentStep = 0;
  updateControls();
  draw();
  
  // Update load guide
  const steps = loadGuide.querySelectorAll('.step');
  steps[1].classList.remove('active');
  steps[1].classList.add('completed');
  steps[2].classList.add('active');
  
  // Hide agent config panel
  agentConfigPanel.style.display = 'none';
});

btnExportConfig.addEventListener('click', () => {
  const total = patrolCount + supplyCount;
  if (total === 0) {
    alert('Please select at least one agent');
    return;
  }
  
  const agentTypes: number[] = [];
  for (let i = 0; i < patrolCount; i++) {
    agentTypes.push(0);
  }
  for (let i = 0; i < supplyCount; i++) {
    agentTypes.push(1);
  }
  
  const json = JSON.stringify(agentTypes, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'agent_types.json';
  a.click();
  URL.revokeObjectURL(url);
});

agentTypesFile.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    agentTypesStatus.textContent = 'Loading...';
    agentTypesStatus.className = 'status loading';
    
    parseFile(file, (data) => {
      if (Array.isArray(data) && data.every((v: number) => v === 0 || v === 1)) {
        // Valid agent types array
        if (data.length !== parseInt(maxAgentsDisplay.textContent)) {
          agentTypesStatus.textContent = `✗ Length mismatch (${data.length} vs ${maxAgentsDisplay.textContent})`;
          agentTypesStatus.className = 'status error';
          return;
        }
        
        vizData.agentTypes = data;
        
        // Update UI to reflect loaded config
        const patrolCount = data.filter((v: number) => v === 0).length;
        const supplyCount = data.filter((v: number) => v === 1).length;
        
        patrolCountSlider.value = patrolCount.toString();
        supplyCountSlider.value = supplyCount.toString();
        patrolValueDisplay.textContent = patrolCount.toString();
        supplyValueDisplay.textContent = supplyCount.toString();
        updateTotalAgents();
        
        stateManager = new StateManager(vizData);
        currentStep = 0;
        updateControls();
        draw();
        
        agentTypesStatus.textContent = '✓ Loaded';
        agentTypesStatus.className = 'status success';
        
        // Update load guide
        const steps = loadGuide.querySelectorAll('.step');
        steps[1].classList.remove('active');
        steps[1].classList.add('completed');
        steps[2].classList.add('active');
        
        agentConfigPanel.style.display = 'none';
      } else {
        agentTypesStatus.textContent = '✗ Invalid format';
        agentTypesStatus.className = 'status error';
        alert('Invalid agent types format. Expected array of 0s and 1s.');
      }
    });
  }
});

dayInfoFile.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    dayInfoStatus.textContent = 'Loading...';
    dayInfoStatus.className = 'status loading';
    
    parseFile(file, (data) => {
      if (data.agents !== undefined && data.day !== undefined) {
        // Day info format
        if (!vizData.mapData) {
          dayInfoStatus.textContent = '✗ Load map first';
          dayInfoStatus.className = 'status error';
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
        
        dayInfoStatus.textContent = '✓ Loaded (Day Info)';
        dayInfoStatus.className = 'status success';
        
        // Update load guide
        const steps = loadGuide.querySelectorAll('.step');
        if (steps[2]) {
          steps[2].classList.remove('active');
          steps[2].classList.add('completed');
        }
      } else {
        dayInfoStatus.textContent = '✗ Invalid format';
        dayInfoStatus.className = 'status error';
      }
    });
  }
});

actionFileInput.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    actionStatus.textContent = 'Loading...';
    actionStatus.className = 'status loading';
    
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
          
          actionStatus.textContent = '✓ Loaded (Action Plan)';
          actionStatus.className = 'status success';
        }
      } else if (data.agents !== undefined && data.day !== undefined) {
        // Day info format (like sample_day.json)
        // This is a single day's state, not actions
        // We'll store it as day info
        if (!vizData.mapData) {
          actionStatus.textContent = '✗ Load map first';
          actionStatus.className = 'status error';
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
        
        actionStatus.textContent = '✓ Loaded (Day Data)';
        actionStatus.className = 'status success';
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
          
          actionStatus.textContent = '✓ Loaded (Extended)';
          actionStatus.className = 'status success';
        }
      } else {
        actionStatus.textContent = '✗ Unknown format';
        actionStatus.className = 'status error';
      }
      
      // Update load guide
      const steps = loadGuide.querySelectorAll('.step');
      if (steps[2]) {
        steps[2].classList.remove('active');
        steps[2].classList.add('completed');
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

// セルID表示トグル
const btnToggleCellIds = document.getElementById('btn-toggle-cell-ids') as HTMLButtonElement | null;
btnToggleCellIds?.addEventListener('click', () => {
  toggleCellIds();
  draw();
  if (btnToggleCellIds) {
    btnToggleCellIds.textContent = btnToggleCellIds.textContent?.includes('OFF')
      ? '🔢 Cell IDs: ON'
      : '🔢 Cell IDs: OFF';
  }
});

init();
