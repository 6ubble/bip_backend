const express = require('express');
const bitrixService = require('../../services/bitrix');
const { authenticateToken } = require('../../middleware/auth');
const { validate, schemas } = require('../../utils/validation');

const router = express.Router();

// Get activities (chat messages)
router.post('/get-activities', validate(schemas.dealById), authenticateToken, async (req, res) => {
  try {
    const { deal_id } = req.body;

    if (!deal_id) {
      return res.status(422).json({ error: 'deal_id не может быть пустым' });
    }

    const activities = await bitrixService.getActivities(deal_id);
    res.json(activities);

  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ error: 'Ошибка Bitrix API' });
  }
});

// Add activity (chat message)
router.post('/add-activity', validate(schemas.addActivity), authenticateToken, async (req, res) => {
  try {
    const { deal_id, comment, files, author_name, author_id } = req.body;

    if (!deal_id) {
      return res.status(422).json({ error: 'deal_id не может быть пустым' });
    }

    if (!comment && (!files || files.length === 0)) {
      return res.status(422).json({ error: 'Необходимо указать комментарий или файлы' });
    }

    const processedFiles = [];
    if (files && files.length > 0) {
      files.forEach(file => {
        processedFiles.push({
          fileData: [file.name, file.base64],
          fileName: file.name
        });
      });
    }

    const activityComment = comment || '';
    const activitySubject = author_name || 'Комментарий клиента';
    const activityAuthorId = author_id || req.user.contact_id || '';

    const activityFields = {
      OWNER_TYPE_ID: 2,
      OWNER_ID: deal_id,
      TYPE_ID: 4,
      SUBJECT: activitySubject,
      COMMUNICATIONS: [{ VALUE: activityComment, ENTITY_TYPE_ID: 2 }],
      FILES: processedFiles.length > 0 ? processedFiles : null,
      COMPLETED: 'Y',
      AUTHOR_ID: activityAuthorId
    };

    const activityId = await bitrixService.addActivity(activityFields);

    if (!activityId) {
      return res.status(500).json({ error: 'Ошибка создания активности' });
    }

    // Update files if present
    if (processedFiles.length > 0) {
      const fileUpdates = processedFiles.map((f, index) => ({
        ID: (index + 1).toString(),
        NAME: f.fileData[0],
        fileName: f.fileData[0]
      }));

      await bitrixService.updateActivity(activityId, { FILES: fileUpdates });
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Add activity error:', error);
    res.status(500).json({ error: 'Ошибка Bitrix API' });
  }
});

module.exports = router;