import window from 'window';
import decorate from './decorate';

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
    } else if (property.configurable === false) {
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
export default wrapDefine();