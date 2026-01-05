// SerDes Line Rate Calculator
// Find valid GT transceiver PLL configurations for target line rate
//
// AMD/Xilinx Formulas:
//   CPLL: Line_Rate = VCO * 2 / D  (DDR clocking)
//   QPLL: Line_Rate = VCO / D      (internal /2 and DDR *2 cancel)
//
// Intel/Altera Formulas:
//   ATX/fPLL: Line_Rate = (RefClk * M / N) * 2 / L  (DDR clocking)
//
// Sources:
//   AMD: UG476 (7-Series), UG576 (UltraScale GTH), UG578 (UltraScale+ GTY)
//   Intel: Arria 10 Transceiver PHY User Guide, Cyclone 10 GX Transceiver PHY User Guide

const GT_SPECS = {
  // GTX (7-Series: Artix-7, Kintex-7, Virtex-7)
  gtx: {
    name: 'GTX (7-Series)',
    lineRateMin: 0.5,      // Gbps
    lineRateMax: 12.5,     // Gbps (Kintex-7/Virtex-7); Artix-7 limited to 6.6 Gbps

    // Reference clock input ranges (for validation)
    cpllRefclkRange: { min: 60, max: 800 },   // MHz (UG476 Table 2-8)
    qpllRefclkRange: { min: 40, max: 670 },   // MHz (UG476 Table 2-11)

    cpll: {
      vcoMin: 1.6,         // GHz
      vcoMax: 3.3,         // GHz
      nVals: [4, 5, 8, 10, 12, 15, 16, 20, 25],  // N1 (FBDIV_45: 4,5) * N2 (FBDIV: 1,2,3,4,5)
      mVals: [1, 2]        // REFCLK_DIV
    },

    // NOTE: GTX QPLL has TWO VCO bands with a GAP between them!
    // Lower Band: 5.93-8.0 GHz, Upper Band: 9.8-12.5 GHz
    qpll: {
      vcoBands: [
        { min: 5.93, max: 8.0 },   // Lower Band
        { min: 9.8, max: 12.5 }    // Upper Band
      ],
      nVals: [16, 20, 32, 40, 64, 66, 80, 100],  // QPLL_FBDIV
      mVals: [1, 2, 3, 4]  // QPLL_REFCLK_DIV
    },

    outDivs: [1, 2, 4, 8, 16]
  },

  // GTH (UltraScale / UltraScale+)
  'gth-us+': {
    name: 'GTH (UltraScale+)',
    lineRateMin: 0.5,
    lineRateMax: 16.375,   // Gbps

    // Reference clock input ranges (for validation)
    cpllRefclkRange: { min: 60, max: 820 },   // MHz (UG576 Table 2-3)
    qpllRefclkRange: { min: 60, max: 820 },   // MHz (UG576 Table 2-6)

    cpll: {
      vcoMin: 2.0,         // GHz
      vcoMax: 6.25,        // GHz
      nVals: [4, 5, 8, 10, 12, 15, 16, 20, 25],
      mVals: [1, 2]
    },

    qpll0: {
      vcoMin: 9.8,         // GHz
      vcoMax: 16.375,      // GHz (full range)
      nVals: [16, 20, 32, 40, 60, 64, 66, 75, 80, 84, 90, 96, 100, 112, 120, 125, 128, 150, 160],
      mVals: [1, 2, 3, 4]
    },

    qpll1: {
      vcoMin: 8.0,         // GHz
      vcoMax: 13.0,        // GHz
      nVals: [16, 20, 32, 40, 60, 64, 66, 75, 80, 84, 90, 96, 100, 112, 120, 125, 128, 150, 160],
      mVals: [1, 2, 3, 4]
    },

    outDivs: [1, 2, 4, 8, 16]
  },

  // GTY (UltraScale+)
  gty: {
    name: 'GTY (UltraScale+)',
    lineRateMin: 0.5,
    lineRateMax: 16.375,   // Gbps - limited to standard QPLL mode (CLKOUT_RATE=HALF)
    // Note: GTY can reach 32.75 Gbps with CLKOUT_RATE=FULL, but that requires different formula

    // Reference clock input ranges (for validation)
    cpllRefclkRange: { min: 60, max: 820 },   // MHz (UG578 Table 2-3)
    qpllRefclkRange: { min: 60, max: 820 },   // MHz (UG578 Table 2-7)

    cpll: {
      vcoMin: 2.0,         // GHz
      vcoMax: 6.25,        // GHz
      nVals: [4, 5, 8, 10, 12, 15, 16, 20, 25],
      mVals: [1, 2]
    },

    qpll0: {
      vcoMin: 9.8,         // GHz
      vcoMax: 16.375,      // GHz
      nVals: [16, 20, 32, 40, 60, 64, 66, 75, 80, 84, 90, 96, 100, 112, 120, 125, 128, 150, 160],
      mVals: [1, 2, 3, 4]
    },

    qpll1: {
      vcoMin: 8.0,         // GHz
      vcoMax: 13.0,        // GHz
      nVals: [16, 20, 32, 40, 60, 64, 66, 75, 80, 84, 90, 96, 100, 112, 120, 125, 128, 150, 160],
      mVals: [1, 2, 3, 4]
    },

    outDivs: [1, 2, 4, 8, 16]
  },

  // Intel/Altera Transceivers
  // Formula: Line_Rate = (RefClk * M / N) * 2 / L
  // Note: Intel uses M for multiply and N for divide (opposite of Xilinx naming)

  // Cyclone 10 GX
  cyclone10gx: {
    name: 'Cyclone 10 GX',
    vendor: 'intel',
    lineRateMin: 0.6,      // Gbps
    lineRateMax: 12.5,     // Gbps

    refclkRange: { min: 50, max: 800 },   // MHz

    // ATX PLL (primary transmit PLL)
    atxpll: {
      vcoMin: 7.2,         // GHz
      vcoMax: 11.4,        // GHz (Cyclone 10 GX lower than Arria 10)
      mRange: { min: 8, max: 127 },  // M counter supports 8-127 (integer mode)
      nVals: [1, 2, 4, 8]
    },

    // fPLL (fractional PLL, alternate)
    fpll: {
      vcoMin: 4.8,         // GHz
      vcoMax: 14.0,        // GHz
      mRange: { min: 8, max: 127 },
      nVals: [1, 2, 4, 8]
    },

    lDivs: [1, 2, 4, 8]    // L counter (output divider)
  },

  // Arria 10 GX
  arria10gx: {
    name: 'Arria 10 GX',
    vendor: 'intel',
    lineRateMin: 0.6,      // Gbps
    lineRateMax: 17.4,     // Gbps

    refclkRange: { min: 50, max: 800 },   // MHz

    // ATX PLL (primary transmit PLL) - LC tank VCO
    atxpll: {
      vcoMin: 7.2,         // GHz
      vcoMax: 14.4,        // GHz
      mRange: { min: 8, max: 127 },  // M counter supports 8-127 (integer mode)
      nVals: [1, 2, 4, 8]
    },

    // fPLL (fractional PLL) - Ring oscillator VCO
    fpll: {
      vcoMin: 4.8,         // GHz
      vcoMax: 14.0,        // GHz
      mRange: { min: 8, max: 127 },
      nVals: [1, 2, 4, 8]
    },

    lDivs: [1, 2, 4, 8]    // L counter (output divider)
  },

  // Stratix 10 L-Tile
  stratix10: {
    name: 'Stratix 10 L-Tile',
    vendor: 'intel',
    lineRateMin: 0.6,      // Gbps
    lineRateMax: 17.4,     // Gbps (standard mode; 26 Gbps requires special config)

    refclkRange: { min: 50, max: 800 },   // MHz

    // ATX PLL
    atxpll: {
      vcoMin: 7.2,         // GHz
      vcoMax: 14.4,        // GHz
      mRange: { min: 8, max: 127 },
      nVals: [1, 2, 4, 8]
    },

    // fPLL
    fpll: {
      vcoMin: 4.8,         // GHz
      vcoMax: 14.0,        // GHz
      mRange: { min: 8, max: 127 },
      nVals: [1, 2, 4, 8]
    },

    lDivs: [1, 2, 4, 8]    // L counter (output divider)
  }
};

const SerdesCalc = {
  elements: {},

  init() {
    this.elements = {
      linerate: document.getElementById('serdes-linerate'),
      refclk: document.getElementById('serdes-refclk'),
      gttype: document.getElementById('serdes-gttype'),
      configs: document.getElementById('serdes-configs')
    };

    // Bind input events
    const inputs = [this.elements.linerate, this.elements.refclk];
    inputs.forEach(input => {
      input.addEventListener('input', () => this.calculate());
    });

    // Bind select change event
    this.elements.gttype.addEventListener('change', () => this.calculate());

    // Initial calculation
    this.calculate();
  },

  calculate() {
    const targetGbps = parseFloat(this.elements.linerate.value);
    const refclkMHz = parseFloat(this.elements.refclk.value);
    const gtType = this.elements.gttype.value;

    // Handle no device selected
    if (!gtType) {
      this.elements.configs.innerHTML = '<p class="placeholder">Select a device to calculate...</p>';
      return;
    }

    if (!targetGbps || !refclkMHz || isNaN(targetGbps) || isNaN(refclkMHz)) {
      this.elements.configs.innerHTML = '<p class="placeholder">Enter values to calculate...</p>';
      return;
    }

    const specs = GT_SPECS[gtType];
    const refclkGHz = refclkMHz / 1000;
    const configs = [];
    const warnings = [];

    // Check if this is an Intel device
    const isIntel = specs.vendor === 'intel';

    // Check line rate bounds
    if (targetGbps <= 0) {
      this.elements.configs.innerHTML = '<p class="no-results">Line rate must be a positive number.</p>';
      return;
    }
    if (refclkMHz <= 0) {
      this.elements.configs.innerHTML = '<p class="no-results">Reference clock must be a positive number.</p>';
      return;
    }
    if (targetGbps < specs.lineRateMin) {
      this.elements.configs.innerHTML = `<p class="no-results">
        <strong>${targetGbps} Gbps is below the minimum for ${specs.name}.</strong><br><br>
        Valid range: ${specs.lineRateMin} - ${specs.lineRateMax} Gbps<br><br>
        <em>Try:</em> Use a higher line rate, or select a different GT type that supports lower rates.
      </p>`;
      return;
    }
    if (targetGbps > specs.lineRateMax) {
      let suggestion = '';
      if (gtType === 'gtx') {
        suggestion = 'Try GTH (up to 16.375 Gbps) or GTY (up to 16.375 Gbps in standard mode) for higher rates.';
      } else if (gtType === 'gth-us+') {
        suggestion = 'For rates above 16.375 Gbps, QPLL must use CLKOUT_RATE=FULL mode. Consult UG576 for manual configuration.';
      } else if (gtType === 'gty') {
        suggestion = 'For rates above 16.375 Gbps, QPLL must use CLKOUT_RATE=FULL mode. Consult UG578 for manual configuration.';
      } else if (gtType === 'cyclone10gx') {
        suggestion = 'Try Arria 10 GX (up to 17.4 Gbps) or Stratix 10 L-Tile for higher rates.';
      } else if (gtType === 'arria10gx' || gtType === 'stratix10') {
        suggestion = 'For rates above 17.4 Gbps, Stratix 10 L-Tile can reach 26 Gbps with special PLL configuration. Consult Intel documentation.';
      } else {
        suggestion = 'Try a different transceiver type that supports higher rates.';
      }
      this.elements.configs.innerHTML = `<p class="no-results">
        <strong>${targetGbps} Gbps exceeds the maximum for ${specs.name}.</strong><br><br>
        Valid range: ${specs.lineRateMin} - ${specs.lineRateMax} Gbps<br><br>
        <em>${suggestion}</em>
      </p>`;
      return;
    }

    // Check reference clock ranges and collect warnings
    let cpllRefclkValid = true;
    let qpllRefclkValid = true;
    let intelRefclkValid = true;

    if (isIntel) {
      // Intel has unified refclk range
      if (specs.refclkRange) {
        if (refclkMHz < specs.refclkRange.min || refclkMHz > specs.refclkRange.max) {
          intelRefclkValid = false;
          warnings.push(`RefClk ${refclkMHz} MHz outside valid range (${specs.refclkRange.min}-${specs.refclkRange.max} MHz)`);
        }
      }
    } else {
      // AMD/Xilinx has separate CPLL and QPLL ranges
      if (specs.cpllRefclkRange) {
        if (refclkMHz < specs.cpllRefclkRange.min || refclkMHz > specs.cpllRefclkRange.max) {
          cpllRefclkValid = false;
          warnings.push(`RefClk ${refclkMHz} MHz outside CPLL input range (${specs.cpllRefclkRange.min}-${specs.cpllRefclkRange.max} MHz)`);
        }
      }
      if (specs.qpllRefclkRange) {
        if (refclkMHz < specs.qpllRefclkRange.min || refclkMHz > specs.qpllRefclkRange.max) {
          qpllRefclkValid = false;
          warnings.push(`RefClk ${refclkMHz} MHz outside QPLL input range (${specs.qpllRefclkRange.min}-${specs.qpllRefclkRange.max} MHz)`);
        }
      }
    }

    // Try CPLL (skip if refclk out of range) - AMD/Xilinx only
    // CPLL formula: Line_Rate = VCO * 2 / outDiv
    if (!isIntel && specs.cpll && cpllRefclkValid) {
      for (const n of specs.cpll.nVals) {
        for (const m of specs.cpll.mVals) {
          const vco = refclkGHz * n / m;
          if (vco < specs.cpll.vcoMin || vco > specs.cpll.vcoMax) continue;

          for (const outDiv of specs.outDivs) {
            const lineRate = vco * 2 / outDiv;  // CPLL: VCO * 2 (DDR)
            if (lineRate < specs.lineRateMin || lineRate > specs.lineRateMax) continue;

            const errorPpm = Math.abs((lineRate - targetGbps) / targetGbps) * 1e6;
            configs.push({
              pll: 'CPLL',
              n, m, outDiv,
              vco,
              vcoDisplay: vco.toFixed(4),
              lineRate,
              lineRateDisplay: lineRate.toFixed(6),
              errorPpm
            });
          }
        }
      }
    }

    // Try QPLL0 (if exists and refclk in range) - AMD/Xilinx only
    // QPLL formula: Line_Rate = VCO / outDiv
    if (!isIntel && specs.qpll0 && qpllRefclkValid) {
      for (const n of specs.qpll0.nVals) {
        for (const m of specs.qpll0.mVals) {
          const vco = refclkGHz * n / m;
          if (vco < specs.qpll0.vcoMin || vco > specs.qpll0.vcoMax) continue;

          for (const outDiv of specs.outDivs) {
            const lineRate = vco / outDiv;  // QPLL: no *2
            if (lineRate < specs.lineRateMin || lineRate > specs.lineRateMax) continue;

            const errorPpm = Math.abs((lineRate - targetGbps) / targetGbps) * 1e6;
            configs.push({
              pll: 'QPLL0',
              n, m, outDiv,
              vco,
              vcoDisplay: vco.toFixed(4),
              lineRate,
              lineRateDisplay: lineRate.toFixed(6),
              errorPpm
            });
          }
        }
      }
    }

    // Try QPLL1 (if exists and refclk in range) - AMD/Xilinx only
    if (!isIntel && specs.qpll1 && qpllRefclkValid) {
      for (const n of specs.qpll1.nVals) {
        for (const m of specs.qpll1.mVals) {
          const vco = refclkGHz * n / m;
          if (vco < specs.qpll1.vcoMin || vco > specs.qpll1.vcoMax) continue;

          for (const outDiv of specs.outDivs) {
            const lineRate = vco / outDiv;
            if (lineRate < specs.lineRateMin || lineRate > specs.lineRateMax) continue;

            const errorPpm = Math.abs((lineRate - targetGbps) / targetGbps) * 1e6;
            configs.push({
              pll: 'QPLL1',
              n, m, outDiv,
              vco,
              vcoDisplay: vco.toFixed(4),
              lineRate,
              lineRateDisplay: lineRate.toFixed(6),
              errorPpm
            });
          }
        }
      }
    }

    // Try QPLL (for 7-series GTX which has single QPLL with TWO VCO bands) - AMD/Xilinx only
    if (!isIntel && specs.qpll && specs.qpll.vcoBands && qpllRefclkValid) {
      for (const n of specs.qpll.nVals) {
        for (const m of specs.qpll.mVals) {
          const vco = refclkGHz * n / m;

          // Check if VCO is within ANY of the valid bands
          const inValidBand = specs.qpll.vcoBands.some(
            band => vco >= band.min && vco <= band.max
          );
          if (!inValidBand) continue;

          for (const outDiv of specs.outDivs) {
            const lineRate = vco / outDiv;  // QPLL: lineRate = VCO / outDiv
            if (lineRate < specs.lineRateMin || lineRate > specs.lineRateMax) continue;

            const errorPpm = Math.abs((lineRate - targetGbps) / targetGbps) * 1e6;
            configs.push({
              pll: 'QPLL',
              n, m, outDiv,
              vco,
              vcoDisplay: vco.toFixed(4),
              lineRate,
              lineRateDisplay: lineRate.toFixed(6),
              errorPpm
            });
          }
        }
      }
    }

    // Intel/Altera PLL calculations
    // Formula: Line_Rate = (RefClk * M / N) * 2 / L (DDR clocking)
    if (isIntel && intelRefclkValid) {
      // Try ATX PLL (primary, lower jitter)
      if (specs.atxpll) {
        const mMin = specs.atxpll.mRange.min;
        const mMax = specs.atxpll.mRange.max;
        for (let m = mMin; m <= mMax; m++) {
          for (const n of specs.atxpll.nVals) {
            const vco = refclkGHz * m / n;
            if (vco < specs.atxpll.vcoMin || vco > specs.atxpll.vcoMax) continue;

            for (const l of specs.lDivs) {
              const lineRate = vco * 2 / l;  // DDR: *2
              if (lineRate < specs.lineRateMin || lineRate > specs.lineRateMax) continue;

              const errorPpm = Math.abs((lineRate - targetGbps) / targetGbps) * 1e6;
              configs.push({
                pll: 'ATX PLL',
                n, m, outDiv: l,
                vco,
                vcoDisplay: vco.toFixed(4),
                lineRate,
                lineRateDisplay: lineRate.toFixed(6),
                errorPpm
              });
            }
          }
        }
      }

      // Try fPLL (fractional, wider VCO range)
      if (specs.fpll) {
        const mMin = specs.fpll.mRange.min;
        const mMax = specs.fpll.mRange.max;
        for (let m = mMin; m <= mMax; m++) {
          for (const n of specs.fpll.nVals) {
            const vco = refclkGHz * m / n;
            if (vco < specs.fpll.vcoMin || vco > specs.fpll.vcoMax) continue;

            for (const l of specs.lDivs) {
              const lineRate = vco * 2 / l;  // DDR: *2
              if (lineRate < specs.lineRateMin || lineRate > specs.lineRateMax) continue;

              const errorPpm = Math.abs((lineRate - targetGbps) / targetGbps) * 1e6;
              configs.push({
                pll: 'fPLL',
                n, m, outDiv: l,
                vco,
                vcoDisplay: vco.toFixed(4),
                lineRate,
                lineRateDisplay: lineRate.toFixed(6),
                errorPpm
              });
            }
          }
        }
      }
    }

    // Handle case where no valid configurations found
    if (configs.length === 0) {
      let message = '<strong>No valid PLL configuration found.</strong><br><br>';

      if (warnings.length > 0) {
        message += '<strong>Detected issues:</strong><br>';
        warnings.forEach(w => {
          message += `<span class="error-bullet">- ${w}</span><br>`;
        });
        message += '<br>';
      }

      message += '<strong>Troubleshooting steps:</strong><br>';
      message += '<span class="error-bullet">1. Check that your reference clock is within valid PLL input ranges</span><br>';
      message += '<span class="error-bullet">2. Try a different reference clock frequency (common: 100, 125, 156.25 MHz)</span><br>';
      message += '<span class="error-bullet">3. Verify your target line rate matches a supported protocol</span><br>';
      message += '<span class="error-bullet">4. Try a different transceiver type with wider VCO range</span><br>';

      const pllTypes = isIntel ? 'ATX PLL and fPLL' : 'CPLL and QPLL';
      message += `<br><em>The calculator searched all valid divider combinations for ${pllTypes} but found no configuration that achieves your target rate within this device's VCO ranges.</em>`;

      this.elements.configs.innerHTML = `<p class="no-results">${message}</p>`;
      return;
    }

    // Sort by error (using full precision), show top 10
    configs.sort((a, b) => a.errorPpm - b.errorPpm);
    const topConfigs = configs.slice(0, 10);

    // Build results table with vendor-appropriate column headers
    // AMD: N=multiply, M=divide, OUT_DIV=output divider
    // Intel: M=multiply, N=divide, L=output divider
    const colHeaders = isIntel
      ? { col1: 'M', col1Desc: 'Multiply counter M', col2: 'N', col2Desc: 'Pre-divide counter N', col3: 'L', col3Desc: 'Output divider L' }
      : { col1: 'N', col1Desc: 'Feedback divider N', col2: 'M', col2Desc: 'Reference clock divider M', col3: 'OUT_DIV', col3Desc: 'Output divider' };

    let html = `
      <table role="table" aria-label="Valid PLL configurations sorted by error, best match first">
        <thead>
          <tr>
            <th scope="col">PLL</th>
            <th scope="col" aria-label="${colHeaders.col1Desc}">${colHeaders.col1}</th>
            <th scope="col" aria-label="${colHeaders.col2Desc}">${colHeaders.col2}</th>
            <th scope="col" aria-label="${colHeaders.col3Desc}">${colHeaders.col3}</th>
            <th scope="col" aria-label="VCO frequency in GHz">VCO</th>
            <th scope="col" aria-label="Achieved line rate in Gbps">Line Rate</th>
            <th scope="col" aria-label="Error from target in parts per million">Error</th>
          </tr>
        </thead>
        <tbody>
    `;

    topConfigs.forEach((cfg, index) => {
      const isExact = cfg.errorPpm < 0.1;
      const rowClass = isExact ? ' class="exact"' : '';
      const errorText = isExact ? 'exact' : cfg.errorPpm.toFixed(1) + ' ppm';
      const ariaLabel = `Configuration ${index + 1}: ${cfg.pll}, ${errorText}`;
      // For Intel: col1=M (multiply), col2=N (divide)
      // For AMD: col1=N (multiply), col2=M (divide)
      const col1Val = isIntel ? cfg.m : cfg.n;
      const col2Val = isIntel ? cfg.n : cfg.m;
      html += `
        <tr${rowClass} aria-label="${ariaLabel}">
          <td>${cfg.pll}</td>
          <td>${col1Val}</td>
          <td>${col2Val}</td>
          <td>${cfg.outDiv}</td>
          <td>${cfg.vcoDisplay}</td>
          <td>${cfg.lineRateDisplay}</td>
          <td>${isExact ? 'exact' : cfg.errorPpm.toFixed(1)}</td>
        </tr>
      `;
    });

    html += '</tbody></table>';

    // Add warnings note if any
    if (warnings.length > 0) {
      html += `<p class="refclk-note">* ${warnings.join('; ')}</p>`;
    }

    // Show count if more results available
    if (configs.length > 10) {
      html += `<p style="margin-top: 0.5rem; opacity: 0.6;">Showing 10 of ${configs.length} valid configurations</p>`;
    }

    this.elements.configs.innerHTML = html;
  },

  getState() {
    return {
      linerate: this.elements.linerate.value,
      refclk: this.elements.refclk.value,
      gttype: this.elements.gttype.value
    };
  },

  setState(state) {
    if (state.linerate !== undefined) this.elements.linerate.value = state.linerate;
    if (state.refclk !== undefined) this.elements.refclk.value = state.refclk;
    if (state.gttype !== undefined) this.elements.gttype.value = state.gttype;
    this.calculate();
  }
};
