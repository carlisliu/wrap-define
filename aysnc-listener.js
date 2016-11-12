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

  // Make sure the listener isn't already in the list.
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

  // no context to capture, so avoid closure creation
  if (length === 0) return original;

  // capture the active listeners as of when the wrapped function was called
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

  // still need to make sure nested async calls are made in the context
  // of the listeners active at their creation
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

  /* One of the main differences between this polyfill and the core
   * asyncListener support is that core avoids creating closures by putting a
   * lot of the state managemnt on the C++ side of Node (and of course also it
   * bakes support for async listeners into the Node C++ API through the
   * AsyncWrap class, which means that it doesn't monkeypatch basically every
   * async method like this does).
   */
  return function() {
    // put the current values where the catcher can see them
    errorValues = values;

    /* More than one listener can end up inside these closures, so save the
     * current listeners on a stack.
     */
    listenerStack.push(listeners);

    /* Activate both the listeners that were active when the closure was
     * created and the listeners that were previously active.
     */
    listeners = union(list, listeners);

    /*
     * before handlers
     */
    inAsyncTick = true;
    for (var i = 0; i < length; ++i) {
      if ((list[i].flags & HAS_BEFORE_AL) > 0) {
        list[i].before(this, values[list[i].uid]);
      }
    }
    inAsyncTick = false;

    // save the return value to pass to the after callbacks
    var returned = original.apply(this, arguments);

    /*
     * after handlers (not run if original throws)
     */
    inAsyncTick = true;
    for (i = 0; i < length; ++i) {
      if ((list[i].flags & HAS_AFTER_AL) > 0) {
        list[i].after(this, values[list[i].uid]);
      }
    }
    inAsyncTick = false;

    // back to the previous listener list on the stack
    listeners = listenerStack.pop();
    errorValues = undefined;

    return returned;
  };
};