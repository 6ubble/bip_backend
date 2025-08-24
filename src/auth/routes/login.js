const express = require('express');
const db = require('../../config/database');
const passwordUtils = require('../../utils/password');
const jwtUtils = require('../../utils/jwt');
const { validate, schemas } = require('../../utils/validation');

const router = express.Router();

router.post('/login', validate(schemas.login), async (req, res) => {
  try {
    const { email_or_phone, password } = req.body;

    // Find user by email or phone
    const users = await db.query(
      'SELECT * FROM users WHERE email = ? OR phone = ?',
      [email_or_phone, email_or_phone]
    );

    if (users.length === 0) {
      return res.status(401).json({ 
        error: 'Неверный номер телефона/почта или пароль' 
      });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await passwordUtils.verify(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ 
        error: 'Неверный логин или пароль' 
      });
    }

    // Get company info if legal entity
    let companyInfo = null;
    if (user.user_type === 'legal' && user.company_id) {
      const companies = await db.query(
        'SELECT * FROM companies WHERE id = ?',
        [user.company_id]
      );
      companyInfo = companies[0] || null;
    }

    // Create token
    const tokenData = {
      sub: user.email,
      user_id: user.id,
      user_type: user.user_type,
      role: user.role,
      first_name: user.first_name,
      second_name: user.second_name,
      last_name: user.last_name,
      contact_id: user.contact_id,
      company_id: user.company_id,
      department_id: user.department_id
    };

    const accessToken = jwtUtils.createToken(tokenData);

    const responseData = {
      message: 'Вход выполнен успешно',
      user_type: user.user_type,
      role: user.role,
      first_name: user.first_name,
      second_name: user.second_name,
      last_name: user.last_name,
      balance: parseFloat(user.balance)
    };

    if (companyInfo) {
      responseData.company = {
        name: companyInfo.name,
        inn: companyInfo.inn,
        balance: parseFloat(companyInfo.balance)
      };
    }

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.json(responseData);

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Непредвиденная ошибка' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('access_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/'
  });
  
  res.json({ message: 'Выход выполнен успешно' });
});

module.exports = router;