const Joi = require('joi');

const schemas = {
  login: Joi.object({
    email_or_phone: Joi.string().required(),
    password: Joi.string().required()
  }),

  registerPhysical: Joi.object({
    first_name: Joi.string().required(),
    second_name: Joi.string().required(),
    last_name: Joi.string().required(),
    birthdate: Joi.date().iso().required(),
    phone: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
  }),

  registerLegal: Joi.object({
    company_name: Joi.string().required(),
    inn: Joi.string().pattern(/^\d{10}$|^\d{12}$/).required(),
    employee_first_name: Joi.string().required(),
    employee_second_name: Joi.string().required(),
    employee_last_name: Joi.string().required(),
    phone: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
  }),

  registerEmployee: Joi.object({
    first_name: Joi.string().required(),
    second_name: Joi.string().required(),
    last_name: Joi.string().required(),
    position: Joi.string().required(),
    phone: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    company_token: Joi.string().length(32).required()
  }),

  createAppeal: Joi.object({
    title: Joi.string().min(3).required(),
    comment: Joi.string().min(10).required(),
    files: Joi.array().items(Joi.object({
      name: Joi.string().required(),
      base64: Joi.string().required(),
      size: Joi.number().optional()
    })).optional(),
    category_id: Joi.string().required()
  }),

  dealById: Joi.object({
    deal_id: Joi.string().required()
  }),

  addActivity: Joi.object({
    deal_id: Joi.string().required(),
    comment: Joi.string().optional().allow(''),
    files: Joi.array().items(Joi.object({
      name: Joi.string().required(),
      base64: Joi.string().required()
    })).optional(),
    author_name: Joi.string().optional(),
    author_id: Joi.number().optional()
  })
};

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(422).json({ 
        error: error.details[0].message 
      });
    }
    next();
  };
};

module.exports = { schemas, validate };