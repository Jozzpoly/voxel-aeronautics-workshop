'use strict';

const assert = require('assert');
const MobileWorkspaceStyles = require('../src/game/mobile-workspace-styles.js');

function createDocument() {
  const elements = new Map();
  const appended = [];
  const documentElement = {};
  const head = {
    appendChild(element) {
      appended.push(element);
      if (element.id) elements.set(element.id, element);
      element.parentElement = head;
      return element;
    }
  };
  return {
    documentElement,
    head,
    appended,
    createElement(tagName) {
      return {
        tagName: String(tagName).toUpperCase(),
        dataset: {},
        attributes: new Map(),
        setAttribute(name, value) { this.attributes.set(name, String(value)); },
        getAttribute(name) { return this.attributes.get(name) || null; }
      };
    },
    getElementById(id) { return elements.get(id) || null; }
  };
}

function run() {
  {
    const documentLike = createDocument();
    const windowLike = {
      getComputedStyle() {
        return { getPropertyValue(name) { return name === MobileWorkspaceStyles.READY_PROPERTY ? '1' : ''; } };
      }
    };
    const result = MobileWorkspaceStyles.ensure({ window: windowLike, document: documentLike });
    assert.deepEqual(result, { status: 'embedded', element: null });
    assert.equal(documentLike.appended.length, 0);
  }

  {
    const documentLike = createDocument();
    const windowLike = {
      getComputedStyle() { return { getPropertyValue() { return ''; } }; }
    };
    const first = MobileWorkspaceStyles.ensure({ window: windowLike, document: documentLike });
    assert.equal(first.status, 'linked');
    assert(first.element);
    assert.equal(first.element.id, MobileWorkspaceStyles.LINK_ID);
    assert.equal(first.element.rel, 'stylesheet');
    assert.equal(first.element.href, 'styles.mobile.css');
    assert.equal(first.element.dataset.vawMobileWorkspaceStyles, 'true');
    assert.equal(documentLike.appended.length, 1);

    const second = MobileWorkspaceStyles.ensure({ window: windowLike, document: documentLike });
    assert.equal(second.status, 'existing-link');
    assert.strictEqual(second.element, first.element);
    assert.equal(documentLike.appended.length, 1, 'stylesheet link must not be duplicated');
  }

  {
    const result = MobileWorkspaceStyles.ensure({ window: {}, document: {} });
    assert.deepEqual(result, { status: 'unavailable', element: null });
  }

  assert.equal(MobileWorkspaceStyles.isReady({ window: {}, document: {} }), false);
  assert.equal(MobileWorkspaceStyles.normalizeHref(''), 'styles.mobile.css');
  assert.equal(MobileWorkspaceStyles.normalizeHref('/custom/mobile.css'), '/custom/mobile.css');

  console.log('OK mobile workspace styles');
}

run();
