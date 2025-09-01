const express = require('express');
const router = express.Router();

const loginRoutes = require('./login');
const registrationRoutes = require('./registration');

router.use(loginRoutes);
router.use(registrationRoutes);

module.exports = router;