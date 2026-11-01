document.documentElement.classList.add('js');

document.addEventListener('DOMContentLoaded', () => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 1. Current Year in Footer
    const yearEl = document.getElementById('year');
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }

    // Dialogs close when the backdrop (the dialog element itself) is clicked
    const closeOnBackdrop = (dialog) => {
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) dialog.close();
        });
    };

    // 2. Mobile Menu Sheet
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

    // 3. Terminal Tabs & Typing Simulation
    const tabs = [...document.querySelectorAll('.terminal-tabs [role="tab"]')];
    const typingLine = document.getElementById('term-typing');
    const typedText = document.getElementById('term-typed');

    if (tabs.length && typingLine && typedText) {
        const typingSpeed = 35; // MS delay per character
        let session = 0; // Bumped on every switch so stale timers stop themselves

        const panelFor = (tab) => document.getElementById(tab.getAttribute('aria-controls'));

        const selectTab = (tab) => {
            session++;
            const current = session;

            tabs.forEach(t => {
                const selected = t === tab;
                t.setAttribute('aria-selected', String(selected));
                t.tabIndex = selected ? 0 : -1;
                panelFor(t).hidden = true;
            });

            if (reducedMotion) {
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

    // 4. Certificate Viewer (links still open the file directly without JS)
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

    // 5. Scroll Reveals
    const revealElements = document.querySelectorAll('.reveal');

    if (reducedMotion) {
        revealElements.forEach(el => el.classList.add('revealed'));
    } else {
        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    observer.unobserve(entry.target); // Reveal once
                }
            });
        }, { rootMargin: '0px 0px -6% 0px' });

        revealElements.forEach(el => revealObserver.observe(el));
    }

    // 6. Highlight the Current Section in Both Navs
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

    // 7. Contact Form Validation & Submission
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
});
