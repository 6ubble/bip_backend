const axios = require('axios');
const config = require('../../../config/config');

// Базовый метод для запросов к Bitrix24
const bitrixRequest = async (endpoint, params = {}, method = 'GET', data = null) => {
    try {
        const config_obj = {
            method,
            url: `${config.bitrix.url}/${endpoint}.json`,
            ...(method === 'GET' ? { params } : { data })
        };
        
        const response = await axios(config_obj);
        return response.data.result;
    } catch (error) {
        console.error(`Bitrix ${endpoint} error:`, error.response?.data || error.message);
        throw error;
    }
};

// Получение сделок по ID контакта
const getDeals = async (contactId, closedFilter = null) => {
    const params = {
        'filter[CONTACT_ID]': contactId,
        'filter[UF_CRM_1756703320]': 1,
        'select[]': ['ID', 'TITLE', 'STAGE_ID', 'OPPORTUNITY', 'DATE_CREATE', 'CATEGORY_ID'],
        'order[DATE_CREATE]': 'DESC'
    };

    if (closedFilter !== null) {
        params['filter[CLOSED]'] = closedFilter;
    }

    return await bitrixRequest('crm.deal.list', params) || [];
};

// Получить категории сделок
const getDealCategories = async () => {
    const params = {
        entityTypeId: 1054,
        'filter[!=ufCrm17_1756699402]': 'Y',
        'filter[ufCrm17_1756699478]': 141,
        'select[]': ['ID', 'title', 'ufCrm17_1756699384', 'ufCrm17_1756699424', 'ufCrm17_1756699402']
    };

    const result = await bitrixRequest('crm.item.list', params);
    return result?.items || [];
};

// Получить стадии для категории
const getStagesForCategory = async (categoryId) => {
    const params = { 'filter[ENTITY_ID]': `DEAL_STAGE_${categoryId}` };
    const results = await bitrixRequest('crm.status.list', params) || [];
    
    const stages = {};
    results.forEach(stage => {
        stages[stage.STATUS_ID] = { NAME: stage.NAME };
    });
    
    return stages;
};

// Получение контакта по ID
const getContactById = async (contactId) => {
    try {
        return await bitrixRequest('crm.contact.get', { ID: contactId });
    } catch (error) {
        console.error('Contact fetch error:', error.message);
        return null;
    }
};

// Загрузка файла на диск Bitrix24
const uploadFileToDisk = async (fileName, base64Content) => {
    try {
        return await bitrixRequest('disk.folder.uploadfile', {}, 'POST', {
            id: 'storage_3',
            data: { NAME: fileName },
            fileContent: [fileName, base64Content]
        });
    } catch (error) {
        console.error(`File upload failed for ${fileName}:`, error.message);
        throw error;
    }
};

// Создание сделки с файлами (основная оптимизированная функция)
const createDealWithFiles = async (dealFields, files = []) => {
    // 1. Создаем сделку
    const dealId = await bitrixRequest('crm.deal.add', {}, 'POST', {
        fields: { ...dealFields, UF_CRM_1756703320: 1 }
    });

    if (!dealId) throw new Error('Failed to create deal');

    // 2. Обрабатываем файлы параллельно для оптимизации
    if (files && files.length > 0) {
        const uploadPromises = files
            .filter(file => file.name && file.base64)
            .map(async (file) => {
                try {
                    const uploadedFile = await uploadFileToDisk(file.name, file.base64);
                    return uploadedFile?.ID;
                } catch (error) {
                    console.error(`Upload failed for ${file.name}`);
                    return null;
                }
            });

        const uploadedFileIds = (await Promise.all(uploadPromises)).filter(Boolean);
        
        // Пытаемся прикрепить к сделке (опционально)
        if (uploadedFileIds.length > 0) {
            try {
                await bitrixRequest('crm.deal.update', {}, 'POST', {
                    id: dealId,
                    fields: { UF_CRM_FILES: uploadedFileIds }
                });
            } catch (error) {
                console.log('Files attached to activity only (no deal file field)');
            }
        }
    }

    return dealId;
};

// Создание активности с файлами
const addActivityWithFiles = async (activityData, files = []) => {
    // Форматируем файлы для активности
    if (files && files.length > 0) {
        activityData.FILES = files
            .filter(file => file.name && file.base64)
            .map(file => ({ fileData: [file.name, file.base64] }));
    }

    return await bitrixRequest('crm.activity.add', {}, 'POST', { fields: activityData });
};

// Получение активностей (оптимизированная версия)
const getActivities = async (dealId) => {
    const params = {
        'filter[OWNER_TYPE_ID]': 2,
        'filter[OWNER_ID]': dealId,
        'select[]': ['ID', 'SUBJECT', 'COMMUNICATIONS', 'DESCRIPTION', 'FILES', 'CREATED', 'AUTHOR_ID']
    };

    const activities = await bitrixRequest('crm.activity.list', params) || [];

    // Обрабатываем активности
    return activities.map(activity => {
        activity.TEXT = activity.COMMUNICATIONS?.[0]?.VALUE || activity.DESCRIPTION || '';
        
        if (activity.FILES) {
            activity.FILES = activity.FILES.map(file => ({
                ID: file.ID || `temp_${Date.now()}`,
                NAME: file.NAME || 'unknown',
                URL: file.URL || file.url || ''
            }));
        }
        
        return activity;
    });
};

module.exports = {
    getDeals,
    getDealCategories,
    getStagesForCategory,
    getContactById,
    createDealWithFiles,
    addActivityWithFiles,
    getActivities
};