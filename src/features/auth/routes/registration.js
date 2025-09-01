const express = require('express');
const db = require('../../../config/database');
const passwordUtils = require('../../../utils/password');
const jwtUtils = require('../../../utils/jwt');
const phoneUtils = require('../../../utils/phone');
const tokenGenerator = require('../../../utils/token-generator');
const { createContact, createCompany, createRequisite, findContact } = require('../utils/auth_bitrix_functions');
const { validate, schemas } = require('../../../utils/validation');

const router = express.Router();

router.post('/register/physical', validate(schemas.registerPhysical), async (req, res) => {
  let connection;
  try {
    const { first_name, second_name, last_name, birthdate, phone, email, password } = req.body;

    connection = await db.getConnection();
    await connection.beginTransaction();

    // Check if user exists
    const [existingUsers] = await connection.execute(
      'SELECT * FROM users WHERE phone = ? OR email = ?',
      [phone, email]
    );

    if (existingUsers.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        error: 'Пользователь с таким телефоном или email уже существует'
      });
    }

    // Format phone
    const phoneWithPlus = phoneUtils.formatWithPlus(phone);

    // Check Bitrix contact
    const contactId = await findContact(email, phoneWithPlus);

    // Hash password
    const hashedPassword = await passwordUtils.hash(password);

    // Create user
    const [result] = await connection.execute(
      `INSERT INTO users (
        password, user_type, role, first_name, second_name,
        last_name, birthdate, phone, email, contact_id, balance
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        hashedPassword, 'physical', 'Пользователь',
        first_name, second_name, last_name, birthdate,
        phoneWithPlus, email, contactId, 0.0
      ]
    );

    const userId = result.insertId;

    // Create Bitrix contact if not exists
    if (!contactId) {
      const contactData = {
        NAME: first_name,
        SECOND_NAME: second_name,
        LAST_NAME: last_name,
        BIRTHDATE: birthdate,
        PHONE: [{ VALUE: phoneWithPlus, VALUE_TYPE: 'WORK' }],
        EMAIL: [{ VALUE: email, VALUE_TYPE: 'WORK' }]
      };

      const newContactId = await createContact(contactData);
      if (newContactId) {
        await connection.execute(
          'UPDATE users SET contact_id = ? WHERE id = ?',
          [newContactId, userId]
        );
      }
    }

    await connection.commit();

    // Get user data
    const [users] = await connection.execute(
      'SELECT * FROM users WHERE phone = ?',
      [phoneWithPlus]
    );
    const user = users[0];

    // Create token
    const tokenData = {
      user_id: user.id,
      user_type: user.user_type,
      role: user.role,
      first_name: user.first_name,
      second_name: user.second_name,
      last_name: user.last_name,
      contact_id: user.contact_id,
      company_id: user.company_id
    };

    const accessToken = jwtUtils.createToken(tokenData);

    const responseData = {
      message: 'Регистрация успешно завершена',
      user_type: user.user_type,
      role: user.role,
      first_name: user.first_name,
      second_name: user.second_name,
      last_name: user.last_name,
      balance: parseFloat(user.balance)
    };

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000
    });

    res.json(responseData);

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Physical registration error:', error);
    res.status(500).json({ error: 'Непредвиденная ошибка: ' + error.message });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.post('/register/legal', validate(schemas.registerLegal), async (req, res) => {
  let connection;
  try {
    const {
      company_name, inn, employee_first_name, employee_second_name,
      employee_last_name, phone, email, password
    } = req.body;

    connection = await db.getConnection();
    await connection.beginTransaction();

    // Check if user or company exists
    const [existingData] = await connection.execute(
      `SELECT u.id FROM users u WHERE u.phone = ? OR u.email = ?
       UNION
       SELECT c.id FROM companies c WHERE c.inn = ?`,
      [phone, email, inn]
    );

    if (existingData.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        error: 'Пользователь или компания уже существуют'
      });
    }

    // Format phone
    const phoneWithPlus = phoneUtils.formatWithPlus(phone);

    // Check Bitrix contact
    const contactId = await findContact(email, phoneWithPlus);

    // Hash password
    const hashedPassword = await passwordUtils.hash(password);

    // Create user
    const [userResult] = await connection.execute(
      `INSERT INTO users (
        password, user_type, role, first_name, second_name,
        last_name, phone, email, contact_id, company_id, balance
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        hashedPassword, 'legal', 'Руководитель',
        employee_first_name, employee_second_name, employee_last_name,
        phoneWithPlus, email, contactId, null, 0.0
      ]
    );

    const userId = userResult.insertId;

    // Generate company token
    const companyToken = tokenGenerator.generateCompanyToken();

    // Create company
    const [companyResult] = await connection.execute(
      `INSERT INTO companies (
        name, inn, invite_token, phone, email, bitrix_company_id, balance, creator_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [company_name, inn, companyToken, phoneWithPlus, email, null, 0.0, userId]
    );

    const companyDbId = companyResult.insertId;

    // Create Bitrix company
    const companyData = {
      TITLE: company_name,
      PHONE: [{ VALUE: phoneWithPlus, VALUE_TYPE: 'WORK' }],
      EMAIL: [{ VALUE: email, VALUE_TYPE: 'WORK' }]
    };

    const bitrixCompanyId = await createCompany(companyData);
    if (!bitrixCompanyId) {
      await connection.rollback();
      return res.status(500).json({
        error: 'Ошибка создания компании в Bitrix24'
      });
    }

    // Update bitrix company id
    await connection.execute(
      'UPDATE companies SET bitrix_company_id = ? WHERE id = ?',
      [bitrixCompanyId, companyDbId]
    );

    // Create Bitrix requisites
    const requisiteId = await createRequisite(bitrixCompanyId, inn, company_name);
    if (!requisiteId) {
      await connection.rollback();
      return res.status(500).json({
        error: 'Ошибка создания реквизитов в Bitrix24'
      });
    }

    // Create Bitrix contact if not exists
    if (!contactId) {
      const contactData = {
        NAME: employee_first_name,
        SECOND_NAME: employee_second_name,
        LAST_NAME: employee_last_name,
        PHONE: [{ VALUE: phoneWithPlus, VALUE_TYPE: 'WORK' }],
        EMAIL: [{ VALUE: email, VALUE_TYPE: 'WORK' }],
        COMPANY_ID: bitrixCompanyId
      };

      const newContactId = await createContact(contactData);
      if (newContactId) {
        await connection.execute(
          'UPDATE users SET contact_id = ? WHERE id = ?',
          [newContactId, userId]
        );
      }
    }

    // Update user's company_id
    await connection.execute(
      'UPDATE users SET company_id = ? WHERE id = ?',
      [companyDbId, userId]
    );

    await connection.commit();

    // Get user data
    const [users] = await connection.execute(
      'SELECT * FROM users WHERE phone = ?',
      [phoneWithPlus]
    );
    const user = users[0];

    // Create token
    const tokenData = {
      user_id: user.id,
      user_type: user.user_type,
      role: user.role,
      first_name: user.first_name,
      second_name: user.second_name,
      last_name: user.last_name,
      contact_id: user.contact_id,
      company_id: user.company_id
    };

    const accessToken = jwtUtils.createToken(tokenData);

    const responseData = {
      message: 'Регистрация компании успешно завершена',
      user_type: user.user_type,
      role: user.role,
      first_name: user.first_name,
      second_name: user.second_name,
      last_name: user.last_name,
      balance: parseFloat(user.balance),
      company_token: companyToken
    };

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000
    });

    res.json(responseData);

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Legal registration error:', error);
    res.status(500).json({ error: 'Непредвиденная ошибка: ' + error.message });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.post('/register/employee', validate(schemas.registerEmployee), async (req, res) => {
  let connection;
  try {
    const {
      first_name, second_name, last_name, position,
      phone, email, password, company_token
    } = req.body;

    connection = await db.getConnection();
    await connection.beginTransaction();

    // Check if user exists
    const [existingUsers] = await connection.execute(
      'SELECT * FROM users WHERE phone = ? OR email = ?',
      [phone, email]
    );

    if (existingUsers.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        error: 'Пользователь с таким телефоном или email уже существует'
      });
    }

    // Check company token
    const [companies] = await connection.execute(
      'SELECT id, name, bitrix_company_id FROM companies WHERE invite_token = ?',
      [company_token]
    );

    if (companies.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        error: 'Компания с таким токеном не найдена. Проверьте правильность токена'
      });
    }

    const company = companies[0];

    // Format phone
    const phoneWithPlus = phoneUtils.formatWithPlus(phone);

    // Check Bitrix contact
    const contactId = await findContact(email, phoneWithPlus);

    // Hash password
    const hashedPassword = await passwordUtils.hash(password);

    // Create employee user
    const [userResult] = await connection.execute(
      `INSERT INTO users (
        password, user_type, role, first_name, second_name,
        last_name, phone, email, contact_id, company_id,
        position, balance
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        hashedPassword, 'legal', 'Сотрудник',
        first_name, second_name, last_name,
        phoneWithPlus, email, contactId, company.id,
        position, 0.0
      ]
    );

    const userId = userResult.insertId;

    // Create Bitrix contact if not exists
    if (!contactId) {
      const contactData = {
        NAME: first_name,
        SECOND_NAME: second_name,
        LAST_NAME: last_name,
        PHONE: [{ VALUE: phoneWithPlus, VALUE_TYPE: 'WORK' }],
        EMAIL: [{ VALUE: email, VALUE_TYPE: 'WORK' }],
        COMPANY_ID: company.bitrix_company_id
      };

      const newContactId = await createContact(contactData);
      if (newContactId) {
        await connection.execute(
          'UPDATE users SET contact_id = ? WHERE id = ?',
          [newContactId, userId]
        );
      }
    }

    await connection.commit();

    // Get user data
    const [users] = await connection.execute(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );
    const user = users[0];

    // Create token
    const tokenData = {
      user_id: user.id,
      user_type: user.user_type,
      role: user.role,
      first_name: user.first_name,
      second_name: user.second_name,
      last_name: user.last_name,
      contact_id: user.contact_id,
      company_id: user.company_id,
      position: user.position
    };

    const accessToken = jwtUtils.createToken(tokenData);

    const responseData = {
      message: `Регистрация успешно завершена. Вы присоединились к компании ${company.name}`,
      user_type: user.user_type,
      role: user.role,
      first_name: user.first_name,
      second_name: user.second_name,
      last_name: user.last_name,
      position: position,
      company_name: company.name,
      balance: parseFloat(user.balance)
    };

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000
    });

    res.json(responseData);

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Employee registration error:', error);
    res.status(500).json({ error: 'Непредвиденная ошибка: ' + error.message });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;