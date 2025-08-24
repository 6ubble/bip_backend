const express = require('express');
const db = require('../../config/database');
const { authenticateToken } = require('../../middleware/auth');

const router = express.Router();

router.get('/get-transactions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'Невалидный токен' });
    }

    const transactions = await db.query(
      'SELECT id, amount, transaction_type, created_at FROM transactions WHERE user_id = ?',
      [userId]
    );

    if (transactions.length === 0) {
      return res.json({ transactions: [] });
    }

    const responseData = {
      transactions: transactions.map(tx => ({
        id: tx.id,
        amount: parseFloat(tx.amount),
        transaction_type: tx.transaction_type,
        created_at: tx.created_at.toISOString()
      }))
    };

    res.json(responseData);

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Ошибка базы данных' });
  }
});

module.exports = router;