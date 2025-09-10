const express = require('express');
const { authenticateToken } = require('../../../middleware/auth');
const { getAppealDetails } = require('../utils/bitrix_deal_functions');

const router = express.Router();

router.get('/get-appeal-details/:dealId', authenticateToken, async (req, res) => {
    try {
        const { dealId } = req.params;
        
        if (!dealId) {
            return res.status(400).json({ error: 'Deal ID is required' });
        }

        const appealDetails = await getAppealDetails(dealId);
        
        res.json(appealDetails);
    } catch (error) {
        console.error('Get appeal details error:', error);
        res.status(500).json({ error: 'Bitrix24 request error' });
    }
});

module.exports = router;
