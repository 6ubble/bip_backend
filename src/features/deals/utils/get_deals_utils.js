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


// Функция, которая принимает айди сделки и возвращает её последний статус и дату
const getDealStages = async (dealId) => {
    const result = await bitrixRequest('crm.item.list', {}, 'POST', {
        entityTypeId: 1058,
        filter: {
            parentId2: dealId
        },
        order: { id: 'ASC' }, // сортировка по id
        select: [
            "ufCrm19_1756702291", // статус
            "ufCrm19_1756702224"  // дата статуса
        ]
    });

    const items = result?.items || [];
    if (items.length === 0) return null;

    const lastItem = items.at(-1);

    return {
        status: lastItem.ufCrm19_1756702291 || null,
        date: lastItem.ufCrm19_1756702224 || null
    };
};


// Проверка возможности ответа на обращение
const canReplyToAppeal = async (dealId) => {
    try {
        const statuses = await getItemStatus(dealId);

        // Если нет статусов, возвращаем false
        if (!statuses || statuses.length === 0) {
            return false;
        }

        // Берем первый элемент (самый последний по дате из-за сортировки DESC)
        const lastStatus = statuses[0];

        // Проверяем, равен ли последний статус 151 (проверяем и строку, и число)
        return lastStatus.status2 === '151' || lastStatus.status2 === 151;
    } catch (error) {
        console.error('Error checking reply status:', error);
        return false;
    }
};

module.exports = {
    getDeals,
    getDealStages,
    canReplyToAppeal
};