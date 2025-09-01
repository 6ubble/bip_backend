require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

// Импорт роутов
const authRoutes = require('./src/features/auth/routes');
const userRoutes = require('./src/features/user/routes');
const dealsRoutes = require('./src/features/deals/routes');
const transactionsRoutes = require('./src/features/transactions/routes');
const personalAccountRoutes = require('./src/features/personal-account/');

const app = express();
const PORT = process.env.PORT || 8000;


// Миддлвары
app.use(helmet());
app.use(morgan('combined'));
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


// Руты
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/deals', dealsRoutes);
app.use('/transactions', transactionsRoutes);
app.use('/personal_account', personalAccountRoutes);

app.get('/api', (req, res) => {
  res.json({
    message: 'BIP API is running on Node.js',
    version: '1.0.0',
    endpoints: {
      auth: '/auth',
      user: '/user',
      deals: '/deals',
      transactions: '/transactions',
      personal_account: '/personal_account',
      chat: '/chat'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});