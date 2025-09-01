const express = require('express');
const db = require('../../../config/database');
const { authenticateToken } = require('../../../middleware/auth');

const router = express.Router();

// Get company info
router.get('/company/info', authenticateToken, async (req, res) => {
  try {
    if (req.user.user_type !== 'legal') {
      return res.status(403).json({
        error: 'Доступно только для юридических лиц'
      });
    }

    const companyId = req.user.company_id;
    if (!companyId) {
      return res.status(404).json({
        error: 'У вас нет привязанной компании'
      });
    }

    // Get company data
    const companies = await db.query(
      'SELECT id, name, inn, invite_token, phone, email, balance, created_at FROM companies WHERE id = ?',
      [companyId]
    );

    if (companies.length === 0) {
      return res.status(404).json({ error: 'Компания не найдена' });
    }

    const company = companies[0];

    // Get employees count
    const employeesCounts = await db.query(
      'SELECT COUNT(*) as employees_count FROM users WHERE company_id = ?',
      [companyId]
    );

    const employeesCount = employeesCounts[0].employees_count;

    // Prepare response
    const responseData = {
      id: company.id,
      name: company.name,
      inn: company.inn,
      phone: company.phone,
      email: company.email,
      balance: parseFloat(company.balance),
      employees_count: employeesCount,
      created_at: company.created_at ? company.created_at.toISOString() : null
    };

    // Show invite token only to director
    if (req.user.role === 'Руководитель') {
      responseData.invite_token = company.invite_token;
      responseData.token_message = 'Передайте этот токен сотрудникам для регистрации';
    }

    res.json(responseData);

  } catch (error) {
    console.error('Get company info error:', error);
    res.status(500).json({ error: 'Непредвиденная ошибка' });
  }
});

// Get company employees
router.get('/company/employees', authenticateToken, async (req, res) => {
  try {
    // Check access rights
    if (req.user.role !== 'Руководитель') {
      return res.status(403).json({
        error: 'Только руководитель может просматривать список сотрудников'
      });
    }

    const companyId = req.user.company_id;
    if (!companyId) {
      return res.status(404).json({
        error: 'У вас нет привязанной компании'
      });
    }

    // Get all company employees
    const employees = await db.query(
      `SELECT id, first_name, second_name, last_name,
              phone, email, role, position, balance, created_at
       FROM users
       WHERE company_id = ?
       ORDER BY 
           CASE role 
               WHEN 'Руководитель' THEN 1
               WHEN 'Сотрудник' THEN 2
               ELSE 3
           END,
           created_at DESC`,
      [companyId]
    );

    const formattedEmployees = employees.map(emp => ({
      id: emp.id,
      full_name: `${emp.last_name} ${emp.first_name} ${emp.second_name || ''}`.trim(),
      first_name: emp.first_name,
      second_name: emp.second_name,
      last_name: emp.last_name,
      phone: emp.phone,
      email: emp.email,
      role: emp.role,
      position: emp.position || 'Не указана',
      balance: parseFloat(emp.balance),
      created_at: emp.created_at ? emp.created_at.toISOString() : null
    }));

    res.json({
      employees: formattedEmployees,
      total_count: formattedEmployees.length
    });

  } catch (error) {
    console.error('Get company employees error:', error);
    res.status(500).json({ error: 'Непредвиденная ошибка' });
  }
});

module.exports = router;