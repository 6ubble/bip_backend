const express = require('express');
const { authenticateToken } = require('../../../middleware/auth');
const { bitrixRequest, getContactById, createDeal, addActivity } = require('../utils/bitrix_deal_functions');
const { validate, schemas } = require('../../../utils/validation');

const router = express.Router();

// GET /api/deals/get-scenarios
router.get('/get-scenarios', async (req, res) => {
    try {
        const params = {
            entityTypeId: 1054,
            filter: {
                '!=ufCrm17_1756699402': 'Y',
                'ufCrm17_1756699478': 141
            },
            select: [
                'ID',
                'title',
                'ufCrm17_1756699384', // описание
                'ufCrm17_1756699424', // CATEGORY_ID для сделки
                'ufCrm17_1756699402'
            ]
        };

        const response = await bitrixRequest('crm.item.list', params);
        const items = response.items || [];

        const scenarios = items
            .filter(item => item && item.id != null)
            .map(item => ({
                id: String(item.id),                  // topic_id для выбора темы
                title: item.title || '',
                description: item.ufCrm17_1756699384 || '',
                category_id: item.ufCrm17_1756699424 || null
            }));

        res.json(scenarios);
    } catch (error) {
        console.error('Get scenarios error:', error);
        res.status(500).json({ error: 'Bitrix24 request error' });
    }
});


router.post('/create-deal', validate(schemas.createAppeal), authenticateToken, async (req, res) => {
    try {
        const { title, comment, files, category_id } = req.body;
        const contactId = req.user.contact_id;

        if (!contactId) return res.status(400).json({ error: 'Отсутствует contact_id' });
        if (!category_id) return res.status(400).json({ error: 'Отсутствует category_id' });

        // --- Подготовка файлов для Bitrix24 ---
        const bitrixFiles = Array.isArray(files)
            ? files.filter(f => f.name && f.base64).map(f => ({
                fileData: f.base64,
                fileName: f.name
            }))
            : [];

        // --- Формируем поля сделки ---
        const dealFields = {
            TITLE: title,                // ФИО или название компании
            CONTACT_ID: contactId,
            CATEGORY_ID: category_id,    // напрямую из тела запроса
            UF_CRM_1756703320: 1,        // фиксированное значение
            COMMENTS: comment,
            UF_CRM_1716196872724: bitrixFiles,
            SOURCE_ID: 'STORE',
            OPPORTUNITY: '0',
            CURRENCY_ID: 'RUB',
            OPENED: 'Y'
        };

        // --- Создаём сделку ---
        const dealId = await createDeal(dealFields);

        // --- Получаем контакт для активности ---
        const contact = await getContactById(contactId);

        // --- Формируем активность ---
        const activityFields = {
            OWNER_TYPE_ID: 2,   // Сделка
            OWNER_ID: dealId,
            TYPE_ID: 4,         // Прочее/Звонок
            SUBJECT: 'Создано обращение',
            DESCRIPTION: comment,
            COMPLETED: 'Y',
            AUTHOR_ID: contactId
        };

        // Добавляем контактные данные
        if (contact) {
            const communications = [];
            ['PHONE', 'EMAIL'].forEach(type => {
                if (Array.isArray(contact[type])) {
                    contact[type].forEach(item => {
                        if (item?.VALUE) communications.push({ TYPE: type, VALUE: item.VALUE });
                    });
                }
            });
            if (communications.length > 0) activityFields.COMMUNICATIONS = communications;
        }

        // --- Создаём активность (не блокируем ответ при ошибке) ---
        addActivity(activityFields).catch(err => console.error('Activity creation failed:', err));

        res.json({
            deal_id: dealId.toString(),
            title,
            category_id,
            created_at: new Date().toISOString(),
            files_processed: bitrixFiles.length,
            message: `Обращение${bitrixFiles.length ? ` с ${bitrixFiles.length} файлами` : ''} успешно создано`
        });

    } catch (error) {
        console.error('Create deal error:', error);
        res.status(500).json({
            error: 'Ошибка Bitrix24',
            ...(process.env.NODE_ENV === 'development' && { details: error.message })
        });
    }
});

module.exports = router;
