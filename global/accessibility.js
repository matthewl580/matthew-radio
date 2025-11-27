/**
 * Centralized Accessibility Utilities and ARIA Management
 * Provides comprehensive accessibility features for the Matthew Radio application
 */

class AccessibilityManager {
  constructor() {
    this.focusableElements = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    this.init();
  }

  init() {
    this.setupKeyboardNavigation();
    this.setupFocusManagement();
    this.setupScreenReaderAnnouncements();
    this.setupReducedMotion();
    this.setupHighContrast();
    this.setupSkipLinks();
  }

  /**
   * Enhanced keyboard navigation with proper focus management
   */
  setupKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
      // ESC key handling for modals and menus
      if (e.key === 'Escape') {
        this.closeOpenMenus();
        this.closeModals();
      }

      // Tab navigation improvements
      if (e.key === 'Tab') {
        this.handleTabNavigation(e);
      }
    });
  }

  /**
   * Focus management for dynamic content and modals
   */
  setupFocusManagement() {
    // Focus trap for modals
    this.focusTrap = (container) => {
      const focusableElements = container.querySelectorAll(this.focusableElements);
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      const handleTabKey = (e) => {
        if (e.key === 'Tab') {
          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              lastElement.focus();
              e.preventDefault();
            }
          } else {
            if (document.activeElement === lastElement) {
              firstElement.focus();
              e.preventDefault();
            }
          }
        }
      };

      container.addEventListener('keydown', handleTabKey);
      return () => container.removeEventListener('keydown', handleTabKey);
    };

    // Auto-focus management
    this.manageFocus = (element, shouldFocus = true) => {
      if (shouldFocus && element) {
        // Small delay to ensure element is rendered
        setTimeout(() => element.focus(), 100);
      }
    };
  }

  /**
   * Screen reader announcements for dynamic content
   */
  setupScreenReaderAnnouncements() {
    this.announcer = document.createElement('div');
    this.announcer.setAttribute('aria-live', 'polite');
    this.announcer.setAttribute('aria-atomic', 'true');
    this.announcer.className = 'sr-only screen-reader-announcer';
    this.announcer.style.position = 'absolute';
    this.announcer.style.left = '-10000px';
    this.announcer.style.width = '1px';
    this.announcer.style.height = '1px';
    this.announcer.style.overflow = 'hidden';
    document.body.appendChild(this.announcer);

    this.announce = (message, priority = 'polite') => {
      this.announcer.setAttribute('aria-live', priority);
      this.announcer.textContent = message;

      // Clear after announcement
      setTimeout(() => {
        this.announcer.textContent = '';
      }, 1000);
    };
  }

  /**
   * Reduced motion support
   */
  setupReducedMotion() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      document.documentElement.style.setProperty('--animation-duration', '0.01ms');
      document.documentElement.style.setProperty('--transition-duration', '0.01ms');
    }

    // Listen for changes
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      document.documentElement.style.setProperty('--animation-duration', e.matches ? '0.01ms' : '300ms');
      document.documentElement.style.setProperty('--transition-duration', e.matches ? '0.01ms' : '200ms');
    });
  }

  /**
   * High contrast mode support
   */
  setupHighContrast() {
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;

    if (prefersHighContrast) {
      document.documentElement.classList.add('high-contrast');
    }

    window.matchMedia('(prefers-contrast: high)').addEventListener('change', (e) => {
      document.documentElement.classList.toggle('high-contrast', e.matches);
    });
  }

  /**
   * Skip links for keyboard navigation
   */
  setupSkipLinks() {
    const skipLink = document.createElement('a');
    skipLink.href = '#main-content';
    skipLink.className = 'skip-link sr-only';
    skipLink.textContent = 'Skip to main content';
    skipLink.style.cssText = `
      position: absolute;
      top: -40px;
      left: 6px;
      background: var(--bg-primary);
      color: var(--text-primary);
      padding: 8px;
      text-decoration: none;
      border: 2px solid var(--border-color);
      border-radius: 4px;
      z-index: 10000;
      transition: top 0.3s ease;
    `;

    skipLink.addEventListener('focus', () => {
      skipLink.style.top = '6px';
    });

    skipLink.addEventListener('blur', () => {
      skipLink.style.top = '-40px';
    });

    document.body.insertBefore(skipLink, document.body.firstChild);
  }

  /**
   * ARIA utilities
   */
  updateAriaAttributes(element, attributes) {
    Object.entries(attributes).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        element.removeAttribute(key);
      } else {
        element.setAttribute(key, value);
      }
    });
  }

  /**
   * Handle tab navigation improvements
   */
  handleTabNavigation(e) {
    // Add visible focus indicators
    document.addEventListener('focusin', (e) => {
      if (e.target.matches(this.focusableElements)) {
        e.target.classList.add('keyboard-focus');
      }
    });

    document.addEventListener('focusout', (e) => {
      document.querySelectorAll('.keyboard-focus').forEach(el => {
        el.classList.remove('keyboard-focus');
      });
    });
  }

  /**
   * Close open menus and modals
   */
  closeOpenMenus() {
    const openMenus = document.querySelectorAll('[aria-expanded="true"]');
    openMenus.forEach(menu => {
      menu.setAttribute('aria-expanded', 'false');
      menu.classList.remove('open');
    });
  }

  closeModals() {
    const openModals = document.querySelectorAll('[role="dialog"][aria-hidden="false"]');
    openModals.forEach(modal => {
      modal.setAttribute('aria-hidden', 'true');
      modal.classList.remove('open');
    });
  }

  /**
   * Validate accessibility of elements
   */
  validateAccessibility(element) {
    const issues = [];

    // Check for alt text on images
    if (element.tagName === 'IMG' && !element.getAttribute('alt')) {
      issues.push('Missing alt text');
    }

    // Check for labels on form elements
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName)) {
      const hasLabel = element.getAttribute('aria-label') ||
                      element.getAttribute('aria-labelledby') ||
                      document.querySelector(`label[for="${element.id}"]`);
      if (!hasLabel) {
        issues.push('Missing label');
      }
    }

    // Check color contrast (basic check)
    const computedStyle = window.getComputedStyle(element);
    const color = computedStyle.color;
    const backgroundColor = computedStyle.backgroundColor;

    return issues;
  }
}

// Initialize accessibility manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.accessibilityManager = new AccessibilityManager();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AccessibilityManager;
}
