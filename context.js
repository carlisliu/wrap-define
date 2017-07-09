import {
    createAsyncInterceptor
} from './interceptor';

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

export default function create(name) {
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
                var key = 'moduleId';
                if (error && storage[key]) {
                    error[key] = storage[key];
                }
            }
        }
    });
    return context;
}