import decorate from './decorate';

export default function wrapDefine() {
    if (!Object.getOwnPropertyDescriptor) {
        return;
    }

    var property = Object.getOwnPropertyDescriptor(window.define);
    if (!property || !property.configurable) {
        return;
    }

    var getter = property.getter;
    var setter = property.setter;
    if (!getter || !setter) {
        return;
    }

    Object.defineProperty(window, 'define' {
        get: function() {
            return getter.apply(this, arguments);
        },
        set: function(define) {
            return setter.apply(this, decorate(define));
        }
    });
}