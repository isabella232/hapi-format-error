'use strict';

const Hapi  = require('hapi');
const Joi   = require('joi');
const Sinon = require('sinon');
const Util  = require('util');

const FormatError = require('../lib');

class UnauthorizedUser extends Error {
  constructor (message) {
    super(message);
    this.name = 'UnauthorizedUser';
  }
}

class MalformedError extends Error {
  constructor (message) {
    super(message);
    this.name = undefined;
  }
}

describe('format error plugin', () => {

  let server;

  beforeEach(() => {
    Sinon.stub(Util, 'log');

    server = new Hapi.Server();
    server.connection({ port: 80 });

    server.register([require('inject-then')], () => {});

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
    }, {
      method: 'GET',
      path: '/unauth',
      config: {
        handler: (request, reply) => reply(new UnauthorizedUser('who even are you'))
      }
    }, {
      method: 'GET',
      path: '/malformed-error',
      config: {
        handler: (request, reply) => reply(new MalformedError('no .name property'))
      }
    }, {
      method: 'POST',
      path: '/xor',
      config: {
        handler: (request, reply) => reply({}),
        validate: {
          payload: Joi.object().keys({
            one: Joi.string(),
            two: Joi.string()
          })
          .xor('one', 'two')
        }
      }
    }, {
      method: 'POST',
      path: '/nested_xor',
      config: {
        handler: (request, reply) => reply({}),
        validate: {
          payload: {
            test: Joi.object().keys({
              one: Joi.string(),
              two: Joi.string()
            })
            .xor('one', 'two')
            .required()
          }
        }
      }
    }, {
      method: 'POST',
      path: '/nested_paths',
      config: {
        handler: (request, reply) => reply({}),
        validate: {
          payload: {
            test: Joi.object().keys({
              one: Joi.string().valid('one', '1'),
              two: Joi.string().valid('two')
            })
          }
        }
      }
    }, {
      method: 'POST',
      path: '/no-params',
      config: {
        handler: (request, reply) => reply({}),
        validate: {
          payload: Joi.object().keys({})
        }
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

  it('formats xor errors missing both parameters', () => {
    server.register({
      register: FormatError,
      options: {}
    });

    return server.injectThen({
      method: 'POST',
      url: '/xor',
      payload: {}
    })
    .then((res) => {
      expect(res.result.error.message).to.eql('one or two is required');
    });
  });

  it('formats xor errors containing both parameters', () => {
    server.register({
      register: FormatError,
      options: {}
    });

    return server.injectThen({
      method: 'POST',
      url: '/xor',
      payload: { one: 'banana', two: 'strawberry' }
    })
    .then((res) => {
      expect(res.result.error.message).to.eql('either one or two is required, but not both');
    });
  });

  it('formats nested xor errors missing both parameters', () => {
    server.register({
      register: FormatError,
      options: {}
    });

    return server.injectThen({
      method: 'POST',
      url: '/nested_xor',
      payload: { test: {} }
    })
    .then((res) => {
      expect(res.result.error.message).to.eql('test.one or test.two is required');
    });
  });

  it('formats xor errors containing both parameters', () => {
    server.register({
      register: FormatError,
      options: {}
    });

    return server.injectThen({
      method: 'POST',
      url: '/nested_xor',
      payload: { test: { one: 'banana', two: 'strawberry' } }
    })
    .then((res) => {
      expect(res.result.error.message).to.eql('either test.one or test.two is required, but not both');
    });
  });

  it('formats a single extraneous field correctly', () => {
    server.register({
      register: FormatError,
      options: {}
    });

    return server.injectThen({
      method: 'POST',
      url: '/no-params',
      payload: {
        bar: false
      }
    })
    .then((res) => {
      expect(res.result.error.message).to.eql('bar is not allowed');
    });
  });

  it('formats multiple extraneous fields correctly', () => {
    server.register({
      register: FormatError,
      options: {}
    });

    return server.injectThen({
      method: 'POST',
      url: '/no-params',
      payload: {
        foo: true,
        bar: false
      }
    })
    .then((res) => {
      expect(res.result.error.message).to.eql('the following parameters are not allowed: foo, bar');
    });
  });

  it('can override the language', () => {
    server.register({
      register: FormatError,
      options: {
        language: {
          object: {
            allowUnknown: { singular: 'blarf' }
          }
        }
      }
    });

    return server.injectThen({
      method: 'POST',
      url: '/no-params',
      payload: {
        bar: false
      }
    })
    .then((res) => {
      expect(res.result.error.message).to.eql('blarf');
    });
  });

  it('formats nested paths correctly', () => {
    server.register({
      register: FormatError,
      options: {}
    });

    return server.injectThen({
      method: 'POST',
      url: '/nested_paths',
      payload: {
        test: {
          one: 'two',
          two: 'two'
        }
      }
    })
    .then((res) => {
      expect(res.result.error.message).to.eql('test.one must be one of [one, 1]');
    });
  });

  it('does not include type when permeate is false', () => {
    server.register({
      register: FormatError,
      options: {}
    });

    return server.injectThen({
      method: 'GET',
      url: '/unauth',
      payload: {}
    })
    .then((res) => {
      expect(res.result.error.type).to.be.undefined;
    });
  });

  it('does include type when permeate is true', () => {
    server.register({
      register: FormatError,
      options: {
        permeateErrorName: true
      }
    });

    return server.injectThen({
      method: 'GET',
      url: '/unauth',
      payload: {}
    })
    .then((res) => {
      expect(res.result.error.type).to.eql('UnauthorizedUser');
    });
  });

  it('decamelizes error type', () => {
    server.register({
      register: FormatError,
      options: {
        permeateErrorName: true,
        decamelizeErrorName: true
      }
    });

    return server.injectThen({
      method: 'GET',
      url: '/unauth',
      payload: {}
    })
    .then((res) => {
      expect(res.result.error.type).to.eql('unauthorized_user');
    });
  });

  it('handles malformed Errors', () => {
    server.register({
      register: FormatError,
      options: {
        permeateErrorName: true,
        decamelizeErrorName: true
      }
    });

    return server.injectThen({
      method: 'GET',
      url: '/malformed-error',
      payload: {}
    })
    .then((res) => {
      expect(res.result.error.type).to.be.undefined;
    });
  });

  it('formats multiple nested extraneous fields correctly', () => {
    server.register({
      register: FormatError,
      options: {}
    });

    return server.injectThen({
      method: 'POST',
      url: '/nested_paths',
      payload: {
        test: {
          foo: true,
          bar: false
        }
      }
    })
    .then((res) => {
      expect(res.result.error.message).to.eql('the following parameters are not allowed: test.foo, test.bar');
    });
  });

});
