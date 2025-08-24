require('dotenv').config();

const config = {
  jwt: {
    secret: process.env.SECRET_KEY,
    algorithm: 'HS256',
    expiresIn: '15m'
  },
  bitrix: {
    domain: process.env.BITRIX_DOMAIN,
    token: process.env.BITRIX_TOKEN
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  },
  cors: {
    origins: [
      'http://localhost:5173',
      'http://localhost:3000'
    ]
  }
};

// Check required environment variables
const requiredVars = [
  'SECRET_KEY',
  'BITRIX_DOMAIN', 
  'BITRIX_TOKEN',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME'
];

const missingVars = requiredVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

module.exports = config;