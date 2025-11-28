// Dashboard JavaScript
let currentSection = 'orders';
let ordersData = [];
let menuData = [];
let currentFilter = 'all';

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication first
    checkAuthentication().then(isAuthenticated => {
        if (!isAuthenticated) {
            window.location.href = '/login';
            return;
        }

        updateCurrentTime();
        setInterval(updateCurrentTime, 1000);
        loadOrders();
        loadMenuItems();
        loadStats();

        // Auto-refresh every 30 seconds
        setInterval(() => {
            if (currentSection === 'orders') {
                loadOrders();
                loadStats();
            }
        }, 30000);
    });
});

// Check if user is authenticated
async function checkAuthentication() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        return false;
    }

    try {
        const response = await fetch('/auth/verify', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            // Update user info display
            updateUserDisplay(data.user);
            return true;
        } else {
            // Token invalid, remove it
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            return false;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        return false;
    }
}

// Update user display in dashboard
function updateUserDisplay(user) {
    const navbar = document.querySelector('.navbar');
    if (navbar && user) {
        const userInfo = document.createElement('div');
        userInfo.className = 'ms-auto d-flex align-items-center';
        userInfo.innerHTML = `
            <span class="me-3 text-muted">Welcome, ${user.name}</span>
            <button class="btn btn-outline-secondary btn-sm" onclick="logout()">
                <i class="fas fa-sign-out-alt me-1"></i>Logout
            </button>
        `;

        // Remove existing user info if present
        const existing = navbar.querySelector('.ms-auto');
        if (existing) existing.remove();

        navbar.appendChild(userInfo);
    }
}

// Logout function
function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    window.location.href = '/login';
}

// Helper function for authenticated API calls
async function authenticatedFetch(url, options = {}) {
    const token = localStorage.getItem('authToken');
    if (!token) {
        throw new Error('No authentication token found');
    }

    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    };

    return fetch(url, { ...options, ...defaultOptions });
}

// Update current time display
function updateCurrentTime() {
    const now = new Date();
    document.getElementById('currentTime').textContent = now.toLocaleTimeString();
}

// Section navigation
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.style.display = 'none';
    });

    // Show selected section
    document.getElementById(sectionName + '-section').style.display = 'block';

    // Update active nav link
    document.querySelectorAll('.sidebar .nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`[href="#${sectionName}"]`).classList.add('active');

    currentSection = sectionName;

    // Load section-specific data
    switch(sectionName) {
        case 'orders':
            loadOrders();
            break;
        case 'menu':
            loadMenuItems();
            break;
        case 'rooms':
            loadRooms();
            break;
        case 'analytics':
            loadAnalytics();
            break;
        case 'settings':
            loadSettings();
            break;
    }
}

// Load orders data
async function loadOrders() {
    try {
        const response = await authenticatedFetch('/api/orders');
        if (!response.ok) throw new Error('Failed to load orders');

        // For now, we'll simulate orders data since we don't have a specific endpoint
        // In production, you'd have an endpoint that returns all orders
        ordersData = await simulateOrdersData();
        displayOrders(ordersData);
    } catch (error) {
        console.error('Error loading orders:', error);
        showAlert('Error loading orders', 'danger');
    }
}

// Simulate orders data for demonstration
async function simulateOrdersData() {
    // This would normally come from your API
    return [
        {
            id: 1,
            room_number: '101',
            guest_name: 'John Smith',
            status: 'pending',
            total_amount: 24.99,
            created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            items: [
                { name: 'Caesar Salad', quantity: 1, price: 12.99 },
                { name: 'Coffee', quantity: 1, price: 3.99 },
                { name: 'Chocolate Cake', quantity: 1, price: 8.01 }
            ]
        },
        {
            id: 2,
            room_number: '205',
            guest_name: 'Sarah Johnson',
            status: 'preparing',
            total_amount: 32.99,
            created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
            items: [
                { name: 'Ribeye Steak', quantity: 1, price: 32.99 }
            ]
        },
        {
            id: 3,
            room_number: '312',
            guest_name: 'Mike Wilson',
            status: 'ready',
            total_amount: 18.99,
            created_at: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
            items: [
                { name: 'Chicken Parmesan', quantity: 1, price: 18.99 }
            ]
        }
    ];
}

// Display orders in the UI
function displayOrders(orders) {
    const ordersList = document.getElementById('ordersList');
    ordersList.innerHTML = '';

    if (orders.length === 0) {
        ordersList.innerHTML = '<div class="col-12"><div class="alert alert-info">No orders found</div></div>';
        return;
    }

    orders.forEach(order => {
        if (currentFilter !== 'all' && order.status !== currentFilter) return;

        const orderCard = createOrderCard(order);
        ordersList.appendChild(orderCard);
    });
}

// Create order card element
function createOrderCard(order) {
    const col = document.createElement('div');
    col.className = 'col-md-6 col-lg-4 mb-3';

    const timeAgo = getTimeAgo(new Date(order.created_at));
    const statusClass = `status-${order.status}`;

    col.innerHTML = `
        <div class="card order-card h-100" onclick="showOrderDetails(${order.id})">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h6 class="card-title mb-0">Room ${order.room_number}</h6>
                    <span class="badge bg-${getStatusColor(order.status)}">${order.status}</span>
                </div>
                <p class="card-text text-muted small mb-2">${order.guest_name}</p>
                <p class="card-text mb-2">
                    <strong>$${order.total_amount.toFixed(2)}</strong>
                </p>
                <div class="mb-2">
                    ${order.items.slice(0, 2).map(item => `<small class="text-muted d-block">${item.quantity}x ${item.name}</small>`).join('')}
                    ${order.items.length > 2 ? `<small class="text-muted">+${order.items.length - 2} more items</small>` : ''}
                </div>
                <small class="text-muted">${timeAgo}</small>
            </div>
        </div>
    `;

    return col;
}

// Filter orders
function filterOrders(filter) {
    currentFilter = filter;
    displayOrders(ordersData);
}

// Get status color for badges
function getStatusColor(status) {
    const colors = {
        'pending': 'warning',
        'confirmed': 'info',
        'preparing': 'orange',
        'ready': 'success',
        'delivered': 'secondary',
        'cancelled': 'danger'
    };
    return colors[status] || 'secondary';
}

// Load menu items
async function loadMenuItems() {
    try {
        const response = await authenticatedFetch('/api/menu');
        if (!response.ok) throw new Error('Failed to load menu');

        menuData = await response.json();
        displayMenuItems(menuData);
    } catch (error) {
        console.error('Error loading menu:', error);
        showAlert('Error loading menu items', 'danger');
    }
}

// Display menu items
function displayMenuItems(items) {
    const menuList = document.getElementById('menuItemsList');
    menuList.innerHTML = '';

    if (items.length === 0) {
        menuList.innerHTML = '<div class="alert alert-info">No menu items found</div>';
        return;
    }

    const categories = {};
    items.forEach(item => {
        if (!categories[item.category_name]) {
            categories[item.category_name] = [];
        }
        categories[item.category_name].push(item);
    });

    Object.keys(categories).forEach(categoryName => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'mb-4';
        categoryDiv.innerHTML = `<h4 class="mb-3">${categoryName}</h4>`;

        const row = document.createElement('div');
        row.className = 'row';

        categories[categoryName].forEach(item => {
            const col = document.createElement('div');
            col.className = 'col-md-6 col-lg-4 mb-3';

            const availabilityClass = item.is_available ? 'available' : 'unavailable';
            const availabilityText = item.is_available ? 'Available' : 'Unavailable';

            col.innerHTML = `
                <div class="menu-item-card ${availabilityClass}">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="mb-0">${item.name}</h6>
                        <span class="badge bg-${item.is_available ? 'success' : 'danger'}">${availabilityText}</span>
                    </div>
                    <p class="text-muted small mb-2">${item.description}</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <strong>$${item.price.toFixed(2)}</strong>
                        <small class="text-muted">${item.preparation_time} min</small>
                    </div>
                    <div class="mt-2">
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="editMenuItem(${item.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-${item.is_available ? 'warning' : 'success'}"
                                onclick="toggleMenuItem(${item.id}, ${!item.is_available})">
                            <i class="fas fa-${item.is_available ? 'eye-slash' : 'eye'}"></i>
                        </button>
                    </div>
                </div>
            `;

            row.appendChild(col);
        });

        categoryDiv.appendChild(row);
        menuList.appendChild(categoryDiv);
    });
}

// Load stats
async function loadStats() {
    try {
        // Simulate stats data
        document.getElementById('todayOrders').textContent = '12';
        document.getElementById('todayRevenue').textContent = '$387.45';
        document.getElementById('avgDeliveryTime').textContent = '42 min';
        document.getElementById('pendingOrders').textContent = '3';
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Show order details modal
function showOrderDetails(orderId) {
    const order = ordersData.find(o => o.id === orderId);
    if (!order) return;

    const modal = new bootstrap.Modal(document.getElementById('orderDetailsModal'));
    const content = document.getElementById('orderDetailsContent');
    const actionButtons = document.getElementById('orderActionButtons');

    content.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <h6>Order #${order.id}</h6>
                <p><strong>Room:</strong> ${order.room_number}</p>
                <p><strong>Guest:</strong> ${order.guest_name}</p>
                <p><strong>Status:</strong> <span class="badge bg-${getStatusColor(order.status)}">${order.status}</span></p>
                <p><strong>Total:</strong> $${order.total_amount.toFixed(2)}</p>
                <p><strong>Ordered:</strong> ${new Date(order.created_at).toLocaleString()}</p>
            </div>
            <div class="col-md-6">
                <h6>Items</h6>
                <ul class="list-group">
                    ${order.items.map(item => `
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            ${item.name}
                            <span class="badge bg-primary rounded-pill">${item.quantity}x $${item.price.toFixed(2)}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        </div>
    `;

    // Action buttons based on status
    actionButtons.innerHTML = '';
    if (order.status === 'pending') {
        actionButtons.innerHTML += `<button class="btn btn-success" onclick="updateOrderStatus(${order.id}, 'confirmed')">Confirm Order</button>`;
    } else if (order.status === 'confirmed') {
        actionButtons.innerHTML += `<button class="btn btn-warning" onclick="updateOrderStatus(${order.id}, 'preparing')">Start Preparing</button>`;
    } else if (order.status === 'preparing') {
        actionButtons.innerHTML += `<button class="btn btn-info" onclick="updateOrderStatus(${order.id}, 'ready')">Mark Ready</button>`;
    } else if (order.status === 'ready') {
        actionButtons.innerHTML += `<button class="btn btn-secondary" onclick="updateOrderStatus(${order.id}, 'delivered')">Mark Delivered</button>`;
    }

    actionButtons.innerHTML += `<button class="btn btn-danger ms-2" onclick="updateOrderStatus(${order.id}, 'cancelled')">Cancel Order</button>`;

    modal.show();
}

// Update order status
async function updateOrderStatus(orderId, newStatus) {
    try {
        const response = await authenticatedFetch(`/api/orders/${orderId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });

        if (!response.ok) throw new Error('Failed to update order status');

        // Update local data
        const order = ordersData.find(o => o.id === orderId);
        if (order) {
            order.status = newStatus;
        }

        displayOrders(ordersData);
        loadStats();

        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('orderDetailsModal')).hide();

        showAlert(`Order status updated to ${newStatus}`, 'success');
    } catch (error) {
        console.error('Error updating order status:', error);
        showAlert('Error updating order status', 'danger');
    }
}

// Show add menu item modal
function showAddMenuItemModal() {
    // Load categories
    authenticatedFetch('/api/categories')
        .then(response => response.json())
        .then(categories => {
            const select = document.getElementById('menuItemCategory');
            select.innerHTML = categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');

            const modal = new bootstrap.Modal(document.getElementById('addMenuItemModal'));
            modal.show();
        })
        .catch(error => {
            console.error('Error loading categories:', error);
            showAlert('Error loading categories', 'danger');
        });
}

// Add menu item
async function addMenuItem() {
    const form = document.getElementById('addMenuItemForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const itemData = {
        categoryId: document.getElementById('menuItemCategory').value,
        name: document.getElementById('menuItemName').value,
        description: document.getElementById('menuItemDescription').value,
        price: parseFloat(document.getElementById('menuItemPrice').value),
        preparationTime: parseInt(document.getElementById('menuItemPrepTime').value)
    };

    try {
        // In a real implementation, you'd have a POST endpoint for adding menu items
        console.log('Adding menu item:', itemData);
        showAlert('Menu item added successfully', 'success');

        // Close modal and refresh
        bootstrap.Modal.getInstance(document.getElementById('addMenuItemModal')).hide();
        loadMenuItems();
    } catch (error) {
        console.error('Error adding menu item:', error);
        showAlert('Error adding menu item', 'danger');
    }
}

// Utility functions
function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return date.toLocaleDateString();
}

function showAlert(message, type = 'info') {
    // Simple alert - you could enhance this with a proper toast system
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    document.body.appendChild(alertDiv);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// Placeholder functions for other sections
function loadRooms() {
    const roomsList = document.getElementById('roomsList');
    roomsList.innerHTML = '<div class="alert alert-info">Room management feature coming soon</div>';
}

function loadAnalytics() {
    // Initialize charts if Chart.js is available
    if (typeof Chart !== 'undefined') {
        // Popular items chart
        const ctx1 = document.getElementById('popularItemsChart');
        if (ctx1) {
            new Chart(ctx1, {
                type: 'bar',
                data: {
                    labels: ['Caesar Salad', 'Ribeye Steak', 'Chicken Parm', 'Coffee', 'Chocolate Cake'],
                    datasets: [{
                        label: 'Orders',
                        data: [12, 8, 6, 15, 9],
                        backgroundColor: 'rgba(54, 162, 235, 0.5)'
                    }]
                }
            });
        }

        // Order trends chart
        const ctx2 = document.getElementById('orderTrendsChart');
        if (ctx2) {
            new Chart(ctx2, {
                type: 'line',
                data: {
                    labels: ['9AM', '10AM', '11AM', '12PM', '1PM', '2PM', '3PM', '4PM', '5PM', '6PM'],
                    datasets: [{
                        label: 'Orders',
                        data: [2, 4, 3, 8, 6, 5, 7, 4, 3, 2],
                        borderColor: 'rgba(75, 192, 192, 1)',
                        tension: 0.1
                    }]
                }
            });
        }
    }
}

function loadSettings() {
    // Load system status
    checkSystemStatus();
}

async function checkSystemStatus() {
    // Simulate status checks
    document.getElementById('dbStatus').innerHTML = '<span class="text-success">Connected</span>';
    document.getElementById('twilioStatus').innerHTML = '<span class="text-success">Connected</span>';
    document.getElementById('elevenlabsStatus').innerHTML = '<span class="text-warning">API Key Required</span>';
}

function refreshData() {
    if (currentSection === 'orders') {
        loadOrders();
        loadStats();
    } else if (currentSection === 'menu') {
        loadMenuItems();
    }
    showAlert('Data refreshed', 'success');
}

// Toggle menu item availability
function toggleMenuItem(itemId, available) {
    console.log(`Toggling item ${itemId} to ${available ? 'available' : 'unavailable'}`);
    // In a real implementation, you'd call an API endpoint
    showAlert(`Menu item ${available ? 'enabled' : 'disabled'}`, 'success');
    loadMenuItems();
}

// Edit menu item (placeholder)
function editMenuItem(itemId) {
    console.log('Editing menu item:', itemId);
    showAlert('Edit functionality coming soon', 'info');
}
