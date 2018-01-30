import * as target from '../component';
import { Element } from "../html-element";
import * as api from "../api";
import { patch } from '../patch';
import { createElement } from "../upgrade";

describe('component', function () {
    describe('#createComponent()', () => {
        it('should throw for non-object values', () => {
            expect(() => target.createComponent(undefined)).toThrow();
            expect(() => target.createComponent("")).toThrow();
            expect(() => target.createComponent(NaN)).toThrow();
            expect(() => target.createComponent(function () {})).toThrow();
            expect(() => target.createComponent(1)).toThrow();
        });
    });


    describe('attribute-change-life-cycle', () => {
        it('should invoke attributeChangeCallback() with old value as null the first time', () => {
            let keyValue, oldValue, newValue, counter = 0;
            class MyComponent extends Element {
                constructor() {
                    super();
                }
                attributeChangedCallback(k, o, n) {
                    oldValue = o;
                    newValue = n;
                    keyValue = k;
                    counter++;
                }
            }
            MyComponent.observedAttributes = ['title'];
            const elm = document.createElement('x-foo');
            const vnode = api.c('x-foo', MyComponent, { attrs: { title: 2 } });
            patch(elm, vnode);
            return Promise.resolve().then(() => {
                expect(counter).toBe(1);
                expect(keyValue).toBe('title');
                expect(oldValue).toBe(null);
                expect(newValue).toBe('2');
            });
        });

        it('should invoke attributeChangeCallback() for data-* attributes', () => {
            let keyValue, oldValue, newValue, counter = 0;
            class MyComponent extends Element {
                attributeChangedCallback(k, o, n) {
                    oldValue = o;
                    newValue = n;
                    keyValue = k;
                    counter++;
                }
            }
            MyComponent.observedAttributes = ['data-xyz'];
            const elm = document.createElement('x-foo');
            const vnode = api.c('x-foo', MyComponent, { attrs: { 'data-xyz': 2 } });
            patch(elm, vnode);
            return Promise.resolve().then(() => {
                expect(counter).toBe(1);
                expect(keyValue).toBe('data-xyz');
                expect(oldValue).toBe(null);
                expect(newValue).toBe('2');
            });
        });

        it('should invoke attributeChangeCallback() for aria-* attributes', () => {
            let keyValue, oldValue, newValue, counter = 0;
            class MyComponent extends Element {
                attributeChangedCallback(k, o, n) {
                    oldValue = o;
                    newValue = n;
                    keyValue = k;
                    counter++;
                }
            }
            MyComponent.observedAttributes = ['aria-describedby'];
            const elm = document.createElement('x-foo');
            const vnode = api.c('x-foo', MyComponent, { attrs: { 'aria-describedby': 'xyz' } });
            patch(elm, vnode);
            return Promise.resolve().then(() => {
                expect(counter).toBe(1);
                expect(keyValue).toBe('aria-describedby');
                expect(oldValue).toBe(null);
                expect(newValue).toBe('xyz');
            });
        });
    });

    describe('public computed props', () => {
        it('should allow public getters', function () {
            class MyComponent extends Element  {
                value = 'pancakes';
                get breakfast () {
                    return this.value;
                }
            }

            MyComponent.publicProps = {
                breakfast: {
                    config: 1
                }
            };

            class Parent extends Element {
                value = 'salad';
                get lunch () {
                    return this.value;
                }

                render () {
                    return () => [api.c('x-component', MyComponent, {})];
                }
            }

            Parent.publicProps = {
                lunch: {
                    config: 1
                }
            };

            const elm = document.createElement('x-foo');
            document.body.appendChild(elm);
            const vnode = api.c('x-foo', Parent, {});
            patch(elm, vnode);

            expect(elm.lunch).toBe('salad');
            expect(elm.querySelector('x-component').breakfast).toBe('pancakes');
        });

        it('should allow calling public getters when element is accessed by querySelector', function () {
            let count = 0;
            let value;
            let propVal = { foo: 'bar' };
            class MyChild extends Element {
                m = propVal
            }
            MyChild.publicProps = {
                m: {
                    config: 0
                }
            };
            class MyComponent extends Element  {
                callChildM() {
                    value = this.root.querySelector('x-child').m;
                }
                render() {
                    return function () {
                        return [api.c('x-child', MyChild, {})]
                    }
                }
            }
            MyComponent.publicMethods = ['callChildM'];

            const elm = createElement('x-foo', { is: MyComponent });
            document.body.appendChild(elm);
            expect(() => {
                elm.callChildM();
            }).not.toThrow();
        });

        it('should not allow public getters to be set by owner', function () {
            class MyComponent extends Element  {
                get x () {
                    return 1;
                }
            }

            MyComponent.publicProps = {
                x: {
                    config: 1
                }
            };

            const elm = document.createElement('x-foo');
            document.body.appendChild(elm);
            const vnode = api.c('x-foo', MyComponent, { props: { x: 2 } });
            // x can't be set via props, only read via getter
            expect(() => patch(elm, vnode)).toThrow();
        });

        it('should be render reactive', function () {
            class MyComponent extends Element  {
                state = { value: 0 };

                get validity () {
                    return this.state.value > 5;
                }

                updateTrackedValue(value: number) {
                    this.state.value = value;
                }

                render () {
                    return ($api, $cmp, $slotset, $ctx) => {
                        return [$api.h('div', {}, [$api.d($cmp.validity)])];
                    }
                }
            }

            MyComponent.track = { state: 1 }
            MyComponent.publicProps = {
                validity: {
                    config: 1
                }
            };
            MyComponent.publicMethods = ['updateTrackedValue'];

            const elm = createElement('x-foo', { is: MyComponent });
            document.body.appendChild(elm);
            elm.updateTrackedValue(10);
            return Promise.resolve().then(() => {
                expect(elm.textContent).toBe('true');
            });
        });

        it('should call public getter with correct context', function () {
            let context;

            class MyComponent extends Element  {
                value = 'pancakes';
                get breakfast () {
                    context = this;
                    return this.value;
                }
            }

            MyComponent.publicProps = {
                breakfast: {
                    config: 1
                }
            };

            const elm = document.createElement('x-foo');
            document.body.appendChild(elm);
            const vnode = api.c('x-foo', MyComponent, {});
            patch(elm, vnode);
            vnode.vm.component.breakfast;

            expect(context).toBe(vnode.vm.component);
        });

        it('should fail to execute setter function when used directly from DOM', function () {
            class MyComponent extends Element  {
                value = 'pancakes';
                get breakfast () {
                    return this.value;
                }

                set breakfast (value) {
                    this.value = value;
                }
            }

            MyComponent.publicProps = {
                breakfast: {
                    config: 3
                }
            };

            const elm = document.createElement('x-foo');
            document.body.appendChild(elm);
            const vnode = api.c('x-foo', MyComponent, {});
            patch(elm, vnode);
            expect(() => elm.breakfast = 'hey').toThrow();
        });

        it('should execute setter function with correct context when component is root', function () {
            let callCount = 0;
            let context;
            let component;

            class MyComponent extends Element  {
                constructor () {
                    super();
                    component = this;
                }

                value = 'pancakes';
                get breakfast () {
                    return this.value;
                }

                set breakfast (value) {
                    context = this;
                    callCount += 1;
                    this.value = value;
                }
            }

            MyComponent.publicProps = {
                breakfast: {
                    config: 3
                }
            };

            const elm = createElement('x-foo', { is: MyComponent });

            elm.breakfast = 'eggs';
            expect(callCount).toBe(1);
            expect(component).toBe(context);
        });

        it('should call setter with correct context when template value is updated', function () {
            let callCount = 0;
            let context;

            class MyComponent extends Element  {
                value = 'pancakes';
                get breakfast () {
                    return this.value;
                }

                set breakfast (value) {
                    callCount += 1;
                    context = this;
                    this.value = value;
                }
            }

            MyComponent.publicProps = {
                breakfast: {
                    config: 3
                }
            };

            const elm = document.createElement('div');
            document.body.appendChild(elm);
            const vnode = api.c('x-foo', MyComponent, {});
            const nextVNode = api.c('x-foo', MyComponent, { props: { breakfast: 'eggs' } });
            patch(elm, vnode);
            patch(vnode, nextVNode);

            expect(callCount).toBe(1);
            expect(context).toBe(nextVNode.vm.component);
        });

        it('should call setter when default value is provided', function () {
            let callCount = 0;
            let context;

            class MyComponent extends Element  {
                value;
                breakfast = 'pancakes';
                get breakfast () {
                    return this.value;
                }

                set breakfast (value) {
                    callCount += 1;
                    context = this;
                    this.value = value;
                }
            }

            MyComponent.publicProps = {
                breakfast: {
                    config: 3
                }
            };

            const elm = document.createElement('div');
            document.body.appendChild(elm);
            const vnode = api.c('x-foo', MyComponent, {});
            patch(elm, vnode);

            expect(callCount).toBe(1);
            expect(context).toBe(vnode.vm.component);
        });

        it('should throw when configured prop is missing getter', function () {
            let callCount = 0;
            let context;

            class MyComponent extends Element  {
                set breakfast (value) {

                }
            }

            MyComponent.publicProps = {
                breakfast: {
                    config: 1
                }
            };

            const elm = document.createElement('div');
            document.body.appendChild(elm);
            const vnode = api.c('x-foo', MyComponent, {});
            expect(() => {
                patch(elm, vnode);
            }).toThrow();
        });

        it('should throw when configured prop is missing setter', function () {
            let callCount = 0;
            let context;

            class MyComponent extends Element  {

            }

            MyComponent.publicProps = {
                breakfast: {
                    config: 2
                }
            };

            const elm = document.createElement('div');
            document.body.appendChild(elm);
            const vnode = api.c('x-foo', MyComponent, {});
            expect(() => {
                patch(elm, vnode);
            }).toThrow();
        });
    });

    describe('styles', function () {
        it('should handle string styles', function () {
            let calledCSSText = false;
            class MyComponent extends Element  {
                state = {
                    customStyle: 'color: red'
                }

                render () {
                    return function tmpl($api, $cmp, $slotset, $ctx) {
                        return [$api.h(
                            "section",
                            {
                                style: $cmp.state.customStyle
                            },
                            []
                        )];
                    }
                }
            }

            const elm = document.createElement('x-foo');
            document.body.appendChild(elm);
            const vnode = api.c('x-foo', MyComponent, {});

            const cssTextPropDef = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'cssText');
            Object.defineProperty(CSSStyleDeclaration.prototype, 'cssText', {
                get: function () {
                    return cssTextPropDef.get.call(this);
                },
                set: function (value) {
                    calledCSSText = true;
                    return cssTextPropDef.set.call(this, value);
                }
            });

            patch(elm, vnode);

            return Promise.resolve().then(() => {
                expect(elm.querySelector('section').style.cssText).toBe('color: red;');
                expect(calledCSSText).toBe(true);
            });
        });

        it('should handle undefined properly', function () {
            let calledCSSTextWithUndefined = false;
            class MyComponent extends Element  {
                state = {
                    customStyle: undefined
                }

                render () {
                    return function tmpl($api, $cmp, $slotset, $ctx) {
                        return [$api.h(
                            "section",
                            {
                                style: $cmp.state.customStyle
                            },
                            []
                        )];
                    }
                }
            }

            const elm = document.createElement('x-foo');
            document.body.appendChild(elm);
            const vnode = api.c('x-foo', MyComponent, {});

            const cssTextPropDef = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'cssText');
            Object.defineProperty(CSSStyleDeclaration.prototype, 'cssText', {
                get: function () {
                    return cssTextPropDef.get.call(this);
                },
                set: function (value) {
                    if (value === 'undefined') {
                        calledCSSTextWithUndefined = true;
                    }
                    return cssTextPropDef.set.call(this, value);
                }
            });

            patch(elm, vnode);

            return Promise.resolve().then(() => {
                expect(elm.style.cssText).toBe('');
                expect(calledCSSTextWithUndefined).toBe(false);
            });
        });

        it('should handle null properly', function () {
            let styleString;
            class MyComponent extends Element  {
                state = {
                    customStyle: null
                }

                render () {
                    return function tmpl($api, $cmp, $slotset, $ctx) {
                        return [$api.h(
                            "section",
                            {
                                style: $cmp.state.customStyle
                            },
                            []
                        )];
                    }
                }
            }

            const elm = document.createElement('x-foo');
            document.body.appendChild(elm);
            const vnode = api.c('x-foo', MyComponent, {});

            patch(elm, vnode);

            return Promise.resolve().then(() => {
                expect(elm.style.cssText).toBe('');
            });
        });

        it('should diff between style objects and strings correctly', function () {
            let called = false;
            class MyComponent extends Element  {
                state = {
                    customStyle: {
                        color: 'red'
                    }
                }

                render () {
                    return function tmpl($api, $cmp, $slotset, $ctx) {
                        return [$api.h(
                            "section",
                            {
                                style: $cmp.state.customStyle
                            },
                            []
                        )];
                    }
                }
            }

            const elm = document.createElement('x-foo');
            document.body.appendChild(elm);
            const vnode = api.c('x-foo', MyComponent, {});
            patch(elm, vnode);
            const section = elm.querySelector('section');
            section.style.removeProperty = function () {
                called = true;
            };
            vnode.vm.component.state.customStyle = 'color:green';

            return Promise.resolve().then(() => {
                expect(called).toBe(false);
            });
        });
    });

    describe('public methods', () => {
        it('should not invoke function when accessing public method', function () {
            let callCount = 0;

            class MyComponent extends Element  {
                m() {
                    callCount += 1;
                }
            }
            MyComponent.publicMethods = ['m'];

            const elm = document.createElement('x-foo');
            document.body.appendChild(elm);
            const vnode = api.c('x-foo', MyComponent, {});
            patch(elm, vnode);

            elm.m;
            expect(callCount).toBe(0);
        });

        it('should invoke function only once', function () {
            let callCount = 0;

            class MyComponent extends Element  {
                m() {
                    callCount += 1;
                }
            }
            MyComponent.publicMethods = ['m'];

            const elm = document.createElement('x-foo');
            document.body.appendChild(elm);
            const vnode = api.c('x-foo', MyComponent, {});
            patch(elm, vnode);

            elm.m();
            expect(callCount).toBe(1);
        });

        it('should call function with correct context', function () {
            let context, args;

            class MyComponent extends Element  {
                m() {
                    context = this;
                    args = Array.prototype.slice.call(arguments);
                }
            }
            MyComponent.publicMethods = ['m'];

            const elm = document.createElement('x-foo');
            document.body.appendChild(elm);
            const vnode = api.c('x-foo', MyComponent, {});
            patch(elm, vnode);

            elm.m(1, 2);
            expect(context).toBe(vnode.vm.component);
            expect(args).toEqual([1, 2]);
        });

        it('should express function identity with strict equality', function () {
            class MyComponent extends Element  {
                m() {
                }
            }
            MyComponent.publicMethods = ['m'];

            const elm = document.createElement('x-foo');
            document.body.appendChild(elm);
            const vnode = api.c('x-foo', MyComponent, {});
            patch(elm, vnode);

            expect(elm.m).toBe(elm.m);
        });

        it('should allow calling methods when element is referenced with querySelector', function () {
            let count = 0;
            class MyChild extends Element {
                m() {
                    count += 1;
                }
            }
            MyChild.publicMethods = ['m'];
            class MyComponent extends Element  {
                callChildM() {
                    this.root.querySelector('x-child').m();
                }
                render() {
                    return function () {
                        return [api.c('x-child', MyChild, {})]
                    }
                }
            }
            MyComponent.publicMethods = ['callChildM'];

            const elm = createElement('x-foo', { is: MyComponent });
            document.body.appendChild(elm);
            expect(() => {
                elm.callChildM();
            }).not.toThrow();
            expect(count).toBe(1);
        });

        it('should allow calling getAttribute on child when referenced with querySelector', function () {
            let count = 0;
            class MyChild extends Element {
                m() {
                    count += 1;
                }
            }
            MyChild.publicMethods = ['m'];
            class MyComponent extends Element  {
                getChildAttribute() {
                    this.root.querySelector('x-child').getAttribute('title');
                }
                render() {
                    return function () {
                        return [api.c('x-child', MyChild, {})]
                    }
                }
            }
            MyComponent.publicMethods = ['getChildAttribute'];

            const elm = createElement('x-foo', { is: MyComponent });
            document.body.appendChild(elm);
            expect(() => {
                elm.getChildAttribute();
            }).not.toThrow();
        });

        it('should allow calling setAttribute on child when referenced with querySelector', function () {
            let count = 0;
            class MyChild extends Element {
                m() {
                    count += 1;
                }
            }
            MyChild.publicMethods = ['m'];
            class MyComponent extends Element  {
                setChildAttribute() {
                    this.root.querySelector('x-child').setAttribute('title', 'foo');
                }
                render() {
                    return function () {
                        return [api.c('x-child', MyChild, {})]
                    }
                }
            }
            MyComponent.publicMethods = ['setChildAttribute'];

            const elm = createElement('x-foo', { is: MyComponent });
            document.body.appendChild(elm);
            expect(() => {
                elm.setChildAttribute();
            }).not.toThrow();
        });

        it('should allow calling removeAttribute on child when referenced with querySelector', function () {
            let count = 0;
            class MyChild extends Element {
                m() {
                    count += 1;
                }
            }
            MyChild.publicMethods = ['m'];
            class MyComponent extends Element  {
                removeChildAttribute() {
                    this.root.querySelector('x-child').removeAttribute('title');
                }
                render() {
                    return function () {
                        return [api.c('x-child', MyChild, {})]
                    }
                }
            }
            MyComponent.publicMethods = ['removeChildAttribute'];

            const elm = createElement('x-foo', { is: MyComponent });
            document.body.appendChild(elm);
            expect(() => {
                elm.removeChildAttribute();
            }).not.toThrow();
        });
     });
});