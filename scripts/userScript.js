(function () {
    'use strict';

    function redirectUrl(originalUrl) {
        if (!originalUrl) return originalUrl;

        try {
            if (typeof originalUrl === 'string' && originalUrl.startsWith('//')) originalUrl = originalUrl.replace('//', 'https://');
            const url = new URL(originalUrl, window.location.origin);
            const hostname = url.hostname;

            if (hostname === 'youtube.com' || hostname === 'www.youtube.com') {
                url.protocol = 'http:';
                url.host = 'localhost:8099';
                return url.toString();
            }

            if (hostname.endsWith('googlevideo.com') || hostname.endsWith('youtube.com')
                || hostname.endsWith('gstatic.com') || hostname.endsWith('.google.com')
                || hostname.endsWith('.googleapis.com') || hostname.endsWith('googleusercontent.com')
                || hostname.endsWith('.ggpht.com')) {
                return 'http://localhost:8099/cors-bypass/' + url.toString();
            }
        } catch (e) {
            console.error('Failed to parse URL during interception:', e);
        }

        return originalUrl;
    }

    function initPatches () {
        const originalFetch = window.fetch;
        if (originalFetch) {
            window.fetch = function (input, init) {
                let targetUrl = '';
                let isRequestObject = false;

                if (typeof input === 'string') {
                    targetUrl = redirectUrl(input);
                } else if (input instanceof URL) {
                    targetUrl = redirectUrl(input.toString());
                    input = new URL(targetUrl);
                } else if (input instanceof Request) {
                    isRequestObject = true;
                    targetUrl = redirectUrl(input.url);
                }

                if (isRequestObject) {
                    if (input.method === 'POST' && targetUrl.indexOf('localhost') !== -1) {
                        const modifiedOptions = {
                            method: input.method,
                            headers: new Headers(input.headers),
                            mode: input.mode,
                            credentials: input.credentials,
                        };

                        if (input.body && !input.bodyUsed) {
                            input.clone();
                            return input.clone().arrayBuffer().then(function (buffer) {
                                modifiedOptions.body = buffer;

                                return originalFetch(targetUrl, modifiedOptions);
                            });
                        }

                        return originalFetch(targetUrl, modifiedOptions);
                    }

                    input = new Request(targetUrl, input);
                }

                return originalFetch.apply(this, [targetUrl, init]);
            };
        }

        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
            const redirectedUrl = redirectUrl(url);
            if (redirectedUrl !== url) {
                async = true;
            }

            if (async === undefined) {
                async = true;
            }

            return originalOpen.apply(this, [method, redirectedUrl, async, user, password]);
        };

        if (navigator.sendBeacon) {
            const originalSendBeacon = navigator.sendBeacon;
            navigator.sendBeacon = function (url, data) {
                console.log("Beacon data:", data);
                return originalSendBeacon.apply(this, [redirectUrl(url), data]);
            };
        }

        Object.defineProperty(HTMLImageElement.prototype, 'src', {
            set: function(value) {
                const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'setAttribute');
                descriptor.value.call(this, 'src', redirectUrl(value));
            }
        });
        Object.defineProperty(HTMLScriptElement.prototype, 'src', {
            set: function(value) {
                const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'setAttribute');
                descriptor.value.call(this, 'src', redirectUrl(value));
            }
        });
    }

    const deviceProfiles = [
        {
            architecture: 'Linux arm64-v8a',
            os: 'Android 10',
            rasterizer: 'gles',
            manufacturer: 'Sony',
            deviceType: 'ATV',
            chipsetModel: 'sdm845',
            modelYear: 13140765,
            firmwareVersion: '52.1.C.0.268',
            brand: 'KDDI',
            model: 'SOV38'
        },
        {
            architecture: 'Linux armeabi-v7a',
            os: 'Android 14',
            rasterizer: 'gles',
            manufacturer: 'Google',
            deviceType: 'ATV',
            chipsetModel: 'sabrina',
            modelYear: 2020,
            firmwareVersion: 'UTTC.250917.004',
            brand: 'google',
            model: 'Chromecast'
        },
        {
            architecture: 'Linux armeabi-v7a',
            os: 'Android 12',
            rasterizer: 'gles',
            manufacturer: 'TCL',
            deviceType: 'ATV',
            chipsetModel: 'merak',
            modelYear: 2023,
            firmwareVersion: 'STT2.221228.001',
            brand: 'TCL',
            model: 'Smart TV Pro'
        },
        {
            architecture: 'Linux armeabi-v7a',
            os: 'Android 7.1.2',
            rasterizer: 'gles',
            manufacturer: 'Amazon',
            deviceType: 'ATV',
            chipsetModel: 'mt8695',
            modelYear: 0,
            firmwareVersion: 'NS6294',
            brand: 'Amazon',
            model: 'AFTMM'
        }
    ];

    const cobaltVersion = '25.lts.30.1034958-gold';
    const v8Version = 'v8/8.8.278.17-jit';
    const starboardVersion = '15';
    const auxField = 'com.google.android.youtube.tv/5.30.301';

    function generateUserAgent(profile) {
        return `Mozilla/5.0 (${profile.architecture}; ${profile.os}) Cobalt/${cobaltVersion} (unlike Gecko) ${v8Version} ${profile.rasterizer} Starboard/${starboardVersion}, ${profile.manufacturer}_${profile.deviceType}_${profile.chipsetModel}_${profile.modelYear}/${profile.firmwareVersion} (${profile.brand}, ${profile.model}) ${auxField}`;
    }

    if (document.querySelector('.content-container') && window.h5vcc && window.h5vcc.fasttube && window.h5vcc.fasttube.SetUserAgent) {
        if (!sessionStorage.getItem('ua_spoofed')) {
            sessionStorage.setItem('ua_spoofed', 'true');
            
            let ua = localStorage.getItem('userAgent');
            if (!ua) {
                const randomProfile = deviceProfiles[Math.floor(Math.random() * deviceProfiles.length)];
                ua = generateUserAgent(randomProfile);
                localStorage.setItem('userAgent', ua);
            }
            
            window.h5vcc.fasttube.SetUserAgent(ua);
            location.reload();
        }
    }

    /* eslint-disable no-prototype-builtins */
    var g =
      (typeof globalThis !== 'undefined' && globalThis) ||
      (typeof self !== 'undefined' && self) ||
      // eslint-disable-next-line no-undef
      (typeof global !== 'undefined' && global) ||
      {};

    var support = {
      searchParams: 'URLSearchParams' in g,
      iterable: 'Symbol' in g && 'iterator' in Symbol,
      blob:
        'FileReader' in g &&
        'Blob' in g &&
        (function() {
          try {
            new Blob();
            return true
          } catch (e) {
            return false
          }
        })(),
      formData: 'FormData' in g,
      arrayBuffer: 'ArrayBuffer' in g
    };

    function isDataView(obj) {
      return obj && DataView.prototype.isPrototypeOf(obj)
    }

    if (support.arrayBuffer) {
      var viewClasses = [
        '[object Int8Array]',
        '[object Uint8Array]',
        '[object Uint8ClampedArray]',
        '[object Int16Array]',
        '[object Uint16Array]',
        '[object Int32Array]',
        '[object Uint32Array]',
        '[object Float32Array]',
        '[object Float64Array]'
      ];

      var isArrayBufferView =
        ArrayBuffer.isView ||
        function(obj) {
          return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1
        };
    }

    function normalizeName(name) {
      if (typeof name !== 'string') {
        name = String(name);
      }
      if (/[^a-z0-9\-#$%&'*+.^_`|~!]/i.test(name) || name === '') {
        throw new TypeError('Invalid character in header field name: "' + name + '"')
      }
      return name.toLowerCase()
    }

    function normalizeValue(value) {
      if (typeof value !== 'string') {
        value = String(value);
      }
      return value
    }

    // Build a destructive iterator for the value list
    function iteratorFor(items) {
      var iterator = {
        next: function() {
          var value = items.shift();
          return {done: value === undefined, value: value}
        }
      };

      if (support.iterable) {
        iterator[Symbol.iterator] = function() {
          return iterator
        };
      }

      return iterator
    }

    function Headers$1(headers) {
      this.map = {};

      if (headers instanceof Headers$1) {
        headers.forEach(function(value, name) {
          this.append(name, value);
        }, this);
      } else if (Array.isArray(headers)) {
        headers.forEach(function(header) {
          if (header.length != 2) {
            throw new TypeError('Headers constructor: expected name/value pair to be length 2, found' + header.length)
          }
          this.append(header[0], header[1]);
        }, this);
      } else if (headers) {
        Object.getOwnPropertyNames(headers).forEach(function(name) {
          this.append(name, headers[name]);
        }, this);
      }
    }

    Headers$1.prototype.append = function(name, value) {
      name = normalizeName(name);
      value = normalizeValue(value);
      var oldValue = this.map[name];
      this.map[name] = oldValue ? oldValue + ', ' + value : value;
    };

    Headers$1.prototype['delete'] = function(name) {
      delete this.map[normalizeName(name)];
    };

    Headers$1.prototype.get = function(name) {
      name = normalizeName(name);
      return this.has(name) ? this.map[name] : null
    };

    Headers$1.prototype.has = function(name) {
      return this.map.hasOwnProperty(normalizeName(name))
    };

    Headers$1.prototype.set = function(name, value) {
      this.map[normalizeName(name)] = normalizeValue(value);
    };

    Headers$1.prototype.forEach = function(callback, thisArg) {
      for (var name in this.map) {
        if (this.map.hasOwnProperty(name)) {
          callback.call(thisArg, this.map[name], name, this);
        }
      }
    };

    Headers$1.prototype.keys = function() {
      var items = [];
      this.forEach(function(value, name) {
        items.push(name);
      });
      return iteratorFor(items)
    };

    Headers$1.prototype.values = function() {
      var items = [];
      this.forEach(function(value) {
        items.push(value);
      });
      return iteratorFor(items)
    };

    Headers$1.prototype.entries = function() {
      var items = [];
      this.forEach(function(value, name) {
        items.push([name, value]);
      });
      return iteratorFor(items)
    };

    if (support.iterable) {
      Headers$1.prototype[Symbol.iterator] = Headers$1.prototype.entries;
    }

    function consumed(body) {
      if (body._noBody) return
      if (body.bodyUsed) {
        return Promise.reject(new TypeError('Already read'))
      }
      body.bodyUsed = true;
    }

    function fileReaderReady(reader) {
      return new Promise(function(resolve, reject) {
        reader.onload = function() {
          resolve(reader.result);
        };
        reader.onerror = function() {
          reject(reader.error);
        };
      })
    }

    function readBlobAsArrayBuffer(blob) {
      var reader = new FileReader();
      var promise = fileReaderReady(reader);
      reader.readAsArrayBuffer(blob);
      return promise
    }

    function readBlobAsText(blob) {
      var reader = new FileReader();
      var promise = fileReaderReady(reader);
      var match = /charset=([A-Za-z0-9_-]+)/.exec(blob.type);
      var encoding = match ? match[1] : 'utf-8';
      reader.readAsText(blob, encoding);
      return promise
    }

    function readArrayBufferAsText(buf) {
      var view = new Uint8Array(buf);
      var chars = new Array(view.length);

      for (var i = 0; i < view.length; i++) {
        chars[i] = String.fromCharCode(view[i]);
      }
      return chars.join('')
    }

    function bufferClone(buf) {
      if (buf.slice) {
        return buf.slice(0)
      } else {
        var view = new Uint8Array(buf.byteLength);
        view.set(new Uint8Array(buf));
        return view.buffer
      }
    }

    function Body() {
      this.bodyUsed = false;

      this._initBody = function(body) {
        /*
          fetch-mock wraps the Response object in an ES6 Proxy to
          provide useful test harness features such as flush. However, on
          ES5 browsers without fetch or Proxy support pollyfills must be used;
          the proxy-pollyfill is unable to proxy an attribute unless it exists
          on the object before the Proxy is created. This change ensures
          Response.bodyUsed exists on the instance, while maintaining the
          semantic of setting Request.bodyUsed in the constructor before
          _initBody is called.
        */
        // eslint-disable-next-line no-self-assign
        this.bodyUsed = this.bodyUsed;
        this._bodyInit = body;
        if (!body) {
          this._noBody = true;
          this._bodyText = '';
        } else if (typeof body === 'string') {
          this._bodyText = body;
        } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
          this._bodyBlob = body;
        } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
          this._bodyFormData = body;
        } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
          this._bodyText = body.toString();
        } else if (support.arrayBuffer && support.blob && isDataView(body)) {
          this._bodyArrayBuffer = bufferClone(body.buffer);
          // IE 10-11 can't handle a DataView body.
          this._bodyInit = new Blob([this._bodyArrayBuffer]);
        } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
          this._bodyArrayBuffer = bufferClone(body);
        } else {
          this._bodyText = body = Object.prototype.toString.call(body);
        }

        if (!this.headers.get('content-type')) {
          if (typeof body === 'string') {
            this.headers.set('content-type', 'text/plain;charset=UTF-8');
          } else if (this._bodyBlob && this._bodyBlob.type) {
            this.headers.set('content-type', this._bodyBlob.type);
          } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
            this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8');
          }
        }
      };

      if (support.blob) {
        this.blob = function() {
          var rejected = consumed(this);
          if (rejected) {
            return rejected
          }

          if (this._bodyBlob) {
            return Promise.resolve(this._bodyBlob)
          } else if (this._bodyArrayBuffer) {
            return Promise.resolve(new Blob([this._bodyArrayBuffer]))
          } else if (this._bodyFormData) {
            throw new Error('could not read FormData body as blob')
          } else {
            return Promise.resolve(new Blob([this._bodyText]))
          }
        };
      }

      this.arrayBuffer = function() {
        if (this._bodyArrayBuffer) {
          var isConsumed = consumed(this);
          if (isConsumed) {
            return isConsumed
          } else if (ArrayBuffer.isView(this._bodyArrayBuffer)) {
            return Promise.resolve(
              this._bodyArrayBuffer.buffer.slice(
                this._bodyArrayBuffer.byteOffset,
                this._bodyArrayBuffer.byteOffset + this._bodyArrayBuffer.byteLength
              )
            )
          } else {
            return Promise.resolve(this._bodyArrayBuffer)
          }
        } else if (support.blob) {
          return this.blob().then(readBlobAsArrayBuffer)
        } else {
          throw new Error('could not read as ArrayBuffer')
        }
      };

      this.text = function() {
        var rejected = consumed(this);
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return readBlobAsText(this._bodyBlob)
        } else if (this._bodyArrayBuffer) {
          return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer))
        } else if (this._bodyFormData) {
          throw new Error('could not read FormData body as text')
        } else {
          return Promise.resolve(this._bodyText)
        }
      };

      if (support.formData) {
        this.formData = function() {
          return this.text().then(decode)
        };
      }

      this.json = function() {
        return this.text().then(JSON.parse)
      };

      return this
    }

    // HTTP methods whose capitalization should be normalized
    var methods = ['CONNECT', 'DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT', 'TRACE'];

    function normalizeMethod(method) {
      var upcased = method.toUpperCase();
      return methods.indexOf(upcased) > -1 ? upcased : method
    }

    function Request$1(input, options) {
      if (!(this instanceof Request$1)) {
        throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.')
      }

      options = options || {};
      var body = options.body;

      if (input instanceof Request$1) {
        if (input.bodyUsed) {
          throw new TypeError('Already read')
        }
        this.url = input.url;
        this.credentials = input.credentials;
        if (!options.headers) {
          this.headers = new Headers$1(input.headers);
        }
        this.method = input.method;
        this.mode = input.mode;
        this.signal = input.signal;
        if (!body && input._bodyInit != null) {
          body = input._bodyInit;
          input.bodyUsed = true;
        }
      } else {
        this.url = String(input);
      }

      this.credentials = options.credentials || this.credentials || 'same-origin';
      if (options.headers || !this.headers) {
        this.headers = new Headers$1(options.headers);
      }
      this.method = normalizeMethod(options.method || this.method || 'GET');
      this.mode = options.mode || this.mode || null;
      this.signal = options.signal || this.signal || (function () {
        if ('AbortController' in g) {
          var ctrl = new AbortController();
          return ctrl.signal;
        }
      }());
      this.referrer = null;

      if ((this.method === 'GET' || this.method === 'HEAD') && body) {
        throw new TypeError('Body not allowed for GET or HEAD requests')
      }
      this._initBody(body);

      if (this.method === 'GET' || this.method === 'HEAD') {
        if (options.cache === 'no-store' || options.cache === 'no-cache') {
          // Search for a '_' parameter in the query string
          var reParamSearch = /([?&])_=[^&]*/;
          if (reParamSearch.test(this.url)) {
            // If it already exists then set the value with the current time
            this.url = this.url.replace(reParamSearch, '$1_=' + new Date().getTime());
          } else {
            // Otherwise add a new '_' parameter to the end with the current time
            var reQueryString = /\?/;
            this.url += (reQueryString.test(this.url) ? '&' : '?') + '_=' + new Date().getTime();
          }
        }
      }
    }

    Request$1.prototype.clone = function() {
      return new Request$1(this, {body: this._bodyInit})
    };

    function decode(body) {
      var form = new FormData();
      body
        .trim()
        .split('&')
        .forEach(function(bytes) {
          if (bytes) {
            var split = bytes.split('=');
            var name = split.shift().replace(/\+/g, ' ');
            var value = split.join('=').replace(/\+/g, ' ');
            form.append(decodeURIComponent(name), decodeURIComponent(value));
          }
        });
      return form
    }

    function parseHeaders(rawHeaders) {
      var headers = new Headers$1();
      // Replace instances of \r\n and \n followed by at least one space or horizontal tab with a space
      // https://tools.ietf.org/html/rfc7230#section-3.2
      var preProcessedHeaders = rawHeaders.replace(/\r?\n[\t ]+/g, ' ');
      // Avoiding split via regex to work around a common IE11 bug with the core-js 3.6.0 regex polyfill
      // https://github.com/github/fetch/issues/748
      // https://github.com/zloirock/core-js/issues/751
      preProcessedHeaders
        .split('\r')
        .map(function(header) {
          return header.indexOf('\n') === 0 ? header.substr(1, header.length) : header
        })
        .forEach(function(line) {
          var parts = line.split(':');
          var key = parts.shift().trim();
          if (key) {
            var value = parts.join(':').trim();
            try {
              headers.append(key, value);
            } catch (error) {
              console.warn('Response ' + error.message);
            }
          }
        });
      return headers
    }

    Body.call(Request$1.prototype);

    function Response(bodyInit, options) {
      if (!(this instanceof Response)) {
        throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.')
      }
      if (!options) {
        options = {};
      }

      this.type = 'default';
      this.status = options.status === undefined ? 200 : options.status;
      if (this.status < 200 || this.status > 599) {
        throw new RangeError("Failed to construct 'Response': The status provided (0) is outside the range [200, 599].")
      }
      this.ok = this.status >= 200 && this.status < 300;
      this.statusText = options.statusText === undefined ? '' : '' + options.statusText;
      this.headers = new Headers$1(options.headers);
      this.url = options.url || '';
      this._initBody(bodyInit);
    }

    Body.call(Response.prototype);

    Response.prototype.clone = function() {
      return new Response(this._bodyInit, {
        status: this.status,
        statusText: this.statusText,
        headers: new Headers$1(this.headers),
        url: this.url
      })
    };

    Response.error = function() {
      var response = new Response(null, {status: 200, statusText: ''});
      response.ok = false;
      response.status = 0;
      response.type = 'error';
      return response
    };

    var redirectStatuses = [301, 302, 303, 307, 308];

    Response.redirect = function(url, status) {
      if (redirectStatuses.indexOf(status) === -1) {
        throw new RangeError('Invalid status code')
      }

      return new Response(null, {status: status, headers: {location: url}})
    };

    var DOMException = g.DOMException;
    try {
      new DOMException();
    } catch (err) {
      DOMException = function(message, name) {
        this.message = message;
        this.name = name;
        var error = Error(message);
        this.stack = error.stack;
      };
      DOMException.prototype = Object.create(Error.prototype);
      DOMException.prototype.constructor = DOMException;
    }

    function fetch$1(input, init) {
      return new Promise(function(resolve, reject) {
        var request = new Request$1(input, init);

        if (request.signal && request.signal.aborted) {
          return reject(new DOMException('Aborted', 'AbortError'))
        }

        var xhr = new XMLHttpRequest();

        function abortXhr() {
          xhr.abort();
        }

        xhr.onload = function() {
          var options = {
            statusText: xhr.statusText,
            headers: parseHeaders(xhr.getAllResponseHeaders() || '')
          };
          // This check if specifically for when a user fetches a file locally from the file system
          // Only if the status is out of a normal range
          if (request.url.indexOf('file://') === 0 && (xhr.status < 200 || xhr.status > 599)) {
            options.status = 200;
          } else {
            options.status = xhr.status;
          }
          options.url = 'responseURL' in xhr ? xhr.responseURL : options.headers.get('X-Request-URL');
          var body = 'response' in xhr ? xhr.response : xhr.responseText;
          setTimeout(function() {
            resolve(new Response(body, options));
          }, 0);
        };

        xhr.onerror = function() {
          setTimeout(function() {
            reject(new TypeError('Network request failed'));
          }, 0);
        };

        xhr.ontimeout = function() {
          setTimeout(function() {
            reject(new TypeError('Network request timed out'));
          }, 0);
        };

        xhr.onabort = function() {
          setTimeout(function() {
            reject(new DOMException('Aborted', 'AbortError'));
          }, 0);
        };

        function fixUrl(url) {
          try {
            return url === '' && g.location.href ? g.location.href : url
          } catch (e) {
            return url
          }
        }

        xhr.open(request.method, fixUrl(request.url), true);

        if (request.credentials === 'include') {
          xhr.withCredentials = true;
        } else if (request.credentials === 'omit') {
          xhr.withCredentials = false;
        }

        if ('responseType' in xhr) {
          if (support.blob) {
            xhr.responseType = 'blob';
          } else if (
            support.arrayBuffer
          ) {
            xhr.responseType = 'arraybuffer';
          }
        }

        if (init && typeof init.headers === 'object' && !(init.headers instanceof Headers$1 || (g.Headers && init.headers instanceof g.Headers))) {
          var names = [];
          Object.getOwnPropertyNames(init.headers).forEach(function(name) {
            names.push(normalizeName(name));
            xhr.setRequestHeader(name, normalizeValue(init.headers[name]));
          });
          request.headers.forEach(function(value, name) {
            if (names.indexOf(name) === -1) {
              xhr.setRequestHeader(name, value);
            }
          });
        } else {
          request.headers.forEach(function(value, name) {
            xhr.setRequestHeader(name, value);
          });
        }

        if (request.signal) {
          request.signal.addEventListener('abort', abortXhr);

          xhr.onreadystatechange = function() {
            // DONE (success or failure)
            if (xhr.readyState === 4) {
              request.signal.removeEventListener('abort', abortXhr);
            }
          };
        }

        xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit);
      })
    }

    fetch$1.polyfill = true;

    if (!g.fetch) {
      g.fetch = fetch$1;
      g.Headers = Headers$1;
      g.Request = Request$1;
      g.Response = Response;
    }

    const isString = obj => typeof obj === 'string';
    const defer = () => {
      let res;
      let rej;
      const promise = new Promise((resolve, reject) => {
        res = resolve;
        rej = reject;
      });
      promise.resolve = res;
      promise.reject = rej;
      return promise;
    };
    const makeString = object => {
      if (object == null) return '';
      return '' + object;
    };
    const copy = (a, s, t) => {
      a.forEach(m => {
        if (s[m]) t[m] = s[m];
      });
    };
    const lastOfPathSeparatorRegExp = /###/g;
    const cleanKey = key => key && key.indexOf('###') > -1 ? key.replace(lastOfPathSeparatorRegExp, '.') : key;
    const canNotTraverseDeeper = object => !object || isString(object);
    const getLastOfPath = (object, path, Empty) => {
      const stack = !isString(path) ? path : path.split('.');
      let stackIndex = 0;
      while (stackIndex < stack.length - 1) {
        if (canNotTraverseDeeper(object)) return {};
        const key = cleanKey(stack[stackIndex]);
        if (!object[key] && Empty) object[key] = new Empty();
        if (Object.prototype.hasOwnProperty.call(object, key)) {
          object = object[key];
        } else {
          object = {};
        }
        ++stackIndex;
      }
      if (canNotTraverseDeeper(object)) return {};
      return {
        obj: object,
        k: cleanKey(stack[stackIndex])
      };
    };
    const setPath = (object, path, newValue) => {
      const {
        obj,
        k
      } = getLastOfPath(object, path, Object);
      if (obj !== undefined || path.length === 1) {
        obj[k] = newValue;
        return;
      }
      let e = path[path.length - 1];
      let p = path.slice(0, path.length - 1);
      let last = getLastOfPath(object, p, Object);
      while (last.obj === undefined && p.length) {
        e = `${p[p.length - 1]}.${e}`;
        p = p.slice(0, p.length - 1);
        last = getLastOfPath(object, p, Object);
        if (last?.obj && typeof last.obj[`${last.k}.${e}`] !== 'undefined') {
          last.obj = undefined;
        }
      }
      last.obj[`${last.k}.${e}`] = newValue;
    };
    const pushPath = (object, path, newValue, concat) => {
      const {
        obj,
        k
      } = getLastOfPath(object, path, Object);
      obj[k] = obj[k] || [];
      obj[k].push(newValue);
    };
    const getPath = (object, path) => {
      const {
        obj,
        k
      } = getLastOfPath(object, path);
      if (!obj) return undefined;
      if (!Object.prototype.hasOwnProperty.call(obj, k)) return undefined;
      return obj[k];
    };
    const getPathWithDefaults = (data, defaultData, key) => {
      const value = getPath(data, key);
      if (value !== undefined) {
        return value;
      }
      return getPath(defaultData, key);
    };
    const deepExtend = (target, source, overwrite) => {
      for (const prop in source) {
        if (prop !== '__proto__' && prop !== 'constructor') {
          if (prop in target) {
            if (isString(target[prop]) || target[prop] instanceof String || isString(source[prop]) || source[prop] instanceof String) {
              if (overwrite) target[prop] = source[prop];
            } else {
              deepExtend(target[prop], source[prop], overwrite);
            }
          } else {
            target[prop] = source[prop];
          }
        }
      }
      return target;
    };
    const regexEscape = str => str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
    var _entityMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;'
    };
    const escape = data => {
      if (isString(data)) {
        return data.replace(/[&<>"'\/]/g, s => _entityMap[s]);
      }
      return data;
    };
    class RegExpCache {
      constructor(capacity) {
        this.capacity = capacity;
        this.regExpMap = new Map();
        this.regExpQueue = [];
      }
      getRegExp(pattern) {
        const regExpFromCache = this.regExpMap.get(pattern);
        if (regExpFromCache !== undefined) {
          return regExpFromCache;
        }
        const regExpNew = new RegExp(pattern);
        if (this.regExpQueue.length === this.capacity) {
          this.regExpMap.delete(this.regExpQueue.shift());
        }
        this.regExpMap.set(pattern, regExpNew);
        this.regExpQueue.push(pattern);
        return regExpNew;
      }
    }
    const chars = [' ', ',', '?', '!', ';'];
    const looksLikeObjectPathRegExpCache = new RegExpCache(20);
    const looksLikeObjectPath = (key, nsSeparator, keySeparator) => {
      nsSeparator = nsSeparator || '';
      keySeparator = keySeparator || '';
      const possibleChars = chars.filter(c => nsSeparator.indexOf(c) < 0 && keySeparator.indexOf(c) < 0);
      if (possibleChars.length === 0) return true;
      const r = looksLikeObjectPathRegExpCache.getRegExp(`(${possibleChars.map(c => c === '?' ? '\\?' : c).join('|')})`);
      let matched = !r.test(key);
      if (!matched) {
        const ki = key.indexOf(keySeparator);
        if (ki > 0 && !r.test(key.substring(0, ki))) {
          matched = true;
        }
      }
      return matched;
    };
    const deepFind = (obj, path, keySeparator = '.') => {
      if (!obj) return undefined;
      if (obj[path]) {
        if (!Object.prototype.hasOwnProperty.call(obj, path)) return undefined;
        return obj[path];
      }
      const tokens = path.split(keySeparator);
      let current = obj;
      for (let i = 0; i < tokens.length;) {
        if (!current || typeof current !== 'object') {
          return undefined;
        }
        let next;
        let nextPath = '';
        for (let j = i; j < tokens.length; ++j) {
          if (j !== i) {
            nextPath += keySeparator;
          }
          nextPath += tokens[j];
          next = current[nextPath];
          if (next !== undefined) {
            if (['string', 'number', 'boolean'].indexOf(typeof next) > -1 && j < tokens.length - 1) {
              continue;
            }
            i += j - i + 1;
            break;
          }
        }
        current = next;
      }
      return current;
    };
    const getCleanedCode = code => code?.replace(/_/g, '-');

    const consoleLogger = {
      type: 'logger',
      log(args) {
        this.output('log', args);
      },
      warn(args) {
        this.output('warn', args);
      },
      error(args) {
        this.output('error', args);
      },
      output(type, args) {
        console?.[type]?.apply?.(console, args);
      }
    };
    class Logger {
      constructor(concreteLogger, options = {}) {
        this.init(concreteLogger, options);
      }
      init(concreteLogger, options = {}) {
        this.prefix = options.prefix || 'i18next:';
        this.logger = concreteLogger || consoleLogger;
        this.options = options;
        this.debug = options.debug;
      }
      log(...args) {
        return this.forward(args, 'log', '', true);
      }
      warn(...args) {
        return this.forward(args, 'warn', '', true);
      }
      error(...args) {
        return this.forward(args, 'error', '');
      }
      deprecate(...args) {
        return this.forward(args, 'warn', 'WARNING DEPRECATED: ', true);
      }
      forward(args, lvl, prefix, debugOnly) {
        if (debugOnly && !this.debug) return null;
        if (isString(args[0])) args[0] = `${prefix}${this.prefix} ${args[0]}`;
        return this.logger[lvl](args);
      }
      create(moduleName) {
        return new Logger(this.logger, {
          ...{
            prefix: `${this.prefix}:${moduleName}:`
          },
          ...this.options
        });
      }
      clone(options) {
        options = options || this.options;
        options.prefix = options.prefix || this.prefix;
        return new Logger(this.logger, options);
      }
    }
    var baseLogger = new Logger();

    class EventEmitter {
      constructor() {
        this.observers = {};
      }
      on(events, listener) {
        events.split(' ').forEach(event => {
          if (!this.observers[event]) this.observers[event] = new Map();
          const numListeners = this.observers[event].get(listener) || 0;
          this.observers[event].set(listener, numListeners + 1);
        });
        return this;
      }
      off(event, listener) {
        if (!this.observers[event]) return;
        if (!listener) {
          delete this.observers[event];
          return;
        }
        this.observers[event].delete(listener);
      }
      emit(event, ...args) {
        if (this.observers[event]) {
          const cloned = Array.from(this.observers[event].entries());
          cloned.forEach(([observer, numTimesAdded]) => {
            for (let i = 0; i < numTimesAdded; i++) {
              observer(...args);
            }
          });
        }
        if (this.observers['*']) {
          const cloned = Array.from(this.observers['*'].entries());
          cloned.forEach(([observer, numTimesAdded]) => {
            for (let i = 0; i < numTimesAdded; i++) {
              observer.apply(observer, [event, ...args]);
            }
          });
        }
      }
    }

    class ResourceStore extends EventEmitter {
      constructor(data, options = {
        ns: ['translation'],
        defaultNS: 'translation'
      }) {
        super();
        this.data = data || {};
        this.options = options;
        if (this.options.keySeparator === undefined) {
          this.options.keySeparator = '.';
        }
        if (this.options.ignoreJSONStructure === undefined) {
          this.options.ignoreJSONStructure = true;
        }
      }
      addNamespaces(ns) {
        if (this.options.ns.indexOf(ns) < 0) {
          this.options.ns.push(ns);
        }
      }
      removeNamespaces(ns) {
        const index = this.options.ns.indexOf(ns);
        if (index > -1) {
          this.options.ns.splice(index, 1);
        }
      }
      getResource(lng, ns, key, options = {}) {
        const keySeparator = options.keySeparator !== undefined ? options.keySeparator : this.options.keySeparator;
        const ignoreJSONStructure = options.ignoreJSONStructure !== undefined ? options.ignoreJSONStructure : this.options.ignoreJSONStructure;
        let path;
        if (lng.indexOf('.') > -1) {
          path = lng.split('.');
        } else {
          path = [lng, ns];
          if (key) {
            if (Array.isArray(key)) {
              path.push(...key);
            } else if (isString(key) && keySeparator) {
              path.push(...key.split(keySeparator));
            } else {
              path.push(key);
            }
          }
        }
        const result = getPath(this.data, path);
        if (!result && !ns && !key && lng.indexOf('.') > -1) {
          lng = path[0];
          ns = path[1];
          key = path.slice(2).join('.');
        }
        if (result || !ignoreJSONStructure || !isString(key)) return result;
        return deepFind(this.data?.[lng]?.[ns], key, keySeparator);
      }
      addResource(lng, ns, key, value, options = {
        silent: false
      }) {
        const keySeparator = options.keySeparator !== undefined ? options.keySeparator : this.options.keySeparator;
        let path = [lng, ns];
        if (key) path = path.concat(keySeparator ? key.split(keySeparator) : key);
        if (lng.indexOf('.') > -1) {
          path = lng.split('.');
          value = ns;
          ns = path[1];
        }
        this.addNamespaces(ns);
        setPath(this.data, path, value);
        if (!options.silent) this.emit('added', lng, ns, key, value);
      }
      addResources(lng, ns, resources, options = {
        silent: false
      }) {
        for (const m in resources) {
          if (isString(resources[m]) || Array.isArray(resources[m])) this.addResource(lng, ns, m, resources[m], {
            silent: true
          });
        }
        if (!options.silent) this.emit('added', lng, ns, resources);
      }
      addResourceBundle(lng, ns, resources, deep, overwrite, options = {
        silent: false,
        skipCopy: false
      }) {
        let path = [lng, ns];
        if (lng.indexOf('.') > -1) {
          path = lng.split('.');
          deep = resources;
          resources = ns;
          ns = path[1];
        }
        this.addNamespaces(ns);
        let pack = getPath(this.data, path) || {};
        if (!options.skipCopy) resources = JSON.parse(JSON.stringify(resources));
        if (deep) {
          deepExtend(pack, resources, overwrite);
        } else {
          pack = {
            ...pack,
            ...resources
          };
        }
        setPath(this.data, path, pack);
        if (!options.silent) this.emit('added', lng, ns, resources);
      }
      removeResourceBundle(lng, ns) {
        if (this.hasResourceBundle(lng, ns)) {
          delete this.data[lng][ns];
        }
        this.removeNamespaces(ns);
        this.emit('removed', lng, ns);
      }
      hasResourceBundle(lng, ns) {
        return this.getResource(lng, ns) !== undefined;
      }
      getResourceBundle(lng, ns) {
        if (!ns) ns = this.options.defaultNS;
        return this.getResource(lng, ns);
      }
      getDataByLanguage(lng) {
        return this.data[lng];
      }
      hasLanguageSomeTranslations(lng) {
        const data = this.getDataByLanguage(lng);
        const n = data && Object.keys(data) || [];
        return !!n.find(v => data[v] && Object.keys(data[v]).length > 0);
      }
      toJSON() {
        return this.data;
      }
    }

    var postProcessor = {
      processors: {},
      addPostProcessor(module) {
        this.processors[module.name] = module;
      },
      handle(processors, value, key, options, translator) {
        processors.forEach(processor => {
          value = this.processors[processor]?.process(value, key, options, translator) ?? value;
        });
        return value;
      }
    };

    const PATH_KEY = Symbol('i18next/PATH_KEY');
    function createProxy() {
      const state = [];
      const handler = Object.create(null);
      let proxy;
      handler.get = (target, key) => {
        proxy?.revoke?.();
        if (key === PATH_KEY) return state;
        state.push(key);
        proxy = Proxy.revocable(target, handler);
        return proxy.proxy;
      };
      return Proxy.revocable(Object.create(null), handler).proxy;
    }
    function keysFromSelector(selector, opts) {
      const {
        [PATH_KEY]: path
      } = selector(createProxy());
      const keySeparator = opts?.keySeparator ?? '.';
      const nsSeparator = opts?.nsSeparator ?? ':';
      if (path.length > 1 && nsSeparator) {
        const ns = opts?.ns;
        const namespaces = ns ? Array.isArray(ns) ? ns : [ns] : [];
        if (namespaces.includes(path[0])) {
          return `${path[0]}${nsSeparator}${path.slice(1).join(keySeparator)}`;
        }
      }
      return path.join(keySeparator);
    }

    const checkedLoadedFor = {};
    const shouldHandleAsObject = res => !isString(res) && typeof res !== 'boolean' && typeof res !== 'number';
    class Translator extends EventEmitter {
      constructor(services, options = {}) {
        super();
        copy(['resourceStore', 'languageUtils', 'pluralResolver', 'interpolator', 'backendConnector', 'i18nFormat', 'utils'], services, this);
        this.options = options;
        if (this.options.keySeparator === undefined) {
          this.options.keySeparator = '.';
        }
        this.logger = baseLogger.create('translator');
      }
      changeLanguage(lng) {
        if (lng) this.language = lng;
      }
      exists(key, o = {
        interpolation: {}
      }) {
        const opt = {
          ...o
        };
        if (key == null) return false;
        const resolved = this.resolve(key, opt);
        if (resolved?.res === undefined) return false;
        const isObject = shouldHandleAsObject(resolved.res);
        if (opt.returnObjects === false && isObject) {
          return false;
        }
        return true;
      }
      extractFromKey(key, opt) {
        let nsSeparator = opt.nsSeparator !== undefined ? opt.nsSeparator : this.options.nsSeparator;
        if (nsSeparator === undefined) nsSeparator = ':';
        const keySeparator = opt.keySeparator !== undefined ? opt.keySeparator : this.options.keySeparator;
        let namespaces = opt.ns || this.options.defaultNS || [];
        const wouldCheckForNsInKey = nsSeparator && key.indexOf(nsSeparator) > -1;
        const seemsNaturalLanguage = !this.options.userDefinedKeySeparator && !opt.keySeparator && !this.options.userDefinedNsSeparator && !opt.nsSeparator && !looksLikeObjectPath(key, nsSeparator, keySeparator);
        if (wouldCheckForNsInKey && !seemsNaturalLanguage) {
          const m = key.match(this.interpolator.nestingRegexp);
          if (m && m.length > 0) {
            return {
              key,
              namespaces: isString(namespaces) ? [namespaces] : namespaces
            };
          }
          const parts = key.split(nsSeparator);
          if (nsSeparator !== keySeparator || nsSeparator === keySeparator && this.options.ns.indexOf(parts[0]) > -1) namespaces = parts.shift();
          key = parts.join(keySeparator);
        }
        return {
          key,
          namespaces: isString(namespaces) ? [namespaces] : namespaces
        };
      }
      translate(keys, o, lastKey) {
        let opt = typeof o === 'object' ? {
          ...o
        } : o;
        if (typeof opt !== 'object' && this.options.overloadTranslationOptionHandler) {
          opt = this.options.overloadTranslationOptionHandler(arguments);
        }
        if (typeof opt === 'object') opt = {
          ...opt
        };
        if (!opt) opt = {};
        if (keys == null) return '';
        if (typeof keys === 'function') keys = keysFromSelector(keys, {
          ...this.options,
          ...opt
        });
        if (!Array.isArray(keys)) keys = [String(keys)];
        keys = keys.map(k => typeof k === 'function' ? keysFromSelector(k, {
          ...this.options,
          ...opt
        }) : String(k));
        const returnDetails = opt.returnDetails !== undefined ? opt.returnDetails : this.options.returnDetails;
        const keySeparator = opt.keySeparator !== undefined ? opt.keySeparator : this.options.keySeparator;
        const {
          key,
          namespaces
        } = this.extractFromKey(keys[keys.length - 1], opt);
        const namespace = namespaces[namespaces.length - 1];
        let nsSeparator = opt.nsSeparator !== undefined ? opt.nsSeparator : this.options.nsSeparator;
        if (nsSeparator === undefined) nsSeparator = ':';
        const lng = opt.lng || this.language;
        const appendNamespaceToCIMode = opt.appendNamespaceToCIMode || this.options.appendNamespaceToCIMode;
        if (lng?.toLowerCase() === 'cimode') {
          if (appendNamespaceToCIMode) {
            if (returnDetails) {
              return {
                res: `${namespace}${nsSeparator}${key}`,
                usedKey: key,
                exactUsedKey: key,
                usedLng: lng,
                usedNS: namespace,
                usedParams: this.getUsedParamsDetails(opt)
              };
            }
            return `${namespace}${nsSeparator}${key}`;
          }
          if (returnDetails) {
            return {
              res: key,
              usedKey: key,
              exactUsedKey: key,
              usedLng: lng,
              usedNS: namespace,
              usedParams: this.getUsedParamsDetails(opt)
            };
          }
          return key;
        }
        const resolved = this.resolve(keys, opt);
        let res = resolved?.res;
        const resUsedKey = resolved?.usedKey || key;
        const resExactUsedKey = resolved?.exactUsedKey || key;
        const noObject = ['[object Number]', '[object Function]', '[object RegExp]'];
        const joinArrays = opt.joinArrays !== undefined ? opt.joinArrays : this.options.joinArrays;
        const handleAsObjectInI18nFormat = !this.i18nFormat || this.i18nFormat.handleAsObject;
        const needsPluralHandling = opt.count !== undefined && !isString(opt.count);
        const hasDefaultValue = Translator.hasDefaultValue(opt);
        const defaultValueSuffix = needsPluralHandling ? this.pluralResolver.getSuffix(lng, opt.count, opt) : '';
        const defaultValueSuffixOrdinalFallback = opt.ordinal && needsPluralHandling ? this.pluralResolver.getSuffix(lng, opt.count, {
          ordinal: false
        }) : '';
        const needsZeroSuffixLookup = needsPluralHandling && !opt.ordinal && opt.count === 0;
        const defaultValue = needsZeroSuffixLookup && opt[`defaultValue${this.options.pluralSeparator}zero`] || opt[`defaultValue${defaultValueSuffix}`] || opt[`defaultValue${defaultValueSuffixOrdinalFallback}`] || opt.defaultValue;
        let resForObjHndl = res;
        if (handleAsObjectInI18nFormat && !res && hasDefaultValue) {
          resForObjHndl = defaultValue;
        }
        const handleAsObject = shouldHandleAsObject(resForObjHndl);
        const resType = Object.prototype.toString.apply(resForObjHndl);
        if (handleAsObjectInI18nFormat && resForObjHndl && handleAsObject && noObject.indexOf(resType) < 0 && !(isString(joinArrays) && Array.isArray(resForObjHndl))) {
          if (!opt.returnObjects && !this.options.returnObjects) {
            if (!this.options.returnedObjectHandler) {
              this.logger.warn('accessing an object - but returnObjects options is not enabled!');
            }
            const r = this.options.returnedObjectHandler ? this.options.returnedObjectHandler(resUsedKey, resForObjHndl, {
              ...opt,
              ns: namespaces
            }) : `key '${key} (${this.language})' returned an object instead of string.`;
            if (returnDetails) {
              resolved.res = r;
              resolved.usedParams = this.getUsedParamsDetails(opt);
              return resolved;
            }
            return r;
          }
          if (keySeparator) {
            const resTypeIsArray = Array.isArray(resForObjHndl);
            const copy = resTypeIsArray ? [] : {};
            const newKeyToUse = resTypeIsArray ? resExactUsedKey : resUsedKey;
            for (const m in resForObjHndl) {
              if (Object.prototype.hasOwnProperty.call(resForObjHndl, m)) {
                const deepKey = `${newKeyToUse}${keySeparator}${m}`;
                if (hasDefaultValue && !res) {
                  copy[m] = this.translate(deepKey, {
                    ...opt,
                    defaultValue: shouldHandleAsObject(defaultValue) ? defaultValue[m] : undefined,
                    ...{
                      joinArrays: false,
                      ns: namespaces
                    }
                  });
                } else {
                  copy[m] = this.translate(deepKey, {
                    ...opt,
                    ...{
                      joinArrays: false,
                      ns: namespaces
                    }
                  });
                }
                if (copy[m] === deepKey) copy[m] = resForObjHndl[m];
              }
            }
            res = copy;
          }
        } else if (handleAsObjectInI18nFormat && isString(joinArrays) && Array.isArray(res)) {
          res = res.join(joinArrays);
          if (res) res = this.extendTranslation(res, keys, opt, lastKey);
        } else {
          let usedDefault = false;
          let usedKey = false;
          if (!this.isValidLookup(res) && hasDefaultValue) {
            usedDefault = true;
            res = defaultValue;
          }
          if (!this.isValidLookup(res)) {
            usedKey = true;
            res = key;
          }
          const missingKeyNoValueFallbackToKey = opt.missingKeyNoValueFallbackToKey || this.options.missingKeyNoValueFallbackToKey;
          const resForMissing = missingKeyNoValueFallbackToKey && usedKey ? undefined : res;
          const updateMissing = hasDefaultValue && defaultValue !== res && this.options.updateMissing;
          if (usedKey || usedDefault || updateMissing) {
            this.logger.log(updateMissing ? 'updateKey' : 'missingKey', lng, namespace, key, updateMissing ? defaultValue : res);
            if (keySeparator) {
              const fk = this.resolve(key, {
                ...opt,
                keySeparator: false
              });
              if (fk && fk.res) this.logger.warn('Seems the loaded translations were in flat JSON format instead of nested. Either set keySeparator: false on init or make sure your translations are published in nested format.');
            }
            let lngs = [];
            const fallbackLngs = this.languageUtils.getFallbackCodes(this.options.fallbackLng, opt.lng || this.language);
            if (this.options.saveMissingTo === 'fallback' && fallbackLngs && fallbackLngs[0]) {
              for (let i = 0; i < fallbackLngs.length; i++) {
                lngs.push(fallbackLngs[i]);
              }
            } else if (this.options.saveMissingTo === 'all') {
              lngs = this.languageUtils.toResolveHierarchy(opt.lng || this.language);
            } else {
              lngs.push(opt.lng || this.language);
            }
            const send = (l, k, specificDefaultValue) => {
              const defaultForMissing = hasDefaultValue && specificDefaultValue !== res ? specificDefaultValue : resForMissing;
              if (this.options.missingKeyHandler) {
                this.options.missingKeyHandler(l, namespace, k, defaultForMissing, updateMissing, opt);
              } else if (this.backendConnector?.saveMissing) {
                this.backendConnector.saveMissing(l, namespace, k, defaultForMissing, updateMissing, opt);
              }
              this.emit('missingKey', l, namespace, k, res);
            };
            if (this.options.saveMissing) {
              if (this.options.saveMissingPlurals && needsPluralHandling) {
                lngs.forEach(language => {
                  const suffixes = this.pluralResolver.getSuffixes(language, opt);
                  if (needsZeroSuffixLookup && opt[`defaultValue${this.options.pluralSeparator}zero`] && suffixes.indexOf(`${this.options.pluralSeparator}zero`) < 0) {
                    suffixes.push(`${this.options.pluralSeparator}zero`);
                  }
                  suffixes.forEach(suffix => {
                    send([language], key + suffix, opt[`defaultValue${suffix}`] || defaultValue);
                  });
                });
              } else {
                send(lngs, key, defaultValue);
              }
            }
          }
          res = this.extendTranslation(res, keys, opt, resolved, lastKey);
          if (usedKey && res === key && this.options.appendNamespaceToMissingKey) {
            res = `${namespace}${nsSeparator}${key}`;
          }
          if ((usedKey || usedDefault) && this.options.parseMissingKeyHandler) {
            res = this.options.parseMissingKeyHandler(this.options.appendNamespaceToMissingKey ? `${namespace}${nsSeparator}${key}` : key, usedDefault ? res : undefined, opt);
          }
        }
        if (returnDetails) {
          resolved.res = res;
          resolved.usedParams = this.getUsedParamsDetails(opt);
          return resolved;
        }
        return res;
      }
      extendTranslation(res, key, opt, resolved, lastKey) {
        if (this.i18nFormat?.parse) {
          res = this.i18nFormat.parse(res, {
            ...this.options.interpolation.defaultVariables,
            ...opt
          }, opt.lng || this.language || resolved.usedLng, resolved.usedNS, resolved.usedKey, {
            resolved
          });
        } else if (!opt.skipInterpolation) {
          if (opt.interpolation) this.interpolator.init({
            ...opt,
            ...{
              interpolation: {
                ...this.options.interpolation,
                ...opt.interpolation
              }
            }
          });
          const skipOnVariables = isString(res) && (opt?.interpolation?.skipOnVariables !== undefined ? opt.interpolation.skipOnVariables : this.options.interpolation.skipOnVariables);
          let nestBef;
          if (skipOnVariables) {
            const nb = res.match(this.interpolator.nestingRegexp);
            nestBef = nb && nb.length;
          }
          let data = opt.replace && !isString(opt.replace) ? opt.replace : opt;
          if (this.options.interpolation.defaultVariables) data = {
            ...this.options.interpolation.defaultVariables,
            ...data
          };
          res = this.interpolator.interpolate(res, data, opt.lng || this.language || resolved.usedLng, opt);
          if (skipOnVariables) {
            const na = res.match(this.interpolator.nestingRegexp);
            const nestAft = na && na.length;
            if (nestBef < nestAft) opt.nest = false;
          }
          if (!opt.lng && resolved && resolved.res) opt.lng = this.language || resolved.usedLng;
          if (opt.nest !== false) res = this.interpolator.nest(res, (...args) => {
            if (lastKey?.[0] === args[0] && !opt.context) {
              this.logger.warn(`It seems you are nesting recursively key: ${args[0]} in key: ${key[0]}`);
              return null;
            }
            return this.translate(...args, key);
          }, opt);
          if (opt.interpolation) this.interpolator.reset();
        }
        const postProcess = opt.postProcess || this.options.postProcess;
        const postProcessorNames = isString(postProcess) ? [postProcess] : postProcess;
        if (res != null && postProcessorNames?.length && opt.applyPostProcessor !== false) {
          res = postProcessor.handle(postProcessorNames, res, key, this.options && this.options.postProcessPassResolved ? {
            i18nResolved: {
              ...resolved,
              usedParams: this.getUsedParamsDetails(opt)
            },
            ...opt
          } : opt, this);
        }
        return res;
      }
      resolve(keys, opt = {}) {
        let found;
        let usedKey;
        let exactUsedKey;
        let usedLng;
        let usedNS;
        if (isString(keys)) keys = [keys];
        if (Array.isArray(keys)) keys = keys.map(k => typeof k === 'function' ? keysFromSelector(k, {
          ...this.options,
          ...opt
        }) : k);
        keys.forEach(k => {
          if (this.isValidLookup(found)) return;
          const extracted = this.extractFromKey(k, opt);
          const key = extracted.key;
          usedKey = key;
          let namespaces = extracted.namespaces;
          if (this.options.fallbackNS) namespaces = namespaces.concat(this.options.fallbackNS);
          const needsPluralHandling = opt.count !== undefined && !isString(opt.count);
          const needsZeroSuffixLookup = needsPluralHandling && !opt.ordinal && opt.count === 0;
          const needsContextHandling = opt.context !== undefined && (isString(opt.context) || typeof opt.context === 'number') && opt.context !== '';
          const codes = opt.lngs ? opt.lngs : this.languageUtils.toResolveHierarchy(opt.lng || this.language, opt.fallbackLng);
          namespaces.forEach(ns => {
            if (this.isValidLookup(found)) return;
            usedNS = ns;
            if (!checkedLoadedFor[`${codes[0]}-${ns}`] && this.utils?.hasLoadedNamespace && !this.utils?.hasLoadedNamespace(usedNS)) {
              checkedLoadedFor[`${codes[0]}-${ns}`] = true;
              this.logger.warn(`key "${usedKey}" for languages "${codes.join(', ')}" won't get resolved as namespace "${usedNS}" was not yet loaded`, 'This means something IS WRONG in your setup. You access the t function before i18next.init / i18next.loadNamespace / i18next.changeLanguage was done. Wait for the callback or Promise to resolve before accessing it!!!');
            }
            codes.forEach(code => {
              if (this.isValidLookup(found)) return;
              usedLng = code;
              const finalKeys = [key];
              if (this.i18nFormat?.addLookupKeys) {
                this.i18nFormat.addLookupKeys(finalKeys, key, code, ns, opt);
              } else {
                let pluralSuffix;
                if (needsPluralHandling) pluralSuffix = this.pluralResolver.getSuffix(code, opt.count, opt);
                const zeroSuffix = `${this.options.pluralSeparator}zero`;
                const ordinalPrefix = `${this.options.pluralSeparator}ordinal${this.options.pluralSeparator}`;
                if (needsPluralHandling) {
                  if (opt.ordinal && pluralSuffix.indexOf(ordinalPrefix) === 0) {
                    finalKeys.push(key + pluralSuffix.replace(ordinalPrefix, this.options.pluralSeparator));
                  }
                  finalKeys.push(key + pluralSuffix);
                  if (needsZeroSuffixLookup) {
                    finalKeys.push(key + zeroSuffix);
                  }
                }
                if (needsContextHandling) {
                  const contextKey = `${key}${this.options.contextSeparator || '_'}${opt.context}`;
                  finalKeys.push(contextKey);
                  if (needsPluralHandling) {
                    if (opt.ordinal && pluralSuffix.indexOf(ordinalPrefix) === 0) {
                      finalKeys.push(contextKey + pluralSuffix.replace(ordinalPrefix, this.options.pluralSeparator));
                    }
                    finalKeys.push(contextKey + pluralSuffix);
                    if (needsZeroSuffixLookup) {
                      finalKeys.push(contextKey + zeroSuffix);
                    }
                  }
                }
              }
              let possibleKey;
              while (possibleKey = finalKeys.pop()) {
                if (!this.isValidLookup(found)) {
                  exactUsedKey = possibleKey;
                  found = this.getResource(code, ns, possibleKey, opt);
                }
              }
            });
          });
        });
        return {
          res: found,
          usedKey,
          exactUsedKey,
          usedLng,
          usedNS
        };
      }
      isValidLookup(res) {
        return res !== undefined && !(!this.options.returnNull && res === null) && !(!this.options.returnEmptyString && res === '');
      }
      getResource(code, ns, key, options = {}) {
        if (this.i18nFormat?.getResource) return this.i18nFormat.getResource(code, ns, key, options);
        return this.resourceStore.getResource(code, ns, key, options);
      }
      getUsedParamsDetails(options = {}) {
        const optionsKeys = ['defaultValue', 'ordinal', 'context', 'replace', 'lng', 'lngs', 'fallbackLng', 'ns', 'keySeparator', 'nsSeparator', 'returnObjects', 'returnDetails', 'joinArrays', 'postProcess', 'interpolation'];
        const useOptionsReplaceForData = options.replace && !isString(options.replace);
        let data = useOptionsReplaceForData ? options.replace : options;
        if (useOptionsReplaceForData && typeof options.count !== 'undefined') {
          data.count = options.count;
        }
        if (this.options.interpolation.defaultVariables) {
          data = {
            ...this.options.interpolation.defaultVariables,
            ...data
          };
        }
        if (!useOptionsReplaceForData) {
          data = {
            ...data
          };
          for (const key of optionsKeys) {
            delete data[key];
          }
        }
        return data;
      }
      static hasDefaultValue(options) {
        const prefix = 'defaultValue';
        for (const option in options) {
          if (Object.prototype.hasOwnProperty.call(options, option) && prefix === option.substring(0, prefix.length) && undefined !== options[option]) {
            return true;
          }
        }
        return false;
      }
    }

    class LanguageUtil {
      constructor(options) {
        this.options = options;
        this.supportedLngs = this.options.supportedLngs || false;
        this.logger = baseLogger.create('languageUtils');
      }
      getScriptPartFromCode(code) {
        code = getCleanedCode(code);
        if (!code || code.indexOf('-') < 0) return null;
        const p = code.split('-');
        if (p.length === 2) return null;
        p.pop();
        if (p[p.length - 1].toLowerCase() === 'x') return null;
        return this.formatLanguageCode(p.join('-'));
      }
      getLanguagePartFromCode(code) {
        code = getCleanedCode(code);
        if (!code || code.indexOf('-') < 0) return code;
        const p = code.split('-');
        return this.formatLanguageCode(p[0]);
      }
      formatLanguageCode(code) {
        if (isString(code) && code.indexOf('-') > -1) {
          let formattedCode;
          try {
            formattedCode = Intl.getCanonicalLocales(code)[0];
          } catch (e) {}
          if (formattedCode && this.options.lowerCaseLng) {
            formattedCode = formattedCode.toLowerCase();
          }
          if (formattedCode) return formattedCode;
          if (this.options.lowerCaseLng) {
            return code.toLowerCase();
          }
          return code;
        }
        return this.options.cleanCode || this.options.lowerCaseLng ? code.toLowerCase() : code;
      }
      isSupportedCode(code) {
        if (this.options.load === 'languageOnly' || this.options.nonExplicitSupportedLngs) {
          code = this.getLanguagePartFromCode(code);
        }
        return !this.supportedLngs || !this.supportedLngs.length || this.supportedLngs.indexOf(code) > -1;
      }
      getBestMatchFromCodes(codes) {
        if (!codes) return null;
        let found;
        codes.forEach(code => {
          if (found) return;
          const cleanedLng = this.formatLanguageCode(code);
          if (!this.options.supportedLngs || this.isSupportedCode(cleanedLng)) found = cleanedLng;
        });
        if (!found && this.options.supportedLngs) {
          codes.forEach(code => {
            if (found) return;
            const lngScOnly = this.getScriptPartFromCode(code);
            if (this.isSupportedCode(lngScOnly)) return found = lngScOnly;
            const lngOnly = this.getLanguagePartFromCode(code);
            if (this.isSupportedCode(lngOnly)) return found = lngOnly;
            found = this.options.supportedLngs.find(supportedLng => {
              if (supportedLng === lngOnly) return supportedLng;
              if (supportedLng.indexOf('-') < 0 && lngOnly.indexOf('-') < 0) return;
              if (supportedLng.indexOf('-') > 0 && lngOnly.indexOf('-') < 0 && supportedLng.substring(0, supportedLng.indexOf('-')) === lngOnly) return supportedLng;
              if (supportedLng.indexOf(lngOnly) === 0 && lngOnly.length > 1) return supportedLng;
            });
          });
        }
        if (!found) found = this.getFallbackCodes(this.options.fallbackLng)[0];
        return found;
      }
      getFallbackCodes(fallbacks, code) {
        if (!fallbacks) return [];
        if (typeof fallbacks === 'function') fallbacks = fallbacks(code);
        if (isString(fallbacks)) fallbacks = [fallbacks];
        if (Array.isArray(fallbacks)) return fallbacks;
        if (!code) return fallbacks.default || [];
        let found = fallbacks[code];
        if (!found) found = fallbacks[this.getScriptPartFromCode(code)];
        if (!found) found = fallbacks[this.formatLanguageCode(code)];
        if (!found) found = fallbacks[this.getLanguagePartFromCode(code)];
        if (!found) found = fallbacks.default;
        return found || [];
      }
      toResolveHierarchy(code, fallbackCode) {
        const fallbackCodes = this.getFallbackCodes((fallbackCode === false ? [] : fallbackCode) || this.options.fallbackLng || [], code);
        const codes = [];
        const addCode = c => {
          if (!c) return;
          if (this.isSupportedCode(c)) {
            codes.push(c);
          } else {
            this.logger.warn(`rejecting language code not found in supportedLngs: ${c}`);
          }
        };
        if (isString(code) && (code.indexOf('-') > -1 || code.indexOf('_') > -1)) {
          if (this.options.load !== 'languageOnly') addCode(this.formatLanguageCode(code));
          if (this.options.load !== 'languageOnly' && this.options.load !== 'currentOnly') addCode(this.getScriptPartFromCode(code));
          if (this.options.load !== 'currentOnly') addCode(this.getLanguagePartFromCode(code));
        } else if (isString(code)) {
          addCode(this.formatLanguageCode(code));
        }
        fallbackCodes.forEach(fc => {
          if (codes.indexOf(fc) < 0) addCode(this.formatLanguageCode(fc));
        });
        return codes;
      }
    }

    const suffixesOrder = {
      zero: 0,
      one: 1,
      two: 2,
      few: 3,
      many: 4,
      other: 5
    };
    const dummyRule = {
      select: count => count === 1 ? 'one' : 'other',
      resolvedOptions: () => ({
        pluralCategories: ['one', 'other']
      })
    };
    class PluralResolver {
      constructor(languageUtils, options = {}) {
        this.languageUtils = languageUtils;
        this.options = options;
        this.logger = baseLogger.create('pluralResolver');
        this.pluralRulesCache = {};
      }
      clearCache() {
        this.pluralRulesCache = {};
      }
      getRule(code, options = {}) {
        const cleanedCode = getCleanedCode(code === 'dev' ? 'en' : code);
        const type = options.ordinal ? 'ordinal' : 'cardinal';
        const cacheKey = JSON.stringify({
          cleanedCode,
          type
        });
        if (cacheKey in this.pluralRulesCache) {
          return this.pluralRulesCache[cacheKey];
        }
        let rule;
        try {
          rule = new Intl.PluralRules(cleanedCode, {
            type
          });
        } catch (err) {
          if (typeof Intl === 'undefined') {
            this.logger.error('No Intl support, please use an Intl polyfill!');
            return dummyRule;
          }
          if (!code.match(/-|_/)) return dummyRule;
          const lngPart = this.languageUtils.getLanguagePartFromCode(code);
          rule = this.getRule(lngPart, options);
        }
        this.pluralRulesCache[cacheKey] = rule;
        return rule;
      }
      needsPlural(code, options = {}) {
        let rule = this.getRule(code, options);
        if (!rule) rule = this.getRule('dev', options);
        return rule?.resolvedOptions().pluralCategories.length > 1;
      }
      getPluralFormsOfKey(code, key, options = {}) {
        return this.getSuffixes(code, options).map(suffix => `${key}${suffix}`);
      }
      getSuffixes(code, options = {}) {
        let rule = this.getRule(code, options);
        if (!rule) rule = this.getRule('dev', options);
        if (!rule) return [];
        return rule.resolvedOptions().pluralCategories.sort((pluralCategory1, pluralCategory2) => suffixesOrder[pluralCategory1] - suffixesOrder[pluralCategory2]).map(pluralCategory => `${this.options.prepend}${options.ordinal ? `ordinal${this.options.prepend}` : ''}${pluralCategory}`);
      }
      getSuffix(code, count, options = {}) {
        const rule = this.getRule(code, options);
        if (rule) {
          return `${this.options.prepend}${options.ordinal ? `ordinal${this.options.prepend}` : ''}${rule.select(count)}`;
        }
        this.logger.warn(`no plural rule found for: ${code}`);
        return this.getSuffix('dev', count, options);
      }
    }

    const deepFindWithDefaults = (data, defaultData, key, keySeparator = '.', ignoreJSONStructure = true) => {
      let path = getPathWithDefaults(data, defaultData, key);
      if (!path && ignoreJSONStructure && isString(key)) {
        path = deepFind(data, key, keySeparator);
        if (path === undefined) path = deepFind(defaultData, key, keySeparator);
      }
      return path;
    };
    const regexSafe = val => val.replace(/\$/g, '$$$$');
    class Interpolator {
      constructor(options = {}) {
        this.logger = baseLogger.create('interpolator');
        this.options = options;
        this.format = options?.interpolation?.format || (value => value);
        this.init(options);
      }
      init(options = {}) {
        if (!options.interpolation) options.interpolation = {
          escapeValue: true
        };
        const {
          escape: escape$1,
          escapeValue,
          useRawValueToEscape,
          prefix,
          prefixEscaped,
          suffix,
          suffixEscaped,
          formatSeparator,
          unescapeSuffix,
          unescapePrefix,
          nestingPrefix,
          nestingPrefixEscaped,
          nestingSuffix,
          nestingSuffixEscaped,
          nestingOptionsSeparator,
          maxReplaces,
          alwaysFormat
        } = options.interpolation;
        this.escape = escape$1 !== undefined ? escape$1 : escape;
        this.escapeValue = escapeValue !== undefined ? escapeValue : true;
        this.useRawValueToEscape = useRawValueToEscape !== undefined ? useRawValueToEscape : false;
        this.prefix = prefix ? regexEscape(prefix) : prefixEscaped || '{{';
        this.suffix = suffix ? regexEscape(suffix) : suffixEscaped || '}}';
        this.formatSeparator = formatSeparator || ',';
        this.unescapePrefix = unescapeSuffix ? '' : unescapePrefix || '-';
        this.unescapeSuffix = this.unescapePrefix ? '' : unescapeSuffix || '';
        this.nestingPrefix = nestingPrefix ? regexEscape(nestingPrefix) : nestingPrefixEscaped || regexEscape('$t(');
        this.nestingSuffix = nestingSuffix ? regexEscape(nestingSuffix) : nestingSuffixEscaped || regexEscape(')');
        this.nestingOptionsSeparator = nestingOptionsSeparator || ',';
        this.maxReplaces = maxReplaces || 1000;
        this.alwaysFormat = alwaysFormat !== undefined ? alwaysFormat : false;
        this.resetRegExp();
      }
      reset() {
        if (this.options) this.init(this.options);
      }
      resetRegExp() {
        const getOrResetRegExp = (existingRegExp, pattern) => {
          if (existingRegExp?.source === pattern) {
            existingRegExp.lastIndex = 0;
            return existingRegExp;
          }
          return new RegExp(pattern, 'g');
        };
        this.regexp = getOrResetRegExp(this.regexp, `${this.prefix}(.+?)${this.suffix}`);
        this.regexpUnescape = getOrResetRegExp(this.regexpUnescape, `${this.prefix}${this.unescapePrefix}(.+?)${this.unescapeSuffix}${this.suffix}`);
        this.nestingRegexp = getOrResetRegExp(this.nestingRegexp, `${this.nestingPrefix}((?:[^()"']+|"[^"]*"|'[^']*'|\\((?:[^()]|"[^"]*"|'[^']*')*\\))*?)${this.nestingSuffix}`);
      }
      interpolate(str, data, lng, options) {
        let match;
        let value;
        let replaces;
        const defaultData = this.options && this.options.interpolation && this.options.interpolation.defaultVariables || {};
        const handleFormat = key => {
          if (key.indexOf(this.formatSeparator) < 0) {
            const path = deepFindWithDefaults(data, defaultData, key, this.options.keySeparator, this.options.ignoreJSONStructure);
            return this.alwaysFormat ? this.format(path, undefined, lng, {
              ...options,
              ...data,
              interpolationkey: key
            }) : path;
          }
          const p = key.split(this.formatSeparator);
          const k = p.shift().trim();
          const f = p.join(this.formatSeparator).trim();
          return this.format(deepFindWithDefaults(data, defaultData, k, this.options.keySeparator, this.options.ignoreJSONStructure), f, lng, {
            ...options,
            ...data,
            interpolationkey: k
          });
        };
        this.resetRegExp();
        const missingInterpolationHandler = options?.missingInterpolationHandler || this.options.missingInterpolationHandler;
        const skipOnVariables = options?.interpolation?.skipOnVariables !== undefined ? options.interpolation.skipOnVariables : this.options.interpolation.skipOnVariables;
        const todos = [{
          regex: this.regexpUnescape,
          safeValue: val => regexSafe(val)
        }, {
          regex: this.regexp,
          safeValue: val => this.escapeValue ? regexSafe(this.escape(val)) : regexSafe(val)
        }];
        todos.forEach(todo => {
          replaces = 0;
          while (match = todo.regex.exec(str)) {
            const matchedVar = match[1].trim();
            value = handleFormat(matchedVar);
            if (value === undefined) {
              if (typeof missingInterpolationHandler === 'function') {
                const temp = missingInterpolationHandler(str, match, options);
                value = isString(temp) ? temp : '';
              } else if (options && Object.prototype.hasOwnProperty.call(options, matchedVar)) {
                value = '';
              } else if (skipOnVariables) {
                value = match[0];
                continue;
              } else {
                this.logger.warn(`missed to pass in variable ${matchedVar} for interpolating ${str}`);
                value = '';
              }
            } else if (!isString(value) && !this.useRawValueToEscape) {
              value = makeString(value);
            }
            const safeValue = todo.safeValue(value);
            str = str.replace(match[0], safeValue);
            if (skipOnVariables) {
              todo.regex.lastIndex += value.length;
              todo.regex.lastIndex -= match[0].length;
            } else {
              todo.regex.lastIndex = 0;
            }
            replaces++;
            if (replaces >= this.maxReplaces) {
              break;
            }
          }
        });
        return str;
      }
      nest(str, fc, options = {}) {
        let match;
        let value;
        let clonedOptions;
        const handleHasOptions = (key, inheritedOptions) => {
          const sep = this.nestingOptionsSeparator;
          if (key.indexOf(sep) < 0) return key;
          const c = key.split(new RegExp(`${regexEscape(sep)}[ ]*{`));
          let optionsString = `{${c[1]}`;
          key = c[0];
          optionsString = this.interpolate(optionsString, clonedOptions);
          const matchedSingleQuotes = optionsString.match(/'/g);
          const matchedDoubleQuotes = optionsString.match(/"/g);
          if ((matchedSingleQuotes?.length ?? 0) % 2 === 0 && !matchedDoubleQuotes || (matchedDoubleQuotes?.length ?? 0) % 2 !== 0) {
            optionsString = optionsString.replace(/'/g, '"');
          }
          try {
            clonedOptions = JSON.parse(optionsString);
            if (inheritedOptions) clonedOptions = {
              ...inheritedOptions,
              ...clonedOptions
            };
          } catch (e) {
            this.logger.warn(`failed parsing options string in nesting for key ${key}`, e);
            return `${key}${sep}${optionsString}`;
          }
          if (clonedOptions.defaultValue && clonedOptions.defaultValue.indexOf(this.prefix) > -1) delete clonedOptions.defaultValue;
          return key;
        };
        while (match = this.nestingRegexp.exec(str)) {
          let formatters = [];
          clonedOptions = {
            ...options
          };
          clonedOptions = clonedOptions.replace && !isString(clonedOptions.replace) ? clonedOptions.replace : clonedOptions;
          clonedOptions.applyPostProcessor = false;
          delete clonedOptions.defaultValue;
          const keyEndIndex = /{.*}/.test(match[1]) ? match[1].lastIndexOf('}') + 1 : match[1].indexOf(this.formatSeparator);
          if (keyEndIndex !== -1) {
            formatters = match[1].slice(keyEndIndex).split(this.formatSeparator).map(elem => elem.trim()).filter(Boolean);
            match[1] = match[1].slice(0, keyEndIndex);
          }
          value = fc(handleHasOptions.call(this, match[1].trim(), clonedOptions), clonedOptions);
          if (value && match[0] === str && !isString(value)) return value;
          if (!isString(value)) value = makeString(value);
          if (!value) {
            this.logger.warn(`missed to resolve ${match[1]} for nesting ${str}`);
            value = '';
          }
          if (formatters.length) {
            value = formatters.reduce((v, f) => this.format(v, f, options.lng, {
              ...options,
              interpolationkey: match[1].trim()
            }), value.trim());
          }
          str = str.replace(match[0], value);
          this.regexp.lastIndex = 0;
        }
        return str;
      }
    }

    const parseFormatStr = formatStr => {
      let formatName = formatStr.toLowerCase().trim();
      const formatOptions = {};
      if (formatStr.indexOf('(') > -1) {
        const p = formatStr.split('(');
        formatName = p[0].toLowerCase().trim();
        const optStr = p[1].substring(0, p[1].length - 1);
        if (formatName === 'currency' && optStr.indexOf(':') < 0) {
          if (!formatOptions.currency) formatOptions.currency = optStr.trim();
        } else if (formatName === 'relativetime' && optStr.indexOf(':') < 0) {
          if (!formatOptions.range) formatOptions.range = optStr.trim();
        } else {
          const opts = optStr.split(';');
          opts.forEach(opt => {
            if (opt) {
              const [key, ...rest] = opt.split(':');
              const val = rest.join(':').trim().replace(/^'+|'+$/g, '');
              const trimmedKey = key.trim();
              if (!formatOptions[trimmedKey]) formatOptions[trimmedKey] = val;
              if (val === 'false') formatOptions[trimmedKey] = false;
              if (val === 'true') formatOptions[trimmedKey] = true;
              if (!isNaN(val)) formatOptions[trimmedKey] = parseInt(val, 10);
            }
          });
        }
      }
      return {
        formatName,
        formatOptions
      };
    };
    const createCachedFormatter = fn => {
      const cache = {};
      return (v, l, o) => {
        let optForCache = o;
        if (o && o.interpolationkey && o.formatParams && o.formatParams[o.interpolationkey] && o[o.interpolationkey]) {
          optForCache = {
            ...optForCache,
            [o.interpolationkey]: undefined
          };
        }
        const key = l + JSON.stringify(optForCache);
        let frm = cache[key];
        if (!frm) {
          frm = fn(getCleanedCode(l), o);
          cache[key] = frm;
        }
        return frm(v);
      };
    };
    const createNonCachedFormatter = fn => (v, l, o) => fn(getCleanedCode(l), o)(v);
    class Formatter {
      constructor(options = {}) {
        this.logger = baseLogger.create('formatter');
        this.options = options;
        this.init(options);
      }
      init(services, options = {
        interpolation: {}
      }) {
        this.formatSeparator = options.interpolation.formatSeparator || ',';
        const cf = options.cacheInBuiltFormats ? createCachedFormatter : createNonCachedFormatter;
        this.formats = {
          number: cf((lng, opt) => {
            const formatter = new Intl.NumberFormat(lng, {
              ...opt
            });
            return val => formatter.format(val);
          }),
          currency: cf((lng, opt) => {
            const formatter = new Intl.NumberFormat(lng, {
              ...opt,
              style: 'currency'
            });
            return val => formatter.format(val);
          }),
          datetime: cf((lng, opt) => {
            const formatter = new Intl.DateTimeFormat(lng, {
              ...opt
            });
            return val => formatter.format(val);
          }),
          relativetime: cf((lng, opt) => {
            const formatter = new Intl.RelativeTimeFormat(lng, {
              ...opt
            });
            return val => formatter.format(val, opt.range || 'day');
          }),
          list: cf((lng, opt) => {
            const formatter = new Intl.ListFormat(lng, {
              ...opt
            });
            return val => formatter.format(val);
          })
        };
      }
      add(name, fc) {
        this.formats[name.toLowerCase().trim()] = fc;
      }
      addCached(name, fc) {
        this.formats[name.toLowerCase().trim()] = createCachedFormatter(fc);
      }
      format(value, format, lng, options = {}) {
        const formats = format.split(this.formatSeparator);
        if (formats.length > 1 && formats[0].indexOf('(') > 1 && formats[0].indexOf(')') < 0 && formats.find(f => f.indexOf(')') > -1)) {
          const lastIndex = formats.findIndex(f => f.indexOf(')') > -1);
          formats[0] = [formats[0], ...formats.splice(1, lastIndex)].join(this.formatSeparator);
        }
        const result = formats.reduce((mem, f) => {
          const {
            formatName,
            formatOptions
          } = parseFormatStr(f);
          if (this.formats[formatName]) {
            let formatted = mem;
            try {
              const valOptions = options?.formatParams?.[options.interpolationkey] || {};
              const l = valOptions.locale || valOptions.lng || options.locale || options.lng || lng;
              formatted = this.formats[formatName](mem, l, {
                ...formatOptions,
                ...options,
                ...valOptions
              });
            } catch (error) {
              this.logger.warn(error);
            }
            return formatted;
          } else {
            this.logger.warn(`there was no format function for ${formatName}`);
          }
          return mem;
        }, value);
        return result;
      }
    }

    const removePending = (q, name) => {
      if (q.pending[name] !== undefined) {
        delete q.pending[name];
        q.pendingCount--;
      }
    };
    class Connector extends EventEmitter {
      constructor(backend, store, services, options = {}) {
        super();
        this.backend = backend;
        this.store = store;
        this.services = services;
        this.languageUtils = services.languageUtils;
        this.options = options;
        this.logger = baseLogger.create('backendConnector');
        this.waitingReads = [];
        this.maxParallelReads = options.maxParallelReads || 10;
        this.readingCalls = 0;
        this.maxRetries = options.maxRetries >= 0 ? options.maxRetries : 5;
        this.retryTimeout = options.retryTimeout >= 1 ? options.retryTimeout : 350;
        this.state = {};
        this.queue = [];
        this.backend?.init?.(services, options.backend, options);
      }
      queueLoad(languages, namespaces, options, callback) {
        const toLoad = {};
        const pending = {};
        const toLoadLanguages = {};
        const toLoadNamespaces = {};
        languages.forEach(lng => {
          let hasAllNamespaces = true;
          namespaces.forEach(ns => {
            const name = `${lng}|${ns}`;
            if (!options.reload && this.store.hasResourceBundle(lng, ns)) {
              this.state[name] = 2;
            } else if (this.state[name] < 0) ; else if (this.state[name] === 1) {
              if (pending[name] === undefined) pending[name] = true;
            } else {
              this.state[name] = 1;
              hasAllNamespaces = false;
              if (pending[name] === undefined) pending[name] = true;
              if (toLoad[name] === undefined) toLoad[name] = true;
              if (toLoadNamespaces[ns] === undefined) toLoadNamespaces[ns] = true;
            }
          });
          if (!hasAllNamespaces) toLoadLanguages[lng] = true;
        });
        if (Object.keys(toLoad).length || Object.keys(pending).length) {
          this.queue.push({
            pending,
            pendingCount: Object.keys(pending).length,
            loaded: {},
            errors: [],
            callback
          });
        }
        return {
          toLoad: Object.keys(toLoad),
          pending: Object.keys(pending),
          toLoadLanguages: Object.keys(toLoadLanguages),
          toLoadNamespaces: Object.keys(toLoadNamespaces)
        };
      }
      loaded(name, err, data) {
        const s = name.split('|');
        const lng = s[0];
        const ns = s[1];
        if (err) this.emit('failedLoading', lng, ns, err);
        if (!err && data) {
          this.store.addResourceBundle(lng, ns, data, undefined, undefined, {
            skipCopy: true
          });
        }
        this.state[name] = err ? -1 : 2;
        if (err && data) this.state[name] = 0;
        const loaded = {};
        this.queue.forEach(q => {
          pushPath(q.loaded, [lng], ns);
          removePending(q, name);
          if (err) q.errors.push(err);
          if (q.pendingCount === 0 && !q.done) {
            Object.keys(q.loaded).forEach(l => {
              if (!loaded[l]) loaded[l] = {};
              const loadedKeys = q.loaded[l];
              if (loadedKeys.length) {
                loadedKeys.forEach(n => {
                  if (loaded[l][n] === undefined) loaded[l][n] = true;
                });
              }
            });
            q.done = true;
            if (q.errors.length) {
              q.callback(q.errors);
            } else {
              q.callback();
            }
          }
        });
        this.emit('loaded', loaded);
        this.queue = this.queue.filter(q => !q.done);
      }
      read(lng, ns, fcName, tried = 0, wait = this.retryTimeout, callback) {
        if (!lng.length) return callback(null, {});
        if (this.readingCalls >= this.maxParallelReads) {
          this.waitingReads.push({
            lng,
            ns,
            fcName,
            tried,
            wait,
            callback
          });
          return;
        }
        this.readingCalls++;
        const resolver = (err, data) => {
          this.readingCalls--;
          if (this.waitingReads.length > 0) {
            const next = this.waitingReads.shift();
            this.read(next.lng, next.ns, next.fcName, next.tried, next.wait, next.callback);
          }
          if (err && data && tried < this.maxRetries) {
            setTimeout(() => {
              this.read.call(this, lng, ns, fcName, tried + 1, wait * 2, callback);
            }, wait);
            return;
          }
          callback(err, data);
        };
        const fc = this.backend[fcName].bind(this.backend);
        if (fc.length === 2) {
          try {
            const r = fc(lng, ns);
            if (r && typeof r.then === 'function') {
              r.then(data => resolver(null, data)).catch(resolver);
            } else {
              resolver(null, r);
            }
          } catch (err) {
            resolver(err);
          }
          return;
        }
        return fc(lng, ns, resolver);
      }
      prepareLoading(languages, namespaces, options = {}, callback) {
        if (!this.backend) {
          this.logger.warn('No backend was added via i18next.use. Will not load resources.');
          return callback && callback();
        }
        if (isString(languages)) languages = this.languageUtils.toResolveHierarchy(languages);
        if (isString(namespaces)) namespaces = [namespaces];
        const toLoad = this.queueLoad(languages, namespaces, options, callback);
        if (!toLoad.toLoad.length) {
          if (!toLoad.pending.length) callback();
          return null;
        }
        toLoad.toLoad.forEach(name => {
          this.loadOne(name);
        });
      }
      load(languages, namespaces, callback) {
        this.prepareLoading(languages, namespaces, {}, callback);
      }
      reload(languages, namespaces, callback) {
        this.prepareLoading(languages, namespaces, {
          reload: true
        }, callback);
      }
      loadOne(name, prefix = '') {
        const s = name.split('|');
        const lng = s[0];
        const ns = s[1];
        this.read(lng, ns, 'read', undefined, undefined, (err, data) => {
          if (err) this.logger.warn(`${prefix}loading namespace ${ns} for language ${lng} failed`, err);
          if (!err && data) this.logger.log(`${prefix}loaded namespace ${ns} for language ${lng}`, data);
          this.loaded(name, err, data);
        });
      }
      saveMissing(languages, namespace, key, fallbackValue, isUpdate, options = {}, clb = () => {}) {
        if (this.services?.utils?.hasLoadedNamespace && !this.services?.utils?.hasLoadedNamespace(namespace)) {
          this.logger.warn(`did not save key "${key}" as the namespace "${namespace}" was not yet loaded`, 'This means something IS WRONG in your setup. You access the t function before i18next.init / i18next.loadNamespace / i18next.changeLanguage was done. Wait for the callback or Promise to resolve before accessing it!!!');
          return;
        }
        if (key === undefined || key === null || key === '') return;
        if (this.backend?.create) {
          const opts = {
            ...options,
            isUpdate
          };
          const fc = this.backend.create.bind(this.backend);
          if (fc.length < 6) {
            try {
              let r;
              if (fc.length === 5) {
                r = fc(languages, namespace, key, fallbackValue, opts);
              } else {
                r = fc(languages, namespace, key, fallbackValue);
              }
              if (r && typeof r.then === 'function') {
                r.then(data => clb(null, data)).catch(clb);
              } else {
                clb(null, r);
              }
            } catch (err) {
              clb(err);
            }
          } else {
            fc(languages, namespace, key, fallbackValue, clb, opts);
          }
        }
        if (!languages || !languages[0]) return;
        this.store.addResource(languages[0], namespace, key, fallbackValue);
      }
    }

    const get = () => ({
      debug: false,
      initAsync: true,
      ns: ['translation'],
      defaultNS: ['translation'],
      fallbackLng: ['dev'],
      fallbackNS: false,
      supportedLngs: false,
      nonExplicitSupportedLngs: false,
      load: 'all',
      preload: false,
      simplifyPluralSuffix: true,
      keySeparator: '.',
      nsSeparator: ':',
      pluralSeparator: '_',
      contextSeparator: '_',
      partialBundledLanguages: false,
      saveMissing: false,
      updateMissing: false,
      saveMissingTo: 'fallback',
      saveMissingPlurals: true,
      missingKeyHandler: false,
      missingInterpolationHandler: false,
      postProcess: false,
      postProcessPassResolved: false,
      returnNull: false,
      returnEmptyString: true,
      returnObjects: false,
      joinArrays: false,
      returnedObjectHandler: false,
      parseMissingKeyHandler: false,
      appendNamespaceToMissingKey: false,
      appendNamespaceToCIMode: false,
      overloadTranslationOptionHandler: args => {
        let ret = {};
        if (typeof args[1] === 'object') ret = args[1];
        if (isString(args[1])) ret.defaultValue = args[1];
        if (isString(args[2])) ret.tDescription = args[2];
        if (typeof args[2] === 'object' || typeof args[3] === 'object') {
          const options = args[3] || args[2];
          Object.keys(options).forEach(key => {
            ret[key] = options[key];
          });
        }
        return ret;
      },
      interpolation: {
        escapeValue: true,
        format: value => value,
        prefix: '{{',
        suffix: '}}',
        formatSeparator: ',',
        unescapePrefix: '-',
        nestingPrefix: '$t(',
        nestingSuffix: ')',
        nestingOptionsSeparator: ',',
        maxReplaces: 1000,
        skipOnVariables: true
      },
      cacheInBuiltFormats: true
    });
    const transformOptions = options => {
      if (isString(options.ns)) options.ns = [options.ns];
      if (isString(options.fallbackLng)) options.fallbackLng = [options.fallbackLng];
      if (isString(options.fallbackNS)) options.fallbackNS = [options.fallbackNS];
      if (options.supportedLngs?.indexOf?.('cimode') < 0) {
        options.supportedLngs = options.supportedLngs.concat(['cimode']);
      }
      if (typeof options.initImmediate === 'boolean') options.initAsync = options.initImmediate;
      return options;
    };

    const noop = () => {};
    const bindMemberFunctions = inst => {
      const mems = Object.getOwnPropertyNames(Object.getPrototypeOf(inst));
      mems.forEach(mem => {
        if (typeof inst[mem] === 'function') {
          inst[mem] = inst[mem].bind(inst);
        }
      });
    };
    const SUPPORT_NOTICE_KEY = '__i18next_supportNoticeShown';
    const getSupportNoticeShown = () => typeof globalThis !== 'undefined' && !!globalThis[SUPPORT_NOTICE_KEY];
    const setSupportNoticeShown = () => {
      if (typeof globalThis !== 'undefined') globalThis[SUPPORT_NOTICE_KEY] = true;
    };
    const usesLocize = inst => {
      if (inst?.modules?.backend?.name?.indexOf('Locize') > 0) return true;
      if (inst?.modules?.backend?.constructor?.name?.indexOf('Locize') > 0) return true;
      if (inst?.options?.backend?.backends) {
        if (inst.options.backend.backends.some(b => b?.name?.indexOf('Locize') > 0 || b?.constructor?.name?.indexOf('Locize') > 0)) return true;
      }
      if (inst?.options?.backend?.projectId) return true;
      if (inst?.options?.backend?.backendOptions) {
        if (inst.options.backend.backendOptions.some(b => b?.projectId)) return true;
      }
      return false;
    };
    class I18n extends EventEmitter {
      constructor(options = {}, callback) {
        super();
        this.options = transformOptions(options);
        this.services = {};
        this.logger = baseLogger;
        this.modules = {
          external: []
        };
        bindMemberFunctions(this);
        if (callback && !this.isInitialized && !options.isClone) {
          if (!this.options.initAsync) {
            this.init(options, callback);
            return this;
          }
          setTimeout(() => {
            this.init(options, callback);
          }, 0);
        }
      }
      init(options = {}, callback) {
        this.isInitializing = true;
        if (typeof options === 'function') {
          callback = options;
          options = {};
        }
        if (options.defaultNS == null && options.ns) {
          if (isString(options.ns)) {
            options.defaultNS = options.ns;
          } else if (options.ns.indexOf('translation') < 0) {
            options.defaultNS = options.ns[0];
          }
        }
        const defOpts = get();
        this.options = {
          ...defOpts,
          ...this.options,
          ...transformOptions(options)
        };
        this.options.interpolation = {
          ...defOpts.interpolation,
          ...this.options.interpolation
        };
        if (options.keySeparator !== undefined) {
          this.options.userDefinedKeySeparator = options.keySeparator;
        }
        if (options.nsSeparator !== undefined) {
          this.options.userDefinedNsSeparator = options.nsSeparator;
        }
        if (typeof this.options.overloadTranslationOptionHandler !== 'function') {
          this.options.overloadTranslationOptionHandler = defOpts.overloadTranslationOptionHandler;
        }
        if (this.options.showSupportNotice !== false && !usesLocize(this) && !getSupportNoticeShown()) {
          if (typeof console !== 'undefined' && typeof console.info !== 'undefined') console.info('🌐 i18next is made possible by our own product, Locize — consider powering your project with managed localization (AI, CDN, integrations): https://locize.com 💙');
          setSupportNoticeShown();
        }
        const createClassOnDemand = ClassOrObject => {
          if (!ClassOrObject) return null;
          if (typeof ClassOrObject === 'function') return new ClassOrObject();
          return ClassOrObject;
        };
        if (!this.options.isClone) {
          if (this.modules.logger) {
            baseLogger.init(createClassOnDemand(this.modules.logger), this.options);
          } else {
            baseLogger.init(null, this.options);
          }
          let formatter;
          if (this.modules.formatter) {
            formatter = this.modules.formatter;
          } else {
            formatter = Formatter;
          }
          const lu = new LanguageUtil(this.options);
          this.store = new ResourceStore(this.options.resources, this.options);
          const s = this.services;
          s.logger = baseLogger;
          s.resourceStore = this.store;
          s.languageUtils = lu;
          s.pluralResolver = new PluralResolver(lu, {
            prepend: this.options.pluralSeparator,
            simplifyPluralSuffix: this.options.simplifyPluralSuffix
          });
          const usingLegacyFormatFunction = this.options.interpolation.format && this.options.interpolation.format !== defOpts.interpolation.format;
          if (usingLegacyFormatFunction) {
            this.logger.deprecate(`init: you are still using the legacy format function, please use the new approach: https://www.i18next.com/translation-function/formatting`);
          }
          if (formatter && (!this.options.interpolation.format || this.options.interpolation.format === defOpts.interpolation.format)) {
            s.formatter = createClassOnDemand(formatter);
            if (s.formatter.init) s.formatter.init(s, this.options);
            this.options.interpolation.format = s.formatter.format.bind(s.formatter);
          }
          s.interpolator = new Interpolator(this.options);
          s.utils = {
            hasLoadedNamespace: this.hasLoadedNamespace.bind(this)
          };
          s.backendConnector = new Connector(createClassOnDemand(this.modules.backend), s.resourceStore, s, this.options);
          s.backendConnector.on('*', (event, ...args) => {
            this.emit(event, ...args);
          });
          if (this.modules.languageDetector) {
            s.languageDetector = createClassOnDemand(this.modules.languageDetector);
            if (s.languageDetector.init) s.languageDetector.init(s, this.options.detection, this.options);
          }
          if (this.modules.i18nFormat) {
            s.i18nFormat = createClassOnDemand(this.modules.i18nFormat);
            if (s.i18nFormat.init) s.i18nFormat.init(this);
          }
          this.translator = new Translator(this.services, this.options);
          this.translator.on('*', (event, ...args) => {
            this.emit(event, ...args);
          });
          this.modules.external.forEach(m => {
            if (m.init) m.init(this);
          });
        }
        this.format = this.options.interpolation.format;
        if (!callback) callback = noop;
        if (this.options.fallbackLng && !this.services.languageDetector && !this.options.lng) {
          const codes = this.services.languageUtils.getFallbackCodes(this.options.fallbackLng);
          if (codes.length > 0 && codes[0] !== 'dev') this.options.lng = codes[0];
        }
        if (!this.services.languageDetector && !this.options.lng) {
          this.logger.warn('init: no languageDetector is used and no lng is defined');
        }
        const storeApi = ['getResource', 'hasResourceBundle', 'getResourceBundle', 'getDataByLanguage'];
        storeApi.forEach(fcName => {
          this[fcName] = (...args) => this.store[fcName](...args);
        });
        const storeApiChained = ['addResource', 'addResources', 'addResourceBundle', 'removeResourceBundle'];
        storeApiChained.forEach(fcName => {
          this[fcName] = (...args) => {
            this.store[fcName](...args);
            return this;
          };
        });
        const deferred = defer();
        const load = () => {
          const finish = (err, t) => {
            this.isInitializing = false;
            if (this.isInitialized && !this.initializedStoreOnce) this.logger.warn('init: i18next is already initialized. You should call init just once!');
            this.isInitialized = true;
            if (!this.options.isClone) this.logger.log('initialized', this.options);
            this.emit('initialized', this.options);
            deferred.resolve(t);
            callback(err, t);
          };
          if (this.languages && !this.isInitialized) return finish(null, this.t.bind(this));
          this.changeLanguage(this.options.lng, finish);
        };
        if (this.options.resources || !this.options.initAsync) {
          load();
        } else {
          setTimeout(load, 0);
        }
        return deferred;
      }
      loadResources(language, callback = noop) {
        let usedCallback = callback;
        const usedLng = isString(language) ? language : this.language;
        if (typeof language === 'function') usedCallback = language;
        if (!this.options.resources || this.options.partialBundledLanguages) {
          if (usedLng?.toLowerCase() === 'cimode' && (!this.options.preload || this.options.preload.length === 0)) return usedCallback();
          const toLoad = [];
          const append = lng => {
            if (!lng) return;
            if (lng === 'cimode') return;
            const lngs = this.services.languageUtils.toResolveHierarchy(lng);
            lngs.forEach(l => {
              if (l === 'cimode') return;
              if (toLoad.indexOf(l) < 0) toLoad.push(l);
            });
          };
          if (!usedLng) {
            const fallbacks = this.services.languageUtils.getFallbackCodes(this.options.fallbackLng);
            fallbacks.forEach(l => append(l));
          } else {
            append(usedLng);
          }
          this.options.preload?.forEach?.(l => append(l));
          this.services.backendConnector.load(toLoad, this.options.ns, e => {
            if (!e && !this.resolvedLanguage && this.language) this.setResolvedLanguage(this.language);
            usedCallback(e);
          });
        } else {
          usedCallback(null);
        }
      }
      reloadResources(lngs, ns, callback) {
        const deferred = defer();
        if (typeof lngs === 'function') {
          callback = lngs;
          lngs = undefined;
        }
        if (typeof ns === 'function') {
          callback = ns;
          ns = undefined;
        }
        if (!lngs) lngs = this.languages;
        if (!ns) ns = this.options.ns;
        if (!callback) callback = noop;
        this.services.backendConnector.reload(lngs, ns, err => {
          deferred.resolve();
          callback(err);
        });
        return deferred;
      }
      use(module) {
        if (!module) throw new Error('You are passing an undefined module! Please check the object you are passing to i18next.use()');
        if (!module.type) throw new Error('You are passing a wrong module! Please check the object you are passing to i18next.use()');
        if (module.type === 'backend') {
          this.modules.backend = module;
        }
        if (module.type === 'logger' || module.log && module.warn && module.error) {
          this.modules.logger = module;
        }
        if (module.type === 'languageDetector') {
          this.modules.languageDetector = module;
        }
        if (module.type === 'i18nFormat') {
          this.modules.i18nFormat = module;
        }
        if (module.type === 'postProcessor') {
          postProcessor.addPostProcessor(module);
        }
        if (module.type === 'formatter') {
          this.modules.formatter = module;
        }
        if (module.type === '3rdParty') {
          this.modules.external.push(module);
        }
        return this;
      }
      setResolvedLanguage(l) {
        if (!l || !this.languages) return;
        if (['cimode', 'dev'].indexOf(l) > -1) return;
        for (let li = 0; li < this.languages.length; li++) {
          const lngInLngs = this.languages[li];
          if (['cimode', 'dev'].indexOf(lngInLngs) > -1) continue;
          if (this.store.hasLanguageSomeTranslations(lngInLngs)) {
            this.resolvedLanguage = lngInLngs;
            break;
          }
        }
        if (!this.resolvedLanguage && this.languages.indexOf(l) < 0 && this.store.hasLanguageSomeTranslations(l)) {
          this.resolvedLanguage = l;
          this.languages.unshift(l);
        }
      }
      changeLanguage(lng, callback) {
        this.isLanguageChangingTo = lng;
        const deferred = defer();
        this.emit('languageChanging', lng);
        const setLngProps = l => {
          this.language = l;
          this.languages = this.services.languageUtils.toResolveHierarchy(l);
          this.resolvedLanguage = undefined;
          this.setResolvedLanguage(l);
        };
        const done = (err, l) => {
          if (l) {
            if (this.isLanguageChangingTo === lng) {
              setLngProps(l);
              this.translator.changeLanguage(l);
              this.isLanguageChangingTo = undefined;
              this.emit('languageChanged', l);
              this.logger.log('languageChanged', l);
            }
          } else {
            this.isLanguageChangingTo = undefined;
          }
          deferred.resolve((...args) => this.t(...args));
          if (callback) callback(err, (...args) => this.t(...args));
        };
        const setLng = lngs => {
          if (!lng && !lngs && this.services.languageDetector) lngs = [];
          const fl = isString(lngs) ? lngs : lngs && lngs[0];
          const l = this.store.hasLanguageSomeTranslations(fl) ? fl : this.services.languageUtils.getBestMatchFromCodes(isString(lngs) ? [lngs] : lngs);
          if (l) {
            if (!this.language) {
              setLngProps(l);
            }
            if (!this.translator.language) this.translator.changeLanguage(l);
            this.services.languageDetector?.cacheUserLanguage?.(l);
          }
          this.loadResources(l, err => {
            done(err, l);
          });
        };
        if (!lng && this.services.languageDetector && !this.services.languageDetector.async) {
          setLng(this.services.languageDetector.detect());
        } else if (!lng && this.services.languageDetector && this.services.languageDetector.async) {
          if (this.services.languageDetector.detect.length === 0) {
            this.services.languageDetector.detect().then(setLng);
          } else {
            this.services.languageDetector.detect(setLng);
          }
        } else {
          setLng(lng);
        }
        return deferred;
      }
      getFixedT(lng, ns, keyPrefix) {
        const fixedT = (key, opts, ...rest) => {
          let o;
          if (typeof opts !== 'object') {
            o = this.options.overloadTranslationOptionHandler([key, opts].concat(rest));
          } else {
            o = {
              ...opts
            };
          }
          o.lng = o.lng || fixedT.lng;
          o.lngs = o.lngs || fixedT.lngs;
          o.ns = o.ns || fixedT.ns;
          if (o.keyPrefix !== '') o.keyPrefix = o.keyPrefix || keyPrefix || fixedT.keyPrefix;
          const keySeparator = this.options.keySeparator || '.';
          let resultKey;
          if (o.keyPrefix && Array.isArray(key)) {
            resultKey = key.map(k => {
              if (typeof k === 'function') k = keysFromSelector(k, {
                ...this.options,
                ...opts
              });
              return `${o.keyPrefix}${keySeparator}${k}`;
            });
          } else {
            if (typeof key === 'function') key = keysFromSelector(key, {
              ...this.options,
              ...opts
            });
            resultKey = o.keyPrefix ? `${o.keyPrefix}${keySeparator}${key}` : key;
          }
          return this.t(resultKey, o);
        };
        if (isString(lng)) {
          fixedT.lng = lng;
        } else {
          fixedT.lngs = lng;
        }
        fixedT.ns = ns;
        fixedT.keyPrefix = keyPrefix;
        return fixedT;
      }
      t(...args) {
        return this.translator?.translate(...args);
      }
      exists(...args) {
        return this.translator?.exists(...args);
      }
      setDefaultNamespace(ns) {
        this.options.defaultNS = ns;
      }
      hasLoadedNamespace(ns, options = {}) {
        if (!this.isInitialized) {
          this.logger.warn('hasLoadedNamespace: i18next was not initialized', this.languages);
          return false;
        }
        if (!this.languages || !this.languages.length) {
          this.logger.warn('hasLoadedNamespace: i18n.languages were undefined or empty', this.languages);
          return false;
        }
        const lng = options.lng || this.resolvedLanguage || this.languages[0];
        const fallbackLng = this.options ? this.options.fallbackLng : false;
        const lastLng = this.languages[this.languages.length - 1];
        if (lng.toLowerCase() === 'cimode') return true;
        const loadNotPending = (l, n) => {
          const loadState = this.services.backendConnector.state[`${l}|${n}`];
          return loadState === -1 || loadState === 0 || loadState === 2;
        };
        if (options.precheck) {
          const preResult = options.precheck(this, loadNotPending);
          if (preResult !== undefined) return preResult;
        }
        if (this.hasResourceBundle(lng, ns)) return true;
        if (!this.services.backendConnector.backend || this.options.resources && !this.options.partialBundledLanguages) return true;
        if (loadNotPending(lng, ns) && (!fallbackLng || loadNotPending(lastLng, ns))) return true;
        return false;
      }
      loadNamespaces(ns, callback) {
        const deferred = defer();
        if (!this.options.ns) {
          if (callback) callback();
          return Promise.resolve();
        }
        if (isString(ns)) ns = [ns];
        ns.forEach(n => {
          if (this.options.ns.indexOf(n) < 0) this.options.ns.push(n);
        });
        this.loadResources(err => {
          deferred.resolve();
          if (callback) callback(err);
        });
        return deferred;
      }
      loadLanguages(lngs, callback) {
        const deferred = defer();
        if (isString(lngs)) lngs = [lngs];
        const preloaded = this.options.preload || [];
        const newLngs = lngs.filter(lng => preloaded.indexOf(lng) < 0 && this.services.languageUtils.isSupportedCode(lng));
        if (!newLngs.length) {
          if (callback) callback();
          return Promise.resolve();
        }
        this.options.preload = preloaded.concat(newLngs);
        this.loadResources(err => {
          deferred.resolve();
          if (callback) callback(err);
        });
        return deferred;
      }
      dir(lng) {
        if (!lng) lng = this.resolvedLanguage || (this.languages?.length > 0 ? this.languages[0] : this.language);
        if (!lng) return 'rtl';
        try {
          const l = new Intl.Locale(lng);
          if (l && l.getTextInfo) {
            const ti = l.getTextInfo();
            if (ti && ti.direction) return ti.direction;
          }
        } catch (e) {}
        const rtlLngs = ['ar', 'shu', 'sqr', 'ssh', 'xaa', 'yhd', 'yud', 'aao', 'abh', 'abv', 'acm', 'acq', 'acw', 'acx', 'acy', 'adf', 'ads', 'aeb', 'aec', 'afb', 'ajp', 'apc', 'apd', 'arb', 'arq', 'ars', 'ary', 'arz', 'auz', 'avl', 'ayh', 'ayl', 'ayn', 'ayp', 'bbz', 'pga', 'he', 'iw', 'ps', 'pbt', 'pbu', 'pst', 'prp', 'prd', 'ug', 'ur', 'ydd', 'yds', 'yih', 'ji', 'yi', 'hbo', 'men', 'xmn', 'fa', 'jpr', 'peo', 'pes', 'prs', 'dv', 'sam', 'ckb'];
        const languageUtils = this.services?.languageUtils || new LanguageUtil(get());
        if (lng.toLowerCase().indexOf('-latn') > 1) return 'ltr';
        return rtlLngs.indexOf(languageUtils.getLanguagePartFromCode(lng)) > -1 || lng.toLowerCase().indexOf('-arab') > 1 ? 'rtl' : 'ltr';
      }
      static createInstance(options = {}, callback) {
        const instance = new I18n(options, callback);
        instance.createInstance = I18n.createInstance;
        return instance;
      }
      cloneInstance(options = {}, callback = noop) {
        const forkResourceStore = options.forkResourceStore;
        if (forkResourceStore) delete options.forkResourceStore;
        const mergedOptions = {
          ...this.options,
          ...options,
          ...{
            isClone: true
          }
        };
        const clone = new I18n(mergedOptions);
        if (options.debug !== undefined || options.prefix !== undefined) {
          clone.logger = clone.logger.clone(options);
        }
        const membersToCopy = ['store', 'services', 'language'];
        membersToCopy.forEach(m => {
          clone[m] = this[m];
        });
        clone.services = {
          ...this.services
        };
        clone.services.utils = {
          hasLoadedNamespace: clone.hasLoadedNamespace.bind(clone)
        };
        if (forkResourceStore) {
          const clonedData = Object.keys(this.store.data).reduce((prev, l) => {
            prev[l] = {
              ...this.store.data[l]
            };
            prev[l] = Object.keys(prev[l]).reduce((acc, n) => {
              acc[n] = {
                ...prev[l][n]
              };
              return acc;
            }, prev[l]);
            return prev;
          }, {});
          clone.store = new ResourceStore(clonedData, mergedOptions);
          clone.services.resourceStore = clone.store;
        }
        if (options.interpolation) {
          const defOpts = get();
          const mergedInterpolation = {
            ...defOpts.interpolation,
            ...this.options.interpolation,
            ...options.interpolation
          };
          const mergedForInterpolator = {
            ...mergedOptions,
            interpolation: mergedInterpolation
          };
          clone.services.interpolator = new Interpolator(mergedForInterpolator);
        }
        clone.translator = new Translator(clone.services, mergedOptions);
        clone.translator.on('*', (event, ...args) => {
          clone.emit(event, ...args);
        });
        clone.init(mergedOptions, callback);
        clone.translator.options = mergedOptions;
        clone.translator.backendConnector.services.utils = {
          hasLoadedNamespace: clone.hasLoadedNamespace.bind(clone)
        };
        return clone;
      }
      toJSON() {
        return {
          options: this.options,
          store: this.store,
          language: this.language,
          languages: this.languages,
          resolvedLanguage: this.resolvedLanguage
        };
      }
    }
    const instance = I18n.createInstance();

    instance.createInstance;
    instance.dir;
    instance.init;
    instance.loadResources;
    instance.reloadResources;
    instance.use;
    instance.changeLanguage;
    instance.getFixedT;
    const t = instance.t;
    instance.exists;
    instance.setDefaultNamespace;
    instance.hasLoadedNamespace;
    instance.loadNamespaces;
    instance.loadLanguages;

    var __contributors = [
    	"RezoxP"
    ];
    var settings = {
    	options: {
    		socialMedia: {
    			title: "Social Media Links",
    			qrCodeScanMessage: "You can visit the {{name}} page by scanning the QR code below."
    		},
    		adBlock: "Ad Block",
    		sponsorblock: {
    			title: "SponsorBlock Settings",
    			options: {
    				enableSB: "Enable SponsorBlock",
    				manualSkip: "Manual SponsorBlock Segment Skip",
    				segments: "Segments",
    				categories: {
    					sponsor: "Skip Sponsor Segments",
    					intro: "Skip Intro Segments",
    					outro: "Skip Outro Segments",
    					interaction: "Skip Interaction Reminder Segments",
    					selfpromo: "Skip Self-Promotion Segments",
    					preview: "Skip Preview/Recap Segments",
    					filler: "Skip Tangents/Jokes Segments",
    					music_offtopic: "Skip Off-Topic Music Segments",
    					highlights: "Enable Highlights"
    				},
    				showSBToasts: "Show SponsorBlock Toasts"
    			}
    		},
    		dearrow: {
    			title: "DeArrow Settings",
    			options: {
    				enableDA: "Enable DeArrow",
    				enableDAThumbnails: "Enable DeArrow Thumbnails"
    			}
    		},
    		misc: {
    			title: "Miscellaneous Settings",
    			options: {
    				endScreenCards: "Hide End Screen Cards",
    				youThereRenderer: "Enable 'Are you still watching?' Renderer",
    				paidPromoOverlay: "Enable 'Includes paid promotion' Overlay",
    				whosWatching: {
    					title: "Who's Watching Menu",
    					options: {
    						enableWW: "Enable Who's Watching Menu",
    						permaEnableWW: "Permanently Enable Who's Watching Menu",
    						enableWWOnExit: "Enable Who's Watching Menu on App Exit"
    					}
    				},
    				fixUI: "Fix UI",
    				hqThumbnails: "Enable High Quality Thumbnails",
    				longPress: "Enable Long Press Actions",
    				shorts: "Enable Shorts",
    				videoPreviews: "Enable Video Previews",
    				ttWelcomeMsg: "Show TT Welcome Message",
    				guestSignInReminder: "Show Guest Sign In Reminder",
    				reloadHomeOnStartup: "Reload Home on Startup"
    			}
    		},
    		subtitles: {
    			title: "Subtitle Settings",
    			options: {
    				showLocalSubtitle: "Show Local Subtitle",
    				showHiddenSubtitles: "Show Hidden Subtitles"
    			}
    		},
    		videoPlayer: {
    			title: "Video Player Settings",
    			subtitle: "Customize video player features",
    			options: {
    				patching: {
    					title: "Patch Video Player UI",
    					options: {
    						enableVPUIPatching: "Enable Video Player UI Patching",
    						previousNextBtns: "Enable Previous and Next Buttons",
    						showSuperThxBtn: "Show Super Thanks Button",
    						showAIAskBtn: "Show Ask Button",
    						showSpeedCtrlBtn: "Show Speed Controls Button",
    						addMPBtn: "Show Mini Player Button",
    						swapMPWithPIP: "Swap Mini Player Button with PiP Button"
    					}
    				},
    				preferredVideoQuality: {
    					title: "Preferred Video Quality",
    					subtitle: "Choose the preferred or next best video quality applied when playback starts"
    				},
    				speedSettings: {
    					title: "Speed Settings Increments",
    					subtitle: "Set the speed increments for video playback speed adjustments"
    				},
    				preferredVideoCodec: {
    					title: "Preferred Video Codec",
    					subtitle: "Choose the preferred video codec for playback"
    				},
    				afr: "Auto Frame Rate",
    				afrPauseDuration: {
    					title: "Auto Frame Rate Pause Duration",
    					subtitle: "Set the duration (in seconds) to pause video playback when adjusting frame rate"
    				}
    			}
    		},
    		uiSettings: {
    			title: "User Interface Settings",
    			subtitle: "Customize the UI to your liking",
    			options: {
    				hideWatchedVideos: {
    					title: "Hide Watched Videos",
    					options: {
    						enableHideWatchedVideos: "Enable Hide Watched Videos",
    						watchedVideosThreshold: {
    							title: "Watched Videos Threshold",
    							subtitle: "Set the percentage threshold for hiding watched videos"
    						},
    						setPagesToHideWatchedVideos: "Set Pages to Hide Watched Videos"
    					}
    				},
    				screenDimming: {
    					title: "Screen Dimming",
    					options: {
    						enableScreenDimming: "Enable Screen Dimming",
    						dimmingTimeout: {
    							title: "Dimming Timeout",
    							subtitle: "Set the inactivity timeout (in seconds) before the screen dims"
    						},
    						dimmingOpacity: {
    							title: "Dimming Opacity",
    							subtitle: "Set the opacity level for screen dimming"
    						}
    					}
    				},
    				disableSidebarContents: {
    					title: "Disable Sidebar Contents",
    					subtitle: "Select sidebar contents to disable"
    				},
    				launchToOnStartup: {
    					title: "Launch To on Startup",
    					subtitle: "Choose the default page Fast-Tube opens to on startup"
    				},
    				sortSubscriptionsByAlphabet: "Sort Subscriptions Alphabetically",
    				disableChannelsOnSidebar: "Disable Channels on Sidebar",
    				clock: {
    					title: "Clock",
    					subtitle: "Display a clock on the screen",
    					options: {
    						enableClock: "Enable Clock",
    						isClock12HourFormat: "Use 12-Hour Format for Clock",
    						clockShowSeconds: "Show Seconds on Clock"
    					}
    				}
    			}
    		},
    		updater: {
    			title: "Fast-Tube Cobalt Updater",
    			menuSubtitle: "Manage Fast-Tube Cobalt updates",
    			versionSubtitle: "Current version: {{version}}",
    			options: {
    				checkForUpdates: "Check for updates",
    				checkForUpdatesOnStartup: "Check for updates on startup"
    			}
    		}
    	},
    	ttSettings: {
    		title: "Fast-Tube Settings",
    		madeByText: "Made by RezoxP with ❤️",
    		summary: "Open Fast-Tube Settings"
    	},
    	supportTT: {
    		title: "Support Fast-Tube",
    		subtitle: "❤️ Show support for Fast-Tube and its development",
    		content: {
    			"1": "If you enjoy using Fast-Tube and would like to support its development, consider the following:",
    			"2": "1. Star the GitHub repository to help increase its visibility.",
    			"3": "2. Share Fast-Tube with others.",
    			"4": "If you would like to contribute financially, consider donating:",
    			"5": "- Buy Me A Coffee: https://www.buymeacoffee.com/RezoxP (preferably)",
    			"6": "- GitHub Sponsors: https://github.com/sponsors/RezoxP"
    		}
    	}
    };
    var welcomeMsg = {
    	title: "Welcome to Fast-Tube",
    	subtitle: "Go to settings and click on Fast-Tube Settings for settings."
    };
    var sponsorblock = {
    	segments: {
    		sponsor: "sponsored segment",
    		intro: "intro",
    		outro: "outro",
    		interaction: "interaction reminder",
    		selfpromo: "self-promotion",
    		preview: "recap or preview",
    		filler: "tangents",
    		music_offtopic: "non-music part",
    		poi_highlight: "highlight"
    	},
    	toasts: {
    		skipping: "Skipping {{segment}}",
    		notSkipping: "Not skipping {{segment}} (was skipped {{count}} times)",
    		skip: "Skip {{segment}}",
    		skipToHighlight: "Skip to highlight"
    	}
    };
    var EnglishResource = {
    	__contributors: __contributors,
    	settings: settings,
    	welcomeMsg: welcomeMsg,
    	sponsorblock: sponsorblock
    };

    var resources = {
        en: {
            translation: EnglishResource
        }
    };

    InitI18next('en');

    function InitI18next(lng) {
      instance
        .init({
          lng,
          fallbackLng: 'en',
          resources,
          debug: false,
          interpolation: {
            escapeValue: false,
          }
        });
    }

    //
    // https://raw.githubusercontent.com/Financial-Times/polyfill-library/c25c30e4463bef60fba1213ecb697f3e3f253d7b/polyfills/DOMRect/polyfill.js
    // License: MIT
    //

    (function (global) {
    	function number(v) {
    		return v === undefined ? 0 : Number(v);
    	}
    	
    	function different(u, v) {
    		return u !== v && !(isNaN(u) && isNaN(v));
    	}

    	function DOMRect(xArg, yArg, wArg, hArg) {
    		var x, y, width, height, left, right, top, bottom;

    		x = number(xArg);
    		y = number(yArg);
    		width = number(wArg);
    		height = number(hArg);

    		Object.defineProperties(this, {
    			x: {
    				get: function () { return x; },
    				set: function (newX) {
    					if (different(x, newX)) {
    						x = newX;
    						left = right = undefined;
    					}
    				},
    				enumerable: true
    			},
    			y: {
    				get: function () { return y; },
    				set: function (newY) {
    					if (different(y, newY)) {
    						y = newY;
    						top = bottom = undefined;
    					}
    				},
    				enumerable: true
    			},
    			width: {
    				get: function () { return width; },
    				set: function (newWidth) {
    					if (different(width, newWidth)) {
    						width = newWidth;
    						left = right = undefined;
    					}
    				},
    				enumerable: true
    			},
    			height: {
    				get: function () { return height; },
    				set: function (newHeight) {
    					if (different(height, newHeight)) {
    						height = newHeight;
    						top = bottom = undefined;
    					}
    				},
    				enumerable: true
    			},
    			left: {
    				get: function () {
    					if (left === undefined) {
    						left = x + Math.min(0, width);
    					}
    					return left;
    				},
    				enumerable: true
    			},
    			right: {
    				get: function () {
    					if (right === undefined) {
    						right = x + Math.max(0, width);
    					}
    					return right;
    				},
    				enumerable: true
    			},
    			top: {
    				get: function () {
    					if (top === undefined) {
    						top = y + Math.min(0, height);
    					}
    					return top;
    				},
    				enumerable: true
    			},
    			bottom: {
    				get: function () {
    					if (bottom === undefined) {
    						bottom = y + Math.max(0, height);
    					}
    					return bottom;
    				},
    				enumerable: true
    			}
    		});
    	}
    	
    	global.DOMRect = DOMRect;
    }(self));

    const CONFIG_KEY = 'ytaf-configuration';
    const defaultConfig = {
      enableAdBlock: true,
      enableSponsorBlock: true,
      enableSponsorBlockToasts: true,
      sponsorBlockManualSkips: ['intro', 'outro', 'filler'],
      enableSponsorBlockSponsor: true,
      enableSponsorBlockIntro: true,
      enableSponsorBlockOutro: true,
      enableSponsorBlockInteraction: true,
      enableSponsorBlockSelfPromo: true,
      enableSponsorBlockPreview: true,
      enableSponsorBlockMusicOfftopic: true,
      enableSponsorBlockFiller: false,
      enableSponsorBlockHighlight: true,
      videoSpeed: 1,
      preferredVideoQuality: 'auto',
      enableDeArrow: false,
      enableDeArrowThumbnails: false,
      focusContainerColor: '#0f0f0f',
      routeColor: '#0f0f0f',
      enableFixedUI: (window.h5vcc && window.h5vcc.fasttube) ? false : true,
      enableHqThumbnails: false,
      enableChapters: true,
      enableLongPress: true,
      enableShorts: true,
      dontCheckUpdateUntil: 0,
      enableWhoIsWatchingMenu: false,
      permanentlyEnableWhoIsWatchingMenu: false,
      enableWhosWatchingMenuOnAppExit: false,
      enableShowUserLanguage: true,
      enableShowOtherLanguages: false,
      showWelcomeToast: true,
      enablePreviousNextButtons: true,
      enableSuperThanksButton: false,
      enableAIAskButton: false,
      enableSpeedControlsButton: true,
      enablePatchingVideoPlayer: true,
      enableMPButton: true,
      enableSwapMPWithPIP: false,
      enablePreviews: true,
      enableHideWatchedVideos: false,
      hideWatchedVideosThreshold: 80,
      hideWatchedVideosPages: [],
      enableHideEndScreenCards: false,
      enableYouThereRenderer: true,
      lastAnnouncementCheck: 0,
      enableScreenDimming: false,
      dimmingTimeout: 60,
      dimmingOpacity: 0.5,
      enablePaidPromotionOverlay: true,
      speedSettingsIncrement: 0.25,
      videoPreferredCodec: 'any',
      launchToOnStartup: null,
      reloadHomeOnStartup: true,
      disabledSidebarContents: [],
      disableChannelsOnSidebar: false,
      enableUpdater: true,
      autoFrameRate: false,
      autoFrameRatePauseVideoFor: 0,
      enableSigninReminder: false,
      sortSubscriptionsByAlphabet: false,
      enableClock: false,
      isClock12HourFormat: false,
      clockShowSeconds: false,
    };

    let localConfig;

    try {
      localConfig = JSON.parse(window.localStorage[CONFIG_KEY]);
    } catch (err) {
      console.warn('Config read failed:', err);
      localConfig = defaultConfig;
    }

    function configRead(key) {
      if (localConfig[key] === undefined) {
        console.warn('Populating key', key, 'with default value', defaultConfig[key]);
        localConfig[key] = defaultConfig[key];
      }

      return localConfig[key];
    }

    function configWrite(key, value) {
      console.info('Setting key', key, 'to', value);
      localConfig[key] = value;
      window.localStorage[CONFIG_KEY] = JSON.stringify(localConfig);
      configChangeEmitter.dispatchEvent(new CustomEvent('configChange', { detail: { key, value } }));
    }

    const configChangeEmitter = {
      listeners: {},
      addEventListener(type, callback) {
        if (!this.listeners[type]) this.listeners[type] = [];
        this.listeners[type].push(callback);
      },
      removeEventListener(type, callback) {
        if (!this.listeners[type]) return;
        this.listeners[type] = this.listeners[type].filter(cb => cb !== callback);
      },
      dispatchEvent(event) {
        const type = event.type;
        if (!this.listeners[type]) return;
        this.listeners[type].forEach(cb => {
          try {
            cb.call(this, event);
          } catch (_) {}    });
      }
    };

    // Picture in Picture Mode for Fast-Tube
    // Lightweight, lazy-observed PiP implementation


    window.isPipPlaying = false;
    let PlayerService = null;
    let observerPipEnter = null;

    function pipLoad() {
        if (!window._yttv) return;
        const mappings = Object.values(window._yttv).find(a => a && a.mappings);
        if (!mappings) return;

        PlayerService = mappings.get('PlayerService');
        const PlaybackPreviewService = mappings.get('PlaybackPreviewService');
        if (!PlaybackPreviewService) return;

        const PlaybackPreviewServiceStart = PlaybackPreviewService.start;
        const PlaybackPreviewServiceStop = PlaybackPreviewService.stop;

        PlaybackPreviewService.start = function (...args) {
            if (window.isPipPlaying) return;
            return PlaybackPreviewServiceStart.apply(this, args);
        };

        PlaybackPreviewService.stop = function (...args) {
            if (window.isPipPlaying) return;
            return PlaybackPreviewServiceStop.apply(this, args);
        };
    }

    if (document.readyState === 'complete') {
        pipLoad();
    } else {
        window.addEventListener('load', pipLoad);
    }

    const originalClasses = {
        ytlrSearchVoice: {
            length: 0,
            classes: []
        },
        ytlrSearchVoiceMicButton: {
            length: 0,
            classes: []
        }
    };

    function tryAttachPipButton() {
        if (!window.isPipPlaying) return;
        const searchBar = document.querySelector('ytlr-search-bar');
        if (!searchBar) return;

        const pipButtonExists = document.querySelector('#tt-pip-button');
        if (pipButtonExists) return;

        const voiceButton = searchBar.querySelector('ytlr-search-voice');
        if (voiceButton) {
            const iconClassNames = Object.values(window._yttv).find(a => a instanceof Map && a.has("CLEAR_COOKIES"));
            const iconClassToBeRemoved = iconClassNames?.get('MICROPHONE_ON');
            const iconClearCookiesClass = iconClassNames?.get('CLEAR_COOKIES');
            const pipButton = document.createElement('ytlr-search-voice');

            for (let i = 0; i < voiceButton.classList.length; i++) {
                if (originalClasses.ytlrSearchVoice.length === 0) {
                    originalClasses.ytlrSearchVoice.length = voiceButton.classList.length;
                }

                if (originalClasses.ytlrSearchVoice.length !== voiceButton.classList.length) {
                    for (const className of originalClasses.ytlrSearchVoice.classes) {
                        pipButton.classList.add(className);
                    }
                    break;
                }

                if (!originalClasses.ytlrSearchVoice.classes.includes(voiceButton.classList[i])) {
                    originalClasses.ytlrSearchVoice.classes.push(voiceButton.classList[i]);
                }

                pipButton.classList.add(voiceButton.classList[i]);
            }

            pipButton.style.left = '10.25em';
            pipButton.id = 'tt-pip-button';
            const pipButtonMicButton = document.createElement('ytlr-search-voice-mic-button');

            if (voiceButton.children[0]) {
                for (let i = 0; i < voiceButton.children[0].classList.length; i++) {
                    if (originalClasses.ytlrSearchVoiceMicButton.length === 0) {
                        originalClasses.ytlrSearchVoiceMicButton.length = voiceButton.children[0].classList.length;
                    }
                    
                    if (originalClasses.ytlrSearchVoiceMicButton.length !== voiceButton.children[0].classList.length) {
                        for (const className of originalClasses.ytlrSearchVoiceMicButton.classes) {
                            pipButtonMicButton.classList.add(className);
                        }
                        break;
                    }

                    if (!originalClasses.ytlrSearchVoiceMicButton.classes.includes(voiceButton.children[0].classList[i])) {
                        originalClasses.ytlrSearchVoiceMicButton.classes.push(voiceButton.children[0].classList[i]);
                    }

                    pipButtonMicButton.classList.add(voiceButton.children[0].classList[i]);
                }

                const pipIcon = document.createElement('yt-icon');
                if (voiceButton.children[0].children[0]) {
                    for (let i = 0; i < voiceButton.children[0].children[0].classList.length; i++) {
                        pipIcon.classList.add(voiceButton.children[0].children[0].classList[i]);
                    }
                }
                if (iconClassToBeRemoved) pipIcon.classList.remove(iconClassToBeRemoved);
                if (iconClearCookiesClass) pipIcon.classList.add(iconClearCookiesClass);

                pipButtonMicButton.appendChild(pipIcon);
            }

            pipButton.appendChild(pipButtonMicButton);
            searchBar.appendChild(pipButton);
        } else {
            const pipButton = document.createElement('ytlr-search-voice');
            pipButton.style.left = '10.25em';
            pipButton.id = 'tt-pip-button';
            pipButton.setAttribute('idomkey', 'ytLrSearchBarSearchVoice');
            pipButton.setAttribute('tabindex', '0');
            pipButton.classList.add('ytLrSearchVoiceHost', 'ytLrSearchBarSearchVoice');

            const pipButtonMicButton = document.createElement('ytlr-search-voice-mic-button');
            pipButtonMicButton.setAttribute('hybridnavfocusable', 'true');
            pipButtonMicButton.setAttribute('tabindex', '-1');
            pipButtonMicButton.classList.add('ytLrSearchVoiceMicButtonHost', 'zylon-ve');

            const pipIcon = document.createElement('yt-icon');
            pipIcon.setAttribute('tabindex', '-1');
            pipIcon.classList.add('ytContribIconTvArrowLeft', 'ytContribIconHost', 'ytLrSearchVoiceMicButtonIcon');

            pipButtonMicButton.appendChild(pipIcon);
            pipButton.appendChild(pipButtonMicButton);
            searchBar.appendChild(pipButton);
        }
    }

    function startPipObserver() {
        if (!observerPipEnter) {
            observerPipEnter = new MutationObserver(() => {
                if (!window.isPipPlaying) return;
                tryAttachPipButton();
            });
        }
        observerPipEnter.observe(document.body, { childList: true, subtree: true });
    }

    function stopPipObserver() {
        if (observerPipEnter) {
            observerPipEnter.disconnect();
            observerPipEnter = null;
        }
    }

    function enablePip() {
        if (!PlayerService) pipLoad();
        if (!PlayerService) return;

        const videoElement = document.querySelector('video');
        if (!videoElement) return;

        const timestamp = Math.floor(videoElement.currentTime);
        const ytlrPlayer = document.querySelector('ytlr-player');
        const ytlrPlayerContainer = document.querySelector('ytlr-player-container');
        if (!ytlrPlayer) return;

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.attributeName === 'class') {
                    if (!ytlrPlayer.classList.contains('ytLrPlayerEnabled')) {
                        function setStyles() {
                            if (ytlrPlayerContainer) ytlrPlayerContainer.style.zIndex = '10';
                            ytlrPlayer.style.display = 'block';
                            ytlrPlayer.style.backgroundColor = 'rgba(0,0,0,0)';
                        }

                        setStyles();
                        setTimeout(setStyles, 500);

                        function onPipEnter() {
                            videoElement.style.removeProperty('inset');
                            const pipWidth = window.innerWidth / 3.5;
                            const pipHeight = window.innerHeight / 3.5;
                            videoElement.style.width = `${pipWidth}px`;
                            videoElement.style.height = `${pipHeight}px`;
                            videoElement.style.top = '68vh';
                            videoElement.style.left = '68vw';

                            window.isPipPlaying = true;
                            videoElement.removeEventListener('play', onPipEnter);
                            startPipObserver();
                            tryAttachPipButton();
                        }

                        videoElement.addEventListener('play', onPipEnter);
                        observer.disconnect();

                        setTimeout(() => {
                            if (PlayerService.loadedPlaybackConfig?.watchEndpoint) {
                                PlayerService.loadedPlaybackConfig.watchEndpoint.startTimeSeconds = timestamp;
                                PlayerService.loadVideo(PlayerService.loadedPlaybackConfig);
                            }
                        }, 1000);
                    }
                }
            }
        });

        observer.observe(ytlrPlayer, { attributes: true });

        // Exit from the current video player
        resolveCommand({
            signalAction: {
                signal: "HISTORY_BACK"
            }
        });
    }

    function pipToFullscreen() {
        if (!PlayerService?.loadedPlaybackConfig) return;
        const { clickTrackingParams, commandMetadata, watchEndpoint } = PlayerService.loadedPlaybackConfig;
        const video = document.querySelector('video');
        if (watchEndpoint && video) {
            watchEndpoint.startTimeSeconds = Math.floor(video.currentTime);
        }
        const command = {
            clickTrackingParams,
            commandMetadata,
            watchEndpoint
        };
        resolveCommand(command);
        window.isPipPlaying = false;
        stopPipObserver();
    }

    function showToast(title, subtitle, thumbnails) {
        const toastCmd = {
            openPopupAction: {
                popupType: 'TOAST',
                popup: {
                    overlayToastRenderer: {
                        title: {
                            simpleText: title
                        },
                        subtitle: {
                            simpleText: subtitle
                        }
                    }
                }
            }
        };

        if (thumbnails) {
            toastCmd.openPopupAction.popup.overlayToastRenderer.image.thumbnails = thumbnails;
        }
        resolveCommand(toastCmd);
    }

    function Modal(header, content, id, update) {
        const titleSubtitleObj = typeof header === 'string' ? { title: header, subtitle: '' } : header;
        const overlayPanelHeaderRenderer = header.overlayPanelHeaderRenderer || {
            title: {
                simpleText: titleSubtitleObj.title
            }
        };
        const modalCmd = {
            openPopupAction: {
                popupType: 'MODAL',
                popup: {
                    overlaySectionRenderer: {
                        overlay: {
                            overlayTwoPanelRenderer: {
                                actionPanel: {
                                    overlayPanelRenderer: {
                                        header: {
                                            overlayPanelHeaderRenderer
                                        },
                                        content
                                    }
                                },
                                backButton: {
                                    buttonRenderer: {
                                        accessibilityData: {
                                            accessibilityData: {
                                                label: 'Back'
                                            }
                                        },
                                        command: {
                                            signalAction: {
                                                signal: 'POPUP_BACK'
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        dismissalCommand: {
                            signalAction: {
                                signal: 'POPUP_BACK'
                            }
                        }
                    }
                },
                uniqueId: id
            }
        };

        if (titleSubtitleObj.subtitle) {
            modalCmd.openPopupAction.popup.overlaySectionRenderer.overlay.overlayTwoPanelRenderer.actionPanel.overlayPanelRenderer.header.overlayPanelHeaderRenderer.subtitle = {
                simpleText: titleSubtitleObj.subtitle
            };
        }

        if (update) {
            modalCmd.openPopupAction.shouldMatchUniqueId = true;
            modalCmd.openPopupAction.updateAction = true;
        }

        return modalCmd;
    }

    function showModal(header, content, id, update) {
        const modalCmd = Modal(header, content, id, update);

        resolveCommand(modalCmd);
    }

    function overlayPanelItemListRenderer(items, selectedIndex) {
        return {
            overlayPanelItemListRenderer: {
                items,
                selectedIndex
            }
        }
    }
    function buttonItem(title, icon, commands) {
        const button = {
            compactLinkRenderer: {
                serviceEndpoint: {
                    commandExecutorCommand: {
                        commands
                    }
                }
            }
        };

        if (title) {
            button.compactLinkRenderer.title = {
                simpleText: title.title
            };
        }

        if (title.subtitle) {
            button.compactLinkRenderer.subtitle = {
                simpleText: title.subtitle
            };
        }

        if (icon) {
            button.compactLinkRenderer.icon = {
                iconType: icon.icon,
            };
        }

        if (icon && icon.secondaryIcon) {
            button.compactLinkRenderer.secondaryIcon = {
                iconType: icon.secondaryIcon,
            };
        }

        return button;
    }


    function timelyAction(text, icon, command, triggerTimeMs, timeoutMs) {
        return {
            timelyActionRenderer: {
                actionButtons: [
                    {
                        buttonRenderer: {
                            isDisabled: false,
                            text: {
                                runs: [
                                    {
                                        text: text
                                    }
                                ]
                            },
                            icon: {
                                iconType: icon
                            },
                            trackingParams: null,
                            command
                        }
                    }
                ],
                triggerTimeMs,
                timeoutMs,
                type: ''
            }
        }

    }

    function longPressData(data) {
        return {
            clickTrackingParams: null,
            showMenuCommand: {
                contentId: data.videoId,
                thumbnail: {
                    thumbnails: data.thumbnails
                },
                title: {
                    simpleText: data.title
                },
                subtitle: {
                    simpleText: data.subtitle
                },
                menu: {
                    menuRenderer: {
                        items: [
                            MenuNavigationItemRenderer('Play', {
                                clickTrackingParams: null,
                                watchEndpoint: data.watchEndpointData
                            }),
                            MenuServiceItemRenderer('Save to Watch Later', {
                                clickTrackingParams: null,
                                playlistEditEndpoint: {
                                    playlistId: 'WL',
                                    actions: [
                                        {
                                            addedVideoId: data.videoId,
                                            action: 'ACTION_ADD_VIDEO'
                                        }
                                    ]
                                }
                            }),
                            MenuNavigationItemRenderer('Save to Playlist', {
                                clickTrackingParams: null,
                                addToPlaylistEndpoint: {
                                    videoId: data.videoId
                                }
                            }),
                            MenuServiceItemRenderer('Add to Queue', {
                                clickTrackingParams: null,
                                playlistEditEndpoint: {
                                    customAction: {
                                        action: 'ADD_TO_QUEUE',
                                        parameters: data.item
                                    }
                                }
                            }),
                        ],
                        trackingParams: null,
                        accessibility: {
                            accessibilityData: {
                                label: 'Video options'
                            }
                        }
                    }
                }
            }
        }
    }

    function MenuServiceItemRenderer(text, serviceEndpoint) {
        return {
            menuServiceItemRenderer: {
                text: {
                    runs: [
                        {
                            text
                        }
                    ]
                },
                serviceEndpoint,
                trackingParams: null
            }
        };
    }

    function MenuNavigationItemRenderer(text, navigateEndpoint) {
        return {
            menuNavigationItemRenderer: {
                text: {
                    runs: [
                        {
                            text
                        }
                    ]
                },
                navigationEndpoint: navigateEndpoint,
                trackingParams: null
            }
        }
    }

    function SettingsCategory(categoryId, items, title) {
        const category = {
            settingCategoryCollectionRenderer: {
                items,
                categoryId,
                focused: false,
                trackingParams: "null"
            }
        };

        if (title) {
            category.settingCategoryCollectionRenderer.title = {
                runs: [
                    {
                        text: title
                    }
                ]
            };
        }

        return category;
    }

    function SettingActionRenderer(title, itemId, serviceEndpoint, summary, thumbnail) {
        return {
            settingActionRenderer: {
                title: {
                    runs: [
                        {
                            text: title
                        }
                    ]
                },
                serviceEndpoint,
                summary: {
                    runs: [
                        {
                            text: summary
                        }
                    ]
                },
                trackingParams: "null",
                actionLabel: {
                    runs: [
                        {
                            text: title
                        }
                    ]
                },
                itemId,
                thumbnail: {
                    thumbnails: [
                        {
                            url: thumbnail
                        }
                    ]
                }
            }
        }
    }

    function overlayMessageRenderer(simpleText) {
        return {
            overlayMessageRenderer: {
                title: {
                    simpleText
                }
            }
        }
    }

    function ShelfRenderer(simpleText, items, selectedIndex = 0) {
        return {
            shelfRenderer: {
                shelfHeaderRenderer: {
                    title: {
                        simpleText
                    }
                },
                tvhtml5ShelfRendererType: "TVHTML5_SHELF_RENDERER_TYPE_GRID",
                content: {
                    horizontalListRenderer: {
                        items,
                        selectedIndex,
                        visibleItemCount: 3
                    }
                }
            }
        }
    }

    function TileRenderer(simpleText, onSelectCommand) {
        return {
            tileRenderer: {
                contentType: "TILE_CONTENT_TYPE_VIDEO",
                metadata: {
                    tileMetadataRenderer: {
                        title: {
                            simpleText
                        }
                    }
                },
                onSelectCommand,
                style: "TILE_STYLE_YTLR_DEFAULT"
            }
        }
    }

    function ButtonRenderer(disabled, text, iconType, command) {
        return {
            isDisabled: disabled,
            text: {
                runs: [
                    {
                        text: text
                    }
                ]
            },
            icon: {
                iconType
            },
            command: command,
            trackingParams: null
        };
    }

    var qrcode = {};

    var hasRequiredQrcode;

    function requireQrcode () {
    	if (hasRequiredQrcode) return qrcode;
    	hasRequiredQrcode = 1;
    	//---------------------------------------------------------------------
    	//
    	// QR Code Generator for JavaScript
    	//
    	// Copyright (c) 2009 Kazuhiko Arase
    	//
    	// URL: http://www.d-project.com/
    	//
    	// Licensed under the MIT license:
    	//	http://www.opensource.org/licenses/mit-license.php
    	//
    	// The word 'QR Code' is registered trademark of
    	// DENSO WAVE INCORPORATED
    	//	http://www.denso-wave.com/qrcode/faqpatent-e.html
    	//
    	//---------------------------------------------------------------------

    	qrcode.qrcode = function() {

    		//---------------------------------------------------------------------
    		// qrcode
    		//---------------------------------------------------------------------

    		/**
    		 * qrcode
    		 * @param typeNumber 1 to 10
    		 * @param errorCorrectLevel 'L','M','Q','H'
    		 */
    		var qrcode = function(typeNumber, errorCorrectLevel) {

    			var PAD0 = 0xEC;
    			var PAD1 = 0x11;

    			var _typeNumber = typeNumber;
    			var _errorCorrectLevel = QRErrorCorrectLevel[errorCorrectLevel];
    			var _modules = null;
    			var _moduleCount = 0;
    			var _dataCache = null;
    			var _dataList = new Array();

    			var _this = {};

    			var makeImpl = function(test, maskPattern) {

    				_moduleCount = _typeNumber * 4 + 17;
    				_modules = function(moduleCount) {
    					var modules = new Array(moduleCount);
    					for (var row = 0; row < moduleCount; row += 1) {
    						modules[row] = new Array(moduleCount);
    						for (var col = 0; col < moduleCount; col += 1) {
    							modules[row][col] = null;
    						}
    					}
    					return modules;
    				}(_moduleCount);

    				setupPositionProbePattern(0, 0);
    				setupPositionProbePattern(_moduleCount - 7, 0);
    				setupPositionProbePattern(0, _moduleCount - 7);
    				setupPositionAdjustPattern();
    				setupTimingPattern();
    				setupTypeInfo(test, maskPattern);

    				if (_typeNumber >= 7) {
    					setupTypeNumber(test);
    				}

    				if (_dataCache == null) {
    					_dataCache = createData(_typeNumber, _errorCorrectLevel, _dataList);
    				}

    				mapData(_dataCache, maskPattern);
    			};

    			var setupPositionProbePattern = function(row, col) {

    				for (var r = -1; r <= 7; r += 1) {

    					if (row + r <= -1 || _moduleCount <= row + r) continue;

    					for (var c = -1; c <= 7; c += 1) {

    						if (col + c <= -1 || _moduleCount <= col + c) continue;

    						if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )
    								|| (0 <= c && c <= 6 && (r == 0 || r == 6) )
    								|| (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
    							_modules[row + r][col + c] = true;
    						} else {
    							_modules[row + r][col + c] = false;
    						}
    					}
    				}
    			};

    			var getBestMaskPattern = function() {

    				var minLostPoint = 0;
    				var pattern = 0;

    				for (var i = 0; i < 8; i += 1) {

    					makeImpl(true, i);

    					var lostPoint = QRUtil.getLostPoint(_this);

    					if (i == 0 || minLostPoint > lostPoint) {
    						minLostPoint = lostPoint;
    						pattern = i;
    					}
    				}

    				return pattern;
    			};

    			var setupTimingPattern = function() {

    				for (var r = 8; r < _moduleCount - 8; r += 1) {
    					if (_modules[r][6] != null) {
    						continue;
    					}
    					_modules[r][6] = (r % 2 == 0);
    				}

    				for (var c = 8; c < _moduleCount - 8; c += 1) {
    					if (_modules[6][c] != null) {
    						continue;
    					}
    					_modules[6][c] = (c % 2 == 0);
    				}
    			};

    			var setupPositionAdjustPattern = function() {

    				var pos = QRUtil.getPatternPosition(_typeNumber);

    				for (var i = 0; i < pos.length; i += 1) {

    					for (var j = 0; j < pos.length; j += 1) {

    						var row = pos[i];
    						var col = pos[j];

    						if (_modules[row][col] != null) {
    							continue;
    						}

    						for (var r = -2; r <= 2; r += 1) {

    							for (var c = -2; c <= 2; c += 1) {

    								if (r == -2 || r == 2 || c == -2 || c == 2
    										|| (r == 0 && c == 0) ) {
    									_modules[row + r][col + c] = true;
    								} else {
    									_modules[row + r][col + c] = false;
    								}
    							}
    						}
    					}
    				}
    			};

    			var setupTypeNumber = function(test) {

    				var bits = QRUtil.getBCHTypeNumber(_typeNumber);

    				for (var i = 0; i < 18; i += 1) {
    					var mod = (!test && ( (bits >> i) & 1) == 1);
    					_modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
    				}

    				for (var i = 0; i < 18; i += 1) {
    					var mod = (!test && ( (bits >> i) & 1) == 1);
    					_modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
    				}
    			};

    			var setupTypeInfo = function(test, maskPattern) {

    				var data = (_errorCorrectLevel << 3) | maskPattern;
    				var bits = QRUtil.getBCHTypeInfo(data);

    				// vertical
    				for (var i = 0; i < 15; i += 1) {

    					var mod = (!test && ( (bits >> i) & 1) == 1);

    					if (i < 6) {
    						_modules[i][8] = mod;
    					} else if (i < 8) {
    						_modules[i + 1][8] = mod;
    					} else {
    						_modules[_moduleCount - 15 + i][8] = mod;
    					}
    				}

    				// horizontal
    				for (var i = 0; i < 15; i += 1) {

    					var mod = (!test && ( (bits >> i) & 1) == 1);

    					if (i < 8) {
    						_modules[8][_moduleCount - i - 1] = mod;
    					} else if (i < 9) {
    						_modules[8][15 - i - 1 + 1] = mod;
    					} else {
    						_modules[8][15 - i - 1] = mod;
    					}
    				}

    				// fixed module
    				_modules[_moduleCount - 8][8] = (!test);
    			};

    			var mapData = function(data, maskPattern) {

    				var inc = -1;
    				var row = _moduleCount - 1;
    				var bitIndex = 7;
    				var byteIndex = 0;
    				var maskFunc = QRUtil.getMaskFunction(maskPattern);

    				for (var col = _moduleCount - 1; col > 0; col -= 2) {

    					if (col == 6) col -= 1;

    					while (true) {

    						for (var c = 0; c < 2; c += 1) {

    							if (_modules[row][col - c] == null) {

    								var dark = false;

    								if (byteIndex < data.length) {
    									dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
    								}

    								var mask = maskFunc(row, col - c);

    								if (mask) {
    									dark = !dark;
    								}

    								_modules[row][col - c] = dark;
    								bitIndex -= 1;

    								if (bitIndex == -1) {
    									byteIndex += 1;
    									bitIndex = 7;
    								}
    							}
    						}

    						row += inc;

    						if (row < 0 || _moduleCount <= row) {
    							row -= inc;
    							inc = -inc;
    							break;
    						}
    					}
    				}
    			};

    			var createBytes = function(buffer, rsBlocks) {

    				var offset = 0;

    				var maxDcCount = 0;
    				var maxEcCount = 0;

    				var dcdata = new Array(rsBlocks.length);
    				var ecdata = new Array(rsBlocks.length);

    				for (var r = 0; r < rsBlocks.length; r += 1) {

    					var dcCount = rsBlocks[r].dataCount;
    					var ecCount = rsBlocks[r].totalCount - dcCount;

    					maxDcCount = Math.max(maxDcCount, dcCount);
    					maxEcCount = Math.max(maxEcCount, ecCount);

    					dcdata[r] = new Array(dcCount);

    					for (var i = 0; i < dcdata[r].length; i += 1) {
    						dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
    					}
    					offset += dcCount;

    					var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
    					var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);

    					var modPoly = rawPoly.mod(rsPoly);
    					ecdata[r] = new Array(rsPoly.getLength() - 1);
    					for (var i = 0; i < ecdata[r].length; i += 1) {
    						var modIndex = i + modPoly.getLength() - ecdata[r].length;
    						ecdata[r][i] = (modIndex >= 0)? modPoly.get(modIndex) : 0;
    					}
    				}

    				var totalCodeCount = 0;
    				for (var i = 0; i < rsBlocks.length; i += 1) {
    					totalCodeCount += rsBlocks[i].totalCount;
    				}

    				var data = new Array(totalCodeCount);
    				var index = 0;

    				for (var i = 0; i < maxDcCount; i += 1) {
    					for (var r = 0; r < rsBlocks.length; r += 1) {
    						if (i < dcdata[r].length) {
    							data[index] = dcdata[r][i];
    							index += 1;
    						}
    					}
    				}

    				for (var i = 0; i < maxEcCount; i += 1) {
    					for (var r = 0; r < rsBlocks.length; r += 1) {
    						if (i < ecdata[r].length) {
    							data[index] = ecdata[r][i];
    							index += 1;
    						}
    					}
    				}

    				return data;
    			};

    			var createData = function(typeNumber, errorCorrectLevel, dataList) {

    				var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);

    				var buffer = qrBitBuffer();

    				for (var i = 0; i < dataList.length; i += 1) {
    					var data = dataList[i];
    					buffer.put(data.getMode(), 4);
    					buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
    					data.write(buffer);
    				}

    				// calc num max data.
    				var totalDataCount = 0;
    				for (var i = 0; i < rsBlocks.length; i += 1) {
    					totalDataCount += rsBlocks[i].dataCount;
    				}

    				if (buffer.getLengthInBits() > totalDataCount * 8) {
    					throw new Error('code length overflow. ('
    						+ buffer.getLengthInBits()
    						+ '>'
    						+ totalDataCount * 8
    						+ ')');
    				}

    				// end code
    				if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
    					buffer.put(0, 4);
    				}

    				// padding
    				while (buffer.getLengthInBits() % 8 != 0) {
    					buffer.putBit(false);
    				}

    				// padding
    				while (true) {

    					if (buffer.getLengthInBits() >= totalDataCount * 8) {
    						break;
    					}
    					buffer.put(PAD0, 8);

    					if (buffer.getLengthInBits() >= totalDataCount * 8) {
    						break;
    					}
    					buffer.put(PAD1, 8);
    				}

    				return createBytes(buffer, rsBlocks);
    			};

    			_this.addData = function(data) {
    				var newData = qr8BitByte(data);
    				_dataList.push(newData);
    				_dataCache = null;
    			};

    			_this.isDark = function(row, col) {
    				if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
    					throw new Error(row + ',' + col);
    				}
    				return _modules[row][col];
    			};

    			_this.getModuleCount = function() {
    				return _moduleCount;
    			};

    			_this.make = function() {
    				makeImpl(false, getBestMaskPattern() );
    			};

    			_this.createTableTag = function(cellSize, margin) {

    				cellSize = cellSize || 2;
    				margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

    				var qrHtml = '';

    				qrHtml += '<table style="';
    				qrHtml += ' border-width: 0px; border-style: none;';
    				qrHtml += ' border-collapse: collapse;';
    				qrHtml += ' padding: 0px; margin: ' + margin + 'px;';
    				qrHtml += '">';
    				qrHtml += '<tbody>';

    				for (var r = 0; r < _this.getModuleCount(); r += 1) {

    					qrHtml += '<tr>';

    					for (var c = 0; c < _this.getModuleCount(); c += 1) {
    						qrHtml += '<td style="';
    						qrHtml += ' border-width: 0px; border-style: none;';
    						qrHtml += ' border-collapse: collapse;';
    						qrHtml += ' padding: 0px; margin: 0px;';
    						qrHtml += ' width: ' + cellSize + 'px;';
    						qrHtml += ' height: ' + cellSize + 'px;';
    						qrHtml += ' background-color: ';
    						qrHtml += _this.isDark(r, c)? '#000000' : '#ffffff';
    						qrHtml += ';';
    						qrHtml += '"/>';
    					}

    					qrHtml += '</tr>';
    				}

    				qrHtml += '</tbody>';
    				qrHtml += '</table>';

    				return qrHtml;
    			};

    			_this.createImgTag = function(cellSize, margin) {

    				cellSize = cellSize || 2;
    				margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

    				var size = _this.getModuleCount() * cellSize + margin * 2;
    				var min = margin;
    				var max = size - margin;

    				return createImgTag(size, size, function(x, y) {
    					if (min <= x && x < max && min <= y && y < max) {
    						var c = Math.floor( (x - min) / cellSize);
    						var r = Math.floor( (y - min) / cellSize);
    						return _this.isDark(r, c)? 0 : 1;
    					} else {
    						return 1;
    					}
    				} );
    			};

    			return _this;
    		};

    		//---------------------------------------------------------------------
    		// qrcode.stringToBytes
    		//---------------------------------------------------------------------

    		qrcode.stringToBytes = function(s) {
    			var bytes = new Array();
    			for (var i = 0; i < s.length; i += 1) {
    				var c = s.charCodeAt(i);
    				bytes.push(c & 0xff);
    			}
    			return bytes;
    		};

    		//---------------------------------------------------------------------
    		// qrcode.createStringToBytes
    		//---------------------------------------------------------------------

    		/**
    		 * @param unicodeData base64 string of byte array.
    		 * [16bit Unicode],[16bit Bytes], ...
    		 * @param numChars
    		 */
    		qrcode.createStringToBytes = function(unicodeData, numChars) {

    			// create conversion map.

    			var unicodeMap = function() {

    				var bin = base64DecodeInputStream(unicodeData);
    				var read = function() {
    					var b = bin.read();
    					if (b == -1) throw new Error();
    					return b;
    				};

    				var count = 0;
    				var unicodeMap = {};
    				while (true) {
    					var b0 = bin.read();
    					if (b0 == -1) break;
    					var b1 = read();
    					var b2 = read();
    					var b3 = read();
    					var k = String.fromCharCode( (b0 << 8) | b1);
    					var v = (b2 << 8) | b3;
    					unicodeMap[k] = v;
    					count += 1;
    				}
    				if (count != numChars) {
    					throw new Error(count + ' != ' + numChars);
    				}

    				return unicodeMap;
    			}();

    			var unknownChar = '?'.charCodeAt(0);

    			return function(s) {
    				var bytes = new Array();
    				for (var i = 0; i < s.length; i += 1) {
    					var c = s.charCodeAt(i);
    					if (c < 128) {
    						bytes.push(c);
    					} else {
    						var b = unicodeMap[s.charAt(i)];
    						if (typeof b == 'number') {
    							if ( (b & 0xff) == b) {
    								// 1byte
    								bytes.push(b);
    							} else {
    								// 2bytes
    								bytes.push(b >>> 8);
    								bytes.push(b & 0xff);
    							}
    						} else {
    							bytes.push(unknownChar);
    						}
    					}
    				}
    				return bytes;
    			};
    		};

    		//---------------------------------------------------------------------
    		// QRMode
    		//---------------------------------------------------------------------

    		var QRMode = {
    			MODE_NUMBER :		1 << 0,
    			MODE_ALPHA_NUM : 	1 << 1,
    			MODE_8BIT_BYTE : 	1 << 2,
    			MODE_KANJI :		1 << 3
    		};

    		//---------------------------------------------------------------------
    		// QRErrorCorrectLevel
    		//---------------------------------------------------------------------

    		var QRErrorCorrectLevel = {
    			L : 1,
    			M : 0,
    			Q : 3,
    			H : 2
    		};

    		//---------------------------------------------------------------------
    		// QRMaskPattern
    		//---------------------------------------------------------------------

    		var QRMaskPattern = {
    			PATTERN000 : 0,
    			PATTERN001 : 1,
    			PATTERN010 : 2,
    			PATTERN011 : 3,
    			PATTERN100 : 4,
    			PATTERN101 : 5,
    			PATTERN110 : 6,
    			PATTERN111 : 7
    		};

    		//---------------------------------------------------------------------
    		// QRUtil
    		//---------------------------------------------------------------------

    		var QRUtil = function() {

    			var PATTERN_POSITION_TABLE = [
    				[],
    				[6, 18],
    				[6, 22],
    				[6, 26],
    				[6, 30],
    				[6, 34],
    				[6, 22, 38],
    				[6, 24, 42],
    				[6, 26, 46],
    				[6, 28, 50],
    				[6, 30, 54],
    				[6, 32, 58],
    				[6, 34, 62],
    				[6, 26, 46, 66],
    				[6, 26, 48, 70],
    				[6, 26, 50, 74],
    				[6, 30, 54, 78],
    				[6, 30, 56, 82],
    				[6, 30, 58, 86],
    				[6, 34, 62, 90],
    				[6, 28, 50, 72, 94],
    				[6, 26, 50, 74, 98],
    				[6, 30, 54, 78, 102],
    				[6, 28, 54, 80, 106],
    				[6, 32, 58, 84, 110],
    				[6, 30, 58, 86, 114],
    				[6, 34, 62, 90, 118],
    				[6, 26, 50, 74, 98, 122],
    				[6, 30, 54, 78, 102, 126],
    				[6, 26, 52, 78, 104, 130],
    				[6, 30, 56, 82, 108, 134],
    				[6, 34, 60, 86, 112, 138],
    				[6, 30, 58, 86, 114, 142],
    				[6, 34, 62, 90, 118, 146],
    				[6, 30, 54, 78, 102, 126, 150],
    				[6, 24, 50, 76, 102, 128, 154],
    				[6, 28, 54, 80, 106, 132, 158],
    				[6, 32, 58, 84, 110, 136, 162],
    				[6, 26, 54, 82, 110, 138, 166],
    				[6, 30, 58, 86, 114, 142, 170]
    			];
    			var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
    			var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
    			var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

    			var _this = {};

    			var getBCHDigit = function(data) {
    				var digit = 0;
    				while (data != 0) {
    					digit += 1;
    					data >>>= 1;
    				}
    				return digit;
    			};

    			_this.getBCHTypeInfo = function(data) {
    				var d = data << 10;
    				while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
    					d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15) ) );
    				}
    				return ( (data << 10) | d) ^ G15_MASK;
    			};

    			_this.getBCHTypeNumber = function(data) {
    				var d = data << 12;
    				while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
    					d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18) ) );
    				}
    				return (data << 12) | d;
    			};

    			_this.getPatternPosition = function(typeNumber) {
    				return PATTERN_POSITION_TABLE[typeNumber - 1];
    			};

    			_this.getMaskFunction = function(maskPattern) {

    				switch (maskPattern) {

    				case QRMaskPattern.PATTERN000 :
    					return function(i, j) { return (i + j) % 2 == 0; };
    				case QRMaskPattern.PATTERN001 :
    					return function(i, j) { return i % 2 == 0; };
    				case QRMaskPattern.PATTERN010 :
    					return function(i, j) { return j % 3 == 0; };
    				case QRMaskPattern.PATTERN011 :
    					return function(i, j) { return (i + j) % 3 == 0; };
    				case QRMaskPattern.PATTERN100 :
    					return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0; };
    				case QRMaskPattern.PATTERN101 :
    					return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };
    				case QRMaskPattern.PATTERN110 :
    					return function(i, j) { return ( (i * j) % 2 + (i * j) % 3) % 2 == 0; };
    				case QRMaskPattern.PATTERN111 :
    					return function(i, j) { return ( (i * j) % 3 + (i + j) % 2) % 2 == 0; };

    				default :
    					throw new Error('bad maskPattern:' + maskPattern);
    				}
    			};

    			_this.getErrorCorrectPolynomial = function(errorCorrectLength) {
    				var a = qrPolynomial([1], 0);
    				for (var i = 0; i < errorCorrectLength; i += 1) {
    					a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0) );
    				}
    				return a;
    			};

    			_this.getLengthInBits = function(mode, type) {

    				if (1 <= type && type < 10) {

    					// 1 - 9

    					switch(mode) {
    					case QRMode.MODE_NUMBER 	: return 10;
    					case QRMode.MODE_ALPHA_NUM 	: return 9;
    					case QRMode.MODE_8BIT_BYTE	: return 8;
    					case QRMode.MODE_KANJI		: return 8;
    					default :
    						throw new Error('mode:' + mode);
    					}

    				} else if (type < 27) {

    					// 10 - 26

    					switch(mode) {
    					case QRMode.MODE_NUMBER 	: return 12;
    					case QRMode.MODE_ALPHA_NUM 	: return 11;
    					case QRMode.MODE_8BIT_BYTE	: return 16;
    					case QRMode.MODE_KANJI		: return 10;
    					default :
    						throw new Error('mode:' + mode);
    					}

    				} else if (type < 41) {

    					// 27 - 40

    					switch(mode) {
    					case QRMode.MODE_NUMBER 	: return 14;
    					case QRMode.MODE_ALPHA_NUM	: return 13;
    					case QRMode.MODE_8BIT_BYTE	: return 16;
    					case QRMode.MODE_KANJI		: return 12;
    					default :
    						throw new Error('mode:' + mode);
    					}

    				} else {
    					throw new Error('type:' + type);
    				}
    			};

    			_this.getLostPoint = function(qrcode) {

    				var moduleCount = qrcode.getModuleCount();

    				var lostPoint = 0;

    				// LEVEL1

    				for (var row = 0; row < moduleCount; row += 1) {
    					for (var col = 0; col < moduleCount; col += 1) {

    						var sameCount = 0;
    						var dark = qrcode.isDark(row, col);

    						for (var r = -1; r <= 1; r += 1) {

    							if (row + r < 0 || moduleCount <= row + r) {
    								continue;
    							}

    							for (var c = -1; c <= 1; c += 1) {

    								if (col + c < 0 || moduleCount <= col + c) {
    									continue;
    								}

    								if (r == 0 && c == 0) {
    									continue;
    								}

    								if (dark == qrcode.isDark(row + r, col + c) ) {
    									sameCount += 1;
    								}
    							}
    						}

    						if (sameCount > 5) {
    							lostPoint += (3 + sameCount - 5);
    						}
    					}
    				}
    				// LEVEL2

    				for (var row = 0; row < moduleCount - 1; row += 1) {
    					for (var col = 0; col < moduleCount - 1; col += 1) {
    						var count = 0;
    						if (qrcode.isDark(row, col) ) count += 1;
    						if (qrcode.isDark(row + 1, col) ) count += 1;
    						if (qrcode.isDark(row, col + 1) ) count += 1;
    						if (qrcode.isDark(row + 1, col + 1) ) count += 1;
    						if (count == 0 || count == 4) {
    							lostPoint += 3;
    						}
    					}
    				}

    				// LEVEL3

    				for (var row = 0; row < moduleCount; row += 1) {
    					for (var col = 0; col < moduleCount - 6; col += 1) {
    						if (qrcode.isDark(row, col)
    								&& !qrcode.isDark(row, col + 1)
    								&&  qrcode.isDark(row, col + 2)
    								&&  qrcode.isDark(row, col + 3)
    								&&  qrcode.isDark(row, col + 4)
    								&& !qrcode.isDark(row, col + 5)
    								&&  qrcode.isDark(row, col + 6) ) {
    							lostPoint += 40;
    						}
    					}
    				}

    				for (var col = 0; col < moduleCount; col += 1) {
    					for (var row = 0; row < moduleCount - 6; row += 1) {
    						if (qrcode.isDark(row, col)
    								&& !qrcode.isDark(row + 1, col)
    								&&  qrcode.isDark(row + 2, col)
    								&&  qrcode.isDark(row + 3, col)
    								&&  qrcode.isDark(row + 4, col)
    								&& !qrcode.isDark(row + 5, col)
    								&&  qrcode.isDark(row + 6, col) ) {
    							lostPoint += 40;
    						}
    					}
    				}

    				// LEVEL4

    				var darkCount = 0;

    				for (var col = 0; col < moduleCount; col += 1) {
    					for (var row = 0; row < moduleCount; row += 1) {
    						if (qrcode.isDark(row, col) ) {
    							darkCount += 1;
    						}
    					}
    				}

    				var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
    				lostPoint += ratio * 10;

    				return lostPoint;
    			};

    			return _this;
    		}();

    		//---------------------------------------------------------------------
    		// QRMath
    		//---------------------------------------------------------------------

    		var QRMath = function() {

    			var EXP_TABLE = new Array(256);
    			var LOG_TABLE = new Array(256);

    			// initialize tables
    			for (var i = 0; i < 8; i += 1) {
    				EXP_TABLE[i] = 1 << i;
    			}
    			for (var i = 8; i < 256; i += 1) {
    				EXP_TABLE[i] = EXP_TABLE[i - 4]
    					^ EXP_TABLE[i - 5]
    					^ EXP_TABLE[i - 6]
    					^ EXP_TABLE[i - 8];
    			}
    			for (var i = 0; i < 255; i += 1) {
    				LOG_TABLE[EXP_TABLE[i] ] = i;
    			}

    			var _this = {};

    			_this.glog = function(n) {

    				if (n < 1) {
    					throw new Error('glog(' + n + ')');
    				}

    				return LOG_TABLE[n];
    			};

    			_this.gexp = function(n) {

    				while (n < 0) {
    					n += 255;
    				}

    				while (n >= 256) {
    					n -= 255;
    				}

    				return EXP_TABLE[n];
    			};

    			return _this;
    		}();

    		//---------------------------------------------------------------------
    		// qrPolynomial
    		//---------------------------------------------------------------------

    		function qrPolynomial(num, shift) {

    			if (typeof num.length == 'undefined') {
    				throw new Error(num.length + '/' + shift);
    			}

    			var _num = function() {
    				var offset = 0;
    				while (offset < num.length && num[offset] == 0) {
    					offset += 1;
    				}
    				var _num = new Array(num.length - offset + shift);
    				for (var i = 0; i < num.length - offset; i += 1) {
    					_num[i] = num[i + offset];
    				}
    				return _num;
    			}();

    			var _this = {};

    			_this.get = function(index) {
    				return _num[index];
    			};

    			_this.getLength = function() {
    				return _num.length;
    			};

    			_this.multiply = function(e) {

    				var num = new Array(_this.getLength() + e.getLength() - 1);

    				for (var i = 0; i < _this.getLength(); i += 1) {
    					for (var j = 0; j < e.getLength(); j += 1) {
    						num[i + j] ^= QRMath.gexp(QRMath.glog(_this.get(i) ) + QRMath.glog(e.get(j) ) );
    					}
    				}

    				return qrPolynomial(num, 0);
    			};

    			_this.mod = function(e) {

    				if (_this.getLength() - e.getLength() < 0) {
    					return _this;
    				}

    				var ratio = QRMath.glog(_this.get(0) ) - QRMath.glog(e.get(0) );

    				var num = new Array(_this.getLength() );
    				for (var i = 0; i < _this.getLength(); i += 1) {
    					num[i] = _this.get(i);
    				}

    				for (var i = 0; i < e.getLength(); i += 1) {
    					num[i] ^= QRMath.gexp(QRMath.glog(e.get(i) ) + ratio);
    				}

    				// recursive call
    				return qrPolynomial(num, 0).mod(e);
    			};

    			return _this;
    		}
    		//---------------------------------------------------------------------
    		// QRRSBlock
    		//---------------------------------------------------------------------

    		var QRRSBlock = function() {

    			var RS_BLOCK_TABLE = [

    				// L
    				// M
    				// Q
    				// H

    				// 1
    				[1, 26, 19],
    				[1, 26, 16],
    				[1, 26, 13],
    				[1, 26, 9],

    				// 2
    				[1, 44, 34],
    				[1, 44, 28],
    				[1, 44, 22],
    				[1, 44, 16],

    				// 3
    				[1, 70, 55],
    				[1, 70, 44],
    				[2, 35, 17],
    				[2, 35, 13],

    				// 4
    				[1, 100, 80],
    				[2, 50, 32],
    				[2, 50, 24],
    				[4, 25, 9],

    				// 5
    				[1, 134, 108],
    				[2, 67, 43],
    				[2, 33, 15, 2, 34, 16],
    				[2, 33, 11, 2, 34, 12],

    				// 6
    				[2, 86, 68],
    				[4, 43, 27],
    				[4, 43, 19],
    				[4, 43, 15],

    				// 7
    				[2, 98, 78],
    				[4, 49, 31],
    				[2, 32, 14, 4, 33, 15],
    				[4, 39, 13, 1, 40, 14],

    				// 8
    				[2, 121, 97],
    				[2, 60, 38, 2, 61, 39],
    				[4, 40, 18, 2, 41, 19],
    				[4, 40, 14, 2, 41, 15],

    				// 9
    				[2, 146, 116],
    				[3, 58, 36, 2, 59, 37],
    				[4, 36, 16, 4, 37, 17],
    				[4, 36, 12, 4, 37, 13],

    				// 10
    				[2, 86, 68, 2, 87, 69],
    				[4, 69, 43, 1, 70, 44],
    				[6, 43, 19, 2, 44, 20],
    				[6, 43, 15, 2, 44, 16]
    			];

    			var qrRSBlock = function(totalCount, dataCount) {
    				var _this = {};
    				_this.totalCount = totalCount;
    				_this.dataCount = dataCount;
    				return _this;
    			};

    			var _this = {};

    			var getRsBlockTable = function(typeNumber, errorCorrectLevel) {

    				switch(errorCorrectLevel) {
    				case QRErrorCorrectLevel.L :
    					return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
    				case QRErrorCorrectLevel.M :
    					return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
    				case QRErrorCorrectLevel.Q :
    					return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
    				case QRErrorCorrectLevel.H :
    					return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
    				default :
    					return undefined;
    				}
    			};

    			_this.getRSBlocks = function(typeNumber, errorCorrectLevel) {

    				var rsBlock = getRsBlockTable(typeNumber, errorCorrectLevel);

    				if (typeof rsBlock == 'undefined') {
    					throw new Error('bad rs block @ typeNumber:' + typeNumber +
    							'/errorCorrectLevel:' + errorCorrectLevel);
    				}

    				var length = rsBlock.length / 3;

    				var list = new Array();

    				for (var i = 0; i < length; i += 1) {

    					var count = rsBlock[i * 3 + 0];
    					var totalCount = rsBlock[i * 3 + 1];
    					var dataCount = rsBlock[i * 3 + 2];

    					for (var j = 0; j < count; j += 1) {
    						list.push(qrRSBlock(totalCount, dataCount) );
    					}
    				}

    				return list;
    			};

    			return _this;
    		}();

    		//---------------------------------------------------------------------
    		// qrBitBuffer
    		//---------------------------------------------------------------------

    		var qrBitBuffer = function() {

    			var _buffer = new Array();
    			var _length = 0;

    			var _this = {};

    			_this.getBuffer = function() {
    				return _buffer;
    			};

    			_this.get = function(index) {
    				var bufIndex = Math.floor(index / 8);
    				return ( (_buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
    			};

    			_this.put = function(num, length) {
    				for (var i = 0; i < length; i += 1) {
    					_this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
    				}
    			};

    			_this.getLengthInBits = function() {
    				return _length;
    			};

    			_this.putBit = function(bit) {

    				var bufIndex = Math.floor(_length / 8);
    				if (_buffer.length <= bufIndex) {
    					_buffer.push(0);
    				}

    				if (bit) {
    					_buffer[bufIndex] |= (0x80 >>> (_length % 8) );
    				}

    				_length += 1;
    			};

    			return _this;
    		};

    		//---------------------------------------------------------------------
    		// qr8BitByte
    		//---------------------------------------------------------------------

    		var qr8BitByte = function(data) {

    			var _mode = QRMode.MODE_8BIT_BYTE;
    			var _bytes = qrcode.stringToBytes(data);

    			var _this = {};

    			_this.getMode = function() {
    				return _mode;
    			};

    			_this.getLength = function(buffer) {
    				return _bytes.length;
    			};

    			_this.write = function(buffer) {
    				for (var i = 0; i < _bytes.length; i += 1) {
    					buffer.put(_bytes[i], 8);
    				}
    			};

    			return _this;
    		};

    		//=====================================================================
    		// GIF Support etc.
    		//

    		//---------------------------------------------------------------------
    		// byteArrayOutputStream
    		//---------------------------------------------------------------------

    		var byteArrayOutputStream = function() {

    			var _bytes = new Array();

    			var _this = {};

    			_this.writeByte = function(b) {
    				_bytes.push(b & 0xff);
    			};

    			_this.writeShort = function(i) {
    				_this.writeByte(i);
    				_this.writeByte(i >>> 8);
    			};

    			_this.writeBytes = function(b, off, len) {
    				off = off || 0;
    				len = len || b.length;
    				for (var i = 0; i < len; i += 1) {
    					_this.writeByte(b[i + off]);
    				}
    			};

    			_this.writeString = function(s) {
    				for (var i = 0; i < s.length; i += 1) {
    					_this.writeByte(s.charCodeAt(i) );
    				}
    			};

    			_this.toByteArray = function() {
    				return _bytes;
    			};

    			_this.toString = function() {
    				var s = '';
    				s += '[';
    				for (var i = 0; i < _bytes.length; i += 1) {
    					if (i > 0) {
    						s += ',';
    					}
    					s += _bytes[i];
    				}
    				s += ']';
    				return s;
    			};

    			return _this;
    		};

    		//---------------------------------------------------------------------
    		// base64EncodeOutputStream
    		//---------------------------------------------------------------------

    		var base64EncodeOutputStream = function() {

    			var _buffer = 0;
    			var _buflen = 0;
    			var _length = 0;
    			var _base64 = '';

    			var _this = {};

    			var writeEncoded = function(b) {
    				_base64 += String.fromCharCode(encode(b & 0x3f) );
    			};

    			var encode = function(n) {
    				if (n < 0) ; else if (n < 26) {
    					return 0x41 + n;
    				} else if (n < 52) {
    					return 0x61 + (n - 26);
    				} else if (n < 62) {
    					return 0x30 + (n - 52);
    				} else if (n == 62) {
    					return 0x2b;
    				} else if (n == 63) {
    					return 0x2f;
    				}
    				throw new Error('n:' + n);
    			};

    			_this.writeByte = function(n) {

    				_buffer = (_buffer << 8) | (n & 0xff);
    				_buflen += 8;
    				_length += 1;

    				while (_buflen >= 6) {
    					writeEncoded(_buffer >>> (_buflen - 6) );
    					_buflen -= 6;
    				}
    			};

    			_this.flush = function() {

    				if (_buflen > 0) {
    					writeEncoded(_buffer << (6 - _buflen) );
    					_buffer = 0;
    					_buflen = 0;
    				}

    				if (_length % 3 != 0) {
    					// padding
    					var padlen = 3 - _length % 3;
    					for (var i = 0; i < padlen; i += 1) {
    						_base64 += '=';
    					}
    				}
    			};

    			_this.toString = function() {
    				return _base64;
    			};

    			return _this;
    		};

    		//---------------------------------------------------------------------
    		// base64DecodeInputStream
    		//---------------------------------------------------------------------

    		var base64DecodeInputStream = function(str) {

    			var _str = str;
    			var _pos = 0;
    			var _buffer = 0;
    			var _buflen = 0;

    			var _this = {};

    			_this.read = function() {

    				while (_buflen < 8) {

    					if (_pos >= _str.length) {
    						if (_buflen == 0) {
    							return -1;
    						}
    						throw new Error('unexpected end of file./' + _buflen);
    					}

    					var c = _str.charAt(_pos);
    					_pos += 1;

    					if (c == '=') {
    						_buflen = 0;
    						return -1;
    					} else if (c.match(/^\s$/) ) {
    						// ignore if whitespace.
    						continue;
    					}

    					_buffer = (_buffer << 6) | decode(c.charCodeAt(0) );
    					_buflen += 6;
    				}

    				var n = (_buffer >>> (_buflen - 8) ) & 0xff;
    				_buflen -= 8;
    				return n;
    			};

    			var decode = function(c) {
    				if (0x41 <= c && c <= 0x5a) {
    					return c - 0x41;
    				} else if (0x61 <= c && c <= 0x7a) {
    					return c - 0x61 + 26;
    				} else if (0x30 <= c && c <= 0x39) {
    					return c - 0x30 + 52;
    				} else if (c == 0x2b) {
    					return 62;
    				} else if (c == 0x2f) {
    					return 63;
    				} else {
    					throw new Error('c:' + c);
    				}
    			};

    			return _this;
    		};

    		//---------------------------------------------------------------------
    		// gifImage (B/W)
    		//---------------------------------------------------------------------

    		var gifImage = function(width, height) {

    			var _width = width;
    			var _height = height;
    			var _data = new Array(width * height);

    			var _this = {};

    			_this.setPixel = function(x, y, pixel) {
    				_data[y * _width + x] = pixel;
    			};

    			_this.write = function(out) {

    				//---------------------------------
    				// GIF Signature

    				out.writeString('GIF87a');

    				//---------------------------------
    				// Screen Descriptor

    				out.writeShort(_width);
    				out.writeShort(_height);

    				out.writeByte(0x80); // 2bit
    				out.writeByte(0);
    				out.writeByte(0);

    				//---------------------------------
    				// Global Color Map

    				// black
    				out.writeByte(0x00);
    				out.writeByte(0x00);
    				out.writeByte(0x00);

    				// white
    				out.writeByte(0xff);
    				out.writeByte(0xff);
    				out.writeByte(0xff);

    				//---------------------------------
    				// Image Descriptor

    				out.writeString(',');
    				out.writeShort(0);
    				out.writeShort(0);
    				out.writeShort(_width);
    				out.writeShort(_height);
    				out.writeByte(0);

    				//---------------------------------
    				// Local Color Map

    				//---------------------------------
    				// Raster Data

    				var lzwMinCodeSize = 2;
    				var raster = getLZWRaster(lzwMinCodeSize);

    				out.writeByte(lzwMinCodeSize);

    				var offset = 0;

    				while (raster.length - offset > 255) {
    					out.writeByte(255);
    					out.writeBytes(raster, offset, 255);
    					offset += 255;
    				}

    				out.writeByte(raster.length - offset);
    				out.writeBytes(raster, offset, raster.length - offset);
    				out.writeByte(0x00);

    				//---------------------------------
    				// GIF Terminator
    				out.writeString(';');
    			};

    			var bitOutputStream = function(out) {

    				var _out = out;
    				var _bitLength = 0;
    				var _bitBuffer = 0;

    				var _this = {};

    				_this.write = function(data, length) {

    					if ( (data >>> length) != 0) {
    						throw new Error('length over');
    					}

    					while (_bitLength + length >= 8) {
    						_out.writeByte(0xff & ( (data << _bitLength) | _bitBuffer) );
    						length -= (8 - _bitLength);
    						data >>>= (8 - _bitLength);
    						_bitBuffer = 0;
    						_bitLength = 0;
    					}

    					_bitBuffer = (data << _bitLength) | _bitBuffer;
    					_bitLength = _bitLength + length;
    				};

    				_this.flush = function() {
    					if (_bitLength > 0) {
    						_out.writeByte(_bitBuffer);
    					}
    				};

    				return _this;
    			};

    			var getLZWRaster = function(lzwMinCodeSize) {

    				var clearCode = 1 << lzwMinCodeSize;
    				var endCode = (1 << lzwMinCodeSize) + 1;
    				var bitLength = lzwMinCodeSize + 1;

    				// Setup LZWTable
    				var table = lzwTable();

    				for (var i = 0; i < clearCode; i += 1) {
    					table.add(String.fromCharCode(i) );
    				}
    				table.add(String.fromCharCode(clearCode) );
    				table.add(String.fromCharCode(endCode) );

    				var byteOut = byteArrayOutputStream();
    				var bitOut = bitOutputStream(byteOut);

    				// clear code
    				bitOut.write(clearCode, bitLength);

    				var dataIndex = 0;

    				var s = String.fromCharCode(_data[dataIndex]);
    				dataIndex += 1;

    				while (dataIndex < _data.length) {

    					var c = String.fromCharCode(_data[dataIndex]);
    					dataIndex += 1;

    					if (table.contains(s + c) ) {

    						s = s + c;

    					} else {

    						bitOut.write(table.indexOf(s), bitLength);

    						if (table.size() < 0xfff) {

    							if (table.size() == (1 << bitLength) ) {
    								bitLength += 1;
    							}

    							table.add(s + c);
    						}

    						s = c;
    					}
    				}

    				bitOut.write(table.indexOf(s), bitLength);

    				// end code
    				bitOut.write(endCode, bitLength);

    				bitOut.flush();

    				return byteOut.toByteArray();
    			};

    			var lzwTable = function() {

    				var _map = {};
    				var _size = 0;

    				var _this = {};

    				_this.add = function(key) {
    					if (_this.contains(key) ) {
    						throw new Error('dup key:' + key);
    					}
    					_map[key] = _size;
    					_size += 1;
    				};

    				_this.size = function() {
    					return _size;
    				};

    				_this.indexOf = function(key) {
    					return _map[key];
    				};

    				_this.contains = function(key) {
    					return typeof _map[key] != 'undefined';
    				};

    				return _this;
    			};

    			return _this;
    		};

    		var createImgTag = function(width, height, getPixel, alt) {

    			var gif = gifImage(width, height);
    			for (var y = 0; y < height; y += 1) {
    				for (var x = 0; x < width; x += 1) {
    					gif.setPixel(x, y, getPixel(x, y) );
    				}
    			}

    			var b = byteArrayOutputStream();
    			gif.write(b);

    			var base64 = base64EncodeOutputStream();
    			var bytes = b.toByteArray();
    			for (var i = 0; i < bytes.length; i += 1) {
    				base64.writeByte(bytes[i]);
    			}
    			base64.flush();

    			var img = '';
    			img += '<img';
    			img += '\u0020src="';
    			img += 'data:image/gif;base64,';
    			img += base64;
    			img += '"';
    			img += '\u0020width="';
    			img += width;
    			img += '"';
    			img += '\u0020height="';
    			img += height;
    			img += '"';
    			if (alt) {
    				img += '\u0020alt="';
    				img += alt;
    				img += '"';
    			}
    			img += '/>';

    			return img;
    		};

    		//---------------------------------------------------------------------
    		// returns qrcode function.

    		return qrcode;
    	}();
    	return qrcode;
    }

    requireQrcode();

    // This is only used for more subtitles feature, as adding polyfill for Intl.DisplayNames makes the user script way too big and slow to load.
    // Taken from @formatjs/intl-displaynames/locale-data/en.js

    var languages = {
        "language": {
            "standard": {
                "long": {
                    "aa": "Afar",
                    "ab": "Abkhazian",
                    "ace": "Acehnese",
                    "ach": "Acoli",
                    "ada": "Adangme",
                    "ady": "Adyghe",
                    "ae": "Avestan",
                    "aeb": "Tunisian Arabic",
                    "af": "Afrikaans",
                    "afh": "Afrihili",
                    "agq": "Aghem",
                    "ain": "Ainu",
                    "ak": "Akan",
                    "akk": "Akkadian",
                    "akz": "Alabama",
                    "ale": "Aleut",
                    "aln": "Gheg Albanian",
                    "alt": "Southern Altai",
                    "am": "Amharic",
                    "an": "Aragonese",
                    "ang": "Old English",
                    "ann": "Obolo",
                    "anp": "Angika",
                    "ar": "Arabic",
                    "ar-001": "Arabic (world)",
                    "arc": "Aramaic",
                    "arn": "Mapuche",
                    "aro": "Araona",
                    "arp": "Arapaho",
                    "arq": "Algerian Arabic",
                    "ars": "Najdi Arabic",
                    "arw": "Arawak",
                    "ary": "Moroccan Arabic",
                    "arz": "Egyptian Arabic",
                    "as": "Assamese",
                    "asa": "Asu",
                    "ase": "American Sign Language",
                    "ast": "Asturian",
                    "atj": "Atikamekw",
                    "av": "Avaric",
                    "avk": "Kotava",
                    "awa": "Awadhi",
                    "ay": "Aymara",
                    "az": "Azerbaijani",
                    "ba": "Bashkir",
                    "bal": "Baluchi",
                    "ban": "Balinese",
                    "bar": "Bavarian",
                    "bas": "Basaa",
                    "bax": "Bamun",
                    "bbc": "Batak Toba",
                    "bbj": "Ghomala",
                    "be": "Belarusian",
                    "bej": "Beja",
                    "bem": "Bemba",
                    "bew": "Betawi",
                    "bez": "Bena",
                    "bfd": "Bafut",
                    "bfq": "Badaga",
                    "bg": "Bulgarian",
                    "bgc": "Haryanvi",
                    "bgn": "Western Balochi",
                    "bho": "Bhojpuri",
                    "bi": "Bislama",
                    "bik": "Bikol",
                    "bin": "Bini",
                    "bjn": "Banjar",
                    "bkm": "Kom",
                    "bla": "Siksiká",
                    "blo": "Anii",
                    "blt": "Tai Dam",
                    "bm": "Bambara",
                    "bn": "Bangla",
                    "bo": "Tibetan",
                    "bpy": "Bishnupriya",
                    "bqi": "Bakhtiari",
                    "br": "Breton",
                    "bra": "Braj",
                    "brh": "Brahui",
                    "brx": "Bodo",
                    "bs": "Bosnian",
                    "bss": "Akoose",
                    "bua": "Buriat",
                    "bug": "Buginese",
                    "bum": "Bulu",
                    "byn": "Blin",
                    "byv": "Medumba",
                    "ca": "Catalan",
                    "cad": "Caddo",
                    "car": "Carib",
                    "cay": "Cayuga",
                    "cch": "Atsam",
                    "ccp": "Chakma",
                    "ce": "Chechen",
                    "ceb": "Cebuano",
                    "cgg": "Chiga",
                    "ch": "Chamorro",
                    "chb": "Chibcha",
                    "chg": "Chagatai",
                    "chk": "Chuukese",
                    "chm": "Mari",
                    "chn": "Chinook Jargon",
                    "cho": "Choctaw",
                    "chp": "Chipewyan",
                    "chr": "Cherokee",
                    "chy": "Cheyenne",
                    "cic": "Chickasaw",
                    "ckb": "Central Kurdish",
                    "clc": "Chilcotin",
                    "co": "Corsican",
                    "cop": "Coptic",
                    "cps": "Capiznon",
                    "cr": "Cree",
                    "crg": "Michif",
                    "crh": "Crimean Tatar",
                    "crj": "Southern East Cree",
                    "crk": "Plains Cree",
                    "crl": "Northern East Cree",
                    "crm": "Moose Cree",
                    "crr": "Carolina Algonquian",
                    "crs": "Seselwa Creole French",
                    "cs": "Czech",
                    "csb": "Kashubian",
                    "csw": "Swampy Cree",
                    "cu": "Church Slavic",
                    "cv": "Chuvash",
                    "cwd": "Woods Cree",
                    "cy": "Welsh",
                    "da": "Danish",
                    "dak": "Dakota",
                    "dar": "Dargwa",
                    "dav": "Taita",
                    "de": "German",
                    "de-AT": "German (Austria)",
                    "de-CH": "German (Switzerland)",
                    "del": "Delaware",
                    "den": "Slave",
                    "dgr": "Dogrib",
                    "din": "Dinka",
                    "dje": "Zarma",
                    "doi": "Dogri",
                    "dsb": "Lower Sorbian",
                    "dtp": "Central Dusun",
                    "dua": "Duala",
                    "dum": "Middle Dutch",
                    "dv": "Divehi",
                    "dyo": "Jola-Fonyi",
                    "dyu": "Dyula",
                    "dz": "Dzongkha",
                    "dzg": "Dazaga",
                    "ebu": "Embu",
                    "ee": "Ewe",
                    "efi": "Efik",
                    "egl": "Emilian",
                    "egy": "Ancient Egyptian",
                    "eka": "Ekajuk",
                    "el": "Greek",
                    "elx": "Elamite",
                    "en": "English",
                    "en-AU": "English (Australia)",
                    "en-CA": "English (Canada)",
                    "en-GB": "English (United Kingdom)",
                    "en-US": "English (United States)",
                    "enm": "Middle English",
                    "eo": "Esperanto",
                    "es": "Spanish",
                    "es-419": "Spanish (Latin America)",
                    "es-ES": "Spanish (Spain)",
                    "es-MX": "Spanish (Mexico)",
                    "esu": "Central Yupik",
                    "et": "Estonian",
                    "eu": "Basque",
                    "ewo": "Ewondo",
                    "ext": "Extremaduran",
                    "fa": "Persian",
                    "fa-AF": "Persian (Afghanistan)",
                    "fan": "Fang",
                    "fat": "Fanti",
                    "ff": "Fula",
                    "fi": "Finnish",
                    "fil": "Filipino",
                    "fit": "Tornedalen Finnish",
                    "fj": "Fijian",
                    "fo": "Faroese",
                    "fon": "Fon",
                    "fr": "French",
                    "fr-CA": "French (Canada)",
                    "fr-CH": "French (Switzerland)",
                    "frc": "Cajun French",
                    "frm": "Middle French",
                    "fro": "Old French",
                    "frp": "Arpitan",
                    "frr": "Northern Frisian",
                    "frs": "Eastern Frisian",
                    "fur": "Friulian",
                    "fy": "Western Frisian",
                    "ga": "Irish",
                    "gaa": "Ga",
                    "gag": "Gagauz",
                    "gan": "Gan Chinese",
                    "gay": "Gayo",
                    "gba": "Gbaya",
                    "gbz": "Zoroastrian Dari",
                    "gd": "Scottish Gaelic",
                    "gez": "Geez",
                    "gil": "Gilbertese",
                    "gl": "Galician",
                    "glk": "Gilaki",
                    "gmh": "Middle High German",
                    "gn": "Guarani",
                    "goh": "Old High German",
                    "gon": "Gondi",
                    "gor": "Gorontalo",
                    "got": "Gothic",
                    "grb": "Grebo",
                    "grc": "Ancient Greek",
                    "gsw": "Swiss German",
                    "gu": "Gujarati",
                    "guc": "Wayuu",
                    "gur": "Frafra",
                    "guz": "Gusii",
                    "gv": "Manx",
                    "gwi": "Gwichʼin",
                    "ha": "Hausa",
                    "hai": "Haida",
                    "hak": "Hakka Chinese",
                    "haw": "Hawaiian",
                    "hax": "Southern Haida",
                    "hdn": "Northern Haida",
                    "he": "Hebrew",
                    "hi": "Hindi",
                    "hi-Latn": "Hindi (Latin)",
                    "hif": "Fiji Hindi",
                    "hil": "Hiligaynon",
                    "hit": "Hittite",
                    "hmn": "Hmong",
                    "hnj": "Hmong Njua",
                    "ho": "Hiri Motu",
                    "hr": "Croatian",
                    "hsb": "Upper Sorbian",
                    "hsn": "Xiang Chinese",
                    "ht": "Haitian Creole",
                    "hu": "Hungarian",
                    "hup": "Hupa",
                    "hur": "Halkomelem",
                    "hy": "Armenian",
                    "hz": "Herero",
                    "ia": "Interlingua",
                    "iba": "Iban",
                    "ibb": "Ibibio",
                    "id": "Indonesian",
                    "ie": "Interlingue",
                    "ig": "Igbo",
                    "ii": "Sichuan Yi",
                    "ik": "Inupiaq",
                    "ike": "Eastern Canadian Inuktitut",
                    "ikt": "Western Canadian Inuktitut",
                    "ilo": "Iloko",
                    "inh": "Ingush",
                    "io": "Ido",
                    "is": "Icelandic",
                    "it": "Italian",
                    "iu": "Inuktitut",
                    "izh": "Ingrian",
                    "ja": "Japanese",
                    "jam": "Jamaican Creole English",
                    "jbo": "Lojban",
                    "jgo": "Ngomba",
                    "jmc": "Machame",
                    "jpr": "Judeo-Persian",
                    "jrb": "Judeo-Arabic",
                    "jut": "Jutish",
                    "jv": "Javanese",
                    "ka": "Georgian",
                    "kaa": "Kara-Kalpak",
                    "kab": "Kabyle",
                    "kac": "Kachin",
                    "kaj": "Jju",
                    "kam": "Kamba",
                    "kaw": "Kawi",
                    "kbd": "Kabardian",
                    "kbl": "Kanembu",
                    "kcg": "Tyap",
                    "kde": "Makonde",
                    "kea": "Kabuverdianu",
                    "ken": "Kenyang",
                    "kfo": "Koro",
                    "kg": "Kongo",
                    "kgp": "Kaingang",
                    "kha": "Khasi",
                    "kho": "Khotanese",
                    "khq": "Koyra Chiini",
                    "khw": "Khowar",
                    "ki": "Kikuyu",
                    "kiu": "Kirmanjki",
                    "kj": "Kuanyama",
                    "kk": "Kazakh",
                    "kkj": "Kako",
                    "kl": "Kalaallisut",
                    "kln": "Kalenjin",
                    "km": "Khmer",
                    "kmb": "Kimbundu",
                    "kn": "Kannada",
                    "ko": "Korean",
                    "koi": "Komi-Permyak",
                    "kok": "Konkani",
                    "kos": "Kosraean",
                    "kpe": "Kpelle",
                    "kr": "Kanuri",
                    "krc": "Karachay-Balkar",
                    "kri": "Krio",
                    "krj": "Kinaray-a",
                    "krl": "Karelian",
                    "kru": "Kurukh",
                    "ks": "Kashmiri",
                    "ksb": "Shambala",
                    "ksf": "Bafia",
                    "ksh": "Colognian",
                    "ku": "Kurdish",
                    "kum": "Kumyk",
                    "kut": "Kutenai",
                    "kv": "Komi",
                    "kw": "Cornish",
                    "kwk": "Kwakʼwala",
                    "kxv": "Kuvi",
                    "ky": "Kyrgyz",
                    "la": "Latin",
                    "lad": "Ladino",
                    "lag": "Langi",
                    "lah": "Western Panjabi",
                    "lam": "Lamba",
                    "lb": "Luxembourgish",
                    "lez": "Lezghian",
                    "lfn": "Lingua Franca Nova",
                    "lg": "Ganda",
                    "li": "Limburgish",
                    "lij": "Ligurian",
                    "lil": "Lillooet",
                    "liv": "Livonian",
                    "lkt": "Lakota",
                    "lmo": "Lombard",
                    "ln": "Lingala",
                    "lo": "Lao",
                    "lol": "Mongo",
                    "lou": "Louisiana Creole",
                    "loz": "Lozi",
                    "lrc": "Northern Luri",
                    "lsm": "Saamia",
                    "lt": "Lithuanian",
                    "ltg": "Latgalian",
                    "lu": "Luba-Katanga",
                    "lua": "Luba-Lulua",
                    "lui": "Luiseno",
                    "lun": "Lunda",
                    "luo": "Luo",
                    "lus": "Mizo",
                    "luy": "Luyia",
                    "lv": "Latvian",
                    "lzh": "Literary Chinese",
                    "lzz": "Laz",
                    "mad": "Madurese",
                    "maf": "Mafa",
                    "mag": "Magahi",
                    "mai": "Maithili",
                    "mak": "Makasar",
                    "man": "Mandingo",
                    "mas": "Masai",
                    "mde": "Maba",
                    "mdf": "Moksha",
                    "mdr": "Mandar",
                    "men": "Mende",
                    "mer": "Meru",
                    "mfe": "Morisyen",
                    "mg": "Malagasy",
                    "mga": "Middle Irish",
                    "mgh": "Makhuwa-Meetto",
                    "mgo": "Metaʼ",
                    "mh": "Marshallese",
                    "mi": "Māori",
                    "mic": "Mi'kmaw",
                    "min": "Minangkabau",
                    "mk": "Macedonian",
                    "ml": "Malayalam",
                    "mn": "Mongolian",
                    "mnc": "Manchu",
                    "mni": "Manipuri",
                    "moe": "Innu-aimun",
                    "moh": "Mohawk",
                    "mos": "Mossi",
                    "mr": "Marathi",
                    "mrj": "Western Mari",
                    "ms": "Malay",
                    "mt": "Maltese",
                    "mua": "Mundang",
                    "mul": "Multiple languages",
                    "mus": "Muscogee",
                    "mwl": "Mirandese",
                    "mwr": "Marwari",
                    "mwv": "Mentawai",
                    "my": "Burmese",
                    "mye": "Myene",
                    "myv": "Erzya",
                    "mzn": "Mazanderani",
                    "na": "Nauru",
                    "nan": "Min Nan Chinese",
                    "nap": "Neapolitan",
                    "naq": "Nama",
                    "nb": "Norwegian Bokmål",
                    "nd": "North Ndebele",
                    "nds": "Low German",
                    "nds-NL": "Low German (Netherlands)",
                    "ne": "Nepali",
                    "new": "Newari",
                    "ng": "Ndonga",
                    "nia": "Nias",
                    "niu": "Niuean",
                    "njo": "Ao Naga",
                    "nl": "Dutch",
                    "nl-BE": "Dutch (Belgium)",
                    "nmg": "Kwasio",
                    "nn": "Norwegian Nynorsk",
                    "nnh": "Ngiemboon",
                    "no": "Norwegian",
                    "nog": "Nogai",
                    "non": "Old Norse",
                    "nov": "Novial",
                    "nqo": "N’Ko",
                    "nr": "South Ndebele",
                    "nso": "Northern Sotho",
                    "nus": "Nuer",
                    "nv": "Navajo",
                    "nwc": "Classical Newari",
                    "ny": "Nyanja",
                    "nym": "Nyamwezi",
                    "nyn": "Nyankole",
                    "nyo": "Nyoro",
                    "nzi": "Nzima",
                    "oc": "Occitan",
                    "oj": "Ojibwa",
                    "ojb": "Northwestern Ojibwa",
                    "ojc": "Central Ojibwa",
                    "ojg": "Eastern Ojibwa",
                    "ojs": "Oji-Cree",
                    "ojw": "Western Ojibwa",
                    "oka": "Okanagan",
                    "om": "Oromo",
                    "or": "Odia",
                    "os": "Ossetic",
                    "osa": "Osage",
                    "ota": "Ottoman Turkish",
                    "pa": "Punjabi",
                    "pag": "Pangasinan",
                    "pal": "Pahlavi",
                    "pam": "Pampanga",
                    "pap": "Papiamento",
                    "pau": "Palauan",
                    "pcd": "Picard",
                    "pcm": "Nigerian Pidgin",
                    "pdc": "Pennsylvania German",
                    "pdt": "Plautdietsch",
                    "peo": "Old Persian",
                    "pfl": "Palatine German",
                    "phn": "Phoenician",
                    "pi": "Pali",
                    "pis": "Pijin",
                    "pl": "Polish",
                    "pms": "Piedmontese",
                    "pnt": "Pontic",
                    "pon": "Pohnpeian",
                    "pqm": "Maliseet-Passamaquoddy",
                    "prg": "Prussian",
                    "pro": "Old Provençal",
                    "ps": "Pashto",
                    "pt": "Portuguese",
                    "pt-BR": "Portuguese (Brazil)",
                    "pt-PT": "Portuguese (Portugal)",
                    "qu": "Quechua",
                    "quc": "Kʼicheʼ",
                    "qug": "Chimborazo Highland Quichua",
                    "raj": "Rajasthani",
                    "rap": "Rapanui",
                    "rar": "Rarotongan",
                    "rgn": "Romagnol",
                    "rhg": "Rohingya",
                    "rif": "Riffian",
                    "rm": "Romansh",
                    "rn": "Rundi",
                    "ro": "Romanian",
                    "ro-MD": "Romanian (Moldova)",
                    "rof": "Rombo",
                    "rom": "Romany",
                    "rtm": "Rotuman",
                    "ru": "Russian",
                    "rue": "Rusyn",
                    "rug": "Roviana",
                    "rup": "Aromanian",
                    "rw": "Kinyarwanda",
                    "rwk": "Rwa",
                    "sa": "Sanskrit",
                    "sad": "Sandawe",
                    "sah": "Yakut",
                    "sam": "Samaritan Aramaic",
                    "saq": "Samburu",
                    "sas": "Sasak",
                    "sat": "Santali",
                    "saz": "Saurashtra",
                    "sba": "Ngambay",
                    "sbp": "Sangu",
                    "sc": "Sardinian",
                    "scn": "Sicilian",
                    "sco": "Scots",
                    "sd": "Sindhi",
                    "sdc": "Sassarese Sardinian",
                    "sdh": "Southern Kurdish",
                    "se": "Northern Sami",
                    "see": "Seneca",
                    "seh": "Sena",
                    "sei": "Seri",
                    "sel": "Selkup",
                    "ses": "Koyraboro Senni",
                    "sg": "Sango",
                    "sga": "Old Irish",
                    "sgs": "Samogitian",
                    "sh": "Serbo-Croatian",
                    "shi": "Tachelhit",
                    "shn": "Shan",
                    "shu": "Chadian Arabic",
                    "si": "Sinhala",
                    "sid": "Sidamo",
                    "sk": "Slovak",
                    "sl": "Slovenian",
                    "slh": "Southern Lushootseed",
                    "sli": "Lower Silesian",
                    "sly": "Selayar",
                    "sm": "Samoan",
                    "sma": "Southern Sami",
                    "smj": "Lule Sami",
                    "smn": "Inari Sami",
                    "sms": "Skolt Sami",
                    "sn": "Shona",
                    "snk": "Soninke",
                    "so": "Somali",
                    "sog": "Sogdien",
                    "sq": "Albanian",
                    "sr": "Serbian",
                    "sr-ME": "Serbian (Montenegro)",
                    "srn": "Sranan Tongo",
                    "srr": "Serer",
                    "ss": "Swati",
                    "ssy": "Saho",
                    "st": "Southern Sotho",
                    "stq": "Saterland Frisian",
                    "str": "Straits Salish",
                    "su": "Sundanese",
                    "suk": "Sukuma",
                    "sus": "Susu",
                    "sux": "Sumerian",
                    "sv": "Swedish",
                    "sw": "Swahili",
                    "sw-CD": "Swahili (Congo - Kinshasa)",
                    "swb": "Comorian",
                    "syc": "Classical Syriac",
                    "syr": "Syriac",
                    "szl": "Silesian",
                    "ta": "Tamil",
                    "tce": "Southern Tutchone",
                    "tcy": "Tulu",
                    "te": "Telugu",
                    "tem": "Timne",
                    "teo": "Teso",
                    "ter": "Tereno",
                    "tet": "Tetum",
                    "tg": "Tajik",
                    "tgx": "Tagish",
                    "th": "Thai",
                    "tht": "Tahltan",
                    "ti": "Tigrinya",
                    "tig": "Tigre",
                    "tiv": "Tiv",
                    "tk": "Turkmen",
                    "tkl": "Tokelau",
                    "tkr": "Tsakhur",
                    "tl": "Tagalog",
                    "tlh": "Klingon",
                    "tli": "Tlingit",
                    "tly": "Talysh",
                    "tmh": "Tamashek",
                    "tn": "Tswana",
                    "to": "Tongan",
                    "tog": "Nyasa Tonga",
                    "tok": "Toki Pona",
                    "tpi": "Tok Pisin",
                    "tr": "Turkish",
                    "tru": "Turoyo",
                    "trv": "Taroko",
                    "trw": "Torwali",
                    "ts": "Tsonga",
                    "tsd": "Tsakonian",
                    "tsi": "Tsimshian",
                    "tt": "Tatar",
                    "ttm": "Northern Tutchone",
                    "ttt": "Muslim Tat",
                    "tum": "Tumbuka",
                    "tvl": "Tuvalu",
                    "tw": "Twi",
                    "twq": "Tasawaq",
                    "ty": "Tahitian",
                    "tyv": "Tuvinian",
                    "tzm": "Central Atlas Tamazight",
                    "udm": "Udmurt",
                    "ug": "Uyghur",
                    "uga": "Ugaritic",
                    "uk": "Ukrainian",
                    "umb": "Umbundu",
                    "und": "Unknown language",
                    "ur": "Urdu",
                    "uz": "Uzbek",
                    "vai": "Vai",
                    "ve": "Venda",
                    "vec": "Venetian",
                    "vep": "Veps",
                    "vi": "Vietnamese",
                    "vls": "West Flemish",
                    "vmf": "Main-Franconian",
                    "vmw": "Makhuwa",
                    "vo": "Volapük",
                    "vot": "Votic",
                    "vro": "Võro",
                    "vun": "Vunjo",
                    "wa": "Walloon",
                    "wae": "Walser",
                    "wal": "Wolaytta",
                    "war": "Waray",
                    "was": "Washo",
                    "wbp": "Warlpiri",
                    "wo": "Wolof",
                    "wuu": "Wu Chinese",
                    "xal": "Kalmyk",
                    "xh": "Xhosa",
                    "xmf": "Mingrelian",
                    "xnr": "Kangri",
                    "xog": "Soga",
                    "yao": "Yao",
                    "yap": "Yapese",
                    "yav": "Yangben",
                    "ybb": "Yemba",
                    "yi": "Yiddish",
                    "yo": "Yoruba",
                    "yrl": "Nheengatu",
                    "yue": "Cantonese",
                    "za": "Zhuang",
                    "zap": "Zapotec",
                    "zbl": "Blissymbols",
                    "zea": "Zeelandic",
                    "zen": "Zenaga",
                    "zgh": "Standard Moroccan Tamazight",
                    "zh": "Chinese",
                    "zh-Hans": "Simplified Chinese",
                    "zh-Hant": "Traditional Chinese",
                    "zu": "Zulu",
                    "zun": "Zuni",
                    "zxx": "No linguistic content",
                    "zza": "Zaza"
                }
            }
        },
        "region": {
            "long": {
                "001": "world",
                "002": "Africa",
                "003": "North America",
                "005": "South America",
                "009": "Oceania",
                "011": "Western Africa",
                "013": "Central America",
                "014": "Eastern Africa",
                "015": "Northern Africa",
                "017": "Middle Africa",
                "018": "Southern Africa",
                "019": "Americas",
                "021": "Northern America",
                "029": "Caribbean",
                "030": "Eastern Asia",
                "034": "Southern Asia",
                "035": "Southeast Asia",
                "039": "Southern Europe",
                "053": "Australasia",
                "054": "Melanesia",
                "057": "Micronesian Region",
                "061": "Polynesia",
                "142": "Asia",
                "143": "Central Asia",
                "145": "Western Asia",
                "150": "Europe",
                "151": "Eastern Europe",
                "154": "Northern Europe",
                "155": "Western Europe",
                "202": "Sub-Saharan Africa",
                "419": "Latin America",
                "AC": "Ascension Island",
                "AD": "Andorra",
                "AE": "United Arab Emirates",
                "AF": "Afghanistan",
                "AG": "Antigua & Barbuda",
                "AI": "Anguilla",
                "AL": "Albania",
                "AM": "Armenia",
                "AO": "Angola",
                "AQ": "Antarctica",
                "AR": "Argentina",
                "AS": "American Samoa",
                "AT": "Austria",
                "AU": "Australia",
                "AW": "Aruba",
                "AX": "Åland Islands",
                "AZ": "Azerbaijan",
                "BA": "Bosnia & Herzegovina",
                "BB": "Barbados",
                "BD": "Bangladesh",
                "BE": "Belgium",
                "BF": "Burkina Faso",
                "BG": "Bulgaria",
                "BH": "Bahrain",
                "BI": "Burundi",
                "BJ": "Benin",
                "BL": "St. Barthélemy",
                "BM": "Bermuda",
                "BN": "Brunei",
                "BO": "Bolivia",
                "BQ": "Caribbean Netherlands",
                "BR": "Brazil",
                "BS": "Bahamas",
                "BT": "Bhutan",
                "BV": "Bouvet Island",
                "BW": "Botswana",
                "BY": "Belarus",
                "BZ": "Belize",
                "CA": "Canada",
                "CC": "Cocos (Keeling) Islands",
                "CD": "Congo - Kinshasa",
                "CF": "Central African Republic",
                "CG": "Congo - Brazzaville",
                "CH": "Switzerland",
                "CI": "Côte d’Ivoire",
                "CK": "Cook Islands",
                "CL": "Chile",
                "CM": "Cameroon",
                "CN": "China",
                "CO": "Colombia",
                "CP": "Clipperton Island",
                "CQ": "Sark",
                "CR": "Costa Rica",
                "CU": "Cuba",
                "CV": "Cape Verde",
                "CW": "Curaçao",
                "CX": "Christmas Island",
                "CY": "Cyprus",
                "CZ": "Czechia",
                "DE": "Germany",
                "DG": "Diego Garcia",
                "DJ": "Djibouti",
                "DK": "Denmark",
                "DM": "Dominica",
                "DO": "Dominican Republic",
                "DZ": "Algeria",
                "EA": "Ceuta & Melilla",
                "EC": "Ecuador",
                "EE": "Estonia",
                "EG": "Egypt",
                "EH": "Western Sahara",
                "ER": "Eritrea",
                "ES": "Spain",
                "ET": "Ethiopia",
                "EU": "European Union",
                "EZ": "Eurozone",
                "FI": "Finland",
                "FJ": "Fiji",
                "FK": "Falkland Islands",
                "FM": "Micronesia",
                "FO": "Faroe Islands",
                "FR": "France",
                "GA": "Gabon",
                "GB": "United Kingdom",
                "GD": "Grenada",
                "GE": "Georgia",
                "GF": "French Guiana",
                "GG": "Guernsey",
                "GH": "Ghana",
                "GI": "Gibraltar",
                "GL": "Greenland",
                "GM": "Gambia",
                "GN": "Guinea",
                "GP": "Guadeloupe",
                "GQ": "Equatorial Guinea",
                "GR": "Greece",
                "GS": "South Georgia & South Sandwich Islands",
                "GT": "Guatemala",
                "GU": "Guam",
                "GW": "Guinea-Bissau",
                "GY": "Guyana",
                "HK": "Hong Kong SAR China",
                "HM": "Heard & McDonald Islands",
                "HN": "Honduras",
                "HR": "Croatia",
                "HT": "Haiti",
                "HU": "Hungary",
                "IC": "Canary Islands",
                "ID": "Indonesia",
                "IE": "Ireland",
                "IL": "Israel",
                "IM": "Isle of Man",
                "IN": "India",
                "IO": "British Indian Ocean Territory",
                "IQ": "Iraq",
                "IR": "Iran",
                "IS": "Iceland",
                "IT": "Italy",
                "JE": "Jersey",
                "JM": "Jamaica",
                "JO": "Jordan",
                "JP": "Japan",
                "KE": "Kenya",
                "KG": "Kyrgyzstan",
                "KH": "Cambodia",
                "KI": "Kiribati",
                "KM": "Comoros",
                "KN": "St. Kitts & Nevis",
                "KP": "North Korea",
                "KR": "South Korea",
                "KW": "Kuwait",
                "KY": "Cayman Islands",
                "KZ": "Kazakhstan",
                "LA": "Laos",
                "LB": "Lebanon",
                "LC": "St. Lucia",
                "LI": "Liechtenstein",
                "LK": "Sri Lanka",
                "LR": "Liberia",
                "LS": "Lesotho",
                "LT": "Lithuania",
                "LU": "Luxembourg",
                "LV": "Latvia",
                "LY": "Libya",
                "MA": "Morocco",
                "MC": "Monaco",
                "MD": "Moldova",
                "ME": "Montenegro",
                "MF": "St. Martin",
                "MG": "Madagascar",
                "MH": "Marshall Islands",
                "MK": "North Macedonia",
                "ML": "Mali",
                "MM": "Myanmar (Burma)",
                "MN": "Mongolia",
                "MO": "Macao SAR China",
                "MP": "Northern Mariana Islands",
                "MQ": "Martinique",
                "MR": "Mauritania",
                "MS": "Montserrat",
                "MT": "Malta",
                "MU": "Mauritius",
                "MV": "Maldives",
                "MW": "Malawi",
                "MX": "Mexico",
                "MY": "Malaysia",
                "MZ": "Mozambique",
                "NA": "Namibia",
                "NC": "New Caledonia",
                "NE": "Niger",
                "NF": "Norfolk Island",
                "NG": "Nigeria",
                "NI": "Nicaragua",
                "NL": "Netherlands",
                "NO": "Norway",
                "NP": "Nepal",
                "NR": "Nauru",
                "NU": "Niue",
                "NZ": "New Zealand",
                "OM": "Oman",
                "PA": "Panama",
                "PE": "Peru",
                "PF": "French Polynesia",
                "PG": "Papua New Guinea",
                "PH": "Philippines",
                "PK": "Pakistan",
                "PL": "Poland",
                "PM": "St. Pierre & Miquelon",
                "PN": "Pitcairn Islands",
                "PR": "Puerto Rico",
                "PS": "Palestinian Territories",
                "PT": "Portugal",
                "PW": "Palau",
                "PY": "Paraguay",
                "QA": "Qatar",
                "QO": "Outlying Oceania",
                "RE": "Réunion",
                "RO": "Romania",
                "RS": "Serbia",
                "RU": "Russia",
                "RW": "Rwanda",
                "SA": "Saudi Arabia",
                "SB": "Solomon Islands",
                "SC": "Seychelles",
                "SD": "Sudan",
                "SE": "Sweden",
                "SG": "Singapore",
                "SH": "St. Helena",
                "SI": "Slovenia",
                "SJ": "Svalbard & Jan Mayen",
                "SK": "Slovakia",
                "SL": "Sierra Leone",
                "SM": "San Marino",
                "SN": "Senegal",
                "SO": "Somalia",
                "SR": "Suriname",
                "SS": "South Sudan",
                "ST": "São Tomé & Príncipe",
                "SV": "El Salvador",
                "SX": "Sint Maarten",
                "SY": "Syria",
                "SZ": "Eswatini",
                "TA": "Tristan da Cunha",
                "TC": "Turks & Caicos Islands",
                "TD": "Chad",
                "TF": "French Southern Territories",
                "TG": "Togo",
                "TH": "Thailand",
                "TJ": "Tajikistan",
                "TK": "Tokelau",
                "TL": "Timor-Leste",
                "TM": "Turkmenistan",
                "TN": "Tunisia",
                "TO": "Tonga",
                "TR": "Türkiye",
                "TT": "Trinidad & Tobago",
                "TV": "Tuvalu",
                "TW": "Taiwan",
                "TZ": "Tanzania",
                "UA": "Ukraine",
                "UG": "Uganda",
                "UM": "U.S. Outlying Islands",
                "UN": "United Nations",
                "US": "United States",
                "UY": "Uruguay",
                "UZ": "Uzbekistan",
                "VA": "Vatican City",
                "VC": "St. Vincent & Grenadines",
                "VE": "Venezuela",
                "VG": "British Virgin Islands",
                "VI": "U.S. Virgin Islands",
                "VN": "Vietnam",
                "VU": "Vanuatu",
                "WF": "Wallis & Futuna",
                "WS": "Samoa",
                "XA": "Pseudo-Accents",
                "XB": "Pseudo-Bidi",
                "XK": "Kosovo",
                "YE": "Yemen",
                "YT": "Mayotte",
                "ZA": "South Africa",
                "ZM": "Zambia",
                "ZW": "Zimbabwe",
                "ZZ": "Unknown Region",
                "BA": "Bosnia",
                "GB": "UK",
                "HK": "Hong Kong",
                "MM": "Myanmar",
                "MO": "Macao",
                "PS": "Palestine",
                "UN": "UN",
                "US": "US"
            }
        }
    };

    // Fast-Tube Subtitle Localization Mod
    // Automatically adds user's local language to subtitle auto-translate menu if not present


    const LANGUAGE_CODES = [
        "af", "sq", "am", "ar", "hy", "as", "az", "eu", "be", "bn", "bs", "bg",
        "my", "ca", "zh-CN", "zh-TW", "zh-HK", "hr", "cs", "da", "nl", "en", "et",
        "fil", "fi", "fr", "gl", "ka", "de", "el", "gu", "he", "hi", "hu", "is",
        "id", "ga", "it", "ja", "kn", "kk", "km", "ko", "ky", "lo", "lv", "lt",
        "mk", "ms", "ml", "mt", "mr", "mn", "ne", "no", "or", "fa", "pl", "pt",
        "pa", "ro", "ru", "sr", "si", "sk", "sl", "es", "sw", "sv", "ta", "te",
        "th", "tr", "uk", "ur", "uz", "vi", "cy", "yi", "yo", "zu"
    ];

    let cachedLanguageMap = null;

    // Return an object mapping language code -> localized language name.
    function getComprehensiveLanguageList() {
        if (cachedLanguageMap) return cachedLanguageMap;
        try {
            const map = {};
            LANGUAGE_CODES.forEach((code) => {
                if (code.includes("-")) {
                    const [lang, region] = code.split("-");
                    const languageName = languages.language.standard.long[lang] || code;
                    const regionName = languages.region.long[region] || region;
                    map[code] = `${languageName} (${regionName})`;
                } else {
                    const name = languages.language.standard.long[code] || code;
                    map[code] = name;
                }
            });
            cachedLanguageMap = map;
            return cachedLanguageMap;
        } catch (e) {
            const fallback = {};
            LANGUAGE_CODES.forEach((c) => (fallback[c] = c));
            return fallback;
        }
    }

    // Infer the most likely language for a given ISO 3166-1 alpha-2 country code using Intl.Locale.
    // Returns { code, name } or null if unknown.
    function getCountryLanguage(countryCode) {
        if (!countryCode) return null;
        try {
            const region = String(countryCode).toUpperCase();

            const zhRegionMap = { CN: "zh-CN", TW: "zh-TW", HK: "zh-HK", SG: "zh-CN" };
            if (zhRegionMap[region]) {
                const code = zhRegionMap[region];
                const name = languages.language.standard.long[code] || code;
                return { code, name };
            }

            const base = new Intl.Locale("und", { region });
            const maximized = base.maximize ? base.maximize() : base;
            const lang = maximized.language || "en";

            const name = languages.language.standard.long[lang] || lang;

            return { code: lang, name };
        } catch (e) {
            console.warn("Fast-Tube Subtitle Localization: Could not infer language for country", countryCode, e);
            return null;
        }
    }

    let isPatched = false;

    // Function to get user's country code
    function getUserCountryCode() {
        try {
            // Always use window.yt.config_.GL as primary source
            if (window.yt && window.yt.config_ && window.yt.config_.GL) {
                return window.yt.config_.GL;
            }

            console.warn(
                "Fast-Tube Subtitle Localization: Could not determine user country code"
            );
            return null;
        } catch (error) {
            console.error(
                "Fast-Tube Subtitle Localization: Error getting country code:",
                error
            );
            return null;
        }
    }

    // Function to check if language already exists in the menu
    function languageExistsInMenu(items, languageCode, languageName) {
        return items.some((item) => {
            if (
                item.compactLinkRenderer &&
                item.compactLinkRenderer.serviceEndpoint
            ) {
                const commands =
                    item.compactLinkRenderer.serviceEndpoint.commandExecutorCommand
                        ?.commands;
                if (
                    commands &&
                    commands[0] &&
                    commands[0].selectSubtitlesTrackCommand
                ) {
                    const translationLang =
                        commands[0].selectSubtitlesTrackCommand.translationLanguage;
                    return (
                        translationLang &&
                        (translationLang.languageCode === languageCode ||
                            translationLang.languageName === languageName)
                    );
                }
            }
            return false;
        });
    }

    // Function to create a language option
    function createLanguageOption(languageCode, languageName) {
        return {
            compactLinkRenderer: {
                title: { simpleText: languageName },
                serviceEndpoint: {
                    commandExecutorCommand: {
                        commands: [
                            {
                                selectSubtitlesTrackCommand: {
                                    translationLanguage: {
                                        languageCode,
                                        languageName,
                                    },
                                },
                            },
                            {
                                openClientOverlayAction: {
                                    type: "CLIENT_OVERLAY_TYPE_CAPTIONS_LANGUAGE",
                                    updateAction: true,
                                },
                            },
                            {
                                signalAction: { signal: "POPUP_BACK" },
                            },
                        ],
                    },
                },
                secondaryIcon: { iconType: "RADIO_BUTTON_UNCHECKED" },
            },
        };
    }

    // Function to get languages already present in menu
    function getExistingLanguages(items) {
        const existingLanguages = new Set();

        items.forEach((item) => {
            if (
                item.compactLinkRenderer &&
                item.compactLinkRenderer.serviceEndpoint
            ) {
                const commands =
                    item.compactLinkRenderer.serviceEndpoint.commandExecutorCommand
                        ?.commands;
                if (
                    commands &&
                    commands[0] &&
                    commands[0].selectSubtitlesTrackCommand
                ) {
                    const translationLang =
                        commands[0].selectSubtitlesTrackCommand.translationLanguage;
                    if (translationLang) {
                        existingLanguages.add(translationLang.languageCode);
                        existingLanguages.add(translationLang.languageName);
                    }
                }
            }
        });

        return existingLanguages;
    }

    // Function to create section title
    function createSectionTitle(title) {
        return {
            overlayMessageRenderer: {
                title: { simpleText: "" },
                subtitle: { simpleText: title },
                style: "OVERLAY_MESSAGE_STYLE_SUBSECTION_TITLE",
            },
        };
    }

    // Main function to patch the subtitle menu
    function patchSubtitleMenu() {
        if (isPatched) return;

        const player = document.querySelector('.html5-video-player');
        if (!player) return setTimeout(patchSubtitleMenu, 250);

        // Always patch if possible - settings will be checked dynamically
        if (!window._yttv) return setTimeout(patchSubtitleMenu, 250);
        const yttvInstance = Object.values(window._yttv).find(
            (obj) =>
                obj &&
                obj.instance &&
                typeof obj.instance.resolveCommand === "function"
        );

        if (
            !yttvInstance ||
            yttvInstance.instance.resolveCommand.isPatchedBySubtitleLocalization
        ) {
            if (!yttvInstance) {
                console.error(
                    "Fast-Tube Subtitle Localization: Could not find resolveCommand instance."
                );
            } else {
                console.log("Fast-Tube Subtitle Localization: Already patched.");
            }
            return;
        }

        const originalResolveCommand = yttvInstance.instance.resolveCommand;

        yttvInstance.instance.resolveCommand = function (cmd, _) {
            // Identify the correct command using its uniqueId
            if (
                cmd?.openPopupAction?.uniqueId ===
                "CLIENT_OVERLAY_TYPE_CAPTIONS_AUTO_TRANSLATE"
            ) {
                // Check current settings dynamically each time menu opens
                const showUserLanguage = configRead("enableShowUserLanguage");
                const showOtherLanguages = configRead("enableShowOtherLanguages");

                // If neither feature is enabled, don't modify the menu
                if (!showUserLanguage && !showOtherLanguages) {
                    return originalResolveCommand.apply(this, arguments);
                }

                const items =
                    cmd.openPopupAction.popup.overlaySectionRenderer.overlay
                        .overlayTwoPanelRenderer.actionPanel.overlayPanelRenderer
                        .content.overlayPanelItemListRenderer.items;

                // Get existing languages
                const existingLanguages = getExistingLanguages(items);

                // Add user's local language if enabled
                if (showUserLanguage) {
                    const userCountryCode = getUserCountryCode();
                    const userLanguage = getCountryLanguage(userCountryCode);

                    if (userLanguage) {
                        // Check if the user's language already exists
                        if (
                            !languageExistsInMenu(items, userLanguage.code, userLanguage.name)
                        ) {
                            console.log(
                                `%c[Fast-Tube Subtitle Localization] Adding user's local language: ${userLanguage.name} (${userLanguage.code})`,
                                "background: #2196F3; color: #ffffff; font-size: 14px; font-weight: bold;"
                            );

                            const userLanguageOption = createLanguageOption(
                                userLanguage.code,
                                userLanguage.name
                            );

                            // Find the "Recommended languages" section and insert after it
                            const recommendedIndex = items.findIndex(
                                (item) =>
                                    item.overlayMessageRenderer?.subtitle
                                        ?.simpleText === "Recommended languages"
                            );

                            if (recommendedIndex > -1) {
                                // Insert user's language as the first recommendation
                                items.splice(
                                    recommendedIndex + 1,
                                    0,
                                    userLanguageOption
                                );
                                // Update existing languages set
                                existingLanguages.add(userLanguage.code);
                                existingLanguages.add(userLanguage.name);
                            } else {
                                // Find "Other languages" section and insert before it
                                const otherLanguagesIndex = items.findIndex(
                                    (item) =>
                                        item.overlayMessageRenderer?.subtitle
                                            ?.simpleText === "Other languages"
                                );

                                if (otherLanguagesIndex > -1) {
                                    items.splice(
                                        otherLanguagesIndex,
                                        0,
                                        userLanguageOption
                                    );
                                } else {
                                    // As a fallback, add it at the beginning
                                    items.unshift(userLanguageOption);
                                }
                                // Update existing languages set
                                existingLanguages.add(userLanguage.code);
                                existingLanguages.add(userLanguage.name);
                            }
                        } else {
                            console.log(
                                `%c[Fast-Tube Subtitle Localization] User's language ${userLanguage.name} already exists in menu`,
                                "background: #4CAF50; color: #ffffff; font-size: 12px;"
                            );
                        }
                    } else {
                        console.warn(
                            `Fast-Tube Subtitle Localization: No language mapping found for country code: ${userCountryCode}`
                        );
                    }
                }

                // Create "Tizen Languages" section with all missing languages if enabled
                if (showOtherLanguages) {
                    const missingLanguages = Object.entries(getComprehensiveLanguageList())
                        .filter(([code, name]) => !existingLanguages.has(code) && !existingLanguages.has(name))
                        .sort(([, a], [, b]) => a.localeCompare(b));

                    if (missingLanguages.length > 0) {
                        console.log(
                            `%c[Fast-Tube Subtitle Localization] Adding "Tizen Languages" section with ${missingLanguages.length} additional languages`,
                            "background: #FF9800; color: #ffffff; font-size: 12px;"
                        );

                        // Add section title
                        items.push(createSectionTitle("Other Languages"));

                        // Add all missing languages
                        missingLanguages.forEach(([code, name]) => {
                            items.push(createLanguageOption(code, name));
                        });

                        console.log(
                            `%c[Fast-Tube Subtitle Localization] Added "Tizen Languages" section`,
                            "background: #FF9800; color: #ffffff; font-size: 12px;"
                        );
                    } else {
                        console.log(
                            `%c[Fast-Tube Subtitle Localization] All languages already present in menu`,
                            "background: #4CAF50; color: #ffffff; font-size: 12px;"
                        );
                    }
                }
            }

            // Let the original function run with our modified 'cmd' object
            return originalResolveCommand.apply(this, arguments);
        };

        yttvInstance.instance.resolveCommand.isPatchedBySubtitleLocalization = true;
        console.log("Fast-Tube Subtitle Localization: Patch successful!");
        isPatched = true;
    }

    // Wait for the YouTube TV app to be ready
    const interval$2 = setInterval(() => {
        if (window._yttv && Object.keys(window._yttv).length > 0) {
            patchSubtitleMenu();
            clearInterval(interval$2);
        }
    }, 1000);

    // Also try to patch when DOM is loaded
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", patchSubtitleMenu);
    } else {
        patchSubtitleMenu();
    }

    console.log(
        "Fast-Tube Subtitle Localization: Module loaded, waiting for YouTube TV..."
    );

    function modernUI(update, parameters) {
        const settings = [
            {
                name: t('settings.options.adBlock'),
                icon: 'DOLLAR_SIGN',
                value: 'enableAdBlock'
            },
            {
                name: t('settings.options.sponsorblock.title'),
                icon: 'MONEY_HAND',
                value: null,
                menuId: 'tt-sponsorblock-settings',
                menuHeader: {
                    title: t('settings.options.sponsorblock.title'),
                    subtitle: 'https://sponsor.ajay.app/'
                },
                options: [
                    {
                        name: t('settings.options.sponsorblock.options.enableSB'),
                        icon: 'MONEY_HAND',
                        value: 'enableSponsorBlock'
                    },
                    {
                        name: t('settings.options.sponsorblock.options.manualSkip'),
                        icon: 'DOLLAR_SIGN',
                        value: null,
                        arrayToEdit: 'sponsorBlockManualSkips',
                        menuId: 'tt-sponsorblock-manual-segment-skip',
                        options: [
                            {
                                name: t('settings.options.sponsorblock.options.categories.sponsor'),
                                icon: 'MONEY_HEART',
                                value: 'sponsor'
                            },
                            {
                                name: t('settings.options.sponsorblock.options.categories.intro'),
                                icon: 'PLAY_CIRCLE',
                                value: 'intro'
                            },
                            {
                                name: t('settings.options.sponsorblock.options.categories.outro'),
                                value: 'outro'
                            },
                            {
                                name: t('settings.options.sponsorblock.options.categories.interaction'),
                                value: 'interaction'
                            },
                            {
                                name: t('settings.options.sponsorblock.options.categories.selfpromo'),
                                value: 'selfpromo'
                            },
                            {
                                name: t('settings.options.sponsorblock.options.categories.preview'),
                                value: 'preview'
                            },
                            {
                                name: t('settings.options.sponsorblock.options.categories.filler'),
                                value: 'filler'
                            },
                            {
                                name: t('settings.options.sponsorblock.options.categories.music_offtopic'),
                                value: 'music_offtopic'
                            }
                        ]
                    },
                    {
                        name: t('settings.options.sponsorblock.options.segments'),
                        icon: 'SETTINGS',
                        value: null,
                        menuId: 'tt-sponsorblock-segments',
                        options: [
                            {
                                name: t('settings.options.sponsorblock.options.categories.sponsor'),
                                icon: 'MONEY_HEART',
                                value: 'enableSponsorBlockSponsor'
                            },
                            {
                                name: t('settings.options.sponsorblock.options.categories.intro'),
                                icon: 'PLAY_CIRCLE',
                                value: 'enableSponsorBlockIntro'
                            },
                            {
                                name: t('settings.options.sponsorblock.options.categories.outro'),
                                value: 'enableSponsorBlockOutro'
                            },
                            {
                                name: t('settings.options.sponsorblock.options.categories.interaction'),
                                value: 'enableSponsorBlockInteraction'
                            },
                            {
                                name: t('settings.options.sponsorblock.options.categories.selfpromo'),
                                value: 'enableSponsorBlockSelfPromo'
                            },
                            {
                                name: t('settings.options.sponsorblock.options.categories.preview'),
                                value: 'enableSponsorBlockPreview'
                            },
                            {
                                name: t('settings.options.sponsorblock.options.categories.filler'),
                                value: 'enableSponsorBlockFiller'
                            },
                            {
                                name: t('settings.options.sponsorblock.options.categories.music_offtopic'),
                                value: 'enableSponsorBlockMusicOfftopic'
                            },
                            {
                                name: t('settings.options.sponsorblock.options.categories.highlights'),
                                icon: 'LOCATION_POINT',
                                value: 'enableSponsorBlockHighlight'
                            }
                        ]
                    },
                    {
                        name: t('settings.options.sponsorblock.options.showSBToasts'),
                        value: 'enableSponsorBlockToasts'
                    }
                ]
            },
            {
                name: t('settings.options.dearrow.title'),
                icon: 'VISIBILITY_OFF',
                value: null,
                menuHeader: {
                    title: t('settings.options.dearrow.title'),
                    subtitle: 'https://dearrow.ajay.app/'
                },
                options: [
                    {
                        name: t('settings.options.dearrow.options.enableDA'),

                        icon: 'VISIBILITY_OFF',
                        value: 'enableDeArrow'
                    },
                    {
                        name: t('settings.options.dearrow.options.enableDAThumbnails'),
                        icon: 'TV',
                        value: 'enableDeArrowThumbnails'
                    }
                ]
            },
            {
                name: t('settings.options.misc.title'),
                icon: 'SETTINGS',
                value: null,
                options: [
                    {
                        name: t('settings.options.misc.options.endScreenCards'),

                        icon: 'VISIBILITY_OFF',
                        value: 'enableHideEndScreenCards'
                    },
                    {
                        name: t('settings.options.misc.options.youThereRenderer'),
                        icon: 'HELP',
                        value: 'enableYouThereRenderer'
                    },
                    {
                        name: t('settings.options.misc.options.paidPromoOverlay'),
                        icon: 'MONEY_HAND',
                        value: 'enablePaidPromotionOverlay'
                    },
                    {
                        name: t('settings.options.misc.options.whosWatching.title'),
                        icon: 'ACCOUNT_CIRCLE',
                        menuId: 'tt-whos-watching-menu-settings',
                        value: null,
                        options: [
                            {
                                name: t('settings.options.misc.options.whosWatching.options.enableWW'),
                                value: 'enableWhoIsWatchingMenu'
                            },
                            {
                                name: t('settings.options.misc.options.whosWatching.options.permaEnableWW'),
                                value: 'permanentlyEnableWhoIsWatchingMenu'
                            },
                            {
                                name: t('settings.options.misc.options.whosWatching.options.enableWWOnExit'),
                                value: 'enableWhosWatchingMenuOnAppExit'
                            }
                        ]
                    },
                    {
                        name: t('settings.options.misc.options.fixUI'),
                        icon: 'STAR',
                        value: 'enableFixedUI'
                    },
                    {
                        name: t('settings.options.misc.options.hqThumbnails'),
                        icon: 'VIDEO_QUALITY',
                        value: 'enableHqThumbnails'
                    },
                    /*{
                        name: 'Chapters',
                        icon: 'BOOKMARK_BORDER',
                        value: 'enableChapters'
                    },*/
                    {
                        name: t('settings.options.misc.options.longPress'),
                        value: 'enableLongPress'
                    },
                    {
                        name: t('settings.options.misc.options.shorts'),
                        icon: 'YOUTUBE_SHORTS_FILL_24',
                        value: 'enableShorts'
                    },
                    {
                        name: t('settings.options.misc.options.videoPreviews'),
                        value: 'enablePreviews'
                    },
                    {
                        name: t('settings.options.misc.options.ttWelcomeMsg'),
                        value: 'showWelcomeToast',
                    },
                    {
                        name: t('settings.options.misc.options.guestSignInReminder'),
                        value: 'enableSigninReminder'
                    },
                    {
                        name: t('settings.options.misc.options.reloadHomeOnStartup'),
                        value: 'reloadHomeOnStartup'
                    }
                ]
            },
            {
                name: t('settings.options.subtitles.title'),
                icon: 'TRANSLATE',
                value: null,
                options: [
                    {
                        name: t('settings.options.subtitles.options.showLocalSubtitle'),
                        value: 'enableShowUserLanguage'
                    },
                    {
                        name: t('settings.options.subtitles.options.showHiddenSubtitles'),
                        value: 'enableShowOtherLanguages'
                    }
                ]
            },
            {
                name: t('settings.options.videoPlayer.title'),
                icon: 'VIDEO_YOUTUBE',
                value: null,
                menuHeader: {
                    title: t('settings.options.videoPlayer.title'),
                    subtitle: t('settings.options.videoPlayer.subtitle')
                },
                options: [
                    {
                        name: t('settings.options.videoPlayer.options.patching.title'),
                        icon: 'SETTINGS',
                        value: null,
                        menuId: 'tt-video-player-ui-patching',
                        options: [
                            {
                                name: t('settings.options.videoPlayer.options.patching.options.enableVPUIPatching'),
                                icon: 'SETTINGS',
                                value: 'enablePatchingVideoPlayer'
                            },
                            {
                                name: t('settings.options.videoPlayer.options.patching.options.previousNextBtns'),
                                icon: 'SKIP_NEXT',
                                value: 'enablePreviousNextButtons'
                            },
                            {
                                name: t('settings.options.videoPlayer.options.patching.options.showSuperThxBtn'),
                                icon: 'MONEY_HEART',
                                value: 'enableSuperThanksButton'
                            },
                            {
                                name: t('settings.options.videoPlayer.options.patching.options.showAIAskBtn'),
                                icon: 'SPARK',
                                value: 'enableAIAskButton'
                            },
                            {
                                name: t('settings.options.videoPlayer.options.patching.options.showSpeedCtrlBtn'),
                                icon: 'SLOW_MOTION_VIDEO',
                                value: 'enableSpeedControlsButton'
                            },
                            {
                                name: t('settings.options.videoPlayer.options.patching.options.addMPBtn'),
                                icon: 'CLEAR_COOKIES',
                                value: 'enableMPButton'
                            },
                            {
                                name: t('settings.options.videoPlayer.options.patching.options.swapMPWithPIP'),
                                icon: 'CLEAR_COOKIES',
                                value: 'enableSwapMPWithPIP'
                            }
                        ]
                    },
                    {
                        name: t('settings.options.videoPlayer.options.preferredVideoQuality.title'),
                        icon: 'VIDEO_QUALITY',
                        value: null,
                        menuId: 'tt-preferred-video-quality',
                        menuHeader: {
                            title: t('settings.options.videoPlayer.options.preferredVideoQuality.title'),
                            subtitle: t('settings.options.videoPlayer.options.preferredVideoQuality.subtitle')
                        },
                        options:
                            ['Auto', '2160p', '1440p', '1080p', '720p', '480p', '360p', '240p', '144p'].map((quality) => {
                                return {
                                    name: quality,
                                    key: 'preferredVideoQuality',
                                    value: quality.toLowerCase()
                                }
                            })

                    },
                    {
                        name: t('settings.options.videoPlayer.options.speedSettings.title'),
                        icon: 'SLOW_MOTION_VIDEO',
                        value: null,
                        menuId: 'tt-speed-settings-increments',
                        menuHeader: {
                            title: t('settings.options.videoPlayer.options.speedSettings.title'),
                            subtitle: t('settings.options.videoPlayer.options.speedSettings.subtitle')
                        },
                        options: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5].map((increment) => {
                            return {
                                name: `${increment}x`,
                                key: 'speedSettingsIncrement',
                                value: increment
                            }
                        })
                    },
                    {
                        name: t('settings.options.videoPlayer.options.preferredVideoCodec.title'),
                        icon: 'VIDEO_QUALITY',
                        value: null,
                        menuId: 'tt-preferred-video-codec',
                        menuHeader: {
                            title: t('settings.options.videoPlayer.options.preferredVideoCodec.title'),
                            subtitle: t('settings.options.videoPlayer.options.preferredVideoCodec.subtitle'),
                        },
                        options: ['any', 'vp9', 'av01', 'avc1'].map((codec) => {
                            return {
                                name: codec === 'any' ? 'Any' : codec.toUpperCase(),
                                key: 'preferredVideoCodec',
                                value: codec
                            }
                        })
                    },
                    window.h5vcc && window.h5vcc.fasttube && window.h5vcc.fasttube.SetFrameRate ? {
                        name: t('settings.options.videoPlayer.options.afr'),
                        icon: 'SLOW_MOTION_VIDEO',
                        value: 'autoFrameRate'
                    } : null,
                    window.h5vcc && window.h5vcc.fasttube && window.h5vcc.fasttube.SetFrameRate ? {
                        name: t('settings.options.videoPlayer.options.afrPauseDuration.title'),
                        icon: 'TIMER',
                        value: null,
                        menuId: 'tt-auto-frame-rate-pause-duration',
                        menuHeader: {
                            title: t('settings.options.videoPlayer.options.afrPauseDuration.title'),
                            subtitle: t('settings.options.videoPlayer.options.afrPauseDuration.subtitle')
                        },
                        options: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((seconds) => {
                            return {
                                name: `${seconds} seconds`,
                                key: 'autoFrameRatePauseVideoFor',
                                value: seconds * 1000
                            }
                        })
                    } : null
                ]
            },
            {
                name: t('settings.options.uiSettings.title'),
                icon: 'SETTINGS',
                value: null,
                menuHeader: {
                    title: t('settings.options.uiSettings.title'),
                    subtitle: t('settings.options.uiSettings.subtitle')
                },
                options: [
                    {
                        name: t('settings.options.uiSettings.options.hideWatchedVideos.title'),
                        icon: 'VISIBILITY_OFF',
                        value: null,
                        menuId: 'tt-hide-watched-videos-settings',
                        options: [
                            {
                                name: t('settings.options.uiSettings.options.hideWatchedVideos.options.enableHideWatchedVideos'),
                                icon: 'VISIBILITY_OFF',
                                value: 'enableHideWatchedVideos'
                            },
                            {
                                name: t('settings.options.uiSettings.options.hideWatchedVideos.options.watchedVideosThreshold.title'),
                                value: null,
                                menuId: 'tt-hide-watched-videos-threshold',
                                menuHeader: {
                                    title: t('settings.options.uiSettings.options.hideWatchedVideos.options.watchedVideosThreshold.title'),
                                    subtitle: t('settings.options.uiSettings.options.hideWatchedVideos.options.watchedVideosThreshold.subtitle')
                                },
                                options: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((percent) => {
                                    return {
                                        name: `${percent}%`,
                                        key: 'hideWatchedVideosThreshold',
                                        value: percent
                                    }
                                })
                            },
                            {
                                name: t('settings.options.uiSettings.options.hideWatchedVideos.options.setPagesToHideWatchedVideos'),
                                value: null,
                                arrayToEdit: 'hideWatchedVideosPages',
                                menuId: 'tt-hide-watched-videos-pages',
                                options: [
                                    {
                                        name: 'Search Results',
                                        value: 'search'
                                    },
                                    {
                                        name: 'Home',
                                        value: 'home'
                                    },
                                    {
                                        name: 'Music',
                                        value: 'music'
                                    },
                                    {
                                        name: 'Gaming',
                                        value: 'gaming'
                                    },
                                    {
                                        name: 'Subscriptions',
                                        value: 'subscriptions'
                                    },
                                    {
                                        name: 'Library',
                                        value: 'library'
                                    },
                                    {
                                        name: 'More',
                                        value: 'more'
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        name: t('settings.options.uiSettings.options.screenDimming.title'),
                        icon: 'EYE_OFF',
                        value: null,
                        menuId: 'tt-screen-dimming-settings',
                        options: [
                            {
                                name: t('settings.options.uiSettings.options.screenDimming.options.enableScreenDimming'),
                                icon: 'EYE_OFF',
                                value: 'enableScreenDimming'
                            },
                            {
                                name: t('settings.options.uiSettings.options.screenDimming.options.dimmingTimeout.title'),
                                icon: 'TIMER',
                                value: null,
                                menuId: 'tt-dimming-timeout',
                                menuHeader: {
                                    title: t('settings.options.uiSettings.options.screenDimming.options.dimmingTimeout.title'),
                                    subtitle: t('settings.options.uiSettings.options.screenDimming.options.dimmingTimeout.subtitle')
                                },
                                options: [10, 20, 30, 60, 120, 180, 240, 300].map((seconds) => {
                                    const title = seconds >= 60 ? `${seconds / 60} minute${seconds / 60 > 1 ? 's' : ''}` : `${seconds} seconds`;
                                    return {
                                        name: title,
                                        key: 'dimmingTimeout',
                                        value: seconds
                                    }
                                })
                            },
                            {
                                name: t('settings.options.uiSettings.options.screenDimming.options.dimmingOpacity.title'),
                                icon: 'LENS_BLUE',
                                value: null,
                                menuId: 'tt-dimming-opacity',
                                menuHeader: {
                                    title: t('settings.options.uiSettings.options.screenDimming.options.dimmingOpacity.title'),
                                    subtitle: t('settings.options.uiSettings.options.screenDimming.options.dimmingOpacity.subtitle')
                                },
                                options: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map((opacity) => {
                                    return {
                                        name: `${Math.round(opacity * 100)}%`,
                                        key: 'dimmingOpacity',
                                        value: opacity
                                    }
                                })
                            }
                        ]
                    },
                    {
                        name: t('settings.options.uiSettings.options.disableSidebarContents.title'),
                        icon: 'MENU',
                        value: null,
                        arrayToEdit: 'disabledSidebarContents',
                        menuId: 'tt-sidebar-contents',
                        menuHeader: {
                            title: t('settings.options.uiSettings.options.disableSidebarContents.title'),
                            subtitle: t('settings.options.uiSettings.options.disableSidebarContents.subtitle')
                        },
                        options: [
                            {
                                name: 'Search',
                                icon: 'SEARCH',
                                value: 'SEARCH'
                            },
                            {
                                name: 'Home',
                                icon: 'WHAT_TO_WATCH',
                                value: 'WHAT_TO_WATCH'
                            },
                            {
                                name: 'Sports',
                                icon: 'TROPHY',
                                value: 'TROPHY'
                            },
                            {
                                name: 'News',
                                icon: 'NEWS',
                                value: 'NEWS'
                            },
                            {
                                name: 'Music',
                                icon: 'YOUTUBE_MUSIC',
                                value: 'YOUTUBE_MUSIC'
                            },
                            {
                                name: 'Podcasts',
                                icon: 'BROADCAST',
                                value: 'BROADCAST'
                            },
                            {
                                name: 'Movies & TV',
                                icon: 'CLAPPERBOARD',
                                value: 'CLAPPERBOARD'
                            },
                            {
                                name: 'Live',
                                icon: 'LIVE',
                                value: 'LIVE'
                            },
                            {
                                name: 'Gaming',
                                icon: 'GAMING',
                                value: 'GAMING'
                            },
                            {
                                name: 'Subscriptions',
                                icon: 'SUBSCRIPTIONS',
                                value: 'SUBSCRIPTIONS'
                            },
                            {
                                name: 'Library',
                                icon: 'TAB_LIBRARY',
                                value: 'TAB_LIBRARY'
                            },
                            {
                                name: 'More',
                                icon: 'TAB_MORE',
                                value: 'TAB_MORE'
                            },
                            {
                                name: 'Shorts',
                                icon: 'YOUTUBE_SHORTS_FILL_24',
                                value: 'YOUTUBE_SHORTS_FILL_24'
                            }
                        ]
                    },
                    {
                        name: t('settings.options.uiSettings.options.launchToOnStartup.title'),
                        icon: 'TV',
                        value: null,
                        menuId: 'tt-launch-to-on-startup',
                        menuHeader: {
                            title: t('settings.options.uiSettings.options.launchToOnStartup.title'),
                            subtitle: t('settings.options.uiSettings.options.launchToOnStartup.subtitle')
                        },
                        options: [
                            {
                                name: 'Search',
                                icon: 'SEARCH',
                                key: 'launchToOnStartup',
                                value: JSON.stringify({
                                    searchEndpoint: { query: '' }
                                })
                            },
                            {
                                name: 'Home',
                                icon: 'WHAT_TO_WATCH',
                                key: 'launchToOnStartup',
                                value: JSON.stringify({
                                    browseEndpoint: { browseId: 'FEtopics' }
                                })
                            },
                            {
                                name: 'Sports',
                                icon: 'TROPHY',
                                key: 'launchToOnStartup',
                                value: JSON.stringify({
                                    browseEndpoint: { browseId: 'FEtopics_sports' }
                                })
                            },
                            {
                                name: 'News',
                                icon: 'NEWS',
                                key: 'launchToOnStartup',
                                value: JSON.stringify({
                                    browseEndpoint: { browseId: 'FEtopics_news' }
                                })
                            },
                            {
                                name: 'Music',
                                icon: 'YOUTUBE_MUSIC',
                                key: 'launchToOnStartup',
                                value: JSON.stringify({
                                    browseEndpoint: { browseId: 'FEtopics_music' }
                                })
                            },
                            {
                                name: 'Podcasts',
                                icon: 'BROADCAST',
                                key: 'launchToOnStartup',
                                value: JSON.stringify({
                                    browseEndpoint: { browseId: 'FEtopics_podcasts' }
                                })
                            },
                            {
                                name: 'Movies & TV',
                                icon: 'CLAPPERBOARD',
                                key: 'launchToOnStartup',
                                value: JSON.stringify({
                                    browseEndpoint: { browseId: 'FEtopics_movies' }
                                })
                            },
                            {
                                name: 'Gaming',
                                icon: 'GAMING',
                                key: 'launchToOnStartup',
                                value: JSON.stringify({
                                    browseEndpoint: { browseId: 'FEtopics_gaming' }
                                })
                            },
                            {
                                name: 'Live',
                                icon: 'LIVE',
                                key: 'launchToOnStartup',
                                value: JSON.stringify({
                                    browseEndpoint: { browseId: 'FEtopics_live' }
                                })
                            },
                            {
                                name: 'Subscriptions',
                                icon: 'SUBSCRIPTIONS',
                                key: 'launchToOnStartup',
                                value: JSON.stringify({
                                    browseEndpoint: { browseId: 'FEsubscriptions' }
                                })
                            },
                            {
                                name: 'Library',
                                icon: 'TAB_LIBRARY',
                                key: 'launchToOnStartup',
                                value: JSON.stringify({
                                    browseEndpoint: { browseId: 'FElibrary' }
                                })
                            },
                            {
                                name: 'More',
                                icon: 'TAB_MORE',
                                key: 'launchToOnStartup',
                                value: JSON.stringify({
                                    browseEndpoint: { browseId: 'FEtopics_more' }
                                })
                            }
                        ]
                    },
                    {
                        name: t('settings.options.uiSettings.options.sortSubscriptionsByAlphabet'),
                        icon: 'SUBSCRIPTIONS',
                        value: 'sortSubscriptionsByAlphabet'
                    },
                    {
                        name: t('settings.options.uiSettings.options.disableChannelsOnSidebar'),
                        value: 'disableChannelsOnSidebar'
                    },
                    {
                        name: t('settings.options.uiSettings.options.clock.title'),
                        value: null,
                        icon: 'TIMER',
                        menuId: 'tt-clock-settings',
                        menuHeader: {
                            title: t('settings.options.uiSettings.options.clock.title'),
                            subtitle: t('settings.options.uiSettings.options.clock.subtitle')
                        },
                        options: [
                            {
                                name: t('settings.options.uiSettings.options.clock.options.enableClock'),
                                icon: 'TIMER',
                                value: 'enableClock'
                            },
                            {
                                name: t('settings.options.uiSettings.options.clock.options.isClock12HourFormat'),
                                icon: 'TIMER',
                                value: 'isClock12HourFormat'
                            },
                            {
                                name: t('settings.options.uiSettings.options.clock.options.clockShowSeconds'),
                                icon: 'TIMER',
                                value: 'clockShowSeconds'
                            }
                        ]
                    }
                ]
            },
            window.h5vcc && window.h5vcc.fasttube ?
                {
                    name: t('settings.options.updater.title'),
                    icon: 'SYSTEM_UPDATE',
                    value: null,
                    menuHeader: {
                        title: t('settings.options.updater.title'),
                        subtitle: t('settings.options.updater.menuSubtitle')
                    },
                    subtitle:  t('settings.options.updater.versionSubtitle', { version: window.h5vcc.fasttube.GetVersion() }),
                    options: [
                        buttonItem(
                            { title: t('settings.options.updater.options.checkForUpdates') },
                            { icon: 'SYSTEM_UPDATE' },
                            [
                                {
                                    customAction: {
                                        action: 'CHECK_FOR_UPDATES',
                                    }
                                }
                            ]
                        ),
                        {
                            name: t('settings.options.updater.options.checkForUpdatesOnStartup'),
                            icon: 'SYSTEM_UPDATE',
                            value: 'enableUpdater'
                        }
                    ]
                } : null
        ];

        const buttons = [];

        let index = 0;
        for (const setting of settings) {
            if (!setting) continue;
            const currentVal = setting.value ? configRead(setting.value) : null;
            buttons.push(
                buttonItem(
                    { title: setting.name, subtitle: setting.subtitle },
                    {
                        icon: setting.icon ? setting.icon : 'CHEVRON_DOWN',
                        secondaryIcon:
                            currentVal === null ? 'CHEVRON_RIGHT' : currentVal ? 'CHECK_BOX' : 'CHECK_BOX_OUTLINE_BLANK'
                    },
                    currentVal !== null
                        ? [
                            {
                                setClientSettingEndpoint: {
                                    settingDatas: [
                                        {
                                            clientSettingEnum: {
                                                item: setting.value
                                            },
                                            boolValue: !configRead(setting.value)
                                        }
                                    ]
                                }
                            },
                            {
                                customAction: {
                                    action: 'SETTINGS_UPDATE',
                                    parameters: [index]
                                }
                            }
                        ]
                        : [
                            {
                                customAction: {
                                    action: 'OPTIONS_SHOW',
                                    parameters: {
                                        options: setting.options,
                                        selectedIndex: 0,
                                        update: setting.options?.title ? 'customUI' : false,
                                        menuId: setting.menuId,
                                        arrayToEdit: setting.arrayToEdit,
                                        menuHeader: setting.menuHeader
                                    }
                                }
                            }
                        ]
                )
            );
            index++;
        }

        showModal(
            {
                title: t('settings.ttSettings.title'),
                subtitle: t('settings.ttSettings.madeByText')
            },
            overlayPanelItemListRenderer(buttons, parameters && parameters.length > 0 ? parameters[0] : 0),
            'tt-settings',
            update
        );
    }

    function optionShow(parameters, update) {
        if (update === 'customUI') {
            const option = parameters.options;
            showModal(
                {
                    title: option.title,
                    subtitle: option.subtitle
                },
                option.content,
                'tt-settings-support',
                false
            );
            return;
        }
        const buttons = [];

        // Check if this is the legacy sponsorBlockManualSkips (array-based) or new boolean-based options
        const isArrayBasedOptions = parameters.arrayToEdit !== undefined;

        if (isArrayBasedOptions) {
            // Legacy handling for sponsorBlockManualSkips
            const value = configRead(parameters.arrayToEdit);
            for (const option of parameters.options) {
                buttons.push(
                    buttonItem(
                        { title: option.name, subtitle: option.subtitle },
                        {
                            icon: option.icon ? option.icon : 'CHEVRON_DOWN',
                            secondaryIcon: value.includes(option.value) ? 'CHECK_BOX' : 'CHECK_BOX_OUTLINE_BLANK'
                        },
                        [
                            {
                                setClientSettingEndpoint: {
                                    settingDatas: [
                                        {
                                            clientSettingEnum: {
                                                item: parameters.arrayToEdit
                                            },
                                            arrayValue: option.value
                                        }
                                    ]
                                }
                            },
                            {
                                customAction: {
                                    action: 'OPTIONS_SHOW',
                                    parameters: {
                                        options: parameters.options,
                                        selectedIndex: parameters.options.indexOf(option),
                                        update: true,
                                        menuId: parameters.menuId,
                                        arrayToEdit: parameters.arrayToEdit,
                                        menuHeader: parameters.menuHeader
                                    }
                                }
                            }
                        ]
                    )
                );
            }
        } else {
            // New handling for boolean-based options (like subtitle localization)
            let index = 0;
            for (const option of parameters.options) {
                if (!option) continue;
                if (option.compactLinkRenderer) {
                    buttons.push(option);
                    index++;
                    continue;
                }
                const isRadioChoice = option.key !== null && option.key !== undefined;
                const currentVal = configRead(isRadioChoice ? option.key : option.value);
                buttons.push(
                    buttonItem(
                        { title: option.name, subtitle: option.subtitle },
                        {
                            icon: option.icon ? option.icon : 'CHEVRON_DOWN',
                            secondaryIcon: isRadioChoice ? currentVal === option.value ? 'RADIO_BUTTON_CHECKED' : 'RADIO_BUTTON_UNCHECKED' : option.value === null ? 'CHEVRON_RIGHT' : currentVal ? 'CHECK_BOX' : 'CHECK_BOX_OUTLINE_BLANK'
                        },
                        option.value === null ? [
                            {
                                customAction: {
                                    action: 'OPTIONS_SHOW',
                                    parameters: {
                                        options: option.options,
                                        selectedIndex: 0,
                                        update: option.options?.title ? 'customUI' : false,
                                        menuId: option.menuId,
                                        arrayToEdit: option.arrayToEdit,
                                        menuHeader: option.menuHeader
                                    }
                                }
                            }
                        ] : option.key !== null && option.key !== undefined ? [
                            {
                                setClientSettingEndpoint: {
                                    settingDatas: [
                                        {
                                            clientSettingEnum: {
                                                item: option.key
                                            },
                                            stringValue: option.value
                                        }
                                    ]
                                }
                            },
                            {
                                customAction: {
                                    action: 'OPTIONS_SHOW',
                                    parameters: {
                                        options: parameters.options,
                                        selectedIndex: index,
                                        update: parameters.options?.title ? 'customUI' : true,
                                        menuId: parameters.menuId,
                                        arrayToEdit: parameters.arrayToEdit,
                                        menuHeader: parameters.menuHeader
                                    }
                                }
                            }
                        ] : [
                            {
                                setClientSettingEndpoint: {
                                    settingDatas: [
                                        {
                                            clientSettingEnum: {
                                                item: option.value
                                            },
                                            boolValue: !currentVal
                                        }
                                    ]
                                }
                            },
                            {
                                customAction: {
                                    action: 'OPTIONS_SHOW',
                                    parameters: {
                                        options: parameters.options,
                                        selectedIndex: index,
                                        update: parameters.options?.title ? 'customUI' : true,
                                        menuId: parameters.menuId,
                                        arrayToEdit: parameters.arrayToEdit,
                                        menuHeader: parameters.menuHeader
                                    }
                                }
                            }
                        ]
                    )
                );
                index++;
            }
        }

        showModal(parameters.menuHeader ? parameters.menuHeader : 'Fast-Tube Settings', overlayPanelItemListRenderer(buttons, parameters.selectedIndex), parameters.menuId || 'tt-settings-options', update);
    }

    const interval$1 = setInterval(() => {
        const videoElement = document.querySelector('video');
        if (videoElement) {
            execute_once_dom_loaded_speed();
            clearInterval(interval$1);
        }
    }, 1000);

    function execute_once_dom_loaded_speed() {
        document.querySelector('video').addEventListener('canplay', () => {
            document.getElementsByTagName('video')[0].playbackRate = configRead('videoSpeed');    });

        const eventHandler = (evt) => {
            if (evt.keyCode == 406 || evt.keyCode == 191) {
                evt.preventDefault();
                evt.stopPropagation();
                if (evt.type === 'keydown') {
                    speedSettings();
                    return false;
                }
                return true;
            }    };

        // Red, Green, Yellow, Blue
        // 403, 404, 405, 406
        // ---, 172, 170, 191
        document.addEventListener('keydown', eventHandler, true);
        document.addEventListener('keypress', eventHandler, true);
        document.addEventListener('keyup', eventHandler, true);
    }

    function speedSettings() {
        const currentSpeed = configRead('videoSpeed');
        let selectedIndex = 0;
        const maxSpeed = 5;
        const increment = configRead('speedSettingsIncrement') || 0.25;
        const buttons = [];
        for (let speed = increment; speed <= maxSpeed; speed += increment) {
            const fixedSpeed = Math.round(speed * 100) / 100;
            buttons.push(
                buttonItem(
                    { title: `${fixedSpeed}x` },
                    null,
                    [
                        {
                            signalAction: {
                                signal: 'POPUP_BACK'
                            }
                        },
                        {
                            setClientSettingEndpoint: {
                                settingDatas: [
                                    {
                                        clientSettingEnum: {
                                            item: 'videoSpeed'
                                        },
                                        intValue: fixedSpeed.toString()
                                    }
                                ]
                            }
                        },
                        {
                            customAction: {
                                action: 'SET_PLAYER_SPEED',
                                parameters: fixedSpeed.toString()
                            }
                        }
                    ]
                )
            );
            if (currentSpeed === fixedSpeed) {
                selectedIndex = buttons.length - 1;
            }
        }

        buttons.push(
            buttonItem(
                { title: `Fix stuttering (1.0001x)` },
                null,
                [
                    {
                        signalAction: {
                            signal: 'POPUP_BACK'
                        }
                    },
                    {
                        setClientSettingEndpoint: {
                            settingDatas: [
                                {
                                    clientSettingEnum: {
                                        item: 'videoSpeed'
                                    },
                                    intValue: '1.0001'
                                }
                            ]
                        }
                    },
                    {
                        customAction: {
                            action: 'SET_PLAYER_SPEED',
                            parameters: '1.0001'
                        }
                    }
                ]
            )
        );

        showModal('Playback Speed', overlayPanelItemListRenderer(buttons, selectedIndex), 'tt-speed');
    }

    // Fast-Tube Cobalt Update Checker


    // If Fast-Tube is not running on Cobalt, do nothing
    // Add a timeout since reloading the home page while the updater pop up is shown causes the pop up to instantly disappear.
    setTimeout(() => {
        if (window.h5vcc && window.h5vcc.fasttube && configRead('enableUpdater')) {
            const currentEpoch = Math.floor(Date.now() / 1000);
            if (configRead('dontCheckUpdateUntil') > currentEpoch) {
                console.info('Skipping update check until', new Date(configRead('dontCheckUpdateUntil') * 1000).toLocaleString());
            } else checkForUpdates();
        }
    }, 2500);

    function getLatestRelease() {
        return fetch('https://api.github.com/repos/RezoxP/Fast-Tube/releases/latest')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            });
    }

    function checkForUpdates(showNoUpdateToast) {
        const currentAppVersion = window.h5vcc.fasttube.GetVersion();
        const currentEpoch = Math.floor(Date.now() / 1000);

        getLatestRelease()
            .then(release => {
                const latestVersion = release.tag_name.replace('v', '');
                const releaseDate = new Date(release.published_at).getTime() / 1000;

                let architecture;
                let downloadUrl;

                if (window.h5vcc.fasttube.GetArchitecture) {
                    architecture = window.h5vcc.fasttube.GetArchitecture();
                }

                if (architecture) {
                    if (architecture === 'arm64-v8a') {
                        downloadUrl = release.assets.find(asset => asset.name.includes('arm64.apk')).browser_download_url;
                    } else {
                        downloadUrl = release.assets.find(asset => asset.name.includes('arm.apk')).browser_download_url;
                    }
                } else downloadUrl = release.assets[0].browser_download_url;

                if (latestVersion !== currentAppVersion) {
                    console.info(`New version available: ${latestVersion} (current: ${currentAppVersion})`);
                    const msg = `Release Date: ${new Date(releaseDate * 1000).toLocaleString()}\n${release.body}`.replace(/#/g, '').replace(/\*/g, '').trim();

                    const buttons = [
                        buttonItem(
                            { title: 'Update Now', subtitle: 'Click to download the latest version.' },
                            { icon: 'DOWN_ARROW' },
                            [
                                {
                                    customAction: {
                                        action: 'UPDATE_DOWNLOAD',
                                        parameters: downloadUrl
                                    }
                                },
                                {
                                    signalAction: {
                                        signal: 'POPUP_BACK'
                                    }
                                }
                            ]
                        ),
                        buttonItem(
                            { title: 'Remind Me Later', subtitle: 'Check for updates later.' },
                            { icon: 'SEARCH_HISTORY' },
                            [
                                {
                                    customAction: {
                                        action: 'UPDATE_REMIND_LATER',
                                        parameters: currentEpoch + 86400
                                    }
                                },
                                {
                                    signalAction: {
                                        signal: 'POPUP_BACK'
                                    }
                                }
                            ]
                        )
                    ];

                    // Add an empty message so the CSS doesn't get screwed after user input
                    buttons.push(overlayMessageRenderer(' '));
                    buttons.push(overlayMessageRenderer(msg));

                    showModal(
                        {
                            title: 'Update Available',
                            subtitle: `A new version of Fast-Tube Cobalt is available: ${latestVersion}, current: ${currentAppVersion}`
                        },
                        overlayPanelItemListRenderer(buttons),
                        'tt-update-modal',
                        false
                    );
                } else {
                    console.info('You are using the latest version of Fast-Tube.');
                    if (showNoUpdateToast) {
                        showToast('Fast-Tube is up to date', `You are using the latest version (${currentAppVersion}) of Fast-Tube Cobalt.`, null);
                    }
                }
            })
            .catch(error => {
                console.error('Error fetching the latest release:', error);
                showToast('Fast-Tube update check failed', 'Could not check for updates.', null);
            });
    }

    function resolveCommand(cmd, _) {
        // resolveCommand function is pretty OP, it can do from opening modals, changing client settings and way more.
        // Because the client might change, we should find it first.

        for (const key in window._yttv) {
            if (window._yttv[key] && window._yttv[key].instance && window._yttv[key].instance.resolveCommand) {
                return window._yttv[key].instance.resolveCommand(cmd, _);
            }
        }
    }

    // Patch resolveCommand to be able to change Fast-Tube settings

    function patchResolveCommand() {
        for (const key in window._yttv) {
            if (window._yttv[key]?.instance?.resolveCommand) {
                if (window._yttv[key].instance.resolveCommand.isFastTubePatched) continue;
                const ogResolve = window._yttv[key].instance.resolveCommand;
                const patched = function (cmd, _) {
                    if (cmd.setClientSettingEndpoint) {
                        // Command to change client settings. Use Fast-Tube configuration to change settings.
                        let handled = false;
                        for (const setting of cmd.setClientSettingEndpoint.settingDatas) {
                            if (setting.clientSettingEnum?.item && !setting.clientSettingEnum.item.includes('_')) {
                                const valName = Object.keys(setting).find(key => key.includes('Value'));
                                if (valName) {
                                    const value = valName === 'intValue' ? Number(setting[valName]) : setting[valName];
                                    if (valName === 'arrayValue') {
                                        const arr = (configRead(setting.clientSettingEnum.item) || []).slice();
                                        const idx = arr.indexOf(value);
                                        if (idx !== -1) {
                                            arr.splice(idx, 1);
                                        } else {
                                            arr.push(value);
                                        }
                                        configWrite(setting.clientSettingEnum.item, arr);
                                    } else {
                                        configWrite(setting.clientSettingEnum.item, value);
                                    }
                                    handled = true;
                                }
                            } else if (setting.clientSettingEnum?.item === 'I18N_LANGUAGE') {
                                const lang = setting.stringValue;
                                const date = new Date();
                                date.setFullYear(date.getFullYear() + 10);
                                document.cookie = `PREF=hl=${lang}; expires=${date.toUTCString()};`;
                                resolveCommand({
                                    signalAction: {
                                        signal: 'RELOAD_PAGE'
                                    }
                                });
                                return true;
                            }
                        }
                        if (handled) return true;
                    } else if (cmd.customAction) {
                        customAction(cmd.customAction.action, cmd.customAction.parameters);
                        return true;
                    } else if (cmd?.signalAction?.customAction) {
                        customAction(cmd.signalAction.customAction.action, cmd.signalAction.customAction.parameters);
                        return true;
                    } else if (cmd?.showEngagementPanelEndpoint?.customAction) {
                        customAction(cmd.showEngagementPanelEndpoint.customAction.action, cmd.showEngagementPanelEndpoint.customAction.parameters);
                        return true;
                    } else if (cmd?.playlistEditEndpoint?.customAction) {
                        customAction(cmd.playlistEditEndpoint.customAction.action, cmd.playlistEditEndpoint.customAction.parameters);
                        return true;
                    } else if (cmd?.openPopupAction?.uniqueId === 'playback-settings') {
                        // Patch the playback settings popup to use Fast-Tube speed settings
                        const items = cmd.openPopupAction.popup.overlaySectionRenderer.overlay.overlayTwoPanelRenderer.actionPanel.overlayPanelRenderer.content.overlayPanelItemListRenderer.items;
                        for (const item of items) {
                            if (item?.compactLinkRenderer?.icon?.iconType === 'SLOW_MOTION_VIDEO') {
                                item.compactLinkRenderer.subtitle && (item.compactLinkRenderer.subtitle.simpleText = 'with Fast-Tube');
                                item.compactLinkRenderer.serviceEndpoint = {
                                    clickTrackingParams: "null",
                                    signalAction: {
                                        customAction: {
                                            action: 'TT_SPEED_SETTINGS_SHOW',
                                            parameters: []
                                        }
                                    }
                                };
                            }
                        }

                        cmd.openPopupAction.popup.overlaySectionRenderer.overlay.overlayTwoPanelRenderer.actionPanel.overlayPanelRenderer.content.overlayPanelItemListRenderer.items.splice(2, 0,
                            buttonItem(
                                { title: 'Mini Player' },
                                { icon: 'CLEAR_COOKIES' }, [
                                {
                                    customAction: {
                                        action: 'ENTER_MP'
                                    }
                                }
                            ])
                        );

                        if (window.h5vcc && window.h5vcc.fasttube && window.h5vcc.fasttube.HasSystemFeature && 
                            window.h5vcc.fasttube.HasSystemFeature('android.software.picture_in_picture')) {
                            cmd.openPopupAction.popup.overlaySectionRenderer.overlay.overlayTwoPanelRenderer.actionPanel.overlayPanelRenderer.content.overlayPanelItemListRenderer.items.splice(3, 0,
                                buttonItem(
                                    { title: 'Picture in Picture' },
                                    { icon: 'PIP' }, [
                                    {
                                        customAction: {
                                            action: 'ENTER_PIP'
                                        }
                                    },
                                    {
                                        signalAction: {
                                             signal: 'POPUP_BACK'
                                        }
                                    }
                                ])
                            );
                        }
                    } else if (cmd?.watchEndpoint?.videoId) {
                        window.isPipPlaying = false;
                        const ytlrPlayerContainer = document.querySelector('ytlr-player-container');
                        ytlrPlayerContainer.style.removeProperty('z-index');
                    }

                    if (cmd.customAction) return window._yttv[key].instance.resolveCommand(cmd, _);

                    if (cmd.commandExecutorCommand && cmd.commandExecutorCommand.commands) {
                        for (const command of cmd.commandExecutorCommand.commands) {
                            if (command.customAction) {
                                customAction(command.customAction.action, command.customAction.parameters);
                            } else if (command.signalAction?.customAction) {
                                customAction(command.signalAction.customAction.action, command.signalAction.customAction.parameters);
                            } else if (command.showEngagementPanelEndpoint?.customAction) {
                                customAction(command.showEngagementPanelEndpoint.customAction.action, command.showEngagementPanelEndpoint.customAction.parameters);
                            } else if (command.playlistEditEndpoint?.customAction) {
                                customAction(command.playlistEditEndpoint.customAction.action, command.playlistEditEndpoint.customAction.parameters);
                            } else {
                                window._yttv[key].instance.resolveCommand(command, _);
                            }
                        }
                        return true;
                    }

                    if (cmd?.requestAccountSelectorCommand
                        && cmd.requestAccountSelectorCommand?.identityActionContext?.eventTrigger === 'ACCOUNT_EVENT_TRIGGER_ON_EXIT') {
                        if (!configRead('enableWhosWatchingMenuOnAppExit')) {
                            ogResolve.call(this, {
                                signalAction: {
                                    signal: 'EXIT_APP'
                                }
                            });
                            return false;
                        }
                    }

                    return ogResolve.call(this, cmd, _);
                };
                patched.isFastTubePatched = true;
                window._yttv[key].instance.resolveCommand = patched;
            }
        }
    }

    function customAction(action, parameters) {
        switch (action) {
            case 'SETTINGS_UPDATE':
                modernUI(true, parameters);
                break;
            case 'OPTIONS_SHOW':
                optionShow(parameters, parameters.update);
                break;
            case 'SKIP':
                const kE = document.createEvent('Event');
                kE.initEvent('keydown', true, true);
                kE.keyCode = 27;
                kE.which = 27;
                document.dispatchEvent(kE);

                document.querySelector('video').currentTime = parameters.time;
                break;
            case 'TT_SETTINGS_SHOW':
                modernUI();
                break;
            case 'TT_SPEED_SETTINGS_SHOW':
                speedSettings();
                break;
            case 'UPDATE_REMIND_LATER':
                configWrite('dontCheckUpdateUntil', parameters);
                break;
            case 'UPDATE_DOWNLOAD':
                window.h5vcc.fasttube.InstallAppFromURL(parameters);
                showToast('Fast-Tube Update', 'Downloading update, please wait...');
                break;
            case 'SET_PLAYER_SPEED':
                const speed = Number(parameters);
                document.querySelector('video').playbackRate = speed;
                break;
            case 'ENTER_MP':
                enablePip();
                break;
            case 'ENTER_PIP':
                window.h5vcc.fasttube.EnterPIP();
                break;
            case 'SHOW_TOAST':
                showToast('Fast-Tube', parameters);
                break;
            case 'ADD_TO_QUEUE':
                window.queuedVideos.videos.push(parameters);
                showToast('Fast-Tube', 'Video added to queue.');
                break;
            case 'CLEAR_QUEUE':
                window.queuedVideos.videos = [];
                showToast('Fast-Tube', 'Video queue cleared.');
                break;
            case 'CHECK_FOR_UPDATES':
                checkForUpdates(true);
                break;
        }
    }

    function PatchSettings(settingsObject) {
        const fasttubeOpenAction = SettingActionRenderer(
            t('settings.ttSettings.title'),
            'fasttube_open_action',
            {
                customAction: {
                    action: 'TT_SETTINGS_SHOW',
                    parameters: []
                }
            },
            t('settings.ttSettings.summary'),
            'https://www.gstatic.com/ytlr/img/parent_code.png'
        );

        const fasttubeCategory = SettingsCategory(
            'fasttube_category',
            [fasttubeOpenAction]
        );
        // Add it as the first item in the settings object
        settingsObject.items.unshift(fasttubeCategory);

    }

    /**
     * Minimal fast ad-filtering and metadata processing for YouTube TV
     */
    const origParse$1 = JSON.parse;
    JSON.parse = function () {
      const r = origParse$1.apply(this, arguments);
      if (!r || typeof r !== 'object') return r;

      try {
        const adBlockEnabled = configRead('enableAdBlock');
        const signinReminderEnabled = configRead('enableSigninReminder');

        if (adBlockEnabled) {
          if (r.adPlacements) r.adPlacements = [];
          if (r.playerAds) r.playerAds = false;
          if (r.adSlots) r.adSlots = [];
        }

        if (r.paidContentOverlay && !configRead('enablePaidPromotionOverlay')) {
          r.paidContentOverlay = null;
        }

        const preferredCodec = configRead('videoPreferredCodec');
        if (preferredCodec !== 'any' && r?.streamingData?.adaptiveFormats) {
          const hasPreferredCodec = r.streamingData.adaptiveFormats.some(format => format.mimeType && format.mimeType.includes(preferredCodec));
          if (hasPreferredCodec) {
            r.streamingData.adaptiveFormats = r.streamingData.adaptiveFormats.filter(format => {
              if (format.mimeType && format.mimeType.startsWith('audio/')) return true;
              return format.mimeType && format.mimeType.includes(preferredCodec);
            });
          }
        }

        // Drop "masthead" ad from home screen
        const sectionListContents = r?.contents?.tvBrowseRenderer?.content?.tvSurfaceContentRenderer?.content?.sectionListRenderer?.contents;
        if (Array.isArray(sectionListContents)) {
          let filteredContents = sectionListContents;
          if (!signinReminderEnabled) {
            filteredContents = filteredContents.filter((elm) => !elm.feedNudgeRenderer);
          }

          if (adBlockEnabled) {
            filteredContents = filteredContents.filter((elm) => !elm.adSlotRenderer);

            for (const shelve of filteredContents) {
              if (shelve.shelfRenderer?.content?.horizontalListRenderer?.items) {
                shelve.shelfRenderer.content.horizontalListRenderer.items =
                  shelve.shelfRenderer.content.horizontalListRenderer.items.filter(
                    (item) => !item.adSlotRenderer
                  );
              }
            }
          }

          r.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content.sectionListRenderer.contents = filteredContents;
          processShelves(filteredContents);
        }

        if (r.endscreen && configRead('enableHideEndScreenCards')) {
          r.endscreen = null;
        }

        if (Array.isArray(r.messages) && !configRead('enableYouThereRenderer')) {
          r.messages = r.messages.filter((msg) => !msg?.youThereRenderer);
        }

        // Remove shorts ads
        if (!Array.isArray(r) && Array.isArray(r.entries) && adBlockEnabled) {
          r.entries = r.entries.filter(
            (elm) => !elm?.command?.reelWatchEndpoint?.adClientParams?.isAd
          );
        }

        // Patch settings
        if (r.title?.runs) {
          PatchSettings(r);
        }

        // DeArrow / Shelf processing
        if (r.contents?.sectionListRenderer?.contents) {
          processShelves(r.contents.sectionListRenderer.contents);
        }

        if (r.continuationContents?.sectionListContinuation?.contents) {
          processShelves(r.continuationContents.sectionListContinuation.contents);
        }

        if (r.continuationContents?.horizontalListContinuation?.items) {
          const items = r.continuationContents.horizontalListContinuation.items;
          deArrowify(items);
          hqify(items);
          addLongPress(items);
          r.continuationContents.horizontalListContinuation.items = hideVideo(items);
        }

        const navSections = r.contents?.tvBrowseRenderer?.content?.tvSecondaryNavRenderer?.sections;
        if (Array.isArray(navSections)) {
          const sortAlphabet = configRead('sortSubscriptionsByAlphabet');
          for (let i = 0; i < navSections.length; i++) {
            const section = navSections[i]?.tvSecondaryNavSectionRenderer;
            if (!section || !Array.isArray(section.tabs)) continue;

            if (sortAlphabet) {
              section.tabs.sort((a, b) => {
                if (a.tabRenderer?.selected && !b.tabRenderer?.selected) return -1;
                if (!a.tabRenderer?.selected && b.tabRenderer?.selected) return 1;
                return (a.tabRenderer?.title || '').localeCompare(b.tabRenderer?.title || '');
              });
            }

            for (let j = 0; j < section.tabs.length; j++) {
              const tab = section.tabs[j];
              const tabSectionContents = tab?.tabRenderer?.content?.tvSurfaceContentRenderer?.content?.sectionListRenderer?.contents;
              if (Array.isArray(tabSectionContents)) {
                processShelves(tabSectionContents);
              }
            }
          }
        }

        const watchNextPivot = r.contents?.singleColumnWatchNextResults?.pivot?.sectionListRenderer;
        if (Array.isArray(watchNextPivot?.contents)) {
          if (!signinReminderEnabled) {
            watchNextPivot.contents = watchNextPivot.contents.filter(
              (elm) => !elm.alertWithActionsRenderer
            );
          }
          processShelves(watchNextPivot.contents, false);
          if (window.queuedVideos?.videos?.length > 0) {
            const queuedVideosClone = window.queuedVideos.videos.slice();
            queuedVideosClone.unshift(TileRenderer(
              'Clear Queue',
              {
                customAction: {
                  action: 'CLEAR_QUEUE'
                }
              }));
            watchNextPivot.contents.unshift(ShelfRenderer(
              'Queued Videos',
              queuedVideosClone,
              queuedVideosClone.findIndex(v => v.contentId === window.queuedVideos.lastVideoId) !== -1 ?
                queuedVideosClone.findIndex(v => v.contentId === window.queuedVideos.lastVideoId)
                : 0
            ));
          }
        }

        // Manual SponsorBlock Skips
        const manualSkippedSegments = configRead('sponsorBlockManualSkips');
        if (Array.isArray(manualSkippedSegments) && manualSkippedSegments.length > 0 && r.playerOverlays?.playerOverlayRenderer) {
          if (Array.isArray(window?.sponsorblock?.segments)) {
            const timelyActions = [];
            for (const segment of window.sponsorblock.segments) {
              if (manualSkippedSegments.includes(segment.category)) {
                const timelyActionData = timelyAction(
                  t('sponsorblock.toasts.skip', { segment: t(`sponsorblock.segments.${segment.category}`) }),
                  'SKIP_NEXT',
                  {
                    clickTrackingParams: null,
                    showEngagementPanelEndpoint: {
                      customAction: {
                        action: 'SKIP',
                        parameters: {
                          time: segment.segment[1]
                        }
                      }
                    }
                  },
                  segment.segment[0] * 1000,
                  segment.segment[1] * 1000 - segment.segment[0] * 1000
                );
                timelyActions.push(timelyActionData);
              }
            }
            r.playerOverlays.playerOverlayRenderer.timelyActionRenderers = timelyActions;
          }
        } else if (r.playerOverlays?.playerOverlayRenderer) {
          r.playerOverlays.playerOverlayRenderer.timelyActionRenderers = [];
        }

        if (r.transportControls?.transportControlsRenderer?.promotedActions && configRead('enableSponsorBlockHighlight')) {
          if (Array.isArray(window?.sponsorblock?.segments)) {
            const category = window.sponsorblock.segments.find(seg => seg.category === 'poi_highlight');
            if (category && !r.transportControls.transportControlsRenderer.promotedActions.some(a => a.type === 'TRANSPORT_CONTROLS_BUTTON_TYPE_SPONSORBLOCK_HIGHLIGHT')) {
              r.transportControls.transportControlsRenderer.promotedActions.push({
                type: 'TRANSPORT_CONTROLS_BUTTON_TYPE_SPONSORBLOCK_HIGHLIGHT',
                button: {
                  buttonRenderer: ButtonRenderer(
                    false,
                    t('sponsorblock.toasts.skipToHighlight'),
                    'FAST_FORWARD',
                    {
                      clickTrackingParams: null,
                      customAction: {
                        action: 'SKIP',
                        parameters: {
                          time: category.segment[0]
                        }
                      }
                    })
                }
              });
            }
          }
        }
      } catch (e) {}

      return r;
    };

    // Fix playback issues without heavy deep stringify/parse
    const origStringify = JSON.stringify;
    JSON.stringify = function (value, replacer, space) {
      if (value?.playbackContext?.contentPlaybackContext) {
        if (!value.playbackContext.contentPlaybackContext.isInlinePlaybackNoAd) {
          const copiedValue = {
            ...value,
            playbackContext: {
              ...value.playbackContext,
              contentPlaybackContext: {
                ...value.playbackContext.contentPlaybackContext,
                isInlinePlaybackNoAd: true
              }
            }
          };
          return origStringify.call(this, copiedValue, replacer, space);
        }
      }
      return origStringify.call(this, value, replacer, space);
    };

    window.JSON.stringify = JSON.stringify;
    window.JSON.parse = JSON.parse;

    if (window._yttv) {
      for (const key in window._yttv) {
        if (window._yttv[key]?.JSON?.parse) {
          window._yttv[key].JSON.parse = JSON.parse;
        }
      }
    }

    function processShelves(shelves, shouldAddPreviews = true) {
      if (!Array.isArray(shelves)) return;
      const enableShorts = configRead('enableShorts');

      for (let sIdx = shelves.length - 1; sIdx >= 0; sIdx--) {
        const shelve = shelves[sIdx];
        if (!shelve?.shelfRenderer) continue;

        if (!enableShorts && shelve.shelfRenderer.tvhtml5ShelfRendererType === 'TVHTML5_SHELF_RENDERER_TYPE_SHORTS') {
          shelves.splice(sIdx, 1);
          continue;
        }

        const items = shelve.shelfRenderer.content?.horizontalListRenderer?.items;
        if (!Array.isArray(items)) continue;

        deArrowify(items);
        hqify(items);
        addLongPress(items);
        if (shouldAddPreviews) {
          addPreviews(items);
        }
        shelve.shelfRenderer.content.horizontalListRenderer.items = hideVideo(items);

        if (!enableShorts) {
          shelve.shelfRenderer.content.horizontalListRenderer.items = shelve.shelfRenderer.content.horizontalListRenderer.items.filter(item => {
            if (item.tileRenderer?.tvhtml5ShelfRendererType === 'TVHTML5_TILE_RENDERER_TYPE_SHORTS') return false;
            if (item.tileRenderer?.onSelectCommand?.reelWatchEndpoint) return false;
            return true;
          });
        }
      }
    }

    function addPreviews(items) {
      if (!configRead('enablePreviews') || !Array.isArray(items)) return;
      for (const item of items) {
        if (item?.tileRenderer) {
          const watchEndpoint = item.tileRenderer.onSelectCommand;
          if (!watchEndpoint) continue;
          if (item.tileRenderer.onFocusCommand?.playbackEndpoint) continue;
          if (item.tileRenderer.onFocusCommand?.commandExecutorCommand) continue;

          item.tileRenderer.onFocusCommand = {
            startInlinePlaybackCommand: {
              blockAdoption: true,
              caption: false,
              delayMs: 3000,
              durationMs: 40000,
              muted: false,
              restartPlaybackBeforeSeconds: 10,
              resumeVideo: true,
              playbackEndpoint: { ...watchEndpoint }
            }
          };
        }
      }
    }

    function deArrowify(items) {
      const isDeArrowEnabled = configRead('enableDeArrow');
      if (!isDeArrowEnabled || !Array.isArray(items)) return;
      const isDeArrowThumbnailsEnabled = configRead('enableDeArrowThumbnails');
      
      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        if (!item?.tileRenderer) continue;
        
        const videoID = item.tileRenderer.contentId;
        if (!videoID) continue;

        setTimeout(() => {
          fetch(`https://sponsor.ajay.app/api/branding?videoID=${videoID}`)
            .then(res => res.json())
            .then(data => {
              if (data.titles && data.titles.length > 0) {
                const mostVoted = data.titles.reduce((max, title) => max.votes > title.votes ? max : title);
                if (item.tileRenderer?.metadata?.tileMetadataRenderer?.title) {
                  item.tileRenderer.metadata.tileMetadataRenderer.title.simpleText = mostVoted.title;
                }
              }

              if (isDeArrowThumbnailsEnabled && data.thumbnails && data.thumbnails.length > 0) {
                const mostVotedThumbnail = data.thumbnails.reduce((max, thumbnail) => max.votes > thumbnail.votes ? max : thumbnail);
                if (mostVotedThumbnail.timestamp && item.tileRenderer?.header?.tileHeaderRenderer?.thumbnail) {
                  item.tileRenderer.header.tileHeaderRenderer.thumbnail.thumbnails = [
                    {
                      url: `https://dearrow-thumb.ajay.app/api/v1/getThumbnail?videoID=${videoID}&time=${mostVotedThumbnail.timestamp}`,
                      width: 1280,
                      height: 640
                    }
                  ];
                }
              }
            })
            .catch(() => {});
        }, 500 + Math.random() * 2000);
      }
    }

    function hqify(items) {
      if (!configRead('enableHqThumbnails') || !Array.isArray(items)) return;

      for (const item of items) {
        if (item?.tileRenderer?.style !== 'TILE_STYLE_YTLR_DEFAULT') continue;
        const videoID = item.tileRenderer.onSelectCommand?.watchEndpoint?.videoId;
        const thumbUrl = item.tileRenderer.header?.tileHeaderRenderer?.thumbnail?.thumbnails?.[0]?.url;
        if (!videoID || !thumbUrl) continue;

        const queryArgs = thumbUrl.split('?')[1];
        item.tileRenderer.header.tileHeaderRenderer.thumbnail.thumbnails = [
          {
            url: `https://i.ytimg.com/vi/${videoID}/sddefault.jpg${queryArgs ? `?${queryArgs}` : ''}`,
            width: 640,
            height: 480
          }
        ];
      }
    }

    function addLongPress(items) {
      if (!Array.isArray(items)) return;
      const enableLongPress = configRead('enableLongPress');

      for (const item of items) {
        if (!item?.tileRenderer || item.tileRenderer.style !== 'TILE_STYLE_YTLR_DEFAULT') continue;

        if (item.tileRenderer.onLongPressCommand?.showMenuCommand?.menu?.menuRenderer?.items) {
          const copiedItem = { ...item, tileRenderer: { ...item.tileRenderer, onLongPressCommand: undefined } };
          item.tileRenderer.onLongPressCommand.showMenuCommand.menu.menuRenderer.items.push(
            MenuServiceItemRenderer('Add to Queue', {
              clickTrackingParams: null,
              playlistEditEndpoint: {
                customAction: {
                  action: 'ADD_TO_QUEUE',
                  parameters: copiedItem
                }
              }
            })
          );
          continue;
        }

        if (!enableLongPress) continue;
        if (!item.tileRenderer.metadata?.tileMetadataRenderer) continue;
        if (!item.tileRenderer.header?.tileHeaderRenderer?.thumbnail?.thumbnails) continue;
        if (!item.tileRenderer.onSelectCommand?.watchEndpoint) continue;

        const copiedItem = { ...item, tileRenderer: { ...item.tileRenderer, onLongPressCommand: undefined } };
        const subtitleNode = copiedItem.tileRenderer.metadata.tileMetadataRenderer.lines?.[0]?.lineRenderer?.items?.[0]?.lineItemRenderer?.text;
        if (!subtitleNode) continue;

        const subtitle = subtitleNode;
        const data = longPressData({
          videoId: copiedItem.tileRenderer.contentId,
          thumbnails: copiedItem.tileRenderer.header.tileHeaderRenderer.thumbnail.thumbnails,
          title: copiedItem.tileRenderer.metadata.tileMetadataRenderer.title.simpleText,
          subtitle: subtitle.runs ? subtitle.runs[0].text : subtitle.simpleText,
          watchEndpointData: copiedItem.tileRenderer.onSelectCommand.watchEndpoint,
          item: copiedItem
        });
        item.tileRenderer.onLongPressCommand = data;
      }
    }

    function hideVideo(items) {
      if (!Array.isArray(items)) return items;
      const pages = configRead('hideWatchedVideosPages');
      if (!pages || !pages.length) return items;

      const hash = location.hash ? location.hash.substring(1) : '';
      let pageName = '';
      if (hash === '/') {
        pageName = 'home';
      } else if (hash.startsWith('/search')) {
        pageName = 'search';
      } else {
        const qIndex = hash.indexOf('?');
        if (qIndex !== -1) {
          const match = hash.slice(qIndex + 1).match(/(?:^|&)[\w]+=(?:FE|topics_)?([^&]+)/);
          pageName = match ? match[1] : '';
        }
      }

      if (!pages.includes(pageName)) return items;
      const threshold = configRead('hideWatchedVideosThreshold');

      return items.filter(item => {
        if (!item?.tileRenderer?.header?.tileHeaderRenderer?.thumbnailOverlays) return true;
        const overlays = item.tileRenderer.header.tileHeaderRenderer.thumbnailOverlays;
        let progressBar = null;
        for (let i = 0; i < overlays.length; i++) {
          if (overlays[i].thumbnailOverlayResumePlaybackRenderer) {
            progressBar = overlays[i].thumbnailOverlayResumePlaybackRenderer;
            break;
          }
        }
        if (!progressBar) return true;

        const percentWatched = (progressBar.percentDurationWatched || 0);
        return percentWatched <= threshold;
      });
    }

    // The tiny-sha256 module, edited to export itself.
    var sha256 = function sha256(ascii) {
    	function rightRotate(value, amount) {
    		return (value >>> amount) | (value << (32 - amount));
    	}
    	var mathPow = Math.pow;
    	var maxWord = mathPow(2, 32);
    	var lengthProperty = 'length';
    	var i, j; // Used as a counter across the whole file
    	var result = '';

    	var words = [];
    	var asciiBitLength = ascii[lengthProperty] * 8;

    	//* caching results is optional - remove/add slash from front of this line to toggle
    	// Initial hash value: first 32 bits of the fractional parts of the square roots of the first 8 primes
    	// (we actually calculate the first 64, but extra values are just ignored)
    	var hash = sha256.h = sha256.h || [];
    	// Round constants: first 32 bits of the fractional parts of the cube roots of the first 64 primes
    	var k = sha256.k = sha256.k || [];
    	var primeCounter = k[lengthProperty];
    	/*/
    	var hash = [], k = [];
    	var primeCounter = 0;
    	//*/

    	var isComposite = {};
    	for (var candidate = 2; primeCounter < 64; candidate++) {
    		if (!isComposite[candidate]) {
    			for (i = 0; i < 313; i += candidate) {
    				isComposite[i] = candidate;
    			}
    			hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
    			k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    		}
    	}

    	ascii += '\x80'; // Append '1' bit (plus zero padding)
    	while (ascii[lengthProperty] % 64 - 56) ascii += '\x00'; // More zero padding
    	for (i = 0; i < ascii[lengthProperty]; i++) {
    		j = ascii.charCodeAt(i);
    		if (j >> 8) return; // ASCII check: only accept characters in range 0-255
    		words[i >> 2] |= j << ((3 - i) % 4) * 8;
    	}
    	words[words[lengthProperty]] = ((asciiBitLength / maxWord) | 0);
    	words[words[lengthProperty]] = (asciiBitLength);

    	// process each chunk
    	for (j = 0; j < words[lengthProperty];) {
    		var w = words.slice(j, j += 16); // The message is expanded into 64 words as part of the iteration
    		var oldHash = hash;
    		// This is now the "working hash", often labelled as variables a...g
    		// (we have to truncate as well, otherwise extra entries at the end accumulate
    		hash = hash.slice(0, 8);

    		for (i = 0; i < 64; i++) {
    			// Expand the message into 64 words
    			// Used below if 
    			var w15 = w[i - 15], w2 = w[i - 2];

    			// Iterate
    			var a = hash[0], e = hash[4];
    			var temp1 = hash[7]
    				+ (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) // S1
    				+ ((e & hash[5]) ^ ((~e) & hash[6])) // ch
    				+ k[i]
    				// Expand the message schedule if needed
    				+ (w[i] = (i < 16) ? w[i] : (
    					w[i - 16]
    					+ (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) // s0
    					+ w[i - 7]
    					+ (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10)) // s1
    				) | 0
    				);
    			// This is only used once, so *could* be moved below, but it only saves 4 bytes and makes things unreadble
    			var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) // S0
    				+ ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2])); // maj

    			hash = [(temp1 + temp2) | 0].concat(hash); // We don't bother trimming off the extra ones, they're harmless as long as we're truncating when we do the slice()
    			hash[4] = (hash[4] + temp1) | 0;
    		}

    		for (i = 0; i < 8; i++) {
    			hash[i] = (hash[i] + oldHash[i]) | 0;
    		}
    	}

    	for (i = 0; i < 8; i++) {
    		for (j = 3; j + 1; j--) {
    			var b = (hash[i] >> (j * 8)) & 255;
    			result += ((b < 16) ? 0 : '') + b.toString(16);
    		}
    	}
    	return result;
    };

    // Copied from https://github.com/ajayyy/SponsorBlock/blob/da1a535de784540ee10166a75a3eb8537073838c/src/config.ts#L113-L134
    const barTypes = {
      sponsor: {
        color: '#00d400',
        opacity: '0.7',
        name: t('sponsorblock.segments.sponsor') || 'sponsored segment'
      },
      intro: {
        color: '#00ffff',
        opacity: '0.7',
        name: t('sponsorblock.segments.intro') || 'intro'
      },
      outro: {
        color: '#0202ed',
        opacity: '0.7',
        name: t('sponsorblock.segments.outro') || 'outro'
      },
      interaction: {
        color: '#cc00ff',
        opacity: '0.7',
        name: t('sponsorblock.segments.interaction') || 'interaction reminder'
      },
      selfpromo: {
        color: '#ffff00',
        opacity: '0.7',
        name: t('sponsorblock.segments.selfpromo') || 'self-promotion'
      },
      preview: {
        color: '#008fd6',
        opacity: '0.7',
        name: t('sponsorblock.segments.preview') || 'recap or preview'
      },
      filler: {
        color: "#7300FF",
        opacity: "0.9",
        name: t('sponsorblock.segments.filler') || 'tangents'
      },
      music_offtopic: {
        color: '#ff9900',
        opacity: '0.7',
        name: t('sponsorblock.segments.music_offtopic') || 'non-music part'
      },
      poi_highlight: {
        color: '#9b044c',
        opacity: '0.7',
        name: t('sponsorblock.segments.poi_highlight') || 'highlight'
      }
    };

    const sponsorblockAPI = 'https://sponsor.ajay.app/api';

    class SponsorBlockHandler {
      video = null;
      active = true;

      attachVideoTimeout = null;
      nextSkipTimeout = null;
      sliderInterval = null;

      observer = null;
      scheduleSkipHandler = null;
      durationChangeHandler = null;
      segments = null;
      skippableCategories = [];
      manualSkippableCategories = [];
      skippedCategories = new Map();

      constructor(videoID) {
        this.videoID = videoID;
      }

      async init() {
        try {
          const videoHash = sha256(this.videoID).substring(0, 4);
          const categories = [
            'sponsor',
            'intro',
            'outro',
            'interaction',
            'selfpromo',
            'preview',
            'filler',
            'music_offtopic',
            'poi_highlight'
          ];
          const resp = await fetch(
            `${sponsorblockAPI}/skipSegments/${videoHash}?categories=${encodeURIComponent(
          JSON.stringify(categories)
        )}`
          );
          if (!resp.ok) return;
          const results = await resp.json();

          if (!this.active) return;
          const result = results.find((v) => v.videoID === this.videoID);

          if (!result || !result.segments || !result.segments.length) {
            return;
          }

          this.segments = result.segments;
          this.manualSkippableCategories = configRead('sponsorBlockManualSkips');
          this.skippableCategories = this.getSkippableCategories();

          this.scheduleSkipHandler = () => {
            this.scheduleSkip();
          };
          this.durationChangeHandler = () => this.buildOverlay();

          this.attachVideo();
          this.buildOverlay();
        } catch (_) {}
      }

      getSkippableCategories() {
        const skippableCategories = [];
        if (configRead('enableSponsorBlockSponsor')) {
          skippableCategories.push('sponsor');
        }
        if (configRead('enableSponsorBlockIntro')) {
          skippableCategories.push('intro');
        }
        if (configRead('enableSponsorBlockOutro')) {
          skippableCategories.push('outro');
        }
        if (configRead('enableSponsorBlockInteraction')) {
          skippableCategories.push('interaction');
        }
        if (configRead('enableSponsorBlockSelfPromo')) {
          skippableCategories.push('selfpromo');
        }
        if (configRead('enableSponsorBlockPreview')) {
          skippableCategories.push('preview');
        }
        if (configRead('enableSponsorBlockFiller')) {
          skippableCategories.push('filler');
        }
        if (configRead('enableSponsorBlockMusicOfftopic')) {
          skippableCategories.push('music_offtopic');
        }
        return skippableCategories;
      }

      attachVideo() {
        clearTimeout(this.attachVideoTimeout);
        this.attachVideoTimeout = null;

        this.video = document.querySelector('video');
        if (!this.video) {
          this.attachVideoTimeout = setTimeout(() => this.attachVideo(), 250);
          return;
        }

        this.video.addEventListener('play', this.scheduleSkipHandler);
        this.video.addEventListener('pause', this.scheduleSkipHandler);
        this.video.addEventListener('timeupdate', this.scheduleSkipHandler);
        this.video.addEventListener('durationchange', this.durationChangeHandler);
      }

      buildOverlay() {
        if (this.segmentsoverlay) return;
        if (!this.video || !this.video.duration || !this.segments) return;

        const videoDuration = this.video.duration;
        const slider = document.querySelector('div[idomkey="slider"]');
        if (!slider) return setTimeout(() => this.buildOverlay(), 250);

        this.segmentsoverlay = document.createElement('div');

        this.segmentsoverlay.classList.add('ytLrProgressBarSlider', 'ytLrProgressBarSliderRectangularProgressBar');
        this.segmentsoverlay.style.setProperty('z-index', '10', 'important');
        this.segmentsoverlay.style.setProperty('background-color', 'rgba(0, 0, 0, 0)', 'important');
        this.segmentsoverlay.style.setProperty('width', '72rem', 'important');
        this.segmentsoverlay.style.setProperty('left', '4rem', 'important');
        const sliderRect = slider.getBoundingClientRect();
        if (!slider.classList.contains('ytLrProgressBarSlider')) {
          for (let i = 0; i < slider.classList.length; i++) {
            this.segmentsoverlay.classList.add(slider.classList[i]);
          }
          this.segmentsoverlay.style.setProperty('height', `${sliderRect.height}px`, 'important');
          this.segmentsoverlay.style.setProperty('bottom', `${sliderRect.bottom - sliderRect.top}px`, 'important');      
        }
        this.segments.forEach((segment) => {
          const [start, end] = segment.segment;
          const barType = barTypes[segment.category] || {
            color: 'blue',
            opacity: 0.7
          };

          const leftPercent = videoDuration ? (100.0 * start) / videoDuration : 0;
          const widthPercent = videoDuration ? (100.0 * (end - start)) / videoDuration : 0;

          const elm = document.createElement('div');
          elm.style.setProperty('background-color', barType.color, 'important');
          elm.style.setProperty('opacity', barType.opacity, 'important');
          elm.style.setProperty('height', '100%', 'important');
          elm.style.setProperty('width', `${segment.category === 'poi_highlight' ? 1 : widthPercent}%`, 'important');
          elm.style.setProperty('left', `${leftPercent}%`, 'important');
          elm.style.setProperty('position', 'absolute', 'important');
          this.segmentsoverlay.appendChild(elm);
        });

        this.observer = new MutationObserver((mutations) => {
          for (const m of mutations) {
            if (m.removedNodes) {
              for (const node of m.removedNodes) {
                if (node === this.segmentsoverlay && this.slider) {
                  this.slider.appendChild(this.segmentsoverlay);
                }
              }
            }

            const progressBar = document.querySelector('ytlr-progress-bar');
            if (progressBar && progressBar.getAttribute('hybridnavfocusable') === 'false') {
              this.segmentsoverlay.style.setProperty('display', 'none', 'important');
            } else {
              this.segmentsoverlay.style.setProperty('display', 'block', 'important');
            }
          }
        });

        this.sliderInterval = setInterval(() => {
          this.slider = document.querySelector('ytlr-redux-connect-ytlr-progress-bar');
          if (this.slider) {
            clearInterval(this.sliderInterval);
            this.sliderInterval = null;
            this.observer.observe(this.slider, {
              childList: true,
              subtree: false
            });
            this.slider.appendChild(this.segmentsoverlay);
          }
        }, 500);
      }

      scheduleSkip() {
        clearTimeout(this.nextSkipTimeout);
        this.nextSkipTimeout = null;

        if (!this.active || !this.video || this.video.paused || !this.segments) {
          return;
        }

        const currentTime = this.video.currentTime;
        const nextSegments = this.segments.filter(
          (seg) =>
            seg.segment[0] > currentTime - 0.3 &&
            seg.segment[1] > currentTime - 0.3
        );

        if (!nextSegments.length) {
          return;
        }

        nextSegments.sort((s1, s2) => s1.segment[0] - s2.segment[0]);

        const [segment] = nextSegments;
        const [start, end] = segment.segment;

        this.nextSkipTimeout = setTimeout(() => {
          if (!this.video || this.video.paused) {
            return;
          }
          if (!this.skippableCategories.includes(segment.category)) {
            return;
          }

          const skipName = barTypes[segment.category]?.name || segment.category;
          if (!this.manualSkippableCategories.includes(segment.category)) {
            const wasSkippedBefore = this.skippedCategories.get(segment.UUID);
            if (wasSkippedBefore) {
              wasSkippedBefore.count++;
              wasSkippedBefore.lastSkipped = Date.now();
              this.skippedCategories.set(segment.UUID, wasSkippedBefore);

              if (wasSkippedBefore.lastSkipped - wasSkippedBefore.firstSkipped < 1000) {
                if (!wasSkippedBefore.hasShownToast) {
                  if (configRead('enableSponsorBlockToasts')) {
                    showToast('SponsorBlock', t('sponsorblock.toasts.notSkipping', { segment: skipName, count: wasSkippedBefore.count }));
                  }
                  wasSkippedBefore.hasShownToast = true;
                  this.skippedCategories.set(segment.UUID, wasSkippedBefore);
                }
                return;
              }
            } else {
              this.skippedCategories.set(segment.UUID, {
                count: 1,
                firstSkipped: Date.now(),
                lastSkipped: Date.now(),
                hasShownToast: false
              });
            }
            if (configRead('enableSponsorBlockToasts')) {
              showToast('SponsorBlock', t('sponsorblock.toasts.skipping', { segment: skipName }));
            }
            if (this.video.duration - end < 1) {
              this.video.currentTime = Math.max(0, end - 1);
            } else {
              this.video.currentTime = end;
            }
            this.scheduleSkip();
          }
        }, Math.max(0, (start - this.video.currentTime) * 1000));
      }

      destroy() {
        this.active = false;

        if (this.nextSkipTimeout) {
          clearTimeout(this.nextSkipTimeout);
          this.nextSkipTimeout = null;
        }

        if (this.attachVideoTimeout) {
          clearTimeout(this.attachVideoTimeout);
          this.attachVideoTimeout = null;
        }

        if (this.sliderInterval) {
          clearInterval(this.sliderInterval);
          this.sliderInterval = null;
        }

        if (this.observer) {
          this.observer.disconnect();
          this.observer = null;
        }

        if (this.segmentsoverlay) {
          this.segmentsoverlay.remove();
          this.segmentsoverlay = null;
        }

        if (this.video) {
          this.video.removeEventListener('play', this.scheduleSkipHandler);
          this.video.removeEventListener('pause', this.scheduleSkipHandler);
          this.video.removeEventListener('timeupdate', this.scheduleSkipHandler);
          this.video.removeEventListener(
            'durationchange',
            this.durationChangeHandler
          );
        }

        this.skippedCategories.clear();
      }
    }

    window.sponsorblock = null;

    window.addEventListener(
      'hashchange',
      () => {
        const hash = location.hash ? location.hash.substring(1) : '';
        const newURL = new URL(hash, location.href);
        const videoID = newURL.search.replace('?v=', '').split('&')[0];
        const needsReload =
          videoID &&
          (!window.sponsorblock || window.sponsorblock.videoID !== videoID);

        if (needsReload) {
          if (window.sponsorblock) {
            try {
              window.sponsorblock.destroy();
            } catch (_) {}
            window.sponsorblock = null;
          }

          if (configRead('enableSponsorBlock')) {
            window.sponsorblock = new SponsorBlockHandler(videoID);
            window.sponsorblock.init();
          }
        }
      },
      false
    );

    //
    // https://raw.githubusercontent.com/WICG/spatial-navigation/183f0146b6741007e46fa64ab0950447defdf8af/polyfill/spatial-navigation-polyfill.js
    // License: MIT
    //

    /* Spatial Navigation Polyfill
     *
     * It follows W3C official specification
     * https://drafts.csswg.org/css-nav-1/
     *
     * Copyright (c) 2018-2019 LG Electronics Inc.
     * https://github.com/WICG/spatial-navigation/polyfill
     *
     * Licensed under the MIT license (MIT)
     */

    (function () {

      // The polyfill must not be executed, if it's already enabled via browser engine or browser extensions.
      if ('navigate' in window) {
        return;
      }

      const ARROW_KEY_CODE = {37: 'left', 38: 'up', 39: 'right', 40: 'down'};
      const TAB_KEY_CODE = 9;
      let mapOfBoundRect = null;
      let startingPoint = null; // Saves spatial navigation starting point
      let savedSearchOrigin = {element: null, rect: null};  // Saves previous search origin
      let searchOriginRect = null;  // Rect of current search origin

      /**
       * Initiate the spatial navigation features of the polyfill.
       * @function initiateSpatialNavigation
       */
      function initiateSpatialNavigation() {
        /*
         * Bind the standards APIs to be exposed to the window object for authors
         */
        window.navigate = navigate;
        window.Element.prototype.spatialNavigationSearch = spatialNavigationSearch;
        window.Element.prototype.focusableAreas = focusableAreas;
        window.Element.prototype.getSpatialNavigationContainer = getSpatialNavigationContainer;

        /*
         * CSS.registerProperty() from the Properties and Values API
         * Reference: https://drafts.css-houdini.org/css-properties-values-api/#the-registerproperty-function
         */
        if (window.CSS && CSS.registerProperty) {
          if (window.getComputedStyle(document.documentElement).getPropertyValue('--spatial-navigation-contain') === '') {
            CSS.registerProperty({
              name: '--spatial-navigation-contain',
              syntax: 'auto | contain',
              inherits: false,
              initialValue: 'auto'
            });
          }

          if (window.getComputedStyle(document.documentElement).getPropertyValue('--spatial-navigation-action') === '') {
            CSS.registerProperty({
              name: '--spatial-navigation-action',
              syntax: 'auto | focus | scroll',
              inherits: false,
              initialValue: 'auto'
            });
          }

          if (window.getComputedStyle(document.documentElement).getPropertyValue('--spatial-navigation-function') === '') {
            CSS.registerProperty({
              name: '--spatial-navigation-function',
              syntax: 'normal | grid',
              inherits: false,
              initialValue: 'normal'
            });
          }
        }
      }

      /**
       * Add event handlers for the spatial navigation behavior.
       * This function defines which input methods trigger the spatial navigation behavior.
       * @function spatialNavigationHandler
       */
      function spatialNavigationHandler() {
        /*
         * keydown EventListener :
         * If arrow key pressed, get the next focusing element and send it to focusing controller
         */
        window.addEventListener('keydown', (e) => {
          const currentKeyMode = (parent && parent.__spatialNavigation__.keyMode) || window.__spatialNavigation__.keyMode;
          const eventTarget = document.activeElement;
          const dir = ARROW_KEY_CODE[e.keyCode];

          if (e.keyCode === TAB_KEY_CODE) {
            startingPoint = null;
          }

          if (!currentKeyMode ||
              (currentKeyMode === 'NONE') ||
              ((currentKeyMode === 'SHIFTARROW') && !e.shiftKey) ||
              ((currentKeyMode === 'ARROW') && e.shiftKey))
            return;

          if (!e.defaultPrevented) {
            let focusNavigableArrowKey = {left: true, up: true, right: true, down: true};

            // Edge case (text input, area) : Don't move focus, just navigate cursor in text area
            if ((eventTarget.nodeName === 'INPUT') || eventTarget.nodeName === 'TEXTAREA') {
              focusNavigableArrowKey = handlingEditableElement(e);
            }

            if (focusNavigableArrowKey[dir]) {
              e.preventDefault();
              mapOfBoundRect = new Map();

              navigate(dir);

              mapOfBoundRect = null;
              startingPoint = null;
            }
          }
        });

        /*
         * mouseup EventListener :
         * If the mouse click a point in the page, the point will be the starting point.
         * NOTE: Let UA set the spatial navigation starting point based on click
         */
        document.addEventListener('mouseup', (e) => {
          startingPoint = {x: e.clientX, y: e.clientY};
        });

        /*
         * focusin EventListener :
         * When the element get the focus, save it and its DOMRect for resetting the search origin
         * if it disappears.
         */
        window.addEventListener('focusin', (e) => {
          if (e.target !== window) {
            savedSearchOrigin.element = e.target;
            savedSearchOrigin.rect = e.target.getBoundingClientRect();
          }
        });
      }

      /**
       * Enable the author to trigger spatial navigation programmatically, as if the user had done so manually.
       * @see {@link https://drafts.csswg.org/css-nav-1/#dom-window-navigate}
       * @function navigate
       * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
       */
      function navigate(dir) {
        // spatial navigation steps

        // 1
        const searchOrigin = findSearchOrigin();
        let eventTarget = searchOrigin;

        let elementFromPosition = null;

        // 2 Optional step, UA defined starting point
        if (startingPoint) {
          // if there is a starting point, set eventTarget as the element from position for getting the spatnav container
          elementFromPosition = document.elementFromPoint(startingPoint.x, startingPoint.y);

          // Use starting point if the starting point isn't inside the focusable element (but not container)
          // * Starting point is meaningfull when:
          // 1) starting point is inside the spatnav container
          // 2) starting point is inside the non-focusable element
          if (elementFromPosition === null) {
            elementFromPosition = document.body;
          }
          if (isFocusable(elementFromPosition) && !isContainer(elementFromPosition)) {
            startingPoint = null;
          } else if (isContainer(elementFromPosition)) {
            eventTarget = elementFromPosition;
          } else {
            eventTarget = elementFromPosition.getSpatialNavigationContainer();
          }
        }

        // 4
        if (eventTarget === document || eventTarget === document.documentElement) {
          eventTarget = document.body || document.documentElement;
        }

        // 5
        // At this point, spatialNavigationSearch can be applied.
        // If startingPoint is either a scroll container or the document,
        // find the best candidate within startingPoint
        let container = null;
        if ((isContainer(eventTarget) || eventTarget.nodeName === 'BODY') && !(eventTarget.nodeName === 'INPUT')) {
          if (eventTarget.nodeName === 'IFRAME') {
            eventTarget = eventTarget.contentDocument.documentElement;
          }
          container = eventTarget;
          let bestInsideCandidate = null;

          // 5-2
          if ((document.activeElement === searchOrigin) || 
              (document.activeElement === document.body) && (searchOrigin === document.documentElement)) {
            if (getCSSSpatNavAction(eventTarget) === 'scroll') {
              if (scrollingController(eventTarget, dir)) return;
            } else if (getCSSSpatNavAction(eventTarget) === 'focus') {
              bestInsideCandidate = eventTarget.spatialNavigationSearch(dir, {container: eventTarget, candidates: getSpatialNavigationCandidates(eventTarget, {mode: 'all'})});
              if (focusingController(bestInsideCandidate, dir)) return;
            } else if (getCSSSpatNavAction(eventTarget) === 'auto') {
              bestInsideCandidate = eventTarget.spatialNavigationSearch(dir, {container: eventTarget});
              if (focusingController(bestInsideCandidate, dir) || scrollingController(eventTarget, dir)) return;
            }
          } else {
            // when the previous search origin became offscreen
            container = container.getSpatialNavigationContainer();
          }
        }

        // 6
        // Let container be the nearest ancestor of eventTarget
        container = eventTarget.getSpatialNavigationContainer();
        let parentContainer = (container.parentElement) ? container.getSpatialNavigationContainer() : null;

        // When the container is the viewport of a browsing context
        if (!parentContainer && ( window.location !== window.parent.location)) {
          parentContainer = window.parent.document.documentElement;
        }

        if (getCSSSpatNavAction(container) === 'scroll') {
          if (scrollingController(container, dir)) return;
        } else if (getCSSSpatNavAction(container) === 'focus') {
          navigateChain(eventTarget, container, parentContainer, dir, 'all');
        } else if (getCSSSpatNavAction(container) === 'auto') {
          navigateChain(eventTarget, container, parentContainer, dir, 'visible');
        }
      }

      /**
       * Move the focus to the best candidate or do nothing.
       * @function focusingController
       * @param bestCandidate {Node} - The best candidate of the spatial navigation
       * @param dir {SpatialNavigationDirection}- The directional information for the spatial navigation (e.g. LRUD)
       * @returns {boolean}
       */
      function focusingController(bestCandidate, dir) {
        // 10 & 11
        // When bestCandidate is found
        if (bestCandidate) {
          // When bestCandidate is a focusable element and not a container : move focus
          /*
           * [event] navbeforefocus : Fired before spatial or sequential navigation changes the focus.
           */
          if (!createSpatNavEvents('beforefocus', bestCandidate, null, dir)) 
            return true;

          const container = bestCandidate.getSpatialNavigationContainer();

          if ((container !== window) && (getCSSSpatNavAction(container) === 'focus')) {
            bestCandidate.focus();
          } else {
            bestCandidate.focus({preventScroll: true});
          }

          startingPoint = null;
          return true;
        }

        // When bestCandidate is not found within the scrollport of a container: Nothing
        return false;
      }

      /**
       * Directionally scroll the scrollable spatial navigation container if it can be manually scrolled more.
       * @function scrollingController
       * @param container {Node} - The spatial navigation container which can scroll
       * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
       * @returns {boolean}
       */
      function scrollingController(container, dir) {

        // If there is any scrollable area among parent elements and it can be manually scrolled, scroll the document
        if (isScrollable(container, dir) && !isScrollBoundary(container, dir)) {
          moveScroll(container, dir);
          return true;
        }

        // If the spatnav container is document and it can be scrolled, scroll the document
        if (!container.parentElement && !isHTMLScrollBoundary(container, dir)) {
          moveScroll(container.ownerDocument.documentElement, dir);
          return true;
        }
        return false;
      }

      /**
       * Find the candidates within a spatial navigation container include delegable container.
       * This function does not search inside delegable container or focusable container.
       * In other words, this return candidates set is not included focusable elements inside delegable container or focusable container.
       *
       * @function getSpatialNavigationCandidates
       * @param container {Node} - The spatial navigation container
       * @param option {FocusableAreasOptions} - 'mode' attribute takes 'visible' or 'all' for searching the boundary of focusable elements.
       *                                          Default value is 'visible'.
       * @returns {sequence<Node>} candidate elements within the container
       */
      function getSpatialNavigationCandidates (container, option = {mode: 'visible'}) {
        let candidates = [];

        if (container.childElementCount > 0) {
          if (!container.parentElement) {
            container = container.getElementsByTagName('body')[0] || document.body;
          }
          const children = container.children;
          for (const elem of children) {
            if (isDelegableContainer(elem)) {
              candidates.push(elem);
            } else if (isFocusable(elem)) {
              candidates.push(elem);

              if (!isContainer(elem) && elem.childElementCount) {
                candidates = candidates.concat(getSpatialNavigationCandidates(elem, {mode: 'all'}));
              }
            } else if (elem.childElementCount) {
              candidates = candidates.concat(getSpatialNavigationCandidates(elem, {mode: 'all'}));
            }
          }
        }
        return (option.mode === 'all') ? candidates : candidates.filter(isVisible);
      }

      /**
       * Find the candidates among focusable elements within a spatial navigation container from the search origin (currently focused element)
       * depending on the directional information.
       * @function getFilteredSpatialNavigationCandidates
       * @param element {Node} - The currently focused element which is defined as 'search origin' in the spec
       * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
       * @param candidates {sequence<Node>} - The candidates for spatial navigation without the directional information
       * @param container {Node} - The spatial navigation container
       * @returns {Node} The candidates for spatial navigation considering the directional information
       */
      function getFilteredSpatialNavigationCandidates (element, dir, candidates, container) {
        const targetElement = element;
        // Removed below line due to a bug. (iframe body rect is sometime weird.)
        // const targetElement = (element.nodeName === 'IFRAME') ? element.contentDocument.body : element;
        // If the container is unknown, get the closest container from the element
        container = container || targetElement.getSpatialNavigationContainer();

        // If the candidates is unknown, find candidates
        // 5-1
        candidates = (!candidates || candidates.length <= 0) ? getSpatialNavigationCandidates(container) : candidates;
        return filteredCandidates(targetElement, candidates, dir, container);
      }

      /**
       * Find the best candidate among the candidates within the container from the search origin (currently focused element)
       * @see {@link https://drafts.csswg.org/css-nav-1/#dom-element-spatialnavigationsearch}
       * @function spatialNavigationSearch
       * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
       * @param candidates {sequence<Node>} - The candidates for spatial navigation
       * @param container {Node} - The spatial navigation container
       * @returns {Node} The best candidate which will gain the focus
       */
      function spatialNavigationSearch (dir, args) {
        const targetElement = this;
        let internalCandidates = [];
        let externalCandidates = [];
        let insideOverlappedCandidates = getOverlappedCandidates(targetElement);
        let bestTarget;

        // Set default parameter value
        if (!args)
          args = {};

        const defaultContainer = targetElement.getSpatialNavigationContainer();
        let defaultCandidates = getSpatialNavigationCandidates(defaultContainer);
        const container = args.container || defaultContainer;
        if (args.container && (defaultContainer.contains(args.container))) {
          defaultCandidates = defaultCandidates.concat(getSpatialNavigationCandidates(container));
        }
        const candidates = (args.candidates && args.candidates.length > 0) ? 
                              args.candidates.filter((candidate) => container.contains(candidate)) : 
                              defaultCandidates.filter((candidate) => container.contains(candidate) && (container !== candidate));

        // Find the best candidate
        // 5
        // If startingPoint is either a scroll container or the document,
        // find the best candidate within startingPoint
        if (candidates && candidates.length > 0) {

          // Divide internal or external candidates
          candidates.forEach(candidate => {
            if (candidate !== targetElement) {
              (targetElement.contains(candidate) && targetElement !== candidate ? internalCandidates : externalCandidates).push(candidate);
            }
          });

          // include overlapped element to the internalCandidates
          let fullyOverlapped = insideOverlappedCandidates.filter(candidate => !internalCandidates.includes(candidate));
          let overlappedContainer = candidates.filter(candidate => (isContainer(candidate) && isEntirelyVisible(targetElement, candidate)));
          let overlappedByParent = overlappedContainer.map((elm) => elm.focusableAreas()).flat().filter(candidate => candidate !== targetElement);
          
          internalCandidates = internalCandidates.concat(fullyOverlapped).filter((candidate) => container.contains(candidate));
          externalCandidates = externalCandidates.concat(overlappedByParent).filter((candidate) => container.contains(candidate));

          // Filter external Candidates
          if (externalCandidates.length > 0) {
            externalCandidates = getFilteredSpatialNavigationCandidates(targetElement, dir, externalCandidates, container);
          }
          
          // If there isn't search origin element but search orgin rect exist  (search origin isn't in the layout case)
          if (searchOriginRect) {
            bestTarget = selectBestCandidate(targetElement, getFilteredSpatialNavigationCandidates(targetElement, dir, internalCandidates, container), dir);
          }

          if ((internalCandidates && internalCandidates.length > 0) && !(targetElement.nodeName === 'INPUT')) {
            bestTarget = selectBestCandidateFromEdge(targetElement, internalCandidates, dir);
          }

          bestTarget = bestTarget || selectBestCandidate(targetElement, externalCandidates, dir);

          if (bestTarget && isDelegableContainer(bestTarget)) {
            // if best target is delegable container, then find descendants candidate inside delegable container.
            const innerTarget = getSpatialNavigationCandidates(bestTarget, {mode: 'all'});
            const descendantsBest = innerTarget.length > 0 ? targetElement.spatialNavigationSearch(dir, {candidates: innerTarget, container: bestTarget}) : null;
            if (descendantsBest) {
              bestTarget = descendantsBest;
            } else if (!isFocusable(bestTarget)) {
              // if there is no target inside bestTarget and delegable container is not focusable,
              // then try to find another best target without curren best target.
              candidates.splice(candidates.indexOf(bestTarget), 1);
              bestTarget = candidates.length ? targetElement.spatialNavigationSearch(dir, {candidates: candidates, container: container}) : null;
            }
          }
          return bestTarget;
        }

        return null;
      }

      /**
       * Get the filtered candidate among candidates.
       * @see {@link https://drafts.csswg.org/css-nav-1/#select-the-best-candidate}
       * @function filteredCandidates
       * @param currentElm {Node} - The currently focused element which is defined as 'search origin' in the spec
       * @param candidates {sequence<Node>} - The candidates for spatial navigation
       * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
       * @param container {Node} - The spatial navigation container
       * @returns {sequence<Node>} The filtered candidates which are not the search origin and not in the given spatial navigation direction from the search origin
       */
      // TODO: Need to fix filtering the candidates with more clean code
      function filteredCandidates(currentElm, candidates, dir, container) {
        const originalContainer = currentElm.getSpatialNavigationContainer();
        let eventTargetRect;

        // If D(dir) is null, let candidates be the same as visibles
        if (dir === undefined)
          return candidates;

        // Offscreen handling when originalContainer is not <HTML>
        if (originalContainer.parentElement && container !== originalContainer && !isVisible(currentElm)) {
          eventTargetRect = getBoundingClientRect(originalContainer);
        } else {
          eventTargetRect = searchOriginRect || getBoundingClientRect(currentElm);
        }

        /*
         * Else, let candidates be the subset of the elements in visibles
         * whose principal box’s geometric center is within the closed half plane
         * whose boundary goes through the geometric center of starting point and is perpendicular to D.
         */
        if ((isContainer(currentElm) || currentElm.nodeName === 'BODY') && !(currentElm.nodeName === 'INPUT')) {
          return candidates.filter(candidate => {
            const candidateRect = getBoundingClientRect(candidate);
            return container.contains(candidate) &&
              ((currentElm.contains(candidate) && isInside(eventTargetRect, candidateRect) && candidate !== currentElm) ||
              isOutside(candidateRect, eventTargetRect, dir));
          });
        } else {
          return candidates.filter(candidate => {
            const candidateRect = getBoundingClientRect(candidate);
            const candidateBody = (candidate.nodeName === 'IFRAME') ? candidate.contentDocument.body : null;
            return container.contains(candidate) &&
              candidate !== currentElm && candidateBody !== currentElm &&
              isOutside(candidateRect, eventTargetRect, dir) &&
              !isInside(eventTargetRect, candidateRect);
          });
        }
      }

      /**
       * Select the best candidate among given candidates.
       * @see {@link https://drafts.csswg.org/css-nav-1/#select-the-best-candidate}
       * @function selectBestCandidate
       * @param currentElm {Node} - The currently focused element which is defined as 'search origin' in the spec
       * @param candidates {sequence<Node>} - The candidates for spatial navigation
       * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
       * @returns {Node} The best candidate which will gain the focus
       */
      function selectBestCandidate(currentElm, candidates, dir) {
        const container = currentElm.getSpatialNavigationContainer();
        const spatialNavigationFunction = getComputedStyle(container).getPropertyValue('--spatial-navigation-function');
        const currentTargetRect = searchOriginRect || getBoundingClientRect(currentElm);
        let distanceFunction;
        let alignedCandidates;

        switch (spatialNavigationFunction) {
        case 'grid':
          alignedCandidates = candidates.filter(elm => isAligned(currentTargetRect, getBoundingClientRect(elm), dir));
          if (alignedCandidates.length > 0) {
            candidates = alignedCandidates;
          }
          distanceFunction = getAbsoluteDistance;
          break;
        default:
          distanceFunction = getDistance;
          break;
        }
        return getClosestElement(currentElm, candidates, dir, distanceFunction);
      }

      /**
       * Select the best candidate among candidates by finding the closet candidate from the edge of the currently focused element (search origin).
       * @see {@link https://drafts.csswg.org/css-nav-1/#select-the-best-candidate (Step 5)}
       * @function selectBestCandidateFromEdge
       * @param currentElm {Node} - The currently focused element which is defined as 'search origin' in the spec
       * @param candidates {sequence<Node>} - The candidates for spatial navigation
       * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
       * @returns {Node} The best candidate which will gain the focus
       */
      function selectBestCandidateFromEdge(currentElm, candidates, dir) {
        if (startingPoint)
          return getClosestElement(currentElm, candidates, dir, getDistanceFromPoint);
        else
          return getClosestElement(currentElm, candidates, dir, getInnerDistance);
      }

      /**
       * Select the closest candidate from the currently focused element (search origin) among candidates by using the distance function.
       * @function getClosestElement
       * @param currentElm {Node} - The currently focused element which is defined as 'search origin' in the spec
       * @param candidates {sequence<Node>} - The candidates for spatial navigation
       * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
       * @param distanceFunction {function} - The distance function which measures the distance from the search origin to each candidate
       * @returns {Node} The candidate which is the closest one from the search origin
       */
      function getClosestElement(currentElm, candidates, dir, distanceFunction) {
        let eventTargetRect = null;
        if (( window.location !== window.parent.location ) && (currentElm.nodeName === 'BODY' || currentElm.nodeName === 'HTML')) {
          // If the eventTarget is iframe, then get rect of it based on its containing document
          // Set the iframe's position as (0,0) because the rects of elements inside the iframe don't know the real iframe's position.
          eventTargetRect = window.frameElement.getBoundingClientRect();
          eventTargetRect.x = 0;
          eventTargetRect.y = 0;
        } else {
          eventTargetRect = searchOriginRect || currentElm.getBoundingClientRect();
        }

        let minDistance = Number.POSITIVE_INFINITY;
        let minDistanceElements = [];

        if (candidates) {
          for (let i = 0; i < candidates.length; i++) {
            const distance = distanceFunction(eventTargetRect, getBoundingClientRect(candidates[i]), dir);

            // If the same distance, the candidate will be selected in the DOM order
            if (distance < minDistance) {
              minDistance = distance;
              minDistanceElements = [candidates[i]];
            } else if (distance === minDistance) {
              minDistanceElements.push(candidates[i]);
            }
          }
        }
        if (minDistanceElements.length === 0)
          return null;

        return (minDistanceElements.length > 1 && distanceFunction === getAbsoluteDistance) ?
          getClosestElement(currentElm, minDistanceElements, dir, getEuclideanDistance) : minDistanceElements[0];
      }

      /**
       * Get container of an element.
       * @see {@link https://drafts.csswg.org/css-nav-1/#dom-element-getspatialnavigationcontainer}
       * @module Element
       * @function getSpatialNavigationContainer
       * @returns {Node} The spatial navigation container
       */
      function getSpatialNavigationContainer() {
        let container = this;

        do {
          if (!container.parentElement) {
            if (window.location !== window.parent.location) {
              container = window.parent.document.documentElement;
            } else {
              container = window.document.documentElement;
            }
            break;
          } else {
            container = container.parentElement;
          }
        } while (!isContainer(container));
        return container;
      }

      /**
       * Get nearest scroll container of an element.
       * @function getScrollContainer
       * @param Element
       * @returns {Node} The spatial navigation container
       */
      function getScrollContainer(element) {
        let scrollContainer = element;

        do {
          if (!scrollContainer.parentElement) {
            if (window.location !== window.parent.location) {
              scrollContainer = window.parent.document.documentElement;
            } else {
              scrollContainer = window.document.documentElement;
            }
            break;
          } else {
            scrollContainer = scrollContainer.parentElement;
          }
        } while (!isScrollContainer(scrollContainer) || !isVisible(scrollContainer));

        if (scrollContainer === document || scrollContainer === document.documentElement) {
          scrollContainer = window;
        }
      
        return scrollContainer;
      }

      /**
       * Find focusable elements within the spatial navigation container.
       * @see {@link https://drafts.csswg.org/css-nav-1/#dom-element-focusableareas}
       * @function focusableAreas
       * @param option {FocusableAreasOptions} - 'mode' attribute takes 'visible' or 'all' for searching the boundary of focusable elements.
       *                                          Default value is 'visible'.
       * @returns {sequence<Node>} All focusable elements or only visible focusable elements within the container
       */
      function focusableAreas(option = {mode: 'visible'}) {
        const container = this.parentElement ? this : document.body;
        const focusables = Array.prototype.filter.call(container.getElementsByTagName('*'), isFocusable);
        return (option.mode === 'all') ? focusables : focusables.filter(isVisible);
      }

      /**
       * Create the NavigationEvent: navbeforefocus, navnotarget
       * @see {@link https://drafts.csswg.org/css-nav-1/#events-navigationevent}
       * @function createSpatNavEvents
       * @param option {string} - Type of the navigation event (beforefocus, notarget)
       * @param element {Node} - The target element of the event
       * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
       */
      function createSpatNavEvents(eventType, containerElement, currentElement, direction) {
        if (['beforefocus', 'notarget'].includes(eventType)) {
          const data = {
            causedTarget: currentElement,
            dir: direction
          };
          const triggeredEvent = new CustomEvent('nav' + eventType, {bubbles: true, cancelable: true, detail: data});
          return containerElement.dispatchEvent(triggeredEvent);
        }
      }

      /**
       * Get the value of the CSS custom property of the element
       * @function readCssVar
       * @param element {Node}
       * @param varName {string} - The name of the css custom property without '--'
       * @returns {string} The value of the css custom property
       */
      function readCssVar(element, varName) {
        // 20210606 fix getPropertyValue returning null ~inf
        return (element.style.getPropertyValue(`--${varName}`) || '').trim();
      }

      /**
       * Decide whether or not the 'contain' value is given to 'spatial-navigation-contain' css property of an element
       * @function isCSSSpatNavContain
       * @param element {Node}
       * @returns {boolean}
       */
      function isCSSSpatNavContain(element) {
        return readCssVar(element, 'spatial-navigation-contain') === 'contain';
      }

      /**
       * Return the value of 'spatial-navigation-action' css property of an element
       * @function getCSSSpatNavAction
       * @param element {Node} - would be the spatial navigation container
       * @returns {string} auto | focus | scroll
       */
      function getCSSSpatNavAction(element) {
        return readCssVar(element, 'spatial-navigation-action') || 'auto';
      }

      /**
       * Only move the focus with spatial navigation. Manually scrolling isn't available.
       * @function navigateChain
       * @param eventTarget {Node} - currently focused element
       * @param container {SpatialNavigationContainer} - container
       * @param parentContainer {SpatialNavigationContainer} - parent container
       * @param option - visible || all
       * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
       */
      function navigateChain(eventTarget, container, parentContainer, dir, option) {
        let currentOption = {candidates: getSpatialNavigationCandidates(container, {mode: option}), container};

        while (parentContainer) {
          if (focusingController(eventTarget.spatialNavigationSearch(dir, currentOption), dir)) {
            return;
          } else {
            if ((option === 'visible') && scrollingController(container, dir)) return;
            else {
              if (!createSpatNavEvents('notarget', container, eventTarget, dir)) return;

              // find the container
              if (container === document || container === document.documentElement) {
                if ( window.location !== window.parent.location ) {
                  // The page is in an iframe. eventTarget needs to be reset because the position of the element in the iframe
                  eventTarget = window.frameElement;
                  container = eventTarget.ownerDocument.documentElement;              
                }
              } else {
                container = parentContainer;
              }
              currentOption = {candidates: getSpatialNavigationCandidates(container, {mode: option}), container};
              let nextContainer = container.getSpatialNavigationContainer();

              if (nextContainer !== container) {
                parentContainer = nextContainer;
              } else {
                parentContainer = null;
              }
            }
          }
        }

        currentOption = {candidates: getSpatialNavigationCandidates(container, {mode: option}), container};

        // Behavior after 'navnotarget' - Getting out from the current spatnav container
        if ((!parentContainer && container) && focusingController(eventTarget.spatialNavigationSearch(dir, currentOption), dir)) return;

        if (!createSpatNavEvents('notarget', currentOption.container, eventTarget, dir)) return;

        if ((getCSSSpatNavAction(container) === 'auto') && (option === 'visible')) {
          if (scrollingController(container, dir)) return;
        }
      }

      /**
       * Find search origin
       * @see {@link https://drafts.csswg.org/css-nav-1/#nav}
       * @function findSearchOrigin
       * @returns {Node} The search origin for the spatial navigation
       */
      function findSearchOrigin() {
        let searchOrigin = document.activeElement;

        if (!searchOrigin || (searchOrigin === document.body && !document.querySelector(':focus'))) {
          // When the previous search origin lost its focus by blur: (1) disable attribute (2) visibility: hidden
          if (savedSearchOrigin.element && (searchOrigin !== savedSearchOrigin.element)) {
            const elementStyle = window.getComputedStyle(savedSearchOrigin.element, null);
            const invisibleStyle = ['hidden', 'collapse'];

            if (savedSearchOrigin.element.disabled || invisibleStyle.includes(elementStyle.getPropertyValue('visibility'))) {
              searchOrigin = savedSearchOrigin.element;
              return searchOrigin;
            }
          }
          searchOrigin = document.documentElement;
        }
        // When the previous search origin lost its focus by blur: (1) display:none () element size turned into zero
        if (savedSearchOrigin.element &&
          ((getBoundingClientRect(savedSearchOrigin.element).height === 0) || (getBoundingClientRect(savedSearchOrigin.element).width === 0))) {
          searchOriginRect = savedSearchOrigin.rect;
        }
        
        if (!isVisibleInScroller(searchOrigin)) {
          const scroller = getScrollContainer(searchOrigin);
          if (scroller && ((scroller === window) || (getCSSSpatNavAction(scroller) === 'auto')))
            return scroller;
        }
        return searchOrigin;
      }

      /**
       * Move the scroll of an element depending on the given spatial navigation directrion
       * (Assume that User Agent defined distance is '40px')
       * @see {@link https://drafts.csswg.org/css-nav-1/#directionally-scroll-an-element}
       * @function moveScroll
       * @param element {Node} - The scrollable element
       * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
       * @param offset {Number} - The explicit amount of offset for scrolling. Default value is 0.
       */
      function moveScroll(element, dir, offset = 0) {
        if (element) {
          switch (dir) {
          case 'left': element.scrollLeft -= (40 + offset); break;
          case 'right': element.scrollLeft += (40 + offset); break;
          case 'up': element.scrollTop -= (40 + offset); break;
          case 'down': element.scrollTop += (40 + offset); break;
          }
        }
      }

      /**
       * Decide whether an element is container or not.
       * @function isContainer
       * @param element {Node} element
       * @returns {boolean}
       */
      function isContainer(element) {
        return (!element.parentElement) ||
                (element.nodeName === 'IFRAME') ||
                (isScrollContainer(element)) ||
                (isCSSSpatNavContain(element));
      }

      /**
       * Decide whether an element is delegable container or not.
       * NOTE: THIS IS NON-NORMATIVE API. 
       * @function isDelegableContainer
       * @param element {Node} element
       * @returns {boolean}
       */
      function isDelegableContainer(element) {
        return readCssVar(element, 'spatial-navigation-contain') === 'delegable';
      }

      /**
       * Decide whether an element is a scrollable container or not.
       * @see {@link https://drafts.csswg.org/css-overflow-3/#scroll-container}
       * @function isScrollContainer
       * @param element {Node}
       * @returns {boolean}
       */
      function isScrollContainer(element) {
        const elementStyle = window.getComputedStyle(element, null);
        const overflowX = elementStyle.getPropertyValue('overflow-x');
        const overflowY = elementStyle.getPropertyValue('overflow-y');

        return ((overflowX !== 'visible' && overflowX !== 'clip' && isOverflow(element, 'left')) ||
              (overflowY !== 'visible' && overflowY !== 'clip' && isOverflow(element, 'down'))) ?
               true : false;
      }

      /**
       * Decide whether this element is scrollable or not.
       * NOTE: If the value of 'overflow' is given to either 'visible', 'clip', or 'hidden', the element isn't scrollable.
       *       If the value is 'hidden', the element can be only programmically scrollable. (https://drafts.csswg.org/css-overflow-3/#valdef-overflow-hidden)
       * @function isScrollable
       * @param element {Node}
       * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
       * @returns {boolean}
       */
      function isScrollable(element, dir) { // element, dir
        if (element && typeof element === 'object') {
          if (dir && typeof dir === 'string') { // parameter: dir, element
            if (isOverflow(element, dir)) {
              // style property
              const elementStyle = window.getComputedStyle(element, null);
              const overflowX = elementStyle.getPropertyValue('overflow-x');
              const overflowY = elementStyle.getPropertyValue('overflow-y');

              switch (dir) {
              case 'left':
                /* falls through */
              case 'right':
                return (overflowX !== 'visible' && overflowX !== 'clip' && overflowX !== 'hidden');
              case 'up':
                /* falls through */
              case 'down':
                return (overflowY !== 'visible' && overflowY !== 'clip' && overflowY !== 'hidden');
              }
            }
            return false;
          } else { // parameter: element
            return (element.nodeName === 'HTML' || element.nodeName === 'BODY') ||
                    (isScrollContainer(element) && isOverflow(element));
          }
        }
      }

      /**
       * Decide whether an element is overflow or not.
       * @function isOverflow
       * @param element {Node}
       * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
       * @returns {boolean}
       */
      function isOverflow(element, dir) {
        if (element && typeof element === 'object') {
          if (dir && typeof dir === 'string') { // parameter: element, dir
            switch (dir) {
            case 'left':
              /* falls through */
            case 'right':
              return (element.scrollWidth > element.clientWidth);
            case 'up':
              /* falls through */
            case 'down':
              return (element.scrollHeight > element.clientHeight);
            }
          } else { // parameter: element
            return (element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight);
          }
          return false;
        }
      }

      /**
       * Decide whether the scrollbar of the browsing context reaches to the end or not.
       * @function isHTMLScrollBoundary
       * @param element {Node} - The top browsing context
       * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
       * @returns {boolean}
       */
      function isHTMLScrollBoundary(element, dir) {
        let result = false;
        switch (dir) {
        case 'left':
          result = element.scrollLeft === 0;
          break;
        case 'right':
          result = (element.scrollWidth - element.scrollLeft - element.clientWidth) === 0;
          break;
        case 'up':
          result = element.scrollTop === 0;
          break;
        case 'down':
          result = (element.scrollHeight - element.scrollTop - element.clientHeight) === 0;
          break;
        }
        return result;
      }

      /**
       * Decide whether the scrollbar of an element reaches to the end or not.
       * @function isScrollBoundary
       * @param element {Node}
       * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
       * @returns {boolean}
       */
      function isScrollBoundary(element, dir) {
        if (isScrollable(element, dir)) {
          const winScrollY = element.scrollTop;
          const winScrollX = element.scrollLeft;

          const height = element.scrollHeight - element.clientHeight;
          const width = element.scrollWidth - element.clientWidth;

          switch (dir) {
          case 'left': return (winScrollX === 0);
          case 'right': return (Math.abs(winScrollX - width) <= 1);
          case 'up': return (winScrollY === 0);
          case 'down': return (Math.abs(winScrollY - height) <= 1);
          }
        }
        return false;
      }

      /**
       * Decide whether an element is inside the scorller viewport or not
       *
       * @function isVisibleInScroller
       * @param element {Node}
       * @returns {boolean}
       */
      function isVisibleInScroller(element) {
        const elementRect = element.getBoundingClientRect();
        let nearestScroller = getScrollContainer(element);

        let scrollerRect = null;
        if (nearestScroller !== window) {
          scrollerRect = getBoundingClientRect(nearestScroller);
        } else {
          scrollerRect = new DOMRect(0, 0, window.innerWidth, window.innerHeight);
        }
       
        if (isInside(scrollerRect, elementRect) && isInside(scrollerRect, elementRect))
          return true; 
        else
          return false;
      }

      /**
       * Decide whether an element is focusable for spatial navigation.
       * 1. If element is the browsing context (document, iframe), then it's focusable,
       * 2. If the element is scrollable container (regardless of scrollable axis), then it's focusable,
       * 3. The value of tabIndex >= 0, then it's focusable,
       * 4. If the element is disabled, it isn't focusable,
       * 5. If the element is expressly inert, it isn't focusable,
       * 6. Whether the element is being rendered or not.
       *
       * @function isFocusable
       * @param element {Node}
       * @returns {boolean}
       *
       * @see {@link https://html.spec.whatwg.org/multipage/interaction.html#focusable-area}
       */
      function isFocusable(element) {
        if ((element.tabIndex < 0) || isAtagWithoutHref(element) || isActuallyDisabled(element) || isExpresslyInert(element) || !isBeingRendered(element))
          return false;
        else if ((!element.parentElement) || (isScrollable(element) && isOverflow(element)) || (element.tabIndex >= 0))
          return true;
      }

      /**
       * Decide whether an element is a tag without href attribute or not.
       *
       * @function isAtagWithoutHref
       * @param element {Node}
       * @returns {boolean}
       */
      function isAtagWithoutHref(element) {
        return (element.tagName === 'A' && element.getAttribute('href') === null && element.getAttribute('tabIndex') === null);
      }

      /**
       * Decide whether an element is actually disabled or not.
       *
       * @function isActuallyDisabled
       * @param element {Node}
       * @returns {boolean}
       *
       * @see {@link https://html.spec.whatwg.org/multipage/semantics-other.html#concept-element-disabled}
       */
      function isActuallyDisabled(element) {
        if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'OPTGROUP', 'OPTION', 'FIELDSET'].includes(element.tagName))
          return (element.disabled);
        else
          return false;
      }

      /**
       * Decide whether the element is expressly inert or not.
       * @see {@link https://html.spec.whatwg.org/multipage/interaction.html#expressly-inert}
       * @function isExpresslyInert
       * @param element {Node}
       * @returns {boolean}
       */
      function isExpresslyInert(element) {
        return ((element.inert) && (!element.ownerDocument.documentElement.inert));
      }

      /**
       * Decide whether the element is being rendered or not.
       * 1. If an element has the style as "visibility: hidden | collapse" or "display: none", it is not being rendered.
       * 2. If an element has the style as "opacity: 0", it is not being rendered.(that is, invisible).
       * 3. If width and height of an element are explicitly set to 0, it is not being rendered.
       * 4. If a parent element is hidden, an element itself is not being rendered.
       * (CSS visibility property and display property are inherited.)
       * @see {@link https://html.spec.whatwg.org/multipage/rendering.html#being-rendered}
       * @function isBeingRendered
       * @param element {Node}
       * @returns {boolean}
       */
      function isBeingRendered(element) {
        if (!isVisibleStyleProperty(element.parentElement))
          return false;
        if (!isVisibleStyleProperty(element) || (element.style.opacity === '0') ||
            (window.getComputedStyle(element).height === '0px' || window.getComputedStyle(element).width === '0px'))
          return false;
        return true;
      }

      /**
       * Decide whether this element is partially or completely visible to user agent.
       * @function isVisible
       * @param element {Node}
       * @returns {boolean}
       */
      function isVisible(element) {
        return (!element.parentElement) || (isVisibleStyleProperty(element) && hitTest(element));
      }

      /**
       * Decide whether this element is completely visible in this viewport for the arrow direction.
       * @function isEntirelyVisible
       * @param element {Node}
       * @returns {boolean}
       */
      function isEntirelyVisible(element, container) {
        const rect = getBoundingClientRect(element);
        const containerElm = container || element.getSpatialNavigationContainer();
        const containerRect = getBoundingClientRect(containerElm);

        // FIXME: when element is bigger than container?
        const entirelyVisible = !((rect.left < containerRect.left) ||
          (rect.right > containerRect.right) ||
          (rect.top < containerRect.top) ||
          (rect.bottom > containerRect.bottom));

        return entirelyVisible;
      }

      /**
       * Decide the style property of this element is specified whether it's visible or not.
       * @function isVisibleStyleProperty
       * @param element {CSSStyleDeclaration}
       * @returns {boolean}
       */
      function isVisibleStyleProperty(element) {
        const elementStyle = window.getComputedStyle(element, null);
        const thisVisibility = elementStyle.getPropertyValue('visibility');
        const thisDisplay = elementStyle.getPropertyValue('display');
        const invisibleStyle = ['hidden', 'collapse'];

        return (thisDisplay !== 'none' && !invisibleStyle.includes(thisVisibility));
      }

      /**
       * Decide whether this element is entirely or partially visible within the viewport.
       * @function hitTest
       * @param element {Node}
       * @returns {boolean}
       */
      function hitTest(element) {
        const elementRect = getBoundingClientRect(element);
        if (element.nodeName !== 'IFRAME' && (elementRect.top < 0 || elementRect.left < 0 ||
          elementRect.top > element.ownerDocument.documentElement.clientHeight || elementRect.left >element.ownerDocument.documentElement.clientWidth))
          return false;

        let offsetX = parseInt(element.offsetWidth) / 10;
        let offsetY = parseInt(element.offsetHeight) / 10;

        offsetX = isNaN(offsetX) ? 1 : offsetX;
        offsetY = isNaN(offsetY) ? 1 : offsetY;

        const hitTestPoint = {
          // For performance, just using the three point(middle, leftTop, rightBottom) of the element for hit testing
          middle: [(elementRect.left + elementRect.right) / 2, (elementRect.top + elementRect.bottom) / 2],
          leftTop: [elementRect.left + offsetX, elementRect.top + offsetY],
          rightBottom: [elementRect.right - offsetX, elementRect.bottom - offsetY]
        };

        for(const point in hitTestPoint) {
          const elemFromPoint = element.ownerDocument.elementFromPoint(...hitTestPoint[point]);
          if (element === elemFromPoint || element.contains(elemFromPoint)) {
            return true;
          }
        }
        return false;
      }

      /**
       * Decide whether a child element is entirely or partially Included within container visually.
       * @function isInside
       * @param containerRect {DOMRect}
       * @param childRect {DOMRect}
       * @returns {boolean}
       */
      function isInside(containerRect, childRect) {
        const rightEdgeCheck = (containerRect.left <= childRect.right && containerRect.right >= childRect.right);
        const leftEdgeCheck = (containerRect.left <= childRect.left && containerRect.right >= childRect.left);
        const topEdgeCheck = (containerRect.top <= childRect.top && containerRect.bottom >= childRect.top);
        const bottomEdgeCheck = (containerRect.top <= childRect.bottom && containerRect.bottom >= childRect.bottom);
        return (rightEdgeCheck || leftEdgeCheck) && (topEdgeCheck || bottomEdgeCheck);
      }

      /**
       * Decide whether this element is entirely or partially visible within the viewport.
       * Note: rect1 is outside of rect2 for the dir
       * @function isOutside
       * @param rect1 {DOMRect}
       * @param rect2 {DOMRect}
       * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
       * @returns {boolean}
       */
      function isOutside(rect1, rect2, dir) {
        switch (dir) {
        case 'left':
          return isRightSide(rect2, rect1);
        case 'right':
          return isRightSide(rect1, rect2);
        case 'up':
          return isBelow(rect2, rect1);
        case 'down':
          return isBelow(rect1, rect2);
        default:
          return false;
        }
      }

      /* rect1 is right of rect2 */
      function isRightSide(rect1, rect2) {
        return rect1.left >= rect2.right || (rect1.left >= rect2.left && rect1.right > rect2.right && rect1.bottom > rect2.top && rect1.top < rect2.bottom);
      }

      /* rect1 is below of rect2 */
      function isBelow(rect1, rect2) {
        return rect1.top >= rect2.bottom || (rect1.top >= rect2.top && rect1.bottom > rect2.bottom && rect1.left < rect2.right && rect1.right > rect2.left);
      }

      /* rect1 is completely aligned or partially aligned for the direction */
      function isAligned(rect1, rect2, dir) {
        switch (dir) {
        case 'left' :
          /* falls through */
        case 'right' :
          return rect1.bottom > rect2.top && rect1.top < rect2.bottom;
        case 'up' :
          /* falls through */
        case 'down' :
          return rect1.right > rect2.left && rect1.left < rect2.right;
        default:
          return false;
        }
      }

      /**
       * Get distance between the search origin and a candidate element along the direction when candidate element is inside the search origin.
       * @see {@link https://drafts.csswg.org/css-nav-1/#find-the-shortest-distance}
       * @function getDistanceFromPoint
       * @param point {Point} - The search origin
       * @param element {DOMRect} - A candidate element
       * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
       * @returns {Number} The euclidian distance between the spatial navigation container and an element inside it
       */
      function getDistanceFromPoint(point, element, dir) {
        point = startingPoint;
        // Get exit point, entry point -> {x: '', y: ''};
        const points = getEntryAndExitPoints(dir, point, element);

        // Find the points P1 inside the border box of starting point and P2 inside the border box of candidate
        // that minimize the distance between these two points
        const P1 = Math.abs(points.entryPoint.x - points.exitPoint.x);
        const P2 = Math.abs(points.entryPoint.y - points.exitPoint.y);

        // The result is euclidian distance between P1 and P2.
        return Math.sqrt(Math.pow(P1, 2) + Math.pow(P2, 2));
      }

      /**
       * Get distance between the search origin and a candidate element along the direction when candidate element is inside the search origin.
       * @see {@link https://drafts.csswg.org/css-nav-1/#find-the-shortest-distance}
       * @function getInnerDistance
       * @param rect1 {DOMRect} - The search origin
       * @param rect2 {DOMRect} - A candidate element
       * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
       * @returns {Number} The euclidean distance between the spatial navigation container and an element inside it
       */
      function getInnerDistance(rect1, rect2, dir) {
        const baseEdgeForEachDirection = {left: 'right', right: 'left', up: 'bottom', down: 'top'};
        const baseEdge = baseEdgeForEachDirection[dir];

        return Math.abs(rect1[baseEdge] - rect2[baseEdge]);
      }

      /**
       * Get the distance between the search origin and a candidate element considering the direction.
       * @see {@link https://drafts.csswg.org/css-nav-1/#calculating-the-distance}
       * @function getDistance
       * @param searchOrigin {DOMRect | Point} - The search origin
       * @param candidateRect {DOMRect} - A candidate element
       * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
       * @returns {Number} The distance scoring between two elements
       */
      function getDistance(searchOrigin, candidateRect, dir) {
        const kOrthogonalWeightForLeftRight = 30;
        const kOrthogonalWeightForUpDown = 2;

        let orthogonalBias = 0;
        let alignBias = 0;
        const alignWeight = 5.0;

        // Get exit point, entry point -> {x: '', y: ''};
        const points = getEntryAndExitPoints(dir, searchOrigin, candidateRect);

        // Find the points P1 inside the border box of starting point and P2 inside the border box of candidate
        // that minimize the distance between these two points
        const P1 = Math.abs(points.entryPoint.x - points.exitPoint.x);
        const P2 = Math.abs(points.entryPoint.y - points.exitPoint.y);

        // A: The euclidean distance between P1 and P2.
        const A = Math.sqrt(Math.pow(P1, 2) + Math.pow(P2, 2));
        let B, C;

        // B: The absolute distance in the direction which is orthogonal to dir between P1 and P2, or 0 if dir is null.
        // C: The intersection edges between a candidate and the starting point.

        // D: The square root of the area of intersection between the border boxes of candidate and starting point
        const intersectionRect = getIntersectionRect(searchOrigin, candidateRect);
        const D = intersectionRect.area;

        switch (dir) {
        case 'left':
          /* falls through */
        case 'right' :
          // If two elements are aligned, add align bias
          // else, add orthogonal bias
          if (isAligned(searchOrigin, candidateRect, dir))
            alignBias = Math.min(intersectionRect.height / searchOrigin.height , 1);
          else
            orthogonalBias = (searchOrigin.height / 2);

          B = (P2 + orthogonalBias) * kOrthogonalWeightForLeftRight;
          C = alignWeight * alignBias;
          break;

        case 'up' :
          /* falls through */
        case 'down' :
          // If two elements are aligned, add align bias
          // else, add orthogonal bias
          if (isAligned(searchOrigin, candidateRect, dir))
            alignBias = Math.min(intersectionRect.width / searchOrigin.width , 1);
          else
            orthogonalBias = (searchOrigin.width / 2);

          B = (P1 + orthogonalBias) * kOrthogonalWeightForUpDown;
          C = alignWeight * alignBias;
          break;

        default:
          B = 0;
          C = 0;
          break;
        }

        return (A + B - C - D);
      }

      /**
       * Get the euclidean distance between the search origin and a candidate element considering the direction.
       * @function getEuclideanDistance
       * @param rect1 {DOMRect} - The search origin
       * @param rect2 {DOMRect} - A candidate element
       * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
       * @returns {Number} The distance scoring between two elements
       */
      function getEuclideanDistance(rect1, rect2, dir) {
        // Get exit point, entry point
        const points = getEntryAndExitPoints(dir, rect1, rect2);

        // Find the points P1 inside the border box of starting point and P2 inside the border box of candidate
        // that minimize the distance between these two points
        const P1 = Math.abs(points.entryPoint.x - points.exitPoint.x);
        const P2 = Math.abs(points.entryPoint.y - points.exitPoint.y);

        // Return the euclidean distance between P1 and P2.
        return Math.sqrt(Math.pow(P1, 2) + Math.pow(P2, 2));
      }

      /**
       * Get the absolute distance between the search origin and a candidate element considering the direction.
       * @function getAbsoluteDistance
       * @param rect1 {DOMRect} - The search origin
       * @param rect2 {DOMRect} - A candidate element
       * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD)
       * @returns {Number} The distance scoring between two elements
       */
      function getAbsoluteDistance(rect1, rect2, dir) {
        // Get exit point, entry point
        const points = getEntryAndExitPoints(dir, rect1, rect2);

        // Return the absolute distance in the dir direction between P1 and P.
        return ((dir === 'left') || (dir === 'right')) ?
          Math.abs(points.entryPoint.x - points.exitPoint.x) : Math.abs(points.entryPoint.y - points.exitPoint.y);
      }

      /**
       * Get entry point and exit point of two elements considering the direction.
       * @function getEntryAndExitPoints
       * @param dir {SpatialNavigationDirection} - The directional information for the spatial navigation (e.g. LRUD). Default value for dir is 'down'.
       * @param searchOrigin {DOMRect | Point} - The search origin which contains the exit point
       * @param candidateRect {DOMRect} - One of candidates which contains the entry point
       * @returns {Points} The exit point from the search origin and the entry point from a candidate
       */
      function getEntryAndExitPoints(dir = 'down', searchOrigin, candidateRect) {
        /**
         * User type definition for Point
         * @typeof {Object} Points
         * @property {Point} Points.entryPoint
         * @property {Point} Points.exitPoint
         */
        const points = {entryPoint: {x: 0, y: 0}, exitPoint:{x: 0, y: 0}};

        if (startingPoint) {
          points.exitPoint = searchOrigin;

          switch (dir) {
          case 'left':
            points.entryPoint.x = candidateRect.right;
            break;
          case 'up':
            points.entryPoint.y = candidateRect.bottom;
            break;
          case 'right':
            points.entryPoint.x = candidateRect.left;
            break;
          case 'down':
            points.entryPoint.y = candidateRect.top;
            break;
          }

          // Set orthogonal direction
          switch (dir) {
          case 'left':
          case 'right':
            if (startingPoint.y <= candidateRect.top) {
              points.entryPoint.y = candidateRect.top;
            } else if (startingPoint.y < candidateRect.bottom) {
              points.entryPoint.y = startingPoint.y;
            } else {
              points.entryPoint.y = candidateRect.bottom;
            }
            break;

          case 'up':
          case 'down':
            if (startingPoint.x <= candidateRect.left) {
              points.entryPoint.x = candidateRect.left;
            } else if (startingPoint.x < candidateRect.right) {
              points.entryPoint.x = startingPoint.x;
            } else {
              points.entryPoint.x = candidateRect.right;
            }
            break;
          }
        }
        else {
          // Set direction
          switch (dir) {
          case 'left':
            points.exitPoint.x = searchOrigin.left;
            points.entryPoint.x = (candidateRect.right < searchOrigin.left) ? candidateRect.right : searchOrigin.left;
            break;
          case 'up':
            points.exitPoint.y = searchOrigin.top;
            points.entryPoint.y = (candidateRect.bottom < searchOrigin.top) ? candidateRect.bottom : searchOrigin.top;
            break;
          case 'right':
            points.exitPoint.x = searchOrigin.right;
            points.entryPoint.x = (candidateRect.left > searchOrigin.right) ? candidateRect.left : searchOrigin.right;
            break;
          case 'down':
            points.exitPoint.y = searchOrigin.bottom;
            points.entryPoint.y = (candidateRect.top > searchOrigin.bottom) ? candidateRect.top : searchOrigin.bottom;
            break;
          }

          // Set orthogonal direction
          switch (dir) {
          case 'left':
          case 'right':
            if (isBelow(searchOrigin, candidateRect)) {
              points.exitPoint.y = searchOrigin.top;
              points.entryPoint.y = (candidateRect.bottom < searchOrigin.top) ? candidateRect.bottom : searchOrigin.top;
            } else if (isBelow(candidateRect, searchOrigin)) {
              points.exitPoint.y = searchOrigin.bottom;
              points.entryPoint.y = (candidateRect.top > searchOrigin.bottom) ? candidateRect.top : searchOrigin.bottom;
            } else {
              points.exitPoint.y = Math.max(searchOrigin.top, candidateRect.top);
              points.entryPoint.y = points.exitPoint.y;
            }
            break;

          case 'up':
          case 'down':
            if (isRightSide(searchOrigin, candidateRect)) {
              points.exitPoint.x = searchOrigin.left;
              points.entryPoint.x = (candidateRect.right < searchOrigin.left) ? candidateRect.right : searchOrigin.left;
            } else if (isRightSide(candidateRect, searchOrigin)) {
              points.exitPoint.x = searchOrigin.right;
              points.entryPoint.x = (candidateRect.left > searchOrigin.right) ? candidateRect.left : searchOrigin.right;
            } else {
              points.exitPoint.x = Math.max(searchOrigin.left, candidateRect.left);
              points.entryPoint.x = points.exitPoint.x;
            }
            break;
          }
        }

        return points;
      }

      /**
       * Find focusable elements within the container
       * @see {@link https://drafts.csswg.org/css-nav-1/#find-the-shortest-distance}
       * @function getIntersectionRect
       * @param rect1 {DOMRect} - The search origin which contains the exit point
       * @param rect2 {DOMRect} - One of candidates which contains the entry point
       * @returns {IntersectionArea} The intersection area between two elements.
       *
       * @typeof {Object} IntersectionArea
       * @property {Number} IntersectionArea.width
       * @property {Number} IntersectionArea.height
       */
      function getIntersectionRect(rect1, rect2) {
        const intersection_rect = {width: 0, height: 0, area: 0};

        const new_location = [Math.max(rect1.left, rect2.left), Math.max(rect1.top, rect2.top)];
        const new_max_point = [Math.min(rect1.right, rect2.right), Math.min(rect1.bottom, rect2.bottom)];

        intersection_rect.width = Math.abs(new_location[0] - new_max_point[0]);
        intersection_rect.height = Math.abs(new_location[1] - new_max_point[1]);

        if (!(new_location[0] >= new_max_point[0] || new_location[1] >= new_max_point[1])) {
          // intersecting-cases
          intersection_rect.area = Math.sqrt(intersection_rect.width * intersection_rect.height);
        }

        return intersection_rect;
      }

      /**
       * Handle the spatial navigation behavior for HTMLInputElement, HTMLTextAreaElement
       * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input|HTMLInputElement (MDN)}
       * @function handlingEditableElement
       * @param e {Event} - keydownEvent
       * @returns {boolean}
       */
      function handlingEditableElement(e) {
        const SPINNABLE_INPUT_TYPES = ['email', 'date', 'month', 'number', 'time', 'week'],
          TEXT_INPUT_TYPES = ['password', 'text', 'search', 'tel', 'url', null];
        const eventTarget = document.activeElement;
        const focusNavigableArrowKey = {left: false, up: false, right: false, down: false};

        const dir = ARROW_KEY_CODE[e.keyCode];
        if (dir === undefined) {
          return focusNavigableArrowKey;
        }

        if (SPINNABLE_INPUT_TYPES.includes(eventTarget.getAttribute('type')) &&
          (dir === 'up' || dir === 'down')) {
          focusNavigableArrowKey[dir] = true;
        } else if (TEXT_INPUT_TYPES.includes(eventTarget.getAttribute('type')) || eventTarget.nodeName === 'TEXTAREA') {
          // 20210606 fix selectionStart unavailable on checkboxes ~inf
          const startPosition = eventTarget.selectionStart;
          const endPosition = eventTarget.selectionEnd;
          if (startPosition === endPosition) { // if there isn't any selected text
            if (startPosition === 0) {
              focusNavigableArrowKey.left = true;
              focusNavigableArrowKey.up = true;
            }
            if (endPosition === eventTarget.value.length) {
              focusNavigableArrowKey.right = true;
              focusNavigableArrowKey.down = true;
            }
          }
        } else { // HTMLDataListElement, HTMLSelectElement, HTMLOptGroup
          focusNavigableArrowKey[dir] = true;
        }

        return focusNavigableArrowKey;
      }

      /**
       * Get the DOMRect of an element
       * @function getBoundingClientRect
       * @param {Node} element 
       * @returns {DOMRect}
       */
      function getBoundingClientRect(element) {
        // memoization
        let rect = mapOfBoundRect && mapOfBoundRect.get(element);
        if (!rect) {
          const boundingClientRect = element.getBoundingClientRect();
          rect = {
            top: Number(boundingClientRect.top.toFixed(2)),
            right: Number(boundingClientRect.right.toFixed(2)),
            bottom: Number(boundingClientRect.bottom.toFixed(2)),
            left: Number(boundingClientRect.left.toFixed(2)),
            width: Number(boundingClientRect.width.toFixed(2)),
            height: Number(boundingClientRect.height.toFixed(2))
          };
          mapOfBoundRect && mapOfBoundRect.set(element, rect);
        }
        return rect;
      }

      /**
       * Get the candidates which is fully inside the target element in visual
       * @param {Node} targetElement
       * @returns {sequence<Node>}  overlappedCandidates
       */
      function getOverlappedCandidates(targetElement) {      
        const container = targetElement.getSpatialNavigationContainer();
        const candidates = container.focusableAreas();
        const overlappedCandidates = [];

        candidates.forEach(element => {
          if ((targetElement !== element) && isEntirelyVisible(element, targetElement)) {
            overlappedCandidates.push(element);
          }
        });

        return overlappedCandidates;
      }

      /**
       * Get the list of the experimental APIs
       * @function getExperimentalAPI
       */
      function getExperimentalAPI() {
        function canScroll(container, dir) {
          return (isScrollable(container, dir) && !isScrollBoundary(container, dir)) ||
                 (!container.parentElement && !isHTMLScrollBoundary(container, dir));
        }

        function findTarget(findCandidate, element, dir, option) {
          let eventTarget = element;
          let bestNextTarget = null;

          // 4
          if (eventTarget === document || eventTarget === document.documentElement) {
            eventTarget = document.body || document.documentElement;
          }

          // 5
          // At this point, spatialNavigationSearch can be applied.
          // If startingPoint is either a scroll container or the document,
          // find the best candidate within startingPoint
          if ((isContainer(eventTarget) || eventTarget.nodeName === 'BODY') && !(eventTarget.nodeName === 'INPUT')) {
            if (eventTarget.nodeName === 'IFRAME')
              eventTarget = eventTarget.contentDocument.body;

            const candidates = getSpatialNavigationCandidates(eventTarget, option);

            // 5-2
            if (Array.isArray(candidates) && candidates.length > 0) {
              return findCandidate ? getFilteredSpatialNavigationCandidates(eventTarget, dir, candidates) : eventTarget.spatialNavigationSearch(dir, {candidates});
            }
            if (canScroll(eventTarget, dir)) {
              return findCandidate ? [] : eventTarget;
            }
          }

          // 6
          // Let container be the nearest ancestor of eventTarget
          let container = eventTarget.getSpatialNavigationContainer();
          let parentContainer = (container.parentElement) ? container.getSpatialNavigationContainer() : null;

          // When the container is the viewport of a browsing context
          if (!parentContainer && ( window.location !== window.parent.location)) {
            parentContainer = window.parent.document.documentElement;
          }

          // 7
          while (parentContainer) {
            const candidates = filteredCandidates(eventTarget, getSpatialNavigationCandidates(container, option), dir, container);

            if (Array.isArray(candidates) && candidates.length > 0) {
              bestNextTarget = eventTarget.spatialNavigationSearch(dir, {candidates, container});
              if (bestNextTarget) {
                return findCandidate ? candidates : bestNextTarget;
              }
            }

            // If there isn't any candidate and the best candidate among candidate:
            // 1) Scroll or 2) Find candidates of the ancestor container
            // 8 - if
            else if (canScroll(container, dir)) {
              return findCandidate ? [] : eventTarget;
            } else if (container === document || container === document.documentElement) {
              container = window.document.documentElement;

              // The page is in an iframe
              if ( window.location !== window.parent.location ) {
                // eventTarget needs to be reset because the position of the element in the IFRAME
                // is unuseful when the focus moves out of the iframe
                eventTarget = window.frameElement;
                container = window.parent.document.documentElement;
                if (container.parentElement)
                  parentContainer = container.getSpatialNavigationContainer();
                else {
                  parentContainer = null;
                  break;
                }
              }
            } else {
              // avoiding when spatnav container with tabindex=-1
              if (isFocusable(container)) {
                eventTarget = container;
              }

              container = parentContainer;
              if (container.parentElement)
                parentContainer = container.getSpatialNavigationContainer();
              else {
                parentContainer = null;
                break;
              }
            }
          }

          if (!parentContainer && container) {
            // Getting out from the current spatnav container
            const candidates = filteredCandidates(eventTarget, getSpatialNavigationCandidates(container, option), dir, container);

            // 9
            if (Array.isArray(candidates) && candidates.length > 0) {
              bestNextTarget = eventTarget.spatialNavigationSearch(dir, {candidates, container});
              if (bestNextTarget) {
                return findCandidate ? candidates : bestNextTarget;
              }
            }
          }

          if (canScroll(container, dir)) {
            bestNextTarget = eventTarget;
            return bestNextTarget;
          }
        }

        return {
          isContainer,
          isScrollContainer,
          isVisibleInScroller,
          findCandidates: findTarget.bind(null, true),
          findNextTarget: findTarget.bind(null, false),
          getDistanceFromTarget: (element, candidateElement, dir) => {
            if ((isContainer(element) || element.nodeName === 'BODY') && !(element.nodeName === 'INPUT')) {
              if (getSpatialNavigationCandidates(element).includes(candidateElement)) {
                return getInnerDistance(getBoundingClientRect(element), getBoundingClientRect(candidateElement), dir);
              }
            }
            return getDistance(getBoundingClientRect(element), getBoundingClientRect(candidateElement), dir);
          }
        };
      }

      /**
       * Makes to use the experimental APIs.
       * @function enableExperimentalAPIs
       * @param option {boolean} - If it is true, the experimental APIs can be used or it cannot.
       */
      function enableExperimentalAPIs (option) {
        const currentKeyMode = window.__spatialNavigation__ && window.__spatialNavigation__.keyMode;
        window.__spatialNavigation__ = (option === false) ? getInitialAPIs() : Object.assign(getInitialAPIs(), getExperimentalAPI());
        window.__spatialNavigation__.keyMode = currentKeyMode;
        Object.seal(window.__spatialNavigation__);
      }

      /**
       * Set the environment for using the spatial navigation polyfill.
       * @function getInitialAPIs
       */
      function getInitialAPIs() {
        return {
          enableExperimentalAPIs,
          get keyMode() { return this._keymode ? this._keymode : 'ARROW'; },
          set keyMode(mode) { this._keymode = (['SHIFTARROW', 'ARROW', 'NONE'].includes(mode)) ? mode : 'ARROW'; },
          setStartingPoint: function (x, y) {startingPoint = (x && y) ? {x, y} : null;}
        };
      }

      initiateSpatialNavigation();
      enableExperimentalAPIs(false);
      
      window.addEventListener('load', () => {
        spatialNavigationHandler();
      });
    })();

    var css$1 = ".ytaf-ui-container {\r\n  position: absolute;\r\n  top: 10%;\r\n  left: 10%;\r\n  right: 10%;\r\n  bottom: 10%;\r\n\r\n  background: rgba(0, 0, 0, 0.8);\r\n  color: white;\r\n  border-radius: 20px;\r\n  padding: 20px;\r\n  font-size: 1.5rem;\r\n  z-index: 1000;\r\n}\r\n\r\n.ytaf-ui-container :focus {\r\n  outline: 4px red solid;\r\n}\r\n\r\n.ytaf-ui-container h1 {\r\n  margin: 0;\r\n  margin-bottom: 0.5em;\r\n  text-align: center;\r\n}\r\n\r\n.ytaf-ui-container input[type='checkbox'] {\r\n  width: 1.4rem;\r\n  height: 1.4rem;\r\n}\r\n\r\n.ytaf-ui-container input[type='radio'] {\r\n  width: 1.4rem;\r\n  height: 1.4rem;\r\n}\r\n\r\n.ytaf-ui-container label {\r\n  display: block;\r\n  font-size: 1.4rem;\r\n}\r\n\r\n.ytaf-notification-container {\r\n  position: absolute;\r\n  right: 10px;\r\n  bottom: 10px;\r\n  font-size: 16pt;\r\n  z-index: 1200;\r\n}\r\n\r\n.ytaf-notification-container .message {\r\n  background: rgba(0, 0, 0, 0.7);\r\n  color: white;\r\n  padding: 1em;\r\n  margin: 0.5em;\r\n  transition: all 0.3s ease-in-out;\r\n  opacity: 1;\r\n  line-height: 1;\r\n  border-right: 10px solid rgba(50, 255, 50, 0.3);\r\n  display: inline-block;\r\n  float: right;\r\n}\r\n\r\n.ytaf-notification-container .message-hidden {\r\n  opacity: 0;\r\n  margin: 0 0.5em;\r\n  padding: 0 1em;\r\n  line-height: 0;\r\n}\r\n\r\n/* Fixes transparency effect for the video player */\r\n\r\n.ytLrWatchDefaultShadow,\r\ndiv[idomkey=\"shadow\"] {\r\n  background-image: linear-gradient(to bottom, rgba(0, 0, 0, 0) 0, rgba(0, 0, 0, 0.8) 90%) !important;\r\n  background-color: rgba(0, 0, 0, 0.3) !important;\r\n  display: block !important;\r\n  height: 100% !important;\r\n  pointer-events: none !important;\r\n  position: absolute !important;\r\n  width: 100% !important;\r\n}\r\n\r\n/* https://github.com/webosbrew/youtube-webos/commit/4fbe38a18df31ddd62b6cf15f141dd58e1d1a71d */\r\n.ytLrWatchDefault2025Shadow {\r\n  background-color: rgba(11, 11, 11, 0.5) !important;\r\n}\r\n\r\n/* Fixes shorts having a black background */\r\n\r\n.ytLrTileHeaderRendererShorts {\r\n  background-image: none !important;\r\n}\r\n\r\n/* Multiline support for strings in the UI */\r\n\r\n.ytLrOverlayPanelHeaderRendererSubtitle {\r\n  white-space: pre-wrap !important;\r\n}\r\n\r\n/* Fixes SponsorBlock segments overlapping with the playhead */\r\n\r\n.ytLrProgressBarPlayhead {\r\n  z-index: 1 !important;\r\n}\r\n\r\n.ytLrProgressBarPlayed {\r\n  z-index: 1 !important;\r\n}\r\n\r\n.ytLrSearchBarSearchVoice {\r\n    display: block;\r\n    position: absolute;\r\n    left: 0;\r\n    top: 0;\r\n    pointer-events: auto\r\n}\r\n\r\n.ytLrSearchVoiceHost {\r\n    font-size: 3rem;\r\n}\r\n\r\n.ytLrSearchVoiceMicButtonHost {\r\n    color: rgba(255, 255, 255, 0.7);\r\n}\r\n\r\n.ytLrSearchVoiceMicButtonHost {\r\n    background-color: rgba(255, 255, 255, 0.1);\r\n    border-radius: 50%;\r\n    color: #f1f1f1;\r\n    display: block;\r\n    text-align: center;\r\n    width: 1em;\r\n    height: 1em;\r\n}\r\n\r\n.ytLrSearchVoiceMicButtonIcon {\r\n    display: inline-block;\r\n    font-size: .5em;\r\n    height: .5em;\r\n    width: .5em;\r\n    height: 1em;\r\n    width: 1em;\r\n    margin-top: .5em;\r\n    vertical-align: top !important;\r\n}\r\n\r\n.ytContribIconHost {\r\n    display: inline-block;\r\n    vertical-align: middle;\r\n}\r\n\r\n.ytContribIconTvArrowLeft::before {\r\n    content: \"\\e822\";\r\n}\r\n\r\n.ytContribIconHost::before {\r\n    font-family: \"YouTube Icons Outlined\";\r\n}";

    const style = document.createElement('style');
    let css = '';

    function updateStyle() {
        css = `
    ytlr-guide-response yt-focus-container {
        background-color: ${configRead('focusContainerColor')};
    }

    #container {
        background-color: ${configRead('routeColor')} !important;
    }
`;
        const existingStyle = document.querySelector('style[nonce]');
        if (existingStyle) {
            existingStyle.textContent += css;
        } else {
            style.textContent = css;
        }
    }
    document.head.appendChild(style);
    updateStyle();

    function getCommandExecutor() {
        let instance;
        let executeFunction;

        for (const key in window._yttv) {
            if (window._yttv[key] && window._yttv[key].getInstance) {
                if (window._yttv[key].toString().includes('ytlrActionRouter')) instance = window._yttv[key].getInstance();
                else {
                    let isInstance = false;
                    const tempInstance = window._yttv[key].getInstance();
                    const keys = Object.getOwnPropertyNames(Object.getPrototypeOf(tempInstance));
                    for (const key of keys) {
                        if (typeof tempInstance[key] === 'function' && tempInstance[key].toString().includes('ytlrActionRouter')) {
                            executeFunction = tempInstance[key];
                            isInstance = true;
                        }
                    }

                    if (isInstance) instance = window._yttv[key].getInstance();
                }
            }
        }

        if (!instance) return;

        if (!executeFunction) {
            const keys = Object.getOwnPropertyNames(Object.getPrototypeOf(instance));
            for (const key of keys) {
                if (typeof instance[key] === 'function' && instance[key].toString().includes('ytlrActionRouter')) {
                    executeFunction = instance[key];
                }
            }
        }

        if (!executeFunction) return;

        let commandFunction;
        for (const key in window._yttv) {
            if (window._yttv[key] && typeof window._yttv[key] === 'function' && window._yttv[key].toString().includes('this.actionName')) {
                commandFunction = window._yttv[key];
            }
        }
        return {
            executeFunction: executeFunction.bind(instance),
            commandFunction
        }
    }

    /*global navigate*/

    function tryInit() {
      if (window._yttv) {
        for (const key in window._yttv) {
          if (window._yttv[key]?.instance?.resolveCommand) {
            patchResolveCommand();
            break;
          }
        }
      }
      if (document.body) {
        execute_once_dom_loaded();
        return true;
      }
      return false;
    }

    if (!tryInit()) {
      const interval = setInterval(() => {
        if (tryInit()) {
          clearInterval(interval);
        }
      }, 100);
    }

    let keyTimeout = null;

    function execute_once_dom_loaded() {

      // Add CSS to head.

      const existingStyle = document.querySelector('style[nonce]');
      if (existingStyle) {
        existingStyle.textContent += css$1;
      } else {
        const style = document.createElement('style');
        style.textContent = css$1;
        document.head.appendChild(style);
      }

      // Fix UI issues.
      const ui = configRead('enableFixedUI');
      if (ui) {
        try {
          window.tectonicConfig.featureSwitches.isLimitedMemory = false;
          window.tectonicConfig.clientData.legacyApplicationQuality = 'full-animation';
          window.tectonicConfig.featureSwitches.enableAnimations = true;
          window.tectonicConfig.featureSwitches.enableOnScrollLinearAnimation = true;
          window.tectonicConfig.featureSwitches.enableListAnimations = true;
        } catch (e) { }
      }

      // We handle key events ourselves.
      window.__spatialNavigation__.keyMode = 'NONE';

      var ARROW_KEY_CODE = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' };

      var uiContainer = document.createElement('div');
      uiContainer.classList.add('ytaf-ui-container');
      uiContainer.style['display'] = 'none';
      uiContainer.setAttribute('tabindex', 0);
      uiContainer.addEventListener(
        'focus',
        () => console.info('uiContainer focused!'),
        true
      );
      uiContainer.addEventListener(
        'blur',
        () => console.info('uiContainer blured!'),
        true
      );

      uiContainer.addEventListener(
        'keydown',
        (evt) => {
          console.info('uiContainer key event:', evt.type, evt.keyCode, evt);
          if (evt.keyCode !== 404 && evt.keyCode !== 172) {
            if (evt.keyCode in ARROW_KEY_CODE) {
              navigate(ARROW_KEY_CODE[evt.keyCode]);
            } else if (evt.keyCode === 13 || evt.keyCode === 32) {
              // "OK" button
              console.log('OK button pressed');
              const focusedElement = document.querySelector(':focus');
              if (focusedElement.type === 'checkbox') {
                focusedElement.checked = !focusedElement.checked;
                focusedElement.dispatchEvent(new Event('change'));
              }
              evt.preventDefault();
              evt.stopPropagation();
              return;
            } else if (evt.keyCode === 27 && document.querySelector(':focus').type !== 'text') {
              // Back button
              uiContainer.style.display = 'none';
              uiContainer.blur();
            } else if (document.querySelector(':focus').type === 'text' && evt.keyCode === 27) {
              const focusedElement = document.querySelector(':focus');
              focusedElement.value = focusedElement.value.slice(0, -1);
            }


            if (evt.key === 'Enter' || evt.Uc?.key === 'Enter') {
              // If the focused element is a text input, emit a change event.
              if (document.querySelector(':focus').type === 'text') {
                document.querySelector(':focus').dispatchEvent(new Event('change'));
              }
            }
          }
        },
        true
      );

      try {
        uiContainer.innerHTML = `
<h1>Fast-Tube Theme Configuration</h1>
<label for="__barColor">Navigation Bar Color: <input type="text" id="__barColor"/></label>
<label for="__routeColor">Main Content Color: <input type="text" id="__routeColor"/></label>
<div><small>Sponsor segments skipping - https://sponsor.ajay.app</small></div>
`;
        document.querySelector('body').appendChild(uiContainer);

        uiContainer.querySelector('#__barColor').value = configRead('focusContainerColor');
        uiContainer.querySelector('#__barColor').addEventListener('change', (evt) => {
          configWrite('focusContainerColor', evt.target.value);
          updateStyle();
        });

        uiContainer.querySelector('#__routeColor').value = configRead('routeColor');
        uiContainer.querySelector('#__routeColor').addEventListener('change', (evt) => {
          configWrite('routeColor', evt.target.value);
          updateStyle();
        });
      } catch (e) { }

      var eventHandler = (evt) => {
        // We handle key events ourselves.
        // console.info('Key event:', evt.type, evt.keyCode); // Removed for performance
        if (configRead('enableScreenDimming')) {
          if (keyTimeout) {
            clearTimeout(keyTimeout);
          }
          const container = document.getElementById('container');
          if (container) container.style.setProperty('opacity', '1', 'important');
          keyTimeout = setTimeout(() => {
            const videoPlayer = document.querySelector('.html5-video-player');
            const playerStateObject = videoPlayer && typeof videoPlayer.getPlayerStateObject === 'function' ? videoPlayer.getPlayerStateObject() : null;
            if (playerStateObject && playerStateObject.isPlaying) return;
            if (container) container.style.setProperty('opacity', (1 - configRead('dimmingOpacity')).toString(), 'important');
          }, configRead('dimmingTimeout') * 1000);
        } else {
          if (keyTimeout) {
            clearTimeout(keyTimeout);
            keyTimeout = null;
          }
          const container = document.getElementById('container');
          if (container) container.style.setProperty('opacity', '1', 'important');
        }
        if (evt.keyCode == 404) {
          if (evt.type === 'keydown') {
            modernUI();
          }
        } else if (evt.keyCode == 39) {
          // Right key, for PiP
          if (evt.type === 'keydown') {
            if (document.querySelector('ytlr-search-text-box > .zylon-focus') && window.isPipPlaying) {
              const ytlrPlayer = document.querySelector('ytlr-player');
              ytlrPlayer.style.setProperty('background-color', 'rgb(0, 0, 0)');
              pipToFullscreen();
            }
          }
        }    return true;
      };

      // Red, Green, Yellow, Blue
      // 403, 404, 405, 406
      // ---, 172, 170, 191
      document.addEventListener('keydown', eventHandler, true);
      document.addEventListener('keypress', eventHandler, true);
      document.addEventListener('keyup', eventHandler, true);
      if (configRead('showWelcomeToast')) {
        setTimeout(() => {
          showToast(t('welcomeMsg.title'), t('welcomeMsg.subtitle'));
        }, 2000);
      }

      if (configRead('reloadHomeOnStartup')) {
        if (configRead('launchToOnStartup')) {
          resolveCommand(JSON.parse(configRead('launchToOnStartup')));
        } else {
          resolveCommand({
            signalAction: {
              signal: 'SOFT_RELOAD_PAGE'
            }
          });
        }
      }

      const commandExecutor = getCommandExecutor();
      if (commandExecutor) {
        commandExecutor.executeFunction(new commandExecutor.commandFunction('reloadGuideAction'));
      }

      // Fix UI issues, again. Love, Googol.

      if (configRead('enableFixedUI')) {
        try {
          const observer = new MutationObserver((_, _2) => {
            const body = document.body;
            if (body.classList.contains('app-quality-root')) {
              body.classList.remove('app-quality-root');
            }
          });
          observer.observe(document.body, { attributes: true, childList: false, subtree: false });
        } catch (e) { }
      }
    }
    configChangeEmitter.addEventListener('configChange', (e) => {
        if (e.detail.key === 'enableScreenDimming') {
            if (!e.detail.value) {
                if (keyTimeout) clearTimeout(keyTimeout);
                const container = document.getElementById('container');
                if (container) container.style.setProperty('opacity', '1', 'important');
            }
        } else if (e.detail.key === 'dimmingOpacity' || e.detail.key === 'dimmingTimeout') {
            if (configRead('enableScreenDimming')) {
                if (keyTimeout) clearTimeout(keyTimeout);
                const container = document.getElementById('container');
                if (container) container.style.setProperty('opacity', '1', 'important');
                keyTimeout = setTimeout(() => {
                    const videoPlayer = document.querySelector('.html5-video-player');
                    const playerStateObject = videoPlayer ? videoPlayer.getPlayerStateObject() : null;
                    if (playerStateObject && playerStateObject.isPlaying) return;
                    if (container) container.style.setProperty('opacity', (1 - configRead('dimmingOpacity')).toString(), 'important');
                }, configRead('dimmingTimeout') * 1000);
            }
        }
    });

    configChangeEmitter.addEventListener('configChange', (event) => {
        const { key, value } = event.detail;
        if (key === 'enableWhoIsWatchingMenu') {
            disableWhosWatching(value);
        }
    });

    let interval;

    function disableWhosWatching(value) {
        const LeanbackRecurringActions = JSON.parse(localStorage['yt.leanback.default::recurring_actions']);
        const shouldPermanentlyEnable = configRead('permanentlyEnableWhoIsWatchingMenu');
        const date = new Date();
        if (!value) {
            // Setting it after 7 days should be enough, as it'll get executed every time the app launches.
            date.setDate(date.getDate() + 7);
            LeanbackRecurringActions.data.data["startup-screen-account-selector-with-guest"] && 
                (LeanbackRecurringActions.data.data["startup-screen-account-selector-with-guest"].lastFired = date.getTime());
            LeanbackRecurringActions.data.data.whos_watching_fullscreen_zero_accounts.lastFired = date.getTime();
            LeanbackRecurringActions.data.data["startup-screen-signed-out-welcome-back"] && 
                (LeanbackRecurringActions.data.data["startup-screen-signed-out-welcome-back"].lastFired = date.getTime());
            localStorage['yt.leanback.default::recurring_actions'] = JSON.stringify(LeanbackRecurringActions);
        } else {
            // Do nothing if the last fired action is less than 2 hours ago.
            if (date.getTime() - LeanbackRecurringActions.data.data["startup-screen-account-selector-with-guest"]?.lastFired > 0 && date.getTime() - LeanbackRecurringActions.data.data["startup-screen-account-selector-with-guest"]?.lastFired < 2 * 60 * 60 * 1000
            && !shouldPermanentlyEnable) {
                return;
            }
            function setActions() {
                LeanbackRecurringActions.data.data["startup-screen-account-selector-with-guest"] && 
                    (LeanbackRecurringActions.data.data["startup-screen-account-selector-with-guest"].lastFired = date.getTime());
                LeanbackRecurringActions.data.data.whos_watching_fullscreen_zero_accounts.lastFired = date.getTime();
                LeanbackRecurringActions.data.data["startup-screen-signed-out-welcome-back"] &&
                    (LeanbackRecurringActions.data.data["startup-screen-signed-out-welcome-back"].lastFired = date.getTime());
                localStorage['yt.leanback.default::recurring_actions'] = JSON.stringify(LeanbackRecurringActions);
            }
            setActions();
            if (shouldPermanentlyEnable) {
                date.setDate(date.getDate() - 7);
                setActions();
                interval = setInterval(setActions, 60 * 1000);
            } else if (interval) clearInterval(interval);
        }
    }

    disableWhosWatching(configRead('enableWhoIsWatchingMenu'));

    const SELECTORS = {
        PLAYER: '.html5-video-player',
    };

    const EVENTS = {
        YT_STATE_CHANGE: 'onStateChange',
        CONFIG_CHANGE: 'configChange',
    };

    const CONFIG_KEYS = {
        QUALITY: 'preferredVideoQuality',
    };

    class PreferredQualityHandler {
        #player = null;
        #attachTimeout = null;
        #lastVideoId = null;
        #hasAppliedQuality = false;

        constructor() {
            this.init();
        }

        init() {
            this.#pollForPlayer();
            this.#setupConfigListener();
        }

        #pollForPlayer() {
            clearTimeout(this.#attachTimeout);

            const playerElement = document.querySelector(SELECTORS.PLAYER);

            if (!playerElement) {
                this.#attachTimeout = setTimeout(() => this.#pollForPlayer(), 100);
                return;
            }

            this.#player = playerElement;

            this.#player.addEventListener(EVENTS.YT_STATE_CHANGE, this.#handleStateChange);

            this.#handleStateChange();
        }

        #setupConfigListener() {
            configChangeEmitter.addEventListener(EVENTS.CONFIG_CHANGE, (ev) => {
                if (ev.detail?.key === CONFIG_KEYS.QUALITY) {
                    this.#applyQuality();
                }
            });
        }

        #handleStateChange = () => {
            const state = this.#player?.getPlayerStateObject?.();
            const videoData = this.#player?.getVideoData?.();
            const videoId = videoData?.video_id;

            if (videoId !== this.#lastVideoId) {
                this.#lastVideoId = videoId;
                this.#hasAppliedQuality = false;
            }

            const isShorts = Object.values(this.#player.getVideoStats()).find(a => a && a === 'shortspage');
            if (state?.isPlaying && !this.#hasAppliedQuality && !isShorts) {
                this.#applyQuality();
                this.#hasAppliedQuality = true;
            }
        };

        #applyQuality() {
            const preferredQuality = configRead(CONFIG_KEYS.QUALITY);
            if (!preferredQuality || preferredQuality === 'auto' || !this.#player) return;

            try {
                const quality = this.#determineQuality(preferredQuality);

                if (quality) {
                  this.#player.setPlaybackQualityRange(quality, quality);
                }
            } catch (e) {
                console.warn('[PreferredQuality] Failed to apply quality:', e);
            }
        }

        #determineQuality(preference) {
            const availableQualities = this.#player.getAvailableQualityData();
            if (!availableQualities?.length) return 'highres';

            const getQualityValue = (label) => parseInt(label, 10) || 0;
            const targetValue = getQualityValue(preference);

            const match = availableQualities.find(q => getQualityValue(q.qualityLabel) === targetValue);

            return match ? match.quality : 'highres';
        }
    }

    window.preferredVideoQualityHandler = new PreferredQualityHandler();

    window.queuedVideos = {
        videos: [],
        lastVideoId: null
    };

    function addListener() {
        const videoPlayer = document.querySelector('.html5-video-player');
        if (!videoPlayer) return setTimeout(addListener, 250);

        videoPlayer.addEventListener('onStateChange', () => {
            const playerStateObject = videoPlayer.getPlayerStateObject();
            const videoData = videoPlayer.getVideoData();
            if (window.queuedVideos.videos.length === 0) return;
            if (playerStateObject.isEnded) {
                const index = window.queuedVideos.videos.findIndex(v => v.tileRenderer.contentId === videoData.video_id);
                if (index !== -1) {
                    if (index + 1 >= window.queuedVideos.videos.length) {
                        resolveCommand({
                            customAction: {
                                action: 'CLEAR_QUEUE'
                            }
                        });
                        return;
                    }
                    const videoWatchEndpoint = window.queuedVideos.videos[index + 1].tileRenderer.onSelectCommand;
                    setTimeout(() => resolveCommand(videoWatchEndpoint), 500);
                } else if (window.queuedVideos.lastVideoId) {
                    const lastIndex = window.queuedVideos.videos.findIndex(v => v.tileRenderer.contentId === window.queuedVideos.lastVideoId);
                    if (lastIndex !== -1 && lastIndex + 1 < window.queuedVideos.videos.length) {
                        const videoWatchEndpoint = window.queuedVideos.videos[lastIndex + 1].tileRenderer.onSelectCommand;
                        setTimeout(() => resolveCommand(videoWatchEndpoint), 500);
                    } else {
                        resolveCommand({
                            customAction: {
                                action: 'CLEAR_QUEUE'
                            }
                        });
                        return;
                    }
                } else {
                    const videoWatchEndpoint = window.queuedVideos.videos[0].tileRenderer.onSelectCommand;
                    setTimeout(() => resolveCommand(videoWatchEndpoint), 500);
                }
            } else if (playerStateObject.isPlaying) {
                document.getElementById('container').style.setProperty('opacity', '1', 'important');
                if (window.queuedVideos.videos.find(v => v.contentId === videoData.video_id)) {
                    window.queuedVideos.lastVideoId = videoData.video_id;
                }
            }
        });
    }

    addListener();

    // Enable features that aren't enabled by default due to YT seeing the TV as a low-end device

    configChangeEmitter.addEventListener('configChange', (event) => {
        enableFeatures();
    });


    function enableFeatures() {
        if (!window._yttv) return setTimeout(enableFeatures, 250);
        const yttvValues = Object.values(window._yttv);

        // Enable preview mode
        yttvValues.find(a => a instanceof Map && a.has("ENABLE_PREVIEWS_WITH_SOUND"))?.set("ENABLE_PREVIEWS_WITH_SOUND", configRead('enablePreviews'));
    }

    if (document.readyState === 'complete') {
        enableFeatures();
    } else window.addEventListener('load', enableFeatures);

    // High-performance zero-dependency method & property extractor for Fast-Tube
    // Replaces heavy Esprima/Estraverse AST parser with a microsecond-fast tokenizer

    function extractAssignedFunctions(code) {
        if (!code || typeof code !== 'string') return [];

        const results = [];
        const assignRegex = /this\.([a-zA-Z0-9_$]+)\s*=\s*/g;
        let match;

        while ((match = assignRegex.exec(code)) !== null) {
            const propName = match[1];
            const startIdx = match.index + match[0].length;
            let depthParen = 0;
            let depthBrace = 0;
            let depthBracket = 0;
            let endIdx = startIdx;
            let inString = false;
            let strChar = '';

            for (let i = startIdx; i < code.length; i++) {
                const c = code[i];
                if (inString) {
                    if (c === '\\') {
                        i++; // skip escaped char
                        continue;
                    }
                    if (c === strChar) inString = false;
                } else if (c === '"' || c === "'" || c === '`') {
                    inString = true;
                    strChar = c;
                } else if (c === '(') {
                    depthParen++;
                } else if (c === ')') {
                    depthParen--;
                } else if (c === '{') {
                    depthBrace++;
                } else if (c === '}') {
                    depthBrace--;
                } else if (c === '[') {
                    depthBracket++;
                } else if (c === ']') {
                    depthBracket--;
                } else if (c === ';' && depthParen <= 0 && depthBrace <= 0 && depthBracket <= 0) {
                    endIdx = i;
                    break;
                } else if (c === '\n' && depthParen <= 0 && depthBrace <= 0 && depthBracket <= 0) {
                    // If followed by next this. assignment or class method
                    const remaining = code.slice(i).trim();
                    if (/^(?:this\.[a-zA-Z0-9_$]+\s*=|return\b|if\b|[a-zA-Z0-9_$]+\s*\()/.test(remaining)) {
                        endIdx = i;
                        break;
                    }
                }
            }

            if (endIdx === startIdx) endIdx = code.length;
            const rhs = code.slice(startIdx, endIdx).trim();

            results.push({
                left: 'this.' + propName,
                rhs: rhs,
                returned: rhs
            });
        }

        return results;
    }

    let cachedMethodNames = null;

    function getMethodNames(origMethod) {
        if (cachedMethodNames) return cachedMethodNames;

        const functions = extractAssignedFunctions(origMethod.toString());

        const settingActionItem = functions.find(func => {
            return func.rhs && func.rhs.includes('TRANSPORT_CONTROLS_BUTTON_TYPE_PLAYBACK_SETTINGS');
        });
        const settingActionGroup = settingActionItem?.left ? settingActionItem.left.split('.')[1] : null;

        const previousButtonItem = functions.find(func => {
            if (func.rhs && func.rhs.includes('skipNextButton')) {
                const skipNextButtonIndex = func.rhs.indexOf('skipNextButton');
                const skipPreviousButtonIndex = func.rhs.indexOf('skipPreviousButton');
                return skipPreviousButtonIndex > skipNextButtonIndex;
            }
            return false;
        });
        const previousButtonName = previousButtonItem?.left ? previousButtonItem.left.split('.')[1] : null;

        const nextButtonItem = functions.find(func => {
            if (func.rhs && func.rhs.includes('skipPreviousButton')) {
                const skipNextButtonIndex = func.rhs.indexOf('skipNextButton');
                const skipPreviousButtonIndex = func.rhs.indexOf('skipPreviousButton');
                return skipNextButtonIndex > skipPreviousButtonIndex;
            }
            return false;
        });
        const nextButtonName = nextButtonItem?.left ? nextButtonItem.left.split('.')[1] : null;

        const engagementActionItem = functions.find(func => func.rhs && func.rhs.includes('props.data.engagementActions'));
        const engagementActionButton = engagementActionItem?.left ? engagementActionItem.left.split('.')[1] : null;

        cachedMethodNames = {
            settingActionGroup,
            previousButtonName,
            nextButtonName,
            engagementActionButton
        };

        return cachedMethodNames;
    }

    function applyPatches() {
        if (!window._yttv) return setTimeout(applyPatches, 250);
        if (!document.querySelector('video')) return setTimeout(applyPatches, 250);

        const methods = Object.keys(window._yttv).filter(key => {
            return typeof window._yttv[key] === 'function' && window._yttv[key].toString().includes('TRANSPORT_CONTROLS_BUTTON_TYPE_FEATURED_ACTION');
        });

        if (methods.length === 0) {
            setTimeout(applyPatches, 250);
            return;
        }

        if (window._yttv[methods[0]]?.isPatchedByCustomUI) return;

        const origMethod = window._yttv[methods[0]];
        const isClass = /^class\s/.test(origMethod.toString());
        const methodNames = getMethodNames(origMethod);

        function YtlrPlayerActionsContainer() {
            const args = Array.prototype.slice.call(arguments);

            function constructAsNew(ctor, argsList) {
                if (typeof Reflect !== 'undefined' && typeof Reflect.construct === 'function') {
                    return Reflect.construct(ctor, argsList, YtlrPlayerActionsContainer);
                }
                return new origMethod(...argsList);
            }

            if (!(this instanceof YtlrPlayerActionsContainer)) {
                if (isClass) return constructAsNew(origMethod, args);
                return origMethod.apply(this, args);
            }

            let inst;
            if (isClass) {
                inst = constructAsNew(origMethod, args);
            } else {
                origMethod.apply(this, args);
                inst = this;
            }

            const { settingActionGroup, previousButtonName, nextButtonName, engagementActionButton } = methodNames;

            if (settingActionGroup && configRead('enableMPButton')) {
                const origSettingActionGroup = inst[settingActionGroup];
                const pipCommand = {
                    type: "TRANSPORT_CONTROLS_BUTTON_TYPE_PIP",
                    button: {
                        buttonRenderer: ButtonRenderer(
                            false,
                            configRead('enableSwapMPWithPIP') ? 'Picture in Picture' : 'Mini Player',
                            'CLEAR_COOKIES',
                            {
                                customAction: {
                                    action: configRead('enableSwapMPWithPIP') ? 'ENTER_PIP' : 'ENTER_MP',
                                }
                            }
                        )
                    }
                };

                inst[settingActionGroup] = function () {
                    const res = origSettingActionGroup.apply(this, arguments);
                    if (!Array.isArray(res)) return res;

                    // Deduplicate: filter out any existing PIP/Mini Player button to guarantee single entry
                    const filtered = res.filter(item => {
                        if (!item) return false;
                        if (item.type === 'TRANSPORT_CONTROLS_BUTTON_TYPE_PIP') return false;
                        const txt = item.button?.buttonRenderer?.text?.runs?.[0]?.text 
                                 || item.buttonRenderer?.text?.runs?.[0]?.text 
                                 || item.text?.runs?.[0]?.text;
                        if (txt === 'Mini Player' || txt === 'Picture in Picture') return false;
                        const act = item.button?.buttonRenderer?.command?.customAction?.action
                                 || item.buttonRenderer?.command?.customAction?.action;
                        if (act === 'ENTER_MP' || act === 'ENTER_PIP') return false;
                        return true;
                    });

                    const idx = filtered.findIndex(item => item && item.type === 'TRANSPORT_CONTROLS_BUTTON_TYPE_PLAYBACK_SETTINGS');
                    if (idx !== -1) {
                        filtered.splice(idx, 0, pipCommand);
                    } else {
                        filtered.push(pipCommand);
                    }
                    return filtered;
                };
            }

            if (engagementActionButton) {
                const origEngagementActionButton = inst[engagementActionButton];
                const enableSpeed = configRead('enableSpeedControlsButton');
                const enableSuperThanks = configRead('enableSuperThanksButton');
                const enableAIAsk = configRead('enableAIAskButton');
                const enableHighlight = configRead('enableSponsorBlockHighlight');

                const speedButtonObj = {
                    type: 'TRANSPORT_CONTROLS_BUTTON_TYPE_SPEED',
                    button: {
                        buttonRenderer: ButtonRenderer(
                            false,
                            "Speed Controls",
                            'SLOW_MOTION_VIDEO',
                            {
                                customAction: {
                                    action: 'TT_SPEED_SETTINGS_SHOW',
                                }
                            }
                        )
                    }
                };

                const blockedTypes = new Set();
                if (!enableSuperThanks) {
                    blockedTypes.add('TRANSPORT_CONTROLS_BUTTON_TYPE_SUPER_THANKS');
                    blockedTypes.add('TRANSPORT_CONTROLS_BUTTON_TYPE_SHOPPING');
                }
                if (!enableAIAsk) {
                    blockedTypes.add('TRANSPORT_CONTROLS_BUTTON_TYPE_YOUCHAT_BUTTON');
                }

                inst[engagementActionButton] = function () {
                    const rawRes = origEngagementActionButton.apply(this, arguments);
                    if (!Array.isArray(rawRes)) return rawRes;

                    const seenTypes = new Set();
                    let filtered = [];
                    for (const item of rawRes) {
                        if (!item || blockedTypes.has(item.type)) continue;
                        if (item.type) {
                            if (seenTypes.has(item.type)) continue;
                            seenTypes.add(item.type);
                        }
                        filtered.push(item);
                    }

                    // Dynamically inject SponsorBlock Skip to Highlight button if present
                    const highlightSegment = window.sponsorblock?.segments?.find(s => s.category === 'poi_highlight');
                    if (enableHighlight && highlightSegment && !seenTypes.has('TRANSPORT_CONTROLS_BUTTON_TYPE_SPONSORBLOCK_HIGHLIGHT')) {
                        seenTypes.add('TRANSPORT_CONTROLS_BUTTON_TYPE_SPONSORBLOCK_HIGHLIGHT');
                        filtered.push({
                            type: 'TRANSPORT_CONTROLS_BUTTON_TYPE_SPONSORBLOCK_HIGHLIGHT',
                            button: {
                                buttonRenderer: ButtonRenderer(
                                    false,
                                    t('sponsorblock.toasts.skipToHighlight') || 'Skip to highlight',
                                    'FAST_FORWARD',
                                    {
                                        clickTrackingParams: null,
                                        customAction: {
                                            action: 'SKIP',
                                            parameters: {
                                                time: highlightSegment.segment[0]
                                            }
                                        }
                                    }
                                )
                            }
                        });
                    }

                    if (enableSpeed && !seenTypes.has('TRANSPORT_CONTROLS_BUTTON_TYPE_SPEED')) {
                        seenTypes.add('TRANSPORT_CONTROLS_BUTTON_TYPE_SPEED');
                        filtered.push(speedButtonObj);
                    }

                    return filtered;
                };
            }

            if (configRead('enablePreviousNextButtons')) {
                if (previousButtonName) {
                    inst[previousButtonName] = function () {
                        return ButtonRenderer(
                            false,
                            'Previous',
                            'SKIP_PREVIOUS',
                            {
                                signalAction: {
                                    signal: 'PLAYER_PLAY_PREVIOUS'
                                }
                            }
                        );
                    };
                }

                if (nextButtonName) {
                    inst[nextButtonName] = function () {
                        return ButtonRenderer(
                            false,
                            'Next',
                            'SKIP_NEXT',
                            {
                                signalAction: {
                                    signal: 'PLAYER_PLAY_NEXT'
                                }
                            }
                        );
                    };
                }
            }

            return inst;
        }

        if (configRead('enablePatchingVideoPlayer')) {
            YtlrPlayerActionsContainer.prototype = origMethod.prototype;
            YtlrPlayerActionsContainer.isPatchedByCustomUI = true;
            window._yttv[methods[0]] = YtlrPlayerActionsContainer;
        }
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        applyPatches();
    } else {
        window.addEventListener('DOMContentLoaded', applyPatches);
    }

    const origParse = JSON.parse;
    JSON.parse = function () {
        const r = origParse.apply(this, arguments);

        const disabledSidebarContents = configRead('disabledSidebarContents');
        const disableChannelsOnSidebar = configRead('disableChannelsOnSidebar');
        if (r.items && Array.isArray(r.items) && r.items[0].guideSectionRenderer) {
            for (let i = 0; i < r.items.length; i++) {
                const section = r.items[i].guideSectionRenderer;
                for (let j = 0; j < section.items.length; j++) {
                    const item = section.items[j].guideEntryRenderer;
                    if (!item) continue;
                    if ((disabledSidebarContents?.length && disabledSidebarContents.includes(item.icon?.iconType))
                        || (disableChannelsOnSidebar && item?.thumbnail)) {
                        section.items.splice(j, 1);
                        j--;
                    }
                }
            }
        }

        return r;
    };

    configChangeEmitter.addEventListener('configChange', (e) => {
        if (e.detail.key === 'disabledSidebarContents' || e.detail.key === 'disableChannelsOnSidebar') {
            const commandExecutor = getCommandExecutor();
            if (commandExecutor) {
                commandExecutor.executeFunction(new commandExecutor.commandFunction('reloadGuideAction'));
            }
        }
    });

    function attachToVideoPlayer() {
        const player = document.querySelector('.html5-video-player');
        const video = document.querySelector('video');
        if (!player) return setTimeout(attachToVideoPlayer, 500);

        player.addEventListener('onPlaybackStartExternal', () => {
            try {
                if (window.location.href.indexOf('watch') === -1) return;
                const statsForNerds = player.getStatsForNerds();

                const resolutionMatch = statsForNerds.resolution.match(/(\d+)x(\d+)@([\d.]+)/);
                const pauseFor = configRead('autoFrameRatePauseVideoFor');

                if (resolutionMatch) {
                    const fps = resolutionMatch[3];
                    if (window.h5vcc && window.h5vcc.fasttube && window.h5vcc.fasttube.SetFrameRate) {
                        if (!configRead('autoFrameRate')) {
                            window.h5vcc.fasttube.SetFrameRate(0);
                            return;
                        }
                        if (pauseFor > 0) {
                            video.pause();
                            setTimeout(() => {
                                video.play();
                            }, pauseFor);
                        }
                        window.h5vcc.fasttube.SetFrameRate(parseFloat(fps));
                    }
                }
            } catch (e) {
                console.error('Error in auto frame rate handling:', e);
            }
        });

        const resetFrameRate = () => {
            if (window.h5vcc && window.h5vcc.fasttube && window.h5vcc.fasttube.SetFrameRate) {
                window.h5vcc.fasttube.SetFrameRate(0);
            }
        };

        window.addEventListener('hashchange', () => {
            if (window.location.href.indexOf('watch') === -1) {
                resetFrameRate();
            }
        });

        configChangeEmitter.addEventListener('configChange', (event) => {
            if (event.detail.key === 'autoFrameRate' && !event.detail.value) {
                resetFrameRate();
            }
        });
    }

    attachToVideoPlayer();

    let actualClock;
    let clockInterval;

    configChangeEmitter.addEventListener('configChange', (e) => {
        if (e.detail.key === 'enableClock') {
            toggleClock(e.detail.value);
        } else if (e.detail.key === 'isClock12HourFormat' || e.detail.key === 'clockShowSeconds') {
            if (configRead('enableClock')) {
                // Force a quick update so changes are visible instantly
                updateClock();
            }
        }
    });

    function updateClock() {
        if (!actualClock) return;
        const now = new Date();
        const is12HourFormat = configRead('isClock12HourFormat');
        const secondsEnabled = configRead('clockShowSeconds');

        let hours = now.getHours();
        if (is12HourFormat) {
            hours = hours % 12 || 12;
        }

        hours = hours.toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        actualClock.textContent = `${hours}:${minutes}${secondsEnabled ? `:${seconds}` : ''}${is12HourFormat ? (now.getHours() >= 12 ? ' PM' : ' AM') : ''}`;
    }

    function toggleClock(value) {
        const existingClock = document.getElementById('fasttube-clock');
        if (value && existingClock) return;
        if (!value && existingClock) {
            existingClock.parentNode.removeChild(existingClock);
            if (clockInterval) {
                clearInterval(clockInterval);
                clockInterval = null;
            }
            actualClock = null;
            return;
        }
        if (!value && !existingClock) {
            return;
        } else {
            const clock = document.createElement('div');
     
            clock.id = 'fasttube-clock';
            clock.style.height = '45rem';
            clock.style.width = '80rem';
            clock.style.position = 'absolute';
            clock.style.top = '50%';
            clock.style.left = '50%';
            clock.style.marginTop = '-22.5rem';
            clock.style.marginLeft = '-40rem';

            actualClock = document.createElement('div');

            actualClock.style.position = 'absolute';
            actualClock.style.zIndex = '9999';
            actualClock.style.right = '5%';
            actualClock.style.top = '2%';
            actualClock.style.fontSize = '1.5em';
            clock.appendChild(actualClock);
            document.body.appendChild(clock);

            updateClock();
            if (clockInterval) clearInterval(clockInterval);
            clockInterval = setInterval(updateClock, 1000);
        }
    }

    toggleClock(configRead('enableClock'));

    if (window.location.hostname === 'localhost') {
        initPatches();
    }

})();
