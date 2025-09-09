const express = require('express');
const { authenticateToken } = require('../../../middleware/auth');
const { getDeals } = require('../utils/bitrix_deal_functions');

const router = express.Router();

router.get('/get-deals', authenticateToken, async (req, res) => {
    try {
        const contactId = req.user.contact_id;
        if (!contactId) return res.status(422).json({ error: 'contact_id missing in token' });

        const deals = await getDeals(contactId, 'N'); // просто один промис

        const dealsData = deals.map(deal => ({
            id: deal.ID || deal.Id || null,
            title: deal.TITLE || `Сделка #${deal.ID || deal.Id || 'unknown'}`,
            category_id: deal.CATEGORY_ID || null,
            stage: deal.STAGE_ID || null,   // просто возвращаем Stage ID, стадий больше нет
            opportunity: deal.OPPORTUNITY || '0',
            created_at: deal.DATE_CREATE || null
        }));

        res.json(dealsData);
    } catch (error) {
        console.error('Get deals error:', error);
        res.status(500).json({ error: 'Bitrix24 request error' });
    }
});

module.exports = router;
