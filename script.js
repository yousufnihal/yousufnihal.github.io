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

        // Hero copy drifts and fades as the page scrolls away from it
        const hero = document.querySelector('.hero');
        if (hero) {
            addScrub(hero, (rect) => {
                hero.style.setProperty('--hero-p', clamp(-rect.top / rect.height).toFixed(3));
            });
        }

        // A hairline draws across the top of each section as it arrives
        document.querySelectorAll('[data-sheet]').forEach(sheet => {
            addScrub(sheet, (rect, vh) => {
                sheet.style.setProperty('--sheet', clamp((vh - rect.top) / (vh * 0.7)).toFixed(3));
            });
        });
    }

    /* ---------- Top bar turns to glass once the page scrolls ---------- */

    const topbar = document.querySelector('.topbar');
    if (topbar) {
        const syncTopbar = () => topbar.classList.toggle('is-scrolled', window.scrollY > 24);
        window.addEventListener('scroll', syncTopbar, { passive: true });
        syncTopbar();
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

    /* ---------- Hero role retypes itself through a few specialisms ---------- */

    const cycler = document.querySelector('[data-cycle]');
    if (cycler && motionOK) {
        const words = cycler.dataset.cycle.split('|');
        const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        let index = 0;

        (async () => {
            await wait(3600);
            for (;;) {
                if (document.hidden) {
                    await wait(1000);
                    continue;
                }
                const current = cycler.textContent;
                for (let i = current.length; i >= 0; i--) {
                    cycler.textContent = current.slice(0, i);
                    await wait(26);
                }
                index = (index + 1) % words.length;
                await wait(240);
                const next = words[index];
                for (let i = 1; i <= next.length; i++) {
                    cycler.textContent = next.slice(0, i);
                    await wait(55);
                }
                await wait(2800);
            }
        })();
    }

    /* ---------- Status lines that type themselves when reached ---------- */

    document.querySelectorAll('[data-typeline]').forEach(line => {
        if (!motionOK) return;
        const text = line.dataset.typeline;
        line.textContent = '';
        new IntersectionObserver(([entry], observer) => {
            if (!entry.isIntersecting) return;
            observer.disconnect();
            let i = 0;
            const step = () => {
                line.textContent = text.slice(0, ++i);
                if (i < text.length) setTimeout(step, 28);
            };
            setTimeout(step, 500);
        }, { threshold: 0.6 }).observe(line);
    });

    /* ---------- Toast ---------- */

    const toast = document.getElementById('toast');
    let toastTimer = 0;
    const showToast = (text) => {
        if (!toast) return;
        toast.textContent = text;
        toast.classList.add('is-on');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('is-on'), 2400);
    };

    /* ---------- Command palette ---------- */

    const palette = document.getElementById('palette');
    const paletteInput = document.getElementById('palette-input');
    const paletteList = document.getElementById('palette-list');
    const paletteOpen = document.getElementById('palette-open');
    const paletteClose = document.getElementById('palette-close');

    if (palette && paletteInput && paletteList) {
        const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
        const cmdkKey = document.getElementById('cmdk-key');
        if (cmdkKey && isMac) cmdkKey.textContent = '⌘K';

        const email = 'yousufnihal01@gmail.com';
        const go = (id) => document.getElementById(id).scrollIntoView({ behavior: motionOK ? 'smooth' : 'auto' });
        const openTab = (href) => window.open(href, '_blank', 'noopener,noreferrer');

        const sectionNames = {
            about: 'About', skills: 'Skills', experience: 'Experience', credentials: 'Certifications',
            honors: 'Honors', recommendations: 'Recommendations', writeups: 'Writeups', projects: 'Projects', contact: 'Contact'
        };

        const items = [
            ...Object.entries(sectionNames).map(([id, name]) => ({
                group: 'Navigate', label: `Go to ${name}`, hint: `cd ~/${id}`, icon: 'i-arrow-right', run: () => go(id)
            })),
            {
                group: 'Actions', label: 'Copy email address', hint: email, icon: 'i-copy',
                run: () => {
                    if (!navigator.clipboard) {
                        window.location.href = `mailto:${email}`;
                        return;
                    }
                    navigator.clipboard.writeText(email)
                        .then(() => showToast('[ok] email copied to clipboard'))
                        .catch(() => { window.location.href = `mailto:${email}`; });
                }
            },
            { group: 'Actions', label: 'Toggle ambient sound', hint: 'off by default', icon: 'i-sound-on', run: () => { const b = document.getElementById('sound-toggle'); if (b && !b.hidden) b.click(); } },
            { group: 'Actions', label: 'Send an email', hint: 'mailto', icon: 'i-envelope-simple', run: () => { window.location.href = `mailto:${email}`; } },
            {
                group: 'Actions', label: 'Open the interactive terminal', hint: 'about > terminal', icon: 'i-code',
                run: () => {
                    go('about');
                    const input = document.getElementById('term-input');
                    if (input) setTimeout(() => input.focus({ preventScroll: true }), motionOK ? 900 : 0);
                }
            },
            { group: 'Links', label: 'CVE-2025-6478 record', hint: 'cve.org', icon: 'i-bug', run: () => openTab('https://www.cve.org/CVERecord?id=CVE-2025-6478') },
            { group: 'Links', label: 'LinkedIn', hint: 'linkedin.com', icon: 'i-linkedin-logo', run: () => openTab('https://www.linkedin.com/in/yousuf-nihal-8816121a6/') },
            { group: 'Links', label: 'GitHub', hint: 'github.com', icon: 'i-github-logo', run: () => openTab('https://github.com/yousufnihal') },
            { group: 'Links', label: 'Medium writeups', hint: 'medium.com', icon: 'i-medium-logo', run: () => openTab('https://medium.com/@yousufnihal') },
            ...certs.map(cert => ({
                group: 'Certifications',
                label: cert.querySelector('strong').textContent,
                hint: cert.querySelector('.cert-meta').textContent,
                icon: 'i-seal-check',
                run: () => cert.querySelector('a').click()
            }))
        ];

        const svgNS = 'http://www.w3.org/2000/svg';
        let results = [];
        let active = 0;

        const setActive = (i, scroll = true) => {
            active = i;
            const options = paletteList.querySelectorAll('[role="option"]');
            options.forEach((el, k) => el.setAttribute('aria-selected', String(k === i)));
            const current = options[i];
            if (current) {
                paletteInput.setAttribute('aria-activedescendant', current.id);
                if (scroll) current.scrollIntoView({ block: 'nearest' });
            } else {
                paletteInput.removeAttribute('aria-activedescendant');
            }
        };

        const runItem = (i) => {
            const item = results[i];
            if (!item) return;
            palette.close();
            item.run();
        };

        // Every term must appear somewhere in the label, hint or group
        const render = () => {
            const terms = paletteInput.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
            results = items.filter(item => {
                const haystack = `${item.label} ${item.hint} ${item.group}`.toLowerCase();
                return terms.every(term => haystack.includes(term));
            });

            paletteList.textContent = '';
            let lastGroup = '';
            results.forEach((item, i) => {
                if (item.group !== lastGroup) {
                    lastGroup = item.group;
                    const heading = document.createElement('li');
                    heading.className = 'palette-group';
                    heading.setAttribute('role', 'presentation');
                    heading.textContent = item.group;
                    paletteList.append(heading);
                }

                const option = document.createElement('li');
                option.className = 'palette-item';
                option.id = `pal-${i}`;
                option.setAttribute('role', 'option');

                const svg = document.createElementNS(svgNS, 'svg');
                svg.setAttribute('class', 'i');
                svg.setAttribute('aria-hidden', 'true');
                const use = document.createElementNS(svgNS, 'use');
                use.setAttribute('href', `#${item.icon}`);
                svg.append(use);

                const label = document.createElement('span');
                label.className = 'palette-label';
                label.textContent = item.label;
                const hint = document.createElement('span');
                hint.className = 'palette-hint';
                hint.textContent = item.hint;

                option.append(svg, label, hint);
                option.addEventListener('click', () => runItem(i));
                option.addEventListener('pointermove', () => {
                    if (active !== i) setActive(i, false);
                });
                paletteList.append(option);
            });

            if (!results.length) {
                const empty = document.createElement('li');
                empty.className = 'palette-empty';
                empty.setAttribute('role', 'presentation');
                empty.textContent = 'command not found. Try "certs", "email" or "contact".';
                paletteList.append(empty);
            }

            setActive(0);
        };

        const openPalette = () => {
            if (palette.open) return;
            if (menu && menu.open) menu.close();
            paletteInput.value = '';
            render();
            palette.showModal();
            paletteInput.focus();
        };

        paletteInput.addEventListener('input', render);
        paletteInput.addEventListener('keydown', (e) => {
            if (!results.length) return;
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const step = e.key === 'ArrowDown' ? 1 : -1;
                setActive((active + step + results.length) % results.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                runItem(active);
            }
        });

        if (paletteOpen) paletteOpen.addEventListener('click', openPalette);
        if (paletteClose) paletteClose.addEventListener('click', () => palette.close());
        closeOnBackdrop(palette);

        document.addEventListener('keydown', (e) => {
            if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                if (palette.open) palette.close();
                else if (!document.querySelector('dialog[open]')) openPalette();
                return;
            }
            const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
            if (e.key === '/' && !typing && !document.querySelector('dialog[open]')) {
                e.preventDefault();
                openPalette();
            }
        });
    }

    requestUpdate();
});
