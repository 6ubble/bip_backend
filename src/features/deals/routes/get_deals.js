const express = require('express');
const { authenticateToken } = require('../../../middleware/auth');
const { getDeals, canReplyToAppeal, getDealStages } = require('../utils/get_deals_utils');

const router = express.Router();

router.get('/get-deals', authenticateToken, async (req, res) => {
    try {
        const contactId = req.user.contact_id;
        if (!contactId) return res.status(422).json({ error: 'contact_id missing in token' });

        const deals = await getDeals(contactId, 'N'); // просто один промис

        // Обрабатываем сделки и проверяем возможность ответа для каждой
        const dealsData = await Promise.all(deals.map(async (deal) => {
            const dealId = deal.ID || deal.Id || null;
            const canReply = dealId ? await canReplyToAppeal(dealId) : false;
            return {
                id: dealId,
                title: deal.TITLE || `Сделка #${dealId || 'unknown'}`,
                category_id: deal.CATEGORY_ID || null,
                info: await getDealStages(dealId) || null,
                opportunity: deal.OPPORTUNITY || '0',
                created_at: deal.DATE_CREATE || null,
                can_reply: canReply // Добавляем информацию о возможности ответа
            };

        }));



        res.json(dealsData);
    } catch (error) {
        console.error('Get deals error:', error);
        res.status(500).json({ error: 'Bitrix24 request error' });
    }
});

module.exports = router;
