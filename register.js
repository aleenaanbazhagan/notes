// Register page functionality
document.addEventListener('DOMContentLoaded', function() {
  const registerForm = document.getElementById("registerForm");
  const togglePassword = document.getElementById("togglePassword");
  const toggleConfirmPassword = document.getElementById("toggleConfirmPassword");
  const passwordInput = document.getElementById("password");
  const confirmPasswordInput = document.getElementById("confirmPassword");

  // Password toggle functionality
  if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", () => {
      const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
      passwordInput.setAttribute("type", type);
      togglePassword.textContent = type === "password" ? "👁️" : "🙈";
    });
  }

  if (toggleConfirmPassword && confirmPasswordInput) {
    toggleConfirmPassword.addEventListener("click", () => {
      const type = confirmPasswordInput.getAttribute("type") === "password" ? "text" : "password";
      confirmPasswordInput.setAttribute("type", type);
      toggleConfirmPassword.textContent = type === "password" ? "👁️" : "🙈";
    });
  }

  // Password strength checker
  if (passwordInput) {
    passwordInput.addEventListener('input', checkPasswordStrength);
  }

  // Real-time password confirmation check
  if (confirmPasswordInput) {
    confirmPasswordInput.addEventListener('input', checkPasswordMatch);
  }

  // Phone number formatting
  const phoneInput = document.getElementById('phone');
  if (phoneInput) {
    phoneInput.addEventListener('input', formatPhoneNumber);
  }

  // Register form submission
  if (registerForm) {
    registerForm.addEventListener("submit", handleRegistration);
  }

  // Update cart count
  updateCartCount();
});

// Handle registration
function handleRegistration(e) {
  e.preventDefault();

  const fullName = document.getElementById("fullName").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const termsAccepted = document.getElementById("terms").checked;

  // Validation
  if (!fullName || !email || !phone || !password || !confirmPassword) {
    alert("Please fill in all fields!");
    return;
  }

  if (!termsAccepted) {
    alert("Please accept the Terms & Conditions!");
    return;
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alert("Please enter a valid email address!");
    return;
  }

  // Phone validation
  const phoneRegex = /^[+]?[\d\s\-\(\)]{10,}$/;
  if (!phoneRegex.test(phone)) {
    alert("Please enter a valid phone number!");
    return;
  }

  // Password validation
  if (password.length < 6) {
    alert("Password must be at least 6 characters long!");
    return;
  }

  if (password !== confirmPassword) {
    alert("Passwords do not match!");
    return;
  }

  // Check if email already exists (simulate)
  const existingUsers = JSON.parse(localStorage.getItem('registeredUsers')) || [];
  if (existingUsers.some(user => user.email === email)) {
    alert("An account with this email already exists!");
    return;
  }

  // Register user
  const newUser = {
    id: Date.now(),
    fullName,
    email,
    phone,
    password, // In real app, this should be hashed
    registeredAt: new Date().toISOString()
  };

  existingUsers.push(newUser);
  localStorage.setItem('registeredUsers', JSON.stringify(existingUsers));

  // Auto-login after registration
  localStorage.setItem('userEmail', email);
  localStorage.setItem('isLoggedIn', 'true');

  alert(`Welcome to Global Vastra, ${fullName}!\nYour account has been created successfully.`);
  
  // Redirect to home page
  window.location.href = 'index.html';
}

// Check password strength
function checkPasswordStrength() {
  const password = document.getElementById("password").value;
  const strengthIndicator = document.getElementById("passwordStrength") || createPasswordStrengthIndicator();
  
  let strength = 0;
  let message = "";
  
  if (password.length >= 6) strength++;
  if (password.match(/[a-z]/)) strength++;
  if (password.match(/[A-Z]/)) strength++;
  if (password.match(/[0-9]/)) strength++;
  if (password.match(/[^a-zA-Z0-9]/)) strength++;
  
  switch (strength) {
    case 0:
    case 1:
      message = "Weak password";
      strengthIndicator.className = "password-strength strength-weak";
      break;
    case 2:
    case 3:
      message = "Medium password";
      strengthIndicator.className = "password-strength strength-medium";
      break;
    case 4:
    case 5:
      message = "Strong password";
      strengthIndicator.className = "password-strength strength-strong";
      break;
  }
  
  strengthIndicator.textContent = password ? message : "";
}

// Create password strength indicator
function createPasswordStrengthIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'passwordStrength';
  indicator.className = 'password-strength';
  
  const passwordGroup = document.getElementById('password').parentElement.parentElement;
  passwordGroup.appendChild(indicator);
  
  return indicator;
}

// Check password match
function checkPasswordMatch() {
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const matchIndicator = document.getElementById("passwordMatch") || createPasswordMatchIndicator();
  
  if (confirmPassword) {
    if (password === confirmPassword) {
      matchIndicator.textContent = "Passwords match ✓";
      matchIndicator.className = "password-strength strength-strong";
    } else {
      matchIndicator.textContent = "Passwords do not match ✗";
      matchIndicator.className = "password-strength strength-weak";
    }
  } else {
    matchIndicator.textContent = "";
  }
}

// Create password match indicator
function createPasswordMatchIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'passwordMatch';
  indicator.className = 'password-strength';
  
  const confirmPasswordGroup = document.getElementById('confirmPassword').parentElement.parentElement;
  confirmPasswordGroup.appendChild(indicator);
  
  return indicator;
}

// Format phone number
function formatPhoneNumber(e) {
  let value = e.target.value.replace(/\D/g, '');
  
  if (value.length > 10) {
    value = value.substring(0, 10);
  }
  
  if (value.length >= 6) {
    value = value.replace(/(\d{5})(\d{5})/, '$1-$2');
  }
  
  e.target.value = value;
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