'use strict'

import bind from 'lodash.bind'
import View from 'ampersand-view'
import React from 'react'
import events from 'ampersand-events'
import invoke from 'lodash.invoke'
import forEach from 'lodash.foreach'
import flatten from 'lodash.flatten'
import ReactDOM from 'react-dom'


export default View.extend({
  // React will handle the DOM insertion. But, nothing wrong if this value is
  // false or undefined.
  insertSelf: true,
  _render: function(options) {
    // We prefer to set the container element explicitly.
    if (options && options.containerEl) {
      this.containerEl = options.containerEl
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
    this.renderWithTemplate()

    return this
  },

  getContainerEl: function() {
    if (!this.containerEl && this.parent) {
      // We are a subview, `this.el` is the hook we need to place this view into.
      // The default behaviour of ampersand view is to replace the hook node with
      // a newly created dom object. Here we need this to become the container
      // of the react view as react can only replace everthing inside a node
      // not the node itself.
      // Which means it should be the `containerEl`.
      this.containerEl = this.el
    // this.el will be set to the correct react node after render, so we need
    // to do the swap only once.
    }
    if (this.containerEl) {
      // Always use `containerEl` when we have one
      return this.containerEl
    } else {
      return this.el && this.el.parentNode
    }
  },

  // Use react method to remove native DOM from browser.
  remove: function() {
    var parsedBindings = this._parsedBindings;
    ReactDOM.unmountComponentAtNode(this.getContainerEl())
    this._rendered = false;
    if (this._subviews) invoke(flatten(this._subviews), 'remove');
    this.stopListening();
    // TODO: Not sure if this is actually necessary.
    // Just trying to de-reference this potentially large
    // amount of generated functions to avoid memory leaks.
    forEach(parsedBindings, function(properties, modelName) {
      forEach(properties, function(value, key) {
        if ('string' !== typeof value) {
          delete parsedBindings[modelName][key];
        }
      });
      delete parsedBindings[modelName];
    });
    return this;
  },

  renderWithTemplate: function(context, templateArg) {
    var Component = templateArg || this.template;
    if ('function' !== typeof Component) {
      throw new Error('React component class is required for rendering the template')
    }

    if (!this.AmpReactComponent || templateArg) {
      this.AmpReactComponent = extendReactComponent(Component)
    }

    Component = this.AmpReactComponent

    var view = this
    var model = context || view.model || view
    var collection = this.collection
    var containerEl = this.getContainerEl()
    var reactComp = ReactDOM.render(<Component model={model} collection={collection} view={view}/>, containerEl)

    this.el = ReactDOM.findDOMNode(reactComp);
    return this;
  },

  renderSubview: function(view, container) {
    if (typeof container === 'string') {
      container = this.query(container);
    }
    if (!container) {
      console.warn(`
        All children of this view will be replaced if "container" is
        not provided when renderring subviews.
      `);
    }
    this.registerSubview(view);
    view.render({
      containerEl: container || this.el
    });
    return view;
  },
})

/**
 * Private functions
 */

function extendReactComponent(Component) {
  var emitter = events.createEmitter()

  const AmpReactComponent = React.createClass({
    watch: function(modelOrCollection, opts) {
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

      emitter.listenTo(modelOrCollection, events, deferbounce(bind(safeForceUpdate, this)));

      if (opts.reRender) safeForceUpdate.call(this);
    },

    componentDidMount: function() {
      var watched = this.getObservedItems && this.getObservedItems();
      if (watched) {
        forEach(watched, this.watch, this);
      }
      if (this.autoWatch !== false) {
        forEach(this.props, this.watch, this);
      }
    },

    componentWillUnmount: function() {
      emitter.stopListening();
    },

    render: function() {
      return <Component {...this.props} {...this.state}/>;
    }
  });

  return AmpReactComponent
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
      }, 0)
    }
  }
}
;

function safeForceUpdate() {
  if (this.isMounted()) {
    this.forceUpdate();
  }
}
;
