# Σ Automata Visualizer

A professional-grade, interactive web-based tool for designing and simulating Deterministic Finite Automata (DFA) and Non-deterministic Finite Automata (NFA). This tool features a robust physics-based graph layout engine and real-time step-by-step simulation.

## ✨ Features

- **Dual Mode Support**: Seamlessly switch between DFA and NFA simulations.
- **Dynamic Graph Layout**: Automated physics-based positioning of states using a force-directed layout engine to minimize overlap and ensure clarity.
- **Interactive Simulation**: 
  - Real-time step-by-step processing of input strings.
  - Playback controls: Play, Pause, Step Forward/Backward, and Reset.
  - Adjustable simulation speed.
- **Visual Validation**: Real-time error checking for automaton definitions (e.g., missing transitions, invalid start states).
- **High-Fidelity Export**: Export your generated automata diagrams as high-quality **SVG** or **PNG** files.
- **Modern UI**: Sleek, glassmorphic design with dark mode support and responsive SVG rendering.

## 🚀 Getting Started

### Prerequisites

- Any modern web browser (Chrome, Firefox, Safari, Edge).

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/shivammane2007/DFA-Visualizer.git
   ```
2. Open `index.html` in your browser.

## 🛠️ Built With

- **HTML5**: Semantic structure.
- **CSS3**: Premium styling with modern typography (IBM Plex Mono & Space Mono).
- **JavaScript (Vanilla)**: Core logic for automata simulation and graph rendering.
- **SVG**: For high-performance, scalable vector graphics.

## 📖 Usage Instructions

1. **Define States**: Enter your states as a comma-separated list (e.g., `q0, q1, q2`).
2. **Define Alphabet**: Specify symbols used in your automaton (e.g., `0, 1`).
3. **Set Transitions**: Add transition rows defining the source state, input symbol, and target state(s).
4. **Input String**: Provide the string you want to test against the automaton.
5. **Generate & Simulate**: Click the ⚡ button to build the graph and start the simulation.
6. **Control Playback**: Use the toolbar to step through the simulation and observe state changes visually.

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

---
*Created with ❤️ for Automata Theory enthusiasts.*
