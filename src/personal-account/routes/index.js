const express = require('express');
const router = express.Router();

const legalRoutes = require('./legal');

router.use(legalRoutes);

module.exports = router;