var newDefine = (function (window) {
'use strict';

function isType(type) {
    return function(arg) {
        if (type === 'Array' && Array.isArray) {
            return Array.isArray;
        }
        return Object.prototype.toString.call(arg) === "[object " + type + "]";
    }
}

var isString = isType('String');
var isArray = isType('Array');
var isFunction = isType('Function');
var isObject = isType('Object');

var HAS_CREATE_CALLBACK = 1 << 0;
var HAS_BEFORE_CALLBACK = 1 << 1;
var HAS_AFTER_CALLBACK = 1 << 2;
var HAS_ERROR_CALLBACK = 1 << 3;

function Interceptor(callbacks, data) {
    this.flags = 0;
    if (isFunction(callbacks.create)) {
        this.create = callbacks.create;
        this.flags |= HAS_CREATE_CALLBACK;
    }
    if (isFunction(callbacks.before)) {
        this.before = callbacks.before;
        this.flags |= HAS_BEFORE_CALLBACK;
    }
    if (isFunction(callbacks.after)) {
        this.after = callbacks.after;
        this.flags |= HAS_AFTER_CALLBACK;
    }
    if (isFunction(callbacks.error)) {
        this.error = callbacks.error;
        this.flags |= HAS_ERROR_CALLBACK;
    }
    this.data = data;
}

var prototype = Interceptor.prototype;
prototype.create = prototype.before = prototype.after = prototype.error = null;

var interceptor;
var errorValue;

function createAsyncInterceptor(callbacks, data) {
    if (interceptor) {
        return;
    }
    if (!isObject(callbacks) || !callbacks) {
        throw new TypeError('callbacks arguments must be an object');
    }
    interceptor = new Interceptor(callbacks, data);
    return interceptor;
}

function aysncWrap(original) {
    var value = interceptor.data;
    if ((interceptor.flags & HAS_CREATE_CALLBACK) !== 0) {
        var data = interceptor.create(interceptor.data);
        if (data !== undefined) {
            value = data;
        }
    }
    return function() {
        errorValue = value;
        if ((interceptor.flags & HAS_BEFORE_CALLBACK) !== 0) {
            interceptor.before(this, value);
        }
        try {
            var result = original.apply(this, arguments);
        } catch (error) {
            if ((interceptor.flags & HAS_ERROR_CALLBACK) !== 0) {
                interceptor.error(value, error);
            }
            throw error;
        }
        if ((interceptor.flags & HAS_AFTER_CALLBACK) !== 0) {
            interceptor.after(this, value);
        }
        return result;
    }
}

function wrapCallback(original) {
    if (!interceptor || interceptor.flags <= 0) {
        return original;
    }
    return aysncWrap(original);
}

function Context(name) {
    this.name = name;
    this.active = null;
    this._set = [];
    this.id = null;
}

Context.prototype = {
    set: function(key, value) {
        if (!this.active) {
            throw new Error('No context is available');
        }
        this.active[key] = value;
        return value;
    },
    get: function(key) {
        if (!this.active) {
            return undefined;
        }
        return this.active[key];
    },
    bind: function(fn, context) {
        context = this.active || Object.create(this.active);
        var self = this;
        return function() {
            self.enter(context);
            try {
                return fn.apply(this, arguments);
            } catch (e) {
                if (e) {
                    e['__context__'] = context;
                }
                throw e;

            } finally {
                self.exit(context);
            }
        }
    },
    enter: function(context) {
        if (!context) {
            throw new Error('context must be provided.');
        }
        this._set.push(this.active);
        this.active = context;
    },
    exit: function(context) {
        if (!context) {
            throw new Error('context must be provided');
        }
        if (this.active === context) {
            if (this._set.length <= 0) {
                throw new Error('can not remove top context');
            }
            this.active = this._set.pop();
            return;
        }

        var index = this._set.lastIndexOf(context);
        if (index < 0) {
            throw new Error('context not currently entered.');
        }
        if (index == 0) {
            throw new Error('can not remove top context');
        }
        this._set.splice(index, 1);
    }
};

function create(name) {
    var context = new Context(name);
    context.id = createAsyncInterceptor({
        create: function() {
            return context.active;
        },
        before: function(_this, storage) {
            if (storage) {
                context.enter(storage);
            }
        },
        after: function(_this, storage) {
            if (storage) {
                context.exit(storage);
            }
        },
        error: function(storage, error) {
            if (storage) {
                context.exit(storage);
                if (error && storage['moduleId']) {
                    error['moduleId'] = storage['moduleId'];
                }
            }
        }
    });
    return context;
}

function wrap(target, name, wrapper) {
    if (!target) {
        return;
    }
    if (!wrapper) {
        return;
    }
    if (!isFunction(wrapper)) {
        return;
    }
    var original = target[name];
    if (original && original._wrapped) {
        return;
    }
    var wrapped = wrapper(original);
    wrapped._wrapped = true;
    target[name] = wrapped;
    return wrapped;
}

var context = create();

if (window.EventTarget) {
    wrap(window.EventTarget.prototype, 'addEventListener', function(addEventListener) {
        return function(event, listener, captured) {
            arguments[1] = wrapCallback(listener);
            return addEventListener.apply(this, arguments);
        }
    });
}

massWrap(window, ['setTimeout', 'setInterval'], function(timer) {
    return function(listener) {
        if (isFunction(listener)) {
            arguments[0] = wrapCallback(listener);
        }
        return timer.apply(this, arguments);
    }
});

function massWrap(module, methods, wrapper) {
    if (!isArray(methods)) {
        methods = [methods];
    }
    for (var i = methods.length - 1; i >= 0; i--) {
        wrap(module, methods[i], wrapper);
    }
}

function decorate(define) {
    return function(id, deps, factory) {
        if (isString(id) && isArray(deps) && isFunction(factory)) {
            arguments[2] = context.bind(function() {
                context.set('moduleId', id);
                return wrapCallback(factory).apply(this, arguments);
            });
        }
        return define.apply(this, arguments);
    }
}

function wrapDefine() {
    if (!Object.getOwnPropertyDescriptor) {
        return;
    }
    var property = Object.getOwnPropertyDescriptor(window, 'define');
    var define = window.define;
    if (!property) {
        Object.defineProperty(window, 'define', {
            get: function() {
                return define;
            },
            set: function(newDefine) {
                define = decorate(newDefine);
            }
        });
    } else {
        wrap(window, 'define', function(define) {
            return decorate(define);
        });
    }
}

return wrapDefine;

}(window));
