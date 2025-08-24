const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

class Database {
  constructor() {
    this.pool = null;
    this.init();
  }

  async init() {
    try {
      const caCertPath = path.join(__dirname, '../../ca.crt');
      
      let sslConfig = false;
      if (fs.existsSync(caCertPath)) {
        sslConfig = {
          ca: fs.readFileSync(caCertPath),
          rejectUnauthorized: true
        };
        console.log('SSL certificate found, using secure connection');
      } else {
        console.log('SSL certificate not found, using non-SSL connection');
      }

      this.pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: sslConfig,
        connectionLimit: 10,
        queueLimit: 0
      });

      const connection = await this.pool.getConnection();
      console.log('Database connected successfully');
      
      if (sslConfig) {
        try {
          const [rows] = await connection.execute("SHOW STATUS LIKE 'Ssl_cipher'");
          if (rows[0] && rows[0].Value) {
            console.log(`SSL connection established. Cipher: ${rows[0].Value}`);
          }
        } catch (sslError) {
          console.log('SSL status check failed, but connection established');
        }
      }
      
      connection.release();
    } catch (error) {
      console.error('Database connection error:', error);
    }
  }

  async query(sql, params = []) {
    try {
      if (!this.pool) {
        throw new Error('Database not initialized');
      }
      const [rows] = await this.pool.execute(sql, params);
      return rows;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  async getConnection() {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }
    return await this.pool.getConnection();
  }
}

module.exports = new Database();