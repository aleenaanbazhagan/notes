// Cart page functionality
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

  // Load and display cart items
  loadCartItems();
  updateCartCount();
});

// Load cart items from localStorage
function loadCartItems() {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  const emptyCart = document.getElementById('emptyCart');
  const cartItems = document.getElementById('cartItems');
  const cartSummary = document.getElementById('cartSummary');

  if (cart.length === 0) {
    emptyCart.classList.remove('hidden');
    cartItems.classList.add('hidden');
    cartSummary.classList.add('hidden');
  } else {
    emptyCart.classList.add('hidden');
    cartItems.classList.remove('hidden');
    cartSummary.classList.remove('hidden');
    displayCartItems(cart);
    updateCartSummary(cart);
  }
}

// Display cart items
function displayCartItems(cart) {
  const cartItemsContainer = document.getElementById('cartItems');
  cartItemsContainer.innerHTML = '';

  cart.forEach(item => {
    const cartItemHTML = `
      <div class="cart-item" data-id="${item.id}">
        <img src="${item.image}" alt="${item.name}" class="item-image">
        <div class="item-details">
          <div class="item-name">${item.name}</div>
          <div class="item-price">₹${item.price}</div>
        </div>
        <div class="item-controls">
          <div class="quantity-controls">
            <button class="quantity-btn" onclick="updateQuantity(${item.id}, -1)">-</button>
            <span class="quantity">${item.quantity}</span>
            <button class="quantity-btn" onclick="updateQuantity(${item.id}, 1)">+</button>
          </div>
          <button class="remove-btn" onclick="removeFromCart(${item.id})">Remove</button>
        </div>
      </div>
    `;
    cartItemsContainer.innerHTML += cartItemHTML;
  });
}

// Update quantity
function updateQuantity(productId, change) {
  let cart = JSON.parse(localStorage.getItem('cart')) || [];
  const itemIndex = cart.findIndex(item => item.id === productId);

  if (itemIndex > -1) {
    cart[itemIndex].quantity += change;
    
    // Remove item if quantity becomes 0
    if (cart[itemIndex].quantity <= 0) {
      cart.splice(itemIndex, 1);
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    loadCartItems();
    updateCartCount();
  }
}

// Remove item from cart
function removeFromCart(productId) {
  let cart = JSON.parse(localStorage.getItem('cart')) || [];
  cart = cart.filter(item => item.id !== productId);
  
  localStorage.setItem('cart', JSON.stringify(cart));
  loadCartItems();
  updateCartCount();
}

// Update cart summary
function updateCartSummary(cart) {
  const subtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  const shipping = subtotal > 0 ? 50 : 0;
  const tax = Math.round(subtotal * 0.18); // 18% GST
  const total = subtotal + shipping + tax;

  document.getElementById('subtotal').textContent = `₹${subtotal}`;
  document.getElementById('shipping').textContent = `₹${shipping}`;
  document.getElementById('tax').textContent = `₹${tax}`;
  document.getElementById('total').textContent = `₹${total}`;
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

// Proceed to checkout
function proceedToCheckout() {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  
  if (cart.length === 0) {
    alert('Your cart is empty!');
    return;
  }

  // Store cart for checkout
  localStorage.setItem('checkoutItems', JSON.stringify(cart));
  
  // Redirect to payment page
  window.location.href = 'payment.html';
}