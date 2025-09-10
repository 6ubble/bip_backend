const express = require('express');
const router = express.Router();

const dealsRouter = require('./get_deals');
const createRouter = require('./create_deals');
const appealDetailsRouter = require('./get_appeal_details');
const downloadRouter = require('./download_file');
const dealFilesRouter = require('./get_deal_files');
const replyRouter = require('./send_reply');

router.use('/deals', dealsRouter);
router.use('/create', createRouter);
router.use('/appeal', appealDetailsRouter);
router.use('/files', downloadRouter);
router.use('/deal-files', dealFilesRouter);
router.use('/reply', replyRouter);

module.exports = router;
