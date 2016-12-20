import createContext from './context';
import {
    wrapCallback
} from './interceptor';
import window from 'window';
import {
    isFunction,
    isArray,
    isString
} from 'js-is-type'
import wrap from 'func-wrapper';

var context = createContext();

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

export default function decorate(define) {
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