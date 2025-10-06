// Products page functionality
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
  }

  // Update cart count on page load
  updateCartCount();
});

// Add to cart functionality
function addToCart(id, name, price, image) {
  const product = {
    id: id,
    name: name,
    price: price,
    image: image,
    quantity: 1
  };

  // Get existing cart from localStorage
  let cart = JSON.parse(localStorage.getItem('cart')) || [];
  
  // Check if product already exists in cart
  const existingProductIndex = cart.findIndex(item => item.id === id);
  
  if (existingProductIndex > -1) {
    // If product exists, increase quantity
    cart[existingProductIndex].quantity += 1;
  } else {
    // If product doesn't exist, add it to cart
    cart.push(product);
  }

  // Save updated cart to localStorage
  localStorage.setItem('cart', JSON.stringify(cart));

  // Update cart count
  updateCartCount();

  // Show notification
  showCartNotification();
}

// Buy now functionality
function buyNow(id, name, price) {
  // Add to cart first
  const product = {
    id: id,
    name: name,
    price: price,
    quantity: 1
  };

  // Store the single product for immediate purchase
  localStorage.setItem('buyNowProduct', JSON.stringify(product));
  
  // Redirect to payment page
  window.location.href = 'payment.html';
}

// Update cart count in navigation
function updateCartCount() {
  const cartCount = document.getElementById('cartCount');
  if (cartCount) {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
    cartCount.textContent = totalItems;
  }
}

// Show cart notification
function showCartNotification() {
  const notification = document.getElementById('cartNotification');
  if (notification) {
    notification.classList.add('show');
    
    // Hide notification after 3 seconds
    setTimeout(() => {
      notification.classList.remove('show');
    }, 3000);
  }
}