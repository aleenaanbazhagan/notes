// Login page functionality
document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById("loginForm");
  const togglePassword = document.getElementById("togglePassword");
  const passwordInput = document.getElementById("password");

  // Password toggle functionality
  if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", () => {
      const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
      passwordInput.setAttribute("type", type);
      togglePassword.textContent = type === "password" ? "👁️" : "🙈";
    });
  }

  // Login form submission
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const email = document.getElementById("email").value.trim();
      const password = passwordInput.value.trim();

      if (email === "" || password === "") {
        alert("Please fill in all fields!");
        return;
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        alert("Please enter a valid email address!");
        return;
      }

      // Simulate login success
      alert(`Welcome back to Global Vastra, ${email}!`);
      
      // Store user info in localStorage (for demo purposes)
      localStorage.setItem('userEmail', email);
      localStorage.setItem('isLoggedIn', 'true');
      
      // Redirect to home page
      window.location.href = 'index.html';
    });
  }

  // Social login buttons
  const socialButtons = document.querySelectorAll('.btn-social');
  socialButtons.forEach(button => {
    button.addEventListener('click', function() {
      const provider = this.classList.contains('google') ? 'Google' : 'Microsoft';
      alert(`${provider} login functionality would be implemented here.`);
    });
  });

  // Update cart count from localStorage
  updateCartCount();
});

function updateCartCount() {
  const cartCount = document.getElementById('cartCount');
  if (cartCount) {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    cartCount.textContent = cart.length;
  }
}