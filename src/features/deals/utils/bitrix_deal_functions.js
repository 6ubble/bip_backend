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
            'parentId2',
            'ufCrm19_1757302376', // текст-сообщение
            'ufCrm19_1757303943', // массив файлов для пользователя
        ],
        'order[ufCrm19_1756702224]': 'DESC' // Сортировка по дате статуса (последний сначала)
    };

    const response = await bitrixRequest('crm.item.list', params) || {};
    const stats = response?.items || [];

    // Обрабатываем статусы
    return stats.map(stat => ({
        id: stat.id,
        parentId: stat.parentId2,
        status1: stat.ufCrm19_1756702291 || '',
        status2: stat.ufCrm19_1756701977 || '',
        status3: stat.ufCrm19_1756702224 || '',
        message: stat.ufCrm19_1757302376 || '', // текст-сообщение
        documents: stat.ufCrm19_1757303943 || [] // массив файлов для пользователя
    }));
};



// Получение детальной информации об обращении для ответа
const getAppealDetails = async (dealId) => {
    try {
        const statuses = await getItemStatus(dealId);

        if (!statuses || statuses.length === 0) {
            return {
                message: '',
                documents: []
            };
        }

        // Берем последний статус
        const lastStatus = statuses[0];

        // Получаем документы с детальной информацией
        const documents = lastStatus.documents ? await parseDocuments(lastStatus.documents) : [];

        return {
            message: lastStatus.message || '', // Текст сообщения из ufCrm19_1757302376
            documents: documents // Файлы из ufCrm19_1757303943 с детальной информацией
        };
    } catch (error) {
        console.error('Error getting appeal details:', error);
        return {
            message: '',
            documents: []
        };
    }
};

// Получение информации о файле из Bitrix
const getFileInfo = async (fileId) => {
    try {
        if (!fileId) return null;

        const fileInfo = await bitrixRequest('disk.file.get', { id: fileId });
        return fileInfo?.ID ? fileInfo : null;
    } catch (error) {
        console.error('Error getting file info:', error.message);
        return null;
    }
};

// Парсинг документов из поля Bitrix с получением детальной информации
const parseDocuments = async (documentsField) => {
    try {
        if (!documentsField) return [];

        let documents = [];

        // Если это строка JSON, парсим её
        if (typeof documentsField === 'string') {
            try {
                const parsed = JSON.parse(documentsField);
                documents = Array.isArray(parsed) ? parsed : [];
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                return [];
            }
        }
        // Если это уже массив
        else if (Array.isArray(documentsField)) {
            documents = documentsField;
        }
        // Если это объект с одним файлом
        else if (typeof documentsField === 'object' && documentsField !== null) {
            documents = [documentsField];
        }
        else {
            return [];
        }

        // Обрабатываем каждый документ и получаем детальную информацию
        const processedDocuments = await Promise.all(
            documents.map(async (doc, index) => {

                try {
                    // Если это объект с ID файла, получаем детальную информацию
                    if (typeof doc === 'object' && doc !== null) {
                        const fileId = doc.id || doc.ID || doc.fileId || doc.file_id;

                        if (fileId) {
                            const fileInfo = await getFileInfo(fileId);

                            if (fileInfo) {
                                return {
                                    id: fileId,
                                    name: fileInfo.NAME || doc.name || doc.fileName || `Файл ${index + 1}`,
                                    url: fileInfo.DOWNLOAD_URL || doc.url,
                                    type: fileInfo.CONTENT_TYPE || doc.type,
                                    size: fileInfo.SIZE || doc.size,
                                    createdAt: fileInfo.CREATED_TIME || doc.createdAt,
                                    originalData: doc
                                };
                            }
                        }
                    }

                    // Если это строка с ID файла
                    if (typeof doc === 'string' && doc.trim()) {
                        const fileInfo = await getFileInfo(doc.trim());

                        if (fileInfo) {
                            return {
                                id: doc.trim(),
                                name: fileInfo.NAME || `Файл ${index + 1}`,
                                url: fileInfo.DOWNLOAD_URL,
                                type: fileInfo.CONTENT_TYPE,
                                size: fileInfo.SIZE,
                                createdAt: fileInfo.CREATED_TIME,
                                originalData: doc
                            };
                        }
                    }

                    // Если не удалось получить детальную информацию, используем доступные данные
                    return {
                        id: doc.id || doc.ID || doc.fileId || doc.file_id || index,
                        name: doc.name || doc.fileName || doc.filename || doc.title || `Файл ${index + 1}`,
                        url: doc.url || doc.downloadUrl || doc.DOWNLOAD_URL,
                        type: doc.type || doc.contentType || doc.CONTENT_TYPE,
                        size: doc.size || doc.fileSize || doc.SIZE,
                        createdAt: doc.createdAt || doc.created_time,
                        originalData: doc
                    };

                } catch (docError) {
                    // Возвращаем базовую информацию даже при ошибке
                    return {
                        id: doc.id || doc.ID || doc.fileId || index,
                        name: doc.name || doc.fileName || `Файл ${index + 1}`,
                        url: doc.url || '',
                        type: doc.type || 'unknown',
                        size: doc.size || 0,
                        originalData: doc
                    };
                }
            })
        );

        // Фильтруем пустые документы
        const validDocuments = processedDocuments.filter(doc => doc && doc.id);

        return validDocuments;

    } catch (error) {
        console.error('Error parsing documents:', error);
        return [];
    }
};

// Получение файлов из поля ufCrm19_1757303943 для конкретной сделки
const getDealFiles = async (dealId) => {
    try {
        const params = {
            entityTypeId: 1058,
            'filter[parentId2]': dealId,
            'select[]': [
                'ufCrm19_1757303943', // массив файлов для пользователя
                'parentId2'
            ],
            'order[ufCrm19_1756702224]': 'DESC' // Сортировка по дате статуса
        };

        const response = await bitrixRequest('crm.item.list', params) || {};
        const items = response?.items || [];

        // Собираем все файлы из всех элементов
        let allFiles = [];

        for (const item of items) {
            if (item.ufCrm19_1757303943) {
                const files = await parseDocuments(item.ufCrm19_1757303943);
                allFiles = allFiles.concat(files);
            }
        }

        // Удаляем дубликаты по ID файла
        const uniqueFiles = allFiles.filter((file, index, self) =>
            index === self.findIndex(f => f.id === file.id)
        );

        return uniqueFiles;

    } catch (error) {
        console.error('Error getting deal files:', error);
        return [];
    }
};

// Получение файлов из последнего статуса сделки
const getLatestDealFiles = async (dealId) => {
    try {
        const statuses = await getItemStatus(dealId);

        if (!statuses || statuses.length === 0) {
            return [];
        }

        // Берем последний статус (первый в массиве из-за сортировки DESC)
        const lastStatus = statuses[0];

        if (!lastStatus.documents) {
            return [];
        }

        return await parseDocuments(lastStatus.documents);

    } catch (error) {
        console.error('Error getting latest deal files:', error);
        return [];
    }
};

// Создание элемента смарт-процесса для ответа на обращение
const createSmartProcessItem = async (dealId, message, files = []) => {
    try {
        console.log('Creating smart process item with files:', files.length);

        // Получаем текущую дату в формате ISO с часовым поясом UTC+5 (Екатеринбург)
        const now = new Date();
        const ekaterinburgTime = new Date(now.getTime() + (5 * 60 * 60 * 1000)); // UTC+5
        const isoDateTime = ekaterinburgTime.toISOString().replace('Z', '+05:00');

        // ✅ ПРАВИЛЬНАЯ подготовка файлов для Bitrix24
        const preparedFiles = [];

        if (Array.isArray(files) && files.length > 0) {
            for (const file of files) {
                if (file && file.name && file.base64) {
                    // Убеждаемся, что base64 не содержит префикс data:
                    const cleanBase64 = file.base64.replace(/^data:[^;]+;base64,/, '');

                    preparedFiles.push([
                        file.name,
                        cleanBase64
                    ]);

                    console.log(`Prepared file: ${file.name}, size: ${cleanBase64.length} chars`);
                }
            }
        }

        console.log('Total prepared files:', preparedFiles.length);

        // Поля элемента смарт-процесса
        const itemFields = {
            parentId2: dealId,
            ufCrm19_1756702291: "На проверке информации",
            ufCrm19_1756701977: 159,
            ufCrm19_1756702224: isoDateTime,
            ufCrm19_1757303366: message,
        };

        // ✅ ПРАВИЛЬНОЕ добавление файлов в поле
        if (preparedFiles.length > 0) {
            itemFields.ufCrm19_1757303943 = preparedFiles;
            console.log('Added files to field ufCrm19_1757303943:', preparedFiles.length);
        }

        console.log('Final itemFields:', JSON.stringify(itemFields, null, 2));

        // Создаем элемент через crm.item.add
        const result = await bitrixRequest('crm.item.add', {}, 'POST', {
            entityTypeId: 1058,
            fields: itemFields
        });

        console.log('Smart process item created successfully:', result);
        return result;

    } catch (error) {
        console.error('Error creating smart process item:', error);
        console.error('Error details:', error.response?.data);
        throw error;
    }
};

module.exports = {
    bitrixRequest,
    getContactById,
    createDeal,
    addActivity,
    getItemStatus,
    getAppealDetails,
    getFileInfo,
    getDealFiles,
    getLatestDealFiles,
    createSmartProcessItem
};