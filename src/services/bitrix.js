const axios = require('axios');
const config = require('../config/config');
const phoneUtils = require('../utils/phone');

class BitrixService {
  constructor() {
    this.baseURL = `https://${config.bitrix.domain}/rest/1/${config.bitrix.token}`;
  }

  async getContactById(contactId) {
    try {
      const response = await axios.get(`${this.baseURL}/crm.contact.get.json`, {
        params: { ID: contactId }
      });
      return response.data?.result || null;
    } catch (error) {
      console.error('Bitrix contact fetch error:', error);
      return null;
    }
  }

  async createContact(contactData) {
    try {
      const response = await axios.post(`${this.baseURL}/crm.contact.add.json`, {
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

  async createCompany(companyData) {
    try {
      const response = await axios.post(`${this.baseURL}/crm.company.add.json`, {
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

  async createRequisite(companyId, inn, companyName) {
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

      const response = await axios.post(`${this.baseURL}/crm.requisite.add.json`, data);
      
      if (response.data && response.data.result) {
        return response.data.result;
      }
      return null;
    } catch (error) {
      console.error('Bitrix requisite creation error:', error);
      return null;
    }
  }

  async findContact(email, phone) {
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

  async getDeals(contactId, closedFilter = null) {
    try {
      const params = {
        'filter[CONTACT_ID]': contactId,
        'select[]': ['ID', 'TITLE', 'STAGE_ID', 'OPPORTUNITY', 'DATE_CREATE', 'CATEGORY_ID'],
        'order[DATE_CREATE]': 'DESC'
      };

      if (closedFilter !== null) {
        params['filter[CLOSED]'] = closedFilter;
      }

      const response = await axios.get(`${this.baseURL}/crm.deal.list.json`, {
        params
      });

      return response.data.result || [];
    } catch (error) {
      console.error('Bitrix deals fetch error:', error);
      throw error;
    }
  }

  async getDealCategories() {
    try {
      const response = await axios.get(`${this.baseURL}/crm.category.list.json`, {
        params: { entityTypeId: 2 }
      });
      return response.data.result?.categories || [];
    } catch (error) {
      console.error('Bitrix categories fetch error:', error);
      throw error;
    }
  }

  async getStagesForCategory(categoryId) {
    try {
      const response = await axios.get(`${this.baseURL}/crm.status.list.json`, {
        params: { 'filter[ENTITY_ID]': `DEAL_STAGE_${categoryId}` }
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
  }

  async createDeal(dealData) {
    try {
      const response = await axios.post(`${this.baseURL}/crm.deal.add.json`, {
        fields: dealData
      });
      
      if (response.data && response.data.result) {
        return response.data.result;
      }
      return null;
    } catch (error) {
      console.error('Bitrix deal creation error:', error);
      throw error;
    }
  }

  async addActivity(activityData) {
    try {
      const response = await axios.post(`${this.baseURL}/crm.activity.add.json`, {
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

  async getActivities(dealId) {
    try {
      const response = await axios.get(`${this.baseURL}/crm.activity.list.json`, {
        params: {
          'filter[OWNER_TYPE_ID]': 2,
          'filter[OWNER_ID]': dealId,
          'select[]': [
            'ID', 'SUBJECT', 'COMMUNICATIONS', 'DESCRIPTION', 
            'FILES', 'CREATED', 'AUTHOR_ID', 'STORAGE_ELEMENT_IDS'
          ]
        }
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
                const fileResponse = await axios.get(`${this.baseURL}/disk.file.get.json`, {
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
  }

  async updateActivity(activityId, updateData) {
    try {
      const response = await axios.post(`${this.baseURL}/crm.activity.update.json`, {
        id: activityId,
        fields: updateData
      });
      
      if (response.data && response.data.result) {
        return response.data.result;
      }
      return null;
    } catch (error) {
      console.error('Bitrix activity update error:', error);
      throw error;
    }
  }
}

module.exports = new BitrixService();