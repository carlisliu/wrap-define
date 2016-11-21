import createContext from './context';
import {
    wrapCallback
} from './interceptor';

var context = createContext();

var addEventListener = window.EventTarget.prototype.addEventListener;
window.EventTarget.prototype.addEventListener = function(event, listener, captured) {
    arguments[1] = wrapCallback(listener);
    return addEventListener.apply(this, arguments);
};

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