const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const notificationService = require('../services/notificationService');

// Get menu items
router.get('/menu', (req, res) => {
  db.all(`
    SELECT mi.*, mc.name as category_name
    FROM menu_items mi
    JOIN menu_categories mc ON mi.category_id = mc.id
    WHERE mi.is_available = true AND mc.is_active = true
    ORDER BY mc.name, mi.name
  `, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Get menu categories
router.get('/categories', (req, res) => {
  db.all(`
    SELECT * FROM menu_categories
    WHERE is_active = 1
    ORDER BY name
  `, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Create new order
router.post('/orders', (req, res) => {
  const { roomId, items, specialInstructions } = req.body;

  if (!roomId || !items || items.length === 0) {
    return res.status(400).json({ error: 'Room ID and items are required' });
  }

  // Calculate total amount
  let totalAmount = 0;
  items.forEach(item => {
    totalAmount += item.price * item.quantity;
  });

  // Start transaction
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // Insert order
    db.run(`
      INSERT INTO orders (room_id, total_amount, special_instructions)
      VALUES (?, ?, ?)
    `, [roomId, totalAmount, specialInstructions], function(err) {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }

      const orderId = this.lastID;

      // Insert order items
      let completed = 0;
      items.forEach((item, index) => {
        db.run(`
          INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, special_instructions)
          VALUES (?, ?, ?, ?, ?)
        `, [orderId, item.id, item.quantity, item.price, item.specialInstructions], (err) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }

          completed++;
          if (completed === items.length) {
            db.run('COMMIT');

          // Send new order alert to staff
          notificationService.sendNewOrderAlert(orderId);

          res.status(201).json({
            orderId,
            message: 'Order created successfully',
            totalAmount
          });
          }
        });
      });
    });
  });
});

// Get orders for a room
router.get('/orders/:roomId', (req, res) => {
  const { roomId } = req.params;

  db.all(`
    SELECT o.*, oi.quantity, oi.unit_price, oi.special_instructions,
           mi.name as item_name, mi.description as item_description
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN menu_items mi ON oi.menu_item_id = mi.id
    WHERE o.room_id = ?
    ORDER BY o.created_at DESC
  `, [roomId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Update order status
router.put('/orders/:orderId/status', async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    // Update order status in database
    const updateResult = await new Promise((resolve, reject) => {
      db.run(`
        UPDATE orders
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [status, orderId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });

    if (updateResult === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Send notification about status change
    await notificationService.sendOrderStatusNotification(orderId, status);

    res.json({ message: 'Order status updated successfully' });

  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get room information
router.get('/rooms/:roomNumber', (req, res) => {
  const { roomNumber } = req.params;

  db.get(`
    SELECT * FROM rooms WHERE room_number = ?
  `, [roomNumber], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!row) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json(row);
  });
});

module.exports = router;
