const express = require('express');
const bitrixService = require('../../services/bitrix');
const { authenticateToken } = require('../../middleware/auth');
const { validate, schemas } = require('../../utils/validation');

const router = express.Router();

router.get('/get-deals', authenticateToken, async (req, res) => {
  try {
    const contactId = req.user.contact_id;
    if (!contactId) {
      return res.status(422).json({ error: 'contact_id missing in token' });
    }

    const deals = await bitrixService.getDeals(contactId);
    
    for (const deal of deals) {
      const stages = await bitrixService.getStagesForCategory(deal.CATEGORY_ID);
      const stageName = stages[deal.STAGE_ID]?.NAME || deal.STAGE_ID;
      deal.STAGE_NAME = stageName;
    }

    res.json(deals);

  } catch (error) {
    console.error('Get deals error:', error);
    res.status(500).json({ error: 'Bitrix24 request error' });
  }
});

router.get('/current', authenticateToken, async (req, res) => {
  try {
    const contactId = req.user.contact_id;
    if (!contactId) {
      return res.status(422).json({ error: 'contact_id missing in token' });
    }

    const categories = await bitrixService.getDealCategories();
    const categoryMap = {};
    categories.forEach(category => {
      categoryMap[category.id] = category.name;
    });

    const deals = await bitrixService.getDeals(contactId, 'N');

    const result = [];
    for (const deal of deals) {
      const categoryId = deal.CATEGORY_ID || '0';
      const stages = await bitrixService.getStagesForCategory(categoryId);
      
      result.push({
        id: deal.ID,
        title: deal.TITLE,
        category_id: categoryId,
        category_name: categoryMap[categoryId] || 'Неизвестная воронка',
        stage_id: deal.STAGE_ID,
        stage_name: stages[deal.STAGE_ID]?.NAME || deal.STAGE_ID,
        opportunity: deal.OPPORTUNITY || '0',
        created_at: deal.DATE_CREATE
      });
    }

    res.json(result);

  } catch (error) {
    console.error('Get current deals error:', error);
    res.status(500).json({ error: 'Bitrix24 request error' });
  }
});

router.get('/stages', async (req, res) => {
  try {
    const categories = await bitrixService.getDealCategories();
    const funnels = [];
    
    for (const category of categories) {
      const categoryId = category.id.toString();
      const stages = await bitrixService.getStagesForCategory(categoryId);
      
      const stageList = Object.entries(stages).map(([stageId, stageData]) => ({
        id: stageId,
        name: stageData.NAME
      }));
      
      funnels.push({
        id: categoryId,
        name: category.name,
        stages: stageList
      });
    }
    
    res.json(funnels);

  } catch (error) {
    console.error('Get stages error:', error);
    res.status(500).json({ error: 'Bitrix24 request error' });
  }
});

router.post('/create', validate(schemas.createAppeal), authenticateToken, async (req, res) => {
  try {
    const { title, comment, files, category_id } = req.body;
    const contactId = req.user.contact_id;
    
    if (!contactId) {
      return res.status(400).json({ error: 'Отсутствует contact_id' });
    }

    const categories = await bitrixService.getDealCategories();
    const categoryIds = categories.map(cat => cat.id.toString());
    
    if (!categoryIds.includes(category_id)) {
      return res.status(400).json({ error: 'Неверный ID категории' });
    }

    const stages = await bitrixService.getStagesForCategory(category_id);
    const stageIds = Object.keys(stages);
    
    if (stageIds.length === 0) {
      return res.status(400).json({ error: 'Нет доступных стадий для выбранной категории' });
    }

    const firstStageId = stageIds[0];

    const dealFields = {
      TITLE: title,
      CONTACT_ID: contactId,
      STAGE_ID: firstStageId,
      CATEGORY_ID: category_id,
      COMMENTS: comment,
      OPPORTUNITY: '0',
      CURRENCY_ID: 'RUB',
      OPENED: 'Y'
    };

    const dealId = await bitrixService.createDeal(dealFields);
    if (!dealId) {
      return res.status(500).json({ error: 'Ошибка создания сделки' });
    }

    const activityFields = {
      OWNER_TYPE_ID: 2,
      OWNER_ID: dealId,
      TYPE_ID: 4,
      SUBJECT: 'Создано обращение',
      DESCRIPTION: comment,
      COMPLETED: 'Y',
      AUTHOR_ID: contactId
    };

    // Собираем COMMUNICATIONS из данных контакта, чтобы удовлетворить требования Bitrix
    try {
      const contact = await bitrixService.getContactById(contactId);
      if (contact) {
        const communications = [];
        if (Array.isArray(contact.PHONE)) {
          for (const phone of contact.PHONE) {
            if (phone && phone.VALUE) {
              communications.push({
                TYPE: 'PHONE',
                VALUE: phone.VALUE
              });
            }
          }
        }
        if (Array.isArray(contact.EMAIL)) {
          for (const email of contact.EMAIL) {
            if (email && email.VALUE) {
              communications.push({
                TYPE: 'EMAIL',
                VALUE: email.VALUE
              });
            }
          }
        }
        if (communications.length > 0) {
          activityFields.COMMUNICATIONS = communications;
        }
      }
    } catch (e) {
      // Логируем, но не прерываем создание активности
      console.error('Fetch contact for communications error:', e);
    }

    if (files && files.length > 0) {
      activityFields.FILES = files.map(file => ({
        fileData: [file.name, file.base64]
      }));
    }

    await bitrixService.addActivity(activityFields);

    res.json({
      deal_id: dealId.toString(),
      title: title,
      stage_name: stages[firstStageId].NAME,
      created_at: new Date().toISOString(),
      message: 'Обращение успешно создано'
    });

  } catch (error) {
    console.error('Create appeal error:', error);
    res.status(500).json({ error: 'Ошибка Bitrix24' });
  }
});

module.exports = router;