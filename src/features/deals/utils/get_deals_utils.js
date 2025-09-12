const { bitrixRequest, getItemStatus } = require('./bitrix_deal_functions')

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

// ИСПРАВЛЕННАЯ функция получения стадий сделки
const getDealStages = async (dealId) => {
    try {
        // Проверяем, что dealId существует
        if (!dealId) {
            console.warn('getDealStages: dealId is missing');
            return null;
        }

        // Используем GET метод с правильными параметрами
        const params = {
            entityTypeId: 1058,
            'filter[parentId2]': dealId,
            'order[id]': 'ASC',
            'select[]': [
                'ufCrm19_1756702291', // статус
                'ufCrm19_1756702224'  // дата статуса
            ]
        };

        const result = await bitrixRequest('crm.item.list', params);
        
        // Дополнительная проверка результата
        if (!result || !result.items) {
            console.warn(`getDealStages: No items found for dealId ${dealId}`);
            return null;
        }

        const items = result.items;
        
        if (items.length === 0) {
            console.warn(`getDealStages: Empty items array for dealId ${dealId}`);
            return null;
        }

        // Берем первый элемент для даты
        const firstItem = items[0];
        // Берем последний элемент для статуса
        const lastItem = items.at(-1);
        
        if (!firstItem || !lastItem) {
            console.warn(`getDealStages: Missing items for dealId ${dealId}`);
            return null;
        }

        return {
            status: lastItem.ufCrm19_1756702291 || 'Не указан', // статус из последнего
            date: firstItem.ufCrm19_1756702224, // дата из первого
            // Добавляем отладочную информацию
            itemsCount: items.length,
            dealId: dealId,
            statusFromItemId: lastItem.id,
            dateFromItemId: firstItem.id,
            // Для отладки - показываем все статусы
            allStatuses: items.map(item => ({
                id: item.id,
                status: item.ufCrm19_1756702291,
                date: item.ufCrm19_1756702224
            }))
        };

    } catch (error) {
        console.error(`getDealStages error for dealId ${dealId}:`, error);
        return null;
    }
};

// Проверка возможности ответа на обращение
const canReplyToAppeal = async (dealId) => {
    try {
        if (!dealId) {
            return false;
        }

        // Используем тот же запрос, что и в getDealStages
        const params = {
            entityTypeId: 1058,
            'filter[parentId2]': dealId,
            'order[id]': 'ASC',
            'select[]': [
                'ufCrm19_1756701977', // status2 поле
                'ufCrm19_1756702291', // статус
                'ufCrm19_1756702224'  // дата статуса
            ]
        };

        const result = await bitrixRequest('crm.item.list', params);
        
        if (!result || !result.items || result.items.length === 0) {
            return false;
        }

        // Берем последний элемент (как в getDealStages)
        const lastItem = result.items.at(-1);
        
        if (!lastItem) {
            return false;
        }

        // Проверяем статус
        const status2 = lastItem.ufCrm19_1756701977;
        const canReply = status2 === 151 || status2 === '151';
        
        console.log(`canReplyToAppeal for dealId ${dealId}:`, {
            canReply,
            status2,
            status2Type: typeof status2,
            itemId: lastItem.id,
            totalItems: result.items.length
        });
        
        return canReply;
        
    } catch (error) {
        console.error(`canReplyToAppeal error for dealId ${dealId}:`, error);
        return false;
    }
};

module.exports = {
    getDeals,
    getDealStages,
    canReplyToAppeal
};