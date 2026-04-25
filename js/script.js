// ── DATA STRUCTURES ────────────────────────────────
let mode = 'DFA';
let states = [];
let alphabet = [];
let startState = "";
let finalStates = new Set();
let transitions = new Map(); // Map<fromState, Map<symbol, toStates[]>>

// Animation state
let simulationSteps = [];
let currentStepIndex = -1;
let animationSpeed = 1500;
let animationTimer = null;
let animFrames = [];
let simulationResult = { accepted: false, error: null };

// ── INIT ───────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Pre-fill DFA example
  addTransitionRow('q0', '0', 'q1');
  addTransitionRow('q0', '1', 'q0');
  addTransitionRow('q1', '0', 'q1');
  addTransitionRow('q1', '1', 'q2');
  addTransitionRow('q2', '0', 'q1');
  addTransitionRow('q2', '1', 'q0');
  
  const speedSlider = document.getElementById('speed-slider');
  const updateSpeedBackground = () => {
    const val = (speedSlider.value - speedSlider.min) / (speedSlider.max - speedSlider.min) * 100;
    speedSlider.style.background = `linear-gradient(to right, var(--accent-purple) ${val}%, var(--border-color) ${val}%)`;
  };
  
  speedSlider.addEventListener('input', (e) => {
    animationSpeed = 2200 - parseInt(e.target.value);
    updateSpeedBackground();
  });
  updateSpeedBackground();
  
  // Graph View Listeners
  const viewport = document.getElementById('graphViewport');
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY < 0) handleZoomIn();
    else handleZoomOut();
  }, { passive: false });

  document.addEventListener('fullscreenchange', () => {
    const btn = document.getElementById('btn-fullscreen');
    if (document.fullscreenElement) {
      btn.textContent = '❐'; // Exit icon
      btn.title = "Exit Fullscreen";
    } else {
      btn.textContent = '⛶'; // Expand icon
      btn.title = "Fullscreen";
    }
  });
  
  // Set initial marker colors
  document.getElementById('arrowhead').style.color = 'var(--edge-color)';
  document.getElementById('arrowhead-active').style.color = 'var(--active-edge)';
});

// ── UI EVENT HANDLERS ──────────────────────────────
function switchMode(newMode) {
  mode = newMode;
  document.getElementById('btn-dfa').classList.toggle('active', mode === 'DFA');
  document.getElementById('btn-nfa').classList.toggle('active', mode === 'NFA');
  
  const hint = document.getElementById('hint-alphabet');
  if (mode === 'NFA') {
    hint.textContent = "symbols, use 'e' or 'ε' for epsilon";
  } else {
    hint.textContent = "comma-separated symbols";
  }
  
  // Clear graph
  document.getElementById('edges-layer').innerHTML = '';
  const labelsLayer = document.getElementById('labels-layer');
  if (labelsLayer) labelsLayer.innerHTML = '';
  document.getElementById('nodes-layer').innerHTML = '';
  
  resetSimulation();
  document.getElementById('step-info').textContent = 'Mode switched to ' + mode + '. Ready.';
  document.getElementById('result-badge').style.display = 'none';
  document.getElementById('error-box').style.display = 'none';
}

function addTransitionRow(from = "", sym = "", to = "") {
  const container = document.getElementById('transitions-container');
  const row = document.createElement('div');
  row.className = 'transition-row';
  row.innerHTML = `
    <input type="text" class="t-from" placeholder="From" value="${from}">
    <input type="text" class="t-sym" placeholder="Symbol" value="${sym}">
    <input type="text" class="t-to" placeholder="To" value="${to}">
    <button class="btn-remove" onclick="removeTransitionRow(this)" title="Remove">×</button>
  `;
  container.appendChild(row);
}

function removeTransitionRow(btn) {
  btn.parentElement.remove();
}

function parseCSV(str) {
  return str.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

// ── PARSE INPUTS ───────────────────────────────────
function parseInputs() {
  const errors = [];
  
  states = [...new Set(parseCSV(document.getElementById('inp-states').value))]; // remove duplicates
  if (states.length === 0) errors.push("States field cannot be empty.");
  
  alphabet = [...new Set(parseCSV(document.getElementById('inp-alphabet').value))];
  if (alphabet.length === 0) errors.push("Alphabet field cannot be empty.");
  for (const a of alphabet) {
    if (a.length > 1) errors.push(`Alphabet symbol '${a}' must be a single character.`);
    if (mode === 'DFA' && (a === 'e' || a === 'ε')) errors.push("DFA alphabet cannot contain epsilon ('e' or 'ε').");
  }
  
  startState = document.getElementById('inp-start').value.trim();
  if (!startState) errors.push("Start state cannot be empty.");
  else if (!states.includes(startState)) errors.push(`Start state '${startState}' is not in the set of states.`);
  
  const fStatesArr = parseCSV(document.getElementById('inp-final').value);
  finalStates = new Set();
  for (const fs of fStatesArr) {
    if (!states.includes(fs)) errors.push(`Final state '${fs}' is not in the set of states.`);
    else finalStates.add(fs);
  }
  
  transitions = new Map();
  states.forEach(s => transitions.set(s, new Map()));
  
  const rows = document.querySelectorAll('.transition-row');
  rows.forEach((row, idx) => {
    const from = row.querySelector('.t-from').value.trim();
    const sym = row.querySelector('.t-sym').value.trim();
    const toStr = row.querySelector('.t-to').value.trim();
    
    if (!from && !sym && !toStr) return; // skip entirely empty rows
    
    if (!states.includes(from)) errors.push(`Row ${idx+1}: From state '${from}' must be in Q.`);
    
    const isEpsilon = (sym === 'e' || sym === 'ε');
    if (mode === 'DFA' && isEpsilon) {
      errors.push(`Row ${idx+1}: DFA cannot have epsilon transitions.`);
    } else if (!isEpsilon && !alphabet.includes(sym)) {
      errors.push(`Row ${idx+1}: Symbol '${sym}' must be in alphabet Σ.`);
    }
    
    const normalizedSym = isEpsilon ? 'ε' : sym;
    const toStates = parseCSV(toStr);
    
    if (toStates.length === 0) errors.push(`Row ${idx+1}: To state cannot be empty.`);
    
    if (mode === 'DFA') {
      if (toStates.length > 1) errors.push(`Row ${idx+1}: DFA can only transition to a single state.`);
      if (toStates[0] && !states.includes(toStates[0])) errors.push(`Row ${idx+1}: To state '${toStates[0]}' must be in Q.`);
    } else {
      for (const t of toStates) {
        if (!states.includes(t)) errors.push(`Row ${idx+1}: To state '${t}' must be in Q.`);
      }
    }
    
    if (states.includes(from)) {
      const fromMap = transitions.get(from);
      if (!fromMap.has(normalizedSym)) fromMap.set(normalizedSym, []);
      
      if (mode === 'DFA') {
        if (fromMap.get(normalizedSym).length > 0) {
          errors.push(`Row ${idx+1}: DFA cannot have multiple transitions for same state and symbol (${from}, ${normalizedSym}).`);
        }
      }
      for (const t of toStates) {
        if (states.includes(t)) {
           if (!fromMap.get(normalizedSym).includes(t)) {
             fromMap.get(normalizedSym).push(t);
           }
        }
      }
    }
  });

  const inputString = document.getElementById('inp-string').value;
  for (const char of inputString) {
    if (!alphabet.includes(char)) {
      errors.push(`Input string contains invalid symbol: '${char}'`);
    }
  }

  const errorBox = document.getElementById('error-box');
  const errorList = document.getElementById('error-list');
  if (errors.length > 0) {
    errorList.innerHTML = errors.map(e => `<li>${e}</li>`).join('');
    errorBox.style.display = 'block';
    return { valid: false, errors };
  } else {
    errorBox.style.display = 'none';
    return { valid: true, errors: [] };
  }
}

// ── DFA SIMULATION ─────────────────────────────────
function simulateDFA(inputString) {
  let currentState = startState;
  const steps = [];
  let error = null;
  
  steps.push({ from: null, symbol: 'start', to: currentState });
  
  for (const c of inputString) {
    const fromMap = transitions.get(currentState);
    if (!fromMap || !fromMap.has(c) || fromMap.get(c).length === 0) {
      error = `No transition defined for δ(${currentState}, ${c})`;
      steps.push({ from: currentState, symbol: c, to: null, error: true });
      return { accepted: false, steps, error };
    }
    const nextState = fromMap.get(c)[0];
    steps.push({ from: currentState, symbol: c, to: nextState });
    currentState = nextState;
  }
  
  const accepted = finalStates.has(currentState);
  return { accepted, steps, error: null };
}

// ── NFA SIMULATION ─────────────────────────────────
function epsilonClosure(stateSet) {
  const stack = [...stateSet];
  const closure = new Set(stateSet);
  while (stack.length > 0) {
    const q = stack.pop();
    const fromMap = transitions.get(q);
    if (fromMap && fromMap.has('ε')) {
      for (const p of fromMap.get('ε')) {
        if (!closure.has(p)) {
          closure.add(p);
          stack.push(p);
        }
      }
    }
  }
  return closure;
}

function simulateNFA(inputString) {
  let currentStates = epsilonClosure(new Set([startState]));
  const steps = [];
  let error = null;
  
  steps.push({ fromSet: new Set(), symbol: 'start', toSet: currentStates });
  
  for (const c of inputString) {
    const nextStates = new Set();
    for (const q of currentStates) {
      const fromMap = transitions.get(q);
      if (fromMap && fromMap.has(c)) {
        for (const p of fromMap.get(c)) {
          nextStates.add(p);
        }
      }
    }
    const nextClosure = epsilonClosure(nextStates);
    steps.push({ fromSet: currentStates, symbol: c, toSet: nextClosure });
    currentStates = nextClosure;
    
    if (currentStates.size === 0) {
      error = "Dead configuration reached.";
      break;
    }
  }
  
  let accepted = false;
  for (const s of currentStates) {
    if (finalStates.has(s)) { accepted = true; break; }
  }
  return { accepted, steps, error };
}

// ── MAIN EXECUTION ─────────────────────────────────
function generateAndSimulate() {
  pauseSimulation();
  if (!parseInputs().valid) return;
  
  renderGraph();
  
  const inputString = document.getElementById('inp-string').value;
  let result;
  if (mode === 'DFA') {
    result = simulateDFA(inputString);
  } else {
    result = simulateNFA(inputString);
  }
  
  simulationSteps = result.steps;
  simulationResult = { accepted: result.accepted, error: result.error };
  currentStepIndex = -1;
  
  resetSimulation();
  
  let info = `Graph generated. Ready to simulate "${inputString}". Click Play.`;
  if (inputString === "") info = `Graph generated. Simulating empty string. Click Play.`;
  document.getElementById('step-info').textContent = info;
}

// ── SVG RENDERER (PHYSICS LAYOUT) ──────────────────
let nodePositions = new Map(); // {x, y}

function forceDirectedLayout() {
  nodePositions.clear();
  const n = states.length;
  if (n === 0) return;

  // Initialize in a circle
  const radius = Math.max(100, n * 20);
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n;
    nodePositions.set(states[i], { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }

  if (n <= 2) return; // Circle is fine

  // Fruchterman-Reingold Force-Directed Simulation
  const iterations = 200;
  const area = (radius * 4) * (radius * 4);
  const k = Math.sqrt(area / n);
  let temp = radius * 0.5;
  
  for (let iter = 0; iter < iterations; iter++) {
    const disp = new Map();
    for (const s of states) disp.set(s, { dx: 0, dy: 0 });

    // 1. Repulsive forces
    for (let i = 0; i < n; i++) {
      const v = states[i];
      for (let j = i + 1; j < n; j++) {
        const u = states[j];
        let dx = nodePositions.get(v).x - nodePositions.get(u).x;
        let dy = nodePositions.get(v).y - nodePositions.get(u).y;
        let d = Math.hypot(dx, dy);
        if (d === 0) { d = 0.01; dx = 0.01; }
        const force = (k * k) / d;
        disp.get(v).dx += (dx / d) * force;
        disp.get(v).dy += (dy / d) * force;
        disp.get(u).dx -= (dx / d) * force;
        disp.get(u).dy -= (dy / d) * force;
      }
    }

    // 2. Attractive forces (edges)
    for (const [from, fromMap] of transitions.entries()) {
      for (const [sym, toArr] of fromMap.entries()) {
        for (const to of toArr) {
          if (from === to) continue;
          let dx = nodePositions.get(from).x - nodePositions.get(to).x;
          let dy = nodePositions.get(from).y - nodePositions.get(to).y;
          let d = Math.hypot(dx, dy);
          if (d === 0) { d = 0.01; dx = 0.01; }
          const force = (d * d) / k;
          disp.get(from).dx -= (dx / d) * force;
          disp.get(from).dy -= (dy / d) * force;
          disp.get(to).dx += (dx / d) * force;
          disp.get(to).dy += (dy / d) * force;
        }
      }
    }

    // 3. Update positions
    for (const v of states) {
      const p = nodePositions.get(v);
      const d = disp.get(v);
      const dist = Math.hypot(d.dx, d.dy);
      if (dist > 0) {
        const move = Math.min(dist, temp);
        p.x += (d.dx / dist) * move;
        p.y += (d.dy / dist) * move;
      }
    }
    
    // Cool temperature
    temp *= 0.95;
  }
}

// Helper to calculate exact circle boundary intersections
function getBoundaryPoint(px, py, cx, cy, radius) {
  const dx = px - cx;
  const dy = py - cy;
  let dist = Math.hypot(dx, dy);
  if (dist === 0) dist = 0.01;
  return {
    x: cx + (dx / dist) * radius,
    y: cy + (dy / dist) * radius
  };
}

function renderGraph() {
  forceDirectedLayout();
  
  const edgesLayer = document.getElementById('edges-layer');
  const labelsLayer = document.getElementById('labels-layer');
  const nodesLayer = document.getElementById('nodes-layer');
  
  edgesLayer.innerHTML = '';
  if (labelsLayer) labelsLayer.innerHTML = '';
  nodesLayer.innerHTML = '';
  
  // Calculate dynamic ViewBox
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  if (states.length > 0) {
    for (const pos of nodePositions.values()) {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x);
      maxY = Math.max(maxY, pos.y);
    }
  } else {
    minX = 0; minY = 0; maxX = 900; maxY = 400;
  }
  
  const pad = 120; // safe padding for arrows, labels, outer rings
  const vMinX = minX - pad;
  const vMinY = minY - pad;
  const vWidth = Math.max(400, (maxX - minX) + pad * 2);
  const vHeight = Math.max(200, (maxY - minY) + pad * 2);
  
  const svgEl = document.getElementById('graph-svg');
  svgEl.setAttribute('viewBox', `${vMinX} ${vMinY} ${vWidth} ${vHeight}`);
  
  // Aggregate edges: Map<from, Map<to, Set<symbol>>>
  const edgeAgg = new Map();
  for (const from of states) {
    edgeAgg.set(from, new Map());
    const fromMap = transitions.get(from);
    if (!fromMap) continue;
    for (const [sym, toArr] of fromMap.entries()) {
      for (const to of toArr) {
        if (!edgeAgg.get(from).has(to)) edgeAgg.get(from).set(to, new Set());
        edgeAgg.get(from).get(to).add(sym);
      }
    }
  }
  
  // Draw Edges
  for (const [from, toMap] of edgeAgg.entries()) {
    for (const [to, symSet] of toMap.entries()) {
      const symbols = Array.from(symSet).join(', ');
      if (from === to) {
        drawSelfLoop(edgesLayer, labelsLayer, from, symbols, nodePositions.get(from));
      } else {
        const isBidirectional = edgeAgg.has(to) && edgeAgg.get(to).has(from);
        drawTransition(edgesLayer, labelsLayer, from, to, symbols, nodePositions.get(from), nodePositions.get(to), isBidirectional);
      }
    }
  }
  
  // Draw Start Arrow
  if (startState && nodePositions.has(startState)) {
    drawStartArrow(edgesLayer, labelsLayer, nodePositions.get(startState));
  }

  // Draw Nodes
  for (const state of states) {
    drawState(nodesLayer, state, nodePositions.get(state));
  }
}

function drawState(container, state, pos) {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.id = `node-${state}`;
  
  if (finalStates.has(state)) {
    const outerCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    outerCircle.setAttribute("cx", pos.x);
    outerCircle.setAttribute("cy", pos.y);
    outerCircle.setAttribute("r", 32);
    outerCircle.setAttribute("fill", "none");
    outerCircle.setAttribute("class", "state-normal");
    outerCircle.id = `node-outer-${state}`;
    g.appendChild(outerCircle);
  }
  
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", pos.x);
  circle.setAttribute("cy", pos.y);
  circle.setAttribute("r", 26);
  circle.setAttribute("class", "state-normal");
  circle.id = `node-inner-${state}`;
  
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", pos.x);
  text.setAttribute("y", pos.y);
  text.setAttribute("class", "state-label");
  text.textContent = state;
  
  g.appendChild(circle);
  g.appendChild(text);
  container.appendChild(g);
}

function drawTransition(edgesContainer, labelsContainer, from, to, symbols, p1, p2, isBidirectional) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  let dist = Math.hypot(dx, dy);
  if (dist === 0) return;
  
  const R = 28; // Radius slightly larger to push arrowhead outside stroke
  
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.id = `edge-${from}-${to}`;
  path.setAttribute("class", "edge-path");
  path.setAttribute("marker-end", "url(#arrowhead)");
  
  let labelX, labelY;
  
  if (!isBidirectional) {
    const startP = getBoundaryPoint(p2.x, p2.y, p1.x, p1.y, 26); // Edge starts precisely on boundary
    const endP = getBoundaryPoint(p1.x, p1.y, p2.x, p2.y, R + 4); // Accounts for arrowhead
    
    path.setAttribute("d", `M ${startP.x} ${startP.y} L ${endP.x} ${endP.y}`);
    labelX = (startP.x + endP.x) / 2;
    labelY = (startP.y + endP.y) / 2 - 12;
  } else {
    // Normal vector
    const nx = dy / dist;
    const ny = -dx / dist;
    const curveOffset = 40;
    const cx = (p1.x + p2.x) / 2 + nx * curveOffset;
    const cy = (p1.y + p2.y) / 2 + ny * curveOffset;
    
    const startP = getBoundaryPoint(cx, cy, p1.x, p1.y, 26);
    const endP = getBoundaryPoint(cx, cy, p2.x, p2.y, R + 4);
    
    path.setAttribute("d", `M ${startP.x} ${startP.y} Q ${cx} ${cy} ${endP.x} ${endP.y}`);
    labelX = (p1.x + p2.x) / 2 + nx * (curveOffset + 15);
    labelY = (p1.y + p2.y) / 2 + ny * (curveOffset + 15);
  }
  
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", labelX);
  text.setAttribute("y", labelY);
  text.setAttribute("class", "edge-label");
  text.textContent = symbols;
  
  const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  dot.setAttribute("r", 4);
  dot.setAttribute("class", "travel-dot");
  dot.id = `dot-${from}-${to}`;
  
  g.appendChild(path);
  g.appendChild(dot);
  edgesContainer.appendChild(g);
  
  if (labelsContainer) labelsContainer.appendChild(text);
  else edgesContainer.appendChild(text);
}

function drawSelfLoop(edgesContainer, labelsContainer, state, symbols, pos) {
  // Center of mass to determine outward angle
  let cmX = 0, cmY = 0;
  if (nodePositions.size > 1) {
    for (const p of nodePositions.values()) { cmX += p.x; cmY += p.y; }
    cmX /= nodePositions.size;
    cmY /= nodePositions.size;
  } else {
    cmY = pos.y + 100; // force default if single node
    cmX = pos.x;
  }
  
  let dx = pos.x - cmX;
  let dy = pos.y - cmY;
  let dist = Math.hypot(dx, dy);
  
  if (dist < 1) { dx = 0; dy = -1; dist = 1; } // fallback direction
  
  const nx = dx / dist;
  const ny = dy / dist;
  
  const R = 26;
  const angleSpread = 0.6; // Radians to spread base points
  const baseAngle = Math.atan2(ny, nx);
  
  const startX = pos.x + Math.cos(baseAngle - angleSpread) * R;
  const startY = pos.y + Math.sin(baseAngle - angleSpread) * R;
  const endX = pos.x + Math.cos(baseAngle + angleSpread) * (R + 6); // Add arrowhead offset
  const endY = pos.y + Math.sin(baseAngle + angleSpread) * (R + 6);
  
  const loopDist = 120;
  const cx1 = pos.x + Math.cos(baseAngle - angleSpread * 1.5) * loopDist;
  const cy1 = pos.y + Math.sin(baseAngle - angleSpread * 1.5) * loopDist;
  const cx2 = pos.x + Math.cos(baseAngle + angleSpread * 1.5) * loopDist;
  const cy2 = pos.y + Math.sin(baseAngle + angleSpread * 1.5) * loopDist;
  
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.id = `edge-${state}-${state}`;
  path.setAttribute("class", "edge-path");
  path.setAttribute("marker-end", "url(#arrowhead)");
  
  const d = `M ${startX} ${startY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${endX} ${endY}`;
  path.setAttribute("d", d);
  
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", pos.x + nx * (loopDist - 20));
  text.setAttribute("y", pos.y + ny * (loopDist - 20));
  text.setAttribute("class", "edge-label");
  text.textContent = symbols;
  
  const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  dot.setAttribute("r", 4);
  dot.setAttribute("class", "travel-dot");
  dot.id = `dot-${state}-${state}`;

  g.appendChild(path);
  g.appendChild(dot);
  edgesContainer.appendChild(g);
  
  if (labelsContainer) labelsContainer.appendChild(text);
  else edgesContainer.appendChild(text);
}

function drawStartArrow(edgesContainer, labelsContainer, pos) {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("class", "edge-path");
  path.setAttribute("marker-end", "url(#arrowhead)");
  
  // Angle towards center to place start arrow nicely on the outer side
  let cmX = 0, cmY = 0;
  if (nodePositions.size > 1) {
    for (const p of nodePositions.values()) { cmX += p.x; cmY += p.y; }
    cmX /= nodePositions.size;
    cmY /= nodePositions.size;
  } else {
    cmX = pos.x + 100;
    cmY = pos.y;
  }
  
  let dx = pos.x - cmX;
  let dy = pos.y - cmY;
  let dist = Math.hypot(dx, dy);
  if (dist < 1) { dx = -1; dy = 0; dist = 1; }
  
  const nx = dx / dist;
  const ny = dy / dist;
  
  const endP = getBoundaryPoint(pos.x + nx*100, pos.y + ny*100, pos.x, pos.y, 30);
  const startX = endP.x + nx * 50;
  const startY = endP.y + ny * 50;
  
  path.setAttribute("d", `M ${startX} ${startY} L ${endP.x} ${endP.y}`);
  
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", startX + nx * 15);
  text.setAttribute("y", startY + ny * 15 + 4);
  text.setAttribute("class", "edge-label");
  text.textContent = "start";
  
  g.appendChild(path);
  edgesContainer.appendChild(g);
  if (labelsContainer) labelsContainer.appendChild(text);
  else edgesContainer.appendChild(text);
}

// ── ANIMATION ENGINE ───────────────────────────────
function resetNodeStyles() {
  document.querySelectorAll('.state-active, .state-entering, .state-accepted, .state-rejected').forEach(el => {
    el.classList.remove('state-active', 'state-entering', 'state-accepted', 'state-rejected');
    el.classList.add('state-normal');
    el.style.animation = '';
  });
  document.querySelectorAll('.edge-active').forEach(el => {
    el.classList.remove('edge-active');
    el.setAttribute('marker-end', 'url(#arrowhead)');
  });
  document.querySelectorAll('.travel-dot').forEach(el => {
    el.classList.remove('active');
    el.style.animation = '';
  });
}

function setNodeState(state, className) {
  if (!state) return;
  const inner = document.getElementById(`node-inner-${state}`);
  const outer = document.getElementById(`node-outer-${state}`);
  if (inner) {
    inner.classList.remove('state-normal');
    inner.classList.add(className);
    if (className === 'state-active') inner.style.animation = 'pulse-glow 1.5s infinite';
  }
  if (outer) {
    outer.classList.remove('state-normal');
    outer.classList.add(className);
    if (className === 'state-active') outer.style.animation = 'pulse-glow 1.5s infinite';
  }
}

function highlightEdge(from, to, duration) {
  if (!from || !to) return;
  const path = document.getElementById(`edge-${from}-${to}`);
  if (path) {
    path.classList.add('edge-active');
    path.setAttribute('marker-end', 'url(#arrowhead-active)');
  }
  const dot = document.getElementById(`dot-${from}-${to}`);
  if (dot && path) {
    dot.classList.add('active');
    const pathLen = path.getTotalLength();
    
    let start = null;
    function animDot(timestamp) {
      if (!start) start = timestamp;
      const progress = (timestamp - start) / duration;
      if (progress < 1) {
        const pt = path.getPointAtLength(progress * pathLen);
        dot.setAttribute('cx', pt.x);
        dot.setAttribute('cy', pt.y);
        animFrames.push(requestAnimationFrame(animDot));
      } else {
        dot.classList.remove('active');
      }
    }
    animFrames.push(requestAnimationFrame(animDot));
  }
}

function highlightStep(idx) {
  resetNodeStyles();
  const badge = document.getElementById('result-badge');
  badge.style.display = 'none';
  const overlay = document.getElementById('overlay');
  overlay.className = 'overlay-flash';
  
  if (idx < 0) {
    const inputString = document.getElementById('inp-string').value;
    let info = `Ready to simulate "${inputString}".`;
    if (inputString === "") info = `Ready to simulate empty string.`;
    document.getElementById('step-info').textContent = info;
    return;
  }
  
  const step = simulationSteps[idx];
  
  if (mode === 'DFA') {
    if (idx === 0 && step.symbol === 'start') {
      setNodeState(step.to, 'state-active');
      document.getElementById('step-info').textContent = `Init: Start at state '${step.to}'`;
    } else {
      setNodeState(step.from, 'state-active');
      if (step.error) {
        document.getElementById('step-info').textContent = `Step ${idx}: Error on symbol '${step.symbol}' from '${step.from}'. No transition.`;
      } else {
        highlightEdge(step.from, step.to, animationSpeed * 0.8);
        setTimeout(() => {
          if (currentStepIndex === idx) {
            resetNodeStyles();
            setNodeState(step.to, 'state-active');
          }
        }, animationSpeed * 0.8);
        document.getElementById('step-info').textContent = `Step ${idx}: δ(${step.from}, ${step.symbol}) → ${step.to}`;
      }
    }
  } else {
    // NFA
    if (idx === 0 && step.symbol === 'start') {
      step.toSet.forEach(s => setNodeState(s, 'state-active'));
      document.getElementById('step-info').textContent = `Init: ε-closure(start) = {${Array.from(step.toSet).join(', ')}}`;
    } else {
      step.fromSet.forEach(s => setNodeState(s, 'state-active'));
      
      // Highlight all valid edges taken
      for (const f of step.fromSet) {
        const fMap = transitions.get(f);
        if (fMap && fMap.has(step.symbol)) {
          for (const t of fMap.get(step.symbol)) {
            highlightEdge(f, t, animationSpeed * 0.8);
          }
        }
      }
      
      setTimeout(() => {
        if (currentStepIndex === idx) {
          resetNodeStyles();
          step.toSet.forEach(s => setNodeState(s, 'state-active'));
        }
      }, animationSpeed * 0.8);
      
      document.getElementById('step-info').textContent = `Step ${idx}: Read '${step.symbol}' → {${Array.from(step.toSet).join(', ')}}`;
    }
  }
  
  // Show Result on last step
  if (idx === simulationSteps.length - 1) {
    setTimeout(() => {
      if (currentStepIndex !== idx) return;
      resetNodeStyles();
      
      if (simulationResult.accepted) {
        overlay.classList.add('flash-accept');
        badge.className = 'result-badge result-accept';
        badge.innerHTML = '✅ String Accepted';
        badge.style.display = 'block';
        
        if (mode === 'DFA') setNodeState(step.to, 'state-accepted');
        else step.toSet.forEach(s => { if (finalStates.has(s)) setNodeState(s, 'state-accepted'); else setNodeState(s, 'state-active'); });
        
      } else {
        overlay.classList.add('flash-reject');
        badge.className = 'result-badge result-reject';
        badge.innerHTML = '❌ String Rejected';
        badge.style.display = 'block';
        
        if (mode === 'DFA' && step.to) setNodeState(step.to, 'state-rejected');
        else if (mode === 'NFA') step.toSet.forEach(s => setNodeState(s, 'state-rejected'));
      }
    }, animationSpeed);
  }
}

function playSimulation() {
  if (simulationSteps.length === 0) return;
  if (currentStepIndex >= simulationSteps.length - 1) currentStepIndex = -1;
  
  pauseSimulation();
  
  function nextFrame() {
    if (currentStepIndex < simulationSteps.length - 1) {
      currentStepIndex++;
      highlightStep(currentStepIndex);
      animationTimer = setTimeout(nextFrame, animationSpeed + 100);
    }
  }
  nextFrame();
}

function pauseSimulation() {
  if (animationTimer) clearTimeout(animationTimer);
  animationTimer = null;
  animFrames.forEach(cancelAnimationFrame);
  animFrames = [];
}

function stepForward() {
  pauseSimulation();
  if (currentStepIndex < simulationSteps.length - 1) {
    currentStepIndex++;
    highlightStep(currentStepIndex);
  }
}

function stepBackward() {
  pauseSimulation();
  if (currentStepIndex > 0) {
    currentStepIndex--;
    highlightStep(currentStepIndex);
  } else {
    currentStepIndex = -1;
    highlightStep(-1);
  }
}

function resetSimulation() {
  pauseSimulation();
  currentStepIndex = -1;
  highlightStep(-1);
}

// ── GRAPH VIEW CONTROLS ────────────────────────────
let currentZoom = 1.0;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;
const ZOOM_STEP = 0.1;

function handleZoomIn() {
  if (currentZoom < ZOOM_MAX) {
    currentZoom = Math.min(ZOOM_MAX, currentZoom + ZOOM_STEP);
    updateZoomTransform();
    showZoomLabel();
  }
}

function handleZoomOut() {
  if (currentZoom > ZOOM_MIN) {
    currentZoom = Math.max(ZOOM_MIN, currentZoom - ZOOM_STEP);
    updateZoomTransform();
    showZoomLabel();
  }
}

function updateZoomTransform() {
  const layer = document.getElementById('graphTransformLayer');
  layer.style.transform = `scale(${currentZoom})`;
  
  // UI Feedback: Dim buttons at limits
  document.getElementById('btn-zoom-in').style.opacity = currentZoom >= ZOOM_MAX ? '0.3' : '1';
  document.getElementById('btn-zoom-out').style.opacity = currentZoom <= ZOOM_MIN ? '0.3' : '1';
}

function toggleFullscreen() {
  const panel = document.getElementById('graph-view-panel');
  if (!document.fullscreenElement) {
    if (panel.requestFullscreen) {
      panel.requestFullscreen();
    } else if (panel.webkitRequestFullscreen) {
      panel.webkitRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

let zoomLabelTimer = null;
function showZoomLabel() {
  const label = document.getElementById('zoom-label');
  label.textContent = `${Math.round(currentZoom * 100)}%`;
  label.classList.add('show');
  
  if (zoomLabelTimer) clearTimeout(zoomLabelTimer);
  zoomLabelTimer = setTimeout(() => {
    label.classList.remove('show');
  }, 1000);
}

// ── EXPORT ─────────────────────────────────────────
// ── EXPORT SYSTEM (FIXED) ──────────────────────────
function createStyledExportClone(originalSvg, steps = []) {
  const clone = originalSvg.cloneNode(true);
  
  // 1. Setup dimensions
  const viewBox = originalSvg.viewBox.baseVal;
  const width = viewBox.width || 900;
  const height = viewBox.height || 400;
  clone.setAttribute("width", width);
  clone.setAttribute("height", height);

  // 2. Add Background Rect
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("width", "100%");
  rect.setAttribute("height", "100%");
  rect.setAttribute("fill", "#0d0d0f");
  clone.insertBefore(rect, clone.firstChild);

  // 3. Inline Computed Styles
  const originalEls = originalSvg.querySelectorAll("*");
  const clonedEls = clone.querySelectorAll("*");
  
  for (let i = 0; i < originalEls.length; i++) {
    const o = originalEls[i];
    const c = clonedEls[i + 1];
    if (!c) continue;
    const style = window.getComputedStyle(o);
    const props = ["fill", "stroke", "stroke-width", "stroke-dasharray", "opacity", "font-size", "font-family", "font-weight", "text-anchor", "dominant-baseline", "filter", "transform", "transform-origin", "display"];
    props.forEach(p => {
      const val = style.getPropertyValue(p);
      if (val && val !== "none" && val !== "normal") c.style[p] = val;
    });
    ["marker-start", "marker-end"].forEach(p => {
      const val = style.getPropertyValue(p);
      if (val && val.includes("url(")) {
        const idMatch = val.match(/#([^"']+)/);
        if (idMatch) c.setAttribute(p, `url(#${idMatch[1]})`);
      }
    });
  }

  // 4. Embed Animation Styles (Basic pulse + final state)
  const styleBlock = document.createElementNS("http://www.w3.org/2000/svg", "style");
  styleBlock.textContent = `
    @keyframes pulse-glow { 0%, 100% { filter: drop-shadow(0 0 4px #7c3aed88); } 50% { filter: drop-shadow(0 0 12px #7c3aed88); } }
    .state-accepted { animation: pulse-glow 2s infinite !important; }
    .state-accepted circle { stroke: #10b981 !important; stroke-width: 3 !important; }
    text { pointer-events: none; }
  `;
  
  let defs = clone.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    clone.appendChild(defs);
  }
  defs.appendChild(styleBlock);

  // 5. Build SMIL Timeline if steps are present
  if (steps && steps.length > 0) {
    const stepDur = 1.0;
    const totalDur = steps.length * stepDur;
    
    // Add particles for transitions
    const particleGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    clone.appendChild(particleGroup);

    steps.forEach((step, i) => {
      if (i === 0) return; // Particles start at first transition
      const startTime = (i - 1) * stepDur;
      const endTime = i * stepDur;

      const particle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      particle.setAttribute("r", "5");
      particle.setAttribute("fill", "#a78bfa");
      particle.setAttribute("opacity", "0");
      
      const move = document.createElementNS("http://www.w3.org/2000/svg", "animateMotion");
      move.setAttribute("dur", `${totalDur}s`);
      move.setAttribute("repeatCount", "indefinite");
      move.setAttribute("keyPoints", "0;0;1;1");
      move.setAttribute("keyTimes", `0;${startTime/totalDur};${endTime/totalDur};1`);
      const mpath = document.createElementNS("http://www.w3.org/2000/svg", "mpath");
      mpath.setAttributeNS("http://www.w3.org/1999/xlink", "href", `#${step.edgeId}`);
      move.appendChild(mpath);
      particle.appendChild(move);

      const opac = document.createElementNS("http://www.w3.org/2000/svg", "animate");
      opac.setAttribute("attributeName", "opacity");
      opac.setAttribute("dur", `${totalDur}s`);
      opac.setAttribute("repeatCount", "indefinite");
      opac.setAttribute("values", "0;0;1;1;0;0");
      opac.setAttribute("keyTimes", `0;${startTime/totalDur};${(startTime+0.1)/totalDur};${(endTime-0.1)/totalDur};${endTime/totalDur};1`);
      particle.appendChild(opac);
      particleGroup.appendChild(particle);

      // Edge glow during transition
      const edge = clone.querySelector(`#${step.edgeId}`);
      if (edge) {
        const edgeAnim = document.createElementNS("http://www.w3.org/2000/svg", "animate");
        edgeAnim.setAttribute("attributeName", "stroke");
        edgeAnim.setAttribute("dur", `${totalDur}s`);
        edgeAnim.setAttribute("repeatCount", "indefinite");
        const baseColor = edge.style.stroke || "#475569";
        edgeAnim.setAttribute("values", `${baseColor};${baseColor};#8b5cf6;${baseColor};${baseColor}`);
        edgeAnim.setAttribute("keyTimes", `0;${startTime/totalDur};${(startTime+endTime)/2/totalDur};${endTime/totalDur};1`);
        edge.appendChild(edgeAnim);
      }
    });

    // Node state highlights
    const uniqueStates = [...new Set(steps.map(s => s.state))];
    uniqueStates.forEach(stateId => {
      const nodeG = clone.querySelector(`#node-${stateId}`);
      const circle = nodeG?.querySelector('circle');
      if (!circle) return;

      const nodeAnim = document.createElementNS("http://www.w3.org/2000/svg", "animate");
      nodeAnim.setAttribute("attributeName", "stroke");
      nodeAnim.setAttribute("dur", `${totalDur}s`);
      nodeAnim.setAttribute("repeatCount", "indefinite");
      
      const baseStroke = circle.style.stroke || "#475569";
      let values = [baseStroke];
      let keyTimes = [0];
      
      steps.forEach((s, idx) => {
        const time = idx * stepDur;
        const isActive = s.state === stateId;
        values.push(isActive ? "#8b5cf6" : baseStroke);
        keyTimes.push(time / totalDur);
      });
      
      values.push(values[values.length-1]);
      keyTimes.push(1);
      
      nodeAnim.setAttribute("values", values.join(";"));
      nodeAnim.setAttribute("keyTimes", keyTimes.join(";"));
      circle.appendChild(nodeAnim);
    });
  }

  return clone;
}

function exportSVG() {
  const svgEl = document.getElementById('graph-svg');
  // Pass simulationSteps if they exist to create an animated loop
  const styledClone = createStyledExportClone(svgEl, simulationSteps);
  const serializer = new XMLSerializer();
  let svgData = serializer.serializeToString(styledClone);
  
  // Add XML declaration
  svgData = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + svgData;
  
  const blob = new Blob([svgData], {type: "image/svg+xml;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "automaton.svg";
  link.click();
  URL.revokeObjectURL(url);
}

function exportPNG() {
  const svgEl = document.getElementById('graph-svg');
  const styledClone = createStyledExportClone(svgEl);
  const serializer = new XMLSerializer();
  const svgData = serializer.serializeToString(styledClone);
  
  const width = parseInt(styledClone.getAttribute("width"));
  const height = parseInt(styledClone.getAttribute("height"));
  const scale = 3; // 3x High resolution

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");

  const img = new Image();
  const svgBlob = new Blob([svgData], {type: "image/svg+xml;charset=utf-8"});
  const url = URL.createObjectURL(svgBlob);

  img.onload = function() {
    // Canvas background
    ctx.fillStyle = "#0d0d0f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw SVG
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    const pngUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = pngUrl;
    link.download = "automaton.png";
    link.click();
    URL.revokeObjectURL(url);
  };
  img.src = url;
}
