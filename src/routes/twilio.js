const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const { VoiceResponse } = twilio.twiml;
const { db } = require('../config/database');
const elevenLabsService = require('../services/elevenlabs');
const orderProcessor = require('../services/orderProcessor');
const aiService = require('../services/aiService');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

// Store conversation context (in production, use Redis/database)
const conversationContext = new Map();

// Handle incoming voice calls
router.post('/voice', async (req, res) => {
  const twiml = new VoiceResponse();

  // Get caller information
  const from = req.body.From;
  const to = req.body.To;
  const callSid = req.body.CallSid;

  console.log(`Incoming call from ${from} to ${to}`);

  // Extract room number from the called number or ask for it
  const roomNumber = extractRoomNumber(from);

  if (roomNumber) {
    // Room number identified, get welcome message from AI
    try {
      const context = { roomNumber, callSid };
      const aiResponse = await aiService.processMessage('Hello', context);

      let welcomeMessage = aiResponse.text;

      // Use ElevenLabs for voice response if available
      if (process.env.ELEVENLABS_API_KEY) {
        const audioUrl = await elevenLabsService.generateSpeech(welcomeMessage);
        if (audioUrl) {
          twiml.play(audioUrl);
        } else {
          twiml.say(welcomeMessage);
        }
      } else {
        twiml.say(welcomeMessage);
      }

      // Store context for conversation
      conversationContext.set(callSid, {
        roomNumber,
        history: [{ role: 'assistant', content: welcomeMessage }],
        lastActivity: Date.now()
      });

    } catch (error) {
      console.error('AI welcome message error:', error);
      twiml.say('Welcome to Hotel Room Service. I understand you are calling from room ' + roomNumber + '.');
    }

    twiml.pause({ length: 1 });
    twiml.redirect('/twilio/conversation?callSid=' + callSid);
  } else {
    // Ask for room number
    twiml.say('Welcome to Hotel Room Service. Please enter your room number followed by the pound key.');
    twiml.gather({
      input: 'dtmf',
      timeout: 10,
      finishOnKey: '#',
      action: '/twilio/room-input'
    });
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

// Handle room number input
router.post('/room-input', (req, res) => {
  const twiml = new VoiceResponse();
  const digits = req.body.Digits;

  console.log(`Room number entered: ${digits}`);

  if (!digits || digits.length < 3 || digits.length > 4) {
    twiml.say('Invalid room number. Please try again.');
    twiml.redirect('/twilio/voice');
  } else {
    twiml.say(`Room ${digits} confirmed. Connecting you to room service.`);
    twiml.pause({ length: 1 });
    twiml.redirect('/twilio/menu?room=' + digits);
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

// Main conversation handler (replaces old menu endpoint)
router.post('/conversation', async (req, res) => {
  const twiml = new VoiceResponse();
  const callSid = req.query.callSid;
  const speechResult = req.body.SpeechResult;

  try {
    const context = conversationContext.get(callSid) || {};
    context.callSid = callSid;

    let responseText;
    let orderInfo = null;

    if (speechResult) {
      // Process speech with AI
      const aiResponse = await aiService.processMessage(speechResult, context);

      responseText = aiResponse.text;
      orderInfo = aiResponse.orderInfo;

      // Update conversation context
      context.history = context.history || [];
      context.history.push(
        { role: 'user', content: speechResult },
        { role: 'assistant', content: responseText }
      );
      context.lastActivity = Date.now();

      // If AI extracted order info, process it
      if (orderInfo && orderInfo.items && orderInfo.items.length > 0) {
        try {
          const orderId = await orderProcessor.createOrder(context.roomNumber, orderInfo.items);
          responseText += ` Your order number is ${orderId}. We'll start preparing it right away.`;
        } catch (orderError) {
          console.error('Order creation error:', orderError);
          responseText += ' However, there was an issue processing your order. Please try again or speak to a staff member.';
        }
      }
    } else {
      // No speech detected, ask them to speak
      responseText = 'I didn\'t catch that. Could you please repeat your request?';
    }

    // Use ElevenLabs for voice response if available
    if (process.env.ELEVENLABS_API_KEY) {
      const audioUrl = await elevenLabsService.generateSpeech(responseText);
      if (audioUrl) {
        twiml.play(audioUrl);
      } else {
        twiml.say(responseText);
      }
    } else {
      twiml.say(responseText);
    }

    // Continue the conversation
    twiml.gather({
      input: 'speech',
      timeout: 10,
      action: `/twilio/conversation?callSid=${callSid}`,
      speechTimeout: 'auto'
    });

    // Update context
    conversationContext.set(callSid, context);

  } catch (error) {
    console.error('Error in conversation:', error);
    twiml.say('I apologize, but I\'m having trouble processing your request. Please hold for a staff member.');
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

// Legacy menu endpoint (redirects to conversation)
router.post('/menu', async (req, res) => {
  const roomNumber = req.query.room;
  const callSid = `legacy_${Date.now()}_${Math.random()}`;

  // Set up context for legacy calls
  conversationContext.set(callSid, {
    roomNumber,
    history: [],
    lastActivity: Date.now()
  });

  // Redirect to conversation handler
  res.redirect(307, `/twilio/conversation?callSid=${callSid}`);
});

// Handle order placement
router.post('/order', async (req, res) => {
  const twiml = new VoiceResponse();
  const roomNumber = req.query.room;
  const speechResult = req.body.SpeechResult;

  console.log(`Order request from room ${roomNumber}: ${speechResult}`);

  try {
    // Parse speech result using enhanced order processor
    const orderItems = orderProcessor.parseOrderFromSpeech(speechResult);

    if (orderItems.length === 0) {
      twiml.say('I could not understand your order. Please try again.');
      twiml.redirect(`/twilio/menu?room=${roomNumber}`);
    } else {
      // Create order in database using order processor
      const orderId = await orderProcessor.createOrder(roomNumber, orderItems);

      let confirmationText = `Your order has been placed successfully. Order number ${orderId}. `;

      orderItems.forEach(item => {
        confirmationText += `${item.quantity} ${item.name}. `;
      });

      confirmationText += 'Your order will be delivered within 45 minutes. Thank you for choosing our room service.';

      // Use ElevenLabs for confirmation
      if (process.env.ELEVENLABS_API_KEY) {
        const audioUrl = await elevenLabsService.generateSpeech(confirmationText);
        if (audioUrl) {
          twiml.play(audioUrl);
        } else {
          twiml.say(confirmationText);
        }
      } else {
        twiml.say(confirmationText);
      }
    }

  } catch (error) {
    console.error('Error processing order:', error);
    twiml.say('Sorry, there was an error processing your order. Please try again.');
    twiml.redirect(`/twilio/menu?room=${roomNumber}`);
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

// Handle SMS messages with AI
router.post('/sms', async (req, res) => {
  const { From, Body } = req.body;
  const smsSid = req.body.SmsSid;

  console.log(`SMS from ${From}: ${Body}`);

  try {
    const roomNumber = extractRoomNumber(From);
    if (!roomNumber) {
      await sendSMS(From, 'Please call from your hotel room phone for room service orders.');
      return res.status(200).send();
    }

    // Get or create conversation context for SMS
    let context = conversationContext.get(`sms_${From}`) || {
      roomNumber,
      from: From,
      history: [],
      lastActivity: Date.now()
    };

    // Process message with AI
    const aiResponse = await aiService.processMessage(Body, context);

    let responseMessage = aiResponse.text;

    // If AI extracted order info, process it
    if (aiResponse.orderInfo && aiResponse.orderInfo.items && aiResponse.orderInfo.items.length > 0) {
      try {
        const orderId = await orderProcessor.createOrder(roomNumber, aiResponse.orderInfo.items);
        const total = aiResponse.orderInfo.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        responseMessage += ` Order #${orderId} confirmed. Total: $${total.toFixed(2)}`;
      } catch (orderError) {
        console.error('SMS order creation error:', orderError);
        responseMessage += ' However, there was an issue processing your order. Please call for assistance.';
      }
    }

    // If AI indicates human assistance needed, add note
    if (aiResponse.needsHuman) {
      responseMessage += ' A staff member will contact you shortly.';
    }

    // Send response
    await sendSMS(From, responseMessage);

    // Update conversation context
    context.history = context.history || [];
    context.history.push(
      { role: 'user', content: Body },
      { role: 'assistant', content: responseMessage }
    );
    context.lastActivity = Date.now();

    // Keep only last 10 messages to prevent memory issues
    if (context.history.length > 20) {
      context.history = context.history.slice(-20);
    }

    conversationContext.set(`sms_${From}`, context);

    // Clean up old conversations (older than 1 hour)
    cleanupOldConversations();

  } catch (error) {
    console.error('Error processing SMS:', error);
    await sendSMS(From, 'I apologize, but I\'m having trouble processing your message. Please call for assistance.');
  }

  res.status(200).send();
});

// Helper functions
function extractRoomNumber(phoneNumber) {
  // Extract last 4 digits as room number (customize based on hotel's phone system)
  const match = phoneNumber.match(/(\d{4})$/);
  return match ? match[1] : null;
}

async function sendSMS(to, message) {
  try {
    await client.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: to
    });
  } catch (error) {
    console.error('Error sending SMS:', error);
  }
}

// Clean up old conversation contexts to prevent memory leaks
function cleanupOldConversations() {
  const oneHourAgo = Date.now() - (60 * 60 * 1000); // 1 hour ago

  for (const [key, context] of conversationContext.entries()) {
    if (context.lastActivity < oneHourAgo) {
      conversationContext.delete(key);
    }
  }
}

// Clean up conversations every 30 minutes
setInterval(cleanupOldConversations, 30 * 60 * 1000);

module.exports = router;
