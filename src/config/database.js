const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/hotelagent.db');

// Create database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Initialize database tables
async function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Rooms table
      db.run(`
        CREATE TABLE IF NOT EXISTS rooms (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          room_number TEXT UNIQUE NOT NULL,
          guest_name TEXT,
          phone_number TEXT,
          check_in_date DATETIME,
          check_out_date DATETIME,
          status TEXT DEFAULT 'available',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Menu categories table
      db.run(`
        CREATE TABLE IF NOT EXISTS menu_categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Menu items table
      db.run(`
        CREATE TABLE IF NOT EXISTS menu_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category_id INTEGER,
          name TEXT NOT NULL,
          description TEXT,
          price DECIMAL(10,2) NOT NULL,
          image_url TEXT,
          is_available BOOLEAN DEFAULT 1,
          preparation_time INTEGER DEFAULT 30,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (category_id) REFERENCES menu_categories (id)
        )
      `);

      // Orders table
      db.run(`
        CREATE TABLE IF NOT EXISTS orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          room_id INTEGER NOT NULL,
          status TEXT DEFAULT 'pending',
          total_amount DECIMAL(10,2) DEFAULT 0,
          special_instructions TEXT,
          estimated_delivery_time DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (room_id) REFERENCES rooms (id)
        )
      `);

      // Order items table
      db.run(`
        CREATE TABLE IF NOT EXISTS order_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL,
          menu_item_id INTEGER NOT NULL,
          quantity INTEGER NOT NULL,
          unit_price DECIMAL(10,2) NOT NULL,
          special_instructions TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (order_id) REFERENCES orders (id),
          FOREIGN KEY (menu_item_id) REFERENCES menu_items (id)
        )
      `);

      // Staff table
      db.run(`
        CREATE TABLE IF NOT EXISTS staff (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT DEFAULT 'staff',
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Notifications table
      db.run(`
        CREATE TABLE IF NOT EXISTS notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL,
          type TEXT NOT NULL,
          status TEXT,
          message TEXT NOT NULL,
          recipient TEXT,
          sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (order_id) REFERENCES orders (id)
        )
      `);

      // Insert default data
      insertDefaultData();

      db.get("SELECT name FROM sqlite_master WHERE type='table'", (err, row) => {
        if (err) {
          reject(err);
        } else {
          console.log('Database tables created successfully');
          resolve();
        }
      });
    });
  });
}

// Insert default data
function insertDefaultData() {
  // Default menu categories
  const categories = [
    { name: 'Appetizers', description: 'Start your meal right' },
    { name: 'Main Courses', description: 'Hearty and satisfying' },
    { name: 'Desserts', description: 'Sweet endings' },
    { name: 'Beverages', description: 'Refreshing drinks' }
  ];

  categories.forEach(category => {
    db.run(`
      INSERT OR IGNORE INTO menu_categories (name, description)
      VALUES (?, ?)
    `, [category.name, category.description]);
  });

  // Default menu items
  const menuItems = [
    [1, 'Caesar Salad', 'Crisp romaine lettuce with parmesan and croutons', 12.99],
    [1, 'Buffalo Wings', 'Spicy chicken wings with blue cheese dip', 14.99],
    [2, 'Grilled Salmon', 'Fresh Atlantic salmon with seasonal vegetables', 24.99],
    [2, 'Ribeye Steak', '12oz prime ribeye with garlic mashed potatoes', 32.99],
    [2, 'Chicken Parmesan', 'Breaded chicken breast with marinara and mozzarella', 18.99],
    [3, 'Chocolate Cake', 'Rich chocolate cake with vanilla ice cream', 8.99],
    [3, 'Tiramisu', 'Classic Italian dessert with coffee and mascarpone', 9.99],
    [4, 'Coffee', 'Freshly brewed coffee', 3.99],
    [4, 'Soda', 'Coca-Cola, Sprite, or Orange soda', 2.99],
    [4, 'Wine', 'House red or white wine', 8.99]
  ];

  menuItems.forEach(item => {
    db.run(`
      INSERT OR IGNORE INTO menu_items (category_id, name, description, price)
      VALUES (?, ?, ?, ?)
    `, item);
  });

  // Default staff user (password: admin123)
  const bcrypt = require('bcryptjs');
  const saltRounds = 10;
  const defaultPassword = 'admin123';
  const hashedPassword = bcrypt.hashSync(defaultPassword, saltRounds);

  db.run(`
    INSERT OR IGNORE INTO staff (username, password_hash, name, role)
    VALUES (?, ?, ?, ?)
  `, ['admin', hashedPassword, 'Hotel Administrator', 'admin']);
}

module.exports = { db, initDatabase };
