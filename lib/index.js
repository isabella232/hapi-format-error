'use strict';

const Hoek       = require('hoek');
const Util       = require('util');
const Decamelize = require('decamelize');

const QUOTED_REGEX = /"\w+"/g;
const LANGUAGE = {
  object: {
    missing: {
      singular: '{path}{separator}{detail.context.peers.0} or {path}{separator}{detail.context.peers.1} is required'
    },
    xor: {
      singular: 'either {path}{separator}{detail.context.peers.0} or {path}{separator}{detail.context.peers.1} is required, but not both'
    },
    allowUnknown: {
      singular: '{path} is not allowed',
      plural: `the following parameters are not allowed: {paths_str}`
    }
  }
};
const DEFAULTS = {
  logServerError: true,
  language: LANGUAGE,
  permeateErrorName: false,
  decamelizeErrorName: false
};

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
      // group errors by type
      const details = err.data.details.reduce(
        (result, detail) => {
          if (!result[detail.type]) {
            result[detail.type] = [];
          }
          result[detail.type].push(detail);

          return result;
        }, {}
      );

      // process each group, then flatten the final array of arrays
      msg = Hoek.flatten(
        Object.keys(details).map(
          (errType) => {
            const template = Hoek.reach(options.language, errType);

            if (template && template.plural && details[errType].length > 1) {
              // process using the plural template
              const paths = details[errType].map((d) => d.path.join('.'));
              return Hoek.reachTemplate({ details: details[errType], paths_str: paths.join(', ') }, template.plural);
            } else if (template) {
              return details[errType].map(
                // process the error using the singular template
                (detail) => {
                  const path = detail.path.length === 0 ? '' : `${detail.path}`;
                  const separator = detail.path.length === 0 ? '' : `.`;
                  return Hoek.reachTemplate({ detail, path, separator }, template.singular);
                }
              );
            }

            // no template; return the default Joi messages
            // after (potentially) stripping quoting
            return details[errType].map(
              (detail) => {
                if (detail.message.match(QUOTED_REGEX)) {
                  return detail.path.join('.') + detail.message.replace(QUOTED_REGEX, '');
                }
                return detail.message;
              }
            );
          })
      ).join(' or ');
    } else if (err.output.payload.message) {
      msg = err.output.payload.message;
    }

    err.output.payload = {
      error: {
        message: msg,
        status_code: err.output.statusCode
      }
    };

    if (options.permeateErrorName && err.name) {
      err.output.payload.error.type = options.decamelizeErrorName ?
        Decamelize(err.name) : // method_not_allowed
        err.name; // MethodNotAllowed
    }

    reply.continue();
  });

  next();

};

exports.register.attributes = {
  pkg: require('../package')
};
