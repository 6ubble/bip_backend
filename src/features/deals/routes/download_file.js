const express = require('express');
const { authenticateToken } = require('../../../middleware/auth');
const { bitrixRequest } = require('../utils/bitrix_deal_functions');

const router = express.Router();

// Скачивание файла из Bitrix
router.get('/download/:fileId', authenticateToken, async (req, res) => {
    try {
        const { fileId } = req.params;
        
        if (!fileId) {
            return res.status(400).json({ error: 'File ID is required' });
        }

        // Получаем информацию о файле из Bitrix
        const fileInfo = await bitrixRequest('disk.file.get', { id: fileId });
        
        if (!fileInfo) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Получаем содержимое файла
        const fileContent = await bitrixRequest('disk.file.getcontent', { id: fileId });
        
        // Устанавливаем заголовки для скачивания
        res.setHeader('Content-Type', fileInfo.CONTENT_TYPE || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${fileInfo.NAME}"`);
        
        // Отправляем файл
        res.send(fileContent);
        
    } catch (error) {
        console.error('Download file error:', error);
        res.status(500).json({ error: 'File download error' });
    }
});

// Получение URL для просмотра файла
router.get('/view/:fileId', authenticateToken, async (req, res) => {
    try {
        const { fileId } = req.params;
        
        if (!fileId) {
            return res.status(400).json({ error: 'File ID is required' });
        }

        // Получаем информацию о файле из Bitrix
        const fileInfo = await bitrixRequest('disk.file.get', { id: fileId });
        
        if (!fileInfo) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Возвращаем URL для просмотра
        res.json({ 
            url: fileInfo.DOWNLOAD_URL || fileInfo.URL,
            name: fileInfo.NAME,
            type: fileInfo.CONTENT_TYPE
        });
        
    } catch (error) {
        console.error('Get file view URL error:', error);
        res.status(500).json({ error: 'File view error' });
    }
});

module.exports = router;
