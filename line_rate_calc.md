# SerDes Line Rate Calculator Spec

Add a 6th calculator to fpga_calc that finds valid GT transceiver configurations for a target line rate.

## Overview

Engineers need to find valid PLL divider combinations for their target serial link speed. This calculator takes a desired line rate and reference clock, then shows all valid CPLL/QPLL configurations.

### Scope

**Supported:**
- AMD/Xilinx 7-Series GTX transceivers (Artix-7, Kintex-7, Virtex-7)
- AMD/Xilinx UltraScale/UltraScale+ GTH transceivers
- AMD/Xilinx UltraScale+ GTY transceivers (NRZ mode only)
- Line rates up to 16.375 Gbps (standard QPLL mode)

**Out of Scope (not supported in v1.0):**
- **Intel/Altera transceivers** - This is an AMD/Xilinx-only calculator. Intel support may be considered for a future version.
- **GTP transceivers** (Spartan-6, Artix-7 low-cost) - Limited use case, lower speeds (up to 3.75 Gbps)
- **GTF transceivers** (Versal Premium) - New architecture with different clocking, requires separate implementation
- **GTM transceivers** (Versal HBM/Premium) - 112 Gbps PAM4 capable, fundamentally different architecture
- **GTYP transceivers** (Versal) - Similar to GTY but with Versal-specific features
- **PAM4 modulation** - GTY/GTM support PAM4 for 50G+ rates, but this calculator covers NRZ only
- **Line rates above 16.375 Gbps** - Requires QPLL CLKOUT_RATE=FULL mode (different formula)
- **Board-specific presets** - Device presets are GT-type based, not board-based

**Why these exclusions?**
- GTP, GTF, GTM, GTYP each have unique clocking architectures requiring separate algorithm implementations
- Intel transceivers use completely different terminology and divider structures
- PAM4 mode introduces symbol-rate vs bit-rate distinctions not covered here
- High-speed QPLL mode requires additional formula handling
- Keeping scope focused ensures accuracy and maintainability

---

## Inputs

| Input | HTML ID | Default | Unit | Help Text |
|-------|---------|---------|------|-----------|
| Target Line Rate | `serdes-linerate` | `10.3125` | Gbps | Serial data rate (10.3125 for 10GbE, 25.78125 for 25GbE) |
| Reference Clock | `serdes-refclk` | `156.25` | MHz | GT reference clock input frequency |
| GT Type | `serdes-gttype` | `gth-us+` | dropdown | Transceiver type (GTX, GTH, GTY) |

---

## Outputs

| Output | HTML ID | Format |
|--------|---------|--------|
| Configuration table | `serdes-configs` | Table of valid PLL configs (top 10 results sorted by error) |

**Note:** Unlike some calculators with individual result fields, this calculator displays all output in a single table (matching the PLL calculator pattern). Status messages (errors, warnings) are rendered inline in the same container.

---

## GT Transceiver Specifications

### GTX (7-Series: Artix-7, Kintex-7, Virtex-7)

**Note:** 7-Series has a SINGLE QPLL (not QPLL0/QPLL1 like UltraScale). The algorithm uses `specs.qpll` for 7-Series and `specs.qpll0`/`specs.qpll1` for UltraScale+.

```javascript
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
  // The calculator must check BOTH bands, not a single continuous range.
  qpll: {
    vcoBands: [
      { min: 5.93, max: 8.0 },   // Lower Band
      { min: 9.8, max: 12.5 }    // Upper Band
    ],
    nVals: [16, 20, 32, 40, 64, 66, 80, 100],  // QPLL_FBDIV
    mVals: [1, 2, 3, 4]  // QPLL_REFCLK_DIV
  },

  outDivs: [1, 2, 4, 8, 16]
}
```

**Source:** UG476 (7 Series Transceivers User Guide), Table 2-5, Table 2-7

**IMPORTANT:** The GTX QPLL VCO has a gap between 8.0 GHz and 9.8 GHz where it cannot operate. The algorithm must check that the calculated VCO frequency falls within one of the two valid bands.

### GTH (UltraScale / UltraScale+)

**Note:** UltraScale/UltraScale+ has TWO QPLLs: QPLL0 and QPLL1, each with different VCO ranges. The algorithm uses `specs.qpll0` and `specs.qpll1` for these devices (not `specs.qpll`).

**UltraScale vs UltraScale+ GTH:** The GTH specs are nearly identical between UltraScale and UltraScale+. Minor differences in max line rate (16.3 vs 16.375 Gbps) and timing margins exist but are negligible for PLL calculations. This calculator uses UltraScale+ specs which are compatible with both families. For production designs, always verify against the specific device datasheet.

```javascript
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
    nVals: [4, 5, 8, 10, 12, 15, 16, 20, 25],  // N1 (FBDIV_45: 4,5) * N2 (FBDIV: 1,2,3,4,5)
    mVals: [1, 2]        // REFCLK_DIV
  },

  qpll0: {
    vcoMin: 9.8,         // GHz
    vcoMax: 16.375,      // GHz (full range)
    // Standard QPLL FBDIV values + extended values added in later UG576 versions
    nVals: [16, 20, 32, 40, 60, 64, 66, 75, 80, 84, 90, 96, 100, 112, 120, 125, 128, 150, 160],
    mVals: [1, 2, 3, 4]  // QPLL_REFCLK_DIV
  },

  qpll1: {
    vcoMin: 8.0,         // GHz
    vcoMax: 13.0,        // GHz
    nVals: [16, 20, 32, 40, 60, 64, 66, 75, 80, 84, 90, 96, 100, 112, 120, 125, 128, 150, 160],
    mVals: [1, 2, 3, 4]  // QPLL_REFCLK_DIV
  },

  outDivs: [1, 2, 4, 8, 16]
}
```

**Source:** UG576 (UltraScale GTH Transceivers), Table 2-2, Table 2-5, Table 2-13, Table 2-15

**Note:** Extended QPLL FBDIV values (60, 75, 84, 90, 96, 112, 120, 125, 150) were added in later versions of UG576 for more reference clock flexibility. The original valid values were 16, 20, 32, 40, 64, 66, 80, 100.

### GTY (UltraScale+)

**Note:** GTY supports NRZ modulation up to 32.75 Gbps. Some GTY variants also support PAM4 modulation for rates up to 58 Gbps (Versal), but PAM4 is NOT covered by this calculator.

```javascript
gty: {
  name: 'GTY (UltraScale+)',
  lineRateMin: 0.5,
  lineRateMax: 32.75,    // Gbps for UltraScale+ NRZ (30.5 Gbps for UltraScale)
  // NOTE: PAM4 mode can reach 58 Gbps on Versal, but this calculator only covers NRZ

  // Reference clock input ranges (for validation)
  cpllRefclkRange: { min: 60, max: 820 },   // MHz (UG578 Table 2-3)
  qpllRefclkRange: { min: 60, max: 820 },   // MHz (UG578 Table 2-7)

  cpll: {
    vcoMin: 2.0,         // GHz
    vcoMax: 6.25,        // GHz
    nVals: [4, 5, 8, 10, 12, 15, 16, 20, 25],  // N1 (FBDIV_45: 4,5) * N2 (FBDIV: 1,2,3,4,5)
    mVals: [1, 2]        // REFCLK_DIV
  },

  qpll0: {
    vcoMin: 9.8,         // GHz
    vcoMax: 16.375,      // GHz
    // For line rates > 16.375 Gbps, QPLL0/1CLKOUT_RATE must be set to FULL
    nVals: [16, 20, 32, 40, 60, 64, 66, 75, 80, 84, 90, 96, 100, 112, 120, 125, 128, 150, 160],
    mVals: [1, 2, 3, 4]  // QPLL_REFCLK_DIV
  },

  qpll1: {
    vcoMin: 8.0,         // GHz
    vcoMax: 13.0,        // GHz
    nVals: [16, 20, 32, 40, 60, 64, 66, 75, 80, 84, 90, 96, 100, 112, 120, 125, 128, 150, 160],
    mVals: [1, 2, 3, 4]  // QPLL_REFCLK_DIV
  },

  outDivs: [1, 2, 4, 8, 16]
}
```

**Source:** UG578 (UltraScale GTY Transceivers), Table 2-2, Table 2-9

**Note:** GTY and GTH share similar CPLL/QPLL specifications. For line rates above 16.375 Gbps, the QPLL0/1CLKOUT_RATE attribute must be set to FULL (output = VCO frequency) instead of HALF.

---

## Core Formulas

### CPLL Line Rate Calculation (UG476 Eq. 2-1, 2-2; UG576 Eq. 2-1, 2-2)

```
VCO_freq = RefClk * N / M

Where:
  N = N1 * N2 (combined as single N value from nVals array)
      - N1 (CPLL_FBDIV_45) valid values: 4, 5
      - N2 (CPLL_FBDIV) valid values: 1, 2, 3, 4, 5
      - Combined N values: 4, 5, 8, 10, 12, 15, 16, 20, 25
        (calculated as: 4x1=4, 5x1=5, 4x2=8, 5x2=10, 4x3=12, 5x3=15, 4x4=16, 4x5=20, 5x4=20, 5x5=25)
  M = REFCLK_DIV (from mVals array: 1, 2)

Line_Rate = VCO_freq * 2 / D

Where:
  D = TXOUT_DIV or RXOUT_DIV (valid values: 1, 2, 4, 8, 16)
  The "* 2" factor is DDR - data transmitted on both rising and falling edges
```

**Key insight:** For CPLL, the VCO runs at HALF the line rate (when D=1). The serializer uses DDR clocking, hence the *2 multiplier.

**CRITICAL:** The CPLL N values (4, 5, 8, 10, 12, 15, 16, 20, 25) are different from QPLL N values (16, 20, 32, 40, 64, 66, 80, 100, etc.). Do not confuse them!

### QPLL Line Rate Calculation (UG476 Eq. 2-3, 2-4; UG576 Eq. 2-3, 2-4)

```
VCO_freq = RefClk * N / M

PLL_Output_freq = VCO_freq / 2    (QPLL divides VCO by 2 internally)

Line_Rate = PLL_Output_freq * 2 / D = VCO_freq / D

Simplified:
  Line_Rate = RefClk * N / (M * D)

Where:
  N = QPLL_FBDIV (from nVals array)
  M = QPLL_REFCLK_DIV (from mVals array: 1, 2, 3, 4)
  D = TXOUT_DIV or RXOUT_DIV
```

**Key insight:** For QPLL, the internal divide-by-2 and the DDR *2 factor cancel out, so Line_Rate = VCO / D.

### Error Calculation

```
Error_ppm = |Achieved_Rate - Target_Rate| / Target_Rate * 1,000,000
```

### Sources

- UG476: 7 Series FPGAs GTX/GTH Transceivers User Guide (Section 2, Equations 2-1 through 2-4)
- UG576: UltraScale Architecture GTH Transceivers User Guide (Section 2, Equations 2-1 through 2-4)
- UG578: UltraScale Architecture GTY Transceivers User Guide

---

## Edge Cases and Validation

### Input Validation

The calculator validates user input and provides clear feedback:

| Input Condition | Behavior | Error Message |
|-----------------|----------|---------------|
| Empty/NaN line rate | Show placeholder | "Enter values to calculate..." |
| Empty/NaN refclk | Show placeholder | "Enter values to calculate..." |
| Line rate <= 0 | Show error | "Line rate must be a positive number." |
| Refclk <= 0 | Show error | "Reference clock must be a positive number." |
| Line rate < GT min | Show error with valid range | "{rate} Gbps is below the minimum for {GT}. Valid range: {min} - {max} Gbps" |
| Line rate > GT max | Show error with suggestion | "{rate} Gbps exceeds the maximum for {GT}..." with GT-specific guidance |
| Refclk outside PLL range | Warning (continues calc) | "RefClk {X} MHz outside {PLL} input range ({min}-{max} MHz)" |
| Very high line rate (>100 Gbps) | Caught by GT max check | Error shown with guidance |

**Note:** The `min` attribute on input fields provides browser-level validation hints, but the JavaScript performs the authoritative validation to ensure consistent behavior.

### Reference Clock Input Ranges

Each PLL type has valid input reference clock ranges. The algorithm validates these and warns (but continues) if out of range:

| GT Type | CPLL Range | QPLL Range | Source |
|---------|------------|------------|--------|
| GTX (7-Series) | 60-800 MHz | 40-670 MHz | UG476 Tables 2-8, 2-11 |
| GTH (UltraScale+) | 60-820 MHz | 60-820 MHz | UG576 Tables 2-3, 2-6 |
| GTY (UltraScale+) | 60-820 MHz | 60-820 MHz | UG578 Tables 2-3, 2-7 |

### No Valid Configuration Found

If no valid PLL configuration exists for the given inputs, display a helpful error message:

```
No valid PLL configuration found for this combination.

Possible issues:
- RefClk 30 MHz outside CPLL input range (60-800 MHz)
- RefClk 30 MHz outside QPLL input range (40-670 MHz)

Try:
- Different reference clock frequency
- Different GT type
```

### GTX QPLL VCO Gap

The GTX QPLL has two VCO operating bands with a **gap** between them:
- Lower band: 5.93-8.0 GHz
- Upper band: 9.8-12.5 GHz
- **Gap: 8.0-9.8 GHz is INVALID**

The algorithm must check that the calculated VCO falls within one of the two bands, not just within the overall 5.93-12.5 GHz range.

### 7-Series vs UltraScale+ QPLL Architecture

| Device Family | QPLL Structure | Algorithm Field |
|---------------|----------------|-----------------|
| 7-Series (GTX) | Single QPLL with dual VCO bands | `specs.qpll` with `vcoBands` array |
| UltraScale/UltraScale+ (GTH/GTY) | Two separate QPLLs (QPLL0, QPLL1) | `specs.qpll0` and `specs.qpll1` |

### High Line Rate Limitation (GTY above 16.375 Gbps)

**This calculator does NOT support line rates above 16.375 Gbps.**

For GTY line rates above 16.375 Gbps (e.g., 25GbE at 25.78125 Gbps), the QPLL must operate in CLKOUT_RATE=FULL mode, which changes the formula:
- Standard QPLL: `Line_Rate = VCO / D` (CLKOUT_RATE=HALF, internal /2 and DDR cancel)
- High-speed QPLL: `Line_Rate = VCO * 2 / D` (CLKOUT_RATE=FULL, output = VCO frequency)

Supporting this would require:
1. Detecting when target rate exceeds 16.375 Gbps
2. Applying the alternate formula for QPLL calculations
3. Indicating CLKOUT_RATE=FULL in the results

This is a potential future enhancement. For now, users needing 25GbE or higher should consult Xilinx documentation directly.

### Precision Handling

**Internal calculations** use JavaScript's full floating-point precision (IEEE 754 double).

**Display formatting:**
- VCO frequency: `toFixed(4)` - 4 decimal places (e.g., "10.3125 GHz")
- Line rate: `toFixed(6)` - 6 decimal places (e.g., "10.312500 Gbps")
- Error ppm: `Math.round()` for display, but sorting uses full precision

**Why this matters:** Sorting by errorPpm BEFORE rounding ensures that configurations with sub-ppm differences are correctly ordered. The rounding only happens for the final display.

---

## Calculation Algorithm

```javascript
calculate() {
  const targetGbps = parseFloat(this.elements.linerate.value);
  const refclkMHz = parseFloat(this.elements.refclk.value);
  const gtType = this.elements.gttype.value;

  if (!targetGbps || !refclkMHz) {
    this.elements.configs.innerHTML = '<p class="placeholder">Enter values to calculate...</p>';
    return;
  }

  const specs = GT_SPECS[gtType];
  const refclkGHz = refclkMHz / 1000;
  const configs = [];
  const warnings = [];

  // Check line rate bounds
  if (targetGbps <= 0) {
    this.elements.configs.innerHTML = `<p class="no-results">Line rate must be a positive number.</p>`;
    return;
  }
  if (refclkMHz <= 0) {
    this.elements.configs.innerHTML = `<p class="no-results">Reference clock must be a positive number.</p>`;
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
      suggestion = 'Try GTH (up to 16.375 Gbps) or GTY (up to 32.75 Gbps) for higher rates.';
    } else if (gtType === 'gth-us+') {
      suggestion = 'Try GTY for rates up to 32.75 Gbps. Note: Rates above 16.375 Gbps require QPLL CLKOUT_RATE=FULL mode (not covered by this calculator).';
    } else {
      suggestion = 'For rates above 16.375 Gbps, QPLL must use CLKOUT_RATE=FULL mode. Consult UG578 for manual configuration.';
    }
    this.elements.configs.innerHTML = `<p class="no-results">
      <strong>${targetGbps} Gbps exceeds the maximum for ${specs.name}.</strong><br><br>
      Valid range: ${specs.lineRateMin} - ${specs.lineRateMax} Gbps<br><br>
      <em>${suggestion}</em>
    </p>`;
    return;
  }

  // Check reference clock ranges and collect warnings
  // (don't fail - just warn, as some configs may still work)
  let cpllRefclkValid = true;
  let qpllRefclkValid = true;

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

  // Try CPLL (skip if refclk out of range)
  // CPLL formula: Line_Rate = VCO * 2 / outDiv
  // The *2 is DDR (data on both clock edges). VCO runs at half line rate.
  if (cpllRefclkValid) {
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
          vco,                             // Keep full precision internally
          vcoDisplay: vco.toFixed(4),      // For display only
          lineRate,                        // Keep full precision internally
          lineRateDisplay: lineRate.toFixed(6),  // For display only
          errorPpm                         // Keep as float for sorting precision
        });
      }
    }
  }
  } // end if (cpllRefclkValid)

  // Try QPLL0 (if exists and refclk in range)
  // NOTE: QPLL formula differs! Line_Rate = VCO / outDiv (not VCO * 2 / outDiv)
  // The internal /2 divider and DDR *2 factor cancel out
  if (specs.qpll0 && qpllRefclkValid) {
    for (const n of specs.qpll0.nVals) {
      for (const m of specs.qpll0.mVals) {
        const vco = refclkGHz * n / m;
        if (vco < specs.qpll0.vcoMin || vco > specs.qpll0.vcoMax) continue;

        for (const outDiv of specs.outDivs) {
          const lineRate = vco / outDiv;  // QPLL: no *2 (internal /2 and DDR cancel)
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

  // Try QPLL1 (if exists and refclk in range) - same formula as QPLL0: lineRate = vco / outDiv
  if (specs.qpll1 && qpllRefclkValid) {
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

  // Try QPLL (for 7-series GTX which has single QPLL with TWO VCO bands)
  // IMPORTANT: GTX QPLL has a GAP between 8.0 and 9.8 GHz!
  // Must check if VCO falls within EITHER band, not a continuous range.
  if (specs.qpll && specs.qpll.vcoBands && qpllRefclkValid) {
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

  // Handle case where no valid configurations found
  if (configs.length === 0) {
    let message = '<strong>No valid PLL configuration found.</strong><br><br>';

    // Explain why based on what we know
    if (warnings.length > 0) {
      message += '<strong>Detected issues:</strong><br>';
      warnings.forEach(w => {
        message += `<span class="error-bullet">- ${w}</span><br>`;
      });
      message += '<br>';
    }

    // Provide specific, actionable suggestions
    message += '<strong>Troubleshooting steps:</strong><br>';
    message += '<span class="error-bullet">1. Check that your reference clock is within valid PLL input ranges</span><br>';
    message += '<span class="error-bullet">2. Try a different reference clock frequency (common: 100, 125, 156.25 MHz)</span><br>';
    message += '<span class="error-bullet">3. Verify your target line rate matches a supported protocol</span><br>';
    message += '<span class="error-bullet">4. Try a different GT type with wider VCO range</span><br>';

    // Add context about what the calculator checked
    message += '<br><em>The calculator searched all valid N, M, and OUT_DIV combinations for both CPLL and QPLL but found no configuration that achieves your target rate within this GT type\'s VCO ranges.</em>';

    this.elements.configs.innerHTML = `<p class="no-results">${message}</p>`;
    return;
  }

  // Sort by error (using full precision), show top 10
  configs.sort((a, b) => a.errorPpm - b.errorPpm);
  const topConfigs = configs.slice(0, 10);

  // Build results table (inline, matching PllCalc pattern)
  // Include ARIA attributes for screen reader accessibility
  let html = `
    <table role="table" aria-label="Valid PLL configurations sorted by error, best match first">
      <thead>
        <tr>
          <th scope="col">PLL</th>
          <th scope="col" aria-label="Feedback divider N">N</th>
          <th scope="col" aria-label="Reference clock divider M">M</th>
          <th scope="col" aria-label="Output divider">OUT_DIV</th>
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
    html += `
      <tr${rowClass} aria-label="${ariaLabel}">
        <td>${cfg.pll}</td>
        <td>${cfg.n}</td>
        <td>${cfg.m}</td>
        <td>${cfg.outDiv}</td>
        <td>${cfg.vcoDisplay}</td>
        <td>${cfg.lineRateDisplay}</td>
        <td>${isExact ? 'exact' : cfg.errorPpm.toFixed(1)}</td>
      </tr>
    `;
  });

  html += '</tbody></table>';

  // Add warnings note if any (like PLL's pfd-note)
  if (warnings.length > 0) {
    html += `<p class="refclk-note">* ${warnings.join('; ')}</p>`;
  }

  // Show count if more results available
  if (configs.length > 10) {
    html += `<p style="margin-top: 0.5rem; opacity: 0.6;">Showing 10 of ${configs.length} valid configurations</p>`;
  }

  this.elements.configs.innerHTML = html;
}
```

---

## Files to Create/Modify

### 1. Create `js/serdes.js`

New file with `SerdesCalc` singleton following existing patterns (note: all calculators use `XxxCalc` naming convention).

**Complete singleton structure (matching PllCalc pattern):**

```javascript
// SerDes Line Rate Calculator
// Find valid GT transceiver PLL configurations for target line rate

const GT_SPECS = {
  // Keys MUST match the <option value="..."> in the HTML dropdown:
  // - 'gtx' for GTX (7-Series)
  // - 'gth-us+' for GTH (UltraScale+)
  // - 'gty' for GTY (UltraScale+)
  gtx: { /* ... as defined in GT Transceiver Specifications section ... */ },
  'gth-us+': { /* ... as defined in GT Transceiver Specifications section ... */ },
  gty: { /* ... as defined in GT Transceiver Specifications section ... */ }
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
    // ... calculation logic from spec above ...
    // Render results directly (no separate displayConfigs method)
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
```

**Key patterns matching existing calculators:**
- Singleton object with `elements`, `init()`, `calculate()`, `getState()`, `setState()`
- Elements object populated in `init()` using `document.getElementById()`
- Input events bound with `addEventListener('input', ...)`
- Select element uses `addEventListener('change', ...)` (different from input!)
- `getState()` returns object with URL-safe keys (lowercase, no hyphens)
- `setState()` checks each key with `!== undefined` before setting
- `setState()` calls `calculate()` at the end

**Results rendering (following PllCalc pattern):**

```javascript
// Placeholder state
this.elements.configs.innerHTML = '<p class="placeholder">Enter values to calculate...</p>';

// Error state
this.elements.configs.innerHTML = '<p class="no-results">' + message + '</p>';

// Success - build table inline in calculate()
let html = '<table><thead>...</thead><tbody>';
// ... build rows ...
html += '</tbody></table>';

// Add warning note if applicable (like PLL's pfd-note)
if (warnings.length > 0) {
  html += '<p class="refclk-note">* ' + warnings.join('; ') + '</p>';
}

this.elements.configs.innerHTML = html;
```

### 2. Modify `index.html`

Add after PLL section:

```html
<section id="serdes" class="calculator">
  <div class="calc-header">
    <div>
      <h2>SerDes Line Rate Calculator</h2>
      <p class="description">Find valid GT transceiver PLL configurations</p>
    </div>
    <button class="reset-btn" data-calc="serdes">Reset</button>
  </div>

  <div class="preset-selector">
    <label for="serdes-gttype">
      GT Type:
      <span class="help-wrapper">
        <span class="help-icon">?</span>
        <span class="help-tooltip">
          <h4>GT Transceiver Type</h4>
          <p><strong>What:</strong> The high-speed serial transceiver block in your FPGA. Different Xilinx/AMD device families have different GT types with varying speed capabilities.</p>
          <p><strong>How to find:</strong> Check your target device's datasheet or the Vivado device properties. The device family determines which GT type is available.</p>
          <p><strong>GT Types:</strong><span class="tip-list"><br>
            - <strong>GTX:</strong> 7-Series (Artix-7, Kintex-7, Virtex-7). Max 12.5 Gbps.<br>
            - <strong>GTH:</strong> UltraScale/UltraScale+. Max 16.375 Gbps. Most common choice.<br>
            - <strong>GTY:</strong> UltraScale+ high-speed variant. Max 32.75 Gbps (NRZ). Required for 25GbE+.</span></p>
          <p class="tooltip-note">Versal devices use GTY with PAM4 support (up to 58 Gbps), but this calculator covers NRZ mode only.</p>
        </span>
      </span>
    </label>
    <select id="serdes-gttype" aria-describedby="serdes-gttype-hint">
      <optgroup label="AMD/Xilinx">
        <option value="gtx">GTX (7-Series)</option>
        <option value="gth-us+" selected>GTH (UltraScale+)</option>
        <option value="gty">GTY (UltraScale+)</option>
      </optgroup>
    </select>
    <span id="serdes-gttype-hint" class="visually-hidden">Select the GT transceiver type for your target FPGA</span>
  </div>

  <div class="inputs">
    <div class="input-group">
      <label for="serdes-linerate">
        Target Line Rate (Gbps)
        <span class="help-wrapper">
          <span class="help-icon">?</span>
          <span class="help-tooltip">
            <h4>Target Line Rate</h4>
            <p><strong>What:</strong> The serial data rate you need on the wire - NOT your data throughput! Line rate includes encoding overhead (e.g., 8b/10b adds 25%).</p>
            <p><strong>Why:</strong> The GT PLL must lock to this exact frequency. This calculator finds divider settings that achieve your target rate.</p>
            <p><strong>How to find:</strong> Check your protocol spec. For Ethernet, line rate = data rate x encoding factor. For 10GbE: 10 Gbps x (66/64) = 10.3125 Gbps.</p>
            <p><strong>Common values:</strong><span class="tip-list"><br>
              - 1GbE: 1.25 Gbps (8b/10b)<br>
              - 10GbE: 10.3125 Gbps (64b/66b)<br>
              - 25GbE: 25.78125 Gbps (64b/66b)*<br>
              - PCIe Gen3: 8.0 GT/s (128b/130b)<br>
              - PCIe Gen4: 16.0 GT/s (128b/130b)</span></p>
            <p class="tooltip-note">* Rates above 16.375 Gbps require special QPLL mode not covered by this calculator.</p>
          </span>
        </span>
      </label>
      <input type="number" id="serdes-linerate" value="10.3125" min="0.1" step="any" aria-describedby="serdes-linerate-hint">
      <span id="serdes-linerate-hint" class="visually-hidden">Enter your target serial line rate in gigabits per second</span>
    </div>

    <div class="input-group">
      <label for="serdes-refclk">
        Reference Clock (MHz)
        <span class="help-wrapper">
          <span class="help-icon">?</span>
          <span class="help-tooltip">
            <h4>Reference Clock</h4>
            <p><strong>What:</strong> The clock signal feeding your GT transceiver's PLL. This comes from an oscillator on your board, typically routed to dedicated REFCLK pins.</p>
            <p><strong>Why:</strong> Must be a clean, low-jitter source. The PLL multiplies this to generate your line rate. Poor refclk quality = poor link quality.</p>
            <p><strong>How to find:</strong> Check your board schematic for the GT REFCLK oscillator. Common values: 100 MHz (PCIe), 125 MHz (1GbE), 156.25 MHz (10GbE/25GbE).</p>
            <p><strong>Valid ranges:</strong><span class="tip-list"><br>
              - CPLL: 60-820 MHz (60-800 for GTX)<br>
              - QPLL: 60-820 MHz (40-670 for GTX)</span></p>
          </span>
        </span>
      </label>
      <input type="number" id="serdes-refclk" value="156.25" min="1" step="any" aria-describedby="serdes-refclk-hint">
      <span id="serdes-refclk-hint" class="visually-hidden">Enter your reference clock frequency in megahertz</span>
    </div>
  </div>

  <div class="results" id="serdes-results-container" aria-live="polite">
    <div class="results-header">
      <h3>Valid Configurations</h3>
      <button class="copy-btn" data-calc="serdes">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        Copy
      </button>
    </div>
    <div id="serdes-configs" class="serdes-results">
      <p class="placeholder">Enter values to calculate...</p>
    </div>
  </div>

  <div class="results-guide">
    <h3>Understanding the Results</h3>
    <details>
      <summary>How to choose a configuration</summary>
      <div class="guide-content">
        <p><strong>Error (ppm):</strong> How close the achieved rate is to your target. "exact" means 0 ppm - a perfect match. For most protocols, &lt;50 ppm is acceptable. Some protocols (like 10GbE) require exact rates.</p>

        <p><strong>CPLL vs QPLL - which to choose?</strong></p>
        <ul>
          <li><strong>CPLL (Channel PLL):</strong> One per GT channel. Use when each channel needs a different line rate, or when QPLL is already in use. Lower power than QPLL.</li>
          <li><strong>QPLL (Quad PLL):</strong> Shared across 4 GT channels (one Quad). Use when multiple channels need the same rate - saves power and simplifies clocking. QPLL0 has higher VCO range than QPLL1.</li>
        </ul>

        <p><strong>OUT_DIV:</strong> Output divider - must be set the same for TX and RX paths. Lower values (1, 2) give better jitter performance. Higher values (8, 16) enable lower line rates but with more jitter.</p>

        <p><strong>VCO frequency:</strong> Must be within the PLL's operating range. Already validated by this calculator - all shown configs are valid.</p>
      </div>
    </details>
  </div>

  <div class="formula">
    <h3>Formula</h3>
    <p><strong>CPLL:</strong> <code>Line_Rate = (RefClk * N / M) * 2 / D</code></p>
    <p><strong>QPLL:</strong> <code>Line_Rate = RefClk * N / (M * D)</code></p>
    <p class="formula-note">
      CPLL: VCO runs at half line rate; DDR (*2) doubles it.<br>
      QPLL: Internal /2 and DDR *2 cancel out.<br>
      N = FBDIV*FBDIV_45 (CPLL) or QPLL_FBDIV, M = REFCLK_DIV, D = OUT_DIV
    </p>
  </div>

  <div class="calculator-notes">
    <h3>Important Notes</h3>
    <ul>
      <li><strong>TX and RX OUT_DIV:</strong> In most designs, TXOUT_DIV and RXOUT_DIV must be set to the same value shown in the OUT_DIV column.</li>
      <li><strong>Vivado IP Wizard:</strong> Use this calculator for quick exploration. For final implementation, configure your GT via the Vivado Transceiver Wizard, which handles additional constraints (jitter, power, pin assignments).</li>
      <li><strong>High-speed limitation:</strong> Line rates above 16.375 Gbps (e.g., 25GbE) require QPLL CLKOUT_RATE=FULL mode, which uses a different formula not covered by this calculator.</li>
      <li><strong>Jitter considerations:</strong> For production designs, verify your configuration meets jitter requirements using Xilinx's transceiver wizard timing analysis.</li>
    </ul>
  </div>
</section>
```

**Key differences from original spec:**
- Title uses "SerDes Line Rate Calculator" (full name like other calculators)
- Label has `for="serdes-gttype"` attribute and uses "GT Type:" (not "Device Preset:" since this isn't a device preset)
- Help tooltips do NOT include `<button class="help-close">` - these are added dynamically by main.js
- Uses `<span class="tip-list">` for bullet lists (matches existing tooltip pattern)
- Results container uses `id="serdes-results-container"` (matches PLL's `id="pll-results-container"`)
- Inner results div uses `id="serdes-configs"` with `class="serdes-results"` (matches PLL's pattern)
- Copy button includes SVG icon (matches all other calculators)
- Initial placeholder text included in HTML

Add script tag before `</body>`:
```html
<script src="js/serdes.js"></script>
```

Add nav tab (matching existing pattern with ARIA attributes):
```html
<button class="tab" data-calc="serdes" role="tab" aria-selected="false" aria-controls="serdes">SerDes Line Rate</button>
```

### 3. Modify `js/main.js`

Add to `App.calculators` (note the `XxxCalc` naming convention):
```javascript
calculators: {
  fifo: FifoCalc,
  cdc: CdcCalc,
  timing: TimingCalc,
  fixedpoint: FixedPointCalc,
  pll: PllCalc,
  serdes: SerdesCalc  // Add this
}
```

Add to `Defaults`:
```javascript
serdes: {
  linerate: '10.3125',
  refclk: '156.25',
  gttype: 'gth-us+'
}
```

Add to `CopyResults.getResultsText()` switch statement:
```javascript
case 'serdes':
  return this.formatSerdesResults();
```

Add new method to `CopyResults`:
```javascript
formatSerdesResults() {
  const table = document.querySelector('#serdes-configs table');
  if (!table) return '';

  let text = '## SerDes Line Rate Configuration\n\n';
  text += '- **Target Line Rate:** ' + document.getElementById('serdes-linerate').value + ' Gbps\n';
  text += '- **Reference Clock:** ' + document.getElementById('serdes-refclk').value + ' MHz\n';
  text += '- **GT Type:** ' + document.getElementById('serdes-gttype').options[document.getElementById('serdes-gttype').selectedIndex].text + '\n\n';

  // Get table data
  const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent);
  const rows = Array.from(table.querySelectorAll('tbody tr'));

  // Format as markdown table
  text += '| ' + headers.join(' | ') + ' |\n';
  text += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

  rows.forEach(row => {
    const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent);
    text += '| ' + cells.join(' | ') + ' |\n';
  });

  text += '\n---\n*Generated by [bitwiz.io/calc](https://bitwiz.io/calc)*';
  return text;
}
```

**Note:** The dropdown handling in the copy function needs to get the selected option's display text, not just the value.

---

## Results Table Format

Following the PLL calculator pattern (no table class - styling via `.serdes-results table`):

```html
<table role="table" aria-label="Valid PLL configurations sorted by error">
  <thead>
    <tr>
      <th scope="col">PLL</th>
      <th scope="col" aria-label="Feedback divider N">N</th>
      <th scope="col" aria-label="Reference clock divider M">M</th>
      <th scope="col" aria-label="Output divider">OUT_DIV</th>
      <th scope="col" aria-label="VCO frequency in GHz">VCO</th>
      <th scope="col" aria-label="Achieved line rate in Gbps">Line Rate</th>
      <th scope="col" aria-label="Error from target in parts per million">Error</th>
    </tr>
  </thead>
  <tbody>
    <tr class="exact" aria-label="Exact match configuration">
      <td>QPLL0</td>
      <td>66</td>
      <td>1</td>
      <td>1</td>
      <td>10.3125</td>
      <td>10.312500</td>
      <td>exact</td>
    </tr>
    <!-- NOTE: CPLL cannot achieve 10GbE at 156.25 MHz - see Verification Math section -->
    <!-- CPLL valid N values are 4,5,8,10,12,15,16,20,25; required N=33 or 66 not available -->
    <!-- ... more rows -->
  </tbody>
</table>
```

**Consistency with PLL calculator:**
- Use `.exact` class for 0 ppm matches (matches PLL pattern)
- Error column shows `exact` for errorPpm < 0.1, otherwise `errorPpm.toFixed(1)` (matches PLL)
- VCO shown with `.toFixed(4)`, Line Rate with `.toFixed(6)` (no units in table cells - matches PLL's compact format)
- Add refclk warning note below table if applicable: `<p class="refclk-note">* RefClk outside typical range</p>`

---

## Test Cases

### 10GbE (exact match expected)
- **Input:** 10.3125 Gbps, 156.25 MHz, GTH
- **Expected:** QPLL0, N=66, M=1, OUT_DIV=1, VCO=10.3125 GHz, 0 ppm
- **Why QPLL only:** CPLL cannot achieve this rate! Required N/M=33 for CPLL (with D=1), but N=33 or N=66 are NOT valid CPLL N values (valid: 4,5,8,10,12,15,16,20,25)
- **CPLL alternatives:** Use D=2 and find different N/M, but no exact match exists

### 25GbE (QPLL required, special handling needed)
- **Input:** 25.78125 Gbps, 156.25 MHz, GTY
- **Why QPLL:** CPLL max VCO is 6.25 GHz; even with DDR (*2), max line rate = 12.5 Gbps
- **Problem:** With standard QPLL formula (Line_Rate = VCO / D):
  - D=1: VCO = 25.78125 GHz (exceeds QPLL0 max 16.375 GHz!)
  - No valid configuration exists with the standard algorithm
- **Solution:** Rates above 16.375 Gbps require QPLL CLKOUT_RATE=FULL mode (UG578)
  - This changes the formula to Line_Rate = VCO * 2 / D (like CPLL)
  - For D=1: VCO = 25.78125 / 2 = 12.890625 GHz (within QPLL0 range 9.8-16.375)
  - N/M = 12.890625 / 0.15625 = 82.5 (not an integer - no exact match with 156.25 MHz!)
- **Practical solution:** Use 161.1328125 MHz refclk (common for 25GbE)
  - VCO = 161.1328125 * 80 / 1 = 12890.625 MHz = 12.890625 GHz
  - With CLKOUT_RATE=FULL, D=1: Line_Rate = 12.890625 * 2 / 1 = 25.78125 Gbps
- **Note:** This calculator does NOT implement CLKOUT_RATE=FULL mode. It will show "no valid config" for line rates above 16.375 Gbps on GTY. This is a known limitation documented here.

### PCIe Gen3
- **Input:** 8.0 Gbps, 100 MHz, GTH
- **CPLL Analysis:**
  - For D=1: VCO = 8.0 / 2 = 4.0 GHz (within 2.0-6.25 range)
  - Required N/M = 4.0 / 0.1 = 40
  - But N=40 is NOT valid for CPLL (valid: 4,5,8,10,12,15,16,20,25)
  - No exact CPLL match possible with 100 MHz refclk
- **QPLL0 Analysis:**
  - For D=1: VCO = 8.0 GHz (below QPLL0 min 9.8 GHz - INVALID)
- **QPLL1 Analysis (8.0-13.0 GHz range):**
  - For D=1: VCO = 8.0 GHz (exactly at QPLL1 min!)
  - N/M = 8.0 / 0.1 = 80
  - N=80 IS valid for QPLL1
  - **Expected:** QPLL1, N=80, M=1, OUT_DIV=1, VCO=8.0 GHz, 0 ppm
- **Verification:** 100 MHz * 80 / 1 = 8000 MHz = 8.0 GHz; Line_Rate = 8.0 / 1 = 8.0 Gbps

### 1GbE (CPLL possible)
- **Input:** 1.25 Gbps, 125 MHz, GTH
- **Required VCO:** 1.25 / 2 = 0.625 GHz (D=1) - TOO LOW for CPLL (min 2.0 GHz)
- **With D=4:** VCO = 1.25 * 4 / 2 = 2.5 GHz, N/M = 2.5 / 0.125 = 20
- **Expected:** CPLL, N=20, M=1, OUT_DIV=4, VCO=2.5 GHz, 0 ppm

### Invalid (exceeds max)
- **Input:** 20 Gbps, 156.25 MHz, GTX (max 12.5)
- **Expected:** Error message: "20 Gbps exceeds the maximum for GTX (7-Series). Valid range: 0.5 - 12.5 Gbps. Try GTH (up to 16.375 Gbps) or GTY (up to 32.75 Gbps) for higher rates."

### Invalid (below min)
- **Input:** 0.3 Gbps, 156.25 MHz, GTH (min 0.5)
- **Expected:** Error message: "0.3 Gbps is below the minimum for GTH (UltraScale+). Valid range: 0.5 - 16.375 Gbps. Try: Use a higher line rate, or select a different GT type that supports lower rates."

### Invalid (negative/zero values)
- **Input:** -5 Gbps, 156.25 MHz, GTH
- **Expected:** Error message: "Line rate must be a positive number."
- **Input:** 10 Gbps, 0 MHz, GTH
- **Expected:** Error message: "Reference clock must be a positive number."

### Invalid (refclk out of range)
- **Input:** 10.3125 Gbps, 30 MHz, GTH
- **Expected:** Warning about refclk being outside CPLL range (60-820 MHz) and QPLL range (60-820 MHz)
- **Result:** No valid configs found (because refclk is too low for any PLL)

### No valid config exists
- **Input:** 15.5 Gbps, 100 MHz, GTX
- **Why:** 15.5 Gbps exceeds GTX max of 12.5 Gbps (caught by line rate bounds)
- **Alternative test:** 7.0 Gbps, 50 MHz, GTH (refclk below 60 MHz CPLL/QPLL min)
- **Expected:** Error "No valid PLL configuration found." with:
  - Detected issues section listing refclk range violations
  - Numbered troubleshooting steps
  - Explanation of what the calculator searched

### GTX QPLL VCO gap test
- **Input:** 8.5 Gbps, 100 MHz, GTX
- **QPLL Analysis (Line_Rate = VCO / D):**
  - D=1: VCO = 8.5 GHz - falls IN THE GAP (8.0-9.8 GHz)!
  - D=2: VCO = 17.0 GHz - exceeds upper band max (12.5 GHz)!
  - D=4: VCO = 34.0 GHz - way above max!
- **Expected:** No valid QPLL configuration for exactly 8.5 Gbps
- **CPLL Analysis (Line_Rate = VCO * 2 / D):**
  - D=1: VCO = 4.25 GHz - within GTX CPLL range (1.6-3.3 GHz)? NO, 4.25 > 3.3 GHz!
  - D=2: VCO = 8.5 GHz - exceeds CPLL max (3.3 GHz)!
- **Expected:** No valid CPLL configuration either
- **Conclusion:** 8.5 Gbps cannot be achieved with GTX at any standard configuration. The gap test demonstrates why certain line rates are impossible on GTX.

### Verification Math

**10GbE at 10.3125 Gbps with 156.25 MHz reference clock:**

```
Target Line Rate: 10.3125 Gbps
Reference Clock:  156.25 MHz

=== CPLL Analysis (shows why CPLL CANNOT achieve 10GbE with this refclk) ===

Step 1: Work backwards to find required VCO frequency
  Line_Rate = VCO * 2 / D
  For D=1: VCO = Line_Rate / 2 = 10.3125 / 2 = 5.15625 GHz

Step 2: Find N/M ratio to achieve this VCO
  VCO = RefClk * N / M
  5.15625 GHz = 0.15625 GHz * N / M
  N / M = 33

Step 3: Check valid combinations
  Option A: N=33, M=1 -> N=33 is NOT valid (valid CPLL N: 4,5,8,10,12,15,16,20,25)
  Option B: N=66, M=2 -> N=66 is NOT valid for CPLL!

  CONCLUSION: 10GbE at 156.25 MHz CANNOT be achieved with CPLL using D=1.

Step 4: Try other D values for CPLL
  D=2: VCO = 10.3125 GHz (too high for CPLL max 6.25 GHz)
  D=4: VCO = 20.625 GHz (way too high)

  CONCLUSION: 10GbE at 156.25 MHz requires QPLL, not CPLL.
```

**10GbE with QPLL (the ONLY option for 156.25 MHz refclk):**

```
For QPLL: Line_Rate = VCO / D (since internal /2 and DDR *2 cancel)

Target: 10.3125 Gbps with D=1
  Required VCO = 10.3125 GHz

  VCO = RefClk * N / M
  N / M = 10.3125 / 0.15625 = 66

  Configuration: N=66, M=1, D=1
  VCO = 156.25 * 66 / 1 = 10312.5 MHz = 10.3125 GHz  (within QPLL0 range 9.8-16.375 GHz)
  Line_Rate = 10.3125 / 1 = 10.3125 Gbps

  N=66 IS a valid QPLL FBDIV value.
```

**Summary:**
| PLL Type | Possible for 10GbE @ 156.25 MHz? | Notes |
|----------|----------------------------------|-------|
| CPLL | NO | Required N=33 or 66, neither valid for CPLL |
| QPLL | YES | N=66, M=1, D=1 works perfectly |

**1GbE at 1.25 Gbps with 125 MHz reference clock (CPLL):**

```
Target Line Rate: 1.25 Gbps
Reference Clock:  125 MHz = 0.125 GHz

For CPLL with D=1: VCO = 1.25 / 2 = 0.625 GHz (below CPLL min 2.0 GHz - INVALID)

Try D=4:
  VCO = 1.25 * 4 / 2 = 2.5 GHz (within CPLL range 2.0-6.25 GHz)
  N/M = VCO / RefClk = 2.5 / 0.125 = 20

  N=20 IS a valid CPLL N value! (4x5 or 5x4)
  M=1 is valid.

  Configuration: N=20, M=1, D=4
  VCO = 0.125 * 20 / 1 = 2.5 GHz
  Line_Rate = 2.5 * 2 / 4 = 1.25 Gbps
```

---

## Common Line Rates Reference

Include as collapsible or tooltip:

### Encoding Overhead Explained

Different protocols use different line encoding schemes that add overhead to the raw data rate:

| Encoding | Overhead | Formula | Used By |
|----------|----------|---------|---------|
| 8b/10b | 20% | Data Rate x 1.25 | 1GbE, PCIe Gen1/2, SATA, USB 3.0 |
| 64b/66b | 3.125% | Data Rate x 1.03125 | 10GbE, 25GbE, 40GbE, 100GbE |
| 128b/130b | 1.54% | Data Rate x 1.0156 | PCIe Gen3/4/5/6 |
| 128b/132b | 3.03% | Data Rate x 1.03125 | USB 3.1 Gen2+ |

### Ethernet

| Protocol | Line Rate | Encoding | Data Rate | Common RefClk |
|----------|-----------|----------|-----------|---------------|
| 1GbE (1000BASE-X) | 1.25 Gbps | 8b/10b | 1.0 Gbps | 125 MHz |
| 10GbE (10GBASE-R) | 10.3125 Gbps | 64b/66b | 10.0 Gbps | 156.25 MHz |
| 25GbE | 25.78125 Gbps | 64b/66b | 25.0 Gbps | 156.25 MHz |
| 40GbE (4x10G) | 10.3125 Gbps/lane | 64b/66b | 40.0 Gbps total | 156.25 MHz |
| 100GbE (4x25G) | 25.78125 Gbps/lane | 64b/66b | 100.0 Gbps total | 156.25 MHz |
| 100GbE (10x10G) | 10.3125 Gbps/lane | 64b/66b | 100.0 Gbps total | 156.25 MHz |

**Why 10.3125 Gbps for 10GbE?** The 64b/66b encoding adds 2 sync bits per 64 data bits. To maintain 10 Gbps of user data throughput: 10 Gbps x (66/64) = 10.3125 Gbps line rate.

### PCIe

| Protocol | Line Rate (GT/s) | Encoding | Effective Data Rate | Common RefClk |
|----------|------------------|----------|---------------------|---------------|
| PCIe Gen1 | 2.5 GT/s | 8b/10b | 2.0 Gbps | 100 MHz |
| PCIe Gen2 | 5.0 GT/s | 8b/10b | 4.0 Gbps | 100 MHz |
| PCIe Gen3 | 8.0 GT/s | 128b/130b | 7.877 Gbps | 100 MHz |
| PCIe Gen4 | 16.0 GT/s | 128b/130b | 15.754 Gbps | 100 MHz |
| PCIe Gen5 | 32.0 GT/s | 128b/130b | 31.508 Gbps | 100 MHz |

**Note:** PCIe rates are specified in GT/s (gigatransfers per second), which equals line rate in Gbps. The effective data rate accounts for encoding overhead.

### SATA

| Protocol | Line Rate | Encoding | Data Rate | Common RefClk |
|----------|-----------|----------|-----------|---------------|
| SATA I (1.5G) | 1.5 Gbps | 8b/10b | 1.2 Gbps (150 MB/s) | 75 MHz or 150 MHz |
| SATA II (3G) | 3.0 Gbps | 8b/10b | 2.4 Gbps (300 MB/s) | 150 MHz |
| SATA III (6G) | 6.0 Gbps | 8b/10b | 4.8 Gbps (600 MB/s) | 150 MHz |

**RefClk Note:** SATA can use 75 MHz (x20 = 1.5G) or 150 MHz (x20 = 3.0G). The 150 MHz refclk is common for multi-rate SATA implementations.

### USB

| Protocol | Line Rate | Encoding | Data Rate | Common RefClk |
|----------|-----------|----------|-----------|---------------|
| USB 3.0 (SuperSpeed) | 5.0 Gbps | 8b/10b | 4.0 Gbps | 100 MHz |
| USB 3.1 Gen2 (SuperSpeed+) | 10.0 Gbps | 128b/132b | 9.7 Gbps | 100 MHz |
| USB 3.2 Gen2x2 | 20.0 Gbps | 128b/132b | 19.4 Gbps (2 lanes) | 100 MHz |
| USB4 Gen3x2 | 40.0 Gbps | 128b/132b | 38.8 Gbps (2 lanes) | 100 MHz |

### Display Interfaces

| Protocol | Line Rate (per lane) | Lanes | Total Bandwidth | Common RefClk |
|----------|---------------------|-------|-----------------|---------------|
| DisplayPort 1.2 (HBR2) | 5.4 Gbps | 4 | 21.6 Gbps | 135 MHz |
| DisplayPort 1.4 (HBR3) | 8.1 Gbps | 4 | 32.4 Gbps | 135 MHz |
| DisplayPort 2.0 (UHBR10) | 10.0 Gbps | 4 | 40.0 Gbps | varies |
| DisplayPort 2.0 (UHBR20) | 20.0 Gbps | 4 | 80.0 Gbps | varies |
| HDMI 2.0 | 6.0 Gbps | 3 | 18.0 Gbps | 100 MHz |
| HDMI 2.1 (FRL) | 12.0 Gbps | 4 | 48.0 Gbps | varies |

**Note:** DisplayPort 1.x uses 8b/10b encoding. DisplayPort 2.x uses 128b/132b encoding for higher efficiency.

### Aurora (Xilinx)

| Protocol | Typical Line Rates | Encoding | Notes |
|----------|-------------------|----------|-------|
| Aurora 8B/10B | 0.5 - 6.6 Gbps | 8b/10b | Lower latency, simpler |
| Aurora 64B/66B | 0.5 - 25+ Gbps | 64b/66b | Higher bandwidth, 10.3125 Gbps common |

Aurora line rates are flexible and depend on the GT transceiver used. Common rates align with Ethernet (10.3125 Gbps) for shared infrastructure.

---

## Future Enhancements (v2.0 considerations)

The following features are explicitly deferred to keep v1.0 focused and maintainable:

### High Priority (most requested)
1. **QPLL CLKOUT_RATE=FULL mode** - Support line rates above 16.375 Gbps (25GbE, PCIe Gen5)
   - Requires alternate formula: `Line_Rate = VCO * 2 / D`
   - Must detect when target > 16.375 Gbps and switch formulas
   - Add "CLKOUT_RATE=FULL" indicator in results

2. **Protocol presets dropdown** - Quick selection of common protocols
   - Example: "10GbE" auto-fills 10.3125 Gbps, 156.25 MHz
   - Example: "PCIe Gen3" auto-fills 8.0 Gbps, 100 MHz
   - Separate from GT type selection

### Medium Priority
3. **Intel/Altera transceiver support** - Would require:
   - New GT_SPECS entries for Stratix/Agilex transceivers
   - Different terminology (ATX PLL, fPLL, CMU PLL)
   - Significant research and validation effort

4. **Versal transceiver support (GTY/GTYP)** - Would require:
   - Updated specs for Versal-specific parameters
   - Potentially PAM4 mode support for GTYP

5. **Board-specific reference clock presets** - Common dev boards:
   - KCU105: 156.25 MHz, 125 MHz
   - ZCU102: 156.25 MHz, 100 MHz
   - VCU118: 156.25 MHz, 100 MHz
   - Adds convenience but not essential

### Low Priority
6. **Export to Vivado TCL** - Generate GT wizard constraints
7. **Jitter budget estimation** - Would need additional PLL specs
8. **Multi-lane configuration** - For bonded channel scenarios

### Explicitly Not Planned
- GTP transceiver support (obsolete, low demand)
- GTF/GTM transceiver support (too specialized, Versal HBM only)
- PAM4 modulation (fundamentally different calculation model)

---

## Implementation Checklist

**Recommended implementation order:** HTML structure -> JavaScript logic -> main.js integration -> CSS styling -> Testing

### Phase 1: HTML (`index.html`)
- [ ] Add nav tab button with `data-calc="serdes"` and ARIA attributes
- [ ] Add section with `id="serdes"` and `class="calculator"`
- [ ] Add GT Type dropdown with `id="serdes-gttype"` and GTX/GTH/GTY options
- [ ] Add input fields: `serdes-linerate`, `serdes-refclk`
- [ ] Use `id="serdes-results-container"` for results wrapper (matches PLL pattern)
- [ ] Use `id="serdes-configs"` with `class="serdes-results"` for inner results div
- [ ] Include SVG icon in copy button (matches other calculators)
- [ ] Add reset button with `data-calc="serdes"`
- [ ] Use `<span class="tip-list">` for bullet lists in tooltips
- [ ] Do NOT include tooltip close buttons (added by JS)
- [ ] Add script tag for `js/serdes.js` before `</body>`

### Phase 2: JavaScript (`js/serdes.js`)
- [ ] Create `SerdesCalc` singleton (not `Serdes` - must match `XxxCalc` naming convention)
- [ ] Define GT_SPECS object with all GT types:
  - [ ] GTX specs with `cpll`, `qpll` (vcoBands array for dual-band)
  - [ ] GTH specs with `cpll`, `qpll0`, `qpll1`
  - [ ] GTY specs with `cpll`, `qpll0`, `qpll1`
- [ ] Add reference clock input ranges to each GT type (cpllRefclkRange, qpllRefclkRange)
- [ ] Implement `init()` method binding input/change events
- [ ] Implement `calculate()` method:
  - [ ] Input validation (empty, NaN, negative, zero)
  - [ ] Line rate bounds checking (min and max per GT type)
  - [ ] Reference clock range validation with warnings
  - [ ] CPLL calculation loop with VCO range checking
  - [ ] QPLL0 calculation loop (UltraScale+)
  - [ ] QPLL1 calculation loop (UltraScale+)
  - [ ] QPLL calculation loop with vcoBands (7-series GTX)
  - [ ] Sort results by errorPpm (full precision)
  - [ ] Limit to top 10 results
  - [ ] Handle "no valid config found" with helpful HTML message
- [ ] Render results inline in `calculate()` (no separate displayConfigs method)
- [ ] Use full precision for sorting, display formatting only at render time
- [ ] Implement `getState()` returning linerate, refclk, gttype
- [ ] Implement `setState(state)` with undefined checks, calling calculate()

### Phase 3: main.js Integration
- [ ] Register `SerdesCalc` in `App.calculators` object
- [ ] Add defaults to `Defaults.serdes` object
- [ ] Add `case 'serdes':` to `CopyResults.getResultsText()` switch
- [ ] Add `formatSerdesResults()` method to `CopyResults`
- [ ] Verify reset button functionality works with new calculator
- [ ] Verify URL state persistence works with dropdown values

### Phase 3b: Styling (`css/style.css`)

**Required CSS classes (add if not already present):**

```css
/* SerDes results table - can reuse .pll-results table styles */
.serdes-results table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.serdes-results th,
.serdes-results td {
  padding: 0.5rem;
  text-align: center;
  border-bottom: 1px solid var(--border-color, #ddd);
}

.serdes-results th {
  font-weight: 600;
  background: var(--header-bg, #f5f5f5);
}

/* Exact match row highlighting */
.serdes-results tr.exact {
  background: var(--success-bg, #d4edda);
}

/* Reference clock warning note */
.refclk-note {
  font-size: 0.85rem;
  color: var(--warning-color, #856404);
  margin-top: 0.5rem;
  font-style: italic;
}

/* Error message bullet points */
.error-bullet {
  display: block;
  margin-left: 1rem;
  color: var(--text-secondary, #666);
}

/* Tooltip footnote styling */
.tooltip-note {
  font-size: 0.85em;
  opacity: 0.8;
  margin-top: 0.5rem;
  font-style: italic;
}

/* Results guide section */
.results-guide {
  margin-top: 1.5rem;
  padding: 1rem;
  background: var(--guide-bg, #f8f9fa);
  border-radius: 4px;
}

.results-guide summary {
  cursor: pointer;
  font-weight: 500;
}

.results-guide .guide-content {
  margin-top: 1rem;
}

/* Important notes section */
.calculator-notes {
  margin-top: 1.5rem;
  padding: 1rem;
  background: var(--notes-bg, #fff3cd);
  border-left: 3px solid var(--warning-color, #ffc107);
  border-radius: 4px;
}

.calculator-notes ul {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}

/* Screen reader only text */
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

**Checklist:**
- [ ] Add `.serdes-results table` styles (or verify PLL table styles apply via shared class)
- [ ] Add `.refclk-note` class for warning messages
- [ ] Add/verify `.exact` row class styling for highlight
- [ ] Add `.results-guide` and `details/summary` for collapsible guidance
- [ ] Add `.calculator-notes` for the important notes section
- [ ] Add `.error-bullet` for formatted error list items
- [ ] Add `.tooltip-note` for tooltip footnotes
- [ ] Add `.visually-hidden` class for screen reader text (if not already present)

### Phase 4: Accessibility
- [ ] Add `aria-describedby` attributes to input fields
- [ ] Add `.visually-hidden` hint spans for screen readers
- [ ] Add `role="table"` and `aria-label` to results table
- [ ] Add `scope="col"` and descriptive `aria-label` to table headers
- [ ] Add `aria-label` to table rows describing the configuration
- [ ] Ensure results container has `aria-live="polite"` for dynamic updates
- [ ] Add proper focus management for error states
- [ ] Test with screen reader (VoiceOver/NVDA) for basic usability

### Phase 5: Testing

**Functional tests (from Test Cases section):**
- [ ] 10GbE exact match: 10.3125 Gbps, 156.25 MHz, GTH -> QPLL0, N=66, M=1, D=1, 0 ppm
- [ ] PCIe Gen3: 8.0 Gbps, 100 MHz, GTH -> QPLL1, N=80, M=1, D=1, 0 ppm
- [ ] 1GbE: 1.25 Gbps, 125 MHz, GTH -> CPLL, N=20, M=1, D=4, 0 ppm
- [ ] Invalid exceeds max: 20 Gbps, 156.25 MHz, GTX -> Error message
- [ ] Invalid below min: 0.3 Gbps, 156.25 MHz, GTH -> Error message
- [ ] Invalid negative: -5 Gbps -> Error message
- [ ] Invalid zero refclk: 10 Gbps, 0 MHz -> Error message
- [ ] Refclk out of range: 10.3125 Gbps, 30 MHz, GTH -> Warning + no results
- [ ] GTX QPLL VCO gap: 8.5 Gbps, 100 MHz, GTX -> Verify gap is respected

**Integration tests:**
- [ ] Verify URL state persistence with dropdown value changes
- [ ] Test reset button restores defaults
- [ ] Test copy functionality produces valid markdown table
- [ ] Verify tab switching maintains calculator state
- [ ] Test responsive layout on mobile viewport

**Cross-browser tests:**
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest, if available)

**Validation tests:**
- [ ] Verify CPLL formula: Line_Rate = VCO * 2 / D against UG476/UG576
- [ ] Verify QPLL formula: Line_Rate = VCO / D against UG476/UG576
- [ ] Cross-check N/M values against Xilinx transceiver wizard
- [ ] Verify VCO ranges match datasheet specs
