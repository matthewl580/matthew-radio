/**
 * Animated Statistics Counter Component
 * Provides animated counters with screen reader announcements
 */

class StatsCounter {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      duration: 2000,
      easing: 'easeOutCubic',
      separator: ',',
      prefix: '',
      suffix: '',
      ...options
    };

    this.counters = [];
    this.observer = null;
    this.hasAnimated = false;
    this.init();
  }

  init() {
    this.setupCounters();
    this.setupIntersectionObserver();
  }

  /**
   * Set up counter elements
   */
  setupCounters() {
    const statItems = this.container.querySelectorAll('.stat-item');

    statItems.forEach(item => {
      const numberElement = item.querySelector('.stat-number');
      if (numberElement) {
        const targetValue = this.parseTargetValue(numberElement.textContent);
        const counter = {
          element: numberElement,
          targetValue: targetValue,
          currentValue: 0,
          originalText: numberElement.textContent
        };

        this.counters.push(counter);
      }
    });
  }

  /**
   * Parse target value from text content
   */
  parseTargetValue(text) {
    // Remove any non-numeric characters except decimal points
    const numericText = text.replace(/[^\d.]/g, '');
    return parseFloat(numericText) || 0;
  }

  /**
   * Set up intersection observer for animation trigger
   */
  setupIntersectionObserver() {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.hasAnimated) {
          this.startAnimation();
          this.hasAnimated = true;
        }
      });
    }, {
      threshold: 0.3, // Trigger when 30% of the container is visible
      rootMargin: '0px 0px -50px 0px'
    });

    this.observer.observe(this.container);
  }

  /**
   * Start the counter animation
   */
  startAnimation() {
    this.counters.forEach(counter => {
      this.animateCounter(counter);
    });

    // Announce animation start to screen readers
    if (window.accessibilityManager) {
      window.accessibilityManager.announce('Statistics animation starting');
    }
  }

  /**
   * Animate individual counter
   */
  animateCounter(counter) {
    const { element, targetValue } = counter;
    const startTime = performance.now();
    const startValue = 0;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / this.options.duration, 1);

      // Apply easing function
      const easedProgress = this.applyEasing(progress);

      // Calculate current value
      const currentValue = Math.floor(startValue + (targetValue - startValue) * easedProgress);

      // Format and display value
      const formattedValue = this.formatValue(currentValue);
      element.textContent = formattedValue;

      // Continue animation or finish
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Ensure final value is exact
        element.textContent = this.formatValue(targetValue);

        // Announce completion to screen readers
        if (window.accessibilityManager) {
          const statLabel = element.closest('.stat-item').querySelector('.stat-label');
          const labelText = statLabel ? statLabel.textContent : 'statistic';
          window.accessibilityManager.announce(`${formattedValue} ${labelText}`, 'assertive');
        }
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Apply easing function
   */
  applyEasing(progress) {
    // Cubic ease out
    return 1 - Math.pow(1 - progress, 3);
  }

  /**
   * Format value with separators and prefixes/suffixes
   */
  formatValue(value) {
    let formatted = value.toString();

    // Add thousand separators
    if (this.options.separator) {
      formatted = formatted.replace(/\B(?=(\d{3})+(?!\d))/g, this.options.separator);
    }

    // Add prefix and suffix
    return `${this.options.prefix}${formatted}${this.options.suffix}`;
  }

  /**
   * Update counter values dynamically
   */
  updateValues(newValues) {
    if (!Array.isArray(newValues)) return;

    this.counters.forEach((counter, index) => {
      if (newValues[index] !== undefined) {
        counter.targetValue = this.parseTargetValue(newValues[index].toString());
        counter.currentValue = 0;
      }
    });

    // Reset animation state
    this.hasAnimated = false;

    // Re-trigger animation if element is visible
    if (this.isElementInViewport(this.container)) {
      this.startAnimation();
    }
  }

  /**
   * Check if element is in viewport
   */
  isElementInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  /**
   * Reset animation state
   */
  reset() {
    this.hasAnimated = false;
    this.counters.forEach(counter => {
      counter.currentValue = 0;
      counter.element.textContent = counter.originalText;
    });
  }

  /**
   * Destroy counter and clean up
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }

    this.counters = [];
  }

  /**
   * Get current values
   */
  getCurrentValues() {
    return this.counters.map(counter => ({
      current: counter.currentValue,
      target: counter.targetValue,
      formatted: this.formatValue(counter.currentValue)
    }));
  }
}

/**
 * Real-time statistics updater
 */
class LiveStatsUpdater {
  constructor(statsContainer, updateInterval = 30000) { // 30 seconds default
    this.statsContainer = statsContainer;
    this.updateInterval = updateInterval;
    this.intervalId = null;
    this.lastUpdate = null;
    this.init();
  }

  init() {
    this.startUpdates();
  }

  /**
   * Start periodic updates
   */
  startUpdates() {
    // Initial update
    this.updateStats();

    // Set up interval
    this.intervalId = setInterval(() => {
      this.updateStats();
    }, this.updateInterval);
  }

  /**
   * Fetch and update statistics
   */
  async updateStats() {
    try {
      // Fetch current statistics from server
      const response = await fetch('/api/stats'); // Adjust endpoint as needed
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const stats = await response.json();

      // Update the stats counter with new values
      if (this.statsContainer && this.statsContainer.statsCounter) {
        const values = [
          stats.dailyListeners || 100,
          stats.stations || 30,
          stats.uptime || 24,
          stats.adFree || 100
        ];

        this.statsContainer.statsCounter.updateValues(values);
      }

      this.lastUpdate = new Date();

      // Announce update to screen readers
      if (window.accessibilityManager) {
        window.accessibilityManager.announce('Statistics updated with latest data');
      }

    } catch (error) {
      console.warn('Failed to update live stats:', error);

      // Fallback to cached/default values
      this.handleUpdateError();
    }
  }

  /**
   * Handle update errors
   */
  handleUpdateError() {
    // Could implement fallback logic here
    // For now, just log the error
  }

  /**
   * Stop updates
   */
  stopUpdates() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Manually trigger update
   */
  refresh() {
    this.updateStats();
  }

  /**
   * Get last update time
   */
  getLastUpdate() {
    return this.lastUpdate;
  }
}

// Auto-initialize stats counters
document.addEventListener('DOMContentLoaded', () => {
  const statsSections = document.querySelectorAll('.stats-section');

  statsSections.forEach(section => {
    if (!section.classList.contains('stats-initialized')) {
      section.classList.add('stats-initialized');

      // Initialize counter
      const counter = new StatsCounter(section);

      // Store reference for live updates
      section.statsCounter = counter;

      // Initialize live updates (commented out until API is ready)
      // const liveUpdater = new LiveStatsUpdater(section);
      // section.liveUpdater = liveUpdater;
    }
  });
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StatsCounter, LiveStatsUpdater };
}
