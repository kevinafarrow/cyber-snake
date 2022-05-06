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
    			attr(div0, "class", "question svelte-1g5gmjd");
    			attr(div1, "class", "food1 svelte-1g5gmjd");
    			attr(div2, "class", "option1 svelte-1g5gmjd");
    			attr(div3, "class", "food2 svelte-1g5gmjd");
    			attr(div4, "class", "option2 svelte-1g5gmjd");
    			attr(div5, "class", "legend svelte-1g5gmjd");
    			attr(div6, "class", "questionbox svelte-1g5gmjd");
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

    /* src/App.svelte generated by Svelte v3.22.2 */

    function create_fragment$4(ctx) {
    	let h1;
    	let t1;
    	let t2;
    	let main;
    	let t3;
    	let t4;
    	let h2;
    	let t5;
    	let t6_value = /*snakeBodies*/ ctx[8].length - 3 + "";
    	let t6;
    	let current;
    	let dispose;

    	const questionbox = new Questionbox({
    			props: {
    				question: /*question*/ ctx[0],
    				option1: /*option1*/ ctx[1],
    				option2: /*option2*/ ctx[2]
    			}
    		});

    	const snake = new Snake({
    			props: {
    				snakeBodies: /*snakeBodies*/ ctx[8],
    				direction: /*direction*/ ctx[7]
    			}
    		});

    	const food = new Food({
    			props: {
    				food1Left: /*food1Left*/ ctx[3],
    				food1Top: /*food1Top*/ ctx[4],
    				food2Left: /*food2Left*/ ctx[5],
    				food2Top: /*food2Top*/ ctx[6]
    			}
    		});

    	return {
    		c() {
    			h1 = element("h1");
    			h1.textContent = "Cyber Snake";
    			t1 = space();
    			create_component(questionbox.$$.fragment);
    			t2 = space();
    			main = element("main");
    			create_component(snake.$$.fragment);
    			t3 = space();
    			create_component(food.$$.fragment);
    			t4 = space();
    			h2 = element("h2");
    			t5 = text("Score: ");
    			t6 = text(t6_value);
    			attr(h1, "class", "svelte-15vqhs");
    			attr(main, "class", "svelte-15vqhs");
    			attr(h2, "class", "svelte-15vqhs");
    		},
    		m(target, anchor, remount) {
    			insert(target, h1, anchor);
    			insert(target, t1, anchor);
    			mount_component(questionbox, target, anchor);
    			insert(target, t2, anchor);
    			insert(target, main, anchor);
    			mount_component(snake, main, null);
    			append(main, t3);
    			mount_component(food, main, null);
    			insert(target, t4, anchor);
    			insert(target, h2, anchor);
    			append(h2, t5);
    			append(h2, t6);
    			current = true;
    			if (remount) dispose();
    			dispose = listen(window, "keydown", /*onKeyDown*/ ctx[9]);
    		},
    		p(ctx, [dirty]) {
    			const questionbox_changes = {};
    			if (dirty & /*question*/ 1) questionbox_changes.question = /*question*/ ctx[0];
    			if (dirty & /*option1*/ 2) questionbox_changes.option1 = /*option1*/ ctx[1];
    			if (dirty & /*option2*/ 4) questionbox_changes.option2 = /*option2*/ ctx[2];
    			questionbox.$set(questionbox_changes);
    			const snake_changes = {};
    			if (dirty & /*snakeBodies*/ 256) snake_changes.snakeBodies = /*snakeBodies*/ ctx[8];
    			if (dirty & /*direction*/ 128) snake_changes.direction = /*direction*/ ctx[7];
    			snake.$set(snake_changes);
    			const food_changes = {};
    			if (dirty & /*food1Left*/ 8) food_changes.food1Left = /*food1Left*/ ctx[3];
    			if (dirty & /*food1Top*/ 16) food_changes.food1Top = /*food1Top*/ ctx[4];
    			if (dirty & /*food2Left*/ 32) food_changes.food2Left = /*food2Left*/ ctx[5];
    			if (dirty & /*food2Top*/ 64) food_changes.food2Top = /*food2Top*/ ctx[6];
    			food.$set(food_changes);
    			if ((!current || dirty & /*snakeBodies*/ 256) && t6_value !== (t6_value = /*snakeBodies*/ ctx[8].length - 3 + "")) set_data(t6, t6_value);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(questionbox.$$.fragment, local);
    			transition_in(snake.$$.fragment, local);
    			transition_in(food.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(questionbox.$$.fragment, local);
    			transition_out(snake.$$.fragment, local);
    			transition_out(food.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(h1);
    			if (detaching) detach(t1);
    			destroy_component(questionbox, detaching);
    			if (detaching) detach(t2);
    			if (detaching) detach(main);
    			destroy_component(snake);
    			destroy_component(food);
    			if (detaching) detach(t4);
    			if (detaching) detach(h2);
    			dispose();
    		}
    	};
    }
    let pauseSpeed = 100000000;
    let unit$1 = 50;

    function makePassword(length) {
    	var result = "";
    	var characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    	var charactersLength = characters.length;

    	for (var i = 0; i < length; i++) {
    		result += characters.charAt(Math.floor(Math.random() * charactersLength));
    	}

    	return result;
    }

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

    function instance$4($$self, $$props, $$invalidate) {
    	let question = "Which is better?";

    	//let option1 = "here is a really long question. it goes on and on and really makes you consider.";
    	let option1 = "bears";

    	let option2 = "beets";
    	let correct = "bears";
    	let incorrect = "beets";
    	let foodEaten = "";
    	let correctFood = "food1";
    	let answerFoods = ["food1", "food2"];
    	let food1Left = 0;
    	let food1Top = 0;
    	let food2Left = 0;
    	let food2Top = 0;
    	let direction = "right";
    	let snakeBodies = [];
    	let speed = 100;
    	let board = { "width": 1250, "height": 550 };
    	let gameOver = false;
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

    		$$invalidate(8, snakeBodies = [newHead, ...snakeBodies]);

    		// if the snake eats food, create a new food and add a piece to the snake
    		if (isCollide(newHead, { left: food1Left, top: food1Top })) {
    			foodEaten = "food1";
    		} else if (isCollide(newHead, { left: food2Left, top: food2Top })) {
    			foodEaten = "food2";
    		}

    		if (isCollide(newHead, { left: food1Left, top: food1Top }) || isCollide(newHead, { left: food2Left, top: food2Top })) {
    			console.log("food eaten: " + foodEaten);
    			console.log("correctFood: " + correctFood);

    			if (foodEaten === correctFood) {
    				newQuestion();
    				setSpeed(3000);
    				delayedUnpause(3000);
    				moveFood();
    				$$invalidate(8, snakeBodies = [...snakeBodies, snakeBodies[snakeBodies.length - 1]]);
    			} else {
    				gameOver = true;
    			}
    		}

    		isGameOver();

    		if (gameOver) {
    			alert("Game Over!");
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
    		$$invalidate(0, question = "Which password is better?");
    		incorrect = makePassword(5);
    		correct = makePassword(7);
    		const answers = [incorrect, correct];
    		shuffle(answers);
    		$$invalidate(1, option1 = answers[0]);
    		$$invalidate(2, option2 = answers[1]);
    		correctFood = answerFoods[answers.indexOf(correct)];
    	}

    	function moveFood() {
    		$$invalidate(4, food1Top = Math.floor(Math.random() * Math.floor(board.height / unit$1)) * unit$1);
    		$$invalidate(3, food1Left = Math.floor(Math.random() * Math.floor(board.width / unit$1)) * unit$1);
    		$$invalidate(6, food2Top = Math.floor(Math.random() * Math.floor(board.height / unit$1)) * unit$1);
    		$$invalidate(5, food2Left = Math.floor(Math.random() * Math.floor(board.width / unit$1)) * unit$1);
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
    		$$invalidate(14, speed = newSpeed);
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
    			$$invalidate(7, direction = newDirection);
    		}
    	}

    	function resetGame() {
    		gameOver = false;
    		newQuestion();
    		moveFood();
    		$$invalidate(7, direction = "right");

    		$$invalidate(8, snakeBodies = [
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
    		if ($$self.$$.dirty & /*clear, speed*/ 81920) {
    			//i got this from svelte REPL and don't know exactly how it works, but it enables the pause button
    			 {
    				clearInterval(clear);
    				$$invalidate(16, clear = setInterval(runGame, speed));
    			}
    		}
    	};

    	return [
    		question,
    		option1,
    		option2,
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
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});
    	}
    }

    const app = new App({
      target: document.body,
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
