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

// Создание сделки
const createDeal = async (dealFields) => {
    try {
        const result = await bitrixRequest('crm.deal.add', {}, 'POST', {
            fields: dealFields
        });
        
        return result; // Возвращает ID созданной сделки
    } catch (error) {
        console.error('Deal creation error:', error);
        throw error;
    }
};

// Добавление активности к сделке
const addActivity = async (activityFields) => {
    try {
        const result = await bitrixRequest('crm.activity.add', {}, 'POST', {
            fields: activityFields
        });
        
        return result; // Возвращает ID созданной активности
    } catch (error) {
        console.error('Activity creation error:', error);
        throw error;
    }
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

const getItemStatus = async (dealId) => {
    const params = {
        entityTypeId: 1058,
        'filter[parentId2]': dealId,
        'select[]': [
            'ufCrm19_1756702291',
            'ufCrm19_1756701977',
            'ufCrm19_1756702224',
            'parentId2'
        ]
    };

    const response = await bitrixRequest('crm.item.list', params) || {};
    const stats = response?.items || [];
    console.log(stats)

    // Обрабатываем статусы
    return stats.map(stat => ({
        id: stat.id,
        parentId: stat.parentId2,
        status1: stat.ufCrm19_1756702291 || '',
        status2: stat.ufCrm19_1756701977 || '',
        status3: stat.ufCrm19_1756702224 || ''
    }));
};

module.exports = {
    bitrixRequest,
    getDeals,
    getContactById,
    createDeal,
    addActivity,
    getItemStatus
};