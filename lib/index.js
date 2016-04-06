'use strict';

const Util = require('util');

const QUOTED_REGEX = /"\w+"/g;
const DEFAULTS     = { logServerError: true };

exports.register = function (server, options, next) {

  options = Object.assign({}, DEFAULTS, options);

  server.ext('onPreResponse', (request, reply) => {
    if (!request.response.isBoom) {
      return reply.continue();
    }

    const err = request.response;
    let msg = err.output.payload.error;

    if (err.output.statusCode === 500 && options.logServerError) {
      Util.log(err.stack);
    }

    if (options.joiStatusCode && err.output.statusCode === 400) {
      err.output.statusCode = options.joiStatusCode;
    }

    /* istanbul ignore else */
    if (err.output.statusCode === 500 && options.serverErrorMessage) {
      msg = options.serverErrorMessage;
    } else if (err.data && err.data.details && err.data.details.length >= 1) {
      msg = err.data.details.map((detail) => {
        if (detail.message.match(QUOTED_REGEX)) {
          return detail.path + detail.message.replace(QUOTED_REGEX, '');
        }
        return detail.message;
      }).join(' or ');
    } else if (err.output.payload.message) {
      msg = err.output.payload.message;
    }

    err.output.payload = {
      error: {
        message: msg,
        status_code: err.output.statusCode
      }
    };

    reply.continue();
  });

  next();

};

exports.register.attributes = {
  pkg: require('../package')
};
