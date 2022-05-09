var app = (function () {
    'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.data !== data)
            text.data = data;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    /* src/SnakeBody.svelte generated by Svelte v3.22.2 */

    function create_if_block(ctx) {
    	let div0;
    	let t0;
    	let div1;
    	let t1;
    	let div2;
    	let t2;
    	let div3;
    	let t3;
    	let div4;

    	return {
    		c() {
    			div0 = element("div");
    			t0 = space();
    			div1 = element("div");
    			t1 = space();
    			div2 = element("div");
    			t2 = space();
    			div3 = element("div");
    			t3 = space();
    			div4 = element("div");
    			attr(div0, "id", "leftEye");
    			attr(div0, "class", "eyes svelte-1dyr7ym");
    			attr(div1, "id", "rightEye");
    			attr(div1, "class", "eyes svelte-1dyr7ym");
    			attr(div2, "id", "leftPupil");
    			attr(div2, "class", "pupils svelte-1dyr7ym");
    			attr(div3, "id", "rightPupil");
    			attr(div3, "class", "pupils svelte-1dyr7ym");
    			attr(div4, "id", "mouth");
    			attr(div4, "class", "mouth svelte-1dyr7ym");
    		},
    		m(target, anchor) {
    			insert(target, div0, anchor);
    			insert(target, t0, anchor);
    			insert(target, div1, anchor);
    			insert(target, t1, anchor);
    			insert(target, div2, anchor);
    			insert(target, t2, anchor);
    			insert(target, div3, anchor);
    			insert(target, t3, anchor);
    			insert(target, div4, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(div0);
    			if (detaching) detach(t0);
    			if (detaching) detach(div1);
    			if (detaching) detach(t1);
    			if (detaching) detach(div2);
    			if (detaching) detach(t2);
    			if (detaching) detach(div3);
    			if (detaching) detach(t3);
    			if (detaching) detach(div4);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let div;
    	let div_class_value;
    	let if_block = /*isHead*/ ctx[2] && create_if_block();

    	return {
    		c() {
    			div = element("div");
    			if (if_block) if_block.c();
    			attr(div, "class", div_class_value = "snake-body " + /*direction*/ ctx[3] + " svelte-1dyr7ym");
    			set_style(div, "left", /*left*/ ctx[1] + "px");
    			set_style(div, "top", /*top*/ ctx[0] + "px");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			if (if_block) if_block.m(div, null);
    		},
    		p(ctx, [dirty]) {
    			if (/*isHead*/ ctx[2]) {
    				if (if_block) ; else {
    					if_block = create_if_block();
    					if_block.c();
    					if_block.m(div, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*direction*/ 8 && div_class_value !== (div_class_value = "snake-body " + /*direction*/ ctx[3] + " svelte-1dyr7ym")) {
    				attr(div, "class", div_class_value);
    			}

    			if (dirty & /*left*/ 2) {
    				set_style(div, "left", /*left*/ ctx[1] + "px");
    			}

    			if (dirty & /*top*/ 1) {
    				set_style(div, "top", /*top*/ ctx[0] + "px");
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			if (if_block) if_block.d();
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let { top = unit } = $$props;
    	let { left = unit } = $$props;
    	let { isHead = false } = $$props;
    	let { direction = "right" } = $$props;

    	$$self.$set = $$props => {
    		if ("top" in $$props) $$invalidate(0, top = $$props.top);
    		if ("left" in $$props) $$invalidate(1, left = $$props.left);
    		if ("isHead" in $$props) $$invalidate(2, isHead = $$props.isHead);
    		if ("direction" in $$props) $$invalidate(3, direction = $$props.direction);
    	};

    	return [top, left, isHead, direction];
    }

    class SnakeBody extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, { top: 0, left: 1, isHead: 2, direction: 3 });
    	}
    }

    /* src/Snake.svelte generated by Svelte v3.22.2 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[2] = list[i];
    	child_ctx[4] = i;
    	return child_ctx;
    }

    // (7:0) {#each snakeBodies as snakeBody, i}
    function create_each_block(ctx) {
    	let current;

    	const snakebody = new SnakeBody({
    			props: {
    				isHead: /*i*/ ctx[4] == 0,
    				top: /*snakeBody*/ ctx[2].top,
    				left: /*snakeBody*/ ctx[2].left,
    				direction: /*direction*/ ctx[1]
    			}
    		});

    	return {
    		c() {
    			create_component(snakebody.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(snakebody, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const snakebody_changes = {};
    			if (dirty & /*snakeBodies*/ 1) snakebody_changes.top = /*snakeBody*/ ctx[2].top;
    			if (dirty & /*snakeBodies*/ 1) snakebody_changes.left = /*snakeBody*/ ctx[2].left;
    			if (dirty & /*direction*/ 2) snakebody_changes.direction = /*direction*/ ctx[1];
    			snakebody.$set(snakebody_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(snakebody.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(snakebody.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(snakebody, detaching);
    		}
    	};
    }

    function create_fragment$1(ctx) {
    	let each_1_anchor;
    	let current;
    	let each_value = /*snakeBodies*/ ctx[0];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	return {
    		c() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*snakeBodies, direction*/ 3) {
    				each_value = /*snakeBodies*/ ctx[0];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(each_1_anchor);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { snakeBodies = [] } = $$props;
    	let { direction } = $$props;

    	$$self.$set = $$props => {
    		if ("snakeBodies" in $$props) $$invalidate(0, snakeBodies = $$props.snakeBodies);
    		if ("direction" in $$props) $$invalidate(1, direction = $$props.direction);
    	};

    	return [snakeBodies, direction];
    }

    class Snake extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { snakeBodies: 0, direction: 1 });
    	}
    }

    /* src/Food.svelte generated by Svelte v3.22.2 */

    function create_fragment$2(ctx) {
    	let div0;
    	let t;
    	let div1;

    	return {
    		c() {
    			div0 = element("div");
    			t = space();
    			div1 = element("div");
    			attr(div0, "class", "food1 svelte-1sbebo9");
    			set_style(div0, "left", /*food1Left*/ ctx[1] + "px");
    			set_style(div0, "top", /*food1Top*/ ctx[0] + "px");
    			attr(div1, "class", "food2 svelte-1sbebo9");
    			set_style(div1, "left", /*food2Left*/ ctx[3] + "px");
    			set_style(div1, "top", /*food2Top*/ ctx[2] + "px");
    		},
    		m(target, anchor) {
    			insert(target, div0, anchor);
    			insert(target, t, anchor);
    			insert(target, div1, anchor);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*food1Left*/ 2) {
    				set_style(div0, "left", /*food1Left*/ ctx[1] + "px");
    			}

    			if (dirty & /*food1Top*/ 1) {
    				set_style(div0, "top", /*food1Top*/ ctx[0] + "px");
    			}

    			if (dirty & /*food2Left*/ 8) {
    				set_style(div1, "left", /*food2Left*/ ctx[3] + "px");
    			}

    			if (dirty & /*food2Top*/ 4) {
    				set_style(div1, "top", /*food2Top*/ ctx[2] + "px");
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div0);
    			if (detaching) detach(t);
    			if (detaching) detach(div1);
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { food1Top } = $$props;
    	let { food1Left } = $$props;
    	let { food2Top } = $$props;
    	let { food2Left } = $$props;

    	$$self.$set = $$props => {
    		if ("food1Top" in $$props) $$invalidate(0, food1Top = $$props.food1Top);
    		if ("food1Left" in $$props) $$invalidate(1, food1Left = $$props.food1Left);
    		if ("food2Top" in $$props) $$invalidate(2, food2Top = $$props.food2Top);
    		if ("food2Left" in $$props) $$invalidate(3, food2Left = $$props.food2Left);
    	};

    	return [food1Top, food1Left, food2Top, food2Left];
    }

    class Food extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {
    			food1Top: 0,
    			food1Left: 1,
    			food2Top: 2,
    			food2Left: 3
    		});
    	}
    }

    /* src/Questionbox.svelte generated by Svelte v3.22.2 */

    function create_fragment$3(ctx) {
    	let div6;
    	let div0;
    	let t0;
    	let t1;
    	let div5;
    	let div1;
    	let t2;
    	let div2;
    	let t3;
    	let t4;
    	let div3;
    	let t5;
    	let div4;
    	let t6;

    	return {
    		c() {
    			div6 = element("div");
    			div0 = element("div");
    			t0 = text(/*question*/ ctx[0]);
    			t1 = space();
    			div5 = element("div");
    			div1 = element("div");
    			t2 = space();
    			div2 = element("div");
    			t3 = text(/*option1*/ ctx[1]);
    			t4 = space();
    			div3 = element("div");
    			t5 = space();
    			div4 = element("div");
    			t6 = text(/*option2*/ ctx[2]);
    			attr(div0, "class", "question svelte-zij4pq");
    			attr(div1, "class", "food1 svelte-zij4pq");
    			attr(div2, "class", "option1 svelte-zij4pq");
    			attr(div3, "class", "food2 svelte-zij4pq");
    			attr(div4, "class", "option2 svelte-zij4pq");
    			attr(div5, "class", "legend svelte-zij4pq");
    			attr(div6, "class", "questionbox svelte-zij4pq");
    		},
    		m(target, anchor) {
    			insert(target, div6, anchor);
    			append(div6, div0);
    			append(div0, t0);
    			append(div6, t1);
    			append(div6, div5);
    			append(div5, div1);
    			append(div5, t2);
    			append(div5, div2);
    			append(div2, t3);
    			append(div5, t4);
    			append(div5, div3);
    			append(div5, t5);
    			append(div5, div4);
    			append(div4, t6);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*question*/ 1) set_data(t0, /*question*/ ctx[0]);
    			if (dirty & /*option1*/ 2) set_data(t3, /*option1*/ ctx[1]);
    			if (dirty & /*option2*/ 4) set_data(t6, /*option2*/ ctx[2]);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div6);
    		}
    	};
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { question } = $$props;
    	let { option1 } = $$props;
    	let { option2 } = $$props;

    	$$self.$set = $$props => {
    		if ("question" in $$props) $$invalidate(0, question = $$props.question);
    		if ("option1" in $$props) $$invalidate(1, option1 = $$props.option1);
    		if ("option2" in $$props) $$invalidate(2, option2 = $$props.option2);
    	};

    	return [question, option1, option2];
    }

    class Questionbox extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { question: 0, option1: 1, option2: 2 });
    	}
    }

    /* src/Answerbox.svelte generated by Svelte v3.22.2 */

    function create_fragment$4(ctx) {
    	let div2;
    	let div0;
    	let t0;
    	let t1;
    	let div1;
    	let t2;

    	return {
    		c() {
    			div2 = element("div");
    			div0 = element("div");
    			t0 = text(/*result*/ ctx[0]);
    			t1 = space();
    			div1 = element("div");
    			t2 = text(/*explanation*/ ctx[1]);
    			attr(div0, "class", "result svelte-ftlup3");
    			attr(div1, "class", "explanation svelte-ftlup3");
    			attr(div2, "class", "answerbox svelte-ftlup3");
    		},
    		m(target, anchor) {
    			insert(target, div2, anchor);
    			append(div2, div0);
    			append(div0, t0);
    			append(div2, t1);
    			append(div2, div1);
    			append(div1, t2);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*result*/ 1) set_data(t0, /*result*/ ctx[0]);
    			if (dirty & /*explanation*/ 2) set_data(t2, /*explanation*/ ctx[1]);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div2);
    		}
    	};
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { result } = $$props;
    	let { explanation } = $$props;

    	$$self.$set = $$props => {
    		if ("result" in $$props) $$invalidate(0, result = $$props.result);
    		if ("explanation" in $$props) $$invalidate(1, explanation = $$props.explanation);
    	};

    	return [result, explanation];
    }

    class Answerbox extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { result: 0, explanation: 1 });
    	}
    }

    /* src/App.svelte generated by Svelte v3.22.2 */

    function create_fragment$5(ctx) {
    	let div0;
    	let h1;
    	let t1;
    	let h2;
    	let t2;
    	let t3_value = /*snakeBodies*/ ctx[10].length - 3 + "";
    	let t3;
    	let t4;
    	let div1;
    	let t5;
    	let t6;
    	let main;
    	let t7;
    	let current;
    	let dispose;

    	const questionbox = new Questionbox({
    			props: {
    				question: /*question*/ ctx[0],
    				option1: /*option1*/ ctx[1],
    				option2: /*option2*/ ctx[2]
    			}
    		});

    	const answerbox = new Answerbox({
    			props: {
    				result: /*result*/ ctx[3],
    				explanation: /*explanation*/ ctx[4]
    			}
    		});

    	const snake = new Snake({
    			props: {
    				snakeBodies: /*snakeBodies*/ ctx[10],
    				direction: /*direction*/ ctx[9]
    			}
    		});

    	const food = new Food({
    			props: {
    				food1Left: /*food1Left*/ ctx[5],
    				food1Top: /*food1Top*/ ctx[6],
    				food2Left: /*food2Left*/ ctx[7],
    				food2Top: /*food2Top*/ ctx[8]
    			}
    		});

    	return {
    		c() {
    			div0 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Cyber Snake";
    			t1 = space();
    			h2 = element("h2");
    			t2 = text("Score: ");
    			t3 = text(t3_value);
    			t4 = space();
    			div1 = element("div");
    			create_component(questionbox.$$.fragment);
    			t5 = space();
    			create_component(answerbox.$$.fragment);
    			t6 = space();
    			main = element("main");
    			create_component(snake.$$.fragment);
    			t7 = space();
    			create_component(food.$$.fragment);
    			attr(h1, "class", "svelte-slv4zn");
    			attr(h2, "class", "svelte-slv4zn");
    			attr(div0, "class", "header svelte-slv4zn");
    			attr(div1, "class", "prompt svelte-slv4zn");
    			attr(main, "class", "svelte-slv4zn");
    		},
    		m(target, anchor, remount) {
    			insert(target, div0, anchor);
    			append(div0, h1);
    			append(div0, t1);
    			append(div0, h2);
    			append(h2, t2);
    			append(h2, t3);
    			insert(target, t4, anchor);
    			insert(target, div1, anchor);
    			mount_component(questionbox, div1, null);
    			append(div1, t5);
    			mount_component(answerbox, div1, null);
    			insert(target, t6, anchor);
    			insert(target, main, anchor);
    			mount_component(snake, main, null);
    			append(main, t7);
    			mount_component(food, main, null);
    			current = true;
    			if (remount) dispose();
    			dispose = listen(window, "keydown", /*onKeyDown*/ ctx[11]);
    		},
    		p(ctx, dirty) {
    			if ((!current || dirty[0] & /*snakeBodies*/ 1024) && t3_value !== (t3_value = /*snakeBodies*/ ctx[10].length - 3 + "")) set_data(t3, t3_value);
    			const questionbox_changes = {};
    			if (dirty[0] & /*question*/ 1) questionbox_changes.question = /*question*/ ctx[0];
    			if (dirty[0] & /*option1*/ 2) questionbox_changes.option1 = /*option1*/ ctx[1];
    			if (dirty[0] & /*option2*/ 4) questionbox_changes.option2 = /*option2*/ ctx[2];
    			questionbox.$set(questionbox_changes);
    			const answerbox_changes = {};
    			if (dirty[0] & /*result*/ 8) answerbox_changes.result = /*result*/ ctx[3];
    			if (dirty[0] & /*explanation*/ 16) answerbox_changes.explanation = /*explanation*/ ctx[4];
    			answerbox.$set(answerbox_changes);
    			const snake_changes = {};
    			if (dirty[0] & /*snakeBodies*/ 1024) snake_changes.snakeBodies = /*snakeBodies*/ ctx[10];
    			if (dirty[0] & /*direction*/ 512) snake_changes.direction = /*direction*/ ctx[9];
    			snake.$set(snake_changes);
    			const food_changes = {};
    			if (dirty[0] & /*food1Left*/ 32) food_changes.food1Left = /*food1Left*/ ctx[5];
    			if (dirty[0] & /*food1Top*/ 64) food_changes.food1Top = /*food1Top*/ ctx[6];
    			if (dirty[0] & /*food2Left*/ 128) food_changes.food2Left = /*food2Left*/ ctx[7];
    			if (dirty[0] & /*food2Top*/ 256) food_changes.food2Top = /*food2Top*/ ctx[8];
    			food.$set(food_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(questionbox.$$.fragment, local);
    			transition_in(answerbox.$$.fragment, local);
    			transition_in(snake.$$.fragment, local);
    			transition_in(food.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(questionbox.$$.fragment, local);
    			transition_out(answerbox.$$.fragment, local);
    			transition_out(snake.$$.fragment, local);
    			transition_out(food.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div0);
    			if (detaching) detach(t4);
    			if (detaching) detach(div1);
    			destroy_component(questionbox);
    			destroy_component(answerbox);
    			if (detaching) detach(t6);
    			if (detaching) detach(main);
    			destroy_component(snake);
    			destroy_component(food);
    			dispose();
    		}
    	};
    }
    let pauseSpeed = 100000000;
    let unit$1 = 50;

    function shuffle(array) {
    	let currentIndex = array.length, randomIndex;

    	while (currentIndex != 0) {
    		randomIndex = Math.floor(Math.random() * currentIndex);
    		currentIndex--;
    		[array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    	}

    	return array;
    }

    function isCollide(a, b) {
    	return !(a.top < b.top || a.top > b.top || a.left < b.left || a.left > b.left);
    }

    function isOpposite(a, b) {
    	const opposites = {
    		"up": "down",
    		"down": "up",
    		"left": "right",
    		"right": "left",
    		"none": "asdf"
    	};

    	//console.log('a: ' + a)
    	//console.log('opposite a: ' + opposites[a])
    	//console.log('b: ' + b)
    	//console.log('opposite b: ' + opposites[b])
    	if (opposites[a] == b) {
    		return true;
    	}
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let questions = [
    		{
    			"question": "Which password is stronger?",
    			"correct": "paulsimon",
    			"incorrect": "janice",
    			"explanation": "Longer passwords are better."
    		},
    		{
    			"question": "Which password is stronger?",
    			"correct": "basketball15",
    			"incorrect": "heartbreaker",
    			"explanation": "Adding numbers makes the password stronger."
    		},
    		{
    			"question": "Which password is stronger?",
    			"correct": "HotChocolate",
    			"incorrect": "peanutbutter",
    			"explanation": "Adding capitals makes the password stronger."
    		},
    		{
    			"question": "Which password is stronger?",
    			"correct": "(tinkerbell)",
    			"incorrect": "peaceandlove",
    			"explanation": "Adding special characters makes the password stronger."
    		},
    		{
    			"question": "Which password is stronger",
    			"correct": "Greenm0nster",
    			"incorrect": "OrlandoBloom",
    			"explanation": "'Greenm0nster' has an uppercase and a number, 'OrlandoBloom' has only lowercase and uppercase."
    		},
    		{
    			"question": "Which password is stronger?",
    			"correct": "mydogisBecky",
    			"incorrect": "Transformers",
    			"explanation": "Capitalizing the first character is more easily guessed by a hacker."
    		},
    		{
    			"question": "Which password is stronger?",
    			"correct": "neoalejapkeh",
    			"incorrect": "892337850912",
    			"explanation": "Letters are stronger than numbers as there are more letters to guess."
    		},
    		{
    			"question": "Which password is stronger?",
    			"correct": "boxrtlpanwbd",
    			"incorrect": "supernatural",
    			"explanation": "Random passwords are stronger than dictionary words."
    		},
    		{
    			"question": "Which password is stronger?",
    			"correct": "smartlyscored",
    			"incorrect": "wewillrockyou",
    			"explanation": "'We will rock you' is a recognizable phrase and easier to guess."
    		},
    		{
    			"question": "Which password is stronger?",
    			"correct": "bootleg918",
    			"incorrect": "b00tlegger",
    			"explanation": "Replacing letters with numbers that look similar is an easily guessed pattern."
    		},
    		{
    			"question": "Which password is stronger?",
    			"correct": "samantha0964",
    			"incorrect": "carolina1234",
    			"explanation": "Sequential numbers are easier to guess than random numbers."
    		},
    		{
    			"question": "Which password is stronger?",
    			"correct": "superman8290",
    			"incorrect": "football2006",
    			"explanation": "Common date formats are easier to guess than random numbers"
    		},
    		{
    			"question": "True or false, it is best to use the same strong password accross all accounts.",
    			"correct": "False",
    			"incorrect": "True",
    			"explanation": "If one account gets breached, all accounts with that password are compromised."
    		},
    		{
    			"question": "Which is better?",
    			"correct": "Using a password manager",
    			"incorrect": "Remembering all your passwords in your head",
    			"explanation": "Computers can guess everything you can remember. Best to let a computer generate good passwords you don't have to remember."
    		},
    		{
    			"question": "True or false, having a strong password means no hacker could learn your password.",
    			"correct": "False",
    			"incorrect": "True",
    			"explanation": "There are ways a hacker can retrieve even a strong password."
    		},
    		{
    			"question": "True or false, it is more secure to use multi factor authentication.",
    			"correct": "True",
    			"incorrect": "False",
    			"explanation": "Multi factor authentication adds another layer of security to your account."
    		},
    		{
    			"question": "A number you don't recognize asks for your MFA token. Do you give it to them?",
    			"correct": "No",
    			"incorrect": "Yes",
    			"explanation": "Never give a third party your MFA authentication token."
    		},
    		{
    			"question": "A service you use notifies you your account has been breached. You should",
    			"correct": "Change your password and enable multi factor authentication",
    			"incorrect": "Delete your account",
    			"explanation": "Resetting your password and enabling MFA is usually enough after a breach."
    		},
    		{
    			"question": "Which is better?",
    			"correct": "Using software services with good security reputations",
    			"incorrect": "Using obscure software services that hackers don't know about",
    			"explanation": "It is best to use software with a strong reputation. Obscure services might not have resources to invest in security"
    		},
    		{
    			"question": "True or false, it is important to keep all your devices up to date with the latest software updates",
    			"correct": "True",
    			"incorrect": "False",
    			"explanation": "Many updates involve security patches. Not updating is a security risk."
    		},
    		{
    			"question": "True or false, iCloud, OneDrive, and Google Drive are good defenses against ransomware",
    			"correct": "True",
    			"incorrect": "False",
    			"explanation": "Having a backup of your information online is a good practice to defend against ransomeware."
    		},
    		{
    			"question": "True or false, it is more private to use a VPN.",
    			"correct": "False",
    			"incorrect": "True",
    			"explanation": "Using a VPN just means you trust the VPN provider instead of your Internet Provider."
    		}
    	];

    	console.log("you have " + questions.length + " questions.");
    	shuffle(questions);

    	// Initialize some variables
    	let question = "";

    	let option1 = "";
    	let option2 = "";
    	let correct = "";
    	let incorrect = "";
    	let result = "";
    	let explanation = "";
    	console.log("explanation: " + explanation);
    	let foodEaten = "";
    	let correctFood = "food1";
    	let answerFoods = ["food1", "food2"];
    	let questionNumber = 0;
    	let food1Left = 0;
    	let food1Top = 0;
    	let food2Left = 0;
    	let food2Top = 0;
    	let direction = "right";
    	let snakeBodies = [];
    	let speed = 100;
    	let board = { "width": 1250, "height": 550 };
    	let gameOver = false;
    	alert("Welcome to Cyber Snake!");
    	alert("It's like classic snake, but with questions! Read the question at the top and eat the food associated with the correct answer!");
    	alert("You'll have 3 seconds to read the question before you are back in the game.");
    	alert("Press OK to start! Good luck!");

    	function initVariables() {
    		console.log("initializing variables");
    		gameOver = false;
    		questionNumber = 0;
    		$$invalidate(3, result = "");
    		$$invalidate(4, explanation = "");
    		newQuestion();
    	}

    	initVariables();
    	let clear;

    	//draw the game repeatedly
    	function runGame() {
    		//console.log('speed: ' + ms);
    		snakeBodies.pop();

    		let { left, top } = snakeBodies[0];

    		const directions = {
    			"up": { "top": -50, "left": 0 },
    			"down": { "top": 50, "left": 0 },
    			"left": { "top": 0, "left": -50 },
    			"right": { "top": 0, "left": 50 },
    			undefined: { "top": 0, "left": 0 }
    		};

    		top += directions[direction]["top"];
    		left += directions[direction]["left"];

    		//console.log('top: ' + top)
    		//console.log('left: ' + left)
    		const newHead = { left, top };

    		$$invalidate(10, snakeBodies = [newHead, ...snakeBodies]);

    		// if the snake eats food, create a new food and add a piece to the snake
    		if (isCollide(newHead, { left: food1Left, top: food1Top })) {
    			foodEaten = "food1";
    		} else if (isCollide(newHead, { left: food2Left, top: food2Top })) {
    			foodEaten = "food2";
    		}

    		if (isCollide(newHead, { left: food1Left, top: food1Top }) || isCollide(newHead, { left: food2Left, top: food2Top })) {
    			console.log("food eaten: " + foodEaten);
    			console.log("correctFood: " + correctFood);
    			$$invalidate(4, explanation = questions[questionNumber - 1]["explanation"]);

    			if (foodEaten === correctFood) {
    				if (questionNumber == questions.length) {
    					alert("You won!");
    					resetGame();
    				}

    				newQuestion();
    				setSpeed(3000);
    				delayedUnpause(3000);
    				moveFood();
    				$$invalidate(10, snakeBodies = [...snakeBodies, snakeBodies[snakeBodies.length - 1]]);
    				$$invalidate(3, result = "Correct!");
    			} else {
    				$$invalidate(3, result = "Incorrect.");
    				gameOver = true;
    			}

    			if (questionNumber > 0) {
    				console.log("setting explanation: " + explanation);
    				console.log("question number: " + questionNumber);
    			}
    		}

    		isGameOver();

    		if (gameOver) {
    			alert("Game Over!\n" + explanation);
    			resetGame();
    		}
    	}

    	const delay = ms => new Promise(res => setTimeout(res, ms));

    	const delayedUnpause = async delayTime => {
    		await delay(delayTime);
    		console.log("Waited " + delayTime);
    		setSpeed(100);
    	};

    	function newQuestion() {
    		console.log("getting new question");
    		$$invalidate(0, question = questions[questionNumber]["question"]);
    		incorrect = questions[questionNumber]["incorrect"];
    		correct = questions[questionNumber]["correct"];
    		const answers = [incorrect, correct];
    		shuffle(answers);
    		$$invalidate(1, option1 = answers[0]);
    		$$invalidate(2, option2 = answers[1]);
    		correctFood = answerFoods[answers.indexOf(correct)];
    		questionNumber++;
    		console.log("after getting new question");
    		console.log("question number: " + questionNumber);
    		console.log("option1: " + option1);
    		console.log("option2: " + option2);
    		console.log("correct: " + correct);
    		console.log("incorrect: " + incorrect);
    		console.log("correctFood: " + correctFood);
    	}

    	function moveFood() {
    		$$invalidate(6, food1Top = Math.floor(Math.random() * Math.floor(board.height / unit$1)) * unit$1);
    		$$invalidate(5, food1Left = Math.floor(Math.random() * Math.floor(board.width / unit$1)) * unit$1);
    		$$invalidate(8, food2Top = Math.floor(Math.random() * Math.floor(board.height / unit$1)) * unit$1);
    		$$invalidate(7, food2Left = Math.floor(Math.random() * Math.floor(board.width / unit$1)) * unit$1);

    		while (food2Left === food1Left & food2Top === food1Top) {
    			$$invalidate(8, food2Top = Math.floor(Math.random() * Math.floor(board.height / unit$1)) * unit$1);
    			$$invalidate(7, food2Left = Math.floor(Math.random() * Math.floor(board.width / unit$1)) * unit$1);
    		}
    	}

    	function isGameOver() {
    		//console.log('calling is gameover: ' + gameOver)
    		const snakeBodiesNoHead = snakeBodies.slice(1);

    		const snakeCollisions = snakeBodiesNoHead.filter(sb => isCollide(sb, snakeBodies[0]));

    		if (snakeCollisions.length !== 0) {
    			gameOver = true;
    		}

    		const { top, left } = snakeBodies[0];

    		if (top >= board.height || top < 0 || left >= board.width || left < 0) {
    			gameOver = true;
    		}
    	}

    	function setSpeed(newSpeed) {
    		console.log("changing speed to " + newSpeed);
    		$$invalidate(17, speed = newSpeed);
    	}

    	function onKeyDown(e) {
    		//console.log('keyCode: ' + e.keyCode)
    		if (e.keyCode == 32) {
    			if (speed == pauseSpeed) {
    				setSpeed(100);
    			} else {
    				setSpeed(pauseSpeed);
    			}
    		}

    		const newDirection = getDirectionFromKeyCode(e.keyCode);

    		//console.log(newDirection);
    		if (!isOpposite(newDirection, direction)) {
    			$$invalidate(9, direction = newDirection);
    		}
    	}

    	function resetGame() {
    		initVariables();
    		moveFood();
    		$$invalidate(9, direction = "right");

    		$$invalidate(10, snakeBodies = [
    			{ left: unit$1 * 2, top: 0 },
    			{ left: unit$1 * 1, top: 0 },
    			{ left: unit$1 * 0, top: 0 }
    		]);
    	}

    	function getDirectionFromKeyCode(keyCode) {
    		const keyTransform = {
    			37: "left",
    			38: "up",
    			39: "right",
    			40: "down"
    		};

    		//console.log('keyCode pressed: ' + keyCode)
    		//console.log('current direction: ' + direction)
    		if (36 < keyCode && keyCode < 41) {
    			//console.log('new direction: ' + keyTransform[keyCode])
    			return keyTransform[keyCode];
    		} else {
    			//console.log('direction unchanged: ' + direction)
    			return direction;
    		}
    	}

    	resetGame();

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*clear, speed*/ 655360) {
    			//i got this from svelte REPL and don't know exactly how it works, but it enables the pause button
    			 {
    				clearInterval(clear);
    				$$invalidate(19, clear = setInterval(runGame, speed));
    			}
    		}
    	};

    	return [
    		question,
    		option1,
    		option2,
    		result,
    		explanation,
    		food1Left,
    		food1Top,
    		food2Left,
    		food2Top,
    		direction,
    		snakeBodies,
    		onKeyDown
    	];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {}, [-1, -1]);
    	}
    }

    const app = new App({
      target: document.body,
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
