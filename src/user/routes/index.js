const express = require('express');
const db = require('../../config/database');
const { authenticateToken } = require('../../middleware/auth');

const router = express.Router();

router.get('/get-info', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'Невалидный токен' });
    }

    const users = await db.query(
      `SELECT id, user_type, role, first_name, second_name, last_name,
              phone, email, contact_id, company_id, balance, created_at
       FROM users WHERE id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const user = users[0];

    let companyInfo = null;
    if (user.user_type === 'legal' && user.company_id) {
      const companies = await db.query(
        'SELECT id, name, inn, balance FROM companies WHERE id = ?',
        [user.company_id]
      );
      companyInfo = companies[0] || null;
    }

    const responseData = {
      id: user.id,
      user_type: user.user_type,
      role: user.role,
      first_name: user.first_name,
      second_name: user.second_name,
      last_name: user.last_name,
      phone: user.phone,
      email: user.email,
      contact_id: user.contact_id,
      balance: parseFloat(user.balance),
      created_at: user.created_at ? user.created_at.toISOString() : null
    };

    if (user.user_type === 'legal') {
      responseData.company_id = user.company_id;
    }

    if (companyInfo) {
      responseData.company = {
        id: companyInfo.id,
        name: companyInfo.name,
        inn: companyInfo.inn,
        balance: parseFloat(companyInfo.balance)
      };
    }

    res.json(responseData);

  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({ error: 'Непредвиденная ошибка' });
  }
});

module.exports = router;