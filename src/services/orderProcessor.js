const { db } = require('../config/database');
const notificationService = require('./notificationService');

/**
 * Enhanced order processing service with better NLP
 */
class OrderProcessor {
  constructor() {
    this.menuItems = [];
    this.loadMenuItems();
  }

  /**
   * Load menu items into memory for faster processing
   */
  async loadMenuItems() {
    try {
      this.menuItems = await this.getMenuItemsFromDB();
      console.log(`Loaded ${this.menuItems.length} menu items for order processing`);
    } catch (error) {
      console.error('Error loading menu items:', error);
    }
  }

  /**
   * Parse speech input and extract order items
   * @param {string} speech - Speech recognition result
   * @returns {Array} - Array of order items with quantities
   */
  parseOrderFromSpeech(speech) {
    if (!speech || speech.trim().length === 0) {
      return [];
    }

    const speech_lower = speech.toLowerCase();
    const orderItems = [];

    // Enhanced patterns for quantity recognition
    const quantityPatterns = [
      // "I want two burgers and three fries"
      /(\d+)\s+([a-z\s]+?)(?:and|or|,|$)/gi,
      // "Two burgers, three fries"
      /(\d+)\s+([a-z\s]+?)(?:,|\s+and|\s+or|$)/gi,
      // "Burger x2, fries x3"
      /([a-z\s]+?)\s*x(\d+)/gi,
      // "Two of the burgers"
      /(?:two|three|four|five|six|seven|eight|nine|ten)\s+(?:of\s+the\s+)?([a-z\s]+)/gi
    ];

    // Number word to digit mapping
    const numberWords = {
      'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
      'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
      'a': 1, 'an': 1
    };

    quantityPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(speech_lower)) !== null) {
        let quantity = 1;
        let itemName = '';

        if (match[1] && !isNaN(match[1])) {
          // Pattern with number first
          quantity = parseInt(match[1]);
          itemName = match[2].trim();
        } else if (match[2] && !isNaN(match[2])) {
          // Pattern with "x2" format
          itemName = match[1].trim();
          quantity = parseInt(match[2]);
        } else if (numberWords[match[1]]) {
          // Number word pattern
          quantity = numberWords[match[1]];
          itemName = match[2].trim();
        }

        if (itemName) {
          const menuItem = this.findMenuItem(itemName);
          if (menuItem) {
            // Check if item already exists in order
            const existingItem = orderItems.find(item => item.id === menuItem.id);
            if (existingItem) {
              existingItem.quantity += quantity;
            } else {
              orderItems.push({
                ...menuItem,
                quantity: quantity
              });
            }
          }
        }
      }
    });

    // If no structured orders found, try to identify items mentioned
    if (orderItems.length === 0) {
      this.menuItems.forEach(item => {
        const itemWords = item.name.toLowerCase().split(' ');
        const speechWords = speech_lower.split(/\s+/);

        // Check if all words of menu item name appear in speech
        const allWordsPresent = itemWords.every(word =>
          speechWords.some(speechWord => speechWord.includes(word) || word.includes(speechWord))
        );

        if (allWordsPresent) {
          orderItems.push({
            ...item,
            quantity: 1
          });
        }
      });
    }

    return orderItems;
  }

  /**
   * Parse SMS/text order
   * @param {string} text - SMS text content
   * @returns {Array} - Array of order items
   */
  parseOrderFromText(text) {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const text_lower = text.toLowerCase();
    const orderItems = [];

    // SMS patterns: "2 burgers, 3 fries" or "burger x2, fries x3"
    const patterns = [
      /(\d+)\s*([a-z\s]+?)(?:,|$)/gi,
      /([a-z\s]+?)\s*x(\d+)(?:,|$)/gi
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text_lower)) !== null) {
        let quantity = 1;
        let itemName = '';

        if (match[1] && !isNaN(match[1])) {
          quantity = parseInt(match[1]);
          itemName = match[2] ? match[2].trim() : '';
        } else if (match[2] && !isNaN(match[2])) {
          itemName = match[1] ? match[1].trim() : '';
          quantity = parseInt(match[2]);
        }

        if (itemName) {
          const menuItem = this.findMenuItem(itemName);
          if (menuItem) {
            const existingItem = orderItems.find(item => item.id === menuItem.id);
            if (existingItem) {
              existingItem.quantity += quantity;
            } else {
              orderItems.push({
                ...menuItem,
                quantity: quantity
              });
            }
          }
        }
      }
    });

    return orderItems;
  }

  /**
   * Find menu item by fuzzy name matching
   * @param {string} itemName - Name to search for
   * @returns {Object|null} - Menu item or null
   */
  findMenuItem(itemName) {
    if (!itemName || !this.menuItems.length) return null;

    const searchName = itemName.toLowerCase().trim();

    // Exact match first
    let match = this.menuItems.find(item =>
      item.name.toLowerCase() === searchName
    );

    if (match) return match;

    // Partial match
    match = this.menuItems.find(item => {
      const itemName_lower = item.name.toLowerCase();
      return itemName_lower.includes(searchName) ||
             searchName.includes(itemName_lower) ||
             this.calculateSimilarity(searchName, itemName_lower) > 0.6;
    });

    return match || null;
  }

  /**
   * Calculate string similarity (simple Levenshtein-based)
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} - Similarity score (0-1)
   */
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} - Edit distance
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Create order in database
   * @param {string} roomNumber - Room number
   * @param {Array} orderItems - Array of order items
   * @param {string} specialInstructions - Special instructions
   * @returns {number} - Order ID
   */
  async createOrder(roomNumber, orderItems, specialInstructions = '') {
    return new Promise((resolve, reject) => {
      // Get room ID
      db.get('SELECT id FROM rooms WHERE room_number = ?', [roomNumber], (err, room) => {
        if (err) return reject(err);
        if (!room) return reject(new Error('Room not found'));

        // Calculate total
        const totalAmount = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // Insert order
        db.run(
          'INSERT INTO orders (room_id, total_amount, special_instructions) VALUES (?, ?, ?)',
          [room.id, totalAmount, specialInstructions],
          function(err) {
            if (err) return reject(err);

            const orderId = this.lastID;

            // Insert order items
            let completed = 0;
            const totalItems = orderItems.length;

            if (totalItems === 0) {
              return resolve(orderId);
            }

            orderItems.forEach(item => {
              db.run(
                'INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
                [orderId, item.id, item.quantity, item.price],
                (err) => {
                  if (err) return reject(err);

                  completed++;
                  if (completed === totalItems) {
                    // Send new order alert to staff
                    notificationService.sendNewOrderAlert(orderId);
                    resolve(orderId);
                  }
                }
              );
            });
          }
        );
      });
    });
  }

  /**
   * Get menu items from database
   * @returns {Array} - Menu items
   */
  async getMenuItemsFromDB() {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT id, name, price, description
        FROM menu_items
        WHERE is_available = 1
        ORDER BY name
      `, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Get available menu items as formatted text for voice responses
   * @returns {string} - Formatted menu text
   */
  getMenuText() {
    if (!this.menuItems.length) {
      return 'Sorry, our menu is currently unavailable.';
    }

    let menuText = 'Here is our current menu. ';

    this.menuItems.forEach((item, index) => {
      menuText += `Item ${index + 1}: ${item.name} for $${item.price.toFixed(2)}. `;
    });

    menuText += 'To place an order, please say the item numbers you would like, followed by the quantities. For example, say "One item one, two item three".';

    return menuText;
  }

  /**
   * Refresh menu items cache
   */
  async refreshMenu() {
    await this.loadMenuItems();
  }
}

module.exports = new OrderProcessor();
