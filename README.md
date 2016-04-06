# hapi-format-error

[![Build Status](https://travis-ci.org/lob/hapi-format-error.svg?branch=master)](https://travis-ci.org/lob/hapi-format-error)

A plugin to structure Boom errors into a more desirable format.

It currently does the following:

* Returns errors in this format:

    ```json
    {
      "error": {
        "message": "error message",
        "status_code": 400
      }
    }
    ```

* Allows for changing the default [Joi](https://github.com/hapijs/joi) validation error status code (400)
* Allows for using a custom server error message
* Allows for logging server errors for debugging purposes

## Options

* `logServerError`: boolean, default `true` - whether server errors (status code >= 500) should be logged to stdout
* `serverErrorMessage`: string - any custom message you want to return for server errors
* `joiStatusCode`: integer - the status code to use instead of `400` for Joi validation errors
