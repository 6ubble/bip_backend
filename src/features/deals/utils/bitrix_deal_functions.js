const axios = require('axios');
const config = require('../../../config/config');

// Получение сделок по ID контакта
const getDeals = async (contactId, closedFilter = null) => {
    try {
        const params = {
            'filter[CONTACT_ID]': contactId,
            'filter[UF_CRM_1756703320]': 1, // фильтрация только по "Выгружать на сайт"
            'select[]': ['ID', 'TITLE', 'STAGE_ID', 'OPPORTUNITY', 'DATE_CREATE', 'CATEGORY_ID'],
            'order[DATE_CREATE]': 'DESC'
        };

        if (closedFilter !== null) {
            params['filter[CLOSED]'] = closedFilter;
        }

        const response = await axios.get(`${config.bitrix.url}/crm.deal.list.json`, {
            params
        });
        console.log(response.data.result);
        return response.data.result || [];
    } catch (error) {
        console.error('Ошибка Битрикс:', error);
        throw error;
    }
};

// Получить список доступных тем обращений и их наименования (включая привязку к categoryID в сделках)
const getDealCategories = async () => {
    try {
        const params = {
            entityTypeId: 1054,
            'filter[!=ufCrm17_1756699402]': 'Y',
            'filter[ufCrm17_1756699478]': 141,
            'select[]': [
                'ID',
                'title',
                'ufCrm17_1756699384',
                'ufCrm17_1756699424',
                'ufCrm17_1756699402'
            ]
        };

        const response = await axios.get(`${config.bitrix.url}/crm.item.list.json`, {
            params
        });

        return response.data.result?.items || [];
    } catch (error) {
        console.error('Bitrix categories fetch error:', error.response?.data || error);
        throw error;
    }
};

const getStagesForCategory = async (categoryId) => {
    try {
        const params = { 'filter[ENTITY_ID]': `DEAL_STAGE_${categoryId}` };

        const response = await axios.get(`${config.bitrix.url}/crm.status.list.json`, {
            params
        });

        const stages = {};
        const results = response.data.result || [];

        results.forEach(stage => {
            stages[stage.STATUS_ID] = { NAME: stage.NAME };
        });

        return stages;
    } catch (error) {
        console.error('Bitrix stages fetch error:', error);
        throw error;
    }
};

const createDeal = async (dealData) => {
    try {
        const response = await axios.post(`${config.bitrix.url}/crm.deal.add.json`, {
            fields: {
                ...dealData,
                UF_CRM_1756703320: 1 // . Поле используется для управления выдачей в личный кабинет и называется «Выгружать на сайт».
            }
        });

        if (response.data && response.data.result) {
            return response.data.result;
        }
        return null;
    } catch (error) {
        console.error('Ошибка создания сделки:', error);
        throw error;
    }
};

const getActivities = async (dealId) => {
    try {
        const params = {
            'filter[OWNER_TYPE_ID]': 2,
            'filter[OWNER_ID]': dealId,
            'select[]': [
                'ID', 'SUBJECT', 'COMMUNICATIONS', 'DESCRIPTION',
                'FILES', 'CREATED', 'AUTHOR_ID', 'STORAGE_ELEMENT_IDS'
            ]
        };

        const response = await axios.get(`${config.bitrix.url}/crm.activity.list.json`, {
            params
        });

        const activities = response.data.result || [];

        // Process activities like in Python version
        for (const activity of activities) {
            if (activity.COMMUNICATIONS && activity.COMMUNICATIONS.length > 0) {
                activity.TEXT = activity.COMMUNICATIONS[0].VALUE || '';
            } else {
                activity.TEXT = activity.DESCRIPTION || '';
            }

            if (activity.FILES) {
                for (const file of activity.FILES) {
                    let fileName = file.NAME || `file_${file.id || 'unknown'}`;
                    let fileUrl = file.url || file.URL || '';
                    const fileId = file.id;

                    if (fileId) {
                        try {
                            const fileResponse = await axios.get(`${config.bitrix.url}/disk.file.get.json`, {
                                params: { id: fileId }
                            });
                            const fileData = fileResponse.data.result || {};
                            fileName = fileData.NAME || fileName;
                            fileUrl = fileData.DOWNLOAD_URL || fileUrl;
                        } catch (error) {
                            // Silent fail, use original data
                        }
                    }

                    file.NAME = fileName;
                    file.URL = fileUrl;
                    if (!file.ID) {
                        file.ID = `temp_${fileName.split('').reduce((a, b) => {
                            a = ((a << 5) - a) + b.charCodeAt(0);
                            return a & a;
                        }, 0)}`;
                    }
                }
            }
        }

        return activities;
    } catch (error) {
        console.error('Bitrix activities fetch error:', error);
        throw error;
    }
};

// Получение контакта по ID
const getContactById = async (contactId) => {
    try {
        const params = { ID: contactId };

        const response = await axios.get(`${config.bitrix.url}/crm.contact.get.json`, {
            params
        });
        return response.data?.result || null;
    } catch (error) {
        console.error('Bitrix contact fetch error:', error);
        return null;
    }
};

const addActivity = async (activityData) => {
    try {
        const response = await axios.post(`${config.bitrix.url}/crm.activity.add.json`, {
            fields: activityData
        });

        if (response.data && response.data.result) {
            return response.data.result;
        }
        return null;
    } catch (error) {
        console.error('Bitrix activity creation error:', error);
        throw error;
    }
}


module.exports = {
    getDeals,
    getDealCategories,
    getStagesForCategory,
    createDeal,
    getActivities,
    getContactById,
    addActivity
};