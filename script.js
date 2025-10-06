// Main script for Global Vastra website
document.addEventListener('DOMContentLoaded', function() {
  // Mobile menu toggle
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-menu');

  if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      navMenu.classList.toggle('active');
    });

    // Close menu when clicking on a link
    document.querySelectorAll('.nav-link').forEach(n => n.addEventListener('click', () => {
      hamburger.classList.remove('active');
      navMenu.classList.remove('active');
    }));

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!hamburger.contains(e.target) && !navMenu.contains(e.target)) {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
      }
    });
  }

  // Smooth scrolling for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // Update cart count on page load
  updateCartCount();

  // Check if user is logged in and update UI
  checkLoginStatus();

  // Add scroll effect to navbar
  window.addEventListener('scroll', handleNavbarScroll);
});

// Update cart count in navigation
function updateCartCount() {
  const cartCount = document.getElementById('cartCount');
  if (cartCount) {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
    cartCount.textContent = totalItems;
  }
}

// Check login status and update navigation
function checkLoginStatus() {
  const isLoggedIn = localStorage.getItem('isLoggedIn');
  const userEmail = localStorage.getItem('userEmail');
  const loginLink = document.querySelector('a[href="login.html"]');
  
  if (isLoggedIn === 'true' && userEmail && loginLink) {
    // Update login link to show user email or logout option
    loginLink.textContent = 'Account';
    loginLink.addEventListener('click', function(e) {
      e.preventDefault();
      const action = confirm(`Logged in as: ${userEmail}\n\nClick OK to logout, Cancel to stay logged in.`);
      if (action) {
        logout();
      }
    });
  }
}

// Logout function
function logout() {
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('userEmail');
  alert('You have been logged out successfully!');
  location.reload();
}

// Handle navbar scroll effect
function handleNavbarScroll() {
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    if (window.scrollY > 100) {
      navbar.style.background = 'rgba(255, 255, 255, 0.95)';
      navbar.style.backdropFilter = 'blur(10px)';
    } else {
      navbar.style.background = '#fff';
      navbar.style.backdropFilter = 'none';
    }
  }
}

// Add animation on scroll for featured cards
function animateOnScroll() {
  const cards = document.querySelectorAll('.featured-card');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.1 });

  cards.forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(card);
  });
}

// Initialize animations when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', animateOnScroll);
} else {
  animateOnScroll();
}