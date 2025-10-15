// Theme Management System
class ThemeManager {
  constructor() {
    this.currentTheme = localStorage.getItem('theme') || 'light';
    this.themeToggle = document.getElementById('themeToggle');
    this.init();
  }

  init() {
    this.applyTheme(this.currentTheme);
    this.setupEventListeners();
    this.updateToggleIcon();
  }

  setupEventListeners() {
    if (this.themeToggle) {
      this.themeToggle.addEventListener('click', () => {
        this.toggleTheme();
      });
    }
  }

  toggleTheme() {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.applyTheme(this.currentTheme);
    this.updateToggleIcon();
    localStorage.setItem('theme', this.currentTheme);
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    
    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.content = theme === 'dark' ? '#121212' : '#ffffff';
    }
  }

  updateToggleIcon() {
    if (this.themeToggle) {
      const icon = this.themeToggle.querySelector('.material-symbols-rounded');
      if (icon) {
        icon.textContent = this.currentTheme === 'light' ? 'dark_mode' : 'light_mode';
      }
    }
  }
}

// Initialize theme manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ThemeManager();
});

// Enhanced Material Icons with better styling
document.addEventListener('DOMContentLoaded', () => {
  // Add custom styling to material icons
  const style = document.createElement('style');
  style.textContent = `
    .material-symbols-rounded {
      font-variation-settings:
        'FILL' 1,
        'wght' 400,
        'GRAD' 0,
        'opsz' 24;
      transition: all 0.3s ease;
    }
    
    .navBarOption:hover .material-symbols-rounded {
      transform: scale(1.1);
    }
    
    .benefit-icon .material-symbols-rounded {
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
    }
    
    .theme-toggle .material-symbols-rounded {
      transition: transform 0.3s ease;
    }
    
    .theme-toggle:hover .material-symbols-rounded {
      transform: rotate(180deg);
    }
  `;
  document.head.appendChild(style);
});

// Smooth scrolling for anchor links
document.addEventListener('DOMContentLoaded', () => {
  const links = document.querySelectorAll('a[href^="#"]');
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href').substring(1);
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
});

// Enhanced animations and interactions
document.addEventListener('DOMContentLoaded', () => {
  // Add intersection observer for fade-in animations
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, observerOptions);

  // Observe benefit cards and other elements
  const animatedElements = document.querySelectorAll('.benefit-card, .stat-item, .form-container');
  animatedElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
  });
});