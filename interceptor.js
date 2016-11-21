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

export function createAsyncInterceptor(callbacks, data) {
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

export function wrapCallback(original) {
    if (!interceptor || interceptor.flags <= 0) {
        return original;
    }
    return aysncWrap(original);
};