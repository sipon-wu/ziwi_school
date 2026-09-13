var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/react/cjs/react.development.js
var require_react_development = __commonJS({
  "node_modules/react/cjs/react.development.js"(exports, module) {
    "use strict";
    (function() {
      function defineDeprecationWarning(methodName, info) {
        Object.defineProperty(Component.prototype, methodName, {
          get: function() {
            console.warn(
              "%s(...) is deprecated in plain JavaScript React classes. %s",
              info[0],
              info[1]
            );
          }
        });
      }
      function getIteratorFn(maybeIterable) {
        if (null === maybeIterable || "object" !== typeof maybeIterable)
          return null;
        maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
        return "function" === typeof maybeIterable ? maybeIterable : null;
      }
      function warnNoop(publicInstance, callerName) {
        publicInstance = (publicInstance = publicInstance.constructor) && (publicInstance.displayName || publicInstance.name) || "ReactClass";
        var warningKey = publicInstance + "." + callerName;
        didWarnStateUpdateForUnmountedComponent[warningKey] || (console.error(
          "Can't call %s on a component that is not yet mounted. This is a no-op, but it might indicate a bug in your application. Instead, assign to `this.state` directly or define a `state = {};` class property with the desired state in the %s component.",
          callerName,
          publicInstance
        ), didWarnStateUpdateForUnmountedComponent[warningKey] = true);
      }
      function Component(props, context, updater) {
        this.props = props;
        this.context = context;
        this.refs = emptyObject;
        this.updater = updater || ReactNoopUpdateQueue;
      }
      function ComponentDummy() {
      }
      function PureComponent(props, context, updater) {
        this.props = props;
        this.context = context;
        this.refs = emptyObject;
        this.updater = updater || ReactNoopUpdateQueue;
      }
      function noop() {
      }
      function testStringCoercion(value) {
        return "" + value;
      }
      function checkKeyStringCoercion(value) {
        try {
          testStringCoercion(value);
          var JSCompiler_inline_result = false;
        } catch (e) {
          JSCompiler_inline_result = true;
        }
        if (JSCompiler_inline_result) {
          JSCompiler_inline_result = console;
          var JSCompiler_temp_const = JSCompiler_inline_result.error;
          var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
          JSCompiler_temp_const.call(
            JSCompiler_inline_result,
            "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.",
            JSCompiler_inline_result$jscomp$0
          );
          return testStringCoercion(value);
        }
      }
      function getComponentNameFromType(type) {
        if (null == type) return null;
        if ("function" === typeof type)
          return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
        if ("string" === typeof type) return type;
        switch (type) {
          case REACT_FRAGMENT_TYPE:
            return "Fragment";
          case REACT_PROFILER_TYPE:
            return "Profiler";
          case REACT_STRICT_MODE_TYPE:
            return "StrictMode";
          case REACT_SUSPENSE_TYPE:
            return "Suspense";
          case REACT_SUSPENSE_LIST_TYPE:
            return "SuspenseList";
          case REACT_ACTIVITY_TYPE:
            return "Activity";
        }
        if ("object" === typeof type)
          switch ("number" === typeof type.tag && console.error(
            "Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."
          ), type.$$typeof) {
            case REACT_PORTAL_TYPE:
              return "Portal";
            case REACT_CONTEXT_TYPE:
              return type.displayName || "Context";
            case REACT_CONSUMER_TYPE:
              return (type._context.displayName || "Context") + ".Consumer";
            case REACT_FORWARD_REF_TYPE:
              var innerType = type.render;
              type = type.displayName;
              type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
              return type;
            case REACT_MEMO_TYPE:
              return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
            case REACT_LAZY_TYPE:
              innerType = type._payload;
              type = type._init;
              try {
                return getComponentNameFromType(type(innerType));
              } catch (x) {
              }
          }
        return null;
      }
      function getTaskName(type) {
        if (type === REACT_FRAGMENT_TYPE) return "<>";
        if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE)
          return "<...>";
        try {
          var name = getComponentNameFromType(type);
          return name ? "<" + name + ">" : "<...>";
        } catch (x) {
          return "<...>";
        }
      }
      function getOwner() {
        var dispatcher = ReactSharedInternals.A;
        return null === dispatcher ? null : dispatcher.getOwner();
      }
      function UnknownOwner() {
        return Error("react-stack-top-frame");
      }
      function hasValidKey(config) {
        if (hasOwnProperty.call(config, "key")) {
          var getter = Object.getOwnPropertyDescriptor(config, "key").get;
          if (getter && getter.isReactWarning) return false;
        }
        return void 0 !== config.key;
      }
      function defineKeyPropWarningGetter(props, displayName) {
        function warnAboutAccessingKey() {
          specialPropKeyWarningShown || (specialPropKeyWarningShown = true, console.error(
            "%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)",
            displayName
          ));
        }
        warnAboutAccessingKey.isReactWarning = true;
        Object.defineProperty(props, "key", {
          get: warnAboutAccessingKey,
          configurable: true
        });
      }
      function elementRefGetterWithDeprecationWarning() {
        var componentName = getComponentNameFromType(this.type);
        didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = true, console.error(
          "Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."
        ));
        componentName = this.props.ref;
        return void 0 !== componentName ? componentName : null;
      }
      function ReactElement(type, key, props, owner, debugStack, debugTask) {
        var refProp = props.ref;
        type = {
          $$typeof: REACT_ELEMENT_TYPE,
          type,
          key,
          props,
          _owner: owner
        };
        null !== (void 0 !== refProp ? refProp : null) ? Object.defineProperty(type, "ref", {
          enumerable: false,
          get: elementRefGetterWithDeprecationWarning
        }) : Object.defineProperty(type, "ref", { enumerable: false, value: null });
        type._store = {};
        Object.defineProperty(type._store, "validated", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: 0
        });
        Object.defineProperty(type, "_debugInfo", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: null
        });
        Object.defineProperty(type, "_debugStack", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: debugStack
        });
        Object.defineProperty(type, "_debugTask", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: debugTask
        });
        Object.freeze && (Object.freeze(type.props), Object.freeze(type));
        return type;
      }
      function cloneAndReplaceKey(oldElement, newKey) {
        newKey = ReactElement(
          oldElement.type,
          newKey,
          oldElement.props,
          oldElement._owner,
          oldElement._debugStack,
          oldElement._debugTask
        );
        oldElement._store && (newKey._store.validated = oldElement._store.validated);
        return newKey;
      }
      function validateChildKeys(node) {
        isValidElement(node) ? node._store && (node._store.validated = 1) : "object" === typeof node && null !== node && node.$$typeof === REACT_LAZY_TYPE && ("fulfilled" === node._payload.status ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
      }
      function isValidElement(object) {
        return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
      }
      function escape2(key) {
        var escaperLookup = { "=": "=0", ":": "=2" };
        return "$" + key.replace(/[=:]/g, function(match) {
          return escaperLookup[match];
        });
      }
      function getElementKey(element, index) {
        return "object" === typeof element && null !== element && null != element.key ? (checkKeyStringCoercion(element.key), escape2("" + element.key)) : index.toString(36);
      }
      function resolveThenable(thenable) {
        switch (thenable.status) {
          case "fulfilled":
            return thenable.value;
          case "rejected":
            throw thenable.reason;
          default:
            switch ("string" === typeof thenable.status ? thenable.then(noop, noop) : (thenable.status = "pending", thenable.then(
              function(fulfilledValue) {
                "pending" === thenable.status && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
              },
              function(error) {
                "pending" === thenable.status && (thenable.status = "rejected", thenable.reason = error);
              }
            )), thenable.status) {
              case "fulfilled":
                return thenable.value;
              case "rejected":
                throw thenable.reason;
            }
        }
        throw thenable;
      }
      function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
        var type = typeof children;
        if ("undefined" === type || "boolean" === type) children = null;
        var invokeCallback = false;
        if (null === children) invokeCallback = true;
        else
          switch (type) {
            case "bigint":
            case "string":
            case "number":
              invokeCallback = true;
              break;
            case "object":
              switch (children.$$typeof) {
                case REACT_ELEMENT_TYPE:
                case REACT_PORTAL_TYPE:
                  invokeCallback = true;
                  break;
                case REACT_LAZY_TYPE:
                  return invokeCallback = children._init, mapIntoArray(
                    invokeCallback(children._payload),
                    array,
                    escapedPrefix,
                    nameSoFar,
                    callback
                  );
              }
          }
        if (invokeCallback) {
          invokeCallback = children;
          callback = callback(invokeCallback);
          var childKey = "" === nameSoFar ? "." + getElementKey(invokeCallback, 0) : nameSoFar;
          isArrayImpl(callback) ? (escapedPrefix = "", null != childKey && (escapedPrefix = childKey.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function(c) {
            return c;
          })) : null != callback && (isValidElement(callback) && (null != callback.key && (invokeCallback && invokeCallback.key === callback.key || checkKeyStringCoercion(callback.key)), escapedPrefix = cloneAndReplaceKey(
            callback,
            escapedPrefix + (null == callback.key || invokeCallback && invokeCallback.key === callback.key ? "" : ("" + callback.key).replace(
              userProvidedKeyEscapeRegex,
              "$&/"
            ) + "/") + childKey
          ), "" !== nameSoFar && null != invokeCallback && isValidElement(invokeCallback) && null == invokeCallback.key && invokeCallback._store && !invokeCallback._store.validated && (escapedPrefix._store.validated = 2), callback = escapedPrefix), array.push(callback));
          return 1;
        }
        invokeCallback = 0;
        childKey = "" === nameSoFar ? "." : nameSoFar + ":";
        if (isArrayImpl(children))
          for (var i = 0; i < children.length; i++)
            nameSoFar = children[i], type = childKey + getElementKey(nameSoFar, i), invokeCallback += mapIntoArray(
              nameSoFar,
              array,
              escapedPrefix,
              type,
              callback
            );
        else if (i = getIteratorFn(children), "function" === typeof i)
          for (i === children.entries && (didWarnAboutMaps || console.warn(
            "Using Maps as children is not supported. Use an array of keyed ReactElements instead."
          ), didWarnAboutMaps = true), children = i.call(children), i = 0; !(nameSoFar = children.next()).done; )
            nameSoFar = nameSoFar.value, type = childKey + getElementKey(nameSoFar, i++), invokeCallback += mapIntoArray(
              nameSoFar,
              array,
              escapedPrefix,
              type,
              callback
            );
        else if ("object" === type) {
          if ("function" === typeof children.then)
            return mapIntoArray(
              resolveThenable(children),
              array,
              escapedPrefix,
              nameSoFar,
              callback
            );
          array = String(children);
          throw Error(
            "Objects are not valid as a React child (found: " + ("[object Object]" === array ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead."
          );
        }
        return invokeCallback;
      }
      function mapChildren(children, func, context) {
        if (null == children) return children;
        var result = [], count = 0;
        mapIntoArray(children, result, "", "", function(child) {
          return func.call(context, child, count++);
        });
        return result;
      }
      function lazyInitializer(payload) {
        if (-1 === payload._status) {
          var ioInfo = payload._ioInfo;
          null != ioInfo && (ioInfo.start = ioInfo.end = performance.now());
          ioInfo = payload._result;
          var thenable = ioInfo();
          thenable.then(
            function(moduleObject) {
              if (0 === payload._status || -1 === payload._status) {
                payload._status = 1;
                payload._result = moduleObject;
                var _ioInfo = payload._ioInfo;
                null != _ioInfo && (_ioInfo.end = performance.now());
                void 0 === thenable.status && (thenable.status = "fulfilled", thenable.value = moduleObject);
              }
            },
            function(error) {
              if (0 === payload._status || -1 === payload._status) {
                payload._status = 2;
                payload._result = error;
                var _ioInfo2 = payload._ioInfo;
                null != _ioInfo2 && (_ioInfo2.end = performance.now());
                void 0 === thenable.status && (thenable.status = "rejected", thenable.reason = error);
              }
            }
          );
          ioInfo = payload._ioInfo;
          if (null != ioInfo) {
            ioInfo.value = thenable;
            var displayName = thenable.displayName;
            "string" === typeof displayName && (ioInfo.name = displayName);
          }
          -1 === payload._status && (payload._status = 0, payload._result = thenable);
        }
        if (1 === payload._status)
          return ioInfo = payload._result, void 0 === ioInfo && console.error(
            "lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))\n\nDid you accidentally put curly braces around the import?",
            ioInfo
          ), "default" in ioInfo || console.error(
            "lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))",
            ioInfo
          ), ioInfo.default;
        throw payload._result;
      }
      function resolveDispatcher() {
        var dispatcher = ReactSharedInternals.H;
        null === dispatcher && console.error(
          "Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem."
        );
        return dispatcher;
      }
      function releaseAsyncTransition() {
        ReactSharedInternals.asyncTransitions--;
      }
      function enqueueTask(task) {
        if (null === enqueueTaskImpl)
          try {
            var requireString = ("require" + Math.random()).slice(0, 7);
            enqueueTaskImpl = (module && module[requireString]).call(
              module,
              "timers"
            ).setImmediate;
          } catch (_err) {
            enqueueTaskImpl = function(callback) {
              false === didWarnAboutMessageChannel && (didWarnAboutMessageChannel = true, "undefined" === typeof MessageChannel && console.error(
                "This browser does not have a MessageChannel implementation, so enqueuing tasks via await act(async () => ...) will fail. Please file an issue at https://github.com/facebook/react/issues if you encounter this warning."
              ));
              var channel = new MessageChannel();
              channel.port1.onmessage = callback;
              channel.port2.postMessage(void 0);
            };
          }
        return enqueueTaskImpl(task);
      }
      function aggregateErrors(errors) {
        return 1 < errors.length && "function" === typeof AggregateError ? new AggregateError(errors) : errors[0];
      }
      function popActScope(prevActQueue, prevActScopeDepth) {
        prevActScopeDepth !== actScopeDepth - 1 && console.error(
          "You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. "
        );
        actScopeDepth = prevActScopeDepth;
      }
      function recursivelyFlushAsyncActWork(returnValue, resolve, reject) {
        var queue = ReactSharedInternals.actQueue;
        if (null !== queue)
          if (0 !== queue.length)
            try {
              flushActQueue(queue);
              enqueueTask(function() {
                return recursivelyFlushAsyncActWork(returnValue, resolve, reject);
              });
              return;
            } catch (error) {
              ReactSharedInternals.thrownErrors.push(error);
            }
          else ReactSharedInternals.actQueue = null;
        0 < ReactSharedInternals.thrownErrors.length ? (queue = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, reject(queue)) : resolve(returnValue);
      }
      function flushActQueue(queue) {
        if (!isFlushing) {
          isFlushing = true;
          var i = 0;
          try {
            for (; i < queue.length; i++) {
              var callback = queue[i];
              do {
                ReactSharedInternals.didUsePromise = false;
                var continuation = callback(false);
                if (null !== continuation) {
                  if (ReactSharedInternals.didUsePromise) {
                    queue[i] = callback;
                    queue.splice(0, i);
                    return;
                  }
                  callback = continuation;
                } else break;
              } while (1);
            }
            queue.length = 0;
          } catch (error) {
            queue.splice(0, i + 1), ReactSharedInternals.thrownErrors.push(error);
          } finally {
            isFlushing = false;
          }
        }
      }
      "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
      var REACT_ELEMENT_TYPE = /* @__PURE__ */ Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = /* @__PURE__ */ Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = /* @__PURE__ */ Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = /* @__PURE__ */ Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = /* @__PURE__ */ Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = /* @__PURE__ */ Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = /* @__PURE__ */ Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = /* @__PURE__ */ Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = /* @__PURE__ */ Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = /* @__PURE__ */ Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = /* @__PURE__ */ Symbol.for("react.memo"), REACT_LAZY_TYPE = /* @__PURE__ */ Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = /* @__PURE__ */ Symbol.for("react.activity"), MAYBE_ITERATOR_SYMBOL = Symbol.iterator, didWarnStateUpdateForUnmountedComponent = {}, ReactNoopUpdateQueue = {
        isMounted: function() {
          return false;
        },
        enqueueForceUpdate: function(publicInstance) {
          warnNoop(publicInstance, "forceUpdate");
        },
        enqueueReplaceState: function(publicInstance) {
          warnNoop(publicInstance, "replaceState");
        },
        enqueueSetState: function(publicInstance) {
          warnNoop(publicInstance, "setState");
        }
      }, assign = Object.assign, emptyObject = {};
      Object.freeze(emptyObject);
      Component.prototype.isReactComponent = {};
      Component.prototype.setState = function(partialState, callback) {
        if ("object" !== typeof partialState && "function" !== typeof partialState && null != partialState)
          throw Error(
            "takes an object of state variables to update or a function which returns an object of state variables."
          );
        this.updater.enqueueSetState(this, partialState, callback, "setState");
      };
      Component.prototype.forceUpdate = function(callback) {
        this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
      };
      var deprecatedAPIs = {
        isMounted: [
          "isMounted",
          "Instead, make sure to clean up subscriptions and pending requests in componentWillUnmount to prevent memory leaks."
        ],
        replaceState: [
          "replaceState",
          "Refactor your code to use setState instead (see https://github.com/facebook/react/issues/3236)."
        ]
      };
      for (fnName in deprecatedAPIs)
        deprecatedAPIs.hasOwnProperty(fnName) && defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
      ComponentDummy.prototype = Component.prototype;
      deprecatedAPIs = PureComponent.prototype = new ComponentDummy();
      deprecatedAPIs.constructor = PureComponent;
      assign(deprecatedAPIs, Component.prototype);
      deprecatedAPIs.isPureReactComponent = true;
      var isArrayImpl = Array.isArray, REACT_CLIENT_REFERENCE = /* @__PURE__ */ Symbol.for("react.client.reference"), ReactSharedInternals = {
        H: null,
        A: null,
        T: null,
        S: null,
        actQueue: null,
        asyncTransitions: 0,
        isBatchingLegacy: false,
        didScheduleLegacyUpdate: false,
        didUsePromise: false,
        thrownErrors: [],
        getCurrentStack: null,
        recentlyCreatedOwnerStacks: 0
      }, hasOwnProperty = Object.prototype.hasOwnProperty, createTask = console.createTask ? console.createTask : function() {
        return null;
      };
      deprecatedAPIs = {
        react_stack_bottom_frame: function(callStackForError) {
          return callStackForError();
        }
      };
      var specialPropKeyWarningShown, didWarnAboutOldJSXRuntime;
      var didWarnAboutElementRef = {};
      var unknownOwnerDebugStack = deprecatedAPIs.react_stack_bottom_frame.bind(
        deprecatedAPIs,
        UnknownOwner
      )();
      var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
      var didWarnAboutMaps = false, userProvidedKeyEscapeRegex = /\/+/g, reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
        if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
          var event = new window.ErrorEvent("error", {
            bubbles: true,
            cancelable: true,
            message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
            error
          });
          if (!window.dispatchEvent(event)) return;
        } else if ("object" === typeof process && "function" === typeof process.emit) {
          process.emit("uncaughtException", error);
          return;
        }
        console.error(error);
      }, didWarnAboutMessageChannel = false, enqueueTaskImpl = null, actScopeDepth = 0, didWarnNoAwaitAct = false, isFlushing = false, queueSeveralMicrotasks = "function" === typeof queueMicrotask ? function(callback) {
        queueMicrotask(function() {
          return queueMicrotask(callback);
        });
      } : enqueueTask;
      deprecatedAPIs = Object.freeze({
        __proto__: null,
        c: function(size) {
          return resolveDispatcher().useMemoCache(size);
        }
      });
      var fnName = {
        map: mapChildren,
        forEach: function(children, forEachFunc, forEachContext) {
          mapChildren(
            children,
            function() {
              forEachFunc.apply(this, arguments);
            },
            forEachContext
          );
        },
        count: function(children) {
          var n = 0;
          mapChildren(children, function() {
            n++;
          });
          return n;
        },
        toArray: function(children) {
          return mapChildren(children, function(child) {
            return child;
          }) || [];
        },
        only: function(children) {
          if (!isValidElement(children))
            throw Error(
              "React.Children.only expected to receive a single React element child."
            );
          return children;
        }
      };
      exports.Activity = REACT_ACTIVITY_TYPE;
      exports.Children = fnName;
      exports.Component = Component;
      exports.Fragment = REACT_FRAGMENT_TYPE;
      exports.Profiler = REACT_PROFILER_TYPE;
      exports.PureComponent = PureComponent;
      exports.StrictMode = REACT_STRICT_MODE_TYPE;
      exports.Suspense = REACT_SUSPENSE_TYPE;
      exports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
      exports.__COMPILER_RUNTIME = deprecatedAPIs;
      exports.act = function(callback) {
        var prevActQueue = ReactSharedInternals.actQueue, prevActScopeDepth = actScopeDepth;
        actScopeDepth++;
        var queue = ReactSharedInternals.actQueue = null !== prevActQueue ? prevActQueue : [], didAwaitActCall = false;
        try {
          var result = callback();
        } catch (error) {
          ReactSharedInternals.thrownErrors.push(error);
        }
        if (0 < ReactSharedInternals.thrownErrors.length)
          throw popActScope(prevActQueue, prevActScopeDepth), callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
        if (null !== result && "object" === typeof result && "function" === typeof result.then) {
          var thenable = result;
          queueSeveralMicrotasks(function() {
            didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = true, console.error(
              "You called act(async () => ...) without await. This could lead to unexpected testing behaviour, interleaving multiple act calls and mixing their scopes. You should - await act(async () => ...);"
            ));
          });
          return {
            then: function(resolve, reject) {
              didAwaitActCall = true;
              thenable.then(
                function(returnValue) {
                  popActScope(prevActQueue, prevActScopeDepth);
                  if (0 === prevActScopeDepth) {
                    try {
                      flushActQueue(queue), enqueueTask(function() {
                        return recursivelyFlushAsyncActWork(
                          returnValue,
                          resolve,
                          reject
                        );
                      });
                    } catch (error$0) {
                      ReactSharedInternals.thrownErrors.push(error$0);
                    }
                    if (0 < ReactSharedInternals.thrownErrors.length) {
                      var _thrownError = aggregateErrors(
                        ReactSharedInternals.thrownErrors
                      );
                      ReactSharedInternals.thrownErrors.length = 0;
                      reject(_thrownError);
                    }
                  } else resolve(returnValue);
                },
                function(error) {
                  popActScope(prevActQueue, prevActScopeDepth);
                  0 < ReactSharedInternals.thrownErrors.length ? (error = aggregateErrors(
                    ReactSharedInternals.thrownErrors
                  ), ReactSharedInternals.thrownErrors.length = 0, reject(error)) : reject(error);
                }
              );
            }
          };
        }
        var returnValue$jscomp$0 = result;
        popActScope(prevActQueue, prevActScopeDepth);
        0 === prevActScopeDepth && (flushActQueue(queue), 0 !== queue.length && queueSeveralMicrotasks(function() {
          didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = true, console.error(
            "A component suspended inside an `act` scope, but the `act` call was not awaited. When testing React components that depend on asynchronous data, you must await the result:\n\nawait act(() => ...)"
          ));
        }), ReactSharedInternals.actQueue = null);
        if (0 < ReactSharedInternals.thrownErrors.length)
          throw callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
        return {
          then: function(resolve, reject) {
            didAwaitActCall = true;
            0 === prevActScopeDepth ? (ReactSharedInternals.actQueue = queue, enqueueTask(function() {
              return recursivelyFlushAsyncActWork(
                returnValue$jscomp$0,
                resolve,
                reject
              );
            })) : resolve(returnValue$jscomp$0);
          }
        };
      };
      exports.cache = function(fn) {
        return function() {
          return fn.apply(null, arguments);
        };
      };
      exports.cacheSignal = function() {
        return null;
      };
      exports.captureOwnerStack = function() {
        var getCurrentStack = ReactSharedInternals.getCurrentStack;
        return null === getCurrentStack ? null : getCurrentStack();
      };
      exports.cloneElement = function(element, config, children) {
        if (null === element || void 0 === element)
          throw Error(
            "The argument must be a React element, but you passed " + element + "."
          );
        var props = assign({}, element.props), key = element.key, owner = element._owner;
        if (null != config) {
          var JSCompiler_inline_result;
          a: {
            if (hasOwnProperty.call(config, "ref") && (JSCompiler_inline_result = Object.getOwnPropertyDescriptor(
              config,
              "ref"
            ).get) && JSCompiler_inline_result.isReactWarning) {
              JSCompiler_inline_result = false;
              break a;
            }
            JSCompiler_inline_result = void 0 !== config.ref;
          }
          JSCompiler_inline_result && (owner = getOwner());
          hasValidKey(config) && (checkKeyStringCoercion(config.key), key = "" + config.key);
          for (propName in config)
            !hasOwnProperty.call(config, propName) || "key" === propName || "__self" === propName || "__source" === propName || "ref" === propName && void 0 === config.ref || (props[propName] = config[propName]);
        }
        var propName = arguments.length - 2;
        if (1 === propName) props.children = children;
        else if (1 < propName) {
          JSCompiler_inline_result = Array(propName);
          for (var i = 0; i < propName; i++)
            JSCompiler_inline_result[i] = arguments[i + 2];
          props.children = JSCompiler_inline_result;
        }
        props = ReactElement(
          element.type,
          key,
          props,
          owner,
          element._debugStack,
          element._debugTask
        );
        for (key = 2; key < arguments.length; key++)
          validateChildKeys(arguments[key]);
        return props;
      };
      exports.createContext = function(defaultValue) {
        defaultValue = {
          $$typeof: REACT_CONTEXT_TYPE,
          _currentValue: defaultValue,
          _currentValue2: defaultValue,
          _threadCount: 0,
          Provider: null,
          Consumer: null
        };
        defaultValue.Provider = defaultValue;
        defaultValue.Consumer = {
          $$typeof: REACT_CONSUMER_TYPE,
          _context: defaultValue
        };
        defaultValue._currentRenderer = null;
        defaultValue._currentRenderer2 = null;
        return defaultValue;
      };
      exports.createElement = function(type, config, children) {
        for (var i = 2; i < arguments.length; i++)
          validateChildKeys(arguments[i]);
        i = {};
        var key = null;
        if (null != config)
          for (propName in didWarnAboutOldJSXRuntime || !("__self" in config) || "key" in config || (didWarnAboutOldJSXRuntime = true, console.warn(
            "Your app (or one of its dependencies) is using an outdated JSX transform. Update to the modern JSX transform for faster performance: https://react.dev/link/new-jsx-transform"
          )), hasValidKey(config) && (checkKeyStringCoercion(config.key), key = "" + config.key), config)
            hasOwnProperty.call(config, propName) && "key" !== propName && "__self" !== propName && "__source" !== propName && (i[propName] = config[propName]);
        var childrenLength = arguments.length - 2;
        if (1 === childrenLength) i.children = children;
        else if (1 < childrenLength) {
          for (var childArray = Array(childrenLength), _i = 0; _i < childrenLength; _i++)
            childArray[_i] = arguments[_i + 2];
          Object.freeze && Object.freeze(childArray);
          i.children = childArray;
        }
        if (type && type.defaultProps)
          for (propName in childrenLength = type.defaultProps, childrenLength)
            void 0 === i[propName] && (i[propName] = childrenLength[propName]);
        key && defineKeyPropWarningGetter(
          i,
          "function" === typeof type ? type.displayName || type.name || "Unknown" : type
        );
        var propName = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
        return ReactElement(
          type,
          key,
          i,
          getOwner(),
          propName ? Error("react-stack-top-frame") : unknownOwnerDebugStack,
          propName ? createTask(getTaskName(type)) : unknownOwnerDebugTask
        );
      };
      exports.createRef = function() {
        var refObject = { current: null };
        Object.seal(refObject);
        return refObject;
      };
      exports.forwardRef = function(render) {
        null != render && render.$$typeof === REACT_MEMO_TYPE ? console.error(
          "forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...))."
        ) : "function" !== typeof render ? console.error(
          "forwardRef requires a render function but was given %s.",
          null === render ? "null" : typeof render
        ) : 0 !== render.length && 2 !== render.length && console.error(
          "forwardRef render functions accept exactly two parameters: props and ref. %s",
          1 === render.length ? "Did you forget to use the ref parameter?" : "Any additional parameter will be undefined."
        );
        null != render && null != render.defaultProps && console.error(
          "forwardRef render functions do not support defaultProps. Did you accidentally pass a React component?"
        );
        var elementType = { $$typeof: REACT_FORWARD_REF_TYPE, render }, ownName;
        Object.defineProperty(elementType, "displayName", {
          enumerable: false,
          configurable: true,
          get: function() {
            return ownName;
          },
          set: function(name) {
            ownName = name;
            render.name || render.displayName || (Object.defineProperty(render, "name", { value: name }), render.displayName = name);
          }
        });
        return elementType;
      };
      exports.isValidElement = isValidElement;
      exports.lazy = function(ctor) {
        ctor = { _status: -1, _result: ctor };
        var lazyType = {
          $$typeof: REACT_LAZY_TYPE,
          _payload: ctor,
          _init: lazyInitializer
        }, ioInfo = {
          name: "lazy",
          start: -1,
          end: -1,
          value: null,
          owner: null,
          debugStack: Error("react-stack-top-frame"),
          debugTask: console.createTask ? console.createTask("lazy()") : null
        };
        ctor._ioInfo = ioInfo;
        lazyType._debugInfo = [{ awaited: ioInfo }];
        return lazyType;
      };
      exports.memo = function(type, compare) {
        null == type && console.error(
          "memo: The first argument must be a component. Instead received: %s",
          null === type ? "null" : typeof type
        );
        compare = {
          $$typeof: REACT_MEMO_TYPE,
          type,
          compare: void 0 === compare ? null : compare
        };
        var ownName;
        Object.defineProperty(compare, "displayName", {
          enumerable: false,
          configurable: true,
          get: function() {
            return ownName;
          },
          set: function(name) {
            ownName = name;
            type.name || type.displayName || (Object.defineProperty(type, "name", { value: name }), type.displayName = name);
          }
        });
        return compare;
      };
      exports.startTransition = function(scope) {
        var prevTransition = ReactSharedInternals.T, currentTransition = {};
        currentTransition._updatedFibers = /* @__PURE__ */ new Set();
        ReactSharedInternals.T = currentTransition;
        try {
          var returnValue = scope(), onStartTransitionFinish = ReactSharedInternals.S;
          null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
          "object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && (ReactSharedInternals.asyncTransitions++, returnValue.then(releaseAsyncTransition, releaseAsyncTransition), returnValue.then(noop, reportGlobalError));
        } catch (error) {
          reportGlobalError(error);
        } finally {
          null === prevTransition && currentTransition._updatedFibers && (scope = currentTransition._updatedFibers.size, currentTransition._updatedFibers.clear(), 10 < scope && console.warn(
            "Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table."
          )), null !== prevTransition && null !== currentTransition.types && (null !== prevTransition.types && prevTransition.types !== currentTransition.types && console.error(
            "We expected inner Transitions to have transferred the outer types set and that you cannot add to the outer Transition while inside the inner.This is a bug in React."
          ), prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
        }
      };
      exports.unstable_useCacheRefresh = function() {
        return resolveDispatcher().useCacheRefresh();
      };
      exports.use = function(usable) {
        return resolveDispatcher().use(usable);
      };
      exports.useActionState = function(action, initialState, permalink) {
        return resolveDispatcher().useActionState(
          action,
          initialState,
          permalink
        );
      };
      exports.useCallback = function(callback, deps) {
        return resolveDispatcher().useCallback(callback, deps);
      };
      exports.useContext = function(Context) {
        var dispatcher = resolveDispatcher();
        Context.$$typeof === REACT_CONSUMER_TYPE && console.error(
          "Calling useContext(Context.Consumer) is not supported and will cause bugs. Did you mean to call useContext(Context) instead?"
        );
        return dispatcher.useContext(Context);
      };
      exports.useDebugValue = function(value, formatterFn) {
        return resolveDispatcher().useDebugValue(value, formatterFn);
      };
      exports.useDeferredValue = function(value, initialValue) {
        return resolveDispatcher().useDeferredValue(value, initialValue);
      };
      exports.useEffect = function(create, deps) {
        null == create && console.warn(
          "React Hook useEffect requires an effect callback. Did you forget to pass a callback to the hook?"
        );
        return resolveDispatcher().useEffect(create, deps);
      };
      exports.useEffectEvent = function(callback) {
        return resolveDispatcher().useEffectEvent(callback);
      };
      exports.useId = function() {
        return resolveDispatcher().useId();
      };
      exports.useImperativeHandle = function(ref, create, deps) {
        return resolveDispatcher().useImperativeHandle(ref, create, deps);
      };
      exports.useInsertionEffect = function(create, deps) {
        null == create && console.warn(
          "React Hook useInsertionEffect requires an effect callback. Did you forget to pass a callback to the hook?"
        );
        return resolveDispatcher().useInsertionEffect(create, deps);
      };
      exports.useLayoutEffect = function(create, deps) {
        null == create && console.warn(
          "React Hook useLayoutEffect requires an effect callback. Did you forget to pass a callback to the hook?"
        );
        return resolveDispatcher().useLayoutEffect(create, deps);
      };
      exports.useMemo = function(create, deps) {
        return resolveDispatcher().useMemo(create, deps);
      };
      exports.useOptimistic = function(passthrough, reducer) {
        return resolveDispatcher().useOptimistic(passthrough, reducer);
      };
      exports.useReducer = function(reducer, initialArg, init) {
        return resolveDispatcher().useReducer(reducer, initialArg, init);
      };
      exports.useRef = function(initialValue) {
        return resolveDispatcher().useRef(initialValue);
      };
      exports.useState = function(initialState) {
        return resolveDispatcher().useState(initialState);
      };
      exports.useSyncExternalStore = function(subscribe, getSnapshot, getServerSnapshot) {
        return resolveDispatcher().useSyncExternalStore(
          subscribe,
          getSnapshot,
          getServerSnapshot
        );
      };
      exports.useTransition = function() {
        return resolveDispatcher().useTransition();
      };
      exports.version = "19.2.7";
      "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
    })();
  }
});

// node_modules/react/index.js
var require_react = __commonJS({
  "node_modules/react/index.js"(exports, module) {
    "use strict";
    if (false) {
      module.exports = null;
    } else {
      module.exports = require_react_development();
    }
  }
});

// src/lib/exportPptx.ts
import pptxgen from "pptxgenjs";

// src/lib/parseSections.ts
var SECTION_IDS = ["objectives", "key_points", "difficult_points", "process", "board_design", "reflection"];
function parseSections(markdown) {
  if (!markdown.trim()) return [];
  const lines = markdown.split("\n");
  const sections = [];
  let current = null;
  let sectionIndex = 0;
  for (const line of lines) {
    const hMatch = line.match(/^(#{2,4})\s+(.+)/);
    if (hMatch) {
      if (current) sections.push(current);
      const title = hMatch[2].replace(/[*_~`]/g, "").trim();
      sectionIndex++;
      current = {
        id: SECTION_IDS[sectionIndex - 1] || `section-${sectionIndex}`,
        level: hMatch[1].length - 1,
        title,
        body: "",
        collapsed: false
      };
    } else if (current) {
      current.body += (current.body ? "\n" : "") + line;
    } else if (line.trim()) {
      sectionIndex++;
      current = { id: "overview", level: 1, title: "\u6559\u6848\u6982\u89C8", body: line, collapsed: false };
    }
  }
  if (current) sections.push(current);
  for (const s of sections) s.body = s.body.trim();
  return sections;
}

// src/lib/pptThemes.ts
var F_YAHEI = "Microsoft YaHei";
var F_KAI = 'KaiTi, "\u6977\u4F53", "STKaiti", "Microsoft YaHei"';
var F_SONG = '"\u5B8B\u4F53", "SimSun", "Microsoft YaHei"';
var F_HEI = '"\u9ED1\u4F53", "SimHei", "Microsoft YaHei"';
var GROUP_DECOR = {
  zhongguofeng: { decor: "china", font: F_KAI },
  minimal: { decor: "minimal", font: F_YAHEI },
  academic: { decor: "academic", font: F_SONG },
  fresh: { decor: "fresh", font: F_YAHEI },
  morandi: { decor: "fresh", font: F_YAHEI },
  // 莫兰迪复用清新圆角卡片
  tech: { decor: "tech", font: F_HEI },
  nature: { decor: "fresh", font: F_YAHEI },
  // 自然生机复用清新柔和
  warm: { decor: "warm", font: F_KAI },
  gradient: { decor: "gradient", font: F_YAHEI },
  special: { decor: "special", font: F_YAHEI }
};
function withDecor(t2) {
  const d = GROUP_DECOR[t2.groupId] || { decor: "minimal", font: F_YAHEI };
  return { ...t2, decor: t2.decor ?? d.decor, font: t2.font ?? d.font };
}
var RAW = [
  // ── A. 中国风（语文 / 历史 / 传统文化） ──
  { id: "zgf-ink-wash", name: "\u6C34\u58A8\u4E39\u9752", group: "\u4E2D\u56FD\u98CE", groupId: "zhongguofeng", primary: "2B2B2B", onPrimary: "FFFFFF", coverBg: "2B2B2B", coverGradient: "linear-gradient(135deg,#2B2B2B,#4A4A4A)", lightText: "C9C9C9", footer: "9A9A9A", body: "333333", subtle: "777777", bullet: "8A8A8A", subjects: ["\u8BED\u6587", "\u5386\u53F2", "\u7F8E\u672F", "\u653F\u6CBB"], grades: ["mid", "high"] },
  { id: "zgf-guochao", name: "\u56FD\u6F6E\u65B0\u4E2D\u5F0F", group: "\u4E2D\u56FD\u98CE", groupId: "zhongguofeng", primary: "C0392B", onPrimary: "FFFFFF", coverBg: "C0392B", coverGradient: "linear-gradient(135deg,#C0392B,#9E2B25)", lightText: "F6D9C0", footer: "C97E7E", body: "333333", subtle: "777777", bullet: "D4AF37", subjects: ["\u8BED\u6587", "\u5386\u53F2", "\u7F8E\u672F"], grades: ["mid", "high"] },
  { id: "zgf-classic-red", name: "\u53E4\u5178\u6731\u7EA2", group: "\u4E2D\u56FD\u98CE", groupId: "zhongguofeng", primary: "9E2B25", onPrimary: "FFF8F0", coverBg: "9E2B25", lightText: "F2D9C0", footer: "C08880", body: "3A2A22", subtle: "8A7A6A", bullet: "C8A06A", subjects: ["\u8BED\u6587", "\u5386\u53F2"], grades: ["mid", "high"] },
  { id: "zgf-shanshui", name: "\u5C71\u6C34\u9752\u7EFF", group: "\u4E2D\u56FD\u98CE", groupId: "zhongguofeng", primary: "2F6B5E", onPrimary: "FFFFFF", coverBg: "2F6B5E", coverGradient: "linear-gradient(135deg,#2F6B5E,#3E8B77)", lightText: "D6E5DC", footer: "8FAE9E", body: "2E3A33", subtle: "7A8A80", bullet: "5A9A86", subjects: ["\u8BED\u6587", "\u7F8E\u672F", "\u5730\u7406"], grades: ["low", "mid", "high"] },
  { id: "zgf-song-qing", name: "\u5B8B\u97F5\u5929\u9752", group: "\u4E2D\u56FD\u98CE", groupId: "zhongguofeng", primary: "5B8C9E", onPrimary: "FFFFFF", coverBg: "5B8C9E", lightText: "DCE9EE", footer: "9CB6C0", body: "33403F", subtle: "7E9197", bullet: "3F6E7E", subjects: ["\u8BED\u6587", "\u5386\u53F2", "\u7F8E\u672F"], grades: ["mid", "high"] },
  { id: "zgf-zen", name: "\u7985\u610F\u7559\u767D", group: "\u4E2D\u56FD\u98CE", groupId: "zhongguofeng", primary: "B08D57", onPrimary: "FFFFFF", coverBg: "F5F1E8", coverGradient: "linear-gradient(135deg,#F5F1E8,#EBE4D4)", lightText: "8A8377", footer: "A99E8A", body: "3A3A3A", subtle: "9A9A8A", bullet: "B08D57", subjects: ["\u8BED\u6587", "\u7F8E\u672F", "\u653F\u6CBB"], grades: ["mid", "high"] },
  // ── B. 简约商务（通用专业） ──
  { id: "min-classic-blue", name: "\u7ECF\u5178\u6DF1\u84DD", group: "\u7B80\u7EA6\u5546\u52A1", groupId: "minimal", primary: "1A3A6B", onPrimary: "FFFFFF", coverBg: "1A3A6B", lightText: "CADCFC", footer: "8FA8D6", body: "333333", subtle: "666666", bullet: "1A3A6B", subjects: [], grades: ["mid", "high"] },
  { id: "min-geo", name: "\u51E0\u4F55\u6781\u7B80", group: "\u7B80\u7EA6\u5546\u52A1", groupId: "minimal", primary: "2C3E50", onPrimary: "FFFFFF", coverBg: "2C3E50", lightText: "AEBFD0", footer: "95A6B8", body: "333333", subtle: "666666", bullet: "2C3E50", subjects: ["\u6570\u5B66", "\u4FE1\u606F\u6280\u672F"], grades: ["low", "mid", "high"] },
  { id: "min-gray-premium", name: "\u9AD8\u7EA7\u7070", group: "\u7B80\u7EA6\u5546\u52A1", groupId: "minimal", primary: "4A4A4A", onPrimary: "FFFFFF", coverBg: "4A4A4A", lightText: "CFCFCF", footer: "A0A0A0", body: "333333", subtle: "777777", bullet: "4A4A4A", subjects: [], grades: ["mid", "high"] },
  { id: "min-pure-white", name: "\u7EAF\u51C0\u767D", group: "\u7B80\u7EA6\u5546\u52A1", groupId: "minimal", primary: "1A3A6B", onPrimary: "FFFFFF", coverBg: "FFFFFF", coverGradient: "linear-gradient(135deg,#FFFFFF,#F0F2F7)", lightText: "5A6B85", footer: "9AA6B8", body: "333333", subtle: "777777", bullet: "1A3A6B", subjects: [], grades: ["low", "mid", "high"] },
  { id: "min-modern-line", name: "\u73B0\u4EE3\u7EBF\u6761", group: "\u7B80\u7EA6\u5546\u52A1", groupId: "minimal", primary: "34495E", onPrimary: "FFFFFF", coverBg: "34495E", lightText: "BFD3E0", footer: "9AAEBE", body: "333333", subtle: "777777", bullet: "5DADE2", subjects: ["\u6570\u5B66"], grades: ["mid", "high"] },
  { id: "min-navy-intellectual", name: "\u77E5\u6027\u85CF\u9752", group: "\u7B80\u7EA6\u5546\u52A1", groupId: "minimal", primary: "14304F", onPrimary: "FFFFFF", coverBg: "14304F", lightText: "C2D6E4", footer: "8BA6BE", body: "333333", subtle: "777777", bullet: "6FA8C7", subjects: [], grades: ["mid", "high"] },
  // ── C. 学术教研（课堂严谨） ──
  { id: "aca-edu-blue", name: "\u6559\u7814\u84DD", group: "\u5B66\u672F\u6559\u7814", groupId: "academic", primary: "1F4E79", onPrimary: "FFFFFF", coverBg: "1F4E79", lightText: "C5DBEE", footer: "93B0CC", body: "333333", subtle: "777777", bullet: "1F4E79", subjects: [], grades: ["low", "mid", "high"] },
  { id: "aca-black-gold", name: "\u5B66\u672F\u9ED1\u91D1", group: "\u5B66\u672F\u6559\u7814", groupId: "academic", primary: "1C1C1C", onPrimary: "D4AF37", coverBg: "1C1C1C", lightText: "C9B98A", footer: "B8A878", body: "333333", subtle: "777777", bullet: "D4AF37", subjects: [], grades: ["high"] },
  { id: "aca-rational", name: "\u7406\u6027\u7070\u84DD", group: "\u5B66\u672F\u6559\u7814", groupId: "academic", primary: "3B5168", onPrimary: "FFFFFF", coverBg: "3B5168", lightText: "C2D0DC", footer: "97A8B8", body: "333333", subtle: "777777", bullet: "5A7C97", subjects: ["\u6570\u5B66", "\u5316\u5B66"], grades: ["mid", "high"] },
  { id: "aca-cream", name: "\u77E5\u6027\u7C73\u767D", group: "\u5B66\u672F\u6559\u7814", groupId: "academic", primary: "8C7A5A", onPrimary: "FFFFFF", coverBg: "F3EEE2", lightText: "6A5A3E", footer: "B0A080", body: "3A3328", subtle: "8A8070", bullet: "8C7A5A", subjects: [], grades: ["mid", "high"] },
  { id: "aca-deep-green", name: "\u6C89\u7A33\u58A8\u7EFF", group: "\u5B66\u672F\u6559\u7814", groupId: "academic", primary: "1E4036", onPrimary: "FFFFFF", coverBg: "1E4036", lightText: "BFD6C9", footer: "8AA898", body: "333333", subtle: "777777", bullet: "3E6E58", subjects: ["\u751F\u7269", "\u5730\u7406"], grades: ["mid", "high"] },
  // ── D. 清新活力（小学 / 低龄） ──
  { id: "fr-macaron-pink", name: "\u9A6C\u5361\u9F99\u7C89", group: "\u6E05\u65B0\u6D3B\u529B", groupId: "fresh", primary: "F4A6C0", onPrimary: "FFFFFF", coverBg: "F4A6C0", lightText: "FFE3EC", footer: "D79FB4", body: "5A3A45", subtle: "9A7A85", bullet: "F1789C", subjects: ["\u7F8E\u672F", "\u97F3\u4E50"], grades: ["low", "mid"] },
  { id: "fr-mint", name: "\u8584\u8377\u7EFF", group: "\u6E05\u65B0\u6D3B\u529B", groupId: "fresh", primary: "3FA776", onPrimary: "FFFFFF", coverBg: "6FCF97", coverGradient: "linear-gradient(135deg,#6FCF97,#3FA776)", lightText: "E6F7EE", footer: "86C2A4", body: "2E4A3A", subtle: "7A8A80", bullet: "3FA776", subjects: ["\u751F\u7269", "\u79D1\u5B66"], grades: ["low", "mid"] },
  { id: "fr-sky-blue", name: "\u5929\u84DD\u7AE5\u8DA3", group: "\u6E05\u65B0\u6D3B\u529B", groupId: "fresh", primary: "2F8FC4", onPrimary: "FFFFFF", coverBg: "56B4E9", lightText: "EAF6FE", footer: "8FC3E0", body: "2E3A45", subtle: "7A8590", bullet: "2F8FC4", subjects: ["\u79D1\u5B66", "\u82F1\u8BED"], grades: ["low", "mid"] },
  { id: "fr-warm-orange", name: "\u6696\u6A59\u9633\u5149", group: "\u6E05\u65B0\u6D3B\u529B", groupId: "fresh", primary: "D97A2B", onPrimary: "FFFFFF", coverBg: "F2994A", lightText: "FDEBDD", footer: "E0A472", body: "4A3526", subtle: "8A7A6A", bullet: "D97A2B", subjects: ["\u4F53\u80B2", "\u82F1\u8BED"], grades: ["low", "mid"] },
  { id: "fr-lemon", name: "\u67E0\u6AAC\u9EC4", group: "\u6E05\u65B0\u6D3B\u529B", groupId: "fresh", primary: "D9A92B", onPrimary: "5A4A12", coverBg: "F2C94C", lightText: "7A6A22", footer: "C2B06A", body: "4A4220", subtle: "8A8060", bullet: "D9A92B", subjects: ["\u82F1\u8BED", "\u7F8E\u672F"], grades: ["low", "mid"] },
  { id: "fr-sakura", name: "\u6A31\u82B1\u7C89", group: "\u6E05\u65B0\u6D3B\u529B", groupId: "fresh", primary: "E89BB4", onPrimary: "8A4A5E", coverBg: "F8C8D8", lightText: "9A5A6E", footer: "D9A8BC", body: "5A3A45", subtle: "9A7A85", bullet: "E89BB4", subjects: ["\u7F8E\u672F", "\u97F3\u4E50"], grades: ["low", "mid"] },
  // ── E. 莫兰迪（柔和知性） ──
  { id: "mo-haze-blue", name: "\u96FE\u973E\u84DD", group: "\u83AB\u5170\u8FEA", groupId: "morandi", primary: "7C93A6", onPrimary: "FFFFFF", coverBg: "7C93A6", lightText: "E2E8ED", footer: "AEBECB", body: "4A4A4A", subtle: "8A8A8A", bullet: "5E7689", subjects: [], grades: ["mid", "high"] },
  { id: "mo-gray-purple", name: "\u7070\u7D2B", group: "\u83AB\u5170\u8FEA", groupId: "morandi", primary: "8A7E95", onPrimary: "FFFFFF", coverBg: "8A7E95", lightText: "E6E1EA", footer: "B2A8BC", body: "4A4A4A", subtle: "8A8A8A", bullet: "6E6280", subjects: ["\u7F8E\u672F", "\u97F3\u4E50"], grades: ["mid", "high"] },
  { id: "mo-milktea", name: "\u5976\u8336\u8272", group: "\u83AB\u5170\u8FEA", groupId: "morandi", primary: "B89B82", onPrimary: "FFF8F0", coverBg: "B89B82", lightText: "F3E9DC", footer: "D2BCA6", body: "4A4238", subtle: "8A8070", bullet: "9A7E66", subjects: [], grades: ["mid", "high"] },
  { id: "mo-bean-green", name: "\u8C46\u6C99\u7EFF", group: "\u83AB\u5170\u8FEA", groupId: "morandi", primary: "7E8B6E", onPrimary: "FFFFFF", coverBg: "7E8B6E", lightText: "E4E9DD", footer: "AAB49C", body: "444A3C", subtle: "8A8A7A", bullet: "62705A", subjects: ["\u751F\u7269", "\u5730\u7406"], grades: ["mid", "high"] },
  { id: "mo-rose-gray", name: "\u73AB\u7470\u7070", group: "\u83AB\u5170\u8FEA", groupId: "morandi", primary: "A88A8A", onPrimary: "FFFFFF", coverBg: "A88A8A", lightText: "F0E892", footer: "C6AEAE", body: "4A4444", subtle: "8A8A8A", bullet: "8C6E6E", subjects: ["\u7F8E\u672F"], grades: ["mid", "high"] },
  { id: "mo-oat", name: "\u71D5\u9EA6\u7C73", group: "\u83AB\u5170\u8FEA", groupId: "morandi", primary: "BBAE92", onPrimary: "5A4A33", coverBg: "D8C9B0", lightText: "6A5A40", footer: "CBBE9E", body: "4A4233", subtle: "8A8068", bullet: "BBAE92", subjects: [], grades: ["mid", "high"] },
  // ── F. 科技未来（理化生 / 信息） ──
  { id: "te-tech-navy", name: "\u79D1\u6280\u6DF1\u84DD", group: "\u79D1\u6280\u672A\u6765", groupId: "tech", primary: "0B2545", onPrimary: "4DA8DA", coverBg: "0B2545", coverGradient: "linear-gradient(135deg,#0B2545,#13315C)", lightText: "8FC1E0", footer: "6E96BE", body: "2B3A4A", subtle: "6A7A8A", bullet: "4DA8DA", subjects: ["\u7269\u7406", "\u5316\u5B66", "\u4FE1\u606F\u6280\u672F"], grades: ["mid", "high"] },
  { id: "te-cyber-purple", name: "\u8D5B\u535A\u7D2B", group: "\u79D1\u6280\u672A\u6765", groupId: "tech", primary: "2D1B4E", onPrimary: "B388FF", coverBg: "2D1B4E", coverGradient: "linear-gradient(135deg,#2D1B4E,#3B2360)", lightText: "C9B6F0", footer: "9E86C8", body: "332B45", subtle: "7A6E8A", bullet: "B388FF", subjects: ["\u4FE1\u606F\u6280\u672F", "\u7269\u7406"], grades: ["mid", "high"] },
  { id: "te-aurora-green", name: "\u6781\u5149\u7EFF", group: "\u79D1\u6280\u672A\u6765", groupId: "tech", primary: "0E3B33", onPrimary: "4CE0B3", coverBg: "0E3B33", lightText: "A6EEDD", footer: "6EBBA8", body: "2B3A36", subtle: "6A7A74", bullet: "4CE0B3", subjects: ["\u751F\u7269", "\u5316\u5B66", "\u4FE1\u606F\u6280\u672F"], grades: ["mid", "high"] },
  { id: "te-starry", name: "\u661F\u7A7A\u9ED1", group: "\u79D1\u6280\u672A\u6765", groupId: "tech", primary: "121212", onPrimary: "7FD1FF", coverBg: "121212", coverGradient: "linear-gradient(135deg,#121212,#1F2937)", lightText: "A9C9E0", footer: "6E8AA0", body: "2B3138", subtle: "6A7480", bullet: "7FD1FF", subjects: ["\u7269\u7406", "\u5730\u7406", "\u4FE1\u606F\u6280\u672F"], grades: ["mid", "high"] },
  { id: "te-quantum-blue", name: "\u91CF\u5B50\u84DD", group: "\u79D1\u6280\u672A\u6765", groupId: "tech", primary: "102A54", onPrimary: "5BC0EB", coverBg: "102A54", lightText: "A6D6EE", footer: "6E9CC0", body: "2B374A", subtle: "6A7488", bullet: "5BC0EB", subjects: ["\u7269\u7406", "\u6570\u5B66", "\u4FE1\u606F\u6280\u672F"], grades: ["mid", "high"] },
  { id: "te-digital-cyan", name: "\u6570\u7801\u9752", group: "\u79D1\u6280\u672A\u6765", groupId: "tech", primary: "0A3A40", onPrimary: "3DD6C4", coverBg: "0A3A40", lightText: "A0E8DF", footer: "6EB8B0", body: "2B3A3A", subtle: "6A7A78", bullet: "3DD6C4", subjects: ["\u4FE1\u606F\u6280\u672F", "\u7269\u7406", "\u5316\u5B66"], grades: ["mid", "high"] },
  // ── G. 自然生机（生物 / 地理 / 环保） ──
  { id: "na-forest", name: "\u68EE\u6797\u7EFF", group: "\u81EA\u7136\u751F\u673A", groupId: "nature", primary: "1E5631", onPrimary: "FFFFFF", coverBg: "1E5631", lightText: "C2DCC9", footer: "8AAE96", body: "2E3A30", subtle: "7A8A7C", bullet: "3E7A4E", subjects: ["\u751F\u7269", "\u5730\u7406"], grades: ["low", "mid", "high"] },
  { id: "na-ocean", name: "\u6D77\u6D0B\u84DD", group: "\u81EA\u7136\u751F\u673A", groupId: "nature", primary: "0E5A8A", onPrimary: "FFFFFF", coverBg: "0E5A8A", lightText: "C2DCEF", footer: "8AAEC8", body: "2E3A45", subtle: "7A8A95", bullet: "2F8FC4", subjects: ["\u751F\u7269", "\u5730\u7406", "\u79D1\u5B66"], grades: ["low", "mid", "high"] },
  { id: "na-earth", name: "\u5927\u5730\u68D5", group: "\u81EA\u7136\u751F\u673A", groupId: "nature", primary: "6B4226", onPrimary: "F3E5D0", coverBg: "6B4226", lightText: "E2CDB0", footer: "B08A66", body: "3A2E20", subtle: "8A7A66", bullet: "9C6B47", subjects: ["\u5730\u7406", "\u5386\u53F2"], grades: ["mid", "high"] },
  { id: "na-dawn", name: "\u6668\u66E6\u6A59", group: "\u81EA\u7136\u751F\u673A", groupId: "nature", primary: "C25A18", onPrimary: "FFFFFF", coverBg: "E8772E", coverGradient: "linear-gradient(135deg,#E8772E,#C25A18)", lightText: "FDEBDD", footer: "E0A472", body: "4A3526", subtle: "8A7A66", bullet: "C25A18", subjects: ["\u4F53\u80B2", "\u79D1\u5B66"], grades: ["low", "mid"] },
  { id: "na-grass", name: "\u8349\u6728\u9752", group: "\u81EA\u7136\u751F\u673A", groupId: "nature", primary: "5A8A3C", onPrimary: "FFFFFF", coverBg: "5A8A3C", lightText: "E2EED6", footer: "9AB87E", body: "2E3A2C", subtle: "7A8A74", bullet: "7FB14E", subjects: ["\u751F\u7269", "\u79D1\u5B66"], grades: ["low", "mid", "high"] },
  // ── H. 典雅暖调（人文 / 艺术） ──
  { id: "wa-elegant-purple", name: "\u5178\u96C5\u7D2B", group: "\u5178\u96C5\u6696\u8C03", groupId: "warm", primary: "5B3A78", onPrimary: "FFFFFF", coverBg: "5B3A78", lightText: "D9C9E8", footer: "A98CC0", body: "3A2E45", subtle: "7A6E8A", bullet: "8E6CB0", subjects: ["\u7F8E\u672F", "\u97F3\u4E50", "\u8BED\u6587"], grades: ["mid", "high"] },
  { id: "wa-wine", name: "\u9152\u7EA2", group: "\u5178\u96C5\u6696\u8C03", groupId: "warm", primary: "6E1F2A", onPrimary: "F3D9C0", coverBg: "6E1F2A", lightText: "E2C2BC", footer: "B07A78", body: "3A2622", subtle: "8A6E6A", bullet: "A85762", subjects: ["\u8BED\u6587", "\u5386\u53F2"], grades: ["high"] },
  { id: "wa-caramel", name: "\u7126\u7CD6\u68D5", group: "\u5178\u96C5\u6696\u8C03", groupId: "warm", primary: "8A5A2B", onPrimary: "FFF3E0", coverBg: "8A5A2B", lightText: "E6CDB0", footer: "C09A66", body: "3A2E20", subtle: "8A7A66", bullet: "B07A45", subjects: ["\u7F8E\u672F", "\u5386\u53F2"], grades: ["mid", "high"] },
  { id: "wa-rosegold", name: "\u73AB\u7470\u91D1", group: "\u5178\u96C5\u6696\u8C03", groupId: "warm", primary: "B76E79", onPrimary: "FFF8F0", coverBg: "B76E79", lightText: "F3D9DE", footer: "D6A0A8", body: "4A383C", subtle: "8A7A7A", bullet: "D69AA0", subjects: ["\u7F8E\u672F", "\u97F3\u4E50"], grades: ["mid", "high"] },
  { id: "wa-warm-peach", name: "\u6696\u6A58\u7C89", group: "\u5178\u96C5\u6696\u8C03", groupId: "warm", primary: "E08A6B", onPrimary: "FFFFFF", coverBg: "E08A6B", lightText: "FCE4DB", footer: "E0A98A", body: "4A342E", subtle: "8A746A", bullet: "C56A4B", subjects: ["\u7F8E\u672F", "\u97F3\u4E50", "\u82F1\u8BED"], grades: ["low", "mid", "high"] },
  // ── I. 渐变现代（吸睛通用） ──
  { id: "gr-blue-purple", name: "\u84DD\u7D2B\u6E10\u53D8", group: "\u6E10\u53D8\u73B0\u4EE3", groupId: "gradient", primary: "3B49C9", onPrimary: "FFFFFF", coverBg: "3B49C9", coverGradient: "linear-gradient(135deg,#3B49C9,#8E44EC)", lightText: "E0E2FB", footer: "9A9EF0", body: "33333F", subtle: "777787", bullet: "8E44EC", subjects: ["\u4FE1\u606F\u6280\u672F", "\u7F8E\u672F"], grades: ["mid", "high"] },
  { id: "gr-orange-pink", name: "\u6A59\u7C89\u6E10\u53D8", group: "\u6E10\u53D8\u73B0\u4EE3", groupId: "gradient", primary: "FF6B6B", onPrimary: "FFFFFF", coverBg: "FF6B6B", coverGradient: "linear-gradient(135deg,#FF8A5B,#FF5C8A)", lightText: "FFE6EC", footer: "FFA0AE", body: "4A3036", subtle: "8A7A80", bullet: "FF5C8A", subjects: ["\u7F8E\u672F", "\u97F3\u4E50"], grades: ["low", "mid", "high"] },
  { id: "gr-cyan-green", name: "\u9752\u7EFF\u6E10\u53D8", group: "\u6E10\u53D8\u73B0\u4EE3", groupId: "gradient", primary: "12B8A6", onPrimary: "FFFFFF", coverBg: "12B8A6", coverGradient: "linear-gradient(135deg,#12B8A6,#3FA776)", lightText: "E0F7F2", footer: "8AD0C4", body: "2E3A36", subtle: "7A8A80", bullet: "3FA776", subjects: ["\u751F\u7269", "\u79D1\u5B66"], grades: ["low", "mid", "high"] },
  { id: "gr-purple-pink", name: "\u7D2B\u7C89\u6E10\u53D8", group: "\u6E10\u53D8\u73B0\u4EE3", groupId: "gradient", primary: "8E44EC", onPrimary: "FFFFFF", coverBg: "8E44EC", coverGradient: "linear-gradient(135deg,#8E44EC,#8E44EC)", lightText: "F2E2F8", footer: "C79AE0", body: "3A2E45", subtle: "7A6E8A", bullet: "E85FB0", subjects: ["\u7F8E\u672F", "\u97F3\u4E50"], grades: ["low", "mid"] },
  { id: "gr-gold-orange", name: "\u91D1\u6A59\u6E10\u53D8", group: "\u6E10\u53D8\u73B0\u4EE3", groupId: "gradient", primary: "F2994A", onPrimary: "FFFFFF", coverBg: "F2C94C", coverGradient: "linear-gradient(135deg,#F2C94C,#F2994A)", lightText: "5A4A12", footer: "E0B072", body: "4A3E22", subtle: "8A8060", bullet: "F2994A", subjects: ["\u7F8E\u672F", "\u4F53\u80B2"], grades: ["low", "mid", "high"] },
  { id: "gr-aurora", name: "\u6781\u5149\u6E10\u53D8", group: "\u6E10\u53D8\u73B0\u4EE3", groupId: "gradient", primary: "2D9CDB", onPrimary: "FFFFFF", coverBg: "2D9CDB", coverGradient: "linear-gradient(135deg,#2D9CDB,#9B51E0,#4CE0B3)", lightText: "E2F2FB", footer: "9AB8E0", body: "2E3A45", subtle: "7A8A95", bullet: "9B51E0", subjects: ["\u4FE1\u606F\u6280\u672F", "\u7269\u7406"], grades: ["mid", "high"] },
  // ── J. 专项主题（学科定制） ──
  { id: "sp-party-red", name: "\u515A\u653F\u7EA2", group: "\u4E13\u9879\u4E3B\u9898", groupId: "special", primary: "C0271E", onPrimary: "FFFFFF", coverBg: "C0271E", lightText: "F5D2CE", footer: "E09A92", body: "333333", subtle: "777777", bullet: "F2C94C", subjects: ["\u653F\u6CBB"], grades: ["mid", "high"] },
  { id: "sp-festive", name: "\u8282\u65E5\u7EA2\u91D1", group: "\u4E13\u9879\u4E3B\u9898", groupId: "special", primary: "B5121B", onPrimary: "FFE9A8", coverBg: "B5121B", coverGradient: "linear-gradient(135deg,#B5121B,#8A0E16)", lightText: "F5E2AC", footer: "D9A878", body: "4A2A22", subtle: "8A6A5A", bullet: "D4AF37", subjects: ["\u8BED\u6587", "\u653F\u6CBB", "\u82F1\u8BED"], grades: ["low", "mid", "high"] },
  { id: "sp-cartoon", name: "\u5361\u901A\u63D2\u753B", group: "\u4E13\u9879\u4E3B\u9898", groupId: "special", primary: "4FB0E5", onPrimary: "FFFFFF", coverBg: "4FB0E5", coverGradient: "linear-gradient(135deg,#4FB0E5,#5FD0C0)", lightText: "EAF7FE", footer: "9CCDE8", body: "2E3A45", subtle: "7A8A95", bullet: "FF9F43", subjects: ["\u82F1\u8BED", "\u7F8E\u672F", "\u97F3\u4E50"], grades: ["low", "mid"] },
  { id: "sp-chalkboard", name: "\u9ED1\u677F\u7C89\u7B14", group: "\u4E13\u9879\u4E3B\u9898", groupId: "special", primary: "1B2A1B", onPrimary: "F5F5F0", coverBg: "1B2A1B", coverGradient: "linear-gradient(135deg,#1B2A1B,#26331F)", lightText: "D8E0D0", footer: "9AB08A", body: "2E3A2E", subtle: "6A7A6A", bullet: "FFE08A", subjects: ["\u6570\u5B66", "\u7269\u7406", "\u5316\u5B66", "\u82F1\u8BED"], grades: ["low", "mid", "high"] },
  { id: "sp-doodle", name: "\u624B\u7ED8\u6D82\u9E26", group: "\u4E13\u9879\u4E3B\u9898", groupId: "special", primary: "F4C430", onPrimary: "3A3A3A", coverBg: "FFD166", coverGradient: "linear-gradient(135deg,#FFD166,#FFB85C)", lightText: "5A4A12", footer: "D9B050", body: "3A3A3A", subtle: "8A8A6A", bullet: "EF476F", subjects: ["\u7F8E\u672F", "\u82F1\u8BED"], grades: ["low", "mid"] }
];
var THEMES = RAW.map(withDecor);
var DEFAULT_THEME = THEMES.find((t2) => t2.id === "min-classic-blue");
var _byId = new Map(THEMES.map((t2) => [t2.id, t2]));
function getTheme(id) {
  if (!id) return DEFAULT_THEME;
  return _byId.get(id) || DEFAULT_THEME;
}
var THEME_GROUPS = (() => {
  const order = [];
  const map = /* @__PURE__ */ new Map();
  for (const t2 of THEMES) {
    if (!map.has(t2.groupId)) {
      map.set(t2.groupId, { id: t2.groupId, name: t2.group, themes: [] });
      order.push(t2.groupId);
    }
    map.get(t2.groupId).themes.push(t2);
  }
  return order.map((id) => map.get(id));
})();
var DEFAULT_THEME_ID = DEFAULT_THEME.id;

// src/components/Toast.tsx
var import_react = __toESM(require_react(), 1);
var ToastCtx = (0, import_react.createContext)({ toast: () => {
} });

// src/lib/api.ts
var API_BASE = import.meta.env.VITE_API_URL || "/api";
var token = localStorage.getItem("zhiwei_token") || null;

// src/lib/cwTemplate.ts
import { SUBJECT_CODES } from "@shared/subjects";
var STYLE_LABELS = {
  china: "\u56FD\u98CE",
  minimal: "\u7D20\u51C0",
  tech: "\u79D1\u6280",
  fresh: "\u6E05\u65B0",
  academic: "\u4E25\u8C28",
  cartoon: "\u5361\u901A",
  flat: "\u6241\u5E73",
  business: "\u6C89\u7A33",
  basic: "\u901A\u7528"
};
function pickContentLayout(itemCount) {
  if (itemCount <= 1) return "content-1col";
  if (itemCount === 2) return "content-2col";
  if (itemCount === 3) return "content-3col";
  if (itemCount === 4) return "content-4col";
  return "content-grid";
}
function subjectKey(subject) {
  if (subject in SUBJECT_CODES) return subject;
  return "_default";
}
function subjectFamily(subject) {
  if (["\u7269\u7406", "\u5316\u5B66", "\u751F\u7269"].includes(subject)) return "science";
  if (["\u5386\u53F2", "\u5730\u7406", "\u653F\u6CBB"].includes(subject)) return "humanity";
  return subject;
}
var EDU_LAYOUT_SKELETONS = {
  "edu-cover": {
    hint: "\u5C01\u9762\uFF1A\u586B\u5199\u8BFE\u9898\u3001\u5E74\u7EA7\u5B66\u79D1\u4E0E\u6388\u8BFE\u6559\u5E08",
    placeholders: [
      { key: "title", label: "\u8BFE\u9898\u540D\u79F0", kind: "title", rect: { x: 6, y: 30, w: 88, h: 14 }, fontSize: 36, bold: true, align: "center", placeholder: "\u8BFE\u9898\u540D\u79F0\uFF08\u586B\u5199\uFF09" },
      { key: "info", label: "\u5E74\u7EA7 / \u5B66\u79D1 / \u6559\u5E08", kind: "info-block", rect: { x: 6, y: 48, w: 88, h: 12 }, fontSize: 18, align: "center", placeholder: "\u5E74\u7EA7 / \u5B66\u79D1 / \u6388\u8BFE\u6559\u5E08" }
    ]
  },
  "edu-goal": {
    hint: "\u6559\u5B66\u76EE\u6807\uFF1A\u6309\u4E09\u7EF4\u76EE\u6807\u5206\u680F\u586B\u5199",
    placeholders: [
      { key: "knowledge", label: "\u77E5\u8BC6\u4E0E\u6280\u80FD", kind: "bullet", rect: { x: 5.3, y: 22, w: 29, h: 60 }, columns: 1, placeholder: "\u77E5\u8BC6\u4E0E\u6280\u80FD" },
      { key: "process", label: "\u8FC7\u7A0B\u4E0E\u65B9\u6CD5", kind: "bullet", rect: { x: 35.3, y: 22, w: 29, h: 60 }, columns: 1, placeholder: "\u8FC7\u7A0B\u4E0E\u65B9\u6CD5" },
      { key: "emotion", label: "\u60C5\u611F\u6001\u5EA6\u4EF7\u503C\u89C2", kind: "bullet", rect: { x: 65.3, y: 22, w: 29, h: 60 }, columns: 1, placeholder: "\u60C5\u611F\u6001\u5EA6\u4EF7\u503C\u89C2" }
    ]
  },
  "edu-explain": {
    hint: "\u77E5\u8BC6\u8BB2\u89E3\uFF1A\u4E0A\u65B9\u6982\u5FF5\u5B9A\u4E49\uFF0C\u4E0B\u65B9\u8981\u70B9\u5C55\u5F00",
    placeholders: [
      { key: "definition", label: "\u6982\u5FF5\u5B9A\u4E49", kind: "body", rect: { x: 6, y: 20, w: 88, h: 18 }, fontSize: 18, placeholder: "\u6982\u5FF5\u5B9A\u4E49\uFF08\u586B\u5199\uFF09" },
      { key: "points", label: "\u8981\u70B9\u5C55\u5F00", kind: "bullet", rect: { x: 6, y: 42, w: 88, h: 48 }, placeholder: "\u8981\u70B9\u5C55\u5F00" }
    ]
  },
  "edu-example": {
    hint: "\u4F8B\u9898\u6F14\u7EC3\uFF1A\u4E0A\u65B9\u9898\u5E72\uFF0C\u4E0B\u65B9\u89E3\u7B54\u6B65\u9AA4",
    placeholders: [
      { key: "question", label: "\u9898\u5E72", kind: "body", rect: { x: 6.3, y: 20, w: 87.4, h: 18 }, fontSize: 18, bold: true, placeholder: "\u9898\u5E72\uFF08\u586B\u5199\uFF09" },
      { key: "solution", label: "\u89E3\u7B54\u6B65\u9AA4", kind: "bullet", rect: { x: 5.3, y: 44, w: 89.4, h: 40 }, columns: 3, placeholder: "\u89E3\u7B54\u6B65\u9AA4" }
    ]
  },
  "edu-summary": {
    hint: "\u8BFE\u5802\u5C0F\u7ED3\uFF1A\u8981\u70B9\u5F52\u7EB3 + \u601D\u7EF4\u5BFC\u56FE\u5360\u4F4D",
    placeholders: [
      { key: "points", label: "\u8981\u70B9\u5F52\u7EB3", kind: "bullet", rect: { x: 6, y: 20, w: 88, h: 44 }, placeholder: "\u8981\u70B9\u5F52\u7EB3" },
      { key: "mindmap", label: "\u601D\u7EF4\u5BFC\u56FE\u5360\u4F4D", kind: "info-block", rect: { x: 6, y: 68, w: 88, h: 22 }, placeholder: "\u601D\u7EF4\u5BFC\u56FE\u5360\u4F4D" }
    ]
  },
  "edu-homework": {
    hint: "\u4F5C\u4E1A\u5E03\u7F6E\uFF1A\u5206\u5C42\u4F5C\u4E1A\uFF08\u57FA\u7840 / \u63D0\u9AD8 / \u62D3\u5C55\uFF09",
    placeholders: [
      { key: "basic", label: "\u57FA\u7840", kind: "bullet", rect: { x: 5.3, y: 22, w: 29, h: 60 }, columns: 1, placeholder: "\u57FA\u7840" },
      { key: "improve", label: "\u63D0\u9AD8", kind: "bullet", rect: { x: 35.3, y: 22, w: 29, h: 60 }, columns: 1, placeholder: "\u63D0\u9AD8" },
      { key: "expand", label: "\u62D3\u5C55", kind: "bullet", rect: { x: 65.3, y: 22, w: 29, h: 60 }, columns: 1, placeholder: "\u62D3\u5C55" }
    ]
  },
  // ── 通用版式（本期新增，PPT/H5 共用；几何为内容/布局分离的物理契约）──
  "cover": {
    hint: "\u5C01\u9762\uFF1A\u6807\u9898 + \u526F\u6807\u9898 + \u4FE1\u606F",
    placeholders: [
      { key: "title", label: "\u6807\u9898", kind: "title", rect: { x: 8, y: 32, w: 84, h: 16 }, fontSize: 36, bold: true, align: "center", placeholder: "\u6807\u9898\uFF08\u586B\u5199\uFF09" },
      { key: "subtitle", label: "\u526F\u6807\u9898", kind: "body", rect: { x: 8, y: 50, w: 84, h: 10 }, fontSize: 18, align: "center", placeholder: "\u526F\u6807\u9898" },
      { key: "info", label: "\u4FE1\u606F", kind: "info-block", rect: { x: 8, y: 62, w: 84, h: 8 }, fontSize: 14, align: "center", placeholder: "\u5B66\u79D1 / \u5E74\u7EA7 / \u4F5C\u8005" }
    ]
  },
  "toc": {
    hint: "\u76EE\u5F55\uFF1A\u6807\u9898 + \u76EE\u5F55\u9879\uFF08\u22646\uFF09",
    placeholders: [
      { key: "title", label: "\u76EE\u5F55\u6807\u9898", kind: "title", rect: { x: 8, y: 12, w: 84, h: 10 }, fontSize: 24, bold: true, placeholder: "\u76EE\u5F55" },
      { key: "items", label: "\u76EE\u5F55\u9879", kind: "bullet", rect: { x: 14, y: 30, w: 72, h: 56 }, columns: 1, placeholder: "\u76EE\u5F55\u9879" }
    ]
  },
  "section": {
    hint: "\u5206\u9694\u9875\uFF1A\u7AE0\u8282\u6807\u9898",
    placeholders: [
      { key: "title", label: "\u7AE0\u8282\u6807\u9898", kind: "title", rect: { x: 10, y: 42, w: 80, h: 16 }, fontSize: 32, bold: true, align: "center", placeholder: "\u7AE0\u8282\u6807\u9898" }
    ]
  },
  "content-1col": {
    hint: "\u5355\u680F\u5185\u5BB9\u9875",
    placeholders: [
      { key: "title", label: "\u6807\u9898", kind: "title", rect: { x: 6.3, y: 12, w: 87.4, h: 10 }, fontSize: 24, bold: true, placeholder: "\u6807\u9898" },
      { key: "body", label: "\u5185\u5BB9", kind: "bullet", rect: { x: 6.3, y: 28, w: 87.4, h: 60 }, columns: 1, placeholder: "\u5185\u5BB9\u8981\u70B9" }
    ]
  },
  "content-2col": {
    hint: "\u53CC\u680F\u5185\u5BB9\u9875",
    placeholders: [
      { key: "title", label: "\u6807\u9898", kind: "title", rect: { x: 6.3, y: 12, w: 87.4, h: 10 }, fontSize: 24, bold: true, placeholder: "\u6807\u9898" },
      { key: "left", label: "\u5DE6\u680F", kind: "bullet", rect: { x: 6.3, y: 28, w: 43, h: 60 }, columns: 1, placeholder: "\u5DE6\u680F\u5185\u5BB9" },
      { key: "right", label: "\u53F3\u680F", kind: "bullet", rect: { x: 50.7, y: 28, w: 43, h: 60 }, columns: 1, placeholder: "\u53F3\u680F\u5185\u5BB9" }
    ]
  },
  "content-3col": {
    hint: "\u4E09\u680F\u5185\u5BB9\u9875",
    placeholders: [
      { key: "title", label: "\u6807\u9898", kind: "title", rect: { x: 6.3, y: 12, w: 87.4, h: 10 }, fontSize: 24, bold: true, placeholder: "\u6807\u9898" },
      { key: "col1", label: "\u680F1", kind: "bullet", rect: { x: 6.3, y: 28, w: 28, h: 60 }, columns: 1, placeholder: "\u680F1" },
      { key: "col2", label: "\u680F2", kind: "bullet", rect: { x: 36.2, y: 28, w: 28, h: 60 }, columns: 1, placeholder: "\u680F2" },
      { key: "col3", label: "\u680F3", kind: "bullet", rect: { x: 66.1, y: 28, w: 28, h: 60 }, columns: 1, placeholder: "\u680F3" }
    ]
  },
  "content-4col": {
    hint: "\u56DB\u680F\u5185\u5BB9\u9875",
    placeholders: [
      { key: "title", label: "\u6807\u9898", kind: "title", rect: { x: 6.3, y: 12, w: 87.4, h: 10 }, fontSize: 24, bold: true, placeholder: "\u6807\u9898" },
      { key: "col1", label: "\u680F1", kind: "bullet", rect: { x: 6.3, y: 28, w: 20.5, h: 60 }, columns: 1, placeholder: "\u680F1" },
      { key: "col2", label: "\u680F2", kind: "bullet", rect: { x: 29.2, y: 28, w: 20.5, h: 60 }, columns: 1, placeholder: "\u680F2" },
      { key: "col3", label: "\u680F3", kind: "bullet", rect: { x: 52.1, y: 28, w: 20.5, h: 60 }, columns: 1, placeholder: "\u680F3" },
      { key: "col4", label: "\u680F4", kind: "bullet", rect: { x: 75, y: 28, w: 20.5, h: 60 }, columns: 1, placeholder: "\u680F4" }
    ]
  },
  "content-grid": {
    hint: "\u7F51\u683C\u5185\u5BB9\u9875\uFF082-6\u9879\u81EA\u9002\u5E94\u5217\u6570\uFF09",
    placeholders: [
      { key: "title", label: "\u6807\u9898", kind: "title", rect: { x: 6.3, y: 12, w: 87.4, h: 10 }, fontSize: 24, bold: true, placeholder: "\u6807\u9898" },
      { key: "items", label: "\u7F51\u683C\u9879", kind: "bullet", rect: { x: 6.3, y: 28, w: 87.4, h: 60 }, columns: 3, placeholder: "\u7F51\u683C\u9879" }
    ]
  },
  "summary": {
    hint: "\u603B\u7ED3\u9875\uFF1A\u6807\u9898 + \u8981\u70B9\uFF08\u22646\uFF09",
    placeholders: [
      { key: "title", label: "\u603B\u7ED3\u6807\u9898", kind: "title", rect: { x: 6.3, y: 12, w: 87.4, h: 10 }, fontSize: 24, bold: true, placeholder: "\u8BFE\u5802\u5C0F\u7ED3" },
      { key: "items", label: "\u8981\u70B9", kind: "bullet", rect: { x: 6.3, y: 28, w: 87.4, h: 60 }, columns: 2, placeholder: "\u8981\u70B9" }
    ]
  },
  "comparison": {
    hint: "\u5BF9\u6BD4\u9875\uFF1A\u5DE6\u53F3\u4E24\u680F",
    placeholders: [
      { key: "title", label: "\u5BF9\u6BD4\u6807\u9898", kind: "title", rect: { x: 6.3, y: 12, w: 87.4, h: 10 }, fontSize: 24, bold: true, placeholder: "\u5BF9\u6BD4" },
      { key: "left", label: "\u5DE6\u4FA7", kind: "bullet", rect: { x: 6.3, y: 28, w: 43, h: 60 }, columns: 1, placeholder: "\u5DE6\u4FA7" },
      { key: "right", label: "\u53F3\u4FA7", kind: "bullet", rect: { x: 50.7, y: 28, w: 43, h: 60 }, columns: 1, placeholder: "\u53F3\u4FA7" }
    ]
  },
  "timeline": {
    hint: "\u65F6\u95F4\u7EBF\u9875\uFF1A\u4E8B\u4EF6\u5E8F\u5217\uFF08\u22646\uFF09",
    placeholders: [
      { key: "title", label: "\u65F6\u95F4\u7EBF\u6807\u9898", kind: "title", rect: { x: 6.3, y: 12, w: 87.4, h: 10 }, fontSize: 24, bold: true, placeholder: "\u65F6\u95F4\u7EBF" },
      { key: "events", label: "\u4E8B\u4EF6", kind: "bullet", rect: { x: 6.3, y: 30, w: 87.4, h: 56 }, columns: 1, placeholder: "\u4E8B\u4EF6\u8282\u70B9" }
    ]
  },
  "chart": {
    hint: "\u56FE\u8868\u9875\uFF1A\u6807\u9898 + \u6570\u636E/\u8BF4\u660E\u5360\u4F4D",
    placeholders: [
      { key: "title", label: "\u56FE\u8868\u6807\u9898", kind: "title", rect: { x: 6.3, y: 12, w: 87.4, h: 10 }, fontSize: 24, bold: true, placeholder: "\u56FE\u8868\u6807\u9898" },
      { key: "data", label: "\u56FE\u8868\u6570\u636E/\u8BF4\u660E", kind: "body", rect: { x: 6.3, y: 28, w: 87.4, h: 60 }, fontSize: 16, placeholder: "\u56FE\u8868\u6570\u636E\u6216\u8BF4\u660E" }
    ]
  },
  "image-text": {
    hint: "\u56FE\u6587\u6DF7\u6392\uFF1A\u56FE\u7247 + \u6587\u5B57",
    placeholders: [
      { key: "title", label: "\u6807\u9898", kind: "title", rect: { x: 6.3, y: 12, w: 87.4, h: 10 }, fontSize: 24, bold: true, placeholder: "\u6807\u9898" },
      { key: "image", label: "\u56FE\u7247", kind: "info-block", rect: { x: 6.3, y: 28, w: 43, h: 58 }, placeholder: "\u56FE\u7247\u5360\u4F4D" },
      { key: "body", label: "\u6587\u5B57", kind: "bullet", rect: { x: 50.7, y: 28, w: 43, h: 58 }, columns: 1, placeholder: "\u6587\u5B57\u8BF4\u660E" }
    ]
  },
  "image-full": {
    hint: "\u5168\u5C4F\u56FE\u7247\uFF1A\u56FE\u7247 + \u56FE\u6CE8",
    placeholders: [
      { key: "image", label: "\u5168\u5C4F\u56FE\u7247", kind: "info-block", rect: { x: 6.3, y: 16, w: 87.4, h: 68 }, placeholder: "\u5168\u5C4F\u56FE\u7247" },
      { key: "caption", label: "\u56FE\u6CE8", kind: "body", rect: { x: 6.3, y: 86, w: 87.4, h: 8 }, fontSize: 14, align: "center", placeholder: "\u56FE\u6CE8" }
    ]
  }
};
var SK_LOW_BASE = {
  "edu-cover": { hint: "\u5C01\u9762\uFF1A\u8BFE\u9898\u5927\u5B57\u53F7\uFF0C\u914D\u5E74\u7EA7\u5B66\u79D1\u6559\u5E08\u4FE1\u606F\u5757", placeholders: [{ key: "title", label: "\u8BFE\u9898\u540D\u79F0\uFF08\u5927\u5B57\u53F7\uFF09", kind: "title" }, { key: "info", label: "\u5E74\u7EA7 / \u5B66\u79D1 / \u6559\u5E08", kind: "info-block" }] },
  "edu-goal": { hint: "\u6559\u5B66\u76EE\u6807\uFF1A\u4E09\u7EF4\u76EE\u6807\uFF0C\u914D\u56FE\u793A\u610F", placeholders: [{ key: "knowledge", label: "\u77E5\u8BC6\u4E0E\u6280\u80FD", kind: "bullet" }, { key: "process", label: "\u8FC7\u7A0B\u4E0E\u65B9\u6CD5", kind: "bullet" }, { key: "emotion", label: "\u60C5\u611F\u6001\u5EA6\u4EF7\u503C\u89C2", kind: "bullet" }] },
  "edu-explain": { hint: "\u77E5\u8BC6\u8BB2\u89E3\uFF1A\u56FE\u6587\u5E76\u91CD\uFF0C\u6982\u5FF5+\u914D\u56FE", placeholders: [{ key: "definition", label: "\u6982\u5FF5\u5B9A\u4E49", kind: "body" }, { key: "picture", label: "\u914D\u56FE/\u793A\u610F\u56FE", kind: "info-block" }, { key: "points", label: "\u8981\u70B9\u5C55\u5F00", kind: "bullet" }] },
  "edu-example": { hint: "\u4F8B\u9898\u6F14\u7EC3\uFF1A\u9898\u5E72\u5927\u5B57 + \u5206\u6B65", placeholders: [{ key: "question", label: "\u9898\u5E72\uFF08\u5927\u5B57\u53F7\uFF09", kind: "body" }, { key: "solution", label: "\u89E3\u7B54\u6B65\u9AA4", kind: "bullet" }] },
  "edu-summary": { hint: "\u8BFE\u5802\u5C0F\u7ED3\uFF1A\u8981\u70B9 + \u8DA3\u5473\u5BFC\u56FE", placeholders: [{ key: "points", label: "\u8981\u70B9\u5F52\u7EB3", kind: "bullet" }, { key: "mindmap", label: "\u601D\u7EF4\u5BFC\u56FE\u5360\u4F4D", kind: "info-block" }] },
  "edu-homework": { hint: "\u4F5C\u4E1A\u5E03\u7F6E\uFF1A\u5206\u5C42\uFF08\u57FA\u7840/\u63D0\u9AD8/\u62D3\u5C55\uFF09", placeholders: [{ key: "basic", label: "\u57FA\u7840", kind: "bullet" }, { key: "improve", label: "\u63D0\u9AD8", kind: "bullet" }, { key: "expand", label: "\u62D3\u5C55", kind: "bullet" }] }
};
var SK_UP_BASE = {
  "edu-cover": { hint: "\u5C01\u9762\uFF1A\u8BFE\u9898+\u5E74\u7EA7\u5B66\u79D1\u6559\u5E08\u4FE1\u606F\u5757", placeholders: [{ key: "title", label: "\u8BFE\u9898\u540D\u79F0", kind: "title" }, { key: "info", label: "\u5E74\u7EA7 / \u5B66\u79D1 / \u6559\u5E08", kind: "info-block" }] },
  "edu-goal": { hint: "\u6559\u5B66\u76EE\u6807\uFF1A\u4E09\u7EF4\u76EE\u6807\u5206\u680F", placeholders: [{ key: "knowledge", label: "\u77E5\u8BC6\u4E0E\u6280\u80FD", kind: "bullet" }, { key: "process", label: "\u8FC7\u7A0B\u4E0E\u65B9\u6CD5", kind: "bullet" }, { key: "emotion", label: "\u60C5\u611F\u6001\u5EA6\u4EF7\u503C\u89C2", kind: "bullet" }] },
  "edu-explain": { hint: "\u77E5\u8BC6\u8BB2\u89E3\uFF1A\u6982\u5FF5\u5B9A\u4E49 + \u8981\u70B9", placeholders: [{ key: "definition", label: "\u6982\u5FF5\u5B9A\u4E49", kind: "body" }, { key: "points", label: "\u8981\u70B9\u5C55\u5F00", kind: "bullet" }] },
  "edu-example": { hint: "\u4F8B\u9898\u6F14\u7EC3\uFF1A\u9898\u5E72 + \u89E3\u7B54\u6B65\u9AA4", placeholders: [{ key: "question", label: "\u9898\u5E72", kind: "body" }, { key: "solution", label: "\u89E3\u7B54\u6B65\u9AA4", kind: "bullet" }] },
  "edu-summary": { hint: "\u8BFE\u5802\u5C0F\u7ED3\uFF1A\u8981\u70B9\u5F52\u7EB3 + \u5BFC\u56FE", placeholders: [{ key: "points", label: "\u8981\u70B9\u5F52\u7EB3", kind: "bullet" }, { key: "mindmap", label: "\u601D\u7EF4\u5BFC\u56FE\u5360\u4F4D", kind: "info-block" }] },
  "edu-homework": { hint: "\u4F5C\u4E1A\u5E03\u7F6E\uFF1A\u5206\u5C42\uFF08\u57FA\u7840/\u63D0\u9AD8/\u62D3\u5C55\uFF09", placeholders: [{ key: "basic", label: "\u57FA\u7840", kind: "bullet" }, { key: "improve", label: "\u63D0\u9AD8", kind: "bullet" }, { key: "expand", label: "\u62D3\u5C55", kind: "bullet" }] }
};
var SK_MID_BASE = {
  "edu-cover": { hint: "\u5C01\u9762\uFF1A\u8BFE\u9898+\u5E74\u7EA7\u5B66\u79D1\u6559\u5E08\u4FE1\u606F\u5757", placeholders: [{ key: "title", label: "\u8BFE\u9898\u540D\u79F0", kind: "title" }, { key: "info", label: "\u5E74\u7EA7 / \u5B66\u79D1 / \u6559\u5E08", kind: "info-block" }] },
  "edu-goal": { hint: "\u6559\u5B66\u76EE\u6807\uFF1A\u4E09\u7EF4\u76EE\u6807 + \u8003\u70B9\u5BF9\u63A5", placeholders: [{ key: "knowledge", label: "\u77E5\u8BC6\u4E0E\u6280\u80FD", kind: "bullet" }, { key: "process", label: "\u8FC7\u7A0B\u4E0E\u65B9\u6CD5", kind: "bullet" }, { key: "emotion", label: "\u60C5\u611F\u6001\u5EA6\u4EF7\u503C\u89C2", kind: "bullet" }, { key: "exam", label: "\u8003\u70B9\u5BF9\u63A5", kind: "info-block" }] },
  "edu-explain": { hint: "\u77E5\u8BC6\u8BB2\u89E3\uFF1A\u5B9A\u4E49 + \u63A8\u5BFC + \u8981\u70B9", placeholders: [{ key: "definition", label: "\u6982\u5FF5/\u516C\u5F0F", kind: "body" }, { key: "derive", label: "\u63A8\u5BFC\u8FC7\u7A0B", kind: "bullet" }, { key: "points", label: "\u8981\u70B9\u5C55\u5F00", kind: "bullet" }] },
  "edu-example": { hint: "\u4F8B\u9898\u6F14\u7EC3\uFF1A\u9898\u5E72 + \u601D\u8DEF + \u89E3\u7B54", placeholders: [{ key: "question", label: "\u9898\u5E72", kind: "body" }, { key: "thinking", label: "\u89E3\u9898\u601D\u8DEF", kind: "bullet" }, { key: "solution", label: "\u89E3\u7B54\u6B65\u9AA4", kind: "bullet" }] },
  "edu-summary": { hint: "\u8BFE\u5802\u5C0F\u7ED3\uFF1A\u8981\u70B9 + \u77E5\u8BC6\u7F51", placeholders: [{ key: "points", label: "\u8981\u70B9\u5F52\u7EB3", kind: "bullet" }, { key: "mindmap", label: "\u77E5\u8BC6\u7F51\u7EDC\u5360\u4F4D", kind: "info-block" }] },
  "edu-homework": { hint: "\u4F5C\u4E1A\u5E03\u7F6E\uFF1A\u5206\u5C42\uFF08\u57FA\u7840/\u63D0\u9AD8/\u62D3\u5C55/\u63A2\u7A76\uFF09", placeholders: [{ key: "basic", label: "\u57FA\u7840", kind: "bullet" }, { key: "improve", label: "\u63D0\u9AD8", kind: "bullet" }, { key: "expand", label: "\u62D3\u5C55", kind: "bullet" }, { key: "probe", label: "\u63A2\u7A76", kind: "bullet" }] }
};
var SK_HIGH_BASE = {
  "edu-cover": { hint: "\u5C01\u9762\uFF1A\u8BFE\u9898+\u5E74\u7EA7\u5B66\u79D1\u6559\u5E08\u4FE1\u606F\u5757", placeholders: [{ key: "title", label: "\u8BFE\u9898\u540D\u79F0", kind: "title" }, { key: "info", label: "\u5E74\u7EA7 / \u5B66\u79D1 / \u6559\u5E08", kind: "info-block" }] },
  "edu-goal": { hint: "\u6559\u5B66\u76EE\u6807\uFF1A\u7D20\u517B\u76EE\u6807 + \u8003\u70B9", placeholders: [{ key: "literacy", label: "\u5B66\u79D1\u7D20\u517B", kind: "bullet" }, { key: "exam", label: "\u8003\u70B9\u5BF9\u63A5", kind: "info-block" }] },
  "edu-explain": { hint: "\u77E5\u8BC6\u8BB2\u89E3\uFF1A\u5B9A\u7406 + \u63A8\u5BFC\u94FE + \u53D8\u5F0F", placeholders: [{ key: "theorem", label: "\u5B9A\u7406/\u516C\u5F0F", kind: "body" }, { key: "derive", label: "\u63A8\u5BFC\u94FE", kind: "bullet" }, { key: "variant", label: "\u53D8\u5F0F\u8981\u70B9", kind: "bullet" }] },
  "edu-example": { hint: "\u4F8B\u9898\u6F14\u7EC3\uFF1A\u9898\u5E72 + \u591A\u89E3 + \u89C4\u8303", placeholders: [{ key: "question", label: "\u9898\u5E72", kind: "body" }, { key: "solutions", label: "\u591A\u89E3\u601D\u8DEF", kind: "bullet" }, { key: "standard", label: "\u89C4\u8303\u89E3\u7B54", kind: "bullet" }] },
  "edu-summary": { hint: "\u8BFE\u5802\u5C0F\u7ED3\uFF1A\u80FD\u529B\u63D0\u70BC + \u7F51\u7EDC", placeholders: [{ key: "points", label: "\u80FD\u529B\u63D0\u70BC", kind: "bullet" }, { key: "mindmap", label: "\u77E5\u8BC6\u7F51\u7EDC\u5360\u4F4D", kind: "info-block" }] },
  "edu-homework": { hint: "\u4F5C\u4E1A\u5E03\u7F6E\uFF1A\u5206\u5C42\uFF08\u57FA\u7840/\u7EFC\u5408/\u62D4\u9AD8\uFF09", placeholders: [{ key: "basic", label: "\u57FA\u7840", kind: "bullet" }, { key: "synthesis", label: "\u7EFC\u5408", kind: "bullet" }, { key: "advanced", label: "\u62D4\u9AD8", kind: "bullet" }] }
};
function withSubjectTweak(base, subject) {
  const fam = subjectFamily(subject);
  if (subject === "\u8BED\u6587") {
    return { ...base, "edu-explain": { hint: "\u6587\u672C\u8BB2\u89E3\uFF1A\u6BB5\u843D\u5927\u610F + \u8D4F\u6790", placeholders: [{ key: "paragraph", label: "\u6BB5\u843D\u5927\u610F", kind: "body" }, { key: "appreciate", label: "\u8BED\u8A00\u8D4F\u6790", kind: "bullet" }] } };
  }
  if (subject === "\u6570\u5B66") {
    return { ...base, "edu-explain": { hint: "\u77E5\u8BC6\u8BB2\u89E3\uFF1A\u516C\u5F0F + \u63A8\u5BFC + \u5E94\u7528", placeholders: [{ key: "formula", label: "\u516C\u5F0F/\u5B9A\u7406", kind: "body" }, { key: "derive", label: "\u63A8\u5BFC\u8FC7\u7A0B", kind: "bullet" }, { key: "apply", label: "\u5E94\u7528\u4E3E\u4F8B", kind: "bullet" }] } };
  }
  if (subject === "\u82F1\u8BED") {
    return { ...base, "edu-explain": { hint: "\u60C5\u5883\u8BB2\u89E3\uFF1A\u53E5\u578B + \u60C5\u5883", placeholders: [{ key: "pattern", label: "\u91CD\u70B9\u53E5\u578B", kind: "body" }, { key: "scene", label: "\u60C5\u5883\u793A\u4F8B", kind: "info-block" }, { key: "points", label: "\u8981\u70B9\u5C55\u5F00", kind: "bullet" }] } };
  }
  if (fam === "science") {
    return {
      ...base,
      "edu-explain": { hint: "\u77E5\u8BC6\u8BB2\u89E3\uFF1A\u6982\u5FF5 + \u539F\u7406", placeholders: [{ key: "concept", label: "\u6838\u5FC3\u6982\u5FF5", kind: "body" }, { key: "principle", label: "\u79D1\u5B66\u539F\u7406", kind: "bullet" }] },
      "edu-example": { hint: "\u5B9E\u9A8C/\u4F8B\u9898\uFF1A\u6B65\u9AA4 + \u73B0\u8C61", placeholders: [{ key: "question", label: "\u95EE\u9898/\u8BFE\u9898", kind: "body" }, { key: "steps", label: "\u5B9E\u9A8C\u6B65\u9AA4", kind: "bullet" }, { key: "phenomenon", label: "\u73B0\u8C61/\u7ED3\u8BBA", kind: "bullet" }] }
    };
  }
  if (fam === "humanity") {
    return { ...base, "edu-explain": { hint: "\u77E5\u8BC6\u8BB2\u89E3\uFF1A\u8109\u7EDC + \u53F2\u6599", placeholders: [{ key: "context", label: "\u65F6\u4EE3\u80CC\u666F", kind: "body" }, { key: "clue", label: "\u53D1\u5C55\u8109\u7EDC", kind: "bullet" }, { key: "evidence", label: "\u53F2\u6599/\u6848\u4F8B", kind: "info-block" }] } };
  }
  return base;
}
var STAGE_SKELETONS = {
  lower: { _default: SK_LOW_BASE, \u8BED\u6587: withSubjectTweak(SK_LOW_BASE, "\u8BED\u6587"), \u6570\u5B66: withSubjectTweak(SK_LOW_BASE, "\u6570\u5B66"), \u82F1\u8BED: withSubjectTweak(SK_LOW_BASE, "\u82F1\u8BED"), science: withSubjectTweak(SK_LOW_BASE, "science"), humanity: withSubjectTweak(SK_LOW_BASE, "humanity") },
  upper: { _default: SK_UP_BASE, \u8BED\u6587: withSubjectTweak(SK_UP_BASE, "\u8BED\u6587"), \u6570\u5B66: withSubjectTweak(SK_UP_BASE, "\u6570\u5B66"), \u82F1\u8BED: withSubjectTweak(SK_UP_BASE, "\u82F1\u8BED"), science: withSubjectTweak(SK_UP_BASE, "science"), humanity: withSubjectTweak(SK_UP_BASE, "humanity") },
  middle: { _default: SK_MID_BASE, \u8BED\u6587: withSubjectTweak(SK_MID_BASE, "\u8BED\u6587"), \u6570\u5B66: withSubjectTweak(SK_MID_BASE, "\u6570\u5B66"), \u82F1\u8BED: withSubjectTweak(SK_MID_BASE, "\u82F1\u8BED"), science: withSubjectTweak(SK_MID_BASE, "science"), humanity: withSubjectTweak(SK_MID_BASE, "humanity") },
  high: { _default: SK_HIGH_BASE, \u8BED\u6587: withSubjectTweak(SK_HIGH_BASE, "\u8BED\u6587"), \u6570\u5B66: withSubjectTweak(SK_HIGH_BASE, "\u6570\u5B66"), \u82F1\u8BED: withSubjectTweak(SK_HIGH_BASE, "\u82F1\u8BED"), science: withSubjectTweak(SK_HIGH_BASE, "science"), humanity: withSubjectTweak(SK_HIGH_BASE, "humanity") }
};
function skeletonFor(stage, subject) {
  const stageMap = STAGE_SKELETONS[stage];
  const base = stageMap[subjectKey(subject)] ?? stageMap._default ?? EDU_LAYOUT_SKELETONS;
  const merged = {};
  for (const layout of Object.keys(base)) {
    const sk = base[layout];
    const geo = EDU_LAYOUT_SKELETONS[layout];
    merged[layout] = {
      hint: sk?.hint ?? geo?.hint,
      placeholders: (sk?.placeholders ?? geo?.placeholders ?? []).map((p) => {
        const g = geo?.placeholders.find((x) => x.key === p.key);
        return g ? { ...g, ...p, rect: g.rect } : p;
      })
    };
  }
  return merged;
}
function getSkeleton(layout, opts) {
  if (opts?.tplLayouts && opts.tplLayouts[layout]) return opts.tplLayouts[layout];
  const sk = skeletonFor(opts?.stage ?? "upper", opts?.subject ?? "_default")[layout];
  if (sk) return sk;
  return EDU_LAYOUT_SKELETONS[layout];
}
var PLAIN_LAYOUTS = ["title-body", "title-only", "two-col", "blank"];
function isStructuredLayout(layout) {
  if (!layout) return false;
  if (PLAIN_LAYOUTS.includes(layout)) return false;
  return !!getSkeleton(layout);
}
function distributeToSlots(layout, bullets, opts) {
  const sk = getSkeleton(layout, opts);
  if (!sk) return {};
  const slots = {};
  let idx = 0;
  for (const p of sk.placeholders) {
    if (p.key === "title" && layout !== "cover") {
      slots[p.key] = [];
      continue;
    }
    if (p.kind === "bullet") {
      const n = Math.max(1, Math.ceil((bullets.length - idx) / remainingBulletCount(sk.placeholders, p)));
      let chunk = bullets.slice(idx, idx + n);
      if (p.columns && p.columns > 1) {
        const expanded = chunk.flatMap((line) => {
          const sub = line.split(/\n+/).map((x) => x.replace(/^[\s•\-*]+/, "").trim()).filter(Boolean);
          return sub.length > 1 ? sub : [line];
        });
        if (expanded.length >= p.columns) chunk = expanded;
      }
      slots[p.key] = chunk.length ? chunk : [];
      idx += n;
    } else {
      slots[p.key] = bullets[idx] !== void 0 ? [bullets[idx]] : [];
      idx += 1;
    }
  }
  if (idx < bullets.length) slots["__overflow"] = bullets.slice(idx);
  return slots;
}
function remainingBulletCount(phs, current) {
  let c = 0;
  let seen = false;
  for (const p of phs) {
    if (p === current) {
      seen = true;
      continue;
    }
    if (seen && p.kind === "bullet") c++;
  }
  return c + 1;
}
function eduDemoOutline() {
  return [
    { title: "\u5C01\u9762", bullets: ["\u300A\u8BFE\u7A0B\u6807\u9898\u300B", "\u5B66\u79D1 \xB7 \u5E74\u7EA7 \xB7 \u73ED\u7EA7", "\u6388\u8BFE\u6559\u5E08\uFF1AXXX"], layout: "edu-cover", notes: "" },
    { title: "\u5B66\u4E60\u76EE\u6807", bullets: ["\u77E5\u8BC6\u70B9\u4E00\uFF1A\u80FD\u7406\u89E3\u5E76\u8868\u8FF0", "\u77E5\u8BC6\u70B9\u4E8C\uFF1A\u80FD\u8FD0\u7528\u89E3\u51B3", "\u6838\u5FC3\u7D20\u517B\uFF1A\u57F9\u517B\u63A2\u7A76\u80FD\u529B"], layout: "edu-goal", notes: "" },
    { title: "\u60C5\u5883\u5BFC\u5165", bullets: ["\u751F\u6D3B/\u65E7\u77E5\u60C5\u5883\u5F15\u51FA\u95EE\u9898", "\u6FC0\u53D1\u5174\u8DA3\u3001\u660E\u786E\u5B66\u4E60\u4EFB\u52A1"], layout: "title-body", notes: "" },
    { title: "\u65B0\u77E5\u8BB2\u89E3", bullets: ["\u6838\u5FC3\u6982\u5FF5\u4E0E\u539F\u7406", "\u5173\u952E\u6B65\u9AA4\u4E0E\u8981\u70B9", "\u6613\u9519\u70B9\u63D0\u793A"], layout: "edu-explain", notes: "" },
    { title: "\u4F8B\u9898\u7CBE\u8BB2", bullets: ["\u5178\u578B\u4F8B\u9898\u5448\u73B0", "\u601D\u8DEF\u5206\u6790 + \u5206\u6B65\u89E3\u7B54", "\u65B9\u6CD5\u5F52\u7EB3"], layout: "edu-example", notes: "" },
    { title: "\u8BFE\u5802\u5C0F\u7ED3", bullets: ["\u672C\u8282\u8BFE\u6838\u5FC3\u6536\u83B7", "\u77E5\u8BC6\u7ED3\u6784\u68B3\u7406"], layout: "edu-summary", notes: "" },
    { title: "\u8BFE\u540E\u4F5C\u4E1A", bullets: ["\u57FA\u7840\u5DE9\u56FA\u7EC3\u4E60", "\u62D3\u5C55\u63D0\u5347\u4EFB\u52A1"], layout: "edu-homework", notes: "" }
  ];
}
var DEMO_CHINA_CHINESE = [
  { title: "\u5C01\u9762", bullets: ["\u300A\u8BFE\u9898\u540D\u79F0\u300B", "\u5E74\u7EA7 \xB7 \u5B66\u79D1", "\u6388\u8BFE\u6559\u5E08\uFF1AXXX"], layout: "edu-cover", notes: "\u53EF\u914D\u6C34\u58A8/\u5C71\u6C34\u80CC\u666F" },
  { title: "\u5B66\u4E60\u76EE\u6807", bullets: ["\u8BED\u8A00\u5EFA\u6784\uFF1A\u8BF5\u8BFB\u79EF\u7D2F\uFF0C\u7406\u89E3\u6587\u610F", "\u5BA1\u7F8E\u9274\u8D4F\uFF1A\u54C1\u5473\u8BED\u8A00\uFF0C\u8D4F\u6790\u624B\u6CD5", "\u6587\u5316\u4F20\u627F\uFF1A\u4F53\u609F\u60C5\u611F\u4E0E\u6587\u5316\u81EA\u4FE1"], layout: "edu-goal", notes: "" },
  { title: "\u4F5C\u8005\u4E0E\u80CC\u666F", bullets: ["\u4F5C\u8005\u7B80\u4ECB\uFF08\u65F6\u4EE3 / \u751F\u5E73 / \u4EE3\u8868\u4F5C\uFF09", "\u521B\u4F5C\u80CC\u666F\u4E0E\u793E\u4F1A\u8BED\u5883"], layout: "edu-explain", notes: "\u7ED3\u5408\u53F2\u6599\u6216\u9898\u89E3" },
  { title: "\u521D\u8BFB\u611F\u77E5", bullets: ["\u6717\u8BFB\u6B63\u97F3\uFF0C\u8BFB\u51C6\u5B57\u8BCD", "\u6574\u4F53\u611F\u77E5\uFF0C\u6982\u62EC\u5185\u5BB9\u5927\u610F"], layout: "title-body", notes: "" },
  { title: "\u7CBE\u8BFB\u8D4F\u6790", bullets: ["\u6293\u610F\u8C61 / \u5173\u952E\u8BCD\uFF0C\u54C1\u5473\u8BED\u8A00", "\u540D\u53E5\u8D4F\u6790\u4E0E\u624B\u6CD5\u63A2\u5FAE", "\u60C5\u611F\u8109\u7EDC\u68B3\u7406"], layout: "edu-explain", notes: "\u53EF\u5206\u7EC4\u8BA8\u8BBA\u91CD\u70B9\u53E5" },
  { title: "\u5408\u4F5C\u63A2\u7A76", bullets: ["\u63A2\u7A76\u95EE\u9898\uFF1A\u4E3B\u9898\u4E0E\u73B0\u5B9E\u610F\u4E49", "\u5C0F\u7EC4\u5206\u4EAB\uFF0C\u4E92\u8BC4\u8865\u5145"], layout: "edu-example", notes: "" },
  { title: "\u62D3\u5C55\u5EF6\u4F38", bullets: ["\u5173\u8054\u9605\u8BFB / \u540C\u9898\u6750\u4F5C\u54C1", "\u6587\u5316\u94FE\u63A5\u4E0E\u73B0\u5B9E\u5173\u7167"], layout: "content-2col", notes: "" },
  { title: "\u8BFE\u5802\u5C0F\u7ED3", bullets: ["\u6838\u5FC3\u6536\u83B7\u68B3\u7406", "\u77E5\u8BC6\u7ED3\u6784\u5BFC\u56FE"], layout: "edu-summary", notes: "" },
  { title: "\u8BFE\u540E\u4F5C\u4E1A", bullets: ["\u57FA\u7840\uFF1A\u80CC\u8BF5 / \u9ED8\u5199", "\u63D0\u5347\uFF1A\u7EC3\u7B14\u6216\u77ED\u6587\u8BC4\u6790"], layout: "edu-homework", notes: "" }
];
var DEMO_CARTOON_KINDER = [
  { title: "\u5C01\u9762", bullets: ["\u8BFE\u7A0B\u300AXXX\u300B", "XX \u73ED\u7684\u5C0F\u670B\u53CB\u4EEC", "\u8001\u5E08\uFF1AXXX"], layout: "edu-cover", notes: "\u5927\u56FE\u5927\u5B57\uFF0C\u7AE5\u8DA3\u53EF\u7231" },
  { title: "\u4ECA\u5929\u7684\u76EE\u6807", bullets: ["\u8BA4\u77E5\uFF1A\u8BA4\u8BC6\u2026\u2026", "\u80FD\u529B\uFF1A\u5B66\u4F1A\u2026\u2026", "\u60C5\u611F\uFF1A\u559C\u6B22\u2026\u2026"], layout: "edu-goal", notes: "" },
  { title: "\u60C5\u5883\u5BFC\u5165", bullets: ["\u5C0F\u52A8\u7269\uFF08\u6216\u7ED8\u672C\uFF09\u6545\u4E8B\u5F15\u51FA", "\u6FC0\u53D1\u5174\u8DA3\uFF0C\u660E\u786E\u4ECA\u5929\u4EFB\u52A1"], layout: "title-body", notes: "" },
  { title: "\u8DA3\u5473\u8BA4\u77E5", bullets: ["\u770B\u4E00\u770B\uFF1A\u56FE\u7247 / \u5B9E\u7269\u8BA4\u4E00\u8BA4", "\u542C\u4E00\u542C\uFF1A\u513F\u6B4C / \u6545\u4E8B"], layout: "edu-explain", notes: "" },
  { title: "\u6E38\u620F\u4E92\u52A8", bullets: ["\u4E00\u8D77\u6765\u505A\u6E38\u620F", "\u52A8\u624B\u8BD5\u4E00\u8BD5"], layout: "edu-example", notes: "\u5206\u7EC4\u6216\u96C6\u4F53\u6E38\u620F" },
  { title: "\u52A8\u52A8\u624B", bullets: ["\u624B\u5DE5 / \u7ED8\u753B", "\u5C55\u793A\u4E0E\u5206\u4EAB"], layout: "content-2col", notes: "" },
  { title: "\u5FEB\u4E50\u5C0F\u7ED3", bullets: ["\u4ECA\u5929\u5B66\u4F1A\u4E86\u4EC0\u4E48", "\u7ED9\u81EA\u5DF1\u9F13\u9F13\u638C"], layout: "edu-summary", notes: "" },
  { title: "\u4EB2\u5B50\u5C0F\u4EFB\u52A1", bullets: ["\u548C\u7238\u7238\u5988\u5988\u4E00\u8D77\u2026\u2026", "\u62CD\u7167\u7247\u5206\u4EAB"], layout: "edu-homework", notes: "" }
];
var DEMO_MATH_PHYSICS = [
  { title: "\u5C01\u9762", bullets: ["\u300A\u8BFE\u9898\u540D\u79F0\u300B", "\u5E74\u7EA7 \xB7 \u5B66\u79D1", "\u6388\u8BFE\u6559\u5E08\uFF1AXXX"], layout: "edu-cover", notes: "\u53EF\u914D\u51E0\u4F55/\u516C\u5F0F\u80CC\u666F" },
  { title: "\u5B66\u4E60\u76EE\u6807", bullets: ["\u77E5\u8BC6\u4E0E\u6280\u80FD\uFF1A\u7406\u89E3\u6982\u5FF5\u4E0E\u89C4\u5F8B", "\u8FC7\u7A0B\u4E0E\u65B9\u6CD5\uFF1A\u7ECF\u5386\u63A2\u7A76\u4E0E\u63A8\u5BFC", "\u7D20\u517B\uFF1A\u5EFA\u6A21\u4E0E\u63A8\u7406\u80FD\u529B"], layout: "edu-goal", notes: "" },
  { title: "\u60C5\u5883\u5BFC\u5165", bullets: ["\u751F\u6D3B\u4E2D\u7684\u73B0\u8C61 / \u95EE\u9898\u60C5\u5883", "\u5F15\u51FA\u672C\u8282\u6838\u5FC3\u95EE\u9898"], layout: "title-body", notes: "" },
  { title: "\u6982\u5FF5\u5EFA\u6784", bullets: ["\u6838\u5FC3\u6982\u5FF5\u4E0E\u5B9A\u4E49", "\u5173\u952E\u8981\u7D20\u4E0E\u6761\u4EF6"], layout: "edu-explain", notes: "" },
  { title: "\u516C\u5F0F\u4E0E\u63A8\u5BFC", bullets: ["\u6838\u5FC3\u516C\u5F0F\u5448\u73B0", "\u63A8\u5BFC\u8FC7\u7A0B\u4E0E\u601D\u8DEF", "\u9002\u7528\u6761\u4EF6\u4E0E\u5355\u4F4D"], layout: "content-2col", notes: "\u677F\u4E66\u63A8\u5BFC\u6B65\u9AA4" },
  { title: "\u4F8B\u9898\u7CBE\u8BB2", bullets: ["\u5178\u578B\u4F8B\u9898\u5448\u73B0", "\u5BA1\u9898 \u2192 \u5EFA\u6A21 \u2192 \u6C42\u89E3", "\u6613\u9519\u70B9\u63D0\u793A"], layout: "edu-example", notes: "" },
  { title: "\u8BFE\u5802\u7EC3\u4E60", bullets: ["\u53D8\u5F0F\u8BAD\u7EC3", "\u5206\u7EC4\u677F\u6F14\u4E0E\u4E92\u8BC4"], layout: "edu-explain", notes: "" },
  { title: "\u8BFE\u5802\u5C0F\u7ED3", bullets: ["\u77E5\u8BC6\u7ED3\u6784\u5316\u68B3\u7406", "\u65B9\u6CD5\u5F52\u7EB3"], layout: "edu-summary", notes: "" },
  { title: "\u8BFE\u540E\u4F5C\u4E1A", bullets: ["\u57FA\u7840\u5DE9\u56FA", "\u62D3\u5C55\u63D0\u5347"], layout: "edu-homework", notes: "" }
];
var DEMO_SCIENCE_BIO = [
  { title: "\u5C01\u9762", bullets: ["\u300A\u8BFE\u9898\u540D\u79F0\u300B", "\u5E74\u7EA7 \xB7 \u5B66\u79D1", "\u6388\u8BFE\u6559\u5E08\uFF1AXXX"], layout: "edu-cover", notes: "\u53EF\u914D\u5B9E\u9A8C/\u81EA\u7136\u80CC\u666F" },
  { title: "\u5B66\u4E60\u76EE\u6807", bullets: ["\u89C2\u5BDF\u4E0E\u63CF\u8FF0\u73B0\u8C61", "\u7406\u89E3\u539F\u7406\u4E0E\u673A\u5236", "\u5F62\u6210\u79D1\u5B66\u63A2\u7A76\u610F\u8BC6"], layout: "edu-goal", notes: "" },
  { title: "\u73B0\u8C61\u89C2\u5BDF", bullets: ["\u5448\u73B0\u89C2\u5BDF / \u5B9E\u9A8C\u73B0\u8C61", "\u63D0\u51FA\u5F85\u89E3\u51B3\u95EE\u9898"], layout: "title-body", notes: "" },
  { title: "\u63D0\u51FA\u5047\u8BBE", bullets: ["\u57FA\u4E8E\u73B0\u8C61\u4F5C\u51FA\u731C\u60F3", "\u660E\u786E\u63A2\u7A76\u53D8\u91CF"], layout: "edu-explain", notes: "" },
  { title: "\u5B9E\u9A8C\u63A2\u7A76", bullets: ["\u65B9\u6848\u8BBE\u8BA1\u4E0E\u6B65\u9AA4", "\u64CD\u4F5C\u8981\u70B9\u4E0E\u5B89\u5168", "\u8BB0\u5F55\u6570\u636E"], layout: "edu-example", notes: "\u6F14\u793A/\u5206\u7EC4\u5B9E\u9A8C" },
  { title: "\u5206\u6790\u7ED3\u8BBA", bullets: ["\u5904\u7406\u6570\u636E / \u73B0\u8C61", "\u5F97\u51FA\u7ED3\u8BBA\u5E76\u9A8C\u8BC1\u5047\u8BBE"], layout: "content-2col", notes: "" },
  { title: "\u5E94\u7528\u62D3\u5C55", bullets: ["\u8054\u7CFB\u751F\u6D3B\u5B9E\u9645", "\u524D\u6CBF\u6216\u8DE8\u5B66\u79D1\u94FE\u63A5"], layout: "edu-explain", notes: "" },
  { title: "\u8BFE\u5802\u5C0F\u7ED3", bullets: ["\u6838\u5FC3\u6982\u5FF5\u56DE\u987E", "\u63A2\u7A76\u65B9\u6CD5\u63D0\u70BC"], layout: "edu-summary", notes: "" },
  { title: "\u8BFE\u540E\u4F5C\u4E1A", bullets: ["\u89C2\u5BDF\u8BB0\u5F55", "\u63A2\u7A76\u5C0F\u62A5\u544A"], layout: "edu-homework", notes: "" }
];
var DEMO_ENGLISH = [
  { title: "\u5C01\u9762", bullets: ["Unit / Lesson Title", "Grade \xB7 English", "Teacher: XXX"], layout: "edu-cover", notes: "\u53EF\u914D\u60C5\u5883\u63D2\u56FE" },
  { title: "Learning Goals", bullets: ["\u80FD\u542C\u61C2\u5E76\u8BF4\u51FA\u76EE\u6807\u8BED", "\u80FD\u8BFB\u61C2\u5E76\u8FD0\u7528\u7ED3\u6784", "\u4E50\u4E8E\u8868\u8FBE\u3001\u8DE8\u6587\u5316\u610F\u8BC6"], layout: "edu-goal", notes: "" },
  { title: "Warm-up", bullets: ["\u6B4C\u66F2 / \u6E38\u620F / \u89C6\u9891\u5BFC\u5165", "\u6FC0\u6D3B\u5DF2\u77E5\u3001\u94FA\u57AB\u8BDD\u9898"], layout: "title-body", notes: "" },
  { title: "Words & Expressions", bullets: ["\u76EE\u6807\u8BCD\u6C47\u4E0E\u77ED\u8BED", "\u53D1\u97F3\u4E0E\u62FC\u5199\u64CD\u7EC3"], layout: "edu-explain", notes: "\u56FE\u6587\u914D\u5BF9" },
  { title: "Reading / Listening", bullets: ["\u8BED\u7BC7\u5448\u73B0\u4E0E\u7406\u89E3", "\u83B7\u53D6\u5173\u952E\u4FE1\u606F"], layout: "edu-example", notes: "" },
  { title: "Grammar Focus", bullets: ["\u76EE\u6807\u53E5\u578B / \u8BED\u6CD5\u70B9", "\u5F52\u7EB3\u4E0E\u4F8B\u53E5"], layout: "content-2col", notes: "" },
  { title: "Output Task", bullets: ["Speaking / Writing \u4EFB\u52A1", "\u5408\u4F5C\u5C55\u793A"], layout: "edu-explain", notes: "\u60C5\u666F\u5BF9\u8BDD\u6216\u5199\u4F5C" },
  { title: "Summary & Homework", bullets: ["\u672C\u8BFE\u5C0F\u7ED3", "\u542C\u8BF4\u8BFB\u5199\u4F5C\u4E1A"], layout: "edu-homework", notes: "" }
];
var DEMO_HISTORY_POLITICS = [
  { title: "\u5C01\u9762", bullets: ["\u300A\u8BFE\u9898\u540D\u79F0\u300B", "\u5E74\u7EA7 \xB7 \u5B66\u79D1", "\u6388\u8BFE\u6559\u5E08\uFF1AXXX"], layout: "edu-cover", notes: "\u53EF\u914D\u53F2\u6599/\u65F6\u95F4\u8F74\u80CC\u666F" },
  { title: "\u5B66\u4E60\u76EE\u6807", bullets: ["\u4E86\u89E3\u57FA\u672C\u53F2\u5B9E", "\u7406\u89E3\u56E0\u679C\u4E0E\u5F71\u54CD", "\u5F62\u6210\u4EF7\u503C\u8A8D\u8BC6"], layout: "edu-goal", notes: "" },
  { title: "\u65F6\u4EE3\u80CC\u666F", bullets: ["\u793E\u4F1A\u73AF\u5883\u4E0E\u6761\u4EF6", "\u524D\u56E0\u94FA\u57AB"], layout: "title-body", notes: "" },
  { title: "\u4E8B\u4EF6\u8109\u7EDC", bullets: ["\u8D77\u56E0 \u2192 \u7ECF\u8FC7 \u2192 \u7ED3\u679C", "\u5173\u952E\u4EBA\u7269\u4E0E\u8282\u70B9"], layout: "edu-explain", notes: "\u914D\u5408\u65F6\u95F4\u8F74" },
  { title: "\u5206\u6790\u63A2\u7A76", bullets: ["\u539F\u56E0\u6DF1\u5EA6\u5256\u6790", "\u5386\u53F2/\u73B0\u5B9E\u610F\u4E49"], layout: "edu-example", notes: "\u53F2\u6599\u5B9E\u8BC1" },
  { title: "\u53F2\u6599\u5B9E\u8BC1", bullets: ["\u9605\u8BFB\u6750\u6599 / \u56FE\u7247\u53F2\u6599", "\u63D0\u53D6\u4FE1\u606F\u3001\u8BBA\u4ECE\u53F2\u51FA"], layout: "content-2col", notes: "" },
  { title: "\u4EF7\u503C\u542F\u793A", bullets: ["\u7ECF\u9A8C\u4E0E\u6559\u8BAD", "\u5F53\u4EE3\u5173\u7167"], layout: "edu-explain", notes: "" },
  { title: "\u8BFE\u5802\u5C0F\u7ED3", bullets: ["\u77E5\u8BC6\u8109\u7EDC\u68B3\u7406", "\u6838\u5FC3\u7D20\u517B\u63D0\u5347"], layout: "edu-summary", notes: "" },
  { title: "\u8BFE\u540E\u4F5C\u4E1A", bullets: ["\u68B3\u7406\u7B14\u8BB0", "\u5C0F\u8BBA\u6587/\u601D\u7EF4\u5BFC\u56FE"], layout: "edu-homework", notes: "" }
];
var DEMO_ART_PE = [
  { title: "\u5C01\u9762", bullets: ["\u300A\u8BFE\u9898\u540D\u79F0\u300B", "\u5E74\u7EA7 \xB7 \u5B66\u79D1", "\u6388\u8BFE\u6559\u5E08\uFF1AXXX"], layout: "edu-cover", notes: "\u53EF\u914D\u4F5C\u54C1/\u52A8\u4F5C\u793A\u8303" },
  { title: "\u5B66\u4E60\u76EE\u6807", bullets: ["\u611F\u77E5\u4E0E\u6B23\u8D4F", "\u638C\u63E1\u6280\u6CD5 / \u52A8\u4F5C\u8981\u9886", "\u4E50\u4E8E\u8868\u73B0\u4E0E\u521B\u9020"], layout: "edu-goal", notes: "" },
  { title: "\u6B23\u8D4F\u611F\u77E5", bullets: ["\u540D\u4F5C / \u793A\u8303\u6B23\u8D4F", "\u611F\u53D7\u5F62\u5F0F\u4E0E\u60C5\u611F"], layout: "title-body", notes: "" },
  { title: "\u6280\u6CD5\u89E3\u6790", bullets: ["\u5173\u952E\u8981\u9886\u4E0E\u6B65\u9AA4", "\u6613\u9519\u63D0\u9192"], layout: "edu-explain", notes: "\u793A\u8303\u6F14\u793A" },
  { title: "\u5B9E\u8DF5\u521B\u4F5C", bullets: ["\u52A8\u624B\u521B\u4F5C / \u52A8\u4F5C\u7EC3\u4E60", "\u5DE1\u56DE\u6307\u5BFC"], layout: "edu-example", notes: "\u5206\u7EC4\u5B9E\u8DF5" },
  { title: "\u5C55\u793A\u8BC4\u4EF7", bullets: ["\u4F5C\u54C1 / \u6210\u679C\u5C55\u793A", "\u81EA\u8BC4\u4E92\u8BC4"], layout: "content-2col", notes: "" },
  { title: "\u62D3\u5C55\u5EF6\u4F38", bullets: ["\u751F\u6D3B\u4E2D\u7684\u5E94\u7528", "\u540D\u5BB6/\u8FDB\u9636\u8D4F\u6790"], layout: "edu-explain", notes: "" },
  { title: "\u8BFE\u5802\u5C0F\u7ED3", bullets: ["\u6536\u83B7\u4E0E\u4F53\u4F1A", "\u5BA1\u7F8E/\u5065\u5EB7\u63D0\u5347"], layout: "edu-summary", notes: "" }
];
var DEMO_CLASS_MEETING = [
  { title: "\u5C01\u9762", bullets: ["\u4E3B\u9898\u73ED\u4F1A\uFF1A\u300A\u4E3B\u9898\u300B", "\u73ED\u7EA7 \xB7 \u65E5\u671F", "\u4E3B\u6301\u4EBA\uFF1AXXX"], layout: "edu-cover", notes: "\u53EF\u914D\u52B1\u5FD7/\u4E3B\u9898\u80CC\u666F" },
  { title: "\u73ED\u4F1A\u76EE\u6807", bullets: ["\u660E\u786E\u4E3B\u9898\u610F\u4E49", "\u8FBE\u6210\u5171\u8BC6\u4E0E\u884C\u52A8"], layout: "edu-goal", notes: "" },
  { title: "\u60C5\u5883\u6545\u4E8B", bullets: ["\u6848\u4F8B / \u89C6\u9891 / \u8EAB\u8FB9\u4E8B", "\u5F15\u53D1\u5171\u9E23\u4E0E\u601D\u8003"], layout: "title-body", notes: "" },
  { title: "\u8BA8\u8BBA\u4EA4\u6D41", bullets: ["\u5206\u7EC4\u8BA8\u8BBA\u8BAE\u9898", "\u5206\u4EAB\u89C2\u70B9"], layout: "edu-example", notes: "" },
  { title: "\u884C\u52A8\u5021\u8BAE", bullets: ["\u62DF\u5B9A\u73ED\u7EA7\u516C\u7EA6", "\u5236\u5B9A\u884C\u52A8\u8BA1\u5212"], layout: "content-2col", notes: "" },
  { title: "\u8DF5\u884C\u5C55\u793A", bullets: ["\u627F\u8BFA\u7B7E\u540D / \u6210\u679C\u5899", "\u5C0F\u7EC4\u8868\u6001"], layout: "edu-explain", notes: "" },
  { title: "\u603B\u7ED3\u611F\u609F", bullets: ["\u73ED\u4E3B\u4EFB\u5BC4\u8BED", "\u6211\u7684\u6536\u83B7"], layout: "edu-summary", notes: "" }
];
var DEMO_LECTURE_OPEN = [
  { title: "\u5C01\u9762", bullets: ["\u300A\u8BFE\u9898\u540D\u79F0\u300B", "\u8BF4\u8BFE / \u516C\u5F00\u8BFE", "\u6388\u8BFE\u6559\u5E08\uFF1AXXX"], layout: "edu-cover", notes: "" },
  { title: "\u6559\u6750\u4E0E\u5B66\u60C5", bullets: ["\u6559\u6750\u5730\u4F4D\u4E0E\u4F5C\u7528", "\u5B66\u60C5\u5206\u6790"], layout: "edu-explain", notes: "" },
  { title: "\u6559\u5B66\u76EE\u6807", bullets: ["\u77E5\u8BC6\u4E0E\u80FD\u529B", "\u8FC7\u7A0B\u4E0E\u65B9\u6CD5", "\u91CD\u96BE\u70B9\u7A81\u7834"], layout: "edu-goal", notes: "" },
  { title: "\u6559\u6CD5\u5B66\u6CD5", bullets: ["\u6559\u6CD5\u9009\u62E9", "\u5B66\u6CD5\u6307\u5BFC"], layout: "content-2col", notes: "" },
  { title: "\u6559\u5B66\u8FC7\u7A0B", bullets: ["\u73AF\u8282\u8BBE\u8BA1\u4E0E\u610F\u56FE", "\u5E08\u751F\u6D3B\u52A8\u5B89\u6392"], layout: "edu-example", notes: "" },
  { title: "\u677F\u4E66\u8BBE\u8BA1", bullets: ["\u7ED3\u6784\u5316\u677F\u4E66", "\u903B\u8F91\u5448\u73B0"], layout: "edu-explain", notes: "" },
  { title: "\u6559\u5B66\u53CD\u601D", bullets: ["\u4EAE\u70B9\u4E0E\u4E0D\u8DB3", "\u6539\u8FDB\u65B9\u5411"], layout: "edu-summary", notes: "" }
];
var SCENARIO_OUTLINES = {
  "china-chinese": DEMO_CHINA_CHINESE,
  "cartoon-kindergarten": DEMO_CARTOON_KINDER,
  "math-physics": DEMO_MATH_PHYSICS,
  "science-bio": DEMO_SCIENCE_BIO,
  "english": DEMO_ENGLISH,
  "history-politics": DEMO_HISTORY_POLITICS,
  "art-pe": DEMO_ART_PE,
  "class-meeting": DEMO_CLASS_MEETING,
  "lecture-open": DEMO_LECTURE_OPEN
};
var SUBJECT_SCENARIO = {
  math: "math-physics",
  physics: "math-physics",
  chemistry: "math-physics",
  it: "math-physics",
  biology: "science-bio",
  science: "science-bio",
  geography: "science-bio",
  english: "english",
  history: "history-politics",
  politics: "history-politics",
  art: "art-pe",
  pe: "art-pe",
  chinese: "china-chinese"
  // 语文默认国风文脉；china 风格模板会再被强化
};
function scenarioKeyFor(def) {
  const stage = def.tags?.find((t2) => t2.kind === "stage")?.value;
  const scenario = def.tags?.find((t2) => t2.kind === "scenario")?.value;
  const lowAge = def.style === "cartoon" || def.style === "fresh";
  if (lowAge && stage === "kindergarten") return "cartoon-kindergarten";
  if (lowAge && scenario === "class-meeting") return "class-meeting";
  for (const s of def.subjects ?? []) {
    const key = SUBJECT_SCENARIO[s];
    if (key) return key;
  }
  if (stage === "kindergarten") return "cartoon-kindergarten";
  if (scenario === "class-meeting") return "class-meeting";
  if (scenario === "lecture" || scenario === "open-class" || scenario === "training" || scenario === "review") {
    return "lecture-open";
  }
  if (def.style === "china") return "china-chinese";
  return void 0;
}
function lookupScenarioOutline(def) {
  const key = scenarioKeyFor(def);
  return key ? SCENARIO_OUTLINES[key] : void 0;
}
function pptTemplate(id, def, kind = "ppt") {
  const th = getTheme(def.themeId);
  return {
    id,
    kind,
    name: def.name ?? `${th?.name ?? def.themeId}\xB7${STYLE_LABELS[def.style]}\u8BFE\u4EF6`,
    style: def.style,
    tags: def.tags,
    colorFamily: def.colorFamily,
    themeId: def.themeId,
    // 每套模板都自带同一套教学版式骨架（结构占位通用，配色由 themeId 决定）
    layouts: { ...EDU_LAYOUT_SKELETONS },
    subjects: def.subjects,
    grades: def.grades,
    globalDecor: decorForScenario(def),
    // 内容充分度：优先用模板自带提纲 → 场景匹配提纲 → 回落通用提纲
    demoOutline: def.demoOutline ?? lookupScenarioOutline(def) ?? eduDemoOutline()
  };
}
var t = (kind, value) => ({ kind, value });
var styles = (...v) => v.map((x) => t("style", x));
var stages = (...v) => v.map((x) => t("stage", x));
var subjects = (...v) => v.map((x) => t("subject", x));
var scenarios = (...v) => v.map((x) => t("scenario", x));
var pageTypes = (...v) => v.map((x) => t("pageType", x));
var PPT_TEMPLATE_DEFS = [
  // 国风
  { style: "china", themeId: "zgf-ink-wash", colorFamily: "mono", tags: [...styles("china"), ...scenarios("general"), ...stages("primary", "junior", "senior")] },
  { style: "china", themeId: "zgf-guochao", colorFamily: "red-gold", tags: [...styles("china"), ...scenarios("class-meeting", "first-class"), ...stages("primary", "junior")] },
  { style: "china", themeId: "zgf-shanshui", colorFamily: "cyan-green", tags: [...styles("china"), ...scenarios("general"), ...stages("junior", "senior")] },
  { style: "china", themeId: "zgf-song-qing", colorFamily: "cyan-green", tags: [...styles("china"), ...subjects("chinese", "history"), ...stages("junior", "senior")], demoOutline: DEMO_CHINA_CHINESE },
  // 素净/简约
  { style: "minimal", themeId: "min-classic-blue", colorFamily: "blue", tags: [...styles("minimal"), ...scenarios("lecture", "open-class"), ...stages("junior", "senior")] },
  { style: "minimal", themeId: "min-geo", colorFamily: "gray", tags: [...styles("minimal"), ...scenarios("general"), ...stages("senior", "college")] },
  { style: "minimal", themeId: "min-gray-premium", colorFamily: "gray", tags: [...styles("minimal", "business"), ...scenarios("training"), ...stages("college")] },
  { style: "minimal", themeId: "min-pure-white", colorFamily: "gray", tags: [...styles("minimal"), ...scenarios("general"), ...stages("primary", "junior", "senior")] },
  { style: "minimal", themeId: "min-modern-line", colorFamily: "blue", tags: [...styles("minimal"), ...scenarios("lecture"), ...stages("junior", "senior")] },
  { style: "minimal", themeId: "min-navy-intellectual", colorFamily: "blue", tags: [...styles("minimal", "academic"), ...subjects("math", "physics"), ...stages("senior", "college")] },
  // 科技
  { style: "tech", themeId: "te-quantum-blue", colorFamily: "blue", tags: [...styles("tech"), ...subjects("it", "physics"), ...stages("junior", "senior", "college")] },
  { style: "tech", themeId: "te-tech-navy", colorFamily: "blue", tags: [...styles("tech"), ...scenarios("open-class"), ...stages("senior", "college")] },
  { style: "tech", themeId: "te-cyber-purple", colorFamily: "purple", tags: [...styles("tech"), ...subjects("it"), ...stages("junior", "senior")] },
  { style: "tech", themeId: "te-aurora-green", colorFamily: "cyan-green", tags: [...styles("tech"), ...subjects("science", "biology"), ...stages("junior", "senior")] },
  { style: "tech", themeId: "te-digital-cyan", colorFamily: "cyan-green", tags: [...styles("tech"), ...scenarios("first-class"), ...stages("primary", "junior")] },
  // 清新
  { style: "fresh", themeId: "fr-mint", colorFamily: "cyan-green", tags: [...styles("fresh"), ...stages("kindergarten", "primary")], demoOutline: DEMO_CARTOON_KINDER },
  { style: "fresh", themeId: "fr-sky-blue", colorFamily: "blue", tags: [...styles("fresh"), ...scenarios("parents"), ...stages("kindergarten", "primary")] },
  { style: "fresh", themeId: "fr-warm-orange", colorFamily: "warm", tags: [...styles("fresh"), ...stages("kindergarten", "primary")] },
  { style: "fresh", themeId: "fr-macaron-pink", colorFamily: "purple", tags: [...styles("fresh"), ...subjects("art"), ...stages("kindergarten", "primary")] },
  { style: "fresh", themeId: "fr-sakura", colorFamily: "warm", tags: [...styles("fresh"), ...stages("primary", "junior")] },
  // 严谨/学术
  { style: "academic", themeId: "aca-edu-blue", colorFamily: "blue", tags: [...styles("academic"), ...scenarios("lecture", "review"), ...stages("junior", "senior", "college")] },
  { style: "academic", themeId: "aca-rational", colorFamily: "gray", tags: [...styles("academic"), ...subjects("math", "physics", "chemistry"), ...stages("senior", "college")] },
  { style: "academic", themeId: "aca-deep-green", colorFamily: "cyan-green", tags: [...styles("academic"), ...subjects("biology", "science"), ...stages("junior", "senior")] },
  { style: "academic", themeId: "aca-cream", colorFamily: "warm", tags: [...styles("academic"), ...stages("primary", "junior")] },
  // 卡通（绘本/插画风，借鉴 GordenPPTSkill 卡通模板风格）
  { style: "cartoon", themeId: "sp-cartoon", colorFamily: "gradient", tags: [...styles("cartoon"), ...pageTypes("cover", "content"), ...stages("kindergarten", "primary")] },
  { style: "cartoon", themeId: "sp-doodle", colorFamily: "gradient", tags: [...styles("cartoon"), ...scenarios("class-meeting"), ...pageTypes("content", "summary"), ...stages("kindergarten", "primary")] },
  { style: "cartoon", themeId: "gr-orange-pink", colorFamily: "gradient", tags: [...styles("cartoon"), ...subjects("art", "english"), ...pageTypes("cover", "content", "homework"), ...stages("kindergarten", "primary")] },
  { style: "cartoon", themeId: "fr-macaron-pink", colorFamily: "purple", tags: [...styles("cartoon"), ...subjects("art"), ...pageTypes("cover", "content"), ...stages("kindergarten", "primary", "junior")] },
  { style: "cartoon", themeId: "fr-warm-orange", colorFamily: "warm", tags: [...styles("cartoon"), ...scenarios("first-class"), ...stages("kindergarten", "primary")] },
  { style: "cartoon", themeId: "gr-gold-orange", colorFamily: "warm", tags: [...styles("cartoon"), ...subjects("pe", "art"), ...stages("kindergarten", "primary", "junior")] },
  // 红色教育（主题教育/党政红/节日红金，借鉴 GordenPPTSkill 红色教育模板风格）
  { style: "cartoon", themeId: "sp-party-red", colorFamily: "red-gold", tags: [...styles("cartoon"), ...scenarios("class-meeting", "first-class"), ...subjects("politics"), ...stages("primary", "junior", "senior")] },
  { style: "cartoon", themeId: "sp-festive", colorFamily: "red-gold", tags: [...styles("cartoon"), ...scenarios("class-meeting", "first-class"), ...subjects("chinese", "politics", "english"), ...stages("primary", "junior", "senior")] },
  { style: "china", themeId: "zgf-classic-red", colorFamily: "red-gold", tags: [...styles("china"), ...scenarios("class-meeting", "first-class"), ...subjects("chinese", "history", "politics"), ...stages("junior", "senior")] },
  { style: "china", themeId: "zgf-guochao", colorFamily: "red-gold", tags: [...styles("china"), ...scenarios("class-meeting"), ...stages("primary", "junior")] },
  // 扁平
  { style: "flat", themeId: "mo-haze-blue", colorFamily: "blue", tags: [...styles("flat"), ...stages("primary", "junior")] },
  { style: "flat", themeId: "mo-gray-purple", colorFamily: "purple", tags: [...styles("flat"), ...subjects("art"), ...stages("primary", "junior")] },
  { style: "flat", themeId: "mo-bean-green", colorFamily: "cyan-green", tags: [...styles("flat"), ...subjects("science"), ...stages("primary", "junior")] },
  // 沉稳/商务
  { style: "business", themeId: "gr-blue-purple", colorFamily: "purple", tags: [...styles("business"), ...scenarios("training", "parents"), ...stages("college")] },
  { style: "business", themeId: "wa-elegant-purple", colorFamily: "purple", tags: [...styles("business"), ...scenarios("open-class"), ...stages("senior", "college")] },
  // 通用结构（骨架 × 色系，不绑定具体场景）
  { style: "basic", themeId: "min-classic-blue", colorFamily: "blue", tags: [...styles("basic"), ...scenarios("general")] },
  { style: "basic", themeId: "min-pure-white", colorFamily: "gray", tags: [...styles("basic"), ...scenarios("general")] },
  { style: "basic", themeId: "aca-edu-blue", colorFamily: "blue", tags: [...styles("basic"), ...scenarios("general")] }
];
var H5_TEMPLATE_DEFS = [
  { style: "china", themeId: "zgf-guochao", colorFamily: "red-gold", tags: [...styles("china"), ...scenarios("first-class", "class-meeting"), ...stages("primary", "junior")] },
  { style: "china", themeId: "zgf-shanshui", colorFamily: "cyan-green", tags: [...styles("china"), ...scenarios("general"), ...stages("junior", "senior")] },
  { style: "china", themeId: "zgf-song-qing", colorFamily: "cyan-green", tags: [...styles("china"), ...subjects("chinese", "history"), ...stages("junior", "senior")] },
  { style: "minimal", themeId: "min-pure-white", colorFamily: "gray", tags: [...styles("minimal"), ...scenarios("general"), ...stages("primary", "junior", "senior")] },
  { style: "minimal", themeId: "min-modern-line", colorFamily: "blue", tags: [...styles("minimal"), ...scenarios("lecture"), ...stages("junior", "senior")] },
  { style: "minimal", themeId: "min-navy-intellectual", colorFamily: "blue", tags: [...styles("minimal", "academic"), ...subjects("math"), ...stages("senior", "college")] },
  { style: "tech", themeId: "te-quantum-blue", colorFamily: "blue", tags: [...styles("tech"), ...subjects("it", "physics"), ...stages("junior", "senior", "college")] },
  { style: "tech", themeId: "te-aurora-green", colorFamily: "cyan-green", tags: [...styles("tech"), ...subjects("science"), ...stages("junior", "senior")] },
  { style: "tech", themeId: "te-digital-cyan", colorFamily: "cyan-green", tags: [...styles("tech"), ...scenarios("first-class"), ...stages("primary", "junior")] },
  { style: "fresh", themeId: "fr-mint", colorFamily: "cyan-green", tags: [...styles("fresh"), ...stages("kindergarten", "primary")] },
  { style: "fresh", themeId: "fr-sky-blue", colorFamily: "blue", tags: [...styles("fresh"), ...scenarios("parents"), ...stages("kindergarten", "primary")] },
  { style: "fresh", themeId: "fr-warm-orange", colorFamily: "warm", tags: [...styles("fresh"), ...stages("kindergarten", "primary")] },
  { style: "fresh", themeId: "fr-macaron-pink", colorFamily: "purple", tags: [...styles("fresh"), ...subjects("art"), ...stages("kindergarten", "primary")] },
  { style: "fresh", themeId: "fr-sakura", colorFamily: "warm", tags: [...styles("fresh"), ...stages("primary", "junior")] },
  { style: "fresh", themeId: "fr-lemon", colorFamily: "gradient", tags: [...styles("fresh"), ...stages("kindergarten", "primary")] },
  { style: "academic", themeId: "aca-edu-blue", colorFamily: "blue", tags: [...styles("academic"), ...scenarios("review"), ...stages("junior", "senior", "college")] },
  { style: "academic", themeId: "aca-deep-green", colorFamily: "cyan-green", tags: [...styles("academic"), ...subjects("biology"), ...stages("junior", "senior")] },
  { style: "cartoon", themeId: "sp-cartoon", colorFamily: "gradient", tags: [...styles("cartoon"), ...pageTypes("cover", "content"), ...stages("kindergarten", "primary")] },
  { style: "cartoon", themeId: "sp-doodle", colorFamily: "gradient", tags: [...styles("cartoon"), ...scenarios("class-meeting"), ...pageTypes("content", "summary"), ...stages("kindergarten", "primary")] },
  { style: "cartoon", themeId: "gr-orange-pink", colorFamily: "gradient", tags: [...styles("cartoon"), ...subjects("art", "english"), ...pageTypes("cover", "content", "homework"), ...stages("kindergarten", "primary")] },
  { style: "cartoon", themeId: "fr-macaron-pink", colorFamily: "purple", tags: [...styles("cartoon"), ...subjects("art"), ...pageTypes("cover", "content"), ...stages("kindergarten", "primary", "junior")] },
  { style: "cartoon", themeId: "fr-warm-orange", colorFamily: "warm", tags: [...styles("cartoon"), ...scenarios("first-class"), ...stages("kindergarten", "primary")] },
  { style: "cartoon", themeId: "gr-gold-orange", colorFamily: "warm", tags: [...styles("cartoon"), ...subjects("pe", "art"), ...stages("kindergarten", "primary", "junior")] },
  { style: "cartoon", themeId: "sp-party-red", colorFamily: "red-gold", tags: [...styles("cartoon"), ...scenarios("first-class", "class-meeting"), ...subjects("politics"), ...stages("kindergarten", "primary", "junior", "senior")] },
  { style: "cartoon", themeId: "sp-festive", colorFamily: "red-gold", tags: [...styles("cartoon"), ...scenarios("class-meeting", "first-class"), ...subjects("chinese", "politics", "english"), ...stages("primary", "junior", "senior")] },
  { style: "china", themeId: "zgf-classic-red", colorFamily: "red-gold", tags: [...styles("china"), ...scenarios("class-meeting", "first-class"), ...subjects("chinese", "history", "politics"), ...stages("junior", "senior")] },
  { style: "china", themeId: "zgf-guochao", colorFamily: "red-gold", tags: [...styles("china"), ...scenarios("class-meeting"), ...stages("primary", "junior")] },
  { style: "flat", themeId: "mo-haze-blue", colorFamily: "blue", tags: [...styles("flat"), ...stages("primary", "junior")] },
  { style: "flat", themeId: "mo-gray-purple", colorFamily: "purple", tags: [...styles("flat"), ...subjects("art"), ...stages("primary", "junior")] },
  { style: "flat", themeId: "mo-bean-green", colorFamily: "cyan-green", tags: [...styles("flat"), ...subjects("science"), ...stages("primary", "junior")] },
  { style: "flat", themeId: "mo-rose-gray", colorFamily: "purple", tags: [...styles("flat"), ...stages("primary", "junior")] },
  { style: "business", themeId: "gr-blue-purple", colorFamily: "purple", tags: [...styles("business"), ...scenarios("training"), ...stages("college")] },
  { style: "business", themeId: "wa-elegant-purple", colorFamily: "purple", tags: [...styles("business"), ...scenarios("open-class"), ...stages("senior", "college")] },
  { style: "basic", themeId: "min-pure-white", colorFamily: "gray", tags: [...styles("basic"), ...scenarios("general")] },
  { style: "basic", themeId: "aca-edu-blue", colorFamily: "blue", tags: [...styles("basic"), ...scenarios("general")] }
];
function svgDataUrl(svg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
var STYLE_DECOR_MAP = {
  china: [
    { assetId: "decor-china-seal", name: "\u56FD\u98CE\u5370\u7AE0", snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect x="6" y="6" width="52" height="52" rx="8" fill="none" stroke="#B5121B" stroke-width="3"/><text x="32" y="42" font-size="28" text-anchor="middle" fill="#B5121B" font-family="serif">\u5370</text></svg>`) }, slot: "corner" },
    { assetId: "decor-china-bamboo", name: "\u56FD\u98CE\u7AF9\u679D", snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40" viewBox="0 0 80 40"><g stroke="#1E5631" stroke-width="2" fill="none"><path d="M12 40 Q14 20 10 4"/><path d="M12 14 Q22 16 20 6"/><path d="M12 24 Q20 22 22 30"/><path d="M28 40 Q30 22 26 8"/><path d="M28 18 Q36 20 34 10"/><path d="M28 26 Q36 24 38 32"/></g></svg>`) }, slot: "floating" }
  ],
  minimal: [
    { assetId: "decor-minimal-line", name: "\u7D20\u51C0\u540C\u5FC3\u5706", snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="none" stroke="#9AA0A6" stroke-width="2"/><circle cx="32" cy="32" r="18" fill="none" stroke="#9AA0A6" stroke-width="1"/></svg>`) }, slot: "corner" },
    { assetId: "decor-minimal-dot", name: "\u7D20\u51C0\u5706\u70B9", snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="5" fill="#C0C4C8"/></svg>`) }, slot: "floating" }
  ],
  tech: [
    { assetId: "decor-tech-hex", name: "\u79D1\u6280\u516D\u8FB9\u5F62", snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><polygon points="32,6 56,20 56,44 32,58 8,44 8,20" fill="none" stroke="#02A7F0" stroke-width="2.5"/><circle cx="32" cy="32" r="6" fill="#02A7F0"/></svg>`) }, slot: "corner" },
    { assetId: "decor-tech-grid", name: "\u79D1\u6280\u7F51\u683C", snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><g stroke="#7FB8E6" stroke-width="1" fill="none"><path d="M0 20 H60 M0 40 H60 M20 0 V60 M40 0 V60"/></g></svg>`) }, slot: "floating" }
  ],
  fresh: [
    { assetId: "decor-fresh-leaf", name: "\u6E05\u65B0\u53F6\u5B50", snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><path d="M32 56 C10 44 8 16 28 8 C52 2 58 30 32 56 Z" fill="#8FD3B6"/><path d="M28 12 C40 18 40 34 28 48" stroke="#1E5631" stroke-width="2" fill="none"/></svg>`) }, slot: "corner" },
    { assetId: "decor-fresh-leaf-sm", name: "\u6E05\u65B0\u5C0F\u53F6", snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><path d="M20 36 C8 28 6 12 18 6 C32 2 36 22 20 36 Z" fill="#A8D8C0"/></svg>`) }, slot: "floating" }
  ],
  academic: [
    { assetId: "decor-aca-rule", name: "\u4E25\u8C28\u659C\u7EBF", snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><line x1="8" y1="56" x2="56" y2="8" stroke="#1F4E79" stroke-width="3"/><line x1="16" y1="56" x2="56" y2="16" stroke="#1F4E79" stroke-width="1.5"/><line x1="8" y1="48" x2="48" y2="8" stroke="#1F4E79" stroke-width="1.5"/></svg>`) }, slot: "corner" },
    { assetId: "decor-aca-line", name: "\u4E25\u8C28\u6A2A\u7EBF", snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="10" viewBox="0 0 60 10"><rect x="0" y="3" width="60" height="4" fill="#1F4E79"/></svg>`) }, slot: "floating" }
  ],
  cartoon: [
    { assetId: "decor-cartoon-sun", name: "\u5361\u901A\u592A\u9633", snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="16" fill="#FFB020"/><g stroke="#FFB020" stroke-width="3" stroke-linecap="round"><line x1="32" y1="6" x2="32" y2="14"/><line x1="32" y1="50" x2="32" y2="58"/><line x1="6" y1="32" x2="14" y2="32"/><line x1="50" y1="32" x2="58" y2="32"/><line x1="13" y1="13" x2="19" y2="19"/><line x1="45" y1="45" x2="51" y2="51"/><line x1="13" y1="51" x2="19" y2="45"/><line x1="45" y1="19" x2="51" y2="13"/></g></svg>`) }, slot: "corner" },
    { assetId: "decor-cartoon-star", name: "\u5361\u901A\u661F\u661F", snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><polygon points="20,4 24,15 36,15 26,22 30,34 20,27 10,34 14,22 4,15 16,15" fill="#FFC53D"/></svg>`) }, slot: "floating" }
  ],
  flat: [
    { assetId: "decor-flat-circle", name: "\u6241\u5E73\u53CC\u5706", snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="20" cy="44" r="14" fill="#E8EAF0"/><circle cx="44" cy="20" r="10" fill="#D0D5DD"/></svg>`) }, slot: "corner" },
    { assetId: "decor-flat-dot", name: "\u6241\u5E73\u5706\u70B9\u7EC4", snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="12" cy="28" r="7" fill="#E8EAF0"/><circle cx="28" cy="12" r="5" fill="#C8CDD6"/></svg>`) }, slot: "floating" }
  ],
  business: [
    { assetId: "decor-biz-line", name: "\u6C89\u7A33\u8FB9\u6846", snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect x="10" y="18" width="44" height="34" fill="none" stroke="#4A4A4A" stroke-width="2.5"/><line x1="10" y1="28" x2="54" y2="28" stroke="#4A4A4A" stroke-width="1.5"/></svg>`) }, slot: "corner" },
    { assetId: "decor-biz-bar", name: "\u6C89\u7A33\u8272\u5757\u6761", snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="8" viewBox="0 0 60 8"><rect x="0" y="0" width="60" height="8" fill="#4A4A4A"/></svg>`) }, slot: "floating" }
  ],
  basic: [
    { assetId: "decor-basic-corner", name: "\u901A\u7528\u89D2\u6807", snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><path d="M4 60 L60 60 L60 4" fill="none" stroke="#B0B6BD" stroke-width="3"/></svg>`) }, slot: "corner" },
    { assetId: "decor-basic-dot", name: "\u901A\u7528\u5706\u70B9", snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="4" fill="#B0B6BD"/></svg>`) }, slot: "floating" }
  ]
};
function decorForStyle(style) {
  return STYLE_DECOR_MAP[style] || STYLE_DECOR_MAP.basic;
}
var SCENARIO_DECOR_MAP = {
  "china-chinese": [
    { assetId: "decor-china-brush", name: "\u56FD\u98CE\u6BDB\u7B14", snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect x="10" y="6" width="44" height="9" rx="3" fill="#7A1F1F"/><path d="M28 15 L36 15 L33 50 Z" fill="#3A2A1A"/><path d="M31 50 Q33 60 35 50 Q33 55 31 50 Z" fill="#1C1C1C"/><circle cx="14" cy="54" r="3" fill="#1E5631"/></svg>`) }, slot: "corner" },
    { assetId: "decor-china-cloud", name: "\u56FD\u98CE\u5377\u4E91", snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40" viewBox="0 0 80 40"><path d="M8 28 Q8 16 20 16 Q24 8 34 12 Q44 8 46 18 Q58 16 58 26 Q58 32 48 32 L16 32 Q8 32 8 28 Z" fill="none" stroke="#B5121B" stroke-width="2"/></svg>`) }, slot: "floating" }
  ],
  "cartoon-kindergarten": [
    { assetId: "decor-kinder-bear", name: "\u5361\u901A\u5C0F\u718A", snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="34" r="20" fill="#F4A261"/><circle cx="22" cy="18" r="6" fill="#F4A261"/><circle cx="42" cy="18" r="6" fill="#F4A261"/><circle cx="25" cy="32" r="3" fill="#3A2A1A"/><circle cx="39" cy="32" r="3" fill="#3A2A1A"/><ellipse cx="32" cy="40" rx="5" ry="4" fill="#3A2A1A"/></svg>`) }, slot: "corner" },
    { assetId: "decor-kinder-balloon", name: "\u5361\u901A\u6C14\u7403", snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48"><ellipse cx="20" cy="16" rx="13" ry="15" fill="#FF6B9D"/><path d="M20 31 L20 40" stroke="#FF6B9D" stroke-width="1.5"/><path d="M16 40 L24 40 L20 45 Z" fill="#FF6B9D"/></svg>`) }, slot: "floating" }
  ]
};
function decorForScenario(def) {
  const key = scenarioKeyFor(def);
  if (key && SCENARIO_DECOR_MAP[key]) return SCENARIO_DECOR_MAP[key];
  return decorForStyle(def.style);
}
function buildTemplates(kind, defs) {
  return defs.map(
    (def, i) => pptTemplate(`${kind}-${def.style}-${i + 1}`, def, kind)
  );
}
var PPT_TEMPLATES = buildTemplates("ppt", PPT_TEMPLATE_DEFS);
var H5_TEMPLATES = buildTemplates("h5", H5_TEMPLATE_DEFS);
function makeBasicTemplate(kind = "ppt") {
  return {
    id: `basic-${kind}`,
    kind,
    name: "\u901A\u7528\u7ED3\u6784",
    style: "basic",
    themeId: "min-classic-blue",
    // 占位，实际套用由色系覆盖
    layouts: { ...EDU_LAYOUT_SKELETONS },
    demoOutline: eduDemoOutline()
  };
}
var BASIC_TEMPLATE = makeBasicTemplate("ppt");

// src/lib/exportPptx.ts
var GRAY = "666666";
var FONT = "Microsoft YaHei";
function clean(t2) {
  return t2.replace(/\*{1,3}/g, "").replace(/`/g, "").replace(/_/g, "").trim();
}
function bodyToRichLines(body, theme = DEFAULT_THEME) {
  const out = [];
  const font = theme.font || FONT;
  const lines = body.split("\n");
  let inCode = false;
  let codeBuf = [];
  const flushCode = () => {
    if (codeBuf.length) {
      out.push({
        text: codeBuf.join("\n"),
        options: { fontFace: "Consolas", fontSize: 13, color: "33415C", breakLine: true, paraSpaceAfter: 10 }
      });
      codeBuf = [];
    }
  };
  for (const line of lines) {
    const t2 = line.trim();
    if (t2.startsWith("```")) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(t2);
      continue;
    }
    if (!t2) continue;
    if (t2.startsWith("|")) {
      out.push({ text: clean(t2.replace(/\|/g, " ")), options: { fontFace: font, fontSize: 14, color: theme.subtle, breakLine: true, paraSpaceAfter: 6 } });
      continue;
    }
    const ul = t2.match(/^[-*]\s+(.+)/);
    if (ul) {
      out.push({ text: clean(ul[1]), options: { bullet: { indent: 18 }, fontFace: font, fontSize: 16, color: theme.body, breakLine: true, paraSpaceAfter: 9 } });
      continue;
    }
    const ol = t2.match(/^\d+[\.)]\s+(.+)/);
    if (ol) {
      out.push({ text: clean(ol[1]), options: { bullet: { type: "number", indent: 26 }, fontFace: font, fontSize: 16, color: theme.body, breakLine: true, paraSpaceAfter: 9 } });
      continue;
    }
    out.push({ text: clean(t2), options: { fontFace: font, fontSize: 16, color: theme.body, breakLine: true, paraSpaceAfter: 11 } });
  }
  flushCode();
  return out;
}
function buildCoursewareSlides(content, opts) {
  const theme = opts.theme || DEFAULT_THEME;
  const sections = parseSections(content).filter((s) => s.title.trim() || s.body.trim());
  const slides = [];
  slides.push({
    kind: "cover",
    title: opts.title,
    subtitle: `${opts.subject} \xB7 ${opts.grade}${opts.teacherName ? "  \xB7  " + opts.teacherName : ""}`,
    footer: "\u77E5\u5FAE\u6559\u5B66 \xB7 ziwi.cn"
  });
  if (sections.length === 0) {
    slides.push({ kind: "content", title: "\u63D0\u793A", rich: [{ text: "\uFF08\u8BFE\u4EF6\u5185\u5BB9\u4E3A\u7A7A\uFF09", options: { fontFace: FONT, fontSize: 20, color: GRAY, breakLine: true } }] });
  }
  const total = sections.length || 1;
  sections.forEach((sec, idx) => {
    slides.push({
      kind: "content",
      title: sec.title || `\u7B2C ${idx + 1} \u8282`,
      rich: bodyToRichLines(sec.body, theme),
      pageNo: idx + 1,
      total,
      footer: `${opts.title}  \xB7  ${idx + 1}`
    });
  });
  return slides;
}
function slidesFromPpt(ppt, opts) {
  const theme = opts.theme || DEFAULT_THEME;
  const slides = [];
  const content = ppt.filter((s) => (s.kind || "content") !== "cover");
  const total = content.length || 1;
  ppt.forEach((s, idx) => {
    const kind = s.kind || (idx === 0 ? "cover" : "content");
    if (kind === "cover") {
      slides.push({
        kind: "cover",
        title: s.title,
        subtitle: `${opts.subject} \xB7 ${opts.grade}${opts.teacherName ? "  \xB7  " + opts.teacherName : ""}`,
        footer: "\u77E5\u5FAE\u6559\u5B66 \xB7 ziwi.cn"
      });
      return;
    }
    slides.push({
      kind: "content",
      title: s.title,
      notes: s.notes || "",
      rich: (s.bullets && s.bullets.length ? s.bullets : [s.title]).map((b) => ({
        text: b,
        options: { bullet: { indent: 18 }, fontFace: theme.font || FONT, fontSize: 18, color: theme.body, breakLine: true, paraSpaceAfter: 12 }
      })),
      pageNo: slides.filter((x) => x.kind === "content").length,
      total,
      footer: `${opts.title}  \xB7  ${slides.filter((x) => x.kind === "content").length}`
    });
  });
  return slides;
}
var VISUAL_TYPES = [
  "sequence",
  "compare-table",
  "timeline",
  "char-card",
  "compare-card",
  "quote",
  "diagram",
  "icon-card",
  "structure",
  "flow",
  "annotate"
];
function isValidVisual(v) {
  if (!v || typeof v !== "object" || typeof v.type !== "string") return false;
  if (!VISUAL_TYPES.includes(v.type)) return false;
  switch (v.type) {
    case "sequence":
      return Array.isArray(v.items) && v.items.length > 0;
    case "compare-table":
      return Array.isArray(v.cols) && Array.isArray(v.rows) && v.rows.length > 0;
    case "timeline":
      return Array.isArray(v.nodes) && v.nodes.length > 0;
    case "char-card":
      return Array.isArray(v.chars) && v.chars.length > 0;
    case "compare-card":
      return Array.isArray(v.pairs) && v.pairs.length > 0;
    case "quote":
      return typeof v.text === "string" && v.text.length > 0;
    case "diagram":
      return typeof v.center === "string" && Array.isArray(v.branches) && v.branches.length > 0;
    case "icon-card":
      return Array.isArray(v.items) && v.items.length > 0;
    case "structure":
      return Array.isArray(v.levels) && v.levels.length > 0;
    case "flow":
      return Array.isArray(v.steps) && v.steps.length > 0;
    case "annotate":
      return typeof v.text === "string" && v.text.length > 0;
    default:
      return false;
  }
}
function normalizeVisuals(v) {
  if (!v) return [];
  return Array.isArray(v) ? v.filter(isValidVisual) : isValidVisual(v) ? [v] : [];
}
function isValidComponent(it) {
  if (!it || typeof it !== "object" || typeof it.type !== "string") return false;
  const types = ["reveal", "quiz", "audio", "video", "gallery", "popup", "readalong"];
  if (!types.includes(it.type)) return false;
  switch (it.type) {
    case "reveal":
      return typeof it.answer === "string";
    case "quiz":
      return typeof it.question === "string" && Array.isArray(it.options) && typeof it.correct === "number";
    case "audio":
      return typeof it.src === "string";
    case "video":
      return typeof it.src === "string";
    case "gallery":
      return Array.isArray(it.images);
    case "popup":
      return typeof it.triggerText === "string" && typeof it.content === "string";
    case "readalong":
      return Array.isArray(it.sentences);
    default:
      return false;
  }
}
function normalizeInteractive(it) {
  if (!it) return [];
  return Array.isArray(it) ? it.filter(isValidComponent) : isValidComponent(it) ? [it] : [];
}
function pushInteractive(cur, comp) {
  if (!cur) return;
  cur.interactive = Array.isArray(cur.interactive) ? [...cur.interactive, comp] : cur.interactive ? [cur.interactive, comp] : comp;
}
function markdownToOutline(md) {
  const slides = [];
  let cur = null;
  let sceneMode = false;
  const keepLine = (s, ln) => {
    if (!s) return;
    s.keepRaw = s.keepRaw ? [...s.keepRaw, ln] : [ln];
  };
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const elMatch = line.match(/^<!--\s*CW-EL:([A-Za-z0-9+/=]+)\s*-->$/);
    if (elMatch && cur) {
      const els = b64dec(elMatch[1]);
      if (els) cur.elements = els;
      continue;
    }
    const itMatch = line.match(/^<!--\s*CW-IT:([A-Za-z0-9+/=]+)\s*-->$/);
    if (itMatch && cur) {
      const it = b64dec(itMatch[1]);
      if (it && isValidComponent(it)) {
        cur.interactive = Array.isArray(cur.interactive) ? [...cur.interactive, it] : cur.interactive ? [cur.interactive, it] : it;
      }
      continue;
    }
    const visMatch = line.match(/^<!--\s*VISUAL:([A-Za-z0-9+/=]+)\s*-->$/);
    if (visMatch && cur) {
      const v = b64dec(visMatch[1]);
      if (v && isValidVisual(v)) {
        cur.visuals = Array.isArray(cur.visuals) ? [...cur.visuals, v] : cur.visuals ? [cur.visuals, v] : v;
      }
      continue;
    }
    if (line.match(/^#\s+/) && !cur) continue;
    if (!cur && line.startsWith(">")) continue;
    const cm = line.match(/^<!--\s*(\w+)\s*:\s*(.*?)\s*-->\s*$/i);
    if (cm && cur) {
      const kw = cm[1].toLowerCase();
      const val = cm[2];
      if (kw === "layout") {
        cur.layout = val.trim();
        sceneMode = (cur.layout || "").startsWith("scene");
        continue;
      }
      if (sceneMode) {
        keepLine(cur, line);
        continue;
      }
      if (kw === "quiz") {
        const parts = val.split(/(?<!\\)\|/).map((s) => s.replace(/\\\|/g, "|").trim()).filter(Boolean);
        if (parts.length >= 3) {
          const correct = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(correct)) pushInteractive(cur, { type: "quiz", question: parts[0], options: parts.slice(1, parts.length - 1), correct });
        }
        continue;
      }
      if (kw === "readalong") {
        const parts = val.split(/(?<!\\)\|/).map((s) => s.replace(/\\\|/g, "|").trim()).filter(Boolean);
        if (parts.length) pushInteractive(cur, { type: "readalong", sentences: parts.map((t2) => ({ text: t2, src: "" })) });
        continue;
      }
      if (kw === "reveal") {
        const seg = val.split("=>");
        pushInteractive(cur, { type: "reveal", prompt: (seg[0] || "").trim(), answer: (seg[1] || "").trim() });
        continue;
      }
      if (kw === "draw") {
        pushInteractive(cur, { type: "drawing", title: val.trim(), prompt: "" });
        continue;
      }
      keepLine(cur, line);
      continue;
    }
    if (sceneMode && cur) {
      keepLine(cur, line);
      continue;
    }
    if (line.startsWith("## ")) {
      if (cur) {
        flushSlide(cur);
        slides.push(cur);
      }
      const title = line.slice(3).trim();
      cur = { title, bullets: [] };
      sceneMode = false;
    } else if (cur) {
      cur.bullets.push(line.replace(/^[-*]\s*/, "").replace(/^#{1,2}\s*/, "").replace(/\*{1,3}/g, "").replace(/`/g, ""));
    } else {
      cur = { title: "\u8BFE\u4EF6", bullets: [line.replace(/^[-*]\s*/, "").replace(/^#{1,2}\s*/, "")] };
    }
  }
  if (cur) {
    flushSlide(cur);
    slides.push(cur);
  }
  return slides;
}
function flushSlide(s) {
  if (s.slots) return;
  if (!s.layout && s.bullets.length >= 2) {
    s.layout = pickContentLayout(s.bullets.length);
  }
  if (isStructuredLayout(s.layout)) {
    const dist = distributeToSlots(s.layout, s.bullets);
    if (Object.keys(dist).length) s.slots = dist;
  }
}
function pptToOutline(ppt) {
  return ppt.filter((s) => (s.kind || "content") !== "cover").map((s) => ({ title: s.title, bullets: s.bullets && s.bullets.length ? s.bullets : [s.title], notes: s.notes || "" }));
}
function outlineToSlides(outline, opts) {
  const theme = opts.theme || DEFAULT_THEME;
  const total = outline.length || 1;
  const slides = [{
    kind: "cover",
    title: opts.title,
    subtitle: `${opts.subject} \xB7 ${opts.grade}${opts.teacherName ? "  \xB7  " + opts.teacherName : ""}`,
    footer: "\u77E5\u5FAE\u6559\u5B66 \xB7 ziwi.cn"
  }];
  outline.forEach((s, i) => {
    slides.push({
      kind: "content",
      title: s.title,
      notes: s.notes || "",
      layout: s.layout,
      slots: s.slots,
      rich: (s.bullets.length ? s.bullets : [s.title]).map((b) => ({
        text: b,
        options: { bullet: { indent: 18 }, fontFace: theme.font || FONT, fontSize: 18, color: theme.body, breakLine: true, paraSpaceAfter: 12 }
      })),
      elements: s.elements,
      visuals: s.visuals,
      decor: s.decor || null,
      interactive: s.interactive,
      pageNo: i + 1,
      total,
      footer: `${opts.title}  \xB7  ${i + 1}`
    });
  });
  return slides;
}
function outlineToMarkdown(outline, opts) {
  const lines = [`# ${opts.title}`, "", `> ${opts.subject} \xB7 ${opts.grade}`, ""];
  outline.forEach((s) => {
    lines.push(`## ${s.title}`);
    if (s.layout) lines.push(`<!-- layout: ${s.layout} -->`);
    if (s.keepRaw && s.keepRaw.length) lines.push(...s.keepRaw);
    const bs = s.elements && s.elements.length ? extractBullets(s.elements) : s.bullets;
    bs.forEach((b) => lines.push(`- ${b}`));
    if (s.notes) lines.push("", `> \u6559\u5E08\u5907\u6CE8\uFF1A${s.notes}`);
    if (s.elements && s.elements.length) lines.push(`<!-- CW-EL:${b64enc(s.elements)} -->`);
    if (s.interactive && isValidComponent(s.interactive)) lines.push(`<!-- CW-IT:${b64enc(s.interactive)} -->`);
    for (const v of normalizeVisuals(s.visuals)) lines.push(`<!-- VISUAL:${b64enc(v)} -->`);
    lines.push("");
  });
  return lines.join("\n");
}
function b64enc(x) {
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(x))));
  } catch {
    return "";
  }
}
function b64dec(s) {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(s))));
  } catch (e) {
    reportPersistError("CW-IT/CW-EL \u89E3\u6790\u5931\u8D25", e);
    return null;
  }
}
function reportPersistError(msg, e) {
  if (typeof console !== "undefined") console.warn("[persist]", msg, e);
}
var _cwElSeq = 0;
function uid(prefix = "el") {
  _cwElSeq += 1;
  return `${prefix}_${Date.now().toString(36)}_${_cwElSeq}`;
}
function layoutElements(slide, layout) {
  const parts = slide.bullets.length ? slide.bullets : [];
  if (parts.length && (layout === "edu-goal" || layout === "edu-summary" || layout === "edu-homework")) {
    return [{ id: uid(), type: "text", x: 6, y: 23, w: 88, h: 64, text: parts.join("\n"), fontSize: 18, bullet: true }];
  }
  const effSlots = slide.slots ?? (layout && isStructuredLayout(layout) ? distributeToSlots(layout, slide.bullets) : void 0);
  if (effSlots && layout && isStructuredLayout(layout)) {
    const sk = getSkeleton(layout);
    if (sk) {
      const els = [];
      for (const ph of sk.placeholders) {
        if (ph.key === "title" && layout !== "cover") continue;
        const content = effSlots[ph.key] ?? [];
        if (!content.length) continue;
        const display = content.join("\n");
        const r = ph.rect;
        if (ph.kind === "bullet" && ph.columns && ph.columns > 1) {
          const colW = r.w / ph.columns;
          content.forEach((txt, i) => {
            els.push({ id: uid(), type: "text", x: r.x + i * colW, y: r.y, w: colW, h: r.h, text: txt, fontSize: ph.fontSize || 16, bullet: true });
          });
        } else {
          els.push({
            id: uid(),
            type: "text",
            x: r.x,
            y: r.y,
            w: r.w,
            h: r.h,
            text: display,
            fontSize: ph.fontSize || (ph.kind === "title" ? 32 : 16),
            bold: ph.bold ?? ph.kind === "title",
            align: ph.align || "left",
            bullet: ph.kind === "bullet"
          });
        }
      }
      if (effSlots["__overflow"]?.length) {
        els.push({ id: uid(), type: "text", x: 6, y: 90, w: 88, h: 8, text: effSlots["__overflow"].join("\n"), fontSize: 14, color: "999999" });
      }
      return els;
    }
  }
  switch (layout) {
    case "title-only":
      return [];
    case "two-col": {
      const mid = Math.ceil(parts.length / 2);
      return [
        { id: uid(), type: "text", x: 6, y: 23, w: 42, h: 64, text: parts.slice(0, mid).join("\n"), fontSize: 18, bullet: true },
        { id: uid(), type: "text", x: 52, y: 23, w: 42, h: 64, text: parts.slice(mid).join("\n"), fontSize: 18, bullet: true }
      ];
    }
    case "blank":
      return [];
    // ── 教学语义版式：按结构占位生成默认自由元素（老师填空式编辑） ──
    case "edu-cover":
      return [
        { id: uid(), type: "text", x: 10, y: 30, w: 80, h: 18, text: slide.title || "\u8BFE\u9898\u540D\u79F0", fontSize: 32, bold: true, align: "center" },
        { id: uid(), type: "text", x: 10, y: 56, w: 80, h: 10, text: "\u5E74\u7EA7 / \u5B66\u79D1 / \u6559\u5E08", fontSize: 16, align: "center", color: "666666" }
      ];
    case "edu-goal":
      if (parts.length) {
        return [{ id: uid(), type: "text", x: 6, y: 23, w: 88, h: 64, text: parts.join("\n"), fontSize: 18, bullet: true }];
      }
      return [
        { id: uid(), type: "text", x: 6, y: 23, w: 28, h: 60, text: "\u77E5\u8BC6\u4E0E\u6280\u80FD\n\uFF08\u586B\u5199\uFF09", fontSize: 16, bullet: true },
        { id: uid(), type: "text", x: 36, y: 23, w: 28, h: 60, text: "\u8FC7\u7A0B\u4E0E\u65B9\u6CD5\n\uFF08\u586B\u5199\uFF09", fontSize: 16, bullet: true },
        { id: uid(), type: "text", x: 66, y: 23, w: 28, h: 60, text: "\u60C5\u611F\u6001\u5EA6\u4EF7\u503C\u89C2\n\uFF08\u586B\u5199\uFF09", fontSize: 16, bullet: true }
      ];
    case "edu-explain":
      return [
        { id: uid(), type: "text", x: 6, y: 23, w: 88, h: 22, text: slide.bullets[0] || "\u6982\u5FF5\u5B9A\u4E49\uFF08\u586B\u5199\uFF09", fontSize: 18, bold: true },
        { id: uid(), type: "text", x: 6, y: 50, w: 88, h: 38, text: slide.bullets.slice(1).join("\n") || "\u8981\u70B9\u5C55\u5F00\uFF08\u586B\u5199\uFF09", fontSize: 16, bullet: true }
      ];
    case "edu-example":
      return [
        { id: uid(), type: "text", x: 6, y: 23, w: 88, h: 26, text: slide.bullets[0] || "\u9898\u5E72\uFF08\u586B\u5199\uFF09", fontSize: 18, bold: true },
        { id: uid(), type: "text", x: 6, y: 54, w: 88, h: 34, text: slide.bullets.slice(1).join("\n") || "\u89E3\u7B54\u6B65\u9AA4\uFF08\u586B\u5199\uFF09", fontSize: 16, bullet: true }
      ];
    case "edu-summary":
      if (parts.length) {
        return [{ id: uid(), type: "text", x: 6, y: 23, w: 88, h: 64, text: parts.join("\n"), fontSize: 18, bullet: true }];
      }
      return [
        { id: uid(), type: "text", x: 6, y: 23, w: 60, h: 60, text: "\u8981\u70B9\u5F52\u7EB3\uFF08\u586B\u5199\uFF09", fontSize: 16, bullet: true },
        { id: uid(), type: "shape", x: 70, y: 28, w: 24, h: 50, shape: "ellipse", fill: "E8F7FF" }
      ];
    case "edu-homework":
      if (parts.length) {
        return [{ id: uid(), type: "text", x: 6, y: 23, w: 88, h: 64, text: parts.join("\n"), fontSize: 18, bullet: true }];
      }
      return [
        { id: uid(), type: "text", x: 6, y: 23, w: 28, h: 60, text: "\u57FA\u7840\n\uFF08\u586B\u5199\uFF09", fontSize: 16, bullet: true },
        { id: uid(), type: "text", x: 36, y: 23, w: 28, h: 60, text: "\u63D0\u9AD8\n\uFF08\u586B\u5199\uFF09", fontSize: 16, bullet: true },
        { id: uid(), type: "text", x: 66, y: 23, w: 28, h: 60, text: "\u62D3\u5C55\n\uFF08\u586B\u5199\uFF09", fontSize: 16, bullet: true }
      ];
    case "title-body":
    default:
      return parts.length ? [{ id: uid(), type: "text", x: 6, y: 23, w: 88, h: 64, text: parts.join("\n"), fontSize: 18, bullet: true }] : [];
  }
}
function materializeOutline(outline) {
  return outline.map((s) => {
    if (s.elements && s.elements.length) return s;
    return { ...s, elements: layoutElements(s, s.layout || "title-body") };
  });
}
function extractBullets(elements) {
  if (!elements || !elements.length) return [];
  const out = [];
  elements.forEach((e) => {
    if (e.type !== "text" || !e.text) return;
    if (e.bullet) {
      e.text.split("\n").forEach((line) => {
        if (line.trim()) out.push(line.trim());
      });
    } else {
      const t2 = e.text.trim();
      if (t2) out.push(t2);
    }
  });
  return out;
}
function renderVisualToPptx(pres, slide, v, box, theme, font) {
  const p = theme.primary || "1A3A6B";
  const body = theme.body || "333333";
  const subtle = theme.subtle || "777777";
  const vTitle = v.title;
  const titleH = vTitle ? 0.38 : 0;
  const areaY = box.y + titleH;
  const areaH = Math.max(0.4, box.h - titleH);
  if (vTitle) {
    slide.addText(vTitle, { x: box.x, y: box.y, w: box.w, h: titleH, fontFace: '"KaiTi","STKaiti",serif', fontSize: 20, bold: true, color: p });
  }
  if (v.type === "sequence") {
    const n = v.items.length || 1;
    const arrowW = 0.32;
    const cellW = (box.w - arrowW * (n - 1)) / n;
    v.items.forEach((it, i) => {
      const x = box.x + i * (cellW + arrowW);
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x,
        y: areaY,
        w: cellW,
        h: areaH,
        fill: { color: i === n - 1 ? p : "FFFFFF" },
        line: { color: p, width: 1 },
        rectRadius: 0.06
      });
      slide.addText(it.label + (it.hint ? `
${it.hint}` : ""), {
        x,
        y: areaY,
        w: cellW,
        h: areaH,
        fontFace: '"KaiTi","STKaiti",serif',
        fontSize: 16,
        bold: true,
        color: i === n - 1 ? "FFFFFF" : body,
        align: "center",
        valign: "middle"
      });
      if (i < n - 1) {
        slide.addText("\u2192", {
          x: x + cellW,
          y: areaY,
          w: arrowW,
          h: areaH,
          fontFace: font,
          fontSize: 14,
          bold: true,
          color: p,
          align: "center",
          valign: "middle"
        });
      }
    });
    return;
  }
  if (v.type === "compare-table") {
    const header = [
      { text: "", options: { fill: { color: p + "26" } } },
      ...v.cols.map((c) => ({ text: c, options: { bold: true, fontSize: 15, color: p, fontFace: '"KaiTi","STKaiti",serif', fill: { color: p + "26" } } }))
    ];
    const rows = v.rows.map((r) => [
      { text: r.label, options: { bold: true, fontSize: 13, color: p, fontFace: '"KaiTi","STKaiti",serif', fill: { color: p + "14" } } },
      ...v.cols.map((_, j) => ({ text: r.cells?.[j] || "", options: { fontSize: 12, color: body } }))
    ]);
    slide.addTable([header, ...rows], {
      x: box.x,
      y: areaY,
      w: box.w,
      h: areaH,
      border: { type: "solid", color: p + "44", pt: 0.5 },
      fontFace: font,
      valign: "middle",
      align: "center",
      rowH: areaH / (rows.length + 1)
    });
    return;
  }
  if (v.type === "timeline") {
    const n = v.nodes.length || 1;
    const nodeH = areaH / n;
    const badgeD = Math.min(0.75, nodeH * 0.7);
    const badgeX = box.x;
    const lineX = box.x + badgeD / 2 - 0.03;
    const cardX = box.x + badgeD + 0.25;
    const cardW = Math.max(0.5, box.w - badgeD - 0.25);
    slide.addShape(pres.shapes.RECTANGLE, {
      x: lineX,
      y: areaY + badgeD / 2,
      w: 0.06,
      h: Math.max(0.1, areaH - badgeD),
      fill: { color: p },
      line: { color: p, width: 0.5 }
    });
    const highlightIdx = n === 3 ? 1 : n - 1;
    v.nodes.forEach((nd, i) => {
      const isHi = i === highlightIdx;
      const y = areaY + i * nodeH;
      const badgeY = y + (nodeH - badgeD) / 2;
      slide.addShape(pres.shapes.OVAL, {
        x: badgeX,
        y: badgeY,
        w: badgeD,
        h: badgeD,
        fill: { color: isHi ? p : "FFFFFF" },
        line: { color: p, width: 2 }
      });
      slide.addText(["\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94"][i] || String(i + 1), {
        x: badgeX,
        y: badgeY,
        w: badgeD,
        h: badgeD,
        fontFace: '"KaiTi","STKaiti",serif',
        fontSize: isHi ? 24 : 21,
        bold: true,
        color: isHi ? "FFFFFF" : p,
        align: "center",
        valign: "middle"
      });
      const cardH = Math.max(0.4, nodeH * 0.78);
      const cardY = y + (nodeH - cardH) / 2;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: cardX,
        y: cardY,
        w: cardW,
        h: cardH,
        fill: { color: isHi ? p : "FFFFFF" },
        line: { color: p, width: isHi ? 2 : 1 },
        rectRadius: 0.08
      });
      slide.addText([
        { text: nd.label, options: { fontSize: 23, bold: true, fontFace: '"KaiTi","STKaiti",serif', color: isHi ? "FFFFFF" : p, breakLine: true } },
        ...nd.desc ? [{ text: nd.desc, options: { fontSize: 17, color: isHi ? "F0F0F0" : body } }] : []
      ], {
        x: cardX + 0.12,
        y: cardY,
        w: cardW - 0.24,
        h: cardH,
        align: "left",
        valign: "middle"
      });
    });
    return;
  }
  if (v.type === "char-card") {
    const n = v.chars.length;
    const cols = n > 8 ? 6 : n > 4 ? 4 : Math.max(1, n);
    const rowsN = Math.ceil(n / cols);
    const cw = box.w / cols;
    const ch = areaH / rowsN;
    v.chars.forEach((c, i) => {
      const x = box.x + i % cols * cw;
      const y = areaY + Math.floor(i / cols) * ch;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: x + 0.05,
        y: y + 0.05,
        w: cw - 0.1,
        h: ch - 0.1,
        fill: { color: "FFFFFF" },
        line: { color: p, width: 0.75, dashType: "dash" },
        rectRadius: 0.05
      });
      const rich = [{ text: c.char, options: { fontSize: 40, bold: true, fontFace: '"KaiTi","STKaiti",serif', color: body, breakLine: true } }];
      if (c.pinyin) rich.push({ text: c.pinyin, options: { fontSize: 14, bold: true, color: p, breakLine: true } });
      if (c.word) rich.push({ text: c.word, options: { fontSize: 12, color: subtle } });
      slide.addText(rich, {
        x: x + 0.05,
        y: y + 0.05,
        w: cw - 0.1,
        h: ch - 0.1,
        align: "center",
        valign: "middle"
      });
    });
    return;
  }
  if (v.type === "compare-card") {
    const n = v.pairs.length || 1;
    const rowH = areaH / n;
    v.pairs.forEach((pr, i) => {
      const y = areaY + i * rowH;
      const labelW = pr.label ? box.w * 0.18 : 0;
      if (pr.label) {
        slide.addText(pr.label, { x: box.x, y, w: labelW, h: rowH, fontFace: '"KaiTi","STKaiti",serif', fontSize: 15, bold: true, color: "FFFFFF", align: "center", valign: "middle" });
      }
      const sideW = (box.w - labelW - 0.5) / 2;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: box.x + labelW, y: y + 0.05, w: sideW, h: rowH - 0.1, fill: { color: "FFFFFF" }, line: { color: p, width: 0.75 }, rectRadius: 0.05 });
      slide.addText(pr.left, { x: box.x + labelW, y: y + 0.05, w: sideW, h: rowH - 0.1, fontFace: '"KaiTi","STKaiti",serif', fontSize: 15, bold: true, color: body, align: "center", valign: "middle" });
      slide.addText("VS", { x: box.x + labelW + sideW, y: y + 0.05, w: 0.5, h: rowH - 0.1, fontFace: font, fontSize: 10, bold: true, color: p, align: "center", valign: "middle" });
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: box.x + labelW + sideW + 0.5, y: y + 0.05, w: sideW, h: rowH - 0.1, fill: { color: "FFFFFF" }, line: { color: p, width: 0.75 }, rectRadius: 0.05 });
      slide.addText(pr.right, { x: box.x + labelW + sideW + 0.5, y: y + 0.05, w: sideW, h: rowH - 0.1, fontFace: '"KaiTi","STKaiti",serif', fontSize: 15, bold: true, color: body, align: "center", valign: "middle" });
    });
    return;
  }
  if (v.type === "quote") {
    const fs = v.text.length <= 20 ? 26 : v.text.length <= 40 ? 22 : v.text.length <= 70 ? 19 : 16;
    slide.addText(v.text, {
      x: box.x,
      y: areaY,
      w: box.w,
      h: areaH,
      fontFace: '"KaiTi","STKaiti",serif',
      fontSize: fs,
      bold: true,
      color: body,
      align: "center",
      valign: "middle"
    });
    if (v.from) {
      slide.addText(`\u2014\u2014 ${v.from}`, { x: box.x, y: areaY + areaH - 0.32, w: box.w, h: 0.3, fontFace: font, fontSize: 12, color: subtle, align: "right" });
    }
  }
}
function renderElement(slide, e, CW_W, CW_H) {
  const x = e.x / 100 * CW_W;
  const y = e.y / 100 * CW_H;
  const w = e.w / 100 * CW_W;
  const h = e.h / 100 * CW_H;
  if (e.type === "image" && e.src) {
    slide.addImage({ data: e.src, x, y, w, h, rotation: e.rotation });
  } else if (e.type === "shape") {
    const shapeMap = { rect: "rect", ellipse: "ellipse", line: "line", triangle: "triangle" };
    slide.addShape(shapeMap[e.shape || "rect"], { x, y, w, h, fill: { color: "#" + (e.fill || "CCCCCC") }, line: { color: "#" + (e.fill || "CCCCCC") }, rotation: e.rotation });
  } else {
    slide.addText(e.text || "", {
      x,
      y,
      w,
      h,
      fontFace: FONT,
      fontSize: e.fontSize || 18,
      color: "#" + (e.color || "222222"),
      bold: e.bold,
      align: e.align || "left",
      bullet: e.bullet || false,
      valign: "top"
    });
  }
}
async function exportCoursewareToPptx(input, opts) {
  const slides = typeof input === "string" ? buildCoursewareSlides(input, opts) : input;
  const theme = opts.theme || DEFAULT_THEME;
  const font = theme.font || FONT;
  const is43 = opts.aspect === "4/3";
  const CW_W = is43 ? 10 : 13.3;
  const CW_H = 7.5;
  const pres = new pptxgen();
  pres.defineLayout({ name: "CW", width: CW_W, height: CW_H });
  pres.layout = "CW";
  pres.author = "\u77E5\u5FAE\u6559\u5B66";
  pres.title = opts.title;
  const bandH = 1.15 / 7.5 * CW_H;
  const titleW = CW_W - 1.4;
  slides.forEach((s) => {
    if (s.kind === "cover") {
      const cover = pres.addSlide();
      cover.background = { color: theme.coverBg };
      cover.addText(s.title, {
        x: 0.9,
        y: 2.5,
        w: CW_W - 1.8,
        h: 1.5,
        fontFace: font,
        fontSize: 40,
        bold: true,
        color: theme.onPrimary,
        align: "center"
      });
      cover.addText(s.subtitle || "", {
        x: 0.9,
        y: 4.2,
        w: CW_W - 1.8,
        h: 0.6,
        fontFace: font,
        fontSize: 18,
        color: theme.lightText,
        align: "center"
      });
      cover.addText(s.footer || "", {
        x: 0.9,
        y: 6.7,
        w: CW_W - 1.8,
        h: 0.4,
        fontFace: font,
        fontSize: 12,
        color: theme.footer,
        align: "center"
      });
      if (s.notes) cover.addNotes(s.notes);
      return;
    }
    const slide = pres.addSlide();
    slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: CW_W, h: bandH, fill: { color: theme.primary } });
    slide.addText(s.title, {
      x: 0.7,
      y: 0,
      w: titleW,
      h: bandH,
      fontFace: '"KaiTi","STKaiti",serif',
      fontSize: 30,
      bold: true,
      color: theme.onPrimary,
      valign: "middle"
    });
    const visList = normalizeVisuals(s.visuals);
    if (visList.length) {
      const top = bandH + 0.3;
      const areaH = CW_H - top - 0.4;
      const eachH = areaH / visList.length;
      visList.forEach((v, vi) => {
        const y = top + vi * eachH;
        renderVisualToPptx(pres, slide, v, { x: 0.55, y, w: CW_W - 1.1, h: eachH - 0.15 }, theme, font);
      });
      if (s.notes) slide.addNotes(s.notes);
      return;
    }
    if (s.elements && s.elements.length) {
      s.elements.forEach((e) => renderElement(slide, e, CW_W, CW_H));
    } else if (isStructuredLayout(s.layout)) {
      const effSlots = s.slots ?? distributeToSlots(s.layout, (s.rich || []).map((r) => r.text));
      const sk = getSkeleton(s.layout);
      if (sk && effSlots) {
        for (const ph of sk.placeholders) {
          if (ph.key === "title" && s.layout !== "cover") continue;
          const content = effSlots[ph.key] ?? [];
          if (!content.length) continue;
          const display = content;
          const r = ph.rect;
          const x = r.x / 100 * CW_W;
          const y = r.y / 100 * CW_H;
          const w = r.w / 100 * CW_W;
          const h = r.h / 100 * CW_H;
          const textOpts = {
            x,
            y,
            w,
            h,
            fontFace: font,
            fontSize: ph.fontSize || (ph.kind === "title" ? 28 : 16),
            bold: ph.bold ?? ph.kind === "title",
            color: theme.body,
            align: ph.align || "left",
            valign: ph.kind === "title" ? "middle" : "top",
            fit: "shrink"
          };
          if (ph.kind === "bullet" && ph.columns && ph.columns > 1) {
            const colW = w / ph.columns;
            display.forEach((txt, i) => {
              slide.addText(txt, { ...textOpts, x: x + i * colW, y, w: colW, h });
            });
          } else {
            slide.addText(display.map((t2) => ({ text: t2, options: { bullet: ph.kind === "bullet" ? { indent: 14 } : void 0, breakLine: true } })), textOpts);
          }
        }
        if (effSlots["__overflow"]?.length) {
          slide.addText(effSlots["__overflow"].map((t2) => ({ text: t2, options: { breakLine: true } })), {
            x: 0.7,
            y: CW_H - 1.2,
            w: titleW,
            h: 1,
            fontFace: font,
            fontSize: 14,
            color: theme.subtle
          });
        }
      }
    } else if (s.rich && s.rich.length) {
      slide.addText(s.rich, {
        x: 0.7,
        y: bandH + 0.3,
        w: titleW,
        h: CW_H - bandH - 0.6,
        fontFace: font,
        valign: "top",
        align: "left",
        color: theme.body,
        fontSize: 16,
        fit: "shrink"
      });
    } else {
      slide.addText("\uFF08\u672C\u8282\u65E0\u6B63\u6587\uFF09", {
        x: 0.7,
        y: bandH + 0.3,
        w: titleW,
        h: 1,
        fontFace: font,
        fontSize: 14,
        color: theme.subtle
      });
    }
    slide.addText(s.footer || "", {
      x: CW_W - 3,
      y: CW_H - 0.5,
      w: 2.7,
      h: 0.4,
      fontFace: font,
      fontSize: 10,
      color: theme.footer,
      align: "right"
    });
    if (s.notes) slide.addNotes(s.notes);
  });
  await pres.writeFile({ fileName: `${opts.title}.pptx` });
}
export {
  buildCoursewareSlides,
  exportCoursewareToPptx,
  extractBullets,
  isValidComponent,
  isValidVisual,
  layoutElements,
  markdownToOutline,
  materializeOutline,
  normalizeInteractive,
  normalizeVisuals,
  outlineToMarkdown,
  outlineToSlides,
  pptToOutline,
  slidesFromPpt
};
/*! Bundled license information:

react/cjs/react.development.js:
  (**
   * @license React
   * react.development.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)
*/
