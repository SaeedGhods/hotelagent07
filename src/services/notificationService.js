const twilio = require('twilio');
const { db } = require('../config/database');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

/**
 * Notification service for order status updates and alerts
 */
class NotificationService {
  constructor() {
    this.notificationHistory = new Map(); // Cache for notification history
  }

  /**
   * Send order status update notification
   * @param {number} orderId - Order ID
   * @param {string} newStatus - New order status
   * @param {Object} options - Additional options
   */
  async sendOrderStatusNotification(orderId, newStatus, options = {}) {
    try {
      // Get order details with room information
      const orderDetails = await this.getOrderDetails(orderId);
      if (!orderDetails) {
        console.error(`Order ${orderId} not found for notification`);
        return;
      }

      const { room_number, guest_name, total_amount, room_phone } = orderDetails;

      // Prepare notification message
      const message = this.formatStatusMessage(newStatus, orderId, total_amount, options);

      // Send SMS notification if room has phone
      if (room_phone && twilioPhoneNumber) {
        await this.sendSMS(room_phone, message);
        console.log(`Status notification sent to room ${room_number} for order ${orderId}`);
      }

      // Log notification
      await this.logNotification(orderId, 'sms', newStatus, message, room_phone);

      // Additional notifications based on status
      await this.sendStatusSpecificNotifications(orderId, newStatus, orderDetails);

    } catch (error) {
      console.error('Error sending order status notification:', error);
    }
  }

  /**
   * Send new order alert to staff
   * @param {number} orderId - Order ID
   * @param {Array} staffPhones - Array of staff phone numbers
   */
  async sendNewOrderAlert(orderId, staffPhones = []) {
    try {
      const orderDetails = await this.getOrderDetails(orderId);
      if (!orderDetails) return;

      const message = `🆕 New order #${orderId} from room ${orderDetails.room_number} (${orderDetails.guest_name}). Total: $${orderDetails.total_amount.toFixed(2)}`;

      // Send to configured staff phones or use default
      const phones = staffPhones.length > 0 ? staffPhones : [process.env.STAFF_ALERT_PHONE];

      for (const phone of phones) {
        if (phone) {
          await this.sendSMS(phone, message);
        }
      }

      console.log(`New order alert sent for order ${orderId}`);

    } catch (error) {
      console.error('Error sending new order alert:', error);
    }
  }

  /**
   * Send delivery reminder
   * @param {number} orderId - Order ID
   */
  async sendDeliveryReminder(orderId) {
    try {
      const orderDetails = await this.getOrderDetails(orderId);
      if (!orderDetails) return;

      const message = `🚚 Reminder: Order #${orderId} ready for delivery to room ${orderDetails.room_number}. Please deliver within 10 minutes.`;

      // Send to delivery staff
      const deliveryPhone = process.env.DELIVERY_STAFF_PHONE || process.env.STAFF_ALERT_PHONE;
      if (deliveryPhone) {
        await this.sendSMS(deliveryPhone, message);
        console.log(`Delivery reminder sent for order ${orderId}`);
      }

    } catch (error) {
      console.error('Error sending delivery reminder:', error);
    }
  }

  /**
   * Send order completion confirmation
   * @param {number} orderId - Order ID
   */
  async sendOrderCompletionConfirmation(orderId) {
    try {
      const orderDetails = await this.getOrderDetails(orderId);
      if (!orderDetails) return;

      const message = `✅ Thank you for choosing our room service! Order #${orderId} has been delivered. We hope you enjoyed your meal!`;

      if (orderDetails.room_phone) {
        await this.sendSMS(orderDetails.room_phone, message);
        console.log(`Completion confirmation sent for order ${orderId}`);
      }

    } catch (error) {
      console.error('Error sending completion confirmation:', error);
    }
  }

  /**
   * Send status-specific notifications
   * @param {number} orderId - Order ID
   * @param {string} status - Order status
   * @param {Object} orderDetails - Order details
   */
  async sendStatusSpecificNotifications(orderId, status, orderDetails) {
    switch (status) {
      case 'confirmed':
        // Send preparation started alert to kitchen
        const kitchenPhone = process.env.KITCHEN_STAFF_PHONE;
        if (kitchenPhone) {
          const message = `👨‍🍳 Order #${orderId} confirmed. Room ${orderDetails.room_number}. Start preparation.`;
          await this.sendSMS(kitchenPhone, message);
        }
        break;

      case 'ready':
        // Send delivery notification
        await this.sendDeliveryReminder(orderId);
        break;

      case 'delivered':
        // Send completion confirmation
        setTimeout(() => {
          this.sendOrderCompletionConfirmation(orderId);
        }, 5 * 60 * 1000); // 5 minutes after delivery
        break;

      case 'cancelled':
        // Notify all relevant staff
        const cancelMessage = `❌ Order #${orderId} from room ${orderDetails.room_number} has been cancelled.`;
        const phones = [
          process.env.KITCHEN_STAFF_PHONE,
          process.env.DELIVERY_STAFF_PHONE,
          process.env.STAFF_ALERT_PHONE
        ].filter(Boolean);

        for (const phone of phones) {
          await this.sendSMS(phone, cancelMessage);
        }
        break;
    }
  }

  /**
   * Format status message for guest notification
   * @param {string} status - Order status
   * @param {number} orderId - Order ID
   * @param {number} totalAmount - Order total
   * @param {Object} options - Additional options
   * @returns {string} - Formatted message
   */
  formatStatusMessage(status, orderId, totalAmount, options = {}) {
    const messages = {
      'pending': `📝 Order #${orderId} received. We'll confirm shortly.`,
      'confirmed': `✅ Order #${orderId} confirmed! Estimated preparation time: ${options.estimatedTime || '30 minutes'}.`,
      'preparing': `👨‍🍳 Order #${orderId} is being prepared. We'll notify you when ready.`,
      'ready': `🚚 Order #${orderId} is ready for delivery! Our staff will bring it to your room shortly.`,
      'delivered': `✅ Order #${orderId} has been delivered. Enjoy your meal!`,
      'cancelled': `❌ Order #${orderId} has been cancelled. Please contact us if you have questions.`
    };

    return messages[status] || `📋 Order #${orderId} status: ${status}`;
  }

  /**
   * Send SMS message
   * @param {string} to - Recipient phone number
   * @param {string} message - Message content
   */
  async sendSMS(to, message) {
    try {
      if (!accountSid || !authToken || !twilioPhoneNumber) {
        console.warn('Twilio credentials not configured, skipping SMS');
        return;
      }

      await client.messages.create({
        body: message,
        from: twilioPhoneNumber,
        to: to
      });

      console.log(`SMS sent to ${to}: ${message.substring(0, 50)}...`);

    } catch (error) {
      console.error('Error sending SMS:', error);
      throw error;
    }
  }

  /**
   * Get order details with room information
   * @param {number} orderId - Order ID
   * @returns {Object|null} - Order details or null
   */
  async getOrderDetails(orderId) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT
          o.id, o.total_amount, o.status,
          r.room_number, r.guest_name, r.phone_number as room_phone
        FROM orders o
        JOIN rooms r ON o.room_id = r.id
        WHERE o.id = ?
      `, [orderId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Log notification in database
   * @param {number} orderId - Order ID
   * @param {string} type - Notification type (sms, email, etc.)
   * @param {string} status - Order status that triggered notification
   * @param {string} message - Notification message
   * @param {string} recipient - Recipient contact info
   */
  async logNotification(orderId, type, status, message, recipient) {
    return new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO notifications (order_id, type, status, message, recipient, sent_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [orderId, type, status, message, recipient], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  /**
   * Get notification history for order
   * @param {number} orderId - Order ID
   * @returns {Array} - Notification history
   */
  async getNotificationHistory(orderId) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT * FROM notifications
        WHERE order_id = ?
        ORDER BY sent_at DESC
      `, [orderId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Send bulk notifications (for system alerts, etc.)
   * @param {Array} recipients - Array of phone numbers
   * @param {string} message - Message to send
   */
  async sendBulkNotifications(recipients, message) {
    const promises = recipients.map(phone => this.sendSMS(phone, message));
    await Promise.allSettled(promises);
    console.log(`Bulk notification sent to ${recipients.length} recipients`);
  }

  /**
   * Schedule delayed notification
   * @param {number} orderId - Order ID
   * @param {string} type - Notification type
   * @param {number} delayMinutes - Delay in minutes
   */
  scheduleNotification(orderId, type, delayMinutes) {
    setTimeout(async () => {
      try {
        switch (type) {
          case 'delivery_reminder':
            await this.sendDeliveryReminder(orderId);
            break;
          case 'completion_confirmation':
            await this.sendOrderCompletionConfirmation(orderId);
            break;
        }
      } catch (error) {
        console.error(`Error sending scheduled ${type} notification:`, error);
      }
    }, delayMinutes * 60 * 1000);
  }
}

module.exports = new NotificationService();
