// FIFO Depth Calculator
// Formula: depth = burst + burst × (f_write - f_read) / f_read + latency

const FifoCalc = {
  elements: {},

  init() {
    this.elements = {
      fwrite: document.getElementById('fifo-fwrite'),
      fread: document.getElementById('fifo-fread'),
      burst: document.getElementById('fifo-burst'),
      latency: document.getElementById('fifo-latency'),
      minDepth: document.getElementById('fifo-min-depth'),
      pow2Depth: document.getElementById('fifo-pow2-depth')
    };

    // Bind input events
    const inputs = [this.elements.fwrite, this.elements.fread,
                    this.elements.burst, this.elements.latency];
    inputs.forEach(input => {
      input.addEventListener('input', () => this.calculate());
    });

    // Initial calculation
    this.calculate();
  },

  calculate() {
    const fWrite = parseFloat(this.elements.fwrite.value) || 0;
    const fRead = parseFloat(this.elements.fread.value) || 0;
    const burst = parseInt(this.elements.burst.value) || 0;
    const latency = parseInt(this.elements.latency.value) || 0;

    if (fRead <= 0 || fWrite <= 0 || burst <= 0) {
      this.elements.minDepth.textContent = '--';
      this.elements.pow2Depth.textContent = '--';
      return;
    }

    // Calculate minimum depth
    // depth = burst + burst × (f_write - f_read) / f_read + latency
    let minDepth;
    if (fWrite > fRead) {
      // Write faster than read - need extra depth to absorb the rate difference
      minDepth = burst + (burst * (fWrite - fRead) / fRead) + latency;
    } else {
      // Read faster or equal - just need burst + latency margin
      minDepth = burst + latency;
    }

    minDepth = Math.ceil(minDepth);

    // Round up to power of 2 (common for FPGA FIFOs)
    const pow2Depth = this.nextPowerOf2(minDepth);

    this.elements.minDepth.textContent = minDepth + ' words';
    this.elements.pow2Depth.textContent = pow2Depth + ' words';
  },

  nextPowerOf2(n) {
    if (n <= 0) return 1;
    return Math.pow(2, Math.ceil(Math.log2(n)));
  },

  getState() {
    return {
      fwrite: this.elements.fwrite.value,
      fread: this.elements.fread.value,
      burst: this.elements.burst.value,
      latency: this.elements.latency.value
    };
  },

  setState(state) {
    if (state.fwrite !== undefined) this.elements.fwrite.value = state.fwrite;
    if (state.fread !== undefined) this.elements.fread.value = state.fread;
    if (state.burst !== undefined) this.elements.burst.value = state.burst;
    if (state.latency !== undefined) this.elements.latency.value = state.latency;
    this.calculate();
  }
};
