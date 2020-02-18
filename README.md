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
* The final list of error messages is joined with ` or `

## Options

* `logServerError`: boolean, default `true` - whether server errors (status code >= 500) should be logged to stdout
* `serverErrorMessage`: string - any custom message you want to return for server errors
* `joiStatusCode`: integer - the status code to use instead of `400` for Joi validation errors
* `language`: object - language templates used to format specific errors; see below for details
* `permeateErrorName`: boolean, default `false` - whether to copy the `.name` property from the Boom Error to a `type` property in the API response
* `decamelizeErrorName`: boolean, default `false` - whether to decamelize the `type`, such as `UnauthorizedUser` to `unauthorized_user`

### Providing Error Details

Additional error details can optionally be provided in the response object. This allows a client to make decisions based on granular error messages without having to parse the human-readable `message` field.

#### Set `permeateErrorName: true`

This will use the `.name` property from the Boom Error as a new `.type` property in the response object. This is useful for subclassing and naming Errors and exposing the values to the client. For example, if an error named `UnauthorizedUser` is used as a response, the HTTP response will look like the following:

```json
{
  "error": {
    "message": "error message",
    "status_code": 400,
    "type": "UnauthorizedUser"
  }
}
```

#### Set `permeateErrorName: true` and `decamelizeErrorName: true`

This will still consider the `.name` property from the Boom Error, but the value will be _decamelized_. For example, if an error named `UnauthorizedUser` is used as a response, the HTTP response will look like the following:

```json
{
  "error": {
    "message": "error message",
    "status_code": 400,
    "type": "unauthorized_user"
  }
}
```

### Language Templates (Message Formatting)

hapi-format-error can massage Joi validation errors into simpler, concise messages. It does this by applying a language template, if available. These are similar to the [language templates Joi defines](https://github.com/hapijs/joi/blob/v13.2.0/lib/language.js); the key difference is that they support plural forms.

A simple set of language templates that handle `object.allowUnknown` errors would look like this:

```javascript
{
  object: {
    allowUnknown: {
      singular: '{path} is not allowed',
      plural: 'the following parameters are not allowed: {paths}'
    }
  }
}
```

hapi-format-error groups messages by their error type, and then looks for matching templates. The `plural` template, if provided, is used when more than one error of a given type is reported. If the `plural` template is not provided, the `singular` template (required) will be applied to each individual error.

Singular templates have the following context variables available:

* `path` -- the Joi path where the error occurred
* `detail` -- the Joi validation error detail

Plural templates have a slightly different set of context variables:

* `paths_str` -- a string containing the Joi paths where this error occurred joined by `', '`
* `details` -- an array of the Joi validation error details

If no template is available for an error type, hapi-format-error will return the default Joi error message, stripping surrounding double quotes.
