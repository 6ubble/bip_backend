const axios = require('axios');
const config = require('../../../config/config');

// Создание контакта
const createContact = async (contactData) => {
  try {
    const response = await axios.post(`${config.bitrix.url}/crm.contact.add.json`, {
      fields: contactData
    });

    if (response.data && response.data.result) {
      return response.data.result;
    }
    return null;
  } catch (error) {
    console.error('Bitrix contact creation error:', error);
    return null;
  }
}
// Cоздание компании
const createCompany = async (companyData) => {
  try {
    const response = await axios.post(`${config.bitrix.url}/crm.company.add.json`, {
      fields: companyData
    });

    if (response.data && response.data.result) {
      return response.data.result;
    }
    return null;
  } catch (error) {
    console.error('Bitrix company creation error:', error);
    return null;
  }
}

// Создание реквизитов компании
const createRequisite = async (companyId, inn, companyName) => {
  try {
    const data = {
      fields: {
        ENTITY_TYPE_ID: "4",
        ENTITY_ID: companyId,
        PRESET_ID: "1",
        NAME: `Реквизиты ${companyName}`,
        ACTIVE: "Y",
        RQ_INN: inn,
        RQ_COMPANY_NAME: companyName,
        RQ_COMPANY_FULL_NAME: companyName
      }
    };

    const response = await axios.post(`${config.bitrix.url}/crm.requisite.add.json`, data);

    if (response.data && response.data.result) {
      return response.data.result;
    }
    return null;
  } catch (error) {
    console.error('Bitrix requisite creation error:', error);
    return null;
  }
}

// Поиск контакта по email и телефону
const findContact = async (email, phone) => {
  try {
    const phoneWithPlus = phoneUtils.formatWithPlus(phone);

    const response = await axios.get(`${this.baseURL}/crm.contact.list.json`, {
      params: {
        'filter[PHONE]': phoneWithPlus,
        'filter[EMAIL]': email,
        'select[]': ['ID', 'PHONE', 'EMAIL']
      }
    });

    const contacts = response.data.result || [];

    if (contacts.length === 0) {
      return null;
    }

    for (const contact of contacts) {
      const contactId = contact.ID;
      const emails = contact.EMAIL || [];
      const phones = contact.PHONE || [];

      const emailMatch = emails.some(e =>
        e.VALUE && e.VALUE.toLowerCase() === email.toLowerCase()
      );
      const phoneMatch = phones.some(p =>
        p.VALUE === phoneWithPlus
      );

      if (emailMatch && phoneMatch) {
        return contactId;
      } else if (emailMatch || phoneMatch) {
        return contactId;
      }
    }

    return null;
  } catch (error) {
    console.error('Bitrix contact search error:', error);
    return null;
  }
}

module.exports = {
  createContact,
  createCompany,
  createRequisite,
  findContact
}