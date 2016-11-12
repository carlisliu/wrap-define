/**
* borrow from https://github.com/othiym23/async-listener
*/

var uid = 0;
var listeners = [];

function AsyncListener(callbacks, data) {
  if (typeof callbacks.create === 'function') {
    this.create = callbacks.create;
    this.flags |= HAS_CREATE_AL;
  }

  if (typeof callbacks.before === 'function') {
    this.before = callbacks.before;
    this.flags |= HAS_BEFORE_AL;
  }

  if (typeof callbacks.after === 'function') {
    this.after = callbacks.after;
    this.flags |= HAS_AFTER_AL;
  }

  if (typeof callbacks.error === 'function') {
    this.error = callbacks.error;
    this.flags |= HAS_ERROR_AL;
  }

  this.uid = ++uid;
  this.data = data === undefined ? null : data;
}

AsyncListener.prototype.create = undefined;
AsyncListener.prototype.before = undefined;
AsyncListener.prototype.after = undefined;
AsyncListener.prototype.error = undefined;
AsyncListener.prototype.data = undefined;
AsyncListener.prototype.uid = 0;
AsyncListener.prototype.flags = 0;

function createAsyncListener(callbacks, data) {
  if (typeof callbacks !== 'object' || !callbacks) {
    throw new TypeError('callbacks argument must be an object');
  }

  if (callbacks instanceof AsyncListener) {
    return callbacks;
  } else {
    return new AsyncListener(callbacks, data);
  }
}

function addAsyncListener(callbacks, data) {
  var listener;
  if (!(callbacks instanceof AsyncListener)) {
    listener = createAsyncListener(callbacks, data);
  } else {
    listener = callbacks;
  }

  var registered = false;
  for (var i = 0; i < listeners.length; i++) {
    if (listener === listeners[i]) {
      registered = true;
      break;
    }
  }

  if (!registered) listeners.push(listener);

  return listener;
}

export default function wrapCallback(original) {
  var length = listeners.length;

  if (length === 0) return original;

  var list = listeners.slice();

  for (var i = 0; i < length; ++i) {
    if (list[i].flags > 0) return asyncWrap(original, list, length);
  }

  return simpleWrap(original, list, length);
}

function simpleWrap(original, list, length) {
  inAsyncTick = true;
  for (var i = 0; i < length; ++i) {
    var listener = list[i];
    if (listener.create) listener.create(listener.data);
  }
  inAsyncTick = false;

  return function() {
    listenerStack.push(listeners);
    listeners = union(list, listeners);

    var returned = original.apply(this, arguments);

    listeners = listenerStack.pop();

    return returned;
  };
}

var HAS_CREATE_AL = 1 << 0;
var HAS_BEFORE_AL = 1 << 1;
var HAS_AFTER_AL = 1 << 2;
var HAS_ERROR_AL = 1 << 3;

var inAsyncTick;
var errorValues;
var listenerStack = [];

function union(dest, added) {
  var destLength = dest.length;
  var addedLength = added.length;
  var returned = [];

  if (destLength === 0 && addedLength === 0) return returned;

  for (var j = 0; j < destLength; j++) returned[j] = dest[j];

  if (addedLength === 0) return returned;

  for (var i = 0; i < addedLength; i++) {
    var missing = true;
    for (j = 0; j < destLength; j++) {
      if (dest[j].uid === added[i].uid) {
        missing = false;
        break;
      }
    }
    if (missing) returned.push(added[i]);
  }

  return returned;
}

var asyncWrap = function asyncWrap(original, list, length) {
  var values = [];

  inAsyncTick = true;
  for (var i = 0; i < length; ++i) {
    var listener = list[i];
    values[listener.uid] = listener.data;

    if ((listener.flags & HAS_CREATE_AL) === 0) continue;

    var value = listener.create(listener.data);
    if (value !== undefined) values[listener.uid] = value;
  }
  inAsyncTick = false;

  return function() {
    errorValues = values;

    listenerStack.push(listeners);

    listeners = union(list, listeners);

    inAsyncTick = true;
    for (var i = 0; i < length; ++i) {
      if ((list[i].flags & HAS_BEFORE_AL) > 0) {
        list[i].before(this, values[list[i].uid]);
      }
    }
    inAsyncTick = false;

    var returned = original.apply(this, arguments);

    inAsyncTick = true;
    for (i = 0; i < length; ++i) {
      if ((list[i].flags & HAS_AFTER_AL) > 0) {
        list[i].after(this, values[list[i].uid]);
      }
    }
    inAsyncTick = false;

    listeners = listenerStack.pop();
    errorValues = undefined;

    return returned;
  };
};