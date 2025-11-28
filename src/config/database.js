const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Check if PostgreSQL is available (Render provides DATABASE_URL)
const isPostgres = !!process.env.DATABASE_URL;
let db;

console.log('Database configuration:');
console.log('- DATABASE_URL present:', !!process.env.DATABASE_URL);
console.log('- DATABASE_URL value:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
console.log('- Using PostgreSQL:', isPostgres);

if (isPostgres) {
  // Use PostgreSQL in production (Render)
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  // Create a db object that mimics sqlite3 interface for PostgreSQL
  db = {
    run: (sql, params, callback) => {
      pool.query(sql, params, (err, result) => {
        if (callback) {
          // Mimic sqlite3's lastID behavior
          const mockResult = { ...result, lastID: result.rows?.[0]?.id || result.insertId };
          callback(err, mockResult);
        }
      });
    },
    get: (sql, params, callback) => {
      pool.query(sql, params, (err, result) => {
        if (callback) callback(err, result ? result.rows[0] : null);
      });
    },
    all: (sql, params, callback) => {
      pool.query(sql, params, (err, result) => {
        if (callback) callback(err, result ? result.rows : []);
      });
    },
    serialize: (callback) => {
      // PostgreSQL doesn't need explicit serialization like SQLite
      if (callback) callback();
    }
  };

  console.log('Connected to PostgreSQL database');
} else {
  // Use SQLite for development (in-memory to avoid file system issues)
  db = new sqlite3.Database(':memory:', (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
    } else {
      console.log('Connected to in-memory SQLite database');
    }
  });
}

// Initialize database tables
async function initDatabase() {
  return new Promise((resolve, reject) => {
    // Function to create all tables
    const createTables = () => {
      // Rooms table
      db.run(`
        CREATE TABLE IF NOT EXISTS rooms (
          id ${isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
          room_number ${isPostgres ? 'VARCHAR(255)' : 'TEXT'} UNIQUE NOT NULL,
          guest_name ${isPostgres ? 'VARCHAR(255)' : 'TEXT'},
          phone_number ${isPostgres ? 'VARCHAR(255)' : 'TEXT'},
          check_in_date TIMESTAMP,
          check_out_date TIMESTAMP,
          status ${isPostgres ? 'VARCHAR(255)' : 'TEXT'} DEFAULT 'available',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Menu categories table
      db.run(`
        CREATE TABLE IF NOT EXISTS menu_categories (
          id ${isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
          name ${isPostgres ? 'VARCHAR(255)' : 'TEXT'} NOT NULL,
          description ${isPostgres ? 'TEXT' : 'TEXT'},
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Menu items table
      db.run(`
        CREATE TABLE IF NOT EXISTS menu_items (
          id ${isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
          category_id INTEGER ${isPostgres ? 'REFERENCES menu_categories (id)' : ''},
          name ${isPostgres ? 'VARCHAR(255)' : 'TEXT'} NOT NULL,
          description ${isPostgres ? 'TEXT' : 'TEXT'},
          price DECIMAL(10,2) NOT NULL,
          image_url ${isPostgres ? 'VARCHAR(500)' : 'TEXT'},
          is_available BOOLEAN DEFAULT TRUE,
          preparation_time INTEGER DEFAULT 30,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )${isPostgres ? '' : ', FOREIGN KEY (category_id) REFERENCES menu_categories (id)'}
      `);

      // Orders table
      db.run(`
        CREATE TABLE IF NOT EXISTS orders (
          id ${isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
          room_id INTEGER ${isPostgres ? 'REFERENCES rooms (id)' : ''} NOT NULL,
          status ${isPostgres ? 'VARCHAR(255)' : 'TEXT'} DEFAULT 'pending',
          total_amount DECIMAL(10,2) DEFAULT 0,
          special_instructions ${isPostgres ? 'TEXT' : 'TEXT'},
          estimated_delivery_time TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )${isPostgres ? '' : ', FOREIGN KEY (room_id) REFERENCES rooms (id)'}
      `);

      // Order items table
      db.run(`
        CREATE TABLE IF NOT EXISTS order_items (
          id ${isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
          order_id INTEGER ${isPostgres ? 'REFERENCES orders (id)' : ''} NOT NULL,
          menu_item_id INTEGER ${isPostgres ? 'REFERENCES menu_items (id)' : ''} NOT NULL,
          quantity INTEGER NOT NULL,
          unit_price DECIMAL(10,2) NOT NULL,
          special_instructions ${isPostgres ? 'TEXT' : 'TEXT'},
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )${isPostgres ? '' : ', FOREIGN KEY (order_id) REFERENCES orders (id), FOREIGN KEY (menu_item_id) REFERENCES menu_items (id)'}
      `);

      // Staff table
      db.run(`
        CREATE TABLE IF NOT EXISTS staff (
          id ${isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
          username ${isPostgres ? 'VARCHAR(255)' : 'TEXT'} UNIQUE NOT NULL,
          password_hash ${isPostgres ? 'VARCHAR(500)' : 'TEXT'} NOT NULL,
          name ${isPostgres ? 'VARCHAR(255)' : 'TEXT'} NOT NULL,
          role ${isPostgres ? 'VARCHAR(255)' : 'TEXT'} DEFAULT 'staff',
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Notifications table
      db.run(`
        CREATE TABLE IF NOT EXISTS notifications (
          id ${isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
          order_id INTEGER ${isPostgres ? 'REFERENCES orders (id)' : ''} NOT NULL,
          type ${isPostgres ? 'VARCHAR(255)' : 'TEXT'} NOT NULL,
          status ${isPostgres ? 'VARCHAR(255)' : 'TEXT'},
          message ${isPostgres ? 'TEXT' : 'TEXT'} NOT NULL,
          recipient ${isPostgres ? 'VARCHAR(255)' : 'TEXT'},
          sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )${isPostgres ? '' : ', FOREIGN KEY (order_id) REFERENCES orders (id)'}
      `);

      // Insert default data
      insertDefaultData();

      // Check if database is ready
      if (isPostgres) {
        db.get("SELECT 1", [], (err, result) => {
          if (err) {
            reject(err);
          } else {
            console.log('Database tables created successfully');
            resolve();
          }
        });
      } else {
        db.get("SELECT name FROM sqlite_master WHERE type='table' LIMIT 1", (err, row) => {
          if (err) {
            reject(err);
          } else {
            console.log('Database tables created successfully');
            resolve();
          }
        });
      }
    };

    // Execute table creation
    if (isPostgres) {
      createTables();
    } else {
      db.serialize(createTables);
    }
  });
}

// Insert default data
function insertDefaultData() {
  const ignoreSyntax = isPostgres ? 'ON CONFLICT DO NOTHING' : 'INSERT OR IGNORE';

  // Default menu categories
  const categories = [
    { name: 'Appetizers', description: 'Start your meal right' },
    { name: 'Main Courses', description: 'Hearty and satisfying' },
    { name: 'Desserts', description: 'Sweet endings' },
    { name: 'Beverages', description: 'Refreshing drinks' }
  ];

  categories.forEach(category => {
    db.run(`
      ${ignoreSyntax} INTO menu_categories (name, description)
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
      ${ignoreSyntax} INTO menu_items (category_id, name, description, price)
      VALUES (?, ?, ?, ?)
    `, item);
  });

  // Default staff user (password: admin123)
  const bcrypt = require('bcryptjs');
  const saltRounds = 10;
  const defaultPassword = 'admin123';
  const hashedPassword = bcrypt.hashSync(defaultPassword, saltRounds);

  db.run(`
    ${ignoreSyntax} INTO staff (username, password_hash, name, role)
    VALUES (?, ?, ?, ?)
  `, ['admin', hashedPassword, 'Hotel Administrator', 'admin']);
}

module.exports = { db, initDatabase };
