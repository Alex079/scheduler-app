const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./src/server/routes/auth');
const eventRoutes = require('./src/server/routes/events');
const { initializeDatabase } = require('./src/server/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
initializeDatabase();

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);

// Serve static React frontend
const staticPath = path.join(__dirname, 'src/client/dist');
app.use(express.static(staticPath));

// Fallback to index.html for React routing
app.get('*', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
