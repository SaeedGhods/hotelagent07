require('dotenv').config();
const app = require('./src/app');
const { initDatabase } = require('./src/config/database');

const PORT = process.env.PORT || 3000;

// Initialize database and start server
async function startServer() {
  try {
    console.log('Initializing database...');
    console.log('DATABASE_URL present:', !!process.env.DATABASE_URL);

    await initDatabase();
    console.log('Database initialized successfully');

    // Start the server
    const server = app.listen(PORT, () => {
      console.log(`Hotel Room Service Agent running on port ${PORT}`);
      console.log(`Staff dashboard: http://localhost:${PORT}/dashboard`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Handle server errors
    server.on('error', (error) => {
      console.error('Server error:', error);
      process.exit(1);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    console.error('Error details:', error.message);

    // Try to start server anyway for debugging
    console.log('Attempting to start server without database...');
    try {
      app.listen(PORT, () => {
        console.log(`Server started on port ${PORT} (database failed)`);
      });
    } catch (serverError) {
      console.error('Failed to start server even without database:', serverError);
      process.exit(1);
    }
  }
}

startServer();
