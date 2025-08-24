const bcrypt = require('bcrypt');

const passwordUtils = {
  async hash(password) {
    return await bcrypt.hash(password, 12);
  },

  async verify(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }
};

module.exports = passwordUtils;
