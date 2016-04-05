'use strict';

const Hapi  = require('hapi');
const Joi   = require('joi');
const Sinon = require('sinon');
const Util  = require('util');

const FormatError = require('../lib');

describe('format error plugin', () => {

  let server;

  beforeEach(() => {
    Sinon.stub(Util, 'log');

    server = new Hapi.Server();
    server.connection({ port: 80 });

    server.register([require('inject-then')], () => {})

    server.route([{
      method: 'GET',
      path: '/normal',
      config: {
        handler: (request, reply) => reply({})
      }
    }, {
      method: 'POST',
      path: '/joi',
      config: {
        handler: (request, reply) => reply({}),
        validate: { payload: { banana: Joi.number(), test: Joi.number() }, options: { abortEarly: false } }
      }
    }, {
      method: 'POST',
      path: '/custom',
      config: {
        handler: (request, reply) => reply({}),
        validate: { payload: { test: Joi.number().options({ language: { number: { base: '!!pass in a number' } } }) } }
      }
    }, {
      method: 'POST',
      path: '/error',
      config: {
        handler: (request, reply) => reply(new Error())
      }
    }]);
  });

  afterEach(() => {
    Util.log.restore();
  });

  it('does not do anything for non-errors', () => {
    server.register({
      register: FormatError,
      options: {}
    });

    return server.injectThen({
      method: 'GET',
      url: '/normal'
    })
    .then((res) => {
      expect(res.statusCode).to.eql(200);
      expect(res.result).to.eql({});
    });
  });

  it('does not alter the bad request status code if it was not provided', () => {
    server.register({
      register: FormatError,
      options: {}
    });

    return server.injectThen({
      method: 'POST',
      url: '/joi',
      payload: { test: 'not a number' }
    })
    .then((res) => {
      expect(res.statusCode).to.eql(400);
    });
  });

  it('converts bad request errors into the specified status code', () => {
    const statusCode = 422;

    server.register({
      register: FormatError,
      options: { joiStatusCode: statusCode }
    });

    return server.injectThen({
      method: 'POST',
      url: '/joi',
      payload: { test: 'not a number' }
    })
    .then((res) => {
      expect(res.statusCode).to.eql(statusCode);
    });
  });

  it('does not touch Joi validation errors if they do not have quotes', () => {
    server.register({
      register: FormatError,
      options: {}
    });

    return server.injectThen({
      method: 'POST',
      url: '/custom',
      payload: { test: 'not a number' }
    })
    .then((res) => {
      expect(res.result.error.message).to.eql('pass in a number');
    });
  });

  it('removes quotes from Joi validation errors if they exist', () => {
    server.register({
      register: FormatError,
      options: {}
    });

    return server.injectThen({
      method: 'POST',
      url: '/joi',
      payload: { test: 'not a number' }
    })
    .then((res) => {
      expect(res.result.error.message).to.eql('test must be a number');
    });
  });

  it('joins Joi errors together if it does not abort early', () => {
    server.register({
      register: FormatError,
      options: {}
    });

    return server.injectThen({
      method: 'POST',
      url: '/joi',
      payload: { banana: 'not a number', test: 'not a number' }
    })
    .then((res) => {
      expect(res.result.error.message).to.eql('banana must be a number or test must be a number');
    });
  });

  it('allows for custom 500 messages', () => {
    const msg = '500 - Server Error';

    server.register({
      register: FormatError,
      options: { serverErrorMessage: msg }
    });

    return server.injectThen({
      method: 'POST',
      url: '/error'
    })
    .then((res) => {
      expect(res.result.error.message).to.eql(msg);
    });
  });

  it('does not alter the 500 message if it was not provided', () => {
    server.register({
      register: FormatError,
      options: {}
    });

    return server.injectThen({
      method: 'POST',
      url: '/error'
    })
    .then((res) => {
      expect(res.result.error.message).to.eql('An internal server error occurred');
    });
  });

  it('logs server errors by default', () => {
    server.register({
      register: FormatError,
      options: {}
    });

    return server.injectThen({
      method: 'POST',
      url: '/error'
    })
    .then(() => {
      expect(Util.log.called).to.be.true;
    });
  });

  it('does not log server errors if not enabled', () => {
    server.register({
      register: FormatError,
      options: { logServerError: false }
    });

    return server.injectThen({
      method: 'POST',
      url: '/error'
    })
    .then(() => {
      expect(Util.log.called).to.be.false;
    });
  });

});
