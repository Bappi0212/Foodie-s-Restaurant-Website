import React, { useState, useEffect } from 'react';
import './App.css';

// 🔴 Firebase Imports (Added doc and deleteDoc for cancellation)
import { collection, getDocs, addDoc, query, where, doc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';

const App = () => {
  const [activeTab, setActiveTab] = useState('home');

  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  // Order Management States
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);

  // 🔴 New State for Live Orders List
  const [myOrders, setMyOrders] = useState([]);

  const [snackbarMsg, setSnackbarMsg] = useState('');
  // Added payload to dialogue state to track which order to cancel
  const [dialogue, setDialogue] = useState({ isOpen: false, type: '', message: '', payload: null });

  const [currentSlide, setCurrentSlide] = useState(0);

  const bannerOffers = [
    { id: 1, title: "Savor the Best Taste", subtitle: "Get 20% OFF on all Pizzas this weekend! Order fresh & hot.", img: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=80" },
    { id: 2, title: "Spicy Burger Fest", subtitle: "Buy 1 Get 1 Free on all Premium Beef Burgers!", img: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1600&q=80" },
    { id: 3, title: "Healthy & Fresh", subtitle: "Try our new organic salads with a 15% discount.", img: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1600&q=80" }
  ];

  const showSnackbar = (msg) => {
    setSnackbarMsg(msg);
    setTimeout(() => setSnackbarMsg(''), 3000);
  };

  useEffect(() => {
    if (activeTab !== 'home') return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === bannerOffers.length - 1 ? 0 : prev + 1));
    }, 4000);
    return () => clearInterval(timer);
  }, [bannerOffers.length, activeTab]);

  // FETCH BRANCHES
  useEffect(() => {
    const fetchBranchesFromFirebase = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "branches"));
        const branchList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setBranches(branchList);
      } catch (error) {
        console.error("Error fetching branches: ", error);
      }
    };
    fetchBranchesFromFirebase();
  }, []);

  // FETCH MENU
  useEffect(() => {
    if (selectedBranch) {
      setOrderSuccess(false);
      setShowCheckout(false);

      const fetchMenuFromFirebase = async () => {
        try {
          const q = query(collection(db, "menu"), where("branch", "==", selectedBranch));
          const querySnapshot = await getDocs(q);
          const menuList = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setMenuItems(menuList);
        } catch (error) {
          console.error("Error fetching menu: ", error);
        }
      };
      fetchMenuFromFirebase();
    } else {
      setMenuItems([]);
    }
  }, [selectedBranch]);

  // 🔴 FETCH LIVE ORDERS WHEN "VIEW ORDER" TAB IS CLICKED
  useEffect(() => {
    if (activeTab === 'view_order') {
      const fetchMyOrders = async () => {
        try {
          const querySnapshot = await getDocs(collection(db, "orders"));
          const ordersData = querySnapshot.docs.map(doc => ({
            firebaseId: doc.id,
            ...doc.data()
          }));
          // Reversing array so newest orders appear first
          setMyOrders(ordersData.reverse());
        } catch (error) {
          console.error("Error fetching orders: ", error);
        }
      };
      fetchMyOrders();
    }
  }, [activeTab]);

  const addToCart = (item) => {
    const existingItem = cart.find(c => c.id === item.id);
    if (existingItem) {
      setCart(cart.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c));
    } else {
      setCart([...cart, { ...item, qty: 1 }]);
    }
    showSnackbar(`${item.name} added to cart`);
    setIsCartOpen(true);
  };

  const handleDirectOrder = (item) => {
    const existingItem = cart.find(c => c.id === item.id);
    if (!existingItem) {
      setCart([...cart, { ...item, qty: 1 }]);
    } else {
      setCart(cart.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c));
    }
    setIsCartOpen(false);
    setShowCheckout(true);
    setTimeout(() => {
      document.getElementById('checkout-target')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const updateQuantity = (id, amount) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQty = item.qty + amount;
        return newQty > 0 ? { ...item, qty: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const removeItem = (id) => {
    setCart(cart.filter(item => item.id !== id));
    showSnackbar("Item removed from cart");
  };

  const handleProceedToCheckout = () => {
    setIsCartOpen(false);
    setShowCheckout(true);
    setActiveTab('home');
    setTimeout(() => {
      document.getElementById('checkout-target')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const initiateOrder = (e) => {
    e.preventDefault();
    if (cart.length === 0) return;
    setDialogue({ isOpen: true, type: 'order', message: 'Confirm and place your order?', payload: null });
  };

  // 🔴 Updated to accept the specific order's Firebase ID
  const initiateCancel = (firebaseId) => {
    setDialogue({ isOpen: true, type: 'cancel', message: 'Are you sure you want to cancel this order?', payload: firebaseId });
  };

  const confirmAction = async () => {
    if (dialogue.type === 'order') {
      const orderData = {
        items: [...cart],
        totalAmount: totalPrice,
        orderId: "ORD-" + Math.floor(100000 + Math.random() * 900000),
        branch: selectedBranch,
        date: new Date().toLocaleString(),
        status: "Processing"
      };

      try {
        const docRef = await addDoc(collection(db, "orders"), orderData);
        // Save the generated document ID so we can track it
        setPlacedOrder({ ...orderData, firebaseId: docRef.id });
        setOrderSuccess(true);
        setShowCheckout(false);
        setCart([]);
        showSnackbar("Order placed");
        setTimeout(() => {
          document.getElementById('success-target')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } catch (error) {
        console.error("Error placing order: ", error);
        showSnackbar("Database Error: Could not save order.");
      }

    } else if (dialogue.type === 'cancel') {
      // 🔴 LIVE SERVER CANCELLATION (DELETE DOCUMENT)
      try {
        const orderIdToDelete = dialogue.payload;
        await deleteDoc(doc(db, "orders", orderIdToDelete));

        // Remove from local UI state without reloading
        setMyOrders(prevOrders => prevOrders.filter(order => order.firebaseId !== orderIdToDelete));

        // If the cancelled order is the one showing on the success screen, clear it
        if (placedOrder && placedOrder.firebaseId === orderIdToDelete) {
          setPlacedOrder(null);
          setOrderSuccess(false);
        }

        showSnackbar("Order cancelled");
      } catch (error) {
        console.error("Error deleting order: ", error);
        showSnackbar("Database Error: Could not cancel order.");
      }
    }
    setDialogue({ isOpen: false, type: '', message: '', payload: null });
  };

  const closeDialogue = () => {
    setDialogue({ isOpen: false, type: '', message: '', payload: null });
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    const contactData = {
      name: e.target[0].value,
      email: e.target[1].value,
      orderNumber: e.target[2].value,
      message: e.target[3].value,
      timestamp: new Date().toLocaleString()
    };

    try {
      await addDoc(collection(db, "contact_messages"), contactData);
      showSnackbar("Your message has been sent!");
      e.target.reset();
    } catch (error) {
      console.error("Error saving message: ", error);
      showSnackbar("Database Error: Could not send message.");
    }
  };

  useEffect(() => {
    if (cart.length === 0) {
      setShowCheckout(false);
    }
  }, [cart]);

  const totalItemsCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  return (
    <div className="restaurant-app">

      {/* Snackbar */}
      <div className={`snackbar ${snackbarMsg ? 'show' : ''}`}>
        {snackbarMsg}
      </div>

      {/* Popup Dialogue */}
      {dialogue.isOpen && (
        <div className="custom-popup-overlay">
          <div className="custom-popup">
            <h3>{dialogue.type === 'order' ? 'Confirm Order' : 'Cancel Order'}</h3>
            <p>{dialogue.message}</p>
            <div className="popup-actions">
              <button className="popup-btn-no" onClick={closeDialogue}>No, Go Back</button>
              <button className={`popup-btn-yes ${dialogue.type}`} onClick={confirmAction}>
                {dialogue.type === 'order' ? 'Yes, Place Order' : 'Yes, Cancel It'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NAVBAR */}
      <nav className="navbar">
        <div className="logo" onClick={() => setActiveTab('home')} style={{ cursor: 'pointer' }}>🍔 Foodie's</div>
        <ul className="nav-tabs">
          <li className={activeTab === 'home' ? 'active' : ''} onClick={() => setActiveTab('home')}>Home</li>
          <li className={activeTab === 'view_order' ? 'active' : ''} onClick={() => setActiveTab('view_order')}>View Order</li>
          <li className={activeTab === 'about' ? 'active' : ''} onClick={() => setActiveTab('about')}>About</li>
          <li className={activeTab === 'contact' ? 'active' : ''} onClick={() => setActiveTab('contact')}>Contact Us</li>
        </ul>
        <button className="cart-icon-btn" onClick={() => setIsCartOpen(true)}>
          🛒 Cart <span className="cart-count">{totalItemsCount}</span>
        </button>
      </nav>

      {/* Cart Drawer */}
      {isCartOpen && <div className="cart-overlay" onClick={() => setIsCartOpen(false)}></div>}
      <div className={`cart-drawer ${isCartOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <h3>Your Basket ({totalItemsCount})</h3>
          <button className="close-drawer-btn" onClick={() => setIsCartOpen(false)}>✕</button>
        </div>

        {cart.length === 0 ? (
          <div className="empty-cart-view">
            <p>Your cart is empty. Add some delicious food! </p>
          </div>
        ) : (
          <div className="drawer-content">
            <ul className="drawer-cart-list">
              {cart.map((item) => (
                <li key={item.id} className="drawer-cart-item">
                  <img src={item.img} alt={item.name} className="cart-item-thumb" onError={(e) => { e.target.src = 'https://placehold.co/100x100?text=Food'; }} />
                  <div className="cart-item-info">
                    <h4>{item.name}</h4>
                    <p>৳{item.price * item.qty}</p>
                    <div className="qty-controls">
                      <button onClick={() => updateQuantity(item.id, -1)}>-</button>
                      <span>{item.qty}</span>
                      <button onClick={() => updateQuantity(item.id, 1)}>+</button>
                      <button className="delete-item-btn" onClick={() => removeItem(item.id)} title="Remove Item">🗑️</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="drawer-footer">
              <div className="drawer-total">
                <span>Subtotal:</span>
                <strong>৳{totalPrice}</strong>
              </div>
              <button className="proceed-btn" onClick={handleProceedToCheckout}>
                Proceed to Checkout ➔
              </button>
            </div>
          </div>
        )}
      </div>

      <main className="container">

        {/* =======================
             PAGE 1: HOME PAGE
            ======================= */}
        {activeTab === 'home' && (
          <div className="page-section fade-in">
            <header className="banner-carousel">
              <div className="carousel-inner" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
                {bannerOffers.map((offer, index) => (
                  <div key={offer.id} className={`slide ${index === currentSlide ? 'active' : ''}`}
                    style={{ backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.7)), url(${offer.img})` }}>
                    <div className="banner-content">
                      <h1>{offer.title}</h1>
                      <p>{offer.subtitle}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="carousel-dots">
                {bannerOffers.map((_, index) => (
                  <span key={index} className={`dot ${index === currentSlide ? 'active' : ''}`} onClick={() => setCurrentSlide(index)}></span>
                ))}
              </div>
            </header>

            <section className="branch-selector">
              <h3>Where are you ordering from?</h3>
              <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
                <option value="">-- Select Your Nearest Branch --</option>
                {branches.map(branch => (
                  <option key={branch.id} value={branch.name}>{branch.name}</option>
                ))}
              </select>
            </section>

            {selectedBranch && (
              <section className="menu-section fade-in">
                <div className="section-header">
                  <h2>Popular Dishes</h2>
                  <span className="branch-tag">{selectedBranch}</span>
                </div>
                <div className="menu-grid">
                  {menuItems.map(item => (
                    <div key={item.id} className="menu-card">
                      {item.promo && <span className="badge">{item.promo}</span>}
                      <img src={item.img} alt={item.name} className="food-img" onError={(e) => { e.target.src = 'https://placehold.co/500x300?text=Food'; }} />
                      <div className="card-content">
                        <h4>{item.name}</h4>
                        <p className="desc">{item.desc}</p>
                        <div className="price-row">
                          <span className="price">৳{item.price}</span>
                        </div>
                        <div className="action-buttons">
                          <button className="add-btn" onClick={() => addToCart(item)}>🛒 Add</button>
                          <button className="buy-btn" onClick={() => handleDirectOrder(item)}>Order Now</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {orderSuccess && placedOrder && (
              <section id="success-target" className="success-message fade-in">
                <h2> Order Confirmed Successfully!</h2>
                <p>Thank you for your order. Our branch will contact you shortly.</p>
                <div className="order-actions" style={{ marginTop: '20px' }}>
                  <button className="view-order-btn" onClick={() => setActiveTab('view_order')}>
                    Go to View Order Page ➔
                  </button>
                </div>
              </section>
            )}

            {showCheckout && cart.length > 0 && (
              <section id="checkout-target" className="checkout-section-wrapper fade-in">
                <div className="checkout-container">
                  <div className="checkout-summary-box">
                    <h3>Order Summary</h3>
                    <p>Branch: <strong>{selectedBranch}</strong></p>
                    <div className="checkout-items-list">
                      {cart.map((item) => (
                        <div key={item.id} className="checkout-item">
                          <div className="checkout-item-info-row">
                            <span>{item.name}</span>
                            <strong>৳{item.price * item.qty}</strong>
                          </div>
                          <div className="qty-controls" style={{ marginTop: '10px' }}>
                            <button type="button" onClick={() => updateQuantity(item.id, -1)}>-</button>
                            <span>{item.qty}</span>
                            <button type="button" onClick={() => updateQuantity(item.id, 1)}>+</button>
                            <button type="button" className="delete-item-btn" onClick={() => removeItem(item.id)}>🗑️</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="final-price-tag">Total Payable: ৳{totalPrice}</div>
                  </div>

                  <div className="checkout-form-box">
                    <h3>Delivery Information</h3>
                    <form onSubmit={initiateOrder} className="checkout-form">
                      <input type="text" placeholder="Full Name" required />
                      <input type="tel" placeholder="Phone Number" required />
                      <textarea placeholder="Complete Delivery Address" rows="3" required></textarea>
                      <button type="submit" className="checkout-btn">Place Order</button>
                    </form>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {/* =======================
             PAGE 2: LIVE VIEW ORDER
            ======================= */}
        {activeTab === 'view_order' && (
          <div className="page-section view-order-page fade-in">
            <h2>Active Orders</h2>
            {myOrders.length > 0 ? (
              <div className="orders-list">
                {myOrders.map((order) => (
                  <div key={order.firebaseId} className="placed-order-details" style={{ marginBottom: '20px' }}>
                    <div className="details-header">
                      <h3>Order ID: {order.orderId}</h3>
                      <span className="status-badge">{order.status}</span>
                    </div>
                    <div className="order-meta">
                      <p><strong>Branch:</strong> {order.branch}</p>
                      <p><strong>Date:</strong> {order.date}</p>
                    </div>

                    <div className="order-items-bill">
                      <h4>Items Ordered:</h4>
                      <ul className="placed-items-list">
                        {order.items && order.items.map((item, index) => (
                          <li key={index} className="placed-item">
                            <span>{item.qty}x {item.name}</span>
                            <span>৳{item.price * item.qty}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="placed-total">
                      <strong>Total Paid (COD):</strong>
                      <strong style={{ color: '#27ae60', fontSize: '1.5rem' }}>৳{order.totalAmount}</strong>
                    </div>

                    {/* Cancel Button passes the Firebase Document ID */}
                    <button className="cancel-order-btn" onClick={() => initiateCancel(order.firebaseId)}>
                      Cancel This Order
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-order-view">
                <p>You don't have any active orders in the server right now.</p>
                <button className="view-order-btn" onClick={() => setActiveTab('home')}>Browse Menu</button>
              </div>
            )}
          </div>
        )}

        {/* =======================
             PAGE 3: ABOUT
            ======================= */}
        {activeTab === 'about' && (
          <div className="page-section about-page fade-in">
            <div className="about-content">
              <h2>About Foodie's</h2>
              <img src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80" alt="Restaurant interior" className="about-img" />
              <p>Welcome to Foodie's, where culinary excellence meets a warm, inviting atmosphere. Founded in 2020, we have dedicated ourselves to providing the freshest ingredients, authentic recipes, and a dining experience you won't forget.</p>
              <p>With branches in Banani, Dhanmondi, and Gulshan, we ensure that premium quality food is always within your reach. Thank you for making us a part of your daily lives!</p>
            </div>
          </div>
        )}

        {/* =======================
             PAGE 4: CONTACT
            ======================= */}
        {activeTab === 'contact' && (
          <div className="page-section contact-page fade-in">
            <h2>Contact Us</h2>
            <p className="contact-subtitle">Have a question or feedback? Fill out the form below and we'll get back to you!</p>

            <div className="contact-container">
              <form onSubmit={handleContactSubmit} className="contact-form">
                <div className="form-group">
                  <label>Full Name</label>
                  <input type="text" placeholder="Full Name" required />
                </div>

                <div className="form-group">
                  <label>Email Address</label>
                  <input type="email" placeholder="Email Address" required />
                </div>

                <div className="form-group">
                  <label>Order Number (Optional)</label>
                  <input type="text" placeholder="e.g. ORD-123456" />
                </div>

                <div className="form-group">
                  <label>Your Message / Feedback</label>
                  <textarea placeholder="Write something about your experience or query..." rows="5" required></textarea>
                </div>

                <button type="submit" className="submit-btn">Send Message</button>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default App;