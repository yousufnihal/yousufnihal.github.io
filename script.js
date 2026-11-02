document.addEventListener('DOMContentLoaded', () => {
    const root = document.documentElement;
    const motionOK = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));

    // 1. Current Year in Footer
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    /* ---------- Text splitting ---------- */

    // Hero name: per-letter spans; the h1's aria-label carries the real text
    document.querySelectorAll('[data-chars]').forEach(line => {
        const text = line.textContent;
        line.textContent = '';
        [...text].forEach((char, i) => {
            const mask = document.createElement('span');
            mask.className = 'char-mask';
            const inner = document.createElement('span');
            inner.className = 'char';
            inner.textContent = char;
            inner.style.setProperty('--i', i);
            mask.append(inner);
            line.append(mask);
        });
        if ('cursor' in line.dataset) {
            const cursor = document.createElement('span');
            cursor.className = 'name-cursor';
            line.append(cursor);
        }
    });

    // Section labels type themselves out when revealed
    document.querySelectorAll('.kicker.reveal').forEach(kicker => {
        const text = kicker.textContent;
        kicker.textContent = '';
        const typed = document.createElement('span');
        typed.className = 'type';
        typed.textContent = text;
        typed.style.setProperty('--n', text.length);
        kicker.append(typed);
    });

    // Headings: per-word masks that keep the markup (like <em>) and the spaces intact
    const splitWords = (node) => {
        [...node.childNodes].forEach(child => {
            if (child.nodeType === Node.TEXT_NODE) {
                const fragment = document.createDocumentFragment();
                child.textContent.split(/(\s+)/).forEach(part => {
                    if (!part) return;
                    if (/^\s+$/.test(part)) {
                        fragment.append(' ');
                        return;
                    }
                    const mask = document.createElement('span');
                    mask.className = 'word-mask';
                    const inner = document.createElement('span');
                    inner.className = 'word';
                    inner.textContent = part;
                    mask.append(inner);
                    fragment.append(mask);
                });
                child.replaceWith(fragment);
            } else {
                splitWords(child);
            }
        });
    };

    document.querySelectorAll('[data-split]').forEach(heading => {
        splitWords(heading);
        heading.classList.add('reveal');
        heading.querySelectorAll('.word').forEach((word, i) => word.style.setProperty('--i', i));
    });

    // Manifesto: each word lights up as the page scrolls past it
    const manifesto = document.getElementById('manifesto');
    let manifestoWords = [];
    if (manifesto && motionOK) {
        splitWords(manifesto);
        manifestoWords = [...manifesto.querySelectorAll('.word')];
    }

    /* ---------- Intro curtain ---------- */

    const heroEnter = () => root.classList.add('ready');
    const loader = document.getElementById('loader');
    const loaderCount = document.getElementById('loader-count');
    const loaderBar = document.getElementById('loader-bar');

    if (loader && !root.classList.contains('no-intro')) {
        try { sessionStorage.setItem('intro-seen', '1'); } catch (e) { /* private mode */ }

        const duration = 1000;
        const start = performance.now();
        const tick = (now) => {
            const p = clamp((now - start) / duration);
            loaderCount.textContent = Math.round(p * 100);
            loaderBar.style.transform = `scaleX(${p.toFixed(3)})`;
            if (p < 1) {
                requestAnimationFrame(tick);
                return;
            }
            loader.classList.add('is-done');
            heroEnter();
            setTimeout(() => loader.remove(), 900);
        };
        requestAnimationFrame(tick);
    } else {
        if (loader) loader.remove();
        heroEnter();
    }

    /* ---------- Network nodes (hero only) ---------- */

    const startNetwork = (canvas) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const neon = '57, 255, 154';
        const pointer = { x: -1000, y: -1000 };
        let nodes = [];
        let packets = [];
        let width = 0;
        let height = 0;
        let linkDistance = 120;

        const build = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
            width = canvas.clientWidth;
            height = canvas.clientHeight;
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            linkDistance = width < 700 ? 96 : 136;

            // Node count follows area and is capped, since links are checked pair by pair
            const count = Math.max(22, Math.min(64, Math.round((width * height) / 19000)));
            nodes = Array.from({ length: count }, () => ({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.28,
                vy: (Math.random() - 0.5) * 0.28
            }));
            packets = Array.from({ length: 4 }, () => ({ from: null, to: null, t: 1 }));
        };

        const nearestTo = (node) => {
            let best = null;
            let bestDistance = linkDistance * linkDistance;
            nodes.forEach(other => {
                if (other === node) return;
                const d = (other.x - node.x) ** 2 + (other.y - node.y) ** 2;
                if (d < bestDistance && Math.random() > 0.3) {
                    best = other;
                    bestDistance = d;
                }
            });
            return best;
        };

        const draw = () => {
            ctx.clearRect(0, 0, width, height);
            const maxSq = linkDistance * linkDistance;

            nodes.forEach(n => {
                n.x += n.vx;
                n.y += n.vy;
                if (n.x < 0 || n.x > width) n.vx *= -1;
                if (n.y < 0 || n.y > height) n.vy *= -1;
            });

            // Links grouped by strength so each group is one stroke call
            const faint = new Path2D();
            const strong = new Path2D();
            for (let i = 0; i < nodes.length; i++) {
                const a = nodes[i];
                for (let j = i + 1; j < nodes.length; j++) {
                    const b = nodes[j];
                    const d = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
                    if (d < maxSq) {
                        const path = d < maxSq * 0.35 ? strong : faint;
                        path.moveTo(a.x, a.y);
                        path.lineTo(b.x, b.y);
                    }
                }
                if ((a.x - pointer.x) ** 2 + (a.y - pointer.y) ** 2 < maxSq * 1.6) {
                    strong.moveTo(a.x, a.y);
                    strong.lineTo(pointer.x, pointer.y);
                }
            }
            ctx.lineWidth = 1;
            ctx.strokeStyle = `rgba(${neon}, 0.07)`;
            ctx.stroke(faint);
            ctx.strokeStyle = `rgba(${neon}, 0.16)`;
            ctx.stroke(strong);

            ctx.fillStyle = `rgba(${neon}, 0.5)`;
            nodes.forEach(n => ctx.fillRect(n.x - 1.25, n.y - 1.25, 2.5, 2.5));

            // Data packets hop between linked nodes
            ctx.fillStyle = `rgb(${neon})`;
            packets.forEach(p => {
                if (p.t >= 1) {
                    p.from = p.to || nodes[Math.floor(Math.random() * nodes.length)];
                    p.to = nearestTo(p.from);
                    p.t = 0;
                    if (!p.to) {
                        p.t = 1;
                        p.to = null;
                        return;
                    }
                }
                p.t = Math.min(1, p.t + 0.035);
                const x = p.from.x + (p.to.x - p.from.x) * p.t;
                const y = p.from.y + (p.to.y - p.from.y) * p.t;
                ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
            });
        };

        build();

        let resizeWidth = window.innerWidth;
        window.addEventListener('resize', () => {
            // Phone address bars fire resize while scrolling; only rebuild on a real width change
            if (window.innerWidth === resizeWidth) return;
            resizeWidth = window.innerWidth;
            build();
            if (!motionOK) draw();
        }, { passive: true });

        if (!motionOK) {
            draw();
            return;
        }

        if (canHover) {
            canvas.parentElement.addEventListener('pointermove', (e) => {
                const rect = canvas.getBoundingClientRect();
                pointer.x = e.clientX - rect.left;
                pointer.y = e.clientY - rect.top;
            }, { passive: true });
            canvas.parentElement.addEventListener('pointerleave', () => {
                pointer.x = -1000;
                pointer.y = -1000;
            });
        }

        // Capped at 30fps, and fully stopped when off screen or in a background tab
        let visible = true;
        let last = 0;
        let frame = 0;
        const loop = (now) => {
            frame = requestAnimationFrame(loop);
            if (now - last < 33) return;
            last = now;
            draw();
        };
        const sync = () => {
            cancelAnimationFrame(frame);
            if (visible && !document.hidden) frame = requestAnimationFrame(loop);
        };

        new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            sync();
        }).observe(canvas);
        document.addEventListener('visibilitychange', sync);
    };

    const netCanvas = document.getElementById('net');
    if (netCanvas) startNetwork(netCanvas);

    /* ---------- Scroll-linked motion ---------- */

    const scrubbers = new Map();
    const visibleScrubs = new Set();
    let ticking = false;
    const scrubObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) visibleScrubs.add(entry.target);
            else visibleScrubs.delete(entry.target);
        });
        requestUpdate();
    }, { rootMargin: '15% 0px' });

    function updateScrubs() {
        ticking = false;
        const vh = window.innerHeight;
        visibleScrubs.forEach(el => {
            const rect = el.getBoundingClientRect();
            scrubbers.get(el)(rect, vh);
        });
    }

    function requestUpdate() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(updateScrubs);
    }

    const addScrub = (el, fn) => {
        scrubbers.set(el, fn);
        scrubObserver.observe(el);
    };

    if (motionOK) {
        window.addEventListener('scroll', requestUpdate, { passive: true });
        window.addEventListener('resize', requestUpdate, { passive: true });

        if (manifestoWords.length) {
            addScrub(manifesto, (rect, vh) => {
                const p = clamp((vh * 0.85 - rect.top) / (rect.height + vh * 0.35));
                const lit = Math.round(p * manifestoWords.length);
                manifestoWords.forEach((word, i) => word.classList.toggle('is-lit', i < lit));
            });
        }

        // A hairline draws across the top of each section as it arrives
        document.querySelectorAll('[data-sheet]').forEach(sheet => {
            addScrub(sheet, (rect, vh) => {
                sheet.style.setProperty('--sheet', clamp((vh - rect.top) / (vh * 0.7)).toFixed(3));
            });
        });
    }

    /* ---------- Reveals ---------- */

    const revealElements = document.querySelectorAll('.reveal');
    if (motionOK) {
        // Sibling items in a list come in one after another
        document.querySelectorAll('.gallery-track, .bento, .advisories, .builds, .socials').forEach(group => {
            [...group.children].forEach((child, i) => child.style.setProperty('--stagger', `${(i % 4) * 70}ms`));
        });

        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    observer.unobserve(entry.target); // Reveal once
                }
            });
        }, { rootMargin: '0px 0px -6% 0px' });
        revealElements.forEach(el => revealObserver.observe(el));
    } else {
        revealElements.forEach(el => el.classList.add('revealed'));
    }

    /* ---------- Timeline ---------- */

    const timeline = document.getElementById('timeline');
    const timelineFill = document.getElementById('tl-fill');
    const tlYear = document.getElementById('tl-year');
    const tlWhere = document.getElementById('tl-where');

    if (timeline && tlYear && tlWhere) {
        const roles = [...timeline.querySelectorAll('.role')];

        if (timelineFill && motionOK) {
            addScrub(timeline, (rect, vh) => {
                const p = clamp((vh * 0.6 - rect.top) / rect.height);
                timelineFill.style.transform = `scaleY(${p.toFixed(3)})`;
            });
        }

        const setStage = (role) => {
            roles.forEach(r => r.classList.toggle('is-active', r === role));
            if (tlYear.textContent === role.dataset.year) return;
            tlYear.classList.add('is-swapping');
            setTimeout(() => {
                tlYear.textContent = role.dataset.year;
                tlWhere.textContent = role.dataset.where;
                tlYear.classList.remove('is-swapping');
            }, motionOK ? 180 : 0);
        };

        const stageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) setStage(entry.target);
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        roles.forEach(role => stageObserver.observe(role));
    }

    /* ---------- Certificate preview pane (large screens) ---------- */

    const certPane = document.getElementById('cert-pane');
    const certPaneImg = document.getElementById('cert-pane-img');
    const certPaneScan = document.getElementById('cert-pane-scan');
    const certs = [...document.querySelectorAll('.cert')];

    if (certPane && certPaneImg) {
        const showCert = (cert) => {
            if (cert.classList.contains('is-previewed')) return;
            certs.forEach(c => c.classList.toggle('is-previewed', c === cert));
            certPane.classList.toggle('is-dark', cert.classList.contains('is-pending'));
            certPaneImg.src = cert.querySelector('img').getAttribute('src');
            if (motionOK && certPaneScan.animate) {
                certPaneScan.animate(
                    [{ transform: 'translateY(-110%)' }, { transform: 'translateY(420%)' }],
                    { duration: 650, easing: 'cubic-bezier(0.3, 0, 0.3, 1)' }
                );
            }
        };

        certs.forEach(cert => {
            cert.addEventListener('pointerenter', () => showCert(cert));
            cert.addEventListener('focusin', () => showCert(cert));
        });
        certs[0].classList.add('is-previewed');
        certPane.classList.add('is-dark');
    }

    /* ---------- Count-up and decode effects ---------- */

    const decode = (el, duration = 800) => {
        if (el.dataset.decoding) return;
        el.dataset.decoding = '1';
        const finalText = el.textContent;
        const glyphs = 'abcdefghkmnrstx01<>/#$%';
        const start = performance.now();
        const step = (now) => {
            const p = clamp((now - start) / duration);
            const settled = Math.floor(p * finalText.length);
            let out = finalText.slice(0, settled);
            for (let i = settled; i < finalText.length; i++) {
                out += /[\s-]/.test(finalText[i]) ? finalText[i] : glyphs[Math.floor(Math.random() * glyphs.length)];
            }
            el.textContent = out;
            if (p < 1) {
                requestAnimationFrame(step);
            } else {
                el.textContent = finalText;
                delete el.dataset.decoding;
            }
        };
        requestAnimationFrame(step);
    };

    if (motionOK) {
        const once = (el, fn) => {
            const observer = new IntersectionObserver(([entry]) => {
                if (!entry.isIntersecting) return;
                observer.disconnect();
                fn();
            }, { threshold: 0.6 });
            observer.observe(el);
        };

        document.querySelectorAll('[data-count]').forEach(el => {
            const target = parseInt(el.dataset.count, 10);
            once(el, () => {
                const start = performance.now();
                const step = (now) => {
                    const p = clamp((now - start) / 1100);
                    el.textContent = Math.round((1 - Math.pow(1 - p, 3)) * target);
                    if (p < 1) requestAnimationFrame(step);
                };
                requestAnimationFrame(step);
            });
        });

        // Numbers and the accent word of each heading decode into place
        document.querySelectorAll('[data-scramble], .title em .word').forEach(el => {
            once(el, () => decode(el));
        });
    }

    /* ---------- Pointer effects (mouse and trackpad only) ---------- */

    if (canHover && motionOK) {
        // Spotlight that follows the pointer inside a card
        document.querySelectorAll('[data-spot]').forEach(el => {
            el.addEventListener('pointermove', (e) => {
                const rect = el.getBoundingClientRect();
                el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
                el.style.setProperty('--my', `${e.clientY - rect.top}px`);
            }, { passive: true });
        });

        // Nav labels decode on hover
        document.querySelectorAll('.topbar-links a').forEach(link => {
            link.addEventListener('pointerenter', () => decode(link, 350));
        });

        // Magnetic buttons
        document.querySelectorAll('[data-magnetic]').forEach(el => {
            el.addEventListener('pointermove', (e) => {
                const rect = el.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;
                el.style.translate = `${(x * 0.12).toFixed(1)}px ${(y * 0.2).toFixed(1)}px`;
            }, { passive: true });
            el.addEventListener('pointerleave', () => {
                el.style.translate = '';
            });
        });
    }

    /* ---------- Skills: accordion on small screens, side panel on large ones ---------- */

    const skills = [...document.querySelectorAll('#skills-list .skill')];
    const skillsWide = window.matchMedia('(min-width: 1024px)');

    const openSkill = (skill) => {
        skills.forEach(other => {
            const isTarget = other === skill;
            other.classList.toggle('is-open', isTarget);
            other.querySelector('button').setAttribute('aria-expanded', String(isTarget));
        });
    };

    skills.forEach(skill => {
        const button = skill.querySelector('button');
        button.addEventListener('click', () => {
            // The side panel always shows one skill; the accordion may close fully
            const closing = button.getAttribute('aria-expanded') === 'true' && !skillsWide.matches;
            openSkill(closing ? null : skill);
        });
        button.addEventListener('focus', () => {
            if (skillsWide.matches) openSkill(skill);
        });
        if (canHover) {
            button.addEventListener('pointerenter', () => {
                if (skillsWide.matches) openSkill(skill);
            });
        }
    });

    // Leaving the accordion fully closed must not leave the side panel empty
    skillsWide.addEventListener('change', () => {
        if (skillsWide.matches && !skills.some(s => s.classList.contains('is-open'))) openSkill(skills[0]);
    });

    /* ---------- Recommendations switcher ---------- */

    const quotes = [...document.querySelectorAll('#quotes .quote')];
    const quoteTabs = [...document.querySelectorAll('#quote-tabs button')];

    quoteTabs.forEach((tab, index) => {
        tab.addEventListener('click', () => {
            quoteTabs.forEach(t => t.setAttribute('aria-pressed', String(t === tab)));
            quotes.forEach((quote, i) => {
                quote.classList.toggle('is-active', i === index);
                quote.classList.add('revealed');
            });
        });
    });

    /* ---------- Project filters ---------- */

    const filters = [...document.querySelectorAll('#project-filters button')];
    const builds = [...document.querySelectorAll('#builds .build')];

    const applyFilter = (value) => {
        builds.forEach(build => {
            build.classList.add('revealed');
            build.hidden = value !== 'all' && build.dataset.cat !== value;
        });
    };

    filters.forEach(button => {
        button.addEventListener('click', () => {
            filters.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
            const value = button.dataset.filter;
            // View transitions animate the reflow where supported; others just update
            if (document.startViewTransition && motionOK) {
                document.startViewTransition(() => applyFilter(value));
            } else {
                applyFilter(value);
            }
        });
    });

    /* ---------- Menu sheet ---------- */

    const closeOnBackdrop = (dialog) => {
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) dialog.close();
        });
    };

    const menu = document.getElementById('menu');
    const menuOpen = document.getElementById('menu-open');
    const menuClose = document.getElementById('menu-close');

    if (menu && menuOpen && menuClose) {
        menuOpen.addEventListener('click', () => menu.showModal());
        menuClose.addEventListener('click', () => menu.close());
        closeOnBackdrop(menu);

        // Close first so the page can scroll to the chosen section
        menu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => menu.close());
        });
    }

    /* ---------- Terminal tabs and typing ---------- */

    const tabs = [...document.querySelectorAll('.terminal-tabs [role="tab"]')];
    const typingLine = document.getElementById('term-typing');
    const typedText = document.getElementById('term-typed');
    const termLog = document.getElementById('term-log');
    const termForm = document.getElementById('term-form');
    const termInput = document.getElementById('term-input');

    if (tabs.length && typingLine && typedText) {
        const typingSpeed = 35; // MS delay per character
        let session = 0; // Bumped on every switch so stale timers stop themselves

        const panelFor = (tab) => document.getElementById(tab.getAttribute('aria-controls'));

        const selectTab = (tab) => {
            session++;
            const current = session;
            termLog.textContent = '';

            tabs.forEach(t => {
                const selected = t === tab;
                t.setAttribute('aria-selected', String(selected));
                t.tabIndex = selected ? 0 : -1;
                panelFor(t).hidden = true;
            });

            if (!motionOK) {
                panelFor(tab).hidden = false;
                return;
            }

            const cmd = tab.dataset.cmd;
            let charIndex = 0;
            typedText.textContent = '';
            typingLine.hidden = false;

            const typeCharacter = () => {
                if (current !== session) return;

                if (charIndex < cmd.length) {
                    typedText.textContent += cmd.charAt(charIndex);
                    charIndex++;
                    setTimeout(typeCharacter, typingSpeed);
                } else {
                    setTimeout(() => {
                        if (current !== session) return;
                        typingLine.hidden = true;
                        panelFor(tab).hidden = false;
                    }, 250);
                }
            };

            typeCharacter();
        };

        if (motionOK) {
            const firstRun = new IntersectionObserver(([entry]) => {
                if (!entry.isIntersecting) return;
                firstRun.disconnect();
                if (!termLog.childElementCount) selectTab(tabs.find(t => t.getAttribute('aria-selected') === 'true'));
            }, { threshold: 0.35 });
            firstRun.observe(document.querySelector('.terminal'));
        }

        // Output is only ever written with textContent, so input can't inject markup
        const print = (text, className) => {
            const line = document.createElement('p');
            if (className) line.className = className;
            line.textContent = text;
            termLog.append(line);
        };

        const tabFor = { whoami: 0, capabilities: 1, arsenal: 2 };
        const sections = ['about', 'skills', 'experience', 'credentials', 'honors', 'recommendations', 'writeups', 'projects', 'contact'];

        const commands = {
            help: () => [
                'whoami         mission and role',
                'capabilities   what I test',
                'arsenal        my toolkit',
                'certs          all certifications',
                'contact        how to reach me',
                'ls             list sections',
                'goto <name>    jump to a section',
                'clear          clear the screen'
            ],
            certs: () => certs.map(c => `${c.querySelector('strong').textContent} | ${c.querySelector('.cert-meta').textContent}`),
            contact: () => ['yousufnihal01@gmail.com', 'Cyberspace (Remote)'],
            ls: () => sections,
            sudo: () => ['Permission denied. Nice try, though.']
        };

        termForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const raw = termInput.value.trim();
            termInput.value = '';
            if (!raw) return;

            const [name, arg] = raw.toLowerCase().split(/\s+/);

            if (name in tabFor) {
                selectTab(tabs[tabFor[name]]);
                return;
            }

            // Anything else replaces the tab content with a scrolling log
            session++;
            typingLine.hidden = true;
            tabs.forEach(t => { panelFor(t).hidden = true; });

            if (name === 'clear') {
                termLog.textContent = '';
                return;
            }

            print(`$ ${raw}`, 'term-echo');

            if (name === 'goto' && sections.includes(arg)) {
                print(`Moving to ${arg}...`, 'term-out');
                document.getElementById(arg).scrollIntoView();
            } else if (name === 'goto') {
                print(`Unknown section. Try: ${sections.join(', ')}`, 'term-out');
            } else if (Object.hasOwn(commands, name)) {
                commands[name]().forEach(line => print(line, 'term-out'));
            } else {
                print(`command not found: ${name}. Type help for options.`, 'term-out');
            }

            termLog.parentElement.scrollTop = termLog.parentElement.scrollHeight;
        });

        tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => {
                if (tab.getAttribute('aria-selected') !== 'true') selectTab(tab);
            });

            tab.addEventListener('keydown', (e) => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                e.preventDefault();
                const step = e.key === 'ArrowRight' ? 1 : -1;
                const next = tabs[(index + step + tabs.length) % tabs.length];
                next.focus();
                selectTab(next);
            });
        });
    }

    /* ---------- Certificate viewer (links still open the file directly without JS) ---------- */

    const viewer = document.getElementById('viewer');
    const viewerImg = document.getElementById('viewer-img');
    const viewerTitle = document.getElementById('viewer-title');
    const viewerClose = document.getElementById('viewer-close');

    if (viewer && viewerImg && viewerTitle && viewerClose) {
        document.querySelectorAll('[data-viewer]').forEach(link => {
            link.addEventListener('click', (e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                e.preventDefault();
                viewerTitle.textContent = link.dataset.title;
                viewerImg.alt = `${link.dataset.title} certificate`;
                viewerImg.src = link.href;
                viewer.showModal();
            });
        });

        viewerClose.addEventListener('click', () => viewer.close());
        closeOnBackdrop(viewer);
        viewer.addEventListener('close', () => viewerImg.removeAttribute('src'));
    }

    /* ---------- Highlight the current section in both navs ---------- */

    const spyLinks = document.querySelectorAll('[data-spy]');
    const spyObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            spyLinks.forEach(link => {
                if (link.dataset.spy === entry.target.id) {
                    link.setAttribute('aria-current', 'true');
                } else {
                    link.removeAttribute('aria-current');
                }
            });
        });
    }, { rootMargin: '-45% 0px -50% 0px' });

    // Every section is watched so ones without a nav entry clear a stale highlight
    document.querySelectorAll('main section[id]').forEach(section => spyObserver.observe(section));

    /* ---------- Contact form validation and submission ---------- */

    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        const formStatus = document.getElementById('formStatus');
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        const rules = {
            name: (value) => value === '' ? 'Please enter your name or organisation.' : '',
            email: (value) => {
                if (value === '') return 'Please enter your email address.';
                return emailRegex.test(value) ? '' : 'Please enter a valid email address.';
            },
            message: (value) => value === '' ? 'Please enter a message.' : ''
        };

        const validateField = (name) => {
            const input = contactForm.elements[name];
            const error = rules[name](input.value.trim());
            document.getElementById(`${name}Error`).textContent = error;
            input.setAttribute('aria-invalid', String(error !== ''));
            return error === '';
        };

        const setStatus = (text, state) => {
            formStatus.textContent = text;
            formStatus.dataset.state = state;
        };

        Object.keys(rules).forEach(name => {
            const input = contactForm.elements[name];
            input.addEventListener('blur', () => {
                if (input.value.trim() !== '') validateField(name);
            });
            // Clear an error as soon as the visitor starts fixing it
            input.addEventListener('input', () => {
                if (input.getAttribute('aria-invalid') === 'true') validateField(name);
            });
        });

        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const invalid = Object.keys(rules).filter(name => !validateField(name));
            if (invalid.length) {
                setStatus('Please check the highlighted fields.', 'error');
                contactForm.elements[invalid[0]].focus();
                return;
            }

            const btn = contactForm.querySelector('button[type="submit"]');
            btn.disabled = true;
            setStatus('Sending…', 'pending');

            fetch(contactForm.action, {
                method: 'POST',
                body: new FormData(contactForm),
                headers: { 'Accept': 'application/json' }
            })
            .then(async (response) => {
                if (response.ok) {
                    contactForm.reset();
                    setStatus('Message sent. I will reply by email.', 'success');
                    return;
                }
                const data = await response.json().catch(() => ({}));
                const details = Array.isArray(data.errors) ? data.errors.map(err => err.message).join(', ') : '';
                setStatus(details || 'Your message could not be sent. Please email me directly.', 'error');
            })
            .catch(() => {
                setStatus('Could not reach the server. Please try again or email me directly.', 'error');
            })
            .finally(() => {
                btn.disabled = false;
            });
        });
    }

    requestUpdate();
});
