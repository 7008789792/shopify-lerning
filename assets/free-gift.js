class FreeGiftManager {
  constructor() {
    this.minimumFreeShipping = parseFloat(window.theme.settings.minimum_free_shipping || 0);
    this.freeGiftProductId = window.theme.settings.free_gift_product || null;
    this.freeGiftVariantId = null;
    this.freeGiftInCart = false;
    this.freeGiftLineItemId = null;
    this.isProcessing = false;
    
    // Initialize
    this.init();
  }
  
  async init() {
    if (!this.freeGiftProductId) return;
    
    // Get the first variant of the free gift product
    try {
      const response = await fetch(`/products/${this.freeGiftProductId}.js`);
      const product = await response.json();
      if (product && product.variants && product.variants.length > 0) {
        this.freeGiftVariantId = product.variants[0].id;
        
        // Check if free gift is already in cart
        await this.checkFreeGiftInCart();
        
        // Set up cart change listener
        this.setupCartChangeListener();
      }
    } catch (error) {
      console.error('Error initializing free gift:', error);
    }
  }
  
  async checkFreeGiftInCart() {
    if (this.isProcessing) return;
    
    try {
      this.isProcessing = true;
      const response = await fetch('/cart.js');
      const cart = await response.json();
      
      // Check if free gift is in cart
      const freeGiftItem = cart.items.find(item => item.variant_id === this.freeGiftVariantId);
      
      if (freeGiftItem) {
        this.freeGiftInCart = true;
        this.freeGiftLineItemId = freeGiftItem.key;
      } else {
        this.freeGiftInCart = false;
        this.freeGiftLineItemId = null;
      }
      
      // Check if we need to add or remove the free gift
      await this.updateFreeGiftStatus(cart.total_price / 100);
    } catch (error) {
      console.error('Error checking free gift in cart:', error);
    } finally {
      this.isProcessing = false;
    }
  }
  
  async updateFreeGiftStatus(cartTotal) {
    if (cartTotal >= this.minimumFreeShipping && !this.freeGiftInCart) {
      // Add free gift to cart
      await this.addFreeGiftToCart();
    } else if (cartTotal < this.minimumFreeShipping && this.freeGiftInCart) {
      // Remove free gift from cart
      await this.removeFreeGiftFromCart();
    }
  }
  
  async addFreeGiftToCart() {
    if (!this.freeGiftVariantId || this.isProcessing) return;
    
    try {
      this.isProcessing = true;
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          items: [{
            id: this.freeGiftVariantId,
            quantity: 1
          }]
        })
      });
      
      if (response.ok) {
        this.freeGiftInCart = true;
        // Refresh cart drawer
        this.refreshCartDrawer();
      }
    } catch (error) {
      console.error('Error adding free gift to cart:', error);
    } finally {
      this.isProcessing = false;
    }
  }
  
  async removeFreeGiftFromCart() {
    if (!this.freeGiftLineItemId || this.isProcessing) return;
    
    try {
      this.isProcessing = true;
      const response = await fetch('/cart/change.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: this.freeGiftLineItemId,
          quantity: 0
        })
      });
      
      if (response.ok) {
        this.freeGiftInCart = false;
        this.freeGiftLineItemId = null;
        // Refresh cart drawer
        this.refreshCartDrawer();
      }
    } catch (error) {
      console.error('Error removing free gift from cart:', error);
    } finally {
      this.isProcessing = false;
    }
  }
  
  refreshCartDrawer() {
    // Try different methods to refresh the cart drawer
    if (typeof window.refreshCartDrawer === 'function') {
      window.refreshCartDrawer();
    } else if (typeof window.theme !== 'undefined' && typeof window.theme.refreshCartDrawer === 'function') {
      window.theme.refreshCartDrawer();
    } else {
      // Dispatch a custom event that other scripts can listen for
      document.dispatchEvent(new CustomEvent('cart:refresh'));
    }
  }
  
  setupCartChangeListener() {
    // Listen for cart changes
    document.addEventListener('cart:updated', () => {
      this.checkFreeGiftInCart();
    });
    
    // Also listen for custom refresh events
    document.addEventListener('cart:refresh', () => {
      this.checkFreeGiftInCart();
    });
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.freeGiftManager = new FreeGiftManager();
}); 