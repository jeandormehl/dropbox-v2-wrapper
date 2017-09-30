const $request = require('request');

const RPC_RESOURCE_CATEGORY = 'RPC';

const DB_HEADER_API_ARGS = 'Dropbox-API-Arg';
const DB_API_RESULT_HEADER_NAME = 'dropbox-api-result';

const resourcesDescriptionList = require('./dropbox-res-list');

class DropboxV2Wrapper {
  constructor() {
    this._updateRequestOptsFnList = [
      this._reqAuthHeader,
      this._reqUploadStream,
      this._reqTransmission,
    ];
  }

  authenticate(config) {
    const resourceHandlingFunctions = this._generateResourcesHandlingFunctions(
      resourcesDescriptionList,
      config
    );

    const connection = (userOpt, cb = this._noop) => {
      const opt = {
        parameters: userOpt.parameters || {},
        resource: userOpt.resource || '',
        readStream: userOpt.readStream,
      };

      const resourceName = opt.resource;

      if (resourceHandlingFunctions[resourceName]) {
        return resourceHandlingFunctions[resourceName](opt, cb);
      }

      return DropboxV2Wrapper._throwError(`resource "${opt.resource}" is invalid.`);
    };

    return connection;
  }

  _generateResourcesHandlingFunctions(resDescList, config) {
    const resourcesHandlingFunctions = {};

    Object.keys(resDescList).forEach((resourceName) => {
      const resourceDescription = resDescList[resourceName];

      resourcesHandlingFunctions[resourceName] = (userOpts, userCb) => {
        const requestOpts = this._createDefaultRequestOptObject(resourceDescription);

        this._updateRequestOptsFnList.forEach(
          (updateRequestOptsFn) => updateRequestOptsFn(
            requestOpts,
            resourceDescription,
            userOpts,
            config
          )
        );

        return $request(requestOpts, this._prepareCallback(userCb));
      };
    });

    return resourcesHandlingFunctions;
  }

  _prepareCallback(cb) {
    const preparedCb = (err, response, body) => {
      if (err) {
        return cb(err);
      }

      const responseContentType = response.headers['content-type'];
      const statusCode = response.statusCode;

      const handleResponseByContentType = {
        'application/octet-stream': () => {
          const dropboxApiResultContent = response.headers[DB_API_RESULT_HEADER_NAME];

          return dropboxApiResultContent && cb(null, JSON.parse(dropboxApiResultContent));
        },

        'application/json': () => {
          const json = body;

          if (statusCode === 200) {
            return cb(null, json);
          }
          json.statusCode = statusCode;

          return cb(json);
        },

        'text/plain; charset=utf-8': () => {
          const text = body;

          if (statusCode === 200) {
            return cb(null, text);
          }

          return cb({
            statusCode,
            text,
          });
        },
      };

      const responseHandlerFn = handleResponseByContentType[responseContentType];

      if (responseHandlerFn) {
        responseHandlerFn();
      }
      else {
        return cb(err || null);
      }
    };

    return preparedCb;
  }

  _reqTransmission(requestOpts, resourceDescription, userOpts, config) {
    const resourceCategory = resourceDescription.category;
    const userParameters = userOpts.parameters;

    if (resourceCategory === RPC_RESOURCE_CATEGORY) {
      requestOpts.body = resourceDescription.parameters.available
        ? userParameters
        : null;
    }
    else {
      requestOpts.headers[DB_HEADER_API_ARGS] = DropboxV2Wrapper._isObject(userParameters)
        ? JSON.stringify(userParameters)
        : '';
    }
  }

  _reqUploadStream(requestOpts, { requiresReadableStream }, userOpts) {
    if (requiresReadableStream) {
      requestOpts.headers['Content-Type'] = 'application/octet-stream';
    }
  }

  _reqAuthHeader(requestOpts, { requiresAuthHeader }, userOpts, config) {
    if (requiresAuthHeader) {
      if (!config.token) {
        DropboxV2Wrapper._throwError('No \'token\' specified!');
      }
      requestOpts.headers.Authorization = `Bearer ${config.token}`;
    }
  }

  _createDefaultRequestOptObject(resourceDescription) {
    return {
      method: 'POST',
      uri: resourceDescription.uri,
      json: true,
      followRedirect: false,
      headers: {},
    };
  }

  _noop() {}

  static _isObject(obj) {
    return (typeof obj) === 'object' && !!obj;
  }

  static _throwError(content) {
    throw content;
  }
}

module.exports = DropboxV2Wrapper;
