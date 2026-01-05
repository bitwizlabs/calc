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
//   AMD: UG482 (7-Series GTP), UG476 (7-Series GTX/GTH), UG576 (UltraScale GTH), UG578 (UltraScale+ GTY)
//   Intel: Cyclone 10 GX, Arria 10, Stratix 10 L/H/E-Tile Transceiver PHY User Guides

const GT_SPECS = {
  // GTP (Artix-7) - Lower-power, lower-speed variant
  // Source: UG482 (7 Series FPGAs GTP Transceivers User Guide)
  gtp: {
    name: 'GTP (Artix-7)',
    lineRateMin: 0.5,      // Gbps
    lineRateMax: 6.6,      // Gbps (Artix-7 max)

    // Reference clock input range (UG482 Table 2-5)
    cpllRefclkRange: { min: 60, max: 250 },   // MHz - narrower than GTX

    // GTP has only CPLL (one per channel), no QPLL
    cpll: {
      vcoMin: 1.6,         // GHz
      vcoMax: 3.3,         // GHz
      nVals: [4, 5, 8, 10, 12, 15, 16, 20, 25],  // N1 * N2 products
      mVals: [1, 2]        // REFCLK_DIV
    },

    // Note: GTP has PLL0/PLL1 which are channel PLLs, not quad PLLs
    // They use the same formula as CPLL: Line_Rate = VCO * 2 / D
    // For simplicity, we model this as CPLL only since the math is identical

    outDivs: [1, 2, 4, 8]  // No 16x divider on GTP
  },

  // GTX (7-Series: Kintex-7, Virtex-7) - Higher-speed variant
  // Source: UG476 (7 Series FPGAs GTX/GTH Transceivers User Guide)
  gtx: {
    name: 'GTX (Kintex-7/Virtex-7)',
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

  // GTH (UltraScale) - non-Plus variant
  // Source: UG576 (UltraScale Architecture GTH Transceivers User Guide)
  'gth-us': {
    name: 'GTH (UltraScale)',
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

  // GTH (UltraScale+) - Plus variant with minor process improvements
  // Source: UG576 (UltraScale Architecture GTH Transceivers User Guide)
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
    lineRateMax: 32.75,    // Gbps - up to 32.75 Gbps with QPLL FULL rate mode

    // Reference clock input ranges (for validation)
    cpllRefclkRange: { min: 60, max: 820 },   // MHz (UG578 Table 2-3)
    qpllRefclkRange: { min: 60, max: 820 },   // MHz (UG578 Table 2-7)

    cpll: {
      vcoMin: 2.0,         // GHz
      vcoMax: 6.25,        // GHz
      nVals: [4, 5, 8, 10, 12, 15, 16, 20, 25],
      mVals: [1, 2]
    },

    // QPLL HALF rate mode (CLKOUT_RATE=HALF): Line_Rate = VCO / outDiv
    // Used for rates up to 16.375 Gbps
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

    // QPLL FULL rate mode (CLKOUT_RATE=FULL): Line_Rate = VCO * 2 / outDiv
    // Used for rates 16.375-32.75 Gbps (e.g., 25GbE)
    qpll0Full: {
      vcoMin: 9.8,         // GHz
      vcoMax: 16.375,      // GHz
      nVals: [16, 20, 32, 40, 60, 64, 66, 75, 80, 84, 90, 96, 100, 112, 120, 125, 128, 150, 160],
      mVals: [1, 2, 3, 4],
      fullRateMode: true   // Flag to use *2 formula
    },

    qpll1Full: {
      vcoMin: 8.0,         // GHz
      vcoMax: 13.0,        // GHz
      nVals: [16, 20, 32, 40, 60, 64, 66, 75, 80, 84, 90, 96, 100, 112, 120, 125, 128, 150, 160],
      mVals: [1, 2, 3, 4],
      fullRateMode: true
    },

    outDivs: [1, 2, 4, 8, 16]
  },

  // GTM (Versal Premium) - Highest speed AMD transceiver
  // Source: AMD PG331 (Versal ACAP Integrated 112G Multirate Ethernet)
  // Supports both NRZ (up to 58 Gbps) and PAM4 (up to 112 Gbps)
  gtm: {
    name: 'GTM (Versal Premium)',
    lineRateMin: 1.25,     // Gbps (supports full range per AM017)
    lineRateMax: 112.0,    // Gbps (PAM4 maximum)

    // Reference clock input ranges
    cpllRefclkRange: { min: 60, max: 820 },   // MHz
    qpllRefclkRange: { min: 60, max: 820 },   // MHz

    // LCPLL (LC-tank PLL) - Primary TX PLL, lowest jitter
    // For NRZ mode: Line_Rate = VCO * 2 / outDiv (DDR)
    // For PAM4 mode: Line_Rate = VCO * 4 / outDiv (PAM4 doubles effective rate)
    lcpll: {
      vcoMin: 12.375,      // GHz
      vcoMax: 28.21,       // GHz
      // Extended N range to support 100G/400G Ethernet rates
      nVals: [16, 20, 25, 32, 40, 50, 64, 66, 75, 80, 84, 90, 96, 100, 110, 120, 125, 128, 132, 140, 150, 160, 165, 166, 170, 175, 180, 192, 200],
      mVals: [1, 2, 4]
    },

    // RPLL (Ring PLL) - Alternative, wider frequency range
    rpll: {
      vcoMin: 9.8,         // GHz
      vcoMax: 16.375,      // GHz
      nVals: [16, 20, 32, 40, 60, 64, 66, 75, 80, 84, 90, 96, 100, 112, 120, 125, 128, 150, 160],
      mVals: [1, 2, 3, 4]
    },

    outDivs: [1, 2, 4],    // GTM has fewer output dividers
    supportsPAM4: true     // Flag for PAM4 capable device
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
      vcoMin: 4.8,         // GHz - lowered to support 1GbE (VCO ~5 GHz)
      vcoMax: 12.5,        // GHz
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
  // Source: Intel Stratix 10 L- and H-Tile Transceiver PHY User Guide
  'stratix10-l': {
    name: 'Stratix 10 L-Tile',
    vendor: 'intel',
    lineRateMin: 0.6,      // Gbps
    lineRateMax: 17.4,     // Gbps

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
  },

  // Stratix 10 H-Tile - Higher speed variant
  // Source: Intel Stratix 10 L- and H-Tile Transceiver PHY User Guide
  'stratix10-h': {
    name: 'Stratix 10 H-Tile',
    vendor: 'intel',
    lineRateMin: 0.6,      // Gbps
    lineRateMax: 28.3,     // Gbps (NRZ mode)

    refclkRange: { min: 50, max: 800 },   // MHz

    // ATX PLL - Extended VCO range for higher rates
    atxpll: {
      vcoMin: 7.2,         // GHz
      vcoMax: 14.4,        // GHz
      mRange: { min: 8, max: 127 },
      nVals: [1, 2, 4, 8]
    },

    // fPLL
    fpll: {
      vcoMin: 5.0,         // GHz - per Intel spec
      vcoMax: 14.4,        // GHz - per Intel spec
      mRange: { min: 8, max: 127 },
      nVals: [1, 2, 4, 8]
    },

    lDivs: [1, 2, 4, 8]    // L counter (output divider)
  },

  // Stratix 10 E-Tile - Highest speed, supports PAM4
  // Source: Intel Stratix 10 E-Tile Transceiver PHY User Guide
  'stratix10-e': {
    name: 'Stratix 10 E-Tile',
    vendor: 'intel',
    lineRateMin: 1.0,      // Gbps
    lineRateMax: 57.8,     // Gbps (PAM4); 28.9 Gbps NRZ

    refclkRange: { min: 100, max: 800 },   // MHz - narrower min for E-Tile

    // ATX PLL - LC-tank for lower jitter
    atxpll: {
      vcoMin: 7.2,         // GHz
      vcoMax: 14.4,        // GHz
      mRange: { min: 8, max: 127 },
      nVals: [1, 2, 4, 8]
    },

    // fPLL - Ring oscillator, wider range
    fpll: {
      vcoMin: 5.0,         // GHz
      vcoMax: 14.4,        // GHz
      mRange: { min: 8, max: 127 },
      nVals: [1, 2, 4, 8]
    },

    lDivs: [1, 2, 4, 8],   // L counter (output divider)
    supportsPAM4: true     // E-Tile supports PAM4 up to 57.8 Gbps
  },

  // Intel Agilex F-Tile - Highest speed Intel transceiver
  // Source: Intel Agilex 7 F-Tile Transceiver PHY User Guide
  // Supports NRZ (up to 58 Gbps) and PAM4 (up to 116 Gbps)
  'agilex-f': {
    name: 'Agilex F-Tile',
    vendor: 'intel',
    lineRateMin: 1.0,      // Gbps
    lineRateMax: 116.0,    // Gbps (PAM4); 58 Gbps NRZ

    refclkRange: { min: 100, max: 800 },   // MHz

    // ATX PLL - LC-tank for lower jitter
    atxpll: {
      vcoMin: 7.2,         // GHz
      vcoMax: 14.4,        // GHz
      mRange: { min: 8, max: 127 },
      nVals: [1, 2, 4, 8]
    },

    // fPLL - Ring oscillator, wider range
    fpll: {
      vcoMin: 5.0,         // GHz
      vcoMax: 14.4,        // GHz
      mRange: { min: 8, max: 127 },
      nVals: [1, 2, 4, 8]
    },

    lDivs: [1, 2, 4, 8],   // L counter (output divider)
    supportsPAM4: true     // Flag for PAM4 capable device
  },

  // Intel Agilex R-Tile - PCIe Gen5 optimized transceiver
  // Source: Intel Agilex 7 R-Tile Avalon Streaming Intel FPGA IP User Guide
  // Supports NRZ only (up to 32 Gbps for PCIe Gen5)
  'agilex-r': {
    name: 'Agilex R-Tile',
    vendor: 'intel',
    lineRateMin: 1.0,      // Gbps
    lineRateMax: 32.0,     // Gbps (NRZ only, optimized for PCIe Gen5)

    refclkRange: { min: 100, max: 800 },   // MHz

    // ATX PLL
    atxpll: {
      vcoMin: 7.2,         // GHz
      vcoMax: 14.4,        // GHz
      mRange: { min: 8, max: 127 },
      nVals: [1, 2, 4, 8]
    },

    // fPLL
    fpll: {
      vcoMin: 5.0,         // GHz
      vcoMax: 14.4,        // GHz
      mRange: { min: 8, max: 127 },
      nVals: [1, 2, 4, 8]
    },

    lDivs: [1, 2, 4, 8],   // L counter (output divider)
    supportsPAM4: false    // R-Tile is NRZ only
  }
};

// Common protocol presets with standard line rates and reference clocks
const PROTOCOLS = {
  // Ethernet
  '1gbe': { name: '1GbE (1000BASE-X)', lineRate: 1.25, refclks: [125, 62.5], category: 'Ethernet' },
  '2.5gbe': { name: '2.5GbE', lineRate: 3.125, refclks: [156.25, 125], category: 'Ethernet' },
  '5gbe': { name: '5GbE', lineRate: 5.15625, refclks: [156.25], category: 'Ethernet' },
  '10gbe': { name: '10GbE (10GBASE-R)', lineRate: 10.3125, refclks: [156.25, 312.5], category: 'Ethernet' },
  '25gbe': { name: '25GbE', lineRate: 25.78125, refclks: [156.25, 322.265625], category: 'Ethernet' },
  '40gbe': { name: '40GbE (per lane)', lineRate: 10.3125, refclks: [156.25, 312.5], category: 'Ethernet' },
  '50gbe-nrz': { name: '50GbE (NRZ)', lineRate: 26.5625, refclks: [156.25], category: 'Ethernet' },
  '50gbe': { name: '50GbE (PAM4)', lineRate: 53.125, refclks: [161.1328125, 156.25], category: 'Ethernet' },
  '100gbe': { name: '100GbE (PAM4)', lineRate: 106.25, refclks: [161.1328125, 156.25], category: 'Ethernet' },
  '400gbe': { name: '400GbE (per lane)', lineRate: 106.25, refclks: [161.1328125, 156.25], category: 'Ethernet' },

  // PCIe
  'pcie-gen1': { name: 'PCIe Gen1 (2.5 GT/s)', lineRate: 2.5, refclks: [100], category: 'PCIe' },
  'pcie-gen2': { name: 'PCIe Gen2 (5 GT/s)', lineRate: 5.0, refclks: [100], category: 'PCIe' },
  'pcie-gen3': { name: 'PCIe Gen3 (8 GT/s)', lineRate: 8.0, refclks: [100], category: 'PCIe' },
  'pcie-gen4': { name: 'PCIe Gen4 (16 GT/s)', lineRate: 16.0, refclks: [100], category: 'PCIe' },
  'pcie-gen5': { name: 'PCIe Gen5 (32 GT/s)', lineRate: 32.0, refclks: [100], category: 'PCIe' },

  // Storage
  'sata1': { name: 'SATA I (1.5 Gbps)', lineRate: 1.5, refclks: [150, 75], category: 'Storage' },
  'sata2': { name: 'SATA II (3 Gbps)', lineRate: 3.0, refclks: [150, 75], category: 'Storage' },
  'sata3': { name: 'SATA III (6 Gbps)', lineRate: 6.0, refclks: [150, 75], category: 'Storage' },
  'sas1': { name: 'SAS-1 (3 Gbps)', lineRate: 3.0, refclks: [150], category: 'Storage' },
  'sas2': { name: 'SAS-2 (6 Gbps)', lineRate: 6.0, refclks: [150], category: 'Storage' },
  'sas3': { name: 'SAS-3 (12 Gbps)', lineRate: 12.0, refclks: [150], category: 'Storage' },

  // USB
  'usb3-gen1': { name: 'USB 3.0/3.1 Gen1 (5 Gbps)', lineRate: 5.0, refclks: [125, 100, 48], category: 'USB' },
  'usb3-gen2': { name: 'USB 3.1 Gen2 (10 Gbps)', lineRate: 10.0, refclks: [125, 100, 48], category: 'USB' },

  // Video
  'dp-rbr': { name: 'DisplayPort RBR (1.62 Gbps)', lineRate: 1.62, refclks: [135, 81], category: 'Video' },
  'dp-hbr': { name: 'DisplayPort HBR (2.7 Gbps)', lineRate: 2.7, refclks: [135, 270], category: 'Video' },
  'dp-hbr2': { name: 'DisplayPort HBR2 (5.4 Gbps)', lineRate: 5.4, refclks: [135, 270], category: 'Video' },
  'dp-hbr3': { name: 'DisplayPort HBR3 (8.1 Gbps)', lineRate: 8.1, refclks: [135, 270], category: 'Video' },
  'hdmi-1.4': { name: 'HDMI 1.4 (3.4 Gbps)', lineRate: 3.4, refclks: [148.5, 74.25], category: 'Video' },
  'hdmi-2.0': { name: 'HDMI 2.0 (6 Gbps)', lineRate: 6.0, refclks: [148.5, 74.25], category: 'Video' },

  // Fiber Channel
  'fc-1g': { name: 'FC 1GFC', lineRate: 1.0625, refclks: [106.25, 212.5], category: 'Fiber Channel' },
  'fc-2g': { name: 'FC 2GFC', lineRate: 2.125, refclks: [106.25, 212.5], category: 'Fiber Channel' },
  'fc-4g': { name: 'FC 4GFC', lineRate: 4.25, refclks: [106.25, 212.5], category: 'Fiber Channel' },
  'fc-8g': { name: 'FC 8GFC', lineRate: 8.5, refclks: [106.25, 212.5], category: 'Fiber Channel' },
  'fc-16g': { name: 'FC 16GFC', lineRate: 14.025, refclks: [156.25], category: 'Fiber Channel' }
};

const SerdesCalc = {
  elements: {},

  init() {
    this.elements = {
      linerate: document.getElementById('serdes-linerate'),
      refclk: document.getElementById('serdes-refclk'),
      gttype: document.getElementById('serdes-gttype'),
      protocol: document.getElementById('serdes-protocol'),
      refclkPreset: document.getElementById('serdes-refclk-preset'),
      configs: document.getElementById('serdes-configs')
    };

    // Line rate input - clear protocol when manually edited
    this.elements.linerate.addEventListener('input', () => {
      this.elements.protocol.value = '';
      this.calculate();
    });

    // Refclk input - clear both protocol and refclk preset when manually edited
    this.elements.refclk.addEventListener('input', () => {
      this.elements.protocol.value = '';
      this.elements.refclkPreset.value = '';
      this.calculate();
    });

    // Bind select change events
    this.elements.gttype.addEventListener('change', () => {
      this.updateProtocolOptions();
      this.calculate();
    });

    // Refclk preset handler
    this.elements.refclkPreset.addEventListener('change', () => {
      if (this.elements.refclkPreset.value) {
        this.elements.refclk.value = this.elements.refclkPreset.value;
      }
      this.calculate();
    });

    // Protocol preset handler
    this.elements.protocol.addEventListener('change', () => {
      const protocol = PROTOCOLS[this.elements.protocol.value];
      if (protocol) {
        this.elements.linerate.value = protocol.lineRate;
        this.elements.refclk.value = protocol.refclks[0];
        // Try to match refclk preset dropdown, or set to custom if not found
        this.elements.refclkPreset.value = protocol.refclks[0].toString();
        if (!this.elements.refclkPreset.value) {
          this.elements.refclkPreset.value = ''; // Custom
        }
      }
      this.updateRefclkOptions();
      this.calculate();
    });

    // Initial filter update
    this.updateProtocolOptions();
    this.updateRefclkOptions();

    // Initial calculation
    this.calculate();
  },

  // Filter protocol options based on selected device's line rate range
  updateProtocolOptions() {
    const gtType = this.elements.gttype.value;
    const protocolSelect = this.elements.protocol;
    const currentValue = protocolSelect.value;

    // Get device specs (if selected)
    const specs = gtType ? GT_SPECS[gtType] : null;

    // Show/hide protocol options based on device capability
    const options = protocolSelect.querySelectorAll('option[value]');
    options.forEach(option => {
      if (!option.value) return; // Skip "Custom" option

      const protocol = PROTOCOLS[option.value];
      if (!protocol) return;

      // Show option if no device selected, or if protocol is within device range
      const isCompatible = !specs ||
        (protocol.lineRate >= specs.lineRateMin && protocol.lineRate <= specs.lineRateMax);

      option.style.display = isCompatible ? '' : 'none';
      option.disabled = !isCompatible;
    });

    // If current selection is now hidden, reset to Custom
    if (currentValue) {
      const currentOption = protocolSelect.querySelector(`option[value="${currentValue}"]`);
      if (currentOption && currentOption.disabled) {
        protocolSelect.value = '';
      }
    }
  },

  // Filter refclk options based on selected protocol
  updateRefclkOptions() {
    const protocolKey = this.elements.protocol.value;
    const refclkSelect = this.elements.refclkPreset;
    const currentValue = refclkSelect.value;

    // Get protocol's valid refclks (if selected)
    const protocol = protocolKey ? PROTOCOLS[protocolKey] : null;
    const validRefclks = protocol ? protocol.refclks : null;

    // Show/hide refclk options based on protocol
    const options = refclkSelect.querySelectorAll('option[value]');
    options.forEach(option => {
      if (!option.value) return; // Skip "Custom" option

      const refclkValue = parseFloat(option.value);

      // Show option if no protocol selected, or if refclk is in protocol's list
      const isCompatible = !validRefclks || validRefclks.includes(refclkValue);

      option.style.display = isCompatible ? '' : 'none';
      option.disabled = !isCompatible;
    });

    // If current selection is now hidden, reset to Custom (unless it matches protocol)
    if (currentValue && validRefclks) {
      const currentRefclk = parseFloat(currentValue);
      if (!validRefclks.includes(currentRefclk)) {
        // Auto-select the first valid refclk for this protocol
        refclkSelect.value = validRefclks[0].toString();
        if (refclkSelect.value) {
          this.elements.refclk.value = refclkSelect.value;
        } else {
          refclkSelect.value = ''; // Custom if not in dropdown
        }
      }
    }
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
      if (gtType === 'gtp') {
        suggestion = 'Try GTX (Kintex-7/Virtex-7, up to 12.5 Gbps) or GTH for higher rates.';
      } else if (gtType === 'gtx') {
        suggestion = 'Try GTH (up to 16.375 Gbps) or GTY (up to 32.75 Gbps with QPLL FULL mode) for higher rates.';
      } else if (gtType === 'gth-us' || gtType === 'gth-us+') {
        suggestion = 'Try GTY (up to 32.75 Gbps with QPLL FULL rate mode) for 25GbE and higher rates.';
      } else if (gtType === 'gty') {
        suggestion = 'Try Versal GTM (up to 112 Gbps PAM4) for 100GbE and higher rates.';
      } else if (gtType === 'gtm') {
        suggestion = '112 Gbps is the maximum for GTM (PAM4 mode). For NRZ, max is ~58 Gbps.';
      } else if (gtType === 'cyclone10gx') {
        suggestion = 'Try Arria 10 GX (up to 17.4 Gbps) or Stratix 10 L-Tile for higher rates.';
      } else if (gtType === 'arria10gx' || gtType === 'stratix10-l') {
        suggestion = 'Try Stratix 10 H-Tile (up to 28.3 Gbps) or E-Tile (up to 57.8 Gbps PAM4) for higher rates.';
      } else if (gtType === 'stratix10-h') {
        suggestion = 'Try Stratix 10 E-Tile (up to 57.8 Gbps PAM4) or Agilex F-Tile (up to 116 Gbps PAM4) for higher rates.';
      } else if (gtType === 'stratix10-e') {
        suggestion = 'Try Agilex F-Tile (up to 116 Gbps PAM4) for higher rates.';
      } else if (gtType === 'agilex-f') {
        suggestion = '116 Gbps is the maximum for Agilex F-Tile (PAM4 mode). For NRZ, max is ~58 Gbps.';
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

    // Try QPLL0 FULL rate mode (GTY only) - AMD/Xilinx only
    // FULL rate mode formula: Line_Rate = VCO * 2 / outDiv (same as CPLL)
    if (!isIntel && specs.qpll0Full && qpllRefclkValid) {
      for (const n of specs.qpll0Full.nVals) {
        for (const m of specs.qpll0Full.mVals) {
          const vco = refclkGHz * n / m;
          if (vco < specs.qpll0Full.vcoMin || vco > specs.qpll0Full.vcoMax) continue;

          for (const outDiv of specs.outDivs) {
            const lineRate = vco * 2 / outDiv;  // FULL rate: VCO * 2 (DDR, no internal /2)
            if (lineRate < specs.lineRateMin || lineRate > specs.lineRateMax) continue;

            const errorPpm = Math.abs((lineRate - targetGbps) / targetGbps) * 1e6;
            configs.push({
              pll: 'QPLL0 (FULL)',
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

    // Try QPLL1 FULL rate mode (GTY only) - AMD/Xilinx only
    if (!isIntel && specs.qpll1Full && qpllRefclkValid) {
      for (const n of specs.qpll1Full.nVals) {
        for (const m of specs.qpll1Full.mVals) {
          const vco = refclkGHz * n / m;
          if (vco < specs.qpll1Full.vcoMin || vco > specs.qpll1Full.vcoMax) continue;

          for (const outDiv of specs.outDivs) {
            const lineRate = vco * 2 / outDiv;  // FULL rate: VCO * 2
            if (lineRate < specs.lineRateMin || lineRate > specs.lineRateMax) continue;

            const errorPpm = Math.abs((lineRate - targetGbps) / targetGbps) * 1e6;
            configs.push({
              pll: 'QPLL1 (FULL)',
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

    // GTM (Versal Premium) PLL calculations - AMD/Xilinx only
    // LCPLL: LC-tank PLL, lowest jitter, for high-speed links
    // RPLL: Ring PLL, alternative with different VCO range
    if (!isIntel && specs.lcpll && qpllRefclkValid) {
      // Try LCPLL in NRZ mode: Line_Rate = VCO * 2 / outDiv
      for (const n of specs.lcpll.nVals) {
        for (const m of specs.lcpll.mVals) {
          const vco = refclkGHz * n / m;
          if (vco < specs.lcpll.vcoMin || vco > specs.lcpll.vcoMax) continue;

          for (const outDiv of specs.outDivs) {
            // NRZ mode: VCO * 2 / outDiv (DDR)
            const lineRateNRZ = vco * 2 / outDiv;
            if (lineRateNRZ >= specs.lineRateMin && lineRateNRZ <= 58) {  // NRZ max ~58 Gbps
              const errorPpm = Math.abs((lineRateNRZ - targetGbps) / targetGbps) * 1e6;
              configs.push({
                pll: 'LCPLL (NRZ)',
                n, m, outDiv,
                vco,
                vcoDisplay: vco.toFixed(4),
                lineRate: lineRateNRZ,
                lineRateDisplay: lineRateNRZ.toFixed(6),
                errorPpm
              });
            }

            // PAM4 mode: VCO * 4 / outDiv (2 bits per symbol)
            if (specs.supportsPAM4) {
              const lineRatePAM4 = vco * 4 / outDiv;
              if (lineRatePAM4 >= 19.6 && lineRatePAM4 <= specs.lineRateMax) {  // PAM4 min ~19.6 Gbps
                const errorPpm = Math.abs((lineRatePAM4 - targetGbps) / targetGbps) * 1e6;
                configs.push({
                  pll: 'LCPLL (PAM4)',
                  n, m, outDiv,
                  vco,
                  vcoDisplay: vco.toFixed(4),
                  lineRate: lineRatePAM4,
                  lineRateDisplay: lineRatePAM4.toFixed(6),
                  errorPpm
                });
              }
            }
          }
        }
      }
    }

    // Try RPLL (GTM Ring PLL) - AMD/Xilinx only
    if (!isIntel && specs.rpll && qpllRefclkValid) {
      for (const n of specs.rpll.nVals) {
        for (const m of specs.rpll.mVals) {
          const vco = refclkGHz * n / m;
          if (vco < specs.rpll.vcoMin || vco > specs.rpll.vcoMax) continue;

          for (const outDiv of specs.outDivs) {
            const lineRate = vco * 2 / outDiv;  // DDR clocking
            if (lineRate < specs.lineRateMin || lineRate > specs.lineRateMax) continue;

            const errorPpm = Math.abs((lineRate - targetGbps) / targetGbps) * 1e6;
            configs.push({
              pll: 'RPLL',
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
              // NRZ mode: VCO * 2 / L (DDR)
              const lineRateNRZ = vco * 2 / l;
              if (lineRateNRZ >= specs.lineRateMin && lineRateNRZ <= 58) {  // NRZ max ~58 Gbps
                const errorPpm = Math.abs((lineRateNRZ - targetGbps) / targetGbps) * 1e6;
                configs.push({
                  pll: specs.supportsPAM4 ? 'ATX PLL (NRZ)' : 'ATX PLL',
                  n, m, outDiv: l,
                  vco,
                  vcoDisplay: vco.toFixed(4),
                  lineRate: lineRateNRZ,
                  lineRateDisplay: lineRateNRZ.toFixed(6),
                  errorPpm
                });
              }

              // PAM4 mode: VCO * 4 / L (2 bits per symbol)
              if (specs.supportsPAM4) {
                const lineRatePAM4 = vco * 4 / l;
                if (lineRatePAM4 >= 20 && lineRatePAM4 <= specs.lineRateMax) {  // PAM4 min ~20 Gbps
                  const errorPpm = Math.abs((lineRatePAM4 - targetGbps) / targetGbps) * 1e6;
                  configs.push({
                    pll: 'ATX PLL (PAM4)',
                    n, m, outDiv: l,
                    vco,
                    vcoDisplay: vco.toFixed(4),
                    lineRate: lineRatePAM4,
                    lineRateDisplay: lineRatePAM4.toFixed(6),
                    errorPpm
                  });
                }
              }
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
              // NRZ mode: VCO * 2 / L (DDR)
              const lineRateNRZ = vco * 2 / l;
              if (lineRateNRZ >= specs.lineRateMin && lineRateNRZ <= 58) {  // NRZ max ~58 Gbps
                const errorPpm = Math.abs((lineRateNRZ - targetGbps) / targetGbps) * 1e6;
                configs.push({
                  pll: specs.supportsPAM4 ? 'fPLL (NRZ)' : 'fPLL',
                  n, m, outDiv: l,
                  vco,
                  vcoDisplay: vco.toFixed(4),
                  lineRate: lineRateNRZ,
                  lineRateDisplay: lineRateNRZ.toFixed(6),
                  errorPpm
                });
              }

              // PAM4 mode: VCO * 4 / L (2 bits per symbol)
              if (specs.supportsPAM4) {
                const lineRatePAM4 = vco * 4 / l;
                if (lineRatePAM4 >= 20 && lineRatePAM4 <= specs.lineRateMax) {  // PAM4 min ~20 Gbps
                  const errorPpm = Math.abs((lineRatePAM4 - targetGbps) / targetGbps) * 1e6;
                  configs.push({
                    pll: 'fPLL (PAM4)',
                    n, m, outDiv: l,
                    vco,
                    vcoDisplay: vco.toFixed(4),
                    lineRate: lineRatePAM4,
                    lineRateDisplay: lineRatePAM4.toFixed(6),
                    errorPpm
                  });
                }
              }
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

    // Track recommendations - first good match for each category
    // AMD: CPLL (per-channel) vs QPLL (shared across quad)
    // Intel: ATX PLL (low jitter) vs fPLL (wider VCO range)
    let recommendedPrimary = false;   // CPLL (AMD) or ATX PLL (Intel)
    let recommendedSecondary = false; // QPLL (AMD) or fPLL (Intel)
    const ERROR_THRESHOLD = 100;      // ppm - recommend if under this

    topConfigs.forEach((cfg, index) => {
      const isExact = cfg.errorPpm < 0.1;
      const isGoodMatch = cfg.errorPpm < ERROR_THRESHOLD;
      const errorText = isExact ? 'exact' : cfg.errorPpm.toFixed(1) + ' ppm';
      const ariaLabel = `Configuration ${index + 1}: ${cfg.pll}, ${errorText}`;

      // For Intel: col1=M (multiply), col2=N (divide)
      // For AMD: col1=N (multiply), col2=M (divide)
      const col1Val = isIntel ? cfg.m : cfg.n;
      const col2Val = isIntel ? cfg.n : cfg.m;

      // Determine if this should get a recommendation badge
      let badge = '';
      const pllUpper = cfg.pll.toUpperCase();
      // Primary PLLs: CPLL/LCPLL (AMD per-channel), ATX PLL (Intel low-jitter)
      const isPrimaryPLL = pllUpper.includes('CPLL') || pllUpper.includes('LCPLL') || pllUpper.includes('ATX');
      // Secondary PLLs: QPLL/RPLL (AMD shared/alt), fPLL (Intel wider range)
      const isSecondaryPLL = pllUpper.includes('QPLL') || pllUpper.includes('RPLL') || pllUpper.includes('FPLL');

      if (isGoodMatch && isPrimaryPLL && !recommendedPrimary) {
        if (isIntel) {
          badge = '<span class="rec-badge single" title="Recommended - lowest jitter">★ Rec</span>';
        } else {
          badge = '<span class="rec-badge single" title="Best for single-lane designs (per-channel PLL)">★ Single</span>';
        }
        recommendedPrimary = true;
      } else if (isGoodMatch && isSecondaryPLL && !recommendedSecondary) {
        if (isIntel) {
          badge = '<span class="rec-badge multi" title="Alternative PLL - wider VCO range">★ Alt</span>';
        } else {
          badge = '<span class="rec-badge multi" title="Best for multi-lane designs (shared PLL across quad)">★ Multi</span>';
        }
        recommendedSecondary = true;
      }

      const rowClass = isExact ? ' class="exact"' : '';
      html += `
        <tr${rowClass} aria-label="${ariaLabel}">
          <td>${cfg.pll}${badge}</td>
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

    // Add recommendation legend if badges were shown
    if (recommendedPrimary || recommendedSecondary) {
      html += '<p class="rec-legend">';
      if (isIntel) {
        if (recommendedPrimary) {
          html += '<span class="rec-badge single">★ Rec</span> Lowest jitter ';
        }
        if (recommendedSecondary) {
          html += '<span class="rec-badge multi">★ Alt</span> Wider VCO range';
        }
      } else {
        if (recommendedPrimary) {
          html += '<span class="rec-badge single">★ Single</span> Per-channel PLL ';
        }
        if (recommendedSecondary) {
          html += '<span class="rec-badge multi">★ Multi</span> Shared PLL (quad)';
        }
      }
      html += '</p>';
    }

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
      gttype: this.elements.gttype.value,
      protocol: this.elements.protocol.value,
      refclkpreset: this.elements.refclkPreset.value
    };
  },

  setState(state) {
    if (state.gttype !== undefined) this.elements.gttype.value = state.gttype;
    if (state.protocol !== undefined) this.elements.protocol.value = state.protocol;
    if (state.linerate !== undefined) this.elements.linerate.value = state.linerate;
    if (state.refclk !== undefined) this.elements.refclk.value = state.refclk;
    if (state.refclkpreset !== undefined) this.elements.refclkPreset.value = state.refclkpreset;
    // Update filters after restoring state
    this.updateProtocolOptions();
    this.updateRefclkOptions();
    this.calculate();
  }
};
