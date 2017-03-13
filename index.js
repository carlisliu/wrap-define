import window from 'window';
import decorate from './decorate';
import wrap from 'func-wrapper';

export default function wrapDefine() {
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