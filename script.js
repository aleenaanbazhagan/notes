// E-commerce Website JavaScript
class ECommerceApp {
    constructor() {
        this.products = [];
        this.cart = JSON.parse(localStorage.getItem('cart')) || [];
        this.currentFilter = 'all';
        this.currentSort = 'default';
        this.productsPerPage = 8;
        this.currentPage = 1;
        this.filteredProducts = [];
        
        this.init();
    }

    init() {
        this.generateProducts();
        this.setupEventListeners();
        this.renderProducts();
        this.updateCartUI();
        this.setupSmoothScrolling();
    }

    // Generate sample products
    generateProducts() {
        const categories = ['electronics', 'clothing', 'home', 'sports'];
        const productNames = {
            electronics: [
                'Wireless Bluetooth Headphones', 'Smart Watch Pro', 'Laptop Stand Aluminum', 
                'USB-C Hub Multiport', 'Wireless Charging Pad', 'Bluetooth Speaker Portable',
                'Gaming Mechanical Keyboard', 'Wireless Mouse Ergonomic'
            ],
            clothing: [
                'Premium Cotton T-Shirt', 'Denim Jacket Classic', 'Running Shoes Athletic',
                'Wool Sweater Cozy', 'Leather Jacket Vintage', 'Casual Sneakers White',
                'Summer Dress Floral', 'Winter Coat Warm'
            ],
            home: [
                'Ceramic Coffee Mug Set', 'Bamboo Cutting Board', 'LED Desk Lamp Modern',
                'Throw Pillow Decorative', 'Wall Art Canvas Print', 'Plant Pot Ceramic',
                'Kitchen Knife Set', 'Bedding Set Cotton'
            ],
            sports: [
                'Yoga Mat Premium', 'Resistance Bands Set', 'Water Bottle Insulated',
                'Fitness Tracker Band', 'Dumbbells Adjustable', 'Exercise Ball Large',
                'Jump Rope Speed', 'Foam Roller Muscle'
            ]
        };

        let productId = 1;
        categories.forEach(category => {
            productNames[category].forEach(name => {
                this.products.push({
                    id: productId++,
                    name: name,
                    category: category,
                    price: Math.floor(Math.random() * 200) + 20,
                    rating: Math.floor(Math.random() * 5) + 1,
                    reviews: Math.floor(Math.random() * 500) + 10,
                    image: `https://picsum.photos/300/250?random=${productId}`,
                    description: `High-quality ${name.toLowerCase()} with excellent features and durability. Perfect for everyday use with modern design and premium materials.`
                });
            });
        });
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('menuToggle').addEventListener('click', this.toggleMobileMenu);
        
        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchProducts(e.target.value);
        });
        
        // Cart
        document.getElementById('cartBtn').addEventListener('click', () => {
            this.toggleCart();
        });
        document.getElementById('closeCart').addEventListener('click', () => {
            this.toggleCart();
        });
        
        // Filters and sorting
        document.getElementById('sortSelect').addEventListener('change', (e) => {
            this.currentSort = e.target.value;
            this.renderProducts();
        });
        
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.filter);
            });
        });
        
        document.querySelectorAll('.category-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const category = e.currentTarget.dataset.category;
                this.setFilter(category);
                document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
            });
        });
        
        // Load more
        document.getElementById('loadMoreBtn').addEventListener('click', () => {
            this.loadMoreProducts();
        });
        
        // Modals
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeProductModal();
        });
        document.getElementById('productModal').addEventListener('click', (e) => {
            if (e.target.id === 'productModal') {
                this.closeProductModal();
            }
        });
        
        // Checkout
        document.getElementById('checkoutBtn').addEventListener('click', () => {
            this.openCheckoutModal();
        });
        document.getElementById('closeCheckoutModal').addEventListener('click', () => {
            this.closeCheckoutModal();
        });
        document.getElementById('checkoutModal').addEventListener('click', (e) => {
            if (e.target.id === 'checkoutModal') {
                this.closeCheckoutModal();
            }
        });
        
        document.getElementById('checkoutForm').addEventListener('submit', (e) => {
            this.processOrder(e);
        });
        
        // Hero CTA
        document.querySelector('.cta-btn').addEventListener('click', () => {
            document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
        });
        
        // Modal quantity controls
        document.getElementById('decreaseQty').addEventListener('click', () => {
            this.updateModalQuantity(-1);
        });
        document.getElementById('increaseQty').addEventListener('click', () => {
            this.updateModalQuantity(1);
        });
        
        // Add to cart from modal
        document.getElementById('modalAddToCart').addEventListener('click', () => {
            this.addToCartFromModal();
        });
    }

    toggleMobileMenu() {
        const navMenu = document.querySelector('.nav-menu');
        navMenu.classList.toggle('active');
    }

    searchProducts(query) {
        if (!query.trim()) {
            this.renderProducts();
            return;
        }
        
        const filtered = this.products.filter(product =>
            product.name.toLowerCase().includes(query.toLowerCase()) ||
            product.category.toLowerCase().includes(query.toLowerCase())
        );
        
        this.displayProducts(filtered);
    }

    setFilter(filter) {
        this.currentFilter = filter;
        this.currentPage = 1;
        
        // Update active filter button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
        
        this.renderProducts();
    }

    renderProducts() {
        let filtered = this.currentFilter === 'all' 
            ? [...this.products] 
            : this.products.filter(p => p.category === this.currentFilter);
        
        // Apply sorting
        switch (this.currentSort) {
            case 'price-low':
                filtered.sort((a, b) => a.price - b.price);
                break;
            case 'price-high':
                filtered.sort((a, b) => b.price - a.price);
                break;
            case 'name':
                filtered.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'rating':
                filtered.sort((a, b) => b.rating - a.rating);
                break;
        }
        
        this.filteredProducts = filtered;
        this.displayProducts(filtered.slice(0, this.productsPerPage * this.currentPage));
        this.updateLoadMoreButton();
    }

    displayProducts(products) {
        const grid = document.getElementById('productsGrid');
        
        if (products.length === 0) {
            grid.innerHTML = `
                <div class="no-products">
                    <i class="fas fa-search"></i>
                    <h3>No products found</h3>
                    <p>Try adjusting your search or filter criteria</p>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = products.map(product => `
            <div class="product-card fade-in" data-id="${product.id}">
                <img src="${product.image}" alt="${product.name}" class="product-image">
                <div class="product-info">
                    <h3 class="product-title">${product.name}</h3>
                    <div class="product-rating">
                        <div class="stars">
                            ${this.generateStars(product.rating)}
                        </div>
                        <span class="rating-text">(${product.reviews})</span>
                    </div>
                    <p class="product-price">$${product.price}</p>
                    <div class="product-actions">
                        <button class="add-to-cart" onclick="app.addToCart(${product.id})">
                            <i class="fas fa-cart-plus"></i> Add to Cart
                        </button>
                        <button class="quick-view" onclick="app.openProductModal(${product.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    generateStars(rating) {
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            stars += `<i class="fas fa-star star ${i <= rating ? '' : 'empty'}"></i>`;
        }
        return stars;
    }

    loadMoreProducts() {
        this.currentPage++;
        this.renderProducts();
    }

    updateLoadMoreButton() {
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        const totalProducts = this.filteredProducts.length;
        const displayedProducts = this.productsPerPage * this.currentPage;
        
        if (displayedProducts >= totalProducts) {
            loadMoreBtn.style.display = 'none';
        } else {
            loadMoreBtn.style.display = 'block';
        }
    }

    addToCart(productId, quantity = 1) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;
        
        const existingItem = this.cart.find(item => item.id === productId);
        
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            this.cart.push({
                ...product,
                quantity: quantity
            });
        }
        
        this.saveCart();
        this.updateCartUI();
        this.showNotification(`${product.name} added to cart!`);
    }

    removeFromCart(productId) {
        this.cart = this.cart.filter(item => item.id !== productId);
        this.saveCart();
        this.updateCartUI();
    }

    updateCartQuantity(productId, newQuantity) {
        if (newQuantity <= 0) {
            this.removeFromCart(productId);
            return;
        }
        
        const item = this.cart.find(item => item.id === productId);
        if (item) {
            item.quantity = newQuantity;
            this.saveCart();
            this.updateCartUI();
        }
    }

    updateCartUI() {
        const cartCount = document.getElementById('cartCount');
        const cartItems = document.getElementById('cartItems');
        const cartTotal = document.getElementById('cartTotal');
        
        const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
        const totalPrice = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        cartCount.textContent = totalItems;
        cartTotal.textContent = totalPrice.toFixed(2);
        
        if (this.cart.length === 0) {
            cartItems.innerHTML = `
                <div class="empty-cart">
                    <i class="fas fa-shopping-cart"></i>
                    <h3>Your cart is empty</h3>
                    <p>Add some products to get started!</p>
                </div>
            `;
        } else {
            cartItems.innerHTML = this.cart.map(item => `
                <div class="cart-item">
                    <img src="${item.image}" alt="${item.name}" class="cart-item-image">
                    <div class="cart-item-info">
                        <div class="cart-item-title">${item.name}</div>
                        <div class="cart-item-price">$${item.price}</div>
                        <div class="cart-item-controls">
                            <button class="qty-btn" onclick="app.updateCartQuantity(${item.id}, ${item.quantity - 1})">-</button>
                            <span class="qty-display">${item.quantity}</span>
                            <button class="qty-btn" onclick="app.updateCartQuantity(${item.id}, ${item.quantity + 1})">+</button>
                            <button class="remove-item" onclick="app.removeFromCart(${item.id})">Remove</button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }

    toggleCart() {
        const cartSidebar = document.getElementById('cartSidebar');
        cartSidebar.classList.toggle('open');
    }

    openProductModal(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;
        
        const modal = document.getElementById('productModal');
        document.getElementById('modalImage').src = product.image;
        document.getElementById('modalTitle').textContent = product.name;
        document.getElementById('modalPrice').textContent = product.price;
        document.getElementById('modalDescription').textContent = product.description;
        document.getElementById('modalStars').innerHTML = this.generateStars(product.rating);
        document.getElementById('modalRatingText').textContent = `(${product.reviews} reviews)`;
        document.getElementById('modalQuantity').textContent = '1';
        
        // Store current product ID for modal actions
        modal.dataset.productId = productId;
        
        modal.classList.add('active');
    }

    closeProductModal() {
        document.getElementById('productModal').classList.remove('active');
    }

    updateModalQuantity(change) {
        const quantityDisplay = document.getElementById('modalQuantity');
        let currentQty = parseInt(quantityDisplay.textContent);
        currentQty = Math.max(1, currentQty + change);
        quantityDisplay.textContent = currentQty;
    }

    addToCartFromModal() {
        const modal = document.getElementById('productModal');
        const productId = parseInt(modal.dataset.productId);
        const quantity = parseInt(document.getElementById('modalQuantity').textContent);
        
        this.addToCart(productId, quantity);
        this.closeProductModal();
    }

    openCheckoutModal() {
        if (this.cart.length === 0) {
            this.showNotification('Your cart is empty!');
            return;
        }
        
        const modal = document.getElementById('checkoutModal');
        const checkoutItems = document.getElementById('checkoutItems');
        const checkoutTotal = document.getElementById('checkoutTotal');
        
        const totalPrice = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        checkoutItems.innerHTML = this.cart.map(item => `
            <div class="summary-item">
                <span>${item.name} x ${item.quantity}</span>
                <span>$${(item.price * item.quantity).toFixed(2)}</span>
            </div>
        `).join('');
        
        checkoutTotal.textContent = totalPrice.toFixed(2);
        
        this.toggleCart(); // Close cart sidebar
        modal.classList.add('active');
    }

    closeCheckoutModal() {
        document.getElementById('checkoutModal').classList.remove('active');
    }

    processOrder(e) {
        e.preventDefault();
        
        // Show loading
        this.showLoading();
        
        // Simulate order processing
        setTimeout(() => {
            this.hideLoading();
            this.showNotification('Order placed successfully! Thank you for your purchase.', 'success');
            
            // Clear cart and close modal
            this.cart = [];
            this.saveCart();
            this.updateCartUI();
            this.closeCheckoutModal();
            
            // Reset form
            document.getElementById('checkoutForm').reset();
        }, 2000);
    }

    saveCart() {
        localStorage.setItem('cart', JSON.stringify(this.cart));
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : '#3b82f6'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Remove after delay
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    showLoading() {
        document.getElementById('loadingSpinner').classList.add('active');
    }

    hideLoading() {
        document.getElementById('loadingSpinner').classList.remove('active');
    }

    setupSmoothScrolling() {
        // Smooth scrolling for navigation links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href');
                const targetElement = document.querySelector(targetId);
                
                if (targetElement) {
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
                
                // Update active nav link
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            });
        });
        
        // Update active nav link on scroll
        window.addEventListener('scroll', () => {
            const sections = document.querySelectorAll('section[id]');
            const scrollPos = window.scrollY + 100;
            
            sections.forEach(section => {
                const sectionTop = section.offsetTop;
                const sectionHeight = section.offsetHeight;
                const sectionId = section.getAttribute('id');
                
                if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
                    document.querySelectorAll('.nav-link').forEach(link => {
                        link.classList.remove('active');
                        if (link.getAttribute('href') === `#${sectionId}`) {
                            link.classList.add('active');
                        }
                    });
                }
            });
        });
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ECommerceApp();
});

// Newsletter subscription
document.addEventListener('DOMContentLoaded', () => {
    const newsletterForm = document.querySelector('.newsletter');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = e.target.querySelector('input[type="email"]').value;
            if (email) {
                app.showNotification('Thank you for subscribing to our newsletter!', 'success');
                e.target.querySelector('input[type="email"]').value = '';
            }
        });
    }
});

// Add some additional utility functions
function formatPrice(price) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(price);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Add keyboard navigation support
document.addEventListener('keydown', (e) => {
    // Close modals with Escape key
    if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal-overlay.active');
        if (activeModal) {
            if (activeModal.id === 'productModal') {
                app.closeProductModal();
            } else if (activeModal.id === 'checkoutModal') {
                app.closeCheckoutModal();
            }
        }
        
        // Close cart sidebar
        const cartSidebar = document.getElementById('cartSidebar');
        if (cartSidebar.classList.contains('open')) {
            app.toggleCart();
        }
    }
});

// Add intersection observer for animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('fade-in');
        }
    });
}, observerOptions);

// Observe elements for animation
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const elementsToAnimate = document.querySelectorAll('.category-card, .product-card');
        elementsToAnimate.forEach(el => observer.observe(el));
    }, 1000);
});