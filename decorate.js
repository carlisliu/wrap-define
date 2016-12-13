import createContext from './context';
import {
    wrapCallback
} from './interceptor';
import window from 'window';

var context = createContext();

if (window.EventTarget) {
    wrap(window.EventTarget.prototype, 'addEventListener', function(addEventListener) {
        return function(event, listener, captured) {
            arguments[1] = wrapCallback(listener);
            return addEventListener.apply(this, arguments);
        }
    });
}

wrap(window, ['setTimeout', 'setInterval'], function(timer) {
    return function(listener) {
        if (typeof listener === 'function') {
            arguments[0] = wrapCallback(listener);
        }
        return timer.apply(this, arguments);
    }
});

function wrap(module, methods, wrapper) {
    if (!module || !methods) {
        return;
    }
    if (typeof wrapper !== 'function') {
        return;
    }
    if (!isArray(methods)) {
        methods = [methods];
    }
    for (var i = methods.length - 1; i >= 0; i--) {
        var method = methods[i];
        var original = module[method];
        if (!original || typeof original !== 'function') {
            continue;
        }
        module[method] = wrapper(original, method);
    }
}

export default function decorate(define) {
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