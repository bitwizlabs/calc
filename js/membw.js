// Memory Bandwidth Calculator
// Calculate effective DDR bandwidth with efficiency breakdown
//
// Formulas:
//   Peak_BW = Data_Rate × Bus_Width / 8 / 1000 (GB/s)
//   Effective_BW = Peak_BW × Efficiency
//
// Sources: JEDEC JESD79-4C (DDR4), JESD79-5C (DDR5), STREAM benchmarks

const DDR_SPECS = {
  ddr3: {
    name: 'DDR3',
    burstLengths: [4, 8],
    defaultBurstLen: 8,
    prefetchBits: 8,
    banksPerGroup: 8,
    bankGroups: [1],
    timing: {
      tRFC: { min: 110, max: 350, typical: 260 },
      tREFI: 7800,
      tRCD: 13.75,
      tRP: 13.75,
      tRAS: 35,
      tRC: 48.75,
      tRTP: 7.5,
      tWR: 15,
      tWTR: 7.5,
      tCCD: 4,
      tRRD: 5,
      tFAW: 40
    },
    dataRates: [800, 1066, 1333, 1600, 1866, 2133]
  },

  ddr4: {
    name: 'DDR4',
    burstLengths: [4, 8],
    defaultBurstLen: 8,
    prefetchBits: 8,
    banksPerGroup: 4,
    bankGroups: [1, 2, 4],
    defaultBankGroups: 4,
    timing: {
      tRFC: { min: 260, max: 550, typical: 350 },
      tREFI: 7800,
      tRCD: 13.75,
      tRP: 13.75,
      tRAS: 32,
      tRC: 45.75,
      tRTP: 7.5,
      tWR: 15,
      tWTR_S: 2.5,
      tWTR_L: 7.5,
      tCCD_S: 4,
      tCCD_L: 5,
      tRRD_S: 2.5,
      tRRD_L: 4.9,
      tFAW: 30
    },
    dataRates: [1600, 1866, 2133, 2400, 2666, 2933, 3200]
  },

  ddr5: {
    name: 'DDR5',
    burstLengths: [8, 16],
    defaultBurstLen: 16,
    prefetchBits: 16,
    banksPerGroup: 4,
    bankGroups: [4, 8],
    defaultBankGroups: 8,
    subchannels: 2,
    bitsPerSubchannel: 32,
    features: ['onDieECC', 'sameBankRefresh', 'decisionFeedbackEQ'],
    timing: {
      tRFC: { min: 295, max: 410, typical: 295 },
      tRFCsb: 130,
      tREFI: 3900,
      tRCD: 14.16,
      tRP: 14.16,
      tRAS: 32,
      tRC: 46.16,
      tRTP: 7.5,
      tWR: 30,
      tWTR_S: 2.5,
      tWTR_L: 10,
      tCCD_S: 8,
      tCCD_L: 8,
      tRRD_S: 2.5,
      tRRD_L: 5,
      tFAW: 32
    },
    dataRates: [4000, 4400, 4800, 5200, 5600, 6000, 6400, 6800, 7200, 7600, 8000, 8400, 8800]
  },

  lpddr4: {
    name: 'LPDDR4',
    burstLengths: [16, 32],
    defaultBurstLen: 16,
    prefetchBits: 16,
    banksPerGroup: 4,
    bankGroups: [2],
    features: ['bankRefresh', 'deepPowerDown'],
    timing: {
      tRFC: { min: 130, max: 280, typical: 210 },
      tREFI: 3900,
      tRCD: 18,
      tRP: 18,
      tRAS: 42,
      tRC: 60,
      tRTP: 7.5,
      tWR: 18,
      tWTR: 10,
      tRRD: 10,
      tFAW: 40
    },
    dataRates: [1600, 2133, 3200, 3733, 4266]
  },

  lpddr5: {
    name: 'LPDDR5',
    burstLengths: [16, 32],
    defaultBurstLen: 16,
    prefetchBits: 16,
    banksPerGroup: 4,
    bankGroups: [4],
    features: ['bankRefresh', 'linkECC', 'wckClock'],
    timing: {
      tRFC: { min: 130, max: 280, typical: 210 },
      tREFI: 3900,
      tRCD: 18,
      tRP: 18,
      tRAS: 42,
      tRC: 60,
      tRTP: 7.5,
      tWR: 18,
      tWTR: 10,
      tRRD: 10,
      tFAW: 40
    },
    dataRates: [4267, 5500, 6400, 7500, 8533]
  }
};

// Workload presets for quick configuration
const WORKLOAD_PRESETS = {
  stream: {
    name: 'STREAM Benchmark',
    pagehit: 95,
    rwratio: 67,
    controller: 'server',
    description: 'Sequential streaming benchmark - best-case scenario'
  },
  video: {
    name: 'Video Processing',
    pagehit: 90,
    rwratio: 85,
    controller: 'desktop',
    description: 'Video decode/encode with frame buffers'
  },
  database: {
    name: 'Database OLTP',
    pagehit: 60,
    rwratio: 60,
    controller: 'server',
    description: 'Online transaction processing - random index lookups'
  },
  'ml-inference': {
    name: 'ML Inference',
    pagehit: 85,
    rwratio: 90,
    controller: 'server',
    description: 'Neural network inference - mostly weight reads'
  },
  'ml-training': {
    name: 'ML Training',
    pagehit: 75,
    rwratio: 40,
    controller: 'server',
    description: 'Neural network training - heavy gradient writes'
  },
  random: {
    name: 'Random Access',
    pagehit: 20,
    rwratio: 50,
    controller: 'server',
    description: 'Worst-case: pointer chasing, hash tables, random I/O'
  }
};

// Efficiency model coefficients (validated against benchmarks)
const EFFICIENCY_MODEL = {
  baseEfficiency: 0.88,
  pageMissPenaltyCoeff: 0.30,
  turnaroundPenaltyCoeff: 0.16,

  controllerQuality: {
    fpgaBasic: 0.85,
    fpgaOptimized: 0.92,
    desktop: 0.94,
    server: 0.97
  },

  ddrGenerationBonus: {
    ddr3: 0.00,
    ddr4: 0.00,
    ddr5: 0.03,
    lpddr4: -0.02,
    lpddr5: 0.01
  }
};

const MemBwCalc = {
  elements: {},

  init() {
    this.elements = {
      ddrgen: document.getElementById('mem-ddrgen'),
      datarate: document.getElementById('mem-datarate'),
      buswidth: document.getElementById('mem-buswidth'),
      ranks: document.getElementById('mem-ranks'),
      burstlen: document.getElementById('mem-burstlen'),
      pagehit: document.getElementById('mem-pagehit'),
      rwratio: document.getElementById('mem-rwratio'),
      controller: document.getElementById('mem-controller'),
      // Advanced timing inputs
      trfc: document.getElementById('mem-trfc'),
      trefi: document.getElementById('mem-trefi'),
      trcd: document.getElementById('mem-trcd'),
      trp: document.getElementById('mem-trp'),
      // Results container
      results: document.getElementById('mem-results')
    };

    // Bind input events
    const inputs = [
      this.elements.datarate,
      this.elements.pagehit,
      this.elements.rwratio,
      this.elements.trfc,
      this.elements.trefi,
      this.elements.trcd,
      this.elements.trp
    ];
    inputs.forEach(input => {
      if (input) input.addEventListener('input', () => this.calculate());
    });

    // Bind select change events
    const selects = [
      this.elements.ddrgen,
      this.elements.buswidth,
      this.elements.ranks,
      this.elements.burstlen,
      this.elements.controller
    ];
    selects.forEach(select => {
      if (select) select.addEventListener('change', () => {
        if (select === this.elements.ddrgen) {
          this.updateDefaults();
          this.validateDataRate();
        }
        this.calculate();
      });
    });

    // Bind workload preset buttons
    document.querySelectorAll('.preset-btn[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const presetKey = btn.dataset.preset;
        this.applyPreset(presetKey);
      });
    });

    // Set initial defaults and calculate
    this.updateDefaults();
    this.calculate();
  },

  applyPreset(presetKey) {
    const preset = WORKLOAD_PRESETS[presetKey];
    if (!preset) return;

    this.elements.pagehit.value = preset.pagehit;
    this.elements.rwratio.value = preset.rwratio;
    this.elements.controller.value = preset.controller;

    // Visual feedback
    [this.elements.pagehit, this.elements.rwratio, this.elements.controller].forEach(el => {
      el.classList.add('preset-applied');
      setTimeout(() => el.classList.remove('preset-applied'), 500);
    });

    this.calculate();
  },

  validateDataRate() {
    const ddrGen = this.elements.ddrgen.value;
    const dataRate = parseInt(this.elements.datarate.value);
    const specs = DDR_SPECS[ddrGen];
    if (!specs || !specs.dataRates) return;

    const validRates = specs.dataRates;
    const minRate = Math.min(...validRates);
    const maxRate = Math.max(...validRates);

    this.elements.datarate.classList.remove('input-error');

    if (dataRate < minRate || dataRate > maxRate) {
      this.elements.datarate.classList.add('input-error');
    }
  },

  validateInputs() {
    const errors = [];

    const pageHit = parseFloat(this.elements.pagehit.value);
    if (isNaN(pageHit) || pageHit < 0 || pageHit > 100) {
      errors.push({
        field: 'pagehit',
        message: 'Page hit rate must be between 0% and 100%'
      });
    }

    const rwRatio = parseFloat(this.elements.rwratio.value);
    if (isNaN(rwRatio) || rwRatio < 0 || rwRatio > 100) {
      errors.push({
        field: 'rwratio',
        message: 'Read ratio must be between 0% and 100%'
      });
    }

    const ddrGen = this.elements.ddrgen.value;
    const dataRate = parseInt(this.elements.datarate.value);
    const specs = DDR_SPECS[ddrGen];
    if (specs && specs.dataRates) {
      const minRate = Math.min(...specs.dataRates);
      const maxRate = Math.max(...specs.dataRates);
      if (dataRate < minRate * 0.8 || dataRate > maxRate * 1.2) {
        errors.push({
          field: 'datarate',
          message: `Data rate ${dataRate} MT/s is unusual for ${ddrGen.toUpperCase()}. Expected ${minRate}-${maxRate} MT/s.`,
          isWarning: true
        });
      }
    }

    return errors;
  },

  updateDefaults() {
    const specs = DDR_SPECS[this.elements.ddrgen.value];
    if (!specs) return;

    // Update placeholders
    if (this.elements.trfc) this.elements.trfc.placeholder = specs.timing.tRFC.typical;
    if (this.elements.trefi) this.elements.trefi.placeholder = specs.timing.tREFI;
    if (this.elements.trcd) this.elements.trcd.placeholder = specs.timing.tRCD;
    if (this.elements.trp) this.elements.trp.placeholder = specs.timing.tRP;

    // Update burst length default based on DDR gen
    if (this.elements.burstlen) {
      this.elements.burstlen.value = specs.defaultBurstLen;
    }
  },

  calculate() {
    const ddrGen = this.elements.ddrgen.value;
    const dataRate = parseFloat(this.elements.datarate.value);
    const busWidth = parseInt(this.elements.buswidth.value);
    const ranks = parseInt(this.elements.ranks.value);
    const burstLen = parseInt(this.elements.burstlen.value);
    const pageHitRate = parseFloat(this.elements.pagehit.value) / 100;
    const rwRatio = parseFloat(this.elements.rwratio.value) / 100;
    const controllerType = this.elements.controller?.value || 'desktop';

    const specs = DDR_SPECS[ddrGen];
    const tRFC = parseFloat(this.elements.trfc.value) || specs.timing.tRFC.typical;
    const tREFI = parseFloat(this.elements.trefi.value) || specs.timing.tREFI;

    // Input validation
    if (!dataRate || dataRate <= 0 || !busWidth || busWidth <= 0) {
      this.showPlaceholder();
      return;
    }

    // === PEAK BANDWIDTH ===
    const peakBW = dataRate * busWidth / 8 / 1000;  // GB/s

    // === VALIDATED EMPIRICAL MODEL ===

    // 1. Page Miss Penalty
    const pageMissPenalty = (1 - pageHitRate) * EFFICIENCY_MODEL.pageMissPenaltyCoeff;

    // 2. Turnaround Penalty
    const turnaroundRate = 2 * rwRatio * (1 - rwRatio);
    const turnaroundPenalty = turnaroundRate * EFFICIENCY_MODEL.turnaroundPenaltyCoeff;

    // 3. Refresh Penalty
    const refreshPenalty = tRFC / tREFI;

    // 4. DDR Generation Bonus
    const ddrBonus = EFFICIENCY_MODEL.ddrGenerationBonus[ddrGen] || 0;

    // 5. Controller Quality Factor
    const controllerFactor = EFFICIENCY_MODEL.controllerQuality[controllerType] || 0.94;

    // 6. Rank Bonus
    const rankBonus = ranks > 1 ? 0.02 : 0.0;

    // === CALCULATE EFFICIENCY ===
    let rawEff = EFFICIENCY_MODEL.baseEfficiency
                 - pageMissPenalty
                 - turnaroundPenalty
                 - refreshPenalty
                 + ddrBonus
                 + rankBonus;

    let totalEff = rawEff * controllerFactor;

    // Sanity bounds
    totalEff = Math.min(totalEff, 0.95);
    totalEff = Math.max(totalEff, 0.15);

    const effectiveBW = peakBW * totalEff;

    // Build breakdown
    const breakdown = [
      {
        factor: 'Base Efficiency',
        value: EFFICIENCY_MODEL.baseEfficiency * 100,
        note: 'Calibrated against STREAM benchmark (80-95% achievable)'
      },
      {
        factor: 'Page Miss Penalty',
        value: -pageMissPenalty * 100,
        note: `${((1-pageHitRate)*100).toFixed(0)}% misses`
      },
      {
        factor: 'R/W Turnaround Penalty',
        value: -turnaroundPenalty * 100,
        note: `${(turnaroundRate*100).toFixed(1)}% transitions`
      },
      {
        factor: 'Refresh Overhead',
        value: -refreshPenalty * 100,
        note: `tRFC=${tRFC}ns / tREFI=${tREFI}ns`
      },
      {
        factor: 'DDR Generation',
        value: ddrBonus * 100,
        note: ddrGen.toUpperCase() + (ddrBonus > 0 ? ' bank parallelism bonus' : '')
      }
    ];

    if (ranks > 1) {
      breakdown.push({
        factor: 'Rank Interleaving',
        value: rankBonus * 100,
        note: `${ranks} ranks`
      });
    }

    breakdown.push({
      factor: 'Raw Efficiency',
      value: rawEff * 100,
      note: 'Before controller adjustment',
      isSubtotal: true
    });

    breakdown.push({
      factor: 'Controller Quality',
      value: (controllerFactor - 1) * rawEff * 100,
      note: `${controllerType} (x${controllerFactor.toFixed(2)})`
    });

    breakdown.push({
      factor: 'Final Efficiency',
      value: totalEff * 100,
      note: `${effectiveBW.toFixed(2)} GB/s effective`,
      isFinal: true
    });

    // Calculate secondary outputs
    const dataPerBurst = burstLen * busWidth / 8;
    const burstTime = burstLen * 1000 / dataRate;
    const peakTxns = (peakBW * 1e9) / dataPerBurst;
    const effTxns = (effectiveBW * 1e9) / dataPerBurst;

    const secondaryOutputs = {
      dataPerBurst,
      burstTime,
      peakTxns,
      effTxns
    };

    this.displayResults(peakBW, effectiveBW, totalEff, breakdown, secondaryOutputs);
  },

  showPlaceholder() {
    this.elements.results.innerHTML = '<p class="placeholder">Enter values to calculate...</p>';
  },

  displayResults(peakBW, effectiveBW, efficiency, breakdown, secondaryOutputs) {
    const validationErrors = this.validateInputs();
    const warnings = validationErrors.filter(e => e.isWarning);
    const errors = validationErrors.filter(e => !e.isWarning);

    let html = '';

    if (errors.length > 0) {
      html += '<div class="validation-errors">';
      errors.forEach(err => {
        html += `<p class="error-message">${err.message}</p>`;
      });
      html += '</div>';
    }

    if (warnings.length > 0) {
      html += '<div class="validation-warnings">';
      warnings.forEach(warn => {
        html += `<p class="warning-message">${warn.message}</p>`;
      });
      html += '</div>';
    }

    const formatTxns = (txns) => {
      if (txns >= 1e9) return (txns / 1e9).toFixed(2) + ' G txns/s';
      if (txns >= 1e6) return (txns / 1e6).toFixed(1) + ' M txns/s';
      return txns.toFixed(0) + ' txns/s';
    };

    html += `
      <div class="mem-summary">
        <div class="mem-peak">
          <span class="label">Peak Bandwidth</span>
          <span class="value">${peakBW.toFixed(2)} GB/s</span>
        </div>
        <div class="mem-effective">
          <span class="label">Effective Bandwidth</span>
          <span class="value">${effectiveBW.toFixed(2)} GB/s</span>
          <span class="efficiency">(${(efficiency * 100).toFixed(1)}% efficiency)</span>
        </div>
      </div>

      <div class="mem-secondary">
        <div class="secondary-item">
          <span class="label">Data per Burst</span>
          <span class="value" id="mem-burst-data">${secondaryOutputs.dataPerBurst} bytes</span>
        </div>
        <div class="secondary-item">
          <span class="label">Burst Time</span>
          <span class="value" id="mem-burst-time">${secondaryOutputs.burstTime.toFixed(2)} ns</span>
        </div>
        <div class="secondary-item">
          <span class="label">Peak Transactions</span>
          <span class="value" id="mem-peak-txns">${formatTxns(secondaryOutputs.peakTxns)}</span>
        </div>
        <div class="secondary-item">
          <span class="label">Effective Transactions</span>
          <span class="value" id="mem-eff-txns">${formatTxns(secondaryOutputs.effTxns)}</span>
        </div>
      </div>

      <h4>Efficiency Breakdown</h4>
      <table class="breakdown-table">
        <thead>
          <tr>
            <th>Factor</th>
            <th>Impact</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
    `;

    breakdown.forEach(item => {
      const isLoss = item.value < 0;
      const isGain = item.value > 0 && !item.isSubtotal && !item.isFinal;
      const lossClass = item.isFinal ? 'final' : (isLoss ? 'loss' : (isGain ? 'gain' : ''));

      let valueText;
      if (item.isSubtotal || item.isFinal) {
        valueText = item.value.toFixed(1) + '%';
      } else if (item.value === 0) {
        valueText = '-';
      } else if (item.value > 0) {
        valueText = '+' + item.value.toFixed(1) + '%';
      } else {
        valueText = item.value.toFixed(1) + '%';
      }

      const rowClass = item.isSubtotal ? ' class="subtotal"' : (item.isFinal ? ' class="final-row"' : '');
      html += `
        <tr${rowClass}>
          <td>${item.factor}</td>
          <td class="${lossClass}">${valueText}</td>
          <td class="note">${item.note}</td>
        </tr>
      `;
    });

    html += '</tbody></table>';

    html += this.generateGuidance(breakdown, efficiency);

    this.elements.results.innerHTML = html;
  },

  generateGuidance(breakdown, efficiency) {
    const losses = breakdown.filter(b => b.value < 0 && !b.isSubtotal && !b.isFinal);
    if (losses.length === 0) return '';

    losses.sort((a, b) => a.value - b.value);
    const biggestLoss = losses[0];

    let tips = [];

    if (biggestLoss.factor.includes('Page Miss')) {
      tips.push({
        title: 'Improve Page Hit Rate',
        suggestions: [
          'Use sequential access patterns where possible',
          'Increase burst sizes to read more data per row activation',
          'Reorganize data structures for better locality',
          'Use memory prefetching to hide row activation latency',
          'Consider tiling/blocking algorithms for matrix operations'
        ]
      });
    }

    if (biggestLoss.factor.includes('Turnaround')) {
      tips.push({
        title: 'Reduce Read/Write Turnaround',
        suggestions: [
          'Batch reads together, then batch writes (avoid interleaving)',
          'Use write-combining buffers to coalesce writes',
          'Consider double-buffering: read from one buffer while writing to another',
          'For FPGA: separate read and write AXI ports if controller supports it'
        ]
      });
    }

    if (biggestLoss.factor.includes('Refresh')) {
      tips.push({
        title: 'Refresh Overhead (Limited Control)',
        suggestions: [
          'This is inherent to DRAM - cannot be eliminated',
          'DDR5 same-bank refresh helps but still has overhead',
          'Consider: is your application truly bandwidth-limited, or latency-limited?',
          'For FPGA: some controllers support opportunistic refresh scheduling'
        ]
      });
    }

    if (biggestLoss.factor.includes('Controller')) {
      tips.push({
        title: 'Upgrade Controller Quality',
        suggestions: [
          'FPGA: Enable command reordering in MIG/PHY settings',
          'FPGA: Configure multiple bank machines (8 recommended for DDR4)',
          'FPGA: Use bank-aware address mapping (bank bits in lower address)',
          'FPGA: Consider IP cores with better scheduling'
        ]
      });
    }

    let efficiencyRating = '';
    if (efficiency >= 0.80) {
      efficiencyRating = '<p class="rating good">Excellent efficiency - close to streaming-optimized workloads.</p>';
    } else if (efficiency >= 0.65) {
      efficiencyRating = '<p class="rating okay">Good efficiency - typical for well-optimized mixed workloads.</p>';
    } else if (efficiency >= 0.50) {
      efficiencyRating = '<p class="rating warning">Moderate efficiency - review the suggestions below to identify improvement opportunities.</p>';
    } else {
      efficiencyRating = '<p class="rating poor">Low efficiency - significant optimization potential exists. Focus on the largest loss factors.</p>';
    }

    let html = '<div class="guidance-section">';
    html += '<h4>Analysis &amp; Recommendations</h4>';
    html += efficiencyRating;

    if (tips.length > 0) {
      html += `<p><strong>Biggest bottleneck:</strong> ${biggestLoss.factor} (${biggestLoss.value.toFixed(1)}%)</p>`;
      tips.forEach(tip => {
        html += `<details class="guidance-tip"><summary>${tip.title}</summary><ul>`;
        tip.suggestions.forEach(s => {
          html += `<li>${s}</li>`;
        });
        html += '</ul></details>';
      });
    }

    html += '</div>';
    return html;
  },

  getState() {
    return {
      ddrgen: this.elements.ddrgen.value,
      datarate: this.elements.datarate.value,
      buswidth: this.elements.buswidth.value,
      ranks: this.elements.ranks.value,
      burstlen: this.elements.burstlen.value,
      pagehit: this.elements.pagehit.value,
      rwratio: this.elements.rwratio.value,
      controller: this.elements.controller.value
    };
  },

  setState(state) {
    if (state.ddrgen !== undefined) this.elements.ddrgen.value = state.ddrgen;
    if (state.datarate !== undefined) this.elements.datarate.value = state.datarate;
    if (state.buswidth !== undefined) this.elements.buswidth.value = state.buswidth;
    if (state.ranks !== undefined) this.elements.ranks.value = state.ranks;
    if (state.burstlen !== undefined) this.elements.burstlen.value = state.burstlen;
    if (state.pagehit !== undefined) this.elements.pagehit.value = state.pagehit;
    if (state.rwratio !== undefined) this.elements.rwratio.value = state.rwratio;
    if (state.controller !== undefined) this.elements.controller.value = state.controller;
    this.updateDefaults();
    this.calculate();
  }
};
