# Global Vastra - E-commerce Frontend

A complete, responsive e-commerce frontend for an Indian fashion brand built with HTML, CSS, and JavaScript.

## 🌟 Features

### Pages
- **Home Page** (`index.html`) - Landing page with hero section, featured products, and about section
- **Products Page** (`products.html`) - Product catalog with add to cart functionality
- **Cart Page** (`cart.html`) - Shopping cart with quantity management and checkout
- **Payment Page** (`payment.html`) - Secure payment gateway with multiple payment options
- **Login Page** (`login.html`) - User authentication with social login options
- **Register Page** (`register.html`) - User registration with form validation

### Functionality
- 🛒 **Shopping Cart** - Add/remove items, quantity management, persistent storage
- 💳 **Payment Processing** - Multiple payment methods (UPI, Credit/Debit Card, COD)
- 👤 **User Authentication** - Login/Register with form validation
- 📱 **Responsive Design** - Mobile-first approach, works on all devices
- 🎨 **Modern UI/UX** - Clean, professional design with smooth animations
- 💾 **Local Storage** - Persistent cart and user session management

### Technical Features
- **Vanilla JavaScript** - No external dependencies
- **CSS Grid & Flexbox** - Modern layout techniques
- **Mobile Navigation** - Hamburger menu for mobile devices
- **Form Validation** - Client-side validation for all forms
- **Image Optimization** - Responsive images with proper sizing
- **Cross-browser Compatible** - Works on all modern browsers

## 🚀 Getting Started

### Prerequisites
- A modern web browser
- A local web server (optional, but recommended)

### Installation
1. Clone or download the project files
2. Open `index.html` in your web browser
3. For best experience, serve the files through a local web server:
   ```bash
   # Using Python 3
   python -m http.server 8000
   
   # Using Node.js (if you have live-server installed)
   live-server
   
   # Using PHP
   php -S localhost:8000
   ```

## 📁 Project Structure

```
global-vastra/
├── index.html          # Home page
├── products.html       # Products catalog
├── cart.html          # Shopping cart
├── payment.html       # Payment gateway
├── login.html         # User login
├── register.html      # User registration
├── style.css          # Main stylesheet
├── products.css       # Products page styles
├── cart.css           # Cart page styles
├── payment.css        # Payment page styles
├── login.css          # Login page styles
├── register.css       # Register page styles
├── script.js          # Main JavaScript
├── products.js        # Products functionality
├── cart.js            # Cart functionality
├── payment.js         # Payment processing
├── login.js           # Login functionality
├── register.js        # Registration functionality
└── README.md          # Project documentation
```

## 🎨 Design Features

### Color Scheme
- **Primary Color**: #b71c1c (Deep Red)
- **Secondary Color**: #000000 (Black)
- **Background**: #f8f8f8 (Light Gray)
- **Text**: #333333 (Dark Gray)

### Typography
- **Font Family**: Poppins (Google Fonts)
- **Weights**: 300, 400, 500, 600, 700

### Responsive Breakpoints
- **Desktop**: 1200px+
- **Tablet**: 768px - 1199px
- **Mobile**: 320px - 767px

## 🛍️ E-commerce Features

### Product Management
- Product display with images, names, and prices
- Add to cart functionality
- Buy now for immediate purchase
- Product image hover effects

### Shopping Cart
- Add/remove items
- Quantity adjustment
- Real-time price calculation
- Persistent storage using localStorage
- Empty cart state handling

### Payment System
- Multiple payment methods:
  - UPI Payment
  - Credit Card
  - Debit Card
  - Cash on Delivery
- Form validation for payment details
- Order summary display
- Success/failure handling

### User Management
- User registration with validation
- Login with email/password
- Social login options (UI only)
- Session management
- Password strength indicator
- Form validation and error handling

## 📱 Mobile Responsiveness

The website is fully responsive and optimized for:
- **Mobile phones** (320px - 767px)
- **Tablets** (768px - 1199px)
- **Desktops** (1200px+)

### Mobile Features
- Hamburger navigation menu
- Touch-friendly buttons and links
- Optimized image sizes
- Readable typography on small screens
- Easy-to-use cart and checkout flow

## 🔧 Customization

### Adding New Products
1. Open `products.html`
2. Add a new product card following the existing structure
3. Update the `products.js` file with the new product data
4. Add product images to your image directory

### Styling Changes
- Modify CSS variables in the respective stylesheets
- Update color scheme by changing the primary color values
- Adjust responsive breakpoints as needed

### Functionality Extensions
- Add product categories and filtering
- Implement search functionality
- Add user reviews and ratings
- Integrate with a backend API
- Add more payment gateways

## 🌐 Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+
- Mobile browsers (iOS Safari, Chrome Mobile)

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

For support, email support@globalvastra.com or create an issue in the repository.

## 🎯 Future Enhancements

- Backend integration with Node.js/PHP
- Database integration (MySQL/MongoDB)
- Real payment gateway integration
- User dashboard and order history
- Product reviews and ratings
- Wishlist functionality
- Email notifications
- Admin panel for product management
- SEO optimization
- PWA (Progressive Web App) features

---

**Global Vastra** - Your destination for premium Indian fashion! 🛍️✨