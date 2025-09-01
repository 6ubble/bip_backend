const express = require('express');
const router = express.Router();

const legalRoutes = require('./legal/legal');

router.use(legalRoutes);

module.exports = router;