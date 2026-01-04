# fpga_calc

Interactive calculators for FPGA engineers. No accounts, no BS, instant results.

## Calculators

### 1. FIFO Depth
Calculate minimum FIFO depth to prevent overflow/underflow.

**Inputs:**
- Write clock frequency (MHz)
- Read clock frequency (MHz)
- Burst length (words)
- Max latency before read starts (cycles)

**Output:** Minimum depth (rounded to power of 2)

---

### 2. CDC MTBF
Metastability analysis for clock domain crossing synchronizers.

**Inputs:**
- Data clock frequency (MHz)
- Sampling clock frequency (MHz)
- Metastability window (ps) - device dependent, ~50ps typical
- Settling time constant (ps) - device dependent
- Number of sync stages

**Output:** MTBF in years, recommendation (2 vs 3 stages)

---

### 3. Timing Budget
Calculate available slack and max combinational delay.

**Inputs:**
- Clock period (ns) or frequency (MHz)
- Flip-flop setup time (ns)
- Clock uncertainty/jitter (ns)
- Clock-to-Q delay (ns)

**Output:** Available time for combinational logic, estimated logic levels possible

---

### 4. Fixed-Point Precision
Determine bit widths for fixed-point representation.

**Inputs:**
- Value range: min, max
- Required precision (decimal places OR LSB weight)
- Signed/unsigned

**Output:** Integer bits, fractional bits, total width, actual range/precision achieved

---

### 5. PLL/MMCM Config
Find valid PLL configurations for target frequency.

**Inputs:**
- Input frequency (MHz)
- Desired output frequency (MHz)
- VCO range (min/max MHz) - device dependent
- Allowed divider ranges (M, D, O)

**Output:** Valid M/D/O combinations, actual output freq, error in ppm

---

## Tech Stack

- Vanilla HTML/CSS/JS (like wiki_rabbit_hole)
- Single page, all calculators accessible via tabs or sections
- No build step, no frameworks
- Mobile responsive
- Terminal aesthetic (matches bitwiz.io)

## Design Principles

- Instant calculation on input change (no submit buttons)
- Show the formula used (educational)
- Sensible defaults for typical FPGAs
- Copy-friendly outputs
- URL params to share specific calculations

## File Structure

```
index.html          # Main page with all calculators
style.css           # Terminal aesthetic styling
js/
  fifo.js           # FIFO depth logic
  cdc.js            # MTBF calculation
  timing.js         # Timing budget
  fixedpoint.js     # Fixed-point precision
  pll.js            # PLL configuration
  main.js           # Tab switching, URL params, shared utils
```

## Formulas

### FIFO Depth
```
depth = burst_length + (burst_length * (f_write - f_read) / f_read) + latency_margin
```

### CDC MTBF
```
MTBF = exp(t_resolve / tau) / (f_data * f_sample * T_window)
```
Where t_resolve = clock_period - setup_time - routing_delay

### Timing Budget
```
t_logic_max = t_period - t_setup - t_uncertainty - t_clk_to_q
```

### Fixed-Point
```
integer_bits = ceil(log2(max(|min|, |max|))) + (1 if signed else 0)
fractional_bits = ceil(-log2(precision))
```

### PLL Output
```
f_out = f_in * M / (D * O)
f_vco = f_in * M / D
```

## Future Ideas (not MVP)

- Preset device profiles (7-series, UltraScale, Intel)
- Export to XDC/SDC constraint snippet
- Multi-output PLL calculator
- BRAM vs distributed RAM decision helper
