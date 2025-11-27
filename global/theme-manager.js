/**
 * Dynamic Theme Switching and Preference Management
 * Handles theme detection, switching, and persistence for Matthew Radio
 */

class ThemeManager {
  constructor() {
    this.themes = {
      dark: {
        name: 'dark',
        label: 'Dark Theme',
        icon: 'dark_mode'
      },
      light: {
        name: 'light',
        label: 'Light Theme',
        icon: 'light_mode'
      },
      auto: {
        name: 'auto',
        label: 'Auto (System)',
        icon: 'brightness_auto'
      }
    };

    this.currentTheme = 'auto';
    this.systemTheme = 'dark';
    this.init();
  }

  init() {
    this.detectSystemTheme();
    this.loadSavedTheme();
    this.applyTheme();
    this.setupThemeToggle();
    this.setupSystemThemeListener();
  }

  /**
   * Detect system color scheme preference
   */
  detectSystemTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.systemTheme = prefersDark ? 'dark' : 'light';
  }

  /**
   * Load saved theme preference from localStorage
   */
  loadSavedTheme() {
    const saved = localStorage.getItem('matthew-radio-theme');
    if (saved && this.themes[saved]) {
      this.currentTheme = saved;
    }
  }

  /**
   * Save theme preference to localStorage
   */
  saveTheme(theme) {
    localStorage.setItem('matthew-radio-theme', theme);
    this.currentTheme = theme;
  }

  /**
   * Get the effective theme (resolves 'auto' to actual theme)
   */
  getEffectiveTheme() {
    return this.currentTheme === 'auto' ? this.systemTheme : this.currentTheme;
  }

  /**
   * Apply the current theme to the document
   */
  applyTheme() {
    const effectiveTheme = this.getEffectiveTheme();
    document.documentElement.setAttribute('data-theme', effectiveTheme);

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      const colors = {
        dark: '#0a0a0a',
        light: '#ffffff'
      };
      metaThemeColor.setAttribute('content', colors[effectiveTheme] || colors.dark);
    }

    // Announce theme change to screen readers
    if (window.accessibilityManager) {
      window.accessibilityManager.announce(`Theme changed to ${this.themes[effectiveTheme].label}`);
    }

    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('themeChanged', {
      detail: { theme: effectiveTheme, source: this.currentTheme }
    }));
  }

  /**
   * Set up theme toggle button
   */
  setupThemeToggle() {
    // Create theme toggle button
    const toggleButton = document.createElement('button');
    toggleButton.id = 'theme-toggle';
    toggleButton.className = 'theme-toggle';
    toggleButton.setAttribute('aria-label', 'Toggle theme');
    toggleButton.innerHTML = `<span class="material-symbols-rounded">${this.themes[this.getEffectiveTheme()].icon}</span>`;

    // Add to navigation
    const navBar = document.getElementById('navBar');
    if (navBar) {
      const navBarOptions = navBar.querySelector('#navBarOptions');
      if (navBarOptions) {
        navBarOptions.appendChild(toggleButton);
      }
    }

    // Handle theme toggle
    toggleButton.addEventListener('click', () => {
      this.cycleTheme();
    });

    // Update button icon when theme changes
    window.addEventListener('themeChanged', (e) => {
      const icon = toggleButton.querySelector('.material-symbols-rounded');
      if (icon) {
        icon.textContent = this.themes[e.detail.theme].icon;
      }
      toggleButton.setAttribute('aria-label', `Current theme: ${this.themes[e.detail.theme].label}. Click to change theme.`);
    });
  }

  /**
   * Cycle through available themes
   */
  cycleTheme() {
    const themeOrder = ['dark', 'light', 'auto'];
    const currentIndex = themeOrder.indexOf(this.currentTheme);
    const nextIndex = (currentIndex + 1) % themeOrder.length;
    const nextTheme = themeOrder[nextIndex];

    this.saveTheme(nextTheme);
    this.applyTheme();
  }

  /**
   * Listen for system theme changes
   */
  setupSystemThemeListener() {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      this.systemTheme = e.matches ? 'dark' : 'light';

      // Only apply if current theme is 'auto'
      if (this.currentTheme === 'auto') {
        this.applyTheme();
      }
    });
  }

  /**
   * Set theme programmatically
   */
  setTheme(theme) {
    if (!this.themes[theme]) {
      console.warn(`Invalid theme: ${theme}`);
      return;
    }

    this.saveTheme(theme);
    this.applyTheme();
  }

  /**
   * Get current theme information
   */
  getCurrentThemeInfo() {
    const effective = this.getEffectiveTheme();
    return {
      current: this.currentTheme,
      effective: effective,
      info: this.themes[effective]
    };
  }

  /**
   * Check if dark theme is active
   */
  isDarkTheme() {
    return this.getEffectiveTheme() === 'dark';
  }

  /**
   * Check if light theme is active
   */
  isLightTheme() {
    return this.getEffectiveTheme() === 'light';
  }
}

// Initialize theme manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.themeManager = new ThemeManager();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThemeManager;
}
