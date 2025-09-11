const express = require('express');
const { authenticateToken } = require('../../../middleware/auth');
const { createSmartProcessItem } = require('../utils/bitrix_deal_functions');

const router = express.Router();

// Отправка ответа на обращение через создание элемента смарт-процесса
router.post('/send-reply', authenticateToken, async (req, res) => {
    try {
        const { dealId, message, files } = req.body;

        // Валидация обязательных полей
        if (!dealId) {
            return res.status(400).json({ error: 'Deal ID is required' });
        }

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message is required' });
        }

        if (message.length > 1500) {
            return res.status(400).json({ error: 'Message too long (max 1500 characters)' });
        }

        // Создаем элемент смарт-процесса
        const itemId = await createSmartProcessItem(dealId, message.trim(), files || []);

        res.status(200).json({
            success: true,
            itemId: itemId,
            message: 'Ответ успешно отправлен',
            dealId: dealId,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Send reply error:', error);
        res.status(500).json({
            error: 'Ошибка отправки ответа',
            message: 'Попробуйте еще раз позже'
        });
    }
});

module.exports = router;
