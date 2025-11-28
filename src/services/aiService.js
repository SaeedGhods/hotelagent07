const OpenAI = require('openai');

// AI Service for enhanced conversation and order processing
class AIService {
  constructor() {
    this.openai = null;
    this.provider = process.env.AI_PROVIDER || 'openai'; // 'openai' or 'grok'

    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }

    // System prompt for hotel agent
    this.systemPrompt = `You are a professional hotel room service concierge AI assistant.

Your role is to help guests with their room service orders and hotel inquiries. You should be:
- Polite, welcoming, and professional
- Efficient and helpful
- Knowledgeable about hotel services
- Able to handle complex or special requests

Key capabilities:
1. Take food and beverage orders
2. Answer questions about menu items, ingredients, preparation
3. Handle special dietary requirements and allergies
4. Provide information about hotel services (spa, gym, checkout, etc.)
5. Manage multi-turn conversations and remember context
6. Suggest alternatives when items are unavailable
7. Confirm orders and provide delivery estimates

Always be concise but friendly in your responses. If you need clarification, ask specific questions.
For orders, clearly list items, quantities, and any special instructions.`;
  }

  /**
   * Process a guest message and return AI response
   * @param {string} message - Guest's message
   * @param {Object} context - Conversation context (previous messages, room info, etc.)
   * @returns {Object} - Response with text and any extracted order info
   */
  async processMessage(message, context = {}) {
    try {
      if (!this.openai && this.provider === 'openai') {
        return {
          text: "I'm sorry, but AI services are currently unavailable. Please call back or text your order details.",
          orderInfo: null,
          needsHuman: true
        };
      }

      const messages = this.buildConversationHistory(message, context);

      const response = await this.callAI(messages);

      // Parse the response for order information
      const orderInfo = this.extractOrderInfo(response);

      return {
        text: response,
        orderInfo: orderInfo,
        needsHuman: this.needsHumanAssistance(response),
        confidence: this.calculateConfidence(response, message)
      };

    } catch (error) {
      console.error('AI Service Error:', error);
      return {
        text: "I apologize, but I'm having trouble processing your request. A staff member will assist you shortly.",
        orderInfo: null,
        needsHuman: true,
        error: error.message
      };
    }
  }

  /**
   * Build conversation history for context
   * @param {string} currentMessage - Current user message
   * @param {Object} context - Previous context
   * @returns {Array} - Message history for AI
   */
  buildConversationHistory(currentMessage, context) {
    const messages = [
      { role: 'system', content: this.systemPrompt }
    ];

    // Add room context
    if (context.roomNumber) {
      messages.push({
        role: 'system',
        content: `Current guest is in room ${context.roomNumber}. ${context.guestName ? `Guest name: ${context.guestName}.` : ''}`
      });
    }

    // Add previous conversation history (last few messages)
    if (context.history && Array.isArray(context.history)) {
      const recentHistory = context.history.slice(-6); // Last 6 messages for context
      messages.push(...recentHistory);
    }

    // Add current user message
    messages.push({ role: 'user', content: currentMessage });

    return messages;
  }

  /**
   * Call the appropriate AI service
   * @param {Array} messages - Conversation messages
   * @returns {string} - AI response
   */
  async callAI(messages) {
    if (this.provider === 'grok') {
      return await this.callGrok(messages);
    } else {
      return await this.callOpenAI(messages);
    }
  }

  /**
   * Call OpenAI API
   * @param {Array} messages - Conversation messages
   * @returns {string} - AI response
   */
  async callOpenAI(messages) {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini', // Cost-effective model
      messages: messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    return completion.choices[0].message.content;
  }

  /**
   * Call Grok API (xAI)
   * @param {Array} messages - Conversation messages
   * @returns {string} - AI response
   */
  async callGrok(messages) {
    // Note: Grok API integration would go here
    // This is a placeholder - you'd need to implement Grok API calls
    // For now, fall back to OpenAI
    console.log('Grok integration not implemented yet, using OpenAI fallback');
    return await this.callOpenAI(messages);
  }

  /**
   * Extract order information from AI response
   * @param {string} response - AI response text
   * @returns {Object|null} - Extracted order information
   */
  extractOrderInfo(response) {
    // Look for order patterns in the response
    const orderPatterns = [
      /order.*?:?\s*(.+?)(?:\n|$)/i,
      /I'll place an order for:?\s*(.+?)(?:\n|$)/i,
      /Your order includes:?\s*(.+?)(?:\n|$)/i
    ];

    for (const pattern of orderPatterns) {
      const match = response.match(pattern);
      if (match) {
        return {
          items: this.parseOrderItems(match[1]),
          rawText: match[1]
        };
      }
    }

    return null;
  }

  /**
   * Parse order items from text
   * @param {string} orderText - Text describing order items
   * @returns {Array} - Parsed order items
   */
  parseOrderItems(orderText) {
    const items = [];
    const lines = orderText.split('\n');

    for (const line of lines) {
      // Look for patterns like "2 Caesar Salads" or "- 1 Coffee"
      const itemMatch = line.match(/^[-•*]?\s*(\d+)\s+(.+?)(?:\s*[-$]\s*[\d.]+)?$/i);
      if (itemMatch) {
        const quantity = parseInt(itemMatch[1]);
        const itemName = itemMatch[2].trim();

        // Try to match with menu items (simplified)
        const menuItem = this.findMenuItemByName(itemName);
        if (menuItem) {
          items.push({
            id: menuItem.id,
            name: menuItem.name,
            quantity: quantity,
            price: menuItem.price
          });
        }
      }
    }

    return items;
  }

  /**
   * Find menu item by fuzzy name matching
   * @param {string} name - Item name to search for
   * @returns {Object|null} - Menu item or null
   */
  findMenuItemByName(name) {
    // This would integrate with the order processor's menu data
    // For now, return a placeholder
    const menuItems = [
      { id: 1, name: 'Caesar Salad', price: 12.99 },
      { id: 2, name: 'Buffalo Wings', price: 14.99 },
      { id: 3, name: 'Grilled Salmon', price: 24.99 },
      { id: 4, name: 'Ribeye Steak', price: 32.99 },
      { id: 5, name: 'Chicken Parmesan', price: 18.99 },
      { id: 8, name: 'Coffee', price: 3.99 },
      { id: 9, name: 'Soda', price: 2.99 }
    ];

    const searchName = name.toLowerCase();
    return menuItems.find(item =>
      item.name.toLowerCase().includes(searchName) ||
      searchName.includes(item.name.toLowerCase())
    ) || null;
  }

  /**
   * Determine if the response indicates human assistance is needed
   * @param {string} response - AI response
   * @returns {boolean} - Whether human assistance is needed
   */
  needsHumanAssistance(response) {
    const humanTriggers = [
      'staff member',
      'manager',
      'supervisor',
      'human assistance',
      'speak to someone',
      'transfer',
      'escalate'
    ];

    return humanTriggers.some(trigger =>
      response.toLowerCase().includes(trigger)
    );
  }

  /**
   * Calculate confidence in the AI response
   * @param {string} response - AI response
   * @param {string} originalMessage - Original user message
   * @returns {number} - Confidence score (0-1)
   */
  calculateConfidence(response, originalMessage) {
    // Simple confidence calculation
    let confidence = 0.8; // Base confidence

    // Reduce confidence if response is very short or generic
    if (response.length < 50) confidence -= 0.2;
    if (response.includes('I\'m sorry') || response.includes('unable')) confidence -= 0.3;

    // Increase confidence if response includes specific details
    if (response.includes('$') || response.includes('order') || response.includes('menu')) {
      confidence += 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Generate a welcome message for new conversations
   * @param {Object} context - Room/guest context
   * @returns {string} - Welcome message
   */
  getWelcomeMessage(context = {}) {
    const timeOfDay = this.getTimeOfDay();
    const roomInfo = context.roomNumber ? ` from room ${context.roomNumber}` : '';

    return `Good ${timeOfDay}${roomInfo}! Welcome to ${process.env.HOTEL_NAME || 'our hotel'} room service. I'm here to help you with your dining needs. Would you like to hear our menu or place an order?`;
  }

  /**
   * Get time of day greeting
   * @returns {string} - Time-appropriate greeting
   */
  getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }

  /**
   * Check if AI service is available
   * @returns {boolean} - Whether AI is configured and working
   */
  async isAvailable() {
    try {
      if (this.provider === 'openai' && !process.env.OPENAI_API_KEY) {
        return false;
      }

      // Test with a simple query
      const testResponse = await this.processMessage('Hello', {});
      return testResponse && !testResponse.error;

    } catch (error) {
      console.error('AI availability check failed:', error);
      return false;
    }
  }
}

module.exports = new AIService();
