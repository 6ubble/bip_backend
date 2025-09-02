const express = require('express');
const { 
    getDeals, 
    getDealCategories, 
    getStagesForCategory, 
    getContactById,
    createDealWithFiles, 
    addActivityWithFiles 
} = require('../utils/bitrix_deal_functions');
const { authenticateToken } = require('../../../middleware/auth');
const { validate, schemas } = require('../../../utils/validation');

const router = express.Router();

// Получение сделок пользователя
router.get('/get-deals', authenticateToken, async (req, res) => {
    try {
        const contactId = req.user.contact_id;
        if (!contactId) {
            return res.status(422).json({ error: 'contact_id missing in token' });
        }

        // Параллельно получаем категории и сделки
        const [categories, deals] = await Promise.all([
            getDealCategories(),
            getDeals(contactId, 'N')
        ]);

        // Создаем карту категорий
        const categoryMap = categories.reduce((map, cat) => {
            map[cat.id] = cat.name;
            return map;
        }, {});

        // Обрабатываем сделки параллельно
        const dealsWithStages = await Promise.all(
            deals.map(async (deal) => {
                const categoryId = deal.CATEGORY_ID || '0';
                const stages = await getStagesForCategory(categoryId);

                return {
                    id: deal.ID,
                    title: deal.TITLE || `Сделка #${deal.ID}`,
                    category_id: categoryId,
                    category_name: categoryMap[categoryId] || 'Неизвестная воронка',
                    stage_id: deal.STAGE_ID,
                    stage_name: stages[deal.STAGE_ID]?.NAME || deal.STAGE_ID,
                    opportunity: deal.OPPORTUNITY || '0',
                    created_at: deal.DATE_CREATE
                };
            })
        );

        res.json(dealsWithStages);
    } catch (error) {
        console.error('Get deals error:', error);
        res.status(500).json({ error: 'Bitrix24 request error' });
    }
});

// Получение воронок и стадий
router.get('/stages', async (req, res) => {
    try {
        const categories = await getDealCategories();
        
        const funnelsWithStages = await Promise.all(
            categories.map(async (category) => {
                const stages = await getStagesForCategory(category.id.toString());
                
                return {
                    id: category.id.toString(),
                    title: category.title,
                    stages: Object.entries(stages).map(([stageId, stageData]) => ({
                        id: stageId,
                        name: stageData.NAME
                    }))
                };
            })
        );

        res.json(funnelsWithStages);
    } catch (error) {
        console.error('Get stages error:', error);
        res.status(500).json({ error: 'Bitrix24 request error' });
    }
});

// Создание сделки с файлами
router.post('/create', validate(schemas.createAppeal), authenticateToken, async (req, res) => {
    try {
        const { title, comment, files, category_id } = req.body;
        const contactId = req.user.contact_id;

        if (!contactId) {
            return res.status(400).json({ error: 'Отсутствует contact_id' });
        }

        // Валидация категории и получение стадий параллельно
        const [categories, stages] = await Promise.all([
            getDealCategories(),
            getStagesForCategory(category_id)
        ]);

        const categoryIds = categories.map(cat => cat.id.toString());
        if (!categoryIds.includes(category_id)) {
            return res.status(400).json({ error: 'Неверный ID категории' });
        }

        const stageIds = Object.keys(stages);
        if (stageIds.length === 0) {
            return res.status(400).json({ error: 'Нет доступных стадий для категории' });
        }

        // Валидация и фильтрация файлов
        const validFiles = (files || [])
            .filter(file => {
                if (!file.name || !file.base64) return false;
                
                const sizeInMB = (file.base64.length * 3) / 4 / (1024 * 1024);
                if (sizeInMB > 50) {
                    console.warn(`File ${file.name} too large: ${sizeInMB.toFixed(2)}MB`);
                    return false;
                }
                return true;
            });

        // Поля сделки
        const dealFields = {
            TITLE: title,
            CONTACT_ID: contactId,
            STAGE_ID: stageIds[0],
            CATEGORY_ID: category_id,
            COMMENTS: comment,
            OPPORTUNITY: '0',
            CURRENCY_ID: 'RUB',
            OPENED: 'Y'
        };

        // Создаем сделку и получаем контакт параллельно
        const [dealId, contact] = await Promise.all([
            createDealWithFiles(dealFields, validFiles),
            getContactById(contactId)
        ]);

        // Подготовка активности
        const activityFields = {
            OWNER_TYPE_ID: 2,
            OWNER_ID: dealId,
            TYPE_ID: 4,
            SUBJECT: 'Создано обращение',
            DESCRIPTION: comment,
            COMPLETED: 'Y',
            AUTHOR_ID: contactId
        };

        // Добавляем контактную информацию
        if (contact) {
            const communications = [];
            
            ['PHONE', 'EMAIL'].forEach(type => {
                if (Array.isArray(contact[type])) {
                    contact[type].forEach(item => {
                        if (item?.VALUE) {
                            communications.push({ TYPE: type, VALUE: item.VALUE });
                        }
                    });
                }
            });
            
            if (communications.length > 0) {
                activityFields.COMMUNICATIONS = communications;
            }
        }

        // Создаем активность (не блокируем ответ при ошибке)
        addActivityWithFiles(activityFields, validFiles).catch(error => {
            console.error('Activity creation failed:', error.message);
        });

        res.json({
            deal_id: dealId.toString(),
            title,
            stage_name: stages[stageIds[0]].NAME,
            created_at: new Date().toISOString(),
            files_processed: validFiles.length,
            message: `Обращение${validFiles.length ? ` с ${validFiles.length} файлами` : ''} успешно создано`
        });

    } catch (error) {
        console.error('Create appeal error:', error);
        res.status(500).json({ 
            error: 'Ошибка Bitrix24',
            ...(process.env.NODE_ENV === 'development' && { details: error.message })
        });
    }
});

module.exports = router;