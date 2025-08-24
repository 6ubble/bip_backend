const phoneUtils = {
  normalize(phone) {
    return phone.replace(/\D/g, '');
  },

  formatWithPlus(phone) {
    const normalized = this.normalize(phone);
    return `+${normalized}`;
  },

  validateAndFormat(phone) {
    const digitsOnly = this.normalize(phone);
    
    if (digitsOnly.length === 10) {
      return `+7${digitsOnly}`;
    }
    
    if (digitsOnly.length === 11 && digitsOnly.startsWith('8')) {
      return `+7${digitsOnly.slice(1)}`;
    }
    
    if (digitsOnly.length === 11 && digitsOnly.startsWith('7')) {
      return `+${digitsOnly}`;
    }
    
    return `+${digitsOnly}`;
  }
};

module.exports = phoneUtils;