/**
 * VoiceroAI Color Utilities
 * Shared color manipulation functions used across Voicero modules
 */

const VoiceroColor = {
  /**
   * Get color variants from a hex color
   * @param {string} color - Base color in hex format
   * @returns {Object} An object with color variants (main, light, dark, superlight, superdark)
   */
  getColorVariants: function (color) {
    if (!color) color = "#882be6";

    // Initialize with the main color
    const variants = {
      main: color,
      light: color,
      dark: color,
      superlight: color,
      superdark: color,
    };

    // If it's a hex color, we can calculate variants
    if (color.startsWith("#")) {
      try {
        // Convert hex to RGB for variants
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);

        // Create variants by adjusting brightness
        const lightR = Math.min(255, Math.floor(r * 1.2));
        const lightG = Math.min(255, Math.floor(g * 1.2));
        const lightB = Math.min(255, Math.floor(b * 1.2));

        const darkR = Math.floor(r * 0.8);
        const darkG = Math.floor(g * 0.8);
        const darkB = Math.floor(b * 0.8);

        const superlightR = Math.min(255, Math.floor(r * 1.5));
        const superlightG = Math.min(255, Math.floor(g * 1.5));
        const superlightB = Math.min(255, Math.floor(b * 1.5));

        const superdarkR = Math.floor(r * 0.6);
        const superdarkG = Math.floor(g * 0.6);
        const superdarkB = Math.floor(b * 0.6);

        // Convert back to hex
        variants.light = `#${lightR.toString(16).padStart(2, "0")}${lightG
          .toString(16)
          .padStart(2, "0")}${lightB.toString(16).padStart(2, "0")}`;
        variants.dark = `#${darkR.toString(16).padStart(2, "0")}${darkG
          .toString(16)
          .padStart(2, "0")}${darkB.toString(16).padStart(2, "0")}`;
        variants.superlight = `#${superlightR
          .toString(16)
          .padStart(2, "0")}${superlightG
          .toString(16)
          .padStart(2, "0")}${superlightB.toString(16).padStart(2, "0")}`;
        variants.superdark = `#${superdarkR
          .toString(16)
          .padStart(2, "0")}${superdarkG
          .toString(16)
          .padStart(2, "0")}${superdarkB.toString(16).padStart(2, "0")}`;
      } catch (e) {
        // Fallback to default variants
        variants.light = "#9370db";
        variants.dark = "#7a5abf";
        variants.superlight = "#d5c5f3";
        variants.superdark = "#5e3b96";
      }
    }

    return variants;
  },

  /**
   * Adjust a color's brightness
   * @param {string} color - Base color in hex format
   * @param {number} adjustment - Adjustment factor (negative darkens, positive lightens)
   * @returns {string} Adjusted color in hex format
   */
  adjustColor: function (color, adjustment) {
    if (!color) return "#ff4444";
    if (!color.startsWith("#")) return color;

    try {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      // Positive adjustment makes it lighter, negative makes it darker
      let factor = adjustment < 0 ? 1 + adjustment : 1 + adjustment;

      // Adjust RGB values
      let newR =
        adjustment < 0
          ? Math.floor(r * factor)
          : Math.min(255, Math.floor(r * factor));
      let newG =
        adjustment < 0
          ? Math.floor(g * factor)
          : Math.min(255, Math.floor(g * factor));
      let newB =
        adjustment < 0
          ? Math.floor(b * factor)
          : Math.min(255, Math.floor(b * factor));

      // Convert back to hex
      return `#${newR.toString(16).padStart(2, "0")}${newG
        .toString(16)
        .padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
    } catch (e) {
      return color;
    }
  },

  /**
   * Create a lighter version of a color
   * @param {string} color - Base color in hex format
   * @returns {string} Lighter color in hex format
   */
  colorLighter: function (color) {
    if (!color) return "#d5c5f3";
    if (!color.startsWith("#")) return color;

    try {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      const lightR = Math.min(255, Math.floor(r * 1.6));
      const lightG = Math.min(255, Math.floor(g * 1.6));
      const lightB = Math.min(255, Math.floor(b * 1.6));

      return `#${lightR.toString(16).padStart(2, "0")}${lightG
        .toString(16)
        .padStart(2, "0")}${lightB.toString(16).padStart(2, "0")}`;
    } catch (e) {
      return "#d5c5f3";
    }
  },

  /**
   * Create a slightly lighter version of a color
   * @param {string} color - Base color in hex format
   * @returns {string} Slightly lighter color in hex format
   */
  colorLight: function (color) {
    if (!color) return "#9370db";
    if (!color.startsWith("#")) return color;

    try {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      const lightR = Math.min(255, Math.floor(r * 1.3));
      const lightG = Math.min(255, Math.floor(g * 1.3));
      const lightB = Math.min(255, Math.floor(b * 1.3));

      return `#${lightR.toString(16).padStart(2, "0")}${lightG
        .toString(16)
        .padStart(2, "0")}${lightB.toString(16).padStart(2, "0")}`;
    } catch (e) {
      return "#9370db";
    }
  },

  /**
   * Create a slightly darker version of a color
   * @param {string} color - Base color in hex format
   * @returns {string} Slightly darker color in hex format
   */
  colorDark: function (color) {
    if (!color) return "#7a5abf";
    if (!color.startsWith("#")) return color;

    try {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      const darkR = Math.floor(r * 0.7);
      const darkG = Math.floor(g * 0.7);
      const darkB = Math.floor(b * 0.7);

      return `#${darkR.toString(16).padStart(2, "0")}${darkG
        .toString(16)
        .padStart(2, "0")}${darkB.toString(16).padStart(2, "0")}`;
    } catch (e) {
      return "#7a5abf";
    }
  },

  /**
   * Create a darker version of a color
   * @param {string} color - Base color in hex format
   * @returns {string} Darker color in hex format
   */
  colorDarker: function (color) {
    if (!color) return "#5e3b96";
    if (!color.startsWith("#")) return color;

    try {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      const darkR = Math.floor(r * 0.5);
      const darkG = Math.floor(g * 0.5);
      const darkB = Math.floor(b * 0.5);

      return `#${darkR.toString(16).padStart(2, "0")}${darkG
        .toString(16)
        .padStart(2, "0")}${darkB.toString(16).padStart(2, "0")}`;
    } catch (e) {
      return "#5e3b96";
    }
  },

  /**
   * Convert hex color to RGB object
   * @param {string} hex - Color in hex format
   * @returns {Object} RGB object with r, g, b properties
   */
  hexToRgb: function (hex) {
    if (!hex || typeof hex !== "string" || !hex.startsWith("#")) {
      // Return default if not a valid hex
      return { r: 136, g: 43, b: 230 };
    }

    // Remove # if present
    hex = hex.replace(/^#/, "");

    // Parse hex values
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;

    return { r, g, b };
  },
};

// Make color utilities available globally
window.VoiceroColor = VoiceroColor;
