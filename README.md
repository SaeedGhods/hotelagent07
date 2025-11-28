# 🏨 Hotel Room Service Agent

An AI-powered hotel room service ordering system with voice calls, SMS, and staff management dashboard. Built with Node.js, Twilio, ElevenLabs, and deployed on Render.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![Twilio](https://img.shields.io/badge/Twilio-Integrated-blue)
![ElevenLabs](https://img.shields.io/badge/ElevenLabs-TTS-orange)
![Render](https://img.shields.io/badge/Deployed%20on-Render-purple)

## ✨ Features

- **🎤 Voice Ordering**: Guests can call room service and place orders using natural speech
- **📱 SMS Ordering**: Text-based ordering for quick requests
- **🤖 AI-Powered Conversations**: Advanced AI agent using OpenAI/Grok for intelligent dialogue
- **🎯 Natural Language Processing**: Understands complex requests, preferences, and questions
- **🎵 ElevenLabs Integration**: Natural text-to-speech for voice responses
- **📊 Staff Dashboard**: Real-time order management interface
- **🏪 Menu Management**: Dynamic menu with categories and availability
- **📞 Twilio Integration**: Professional phone and SMS communications
- **🔒 Secure**: JWT authentication for staff access
- **📈 Analytics**: Order tracking and performance metrics
- **🚀 Cloud Deployment**: Ready for Render deployment

## 🤖 AI Agent Capabilities

The hotel room service agent includes an advanced AI assistant that can:

### **Conversation Intelligence**
- **Natural Dialogue**: Understands and responds to natural language requests
- **Context Awareness**: Remembers conversation history and guest preferences
- **Multi-turn Conversations**: Handles follow-up questions and clarifications
- **Smart Routing**: Escalates complex issues to human staff when needed

### **Order Processing**
- **Complex Orders**: Handles multi-item orders with special instructions
- **Menu Knowledge**: Knows ingredients, allergens, and preparation methods
- **Smart Parsing**: Extracts order details from conversational text
- **Confirmation**: Provides clear order summaries and totals

### **Guest Services**
- **Hotel Information**: Answers questions about amenities, check-out, etc.
- **Special Requests**: Handles dietary restrictions, room preferences
- **Problem Solving**: Addresses common guest concerns and complaints
- **Recommendations**: Suggests menu items based on preferences

### **Supported AI Providers**
- **OpenAI GPT-4**: Primary AI provider for conversations
- **Grok (xAI)**: Alternative AI provider (framework ready)

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Guest Calls   │    │  SMS Messages   │    │  Staff Dashboard│
│   (Twilio)      │    │  (Twilio)       │    │  (Web App)      │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                     │                      │
          └─────────────────────┼──────────────────────┘
                                │
                    ┌─────────────────┐
                    │   Hotel Agent   │
                    │   (Node.js)     │
                    │                 │
                    │ • Express API   │
                    │ • SQLite DB     │
                    │ • Voice AI      │
                    │ • Order Mgmt    │
                    └─────────┬───────┘
                              │
                    ┌─────────────────┐
                    │   ElevenLabs    │
                    │   TTS Engine    │
                    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Twilio account with phone number
- ElevenLabs account with API key
- GitHub account
- Render account (for deployment)

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/hotelagent07.git
cd hotelagent07
npm install
```

### 2. Environment Setup

Copy the environment template and configure your keys:

```bash
cp env.example .env
```

Edit `.env` with your actual values:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# ElevenLabs Configuration
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM

# JWT Secret for authentication
JWT_SECRET=your_jwt_secret_key_here

# Hotel Configuration
HOTEL_NAME=Your Hotel Name
DEFAULT_DELIVERY_TIME=45

# AI Configuration (choose one or both)
AI_PROVIDER=openai  # 'openai' or 'grok'
OPENAI_API_KEY=your_openai_api_key
GROK_API_KEY=your_grok_api_key  # For xAI Grok (future implementation)
```

### 3. Database Initialization

```bash
npm run init-db
npm run seed-db
```

### 4. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000/dashboard` for the staff interface.

## 📱 Usage

### For Guests

**Voice Ordering:**
1. Call your hotel's room service number
2. Say "room service" or wait for the automated greeting
3. Listen to the menu options
4. Place your order using natural speech (e.g., "I'd like a Caesar salad and coffee")

**SMS Ordering:**
1. Text the room service number
2. Send your order (e.g., "1 burger, 2 fries")
3. Receive confirmation with delivery time

### For Staff

1. Access the dashboard at `/dashboard`
2. View incoming orders in real-time
3. Update order status (pending → confirmed → preparing → ready → delivered)
4. Manage menu items and availability
5. View analytics and reports

## 🔧 API Endpoints

### Menu Management
- `GET /api/menu` - Get all menu items
- `GET /api/categories` - Get menu categories

### Order Management
- `POST /api/orders` - Create new order
- `GET /api/orders/:roomId` - Get orders for specific room
- `PUT /api/orders/:orderId/status` - Update order status

### Room Management
- `GET /api/rooms/:roomNumber` - Get room information

### Twilio Webhooks
- `POST /twilio/voice` - Handle incoming voice calls
- `POST /twilio/sms` - Handle SMS messages

## 📞 Twilio Configuration

### Phone Number Setup
1. Buy a phone number in your Twilio console
2. Configure voice webhook: `https://yourapp.render.com/twilio/voice`
3. Configure SMS webhook: `https://yourapp.render.com/twilio/sms`

### Voice Settings
- **Voice**: Use a clear, professional voice
- **Language**: English (US)
- **Speech Recognition**: Enable enhanced speech recognition

## 🎤 ElevenLabs Configuration

### Voice Selection
Choose a voice that's:
- Clear and professional
- Pleasant for hotel guests
- Good at handling varied speech patterns

### API Settings
- **Model**: eleven_monolingual_v1
- **Voice Settings**:
  - Stability: 0.5
  - Similarity Boost: 0.8
  - Style: 0.5

## 🚀 Deployment to Render

### 1. Connect Repository
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New" → "Web Service"
3. Connect your GitHub repository

### 2. Configure Service
```yaml
# Service Settings
Name: hotel-room-service-agent
Runtime: Node
Build Command: npm install
Start Command: npm start
```

### 3. Environment Variables
Add these secrets in Render dashboard:

#### **Core Communication:**
```
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890
ELEVENLABS_API_KEY=your_key
```

#### **AI Agent (Choose one):**
```
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your_openai_key
# GROK_API_KEY=your_grok_key  # For future xAI integration
```

#### **Security & Configuration:**
```
JWT_SECRET=your_secret
HOTEL_NAME=Your Hotel Name
DEFAULT_DELIVERY_TIME=45
```

### 4. AI Provider Setup

#### **OpenAI (Recommended):**
1. Go to [OpenAI Platform](https://platform.openai.com)
2. Sign up/Login and create API key
3. Set `AI_PROVIDER=openai` and add your `OPENAI_API_KEY`
4. The system uses GPT-4o-mini for cost-effective conversations

#### **Grok (xAI) - Future:**
- Framework ready for Grok integration
- Set `AI_PROVIDER=grok` when available
- More implementation needed for full Grok support

### 5. Database
Render will automatically create a PostgreSQL database. Update your code to use `DATABASE_URL` instead of SQLite for production.

## 🔐 Security Features

- **Helmet.js**: Security headers
- **CORS**: Cross-origin protection
- **JWT Authentication**: Staff access control
- **Input Validation**: Sanitized user inputs
- **Rate Limiting**: Prevents abuse (configurable)

## 📊 Analytics & Monitoring

### Built-in Metrics
- Order volume and revenue
- Average delivery times
- Popular menu items
- Peak ordering hours

### Monitoring
- Health check endpoint: `/health`
- Application logs in Render dashboard
- Twilio call/SMS logs

## 🛠️ Development

### Project Structure
```
hotelagent07/
├── src/
│   ├── config/
│   │   └── database.js
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   │   ├── api.js
│   │   └── twilio.js
│   ├── services/
│   │   └── elevenlabs.js
│   ├── middleware/
│   ├── utils/
│   └── app.js
├── views/
│   └── dashboard.html
├── public/
│   ├── css/
│   ├── js/
│   │   └── dashboard.js
│   └── images/
├── audio_cache/          # TTS audio files
├── data/                 # SQLite database
├── .github/
│   └── workflows/
├── Dockerfile
├── render.yaml
├── package.json
└── README.md
```

### Adding New Features

1. **Menu Items**: Add to database via dashboard or API
2. **Voice Commands**: Extend `parseOrderFromSpeech()` function
3. **Notifications**: Add email/SMS notifications in order processing
4. **Analytics**: Enhance dashboard with more metrics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

### Common Issues

**Twilio Webhooks Failing:**
- Check webhook URLs are publicly accessible
- Verify environment variables are set correctly
- Check Twilio console for error logs

**ElevenLabs TTS Not Working:**
- Verify API key is valid
- Check voice ID exists
- Monitor API usage limits

**Database Connection Issues:**
- Ensure database file has write permissions
- Check SQLite is properly installed
- Verify database schema is initialized

### Getting Help

- Check the [Issues](https://github.com/yourusername/hotelagent07/issues) page
- Review Twilio and ElevenLabs documentation
- Check Render deployment logs

## 🎯 Future Enhancements

- [ ] Multi-language support
- [ ] Integration with hotel PMS systems
- [ ] Mobile app for staff
- [ ] Advanced voice AI with conversation context
- [ ] Order history and reordering
- [ ] Integration with delivery drones/robots
- [ ] Real-time order tracking for guests
- [ ] Advanced analytics and reporting

---

**Built with ❤️ for the hospitality industry**

*Transforming hotel room service with AI-powered voice technology*
