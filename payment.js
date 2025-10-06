// Payment page functionality
document.addEventListener('DOMContentLoaded', function() {
  // Load order summary
  loadOrderSummary();
  updateCartCount();

  // Payment method selection
  const paymentOptions = document.querySelectorAll('input[name="payment"]');
  const forms = document.querySelectorAll('.payment-form');

  paymentOptions.forEach((option) => {
    option.addEventListener('change', () => {
      forms.forEach((form) => form.classList.add('hidden'));
      const selectedForm = document.getElementById(`${option.value}Form`);
      if (selectedForm) {
        selectedForm.classList.remove('hidden');
      }
    });
  });

  // Payment button handlers
  const payButtons = document.querySelectorAll('.pay-btn');
  payButtons.forEach((btn) => {
    btn.addEventListener('click', handlePayment);
  });

  // Format card number input
  const cardInputs = document.querySelectorAll('input[placeholder*="1234"]');
  cardInputs.forEach(input => {
    input.addEventListener('input', formatCardNumber);
  });

  // Format expiry date input
  const expiryInputs = document.querySelectorAll('input[placeholder="MM/YY"]');
  expiryInputs.forEach(input => {
    input.addEventListener('input', formatExpiryDate);
  });
});

// Load order summary from localStorage
function loadOrderSummary() {
  const checkoutItems = JSON.parse(localStorage.getItem('checkoutItems')) || [];
  const buyNowProduct = JSON.parse(localStorage.getItem('buyNowProduct'));
  
  let items = [];
  
  if (buyNowProduct) {
    // Single product purchase
    items = [buyNowProduct];
    localStorage.removeItem('buyNowProduct'); // Clean up
  } else if (checkoutItems.length > 0) {
    // Cart checkout
    items = checkoutItems;
  }

  if (items.length === 0) {
    // Redirect to cart if no items
    window.location.href = 'cart.html';
    return;
  }

  displayOrderItems(items);
  calculateOrderTotals(items);
}

// Display order items
function displayOrderItems(items) {
  const orderItemsContainer = document.getElementById('orderItems');
  orderItemsContainer.innerHTML = '';

  items.forEach(item => {
    const orderItemHTML = `
      <div class="order-item">
        <img src="${item.image || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80'}" alt="${item.name}" class="item-image">
        <div class="item-info">
          <div class="item-name">${item.name}</div>
          <div class="item-details">Qty: ${item.quantity} × ₹${item.price}</div>
        </div>
        <div class="item-total">₹${item.price * item.quantity}</div>
      </div>
    `;
    orderItemsContainer.innerHTML += orderItemHTML;
  });
}

// Calculate order totals
function calculateOrderTotals(items) {
  const subtotal = items.reduce((total, item) => total + (item.price * item.quantity), 0);
  const shipping = subtotal > 0 ? 50 : 0;
  const tax = Math.round(subtotal * 0.18); // 18% GST
  const total = subtotal + shipping + tax;

  document.getElementById('orderSubtotal').textContent = `₹${subtotal}`;
  document.getElementById('orderShipping').textContent = `₹${shipping}`;
  document.getElementById('orderTax').textContent = `₹${tax}`;
  document.getElementById('orderTotal').textContent = `₹${total}`;
}

// Handle payment
function handlePayment() {
  const selectedPayment = document.querySelector('input[name="payment"]:checked');
  
  if (!selectedPayment) {
    alert('Please select a payment method!');
    return;
  }

  const paymentMethod = selectedPayment.value;
  let isValid = true;

  // Validate form based on payment method
  if (paymentMethod === 'upi') {
    const upiId = document.querySelector('#upiForm input').value.trim();
    if (!upiId) {
      alert('Please enter your UPI ID!');
      return;
    }
    if (!isValidUPI(upiId)) {
      alert('Please enter a valid UPI ID!');
      return;
    }
  } else if (paymentMethod === 'credit' || paymentMethod === 'debit') {
    const form = document.getElementById(`${paymentMethod}Form`);
    const inputs = form.querySelectorAll('input[required]');
    
    for (let input of inputs) {
      if (!input.value.trim()) {
        alert('Please fill in all required fields!');
        return;
      }
    }

    // Additional validation for card details
    const cardNumber = form.querySelector('input[placeholder*="1234"]').value.replace(/\s/g, '');
    const expiryDate = form.querySelector('input[placeholder="MM/YY"]').value;
    const cvv = form.querySelector('input[placeholder*="123"]').value;

    if (cardNumber.length !== 16) {
      alert('Please enter a valid 16-digit card number!');
      return;
    }

    if (!isValidExpiryDate(expiryDate)) {
      alert('Please enter a valid expiry date!');
      return;
    }

    if (cvv.length !== 3) {
      alert('Please enter a valid 3-digit CVV!');
      return;
    }
  }

  // Process payment
  processPayment(paymentMethod);
}

// Process payment
function processPayment(method) {
  // Show loading state
  const payBtn = document.querySelector('.payment-form:not(.hidden) .pay-btn');
  const originalText = payBtn.textContent;
  payBtn.textContent = 'Processing...';
  payBtn.disabled = true;

  // Simulate payment processing
  setTimeout(() => {
    // Clear cart after successful payment
    localStorage.removeItem('cart');
    localStorage.removeItem('checkoutItems');
    
    // Show success message
    const methodName = {
      'upi': 'UPI',
      'credit': 'Credit Card',
      'debit': 'Debit Card',
      'cod': 'Cash on Delivery'
    }[method];

    alert(`Payment Successful! ✅\n\nThank you for shopping with Global Vastra 💖\nPayment Method: ${methodName}\n\nYour order will be processed shortly.`);
    
    // Redirect to home page
    window.location.href = 'index.html';
  }, 2000);
}

// Update cart count
function updateCartCount() {
  const cartCount = document.getElementById('cartCount');
  if (cartCount) {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
    cartCount.textContent = totalItems;
  }
}

// Validation functions
function isValidUPI(upiId) {
  const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
  return upiRegex.test(upiId);
}

function isValidExpiryDate(expiryDate) {
  if (!/^\d{2}\/\d{2}$/.test(expiryDate)) return false;
  
  const [month, year] = expiryDate.split('/').map(num => parseInt(num));
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear() % 100;
  const currentMonth = currentDate.getMonth() + 1;
  
  if (month < 1 || month > 12) return false;
  if (year < currentYear || (year === currentYear && month < currentMonth)) return false;
  
  return true;
}

// Format card number
function formatCardNumber(e) {
  let value = e.target.value.replace(/\s/g, '').replace(/[^0-9]/gi, '');
  let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
  if (formattedValue.length > 19) formattedValue = formattedValue.substr(0, 19);
  e.target.value = formattedValue;
}

// Format expiry date
function formatExpiryDate(e) {
  let value = e.target.value.replace(/\D/g, '');
  if (value.length >= 2) {
    value = value.substring(0, 2) + '/' + value.substring(2, 4);
  }
  e.target.value = value;
}