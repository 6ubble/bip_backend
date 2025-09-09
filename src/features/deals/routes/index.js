const express = require('express');
const router = express.Router();

const dealsRouter = require('./get_deals');         // вернуть сделки юзера
const createRouter = require('./create_deals'); // создание сделки

router.use('/deals', dealsRouter);   // GET /api/deals/get-deals
router.use('/create', createRouter);      // POST /api/deals/create

module.exports = router;
