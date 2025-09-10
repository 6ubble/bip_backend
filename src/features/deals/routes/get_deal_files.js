const express = require('express');
const { authenticateToken } = require('../../../middleware/auth');
const { getDealFiles, getLatestDealFiles } = require('../utils/bitrix_deal_functions');

const router = express.Router();

// Получение всех файлов из поля ufCrm19_1757303943 для сделки
router.get('/get-deal-files/:dealId', authenticateToken, async (req, res) => {
    try {
        const { dealId } = req.params;
        const { latest } = req.query; // Параметр для получения только файлов из последнего статуса
        
        if (!dealId) {
            return res.status(400).json({ error: 'Deal ID is required' });
        }

        let files;
        
        if (latest === 'true') {
            // Получаем только файлы из последнего статуса
            files = await getLatestDealFiles(dealId);
        } else {
            // Получаем все файлы из всех статусов
            files = await getDealFiles(dealId);
        }
        
        res.json({
            dealId: dealId,
            filesCount: files.length,
            files: files
        });
        
    } catch (error) {
        console.error('Get deal files error:', error);
        res.status(500).json({ error: 'Bitrix24 request error' });
    }
});

module.exports = router;
