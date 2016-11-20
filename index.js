import window from 'window';
import decorate from './decorate';

function wrapDefine() {
    
    var define = window.define;

    Object.defineProperty(window, 'define', {
        get: function() {
            return define;
        },
        set: function(newDefine) {
            define = decorate(newDefine);
        }
    });
}

export default wrapDefine();