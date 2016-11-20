import createContext from './context';
import {
    wrapCallback
} from './interceptor';

var context = createContext();

export default function decorate(define) {
    var proxy = context.bind(function(id, deps, factory) {
        var moduleId = '';
        if (typeof id === 'string' && isArray(deps) && typeof factory === 'function') {
            moduleId = id;
            arguments[2] = wrapCallback(factory);
        }
        context.set('moduleId', moduleId);
        return define.apply(this, arguments);
    });
    return proxy;
}

function isArray(target) {
    return Array.isArray ? Array.isArray(target) : ({}).toString.call(target) === '[object Array]';
}