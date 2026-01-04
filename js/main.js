// Main app logic - tab switching, URL params, initialization

const App = {
  calculators: {
    fifo: FifoCalc,
    cdc: CdcCalc,
    timing: TimingCalc,
    fixedpoint: FixedPointCalc,
    pll: PllCalc
  },

  currentCalc: 'fifo',

  init() {
    // Initialize all calculators
    Object.values(this.calculators).forEach(calc => calc.init());

    // Set up tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchTab(tab.dataset.calc);
      });
    });

    // Set up preset selectors
    this.initPresets();

    // Load state from URL
    this.loadFromUrl();

    // Update URL when inputs change
    document.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', () => this.updateUrl());
    });
  },

  initPresets() {
    // CDC presets
    const cdcPreset = document.getElementById('cdc-preset');
    if (cdcPreset) {
      cdcPreset.addEventListener('change', () => {
        if (cdcPreset.value) {
          DevicePresets.apply('cdc', cdcPreset.value, CdcCalc);
          this.updateUrl();
        }
      });
    }

    // Timing presets
    const timingPreset = document.getElementById('timing-preset');
    if (timingPreset) {
      timingPreset.addEventListener('change', () => {
        if (timingPreset.value) {
          DevicePresets.apply('timing', timingPreset.value, TimingCalc);
          this.updateUrl();
        }
      });
    }

    // PLL presets
    const pllPreset = document.getElementById('pll-preset');
    if (pllPreset) {
      pllPreset.addEventListener('change', () => {
        if (pllPreset.value) {
          DevicePresets.apply('pll', pllPreset.value, PllCalc);
          this.updateUrl();
        }
      });
    }
  },

  switchTab(calcId) {
    if (!this.calculators[calcId]) return;

    this.currentCalc = calcId;

    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.calc === calcId);
    });

    // Update calculator visibility
    document.querySelectorAll('.calculator').forEach(calc => {
      calc.classList.toggle('active', calc.id === calcId);
    });

    this.updateUrl();
  },

  loadFromUrl() {
    const params = new URLSearchParams(window.location.search);

    // Get active calculator
    const calcId = params.get('calc');
    if (calcId && this.calculators[calcId]) {
      this.switchTab(calcId);
    }

    // Load calculator-specific state
    const state = {};
    params.forEach((value, key) => {
      if (key !== 'calc') {
        state[key] = value;
      }
    });

    if (Object.keys(state).length > 0 && this.calculators[this.currentCalc]) {
      this.calculators[this.currentCalc].setState(state);
    }
  },

  updateUrl() {
    const calc = this.calculators[this.currentCalc];
    if (!calc) return;

    const state = calc.getState();
    const params = new URLSearchParams();

    params.set('calc', this.currentCalc);

    Object.entries(state).forEach(([key, value]) => {
      if (value !== '' && value !== undefined) {
        params.set(key, value);
      }
    });

    const newUrl = window.location.pathname + '?' + params.toString();
    window.history.replaceState({}, '', newUrl);
  }
};

// Copy to clipboard functionality
const CopyResults = {
  init() {
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', () => this.copy(btn));
    });
  },

  copy(btn) {
    const calcType = btn.dataset.calc;
    const text = this.getResultsText(calcType);

    if (!text) return;

    navigator.clipboard.writeText(text).then(() => {
      // Show copied feedback
      const originalText = btn.innerHTML;
      btn.classList.add('copied');
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Copied!
      `;

      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = originalText;
      }, 1500);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  },

  getResultsText(calcType) {
    switch (calcType) {
      case 'fifo':
        return this.formatResults('FIFO Depth Calculator', [
          ['Write Clock', document.getElementById('fifo-fwrite').value + ' MHz'],
          ['Read Clock', document.getElementById('fifo-fread').value + ' MHz'],
          ['Burst Length', document.getElementById('fifo-burst').value + ' words'],
          ['Read Latency', document.getElementById('fifo-latency').value + ' cycles'],
          ['---'],
          ['Minimum Depth', document.getElementById('fifo-min-depth').textContent],
          ['Power of 2', document.getElementById('fifo-pow2-depth').textContent]
        ]);

      case 'cdc':
        return this.formatResults('CDC MTBF Calculator', [
          ['Data Clock', document.getElementById('cdc-fdata').value + ' MHz'],
          ['Sampling Clock', document.getElementById('cdc-fsample').value + ' MHz'],
          ['Metastability Window', document.getElementById('cdc-twindow').value + ' ps'],
          ['Time Constant (τ)', document.getElementById('cdc-tau').value + ' ps'],
          ['Sync Stages', document.getElementById('cdc-stages').value],
          ['Setup Time', document.getElementById('cdc-tsetup').value + ' ns'],
          ['---'],
          ['Resolution Time', document.getElementById('cdc-tresolve').textContent],
          ['MTBF', document.getElementById('cdc-mtbf').textContent],
          ['Recommendation', document.getElementById('cdc-recommendation').textContent]
        ]);

      case 'timing':
        return this.formatResults('Timing Budget Calculator', [
          ['Clock Frequency', document.getElementById('timing-freq').value + ' MHz'],
          ['Setup Time', document.getElementById('timing-tsetup').value + ' ns'],
          ['Clock Uncertainty', document.getElementById('timing-tuncert').value + ' ns'],
          ['Clock-to-Q', document.getElementById('timing-tclkq').value + ' ns'],
          ['LUT Delay', document.getElementById('timing-tlut').value + ' ns'],
          ['---'],
          ['Clock Period', document.getElementById('timing-period').textContent],
          ['Available for Logic', document.getElementById('timing-available').textContent],
          ['Est. Logic Levels', document.getElementById('timing-levels').textContent]
        ]);

      case 'fixedpoint':
        return this.formatResults('Fixed-Point Calculator', [
          ['Min Value', document.getElementById('fp-min').value],
          ['Max Value', document.getElementById('fp-max').value],
          ['Required Precision', document.getElementById('fp-precision').value],
          ['Signed', document.getElementById('fp-signed').checked ? 'Yes' : 'No'],
          ['---'],
          ['Integer Bits', document.getElementById('fp-int-bits').textContent],
          ['Fractional Bits', document.getElementById('fp-frac-bits').textContent],
          ['Total Width', document.getElementById('fp-total-bits').textContent],
          ['Q Notation', document.getElementById('fp-q-notation').textContent],
          ['Actual Range', document.getElementById('fp-actual-range').textContent],
          ['Actual Precision', document.getElementById('fp-actual-precision').textContent]
        ]);

      case 'pll':
        return this.formatPllResults();

      default:
        return '';
    }
  },

  formatResults(title, rows) {
    let text = title + '\n';
    text += '='.repeat(title.length) + '\n\n';

    rows.forEach(row => {
      if (row[0] === '---') {
        text += '\n';
      } else {
        text += row[0] + ': ' + row[1] + '\n';
      }
    });

    text += '\nGenerated by fpga_calc (bitwiz.io)';
    return text;
  },

  formatPllResults() {
    const table = document.querySelector('#pll-results table');
    if (!table) return '';

    let text = 'PLL/MMCM Configuration\n';
    text += '======================\n\n';
    text += 'Input: ' + document.getElementById('pll-fin').value + ' MHz\n';
    text += 'Target: ' + document.getElementById('pll-fout').value + ' MHz\n\n';

    // Get table data
    const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent);
    const rows = Array.from(table.querySelectorAll('tbody tr'));

    // Format as aligned table
    text += headers.join('\t') + '\n';
    text += '-'.repeat(40) + '\n';

    rows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent);
      text += cells.join('\t') + '\n';
    });

    text += '\nGenerated by fpga_calc (bitwiz.io)';
    return text;
  }
};

// Help tooltip touch support for mobile
const HelpTooltips = {
  init() {
    // Close tooltips when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.help-wrapper')) {
        document.querySelectorAll('.help-tooltip.active').forEach(tip => {
          tip.classList.remove('active');
        });
      }
    });

    // Toggle tooltip on click (for touch devices)
    document.querySelectorAll('.help-icon').forEach(icon => {
      icon.addEventListener('click', (e) => {
        e.stopPropagation();
        const tooltip = icon.nextElementSibling;
        const isActive = tooltip.classList.contains('active');

        // Close all other tooltips
        document.querySelectorAll('.help-tooltip.active').forEach(tip => {
          tip.classList.remove('active');
        });

        // Toggle this one
        if (!isActive) {
          tooltip.classList.add('active');
        }
      });
    });
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
  HelpTooltips.init();
  CopyResults.init();
});
