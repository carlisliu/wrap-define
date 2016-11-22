var newDefine = (function (window) {
'use strict';

var HAS_CREATE_CALLBACK = 1 << 0;
var HAS_BEFORE_CALLBACK = 1 << 1;
var HAS_AFTER_CALLBACK = 1 << 2;
var HAS_ERROR_CALLBACK = 1 << 3;

function Interceptor(callbacks, data) {
    this.flags = 0;
    if (typeof callbacks.create) {
        this.create = callbacks.create;
        this.flags |= HAS_CREATE_CALLBACK;
    }
    if (typeof callbacks.before) {
        this.before = callbacks.before;
        this.flags |= HAS_BEFORE_CALLBACK;
    }
    if (typeof callbacks.after) {
        this.after = callbacks.after;
        this.flags |= HAS_AFTER_CALLBACK;
    }
    if (typeof callbacks.error) {
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
    if (typeof callbacks !== 'object' || !callbacks) {
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

var context = create();

var addEventListener = window.EventTarget.prototype.addEventListener;
window.EventTarget.prototype.addEventListener = function(event, listener, captured) {
    arguments[1] = wrapCallback(listener);
    return addEventListener.apply(this, arguments);
};

function decorate(define) {
    return function(id, deps, factory) {
        if (typeof id === 'string' && isArray(deps) && typeof factory === 'function') {
            arguments[2] = context.bind(function() {
                context.set('moduleId', id);
                return wrapCallback(factory).apply(this, arguments);
            });
        }
        return define.apply(this, arguments);
    }
}

function isArray(target) {
    return Array.isArray ? Array.isArray(target) : ({}).toString.call(target) === '[object Array]';
}

function wrapDefine() {
    if (!Object.getOwnPropertyDescriptor) {
        return;
    }

    var property = Object.getOwnPropertyDescriptor(window, 'define');
    if (!property) {
        var define = window.define;
        Object.defineProperty(window, 'define', {
            get: function() {
                return define;
            },
            set: function(newDefine) {
                define = decorate(newDefine);
            }
        });
        return;
    }
    if (property.configurable === false) {
        return;
    }

    var getter = property.getter;
    var setter = property.setter;
    if (!getter || !setter) {
        return;
    }

    Object.defineProperty(window, 'define', {
        get: function() {
            return getter.apply(this, arguments);
        },
        set: function(define) {
            return setter.apply(this, decorate(define));
        }
    });
}

var index = wrapDefine();

return index;

}(window));
