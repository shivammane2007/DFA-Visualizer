// AI / Rule-Based Automaton Problem Generator Engine

function loadProblemExample(text) {
  document.getElementById('inp-problem').value = text;
}

function clearProblem() {
  document.getElementById('inp-problem').value = '';
  document.getElementById('generator-error').style.display = 'none';
}

function showError(msg) {
  const errDiv = document.getElementById('generator-error');
  errDiv.textContent = msg;
  errDiv.style.display = 'block';
}

function generateFromProblem() {
  const text = document.getElementById('inp-problem').value.trim();
  document.getElementById('generator-error').style.display = 'none';
  if (!text) {
    showError("Please enter a problem statement.");
    return;
  }
  
  try {
    const dfa = parseProblem(text);
    if (!dfa) {
      showError("Unable to generate automaton for this problem.");
      return;
    }
    fillExistingForm(dfa);
  } catch (e) {
    showError(e.message || "An error occurred during generation.");
  }
}

function parseProblem(text) {
  const t = text.toLowerCase().replace(/[.,]/g, '').trim();
  
  // 1. Starts with
  let m = t.match(/(?:start|starts|starting|begins|begin)\s+with\s+([a-z0-9]+)/);
  if (!m) m = t.match(/prefix\s+([a-z0-9]+)/);
  if (m) return generateStartsWith(m[1]);

  // 2. Ends with
  m = t.match(/ends with ([a-z0-9]+)/) || t.match(/ending with ([a-z0-9]+)/);
  if (m) return generateEndsWith(m[1]);

  // 3. Contains / Substring
  m = t.match(/contains substring ([a-z0-9]+)/) || t.match(/contains ([a-z0-9]+)/) || t.match(/substring ([a-z0-9]+)/);
  if (m) return generateContains(m[1]);

  // 4. Exactly
  m = t.match(/exactly ([a-z0-9]+)/);
  if (m) return generateExactly(m[1]);

  // 5. Parity (Even / Odd)
  m = t.match(/even number of ([a-z0-9])s?/);
  if (m) return generateParity(m[1], 'even');

  m = t.match(/odd number of ([a-z0-9])s?/);
  if (m) return generateParity(m[1], 'odd');

  // 6. Divisible
  m = t.match(/divisible by (\d+)/);
  if (m) return generateDivisible(parseInt(m[1], 10));

  return null;
}

// Extract alphabet from string, default to binary if simple
function getAlphabet(str) {
  const chars = [...new Set(str.split(''))];
  if (chars.every(c => c === '0' || c === '1')) return ['0', '1'];
  return chars.length > 0 ? chars : ['0', '1'];
}

function generateStartsWith(pattern) {
  const alphabet = getAlphabet(pattern);
  const states = [];
  
  for (let i = 0; i <= pattern.length; i++) {
    states.push(`q${i}`);
  }
  states.push("qd");
  
  const final = [`q${pattern.length}`];
  const transitions = [];
  
  for (let i = 0; i < pattern.length; i++) {
    for (const sym of alphabet) {
      const to = sym === pattern[i] ? `q${i+1}` : "qd";
      transitions.push({
        from: `q${i}`,
        symbol: sym,
        to
      });
    }
  }
  
  for (const sym of alphabet) {
    transitions.push({ from: `q${pattern.length}`, symbol: sym, to: `q${pattern.length}` });
    transitions.push({ from: "qd", symbol: sym, to: "qd" });
  }
  
  return {
    type: "DFA",
    states,
    alphabet,
    start: "q0",
    final,
    transitions
  };
}

function generateEndsWith(str) {
  const alphabet = getAlphabet(str);
  const states = [];
  const transitions = [];
  
  for (let i = 0; i <= str.length; i++) states.push(`q${i}`);
  
  // Transition logic based on longest prefix that is also a suffix
  for (let i = 0; i <= str.length; i++) {
    const currentPrefix = str.substring(0, i);
    alphabet.forEach(sym => {
      const newStr = currentPrefix + sym;
      let targetLen = 0;
      // Find longest prefix of str that is a suffix of newStr
      for (let j = Math.min(newStr.length, str.length); j >= 0; j--) {
        if (newStr.endsWith(str.substring(0, j))) {
          targetLen = j;
          break;
        }
      }
      transitions.push({ from: `q${i}`, symbol: sym, to: `q${targetLen}` });
    });
  }
  
  return { type: 'DFA', states, alphabet, start: 'q0', final: [`q${str.length}`], transitions };
}

function generateContains(str) {
  const alphabet = getAlphabet(str);
  const states = [];
  const transitions = [];
  
  for (let i = 0; i <= str.length; i++) states.push(`q${i}`);
  
  for (let i = 0; i < str.length; i++) {
    const currentPrefix = str.substring(0, i);
    alphabet.forEach(sym => {
      const newStr = currentPrefix + sym;
      let targetLen = 0;
      for (let j = Math.min(newStr.length, str.length); j >= 0; j--) {
        if (newStr.endsWith(str.substring(0, j))) {
          targetLen = j;
          break;
        }
      }
      transitions.push({ from: `q${i}`, symbol: sym, to: `q${targetLen}` });
    });
  }
  
  // Final state loops infinitely
  alphabet.forEach(sym => {
    transitions.push({ from: `q${str.length}`, symbol: sym, to: `q${str.length}` });
  });
  
  return { type: 'DFA', states, alphabet, start: 'q0', final: [`q${str.length}`], transitions };
}

function generateExactly(str) {
  const alphabet = getAlphabet(str);
  const states = [];
  const transitions = [];
  
  for (let i = 0; i <= str.length; i++) states.push(`q${i}`);
  const trap = 'qd';
  states.push(trap);
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    alphabet.forEach(sym => {
      if (sym === char) {
        transitions.push({ from: `q${i}`, symbol: sym, to: `q${i+1}` });
      } else {
        transitions.push({ from: `q${i}`, symbol: sym, to: trap });
      }
    });
  }
  
  alphabet.forEach(sym => {
    transitions.push({ from: `q${str.length}`, symbol: sym, to: trap });
    transitions.push({ from: trap, symbol: sym, to: trap });
  });
  
  return { type: 'DFA', states, alphabet, start: 'q0', final: [`q${str.length}`], transitions };
}

function generateParity(char, type) {
  const alphabet = ['0', '1'];
  if (!alphabet.includes(char)) alphabet.push(char);
  
  const states = ['qEven', 'qOdd'];
  const transitions = [];
  
  alphabet.forEach(sym => {
    if (sym === char) {
      transitions.push({ from: 'qEven', symbol: sym, to: 'qOdd' });
      transitions.push({ from: 'qOdd', symbol: sym, to: 'qEven' });
    } else {
      transitions.push({ from: 'qEven', symbol: sym, to: 'qEven' });
      transitions.push({ from: 'qOdd', symbol: sym, to: 'qOdd' });
    }
  });
  
  const finalState = type === 'even' ? 'qEven' : 'qOdd';
  return { type: 'DFA', states, alphabet, start: 'qEven', final: [finalState], transitions };
}

function generateDivisible(n) {
  if (n < 1 || n > 20) throw new Error("Please specify a number between 1 and 20.");
  
  const alphabet = ['0', '1'];
  const states = [];
  const transitions = [];
  
  for (let i = 0; i < n; i++) states.push(`q${i}`);
  
  for (let i = 0; i < n; i++) {
    transitions.push({ from: `q${i}`, symbol: '0', to: `q${(i * 2) % n}` });
    transitions.push({ from: `q${i}`, symbol: '1', to: `q${(i * 2 + 1) % n}` });
  }
  
  return { type: 'DFA', states, alphabet, start: 'q0', final: ['q0'], transitions };
}

function preserveInputString() {
  const el = document.getElementById('inp-string');
  return el ? el.value : "";
}

function clearOldAutomaton() {
  document.getElementById('inp-states').value = "";
  document.getElementById('inp-alphabet').value = "";
  document.getElementById('inp-start').value = "";
  document.getElementById('inp-final').value = "";
  
  const container = document.getElementById('transitions-container');
  if (container) {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  }
}

function applyGeneratedAutomaton(dfa) {
  if (typeof switchMode === 'function') switchMode(dfa.type);
  
  document.getElementById('inp-states').value = dfa.states.join(', ');
  document.getElementById('inp-alphabet').value = dfa.alphabet.join(', ');
  document.getElementById('inp-start').value = dfa.start;
  document.getElementById('inp-final').value = dfa.final.join(', ');
  
  dfa.transitions.forEach(t => {
    if (typeof addTransitionRow === 'function') {
      addTransitionRow(t.from, t.symbol, t.to);
    }
  });
}

function triggerRender() {
  if (typeof generateAndSimulate === 'function') {
    generateAndSimulate();
  }
}

function fillExistingForm(dfa) {
  const existingInput = preserveInputString();
  clearOldAutomaton();
  applyGeneratedAutomaton(dfa);
  // explicitly re-assigning just in case, though we didn't touch it
  const el = document.getElementById('inp-string');
  if (el) el.value = existingInput;
  triggerRender();
}
