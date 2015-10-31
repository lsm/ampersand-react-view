'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _extends = Object.assign || function(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];
      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }
    return target;
  };

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : {
    'default': obj
  };
}

var _lodashBind = require('lodash.bind');

var _lodashBind2 = _interopRequireDefault(_lodashBind);

var _ampersandView = require('ampersand-view');

var _ampersandView2 = _interopRequireDefault(_ampersandView);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _ampersandEvents = require('ampersand-events');

var _ampersandEvents2 = _interopRequireDefault(_ampersandEvents);

var _lodashInvoke = require('lodash.invoke');

var _lodashInvoke2 = _interopRequireDefault(_lodashInvoke);

var _lodashForeach = require('lodash.foreach');

var _lodashForeach2 = _interopRequireDefault(_lodashForeach);

var _lodashFlatten = require('lodash.flatten');

var _lodashFlatten2 = _interopRequireDefault(_lodashFlatten);

var _reactDom = require('react-dom');

var _reactDom2 = _interopRequireDefault(_reactDom);

exports['default'] = _ampersandView2['default'].extend({
  // React will handle the DOM insertion. But, nothing wrong if this value is
  // false or undefined.
  insertSelf: true,
  _render: function _render(options) {
    // We prefer to set the container element explicitly.
    if (options && options.containerEl) {
      this.containerEl = options.containerEl;
    }

    // Render the template with model.
    // 1. If `this.model` is the first parameter then it's optional
    // So the following code equals to
    //
    // ```javascript
    // this.renderWithTemplate(this.model);
    // ```
    //
    // 2. Whatever you put in the `renderWithTemplate` function will become
    // `this.props.model` inside the react component, for example:
    //
    // ```javascript
    // this.renderWithTemplate({
    //   a: 1,
    //   b: 2
    // });
    // ```
    //
    // Then in react component you can do:
    //
    // ```jsx
    // React.createClass({
    //   render: function() {
    //     return (
    //       <p> value a is {this.props.model.a}, b is {this.props.model.b} </p>
    //     );
    //   }
    // })
    // ```
    this.renderWithTemplate();

    return this;
  },

  getContainerEl: function getContainerEl() {
    if (!this.containerEl && this.parent) {
      // We are a subview, `this.el` is the hook we need to place this view into.
      // The default behaviour of ampersand view is to replace the hook node with
      // a newly created dom object. Here we need this to become the container
      // of the react view as react can only replace everthing inside a node
      // not the node itself.
      // Which means it should be the `containerEl`.
      this.containerEl = this.el;
    // this.el will be set to the correct react node after render, so we need
    // to do the swap only once.
    }
    if (this.containerEl) {
      // Always use `containerEl` when we have one
      return this.containerEl;
    } else {
      return this.el && this.el.parentNode;
    }
  },

  // Use react method to remove native DOM from browser.
  remove: function remove() {
    var parsedBindings = this._parsedBindings;
    _reactDom2['default'].unmountComponentAtNode(this.getContainerEl());
    this._rendered = false;
    if (this._subviews) (0, _lodashInvoke2['default'])((0, _lodashFlatten2['default'])(this._subviews), 'remove');
    this.stopListening();
    // TODO: Not sure if this is actually necessary.
    // Just trying to de-reference this potentially large
    // amount of generated functions to avoid memory leaks.
    (0, _lodashForeach2['default'])(parsedBindings, function(properties, modelName) {
      (0, _lodashForeach2['default'])(properties, function(value, key) {
        if ('string' !== typeof value) {
          delete parsedBindings[modelName][key];
        }
      });
      delete parsedBindings[modelName];
    });
    return this;
  },

  renderWithTemplate: function renderWithTemplate(context, templateArg) {
    var Component = templateArg || this.template;
    if ('function' !== typeof Component) {
      throw new Error('React component class is required for rendering the template');
    }

    if (!this.AmpReactComponent || templateArg) {
      this.AmpReactComponent = extendReactComponent(Component);
    }

    Component = this.AmpReactComponent;

    var view = this;
    var model = context || view.model || view;
    var collection = this.collection;
    var containerEl = this.getContainerEl();
    var reactComp = _reactDom2['default'].render(_react2['default'].createElement(Component, {
      model: model,
      collection: collection,
      view: view
    }), containerEl);

    this.el = _reactDom2['default'].findDOMNode(reactComp);
    return this;
  },

  renderSubview: function renderSubview(view, container) {
    if (typeof container === 'string') {
      container = this.query(container);
    }
    if (!container) {
      console.warn('\n        All children of this view will be replaced if "container" is\n        not provided when renderring subviews.\n      ');
    }
    this.registerSubview(view);
    view.render({
      containerEl: container || this.el
    });
    return view;
  }
});

/**
 * Private functions
 */

function extendReactComponent(Component) {
  var emitter = _ampersandEvents2['default'].createEmitter();

  var AmpReactComponent = _react2['default'].createClass({
    displayName: 'AmpReactComponent',

    watch: function watch(modelOrCollection, opts) {
      var events;

      if (modelOrCollection !== null && typeof modelOrCollection === 'object') {
        if (modelOrCollection.isCollection) {
          events = 'add remove reset';
        } else if (modelOrCollection.isState) {
          events = 'change';
        }
      }

      if (!events) {
        return;
      }

      emitter.listenTo(modelOrCollection, events, deferbounce((0, _lodashBind2['default'])(safeForceUpdate, this)));

      if (opts.reRender) safeForceUpdate.call(this);
    },

    componentDidMount: function componentDidMount() {
      var watched = this.getObservedItems && this.getObservedItems();
      if (watched) {
        (0, _lodashForeach2['default'])(watched, this.watch, this);
      }
      if (this.autoWatch !== false) {
        (0, _lodashForeach2['default'])(this.props, this.watch, this);
      }
    },

    componentWillUnmount: function componentWillUnmount() {
      emitter.stopListening();
    },

    render: function render() {
      return _react2['default'].createElement(Component, _extends({}, this.props, this.state));
    }
  });

  return AmpReactComponent;
}

function deferbounce(fn) {
  var triggered = false;
  return function() {
    var self = this;
    if (!triggered) {
      triggered = true;
      setTimeout(function() {
        fn.call(self);
        triggered = false;
      }, 0);
    }
  };
}
;

function safeForceUpdate() {
  if (this.isMounted()) {
    this.forceUpdate();
  }
}
;
module.exports = exports['default'];
