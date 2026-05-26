document.addEventListener('DOMContentLoaded', () => {
    // 1. Current Year in Footer
    const yearEl = document.getElementById('year');
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }

    // 2. Shrinking Navbar on Scroll
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }, { passive: true });

    // 3. Mobile Menu Toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const navLinks = document.getElementById('nav-links');
    const menuIcon = mobileMenuBtn ? mobileMenuBtn.querySelector('i') : null;

    if (mobileMenuBtn && navLinks) {
        mobileMenuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            if (navLinks.classList.contains('active')) {
                menuIcon.classList.replace('ph-list', 'ph-x');
            } else {
                menuIcon.classList.replace('ph-x', 'ph-list');
            }
        });

        // Close mobile menu when links are clicked
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                if (menuIcon) menuIcon.classList.replace('ph-x', 'ph-list');
            });
        });
    }

    // 4. Interactive Node Canvas Background Engine
    const canvas = document.getElementById('hero-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let particles = [];
        let mouse = { x: null, y: null, radius: 150 };

        const resizeCanvas = () => {
            canvas.width = canvas.parentElement.offsetWidth;
            canvas.height = canvas.parentElement.offsetHeight;
            initParticles();
        };

        class Particle {
            constructor(x, y) {
                this.x = x;
                this.y = y;
                this.baseX = x;
                this.baseY = y;
                this.radius = Math.random() * 2 + 1;
                this.vx = (Math.random() - 0.5) * 0.4;
                this.vy = (Math.random() - 0.5) * 0.4;
                // Hue shifts between Cyan (#06b6d4) and Violet (#8b5cf6)
                this.color = Math.random() > 0.5 ? 'rgba(6, 182, 212, 0.4)' : 'rgba(139, 92, 246, 0.3)';
            }

            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.fill();
            }

            update() {
                // Free floating movement
                this.x += this.vx;
                this.y += this.vy;

                // Bounce off canvas boundaries
                if (this.x < 0 || this.x > canvas.width) this.vx = -this.vx;
                if (this.y < 0 || this.y > canvas.height) this.vy = -this.vy;

                // Mouse interaction - Attraction and magnetic spring physics
                if (mouse.x !== null && mouse.y !== null) {
                    let dx = mouse.x - this.x;
                    let dy = mouse.y - this.y;
                    let distance = Math.hypot(dx, dy);

                    if (distance < mouse.radius) {
                        // Slowly pull particles towards mouse
                        const force = (mouse.radius - distance) / mouse.radius;
                        this.x += (dx / distance) * force * 1.5;
                        this.y += (dy / distance) * force * 1.5;
                    }
                }
            }
        }

        const initParticles = () => {
            particles = [];
            // Dynamically scale particles count based on screen size
            const count = Math.min(Math.floor((canvas.width * canvas.height) / 11000), 85);
            for (let i = 0; i < count; i++) {
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                particles.push(new Particle(x, y));
            }
        };

        const drawConnections = () => {
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.hypot(dx, dy);

                    // Connect nodes that are close to each other
                    if (dist < 110) {
                        const opacity = (1 - dist / 110) * 0.15;
                        ctx.strokeStyle = `rgba(6, 182, 212, ${opacity})`;
                        ctx.lineWidth = 0.8;
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }
            }
        };

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            particles.forEach(p => {
                p.update();
                p.draw();
            });

            drawConnections();
            requestAnimationFrame(animate);
        };

        // Window Event Bindings
        window.addEventListener('resize', resizeCanvas);
        window.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            mouse.x = e.clientX - rect.left;
            mouse.y = e.clientY - rect.top;
        });

        window.addEventListener('mouseleave', () => {
            mouse.x = null;
            mouse.y = null;
        });

        // Initialize canvas
        resizeCanvas();
        animate();
    }

    // 5. 3D Tilt Card Class (Mouse Interaction)
    class TiltCard {
        constructor(element) {
            this.el = element;
            this.scale = parseFloat(element.getAttribute('data-tilt-scale')) || 1.04;
            this.maxRotation = 8; // Max degree rotation on axes
            
            this.bindEvents();
        }

        bindEvents() {
            this.el.addEventListener('mousemove', (e) => this.handleMove(e));
            this.el.addEventListener('mouseleave', () => this.handleLeave());
        }

        handleMove(e) {
            const rect = this.el.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const midX = rect.width / 2;
            const midY = rect.height / 2;
            
            // Calculate cursor offset percentage relative to card center
            const percentX = (x - midX) / midX;
            const percentY = (y - midY) / midY;
            
            // Map percentage to rotation bounds
            const rotX = -(percentY * this.maxRotation).toFixed(2);
            const rotY = (percentX * this.maxRotation).toFixed(2);
            
            // Apply 3D perspective rotation
            this.el.style.transform = `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(${this.scale}, ${this.scale}, ${this.scale})`;
            this.el.style.transition = 'none';

            // Glow tracking coordinate offsets for CSS glows (skills cards custom hover light)
            this.el.style.setProperty('--x', `${x}px`);
            this.el.style.setProperty('--y', `${y}px`);
        }

        handleLeave() {
            // Restore default position smoothly
            this.el.style.transform = `perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
            this.el.style.transition = 'transform 0.5s ease';
        }
    }

    // Bind tilt effect to cards
    document.querySelectorAll('.tilt-card').forEach(card => new TiltCard(card));

    // 6. Magnetic Hover Buttons
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            
            // Pull the button slightly towards cursor coordinates (magnetic force)
            btn.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
            btn.style.transition = 'none';
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translate(0px, 0px)';
            btn.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)';
        });
    });

    // 7. AppSec High Fidelity Interactive Terminal Tab Swapping & Typing Simulation
    const terminalWidget = document.querySelector('.terminal-widget');
    const terminalBody = document.getElementById('terminal-content');
    
    if (terminalWidget && terminalBody) {
        const tabs = terminalWidget.querySelectorAll('.terminal-tab');
        
        // Define command logs details for typing simulator
        const tabCommands = {
            whoami: {
                cmd: 'cat /etc/mission',
                out: `<div class="terminal-line">
                        <span class="terminal-prompt">$</span><span class="terminal-cmd">cat /etc/mission</span>
                        <div class="terminal-output">"To proactively identify and remediate security vulnerabilities across core applications, APIs, and microservice infrastructures before malicious adversaries exploit them."</div>
                      </div>
                      <div class="terminal-line">
                        <span class="terminal-prompt">$</span><span class="terminal-cmd">whoami</span>
                        <div class="terminal-output">Name: <span class="terminal-highlight">Yousuf Nihal</span><br>Role: <span class="terminal-highlight">Product Security Engineer</span><br>Sectors Audited: BFSI, Government, Healthcare, Energy, Retail, eCommerce, EdTech</div>
                      </div>`
            },
            capabilities: {
                cmd: './check_capabilities.sh',
                out: `<div class="terminal-line">
                        <span class="terminal-prompt">$</span><span class="terminal-cmd">./check_capabilities.sh</span>
                        <div class="terminal-output">
                            [+] Penetration Testing: <span class="terminal-highlight">Advanced VAPT (Web, APIs, Android, iOS)</span><br>
                            [+] Secure Development: <span class="terminal-highlight">Source Code Review (SAST/DAST/SCA)</span><br>
                            [+] Cloud Infrastructures: <span class="terminal-highlight">GCP & Azure Architecture Validations</span><br>
                            [+] Risk Diagnostics: <span class="terminal-highlight">Threat Modeling & Secure Design Consultation</span>
                        </div>
                      </div>`
            },
            arsenal: {
                cmd: 'env | grep TOOLKIT',
                out: `<div class="terminal-line">
                        <span class="terminal-prompt">$</span><span class="terminal-cmd">env | grep TOOLKIT</span>
                        <div class="terminal-output">
                            TOOLKIT_INTERCEPTOR=<span class="terminal-highlight">Burp Suite Professional / OWASP ZAP</span><br>
                            TOOLKIT_STATIC_ANALYSER=<span class="terminal-highlight">Semgrep / SonarQube / Checkmarx</span><br>
                            TOOLKIT_MOBILE_REVERSE=<span class="terminal-highlight">MobSF / Jadx / Frida / Objection</span><br>
                            TOOLKIT_NETWORK_SCANNER=<span class="terminal-highlight">Nmap / Nessus / Wireshark</span>
                        </div>
                      </div>`
            }
        };

        const simulateTerminalSession = (tabKey) => {
            const data = tabCommands[tabKey];
            if (!data) return;

            terminalBody.innerHTML = '';
            
            // Create command lines
            const line = document.createElement('div');
            line.className = 'terminal-line';
            line.innerHTML = `<span class="terminal-prompt">$</span><span class="terminal-cmd-target"></span><span class="terminal-cursor">_</span>`;
            terminalBody.appendChild(line);

            const cmdTarget = line.querySelector('.terminal-cmd-target');
            const cursor = line.querySelector('.terminal-cursor');
            
            let charIndex = 0;
            const typingSpeed = 35; // MS delay per character

            const typeCharacter = () => {
                if (charIndex < data.cmd.length) {
                    cmdTarget.textContent += data.cmd.charAt(charIndex);
                    charIndex++;
                    setTimeout(typeCharacter, typingSpeed);
                } else {
                    // Complete typing, remove current blink cursor line, write dynamic output log
                    setTimeout(() => {
                        cursor.remove();
                        terminalBody.innerHTML = data.out + `<div class="terminal-line"><span class="terminal-prompt">$</span><span class="terminal-cursor">_</span></div>`;
                    }, 250);
                }
            };

            // Start Typing sequence
            typeCharacter();
        };

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                if (tab.classList.contains('active')) return;
                
                // Set Tab active
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const tabKey = tab.getAttribute('data-tab');
                simulateTerminalSession(tabKey);
            });
        });
    }

    // 8. Intersection Observer for Scroll Reveals
    const revealElements = document.querySelectorAll('.reveal-on-scroll');
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                observer.unobserve(entry.target); // Reveal once
            }
        });
    }, {
        root: null,
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px' // Trigger slightly before element is fully in view
    });

    revealElements.forEach(el => revealObserver.observe(el));

    // 9. Contact Form Validation & Submission
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        const nameInput = document.getElementById('name');
        const emailInput = document.getElementById('email');
        const msgInput = document.getElementById('message');
        
        const nameError = document.getElementById('nameError');
        const emailError = document.getElementById('emailError');
        const msgError = document.getElementById('msgError');
        const formStatus = document.getElementById('formStatus');

        const validateForm = () => {
            let isValid = true;

            // Name
            if (nameInput.value.trim() === '') {
                nameError.textContent = 'Identity / Organisation is required.';
                isValid = false;
            } else {
                nameError.textContent = '';
            }

            // Email
            const emailValue = emailInput.value.trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (emailValue === '') {
                emailError.textContent = 'Transmission endpoint email is required.';
                isValid = false;
            } else if (!emailRegex.test(emailValue)) {
                emailError.textContent = 'Please enter a secure, valid email address.';
                isValid = false;
            } else {
                emailError.textContent = '';
            }

            // Message
            if (msgInput.value.trim() === '') {
                msgError.textContent = 'Message payload cannot be empty.';
                isValid = false;
            } else {
                msgError.textContent = '';
            }

            return isValid;
        };

        // Realtime validation trigger
        nameInput.addEventListener('input', validateForm);
        emailInput.addEventListener('input', validateForm);
        msgInput.addEventListener('input', validateForm);

        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();

            if (!validateForm()) {
                formStatus.textContent = '[ERROR] Connection diagnostics failed. Verify payloads.';
                formStatus.className = 'form-status-box active-error';
                return;
            }

            const btn = contactForm.querySelector('button[type="submit"]');
            const originalHTML = btn.innerHTML;
            
            // Neon loader state
            btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Establishing Encrypted Tunnel...';
            btn.disabled = true;

            const formData = new FormData(contactForm);
            const actionUrl = contactForm.getAttribute('action');

            fetch(actionUrl, {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json'
                }
            })
            .then(response => {
                btn.innerHTML = originalHTML;
                btn.disabled = false;

                if (response.ok) {
                    contactForm.reset();
                    formStatus.textContent = '[SUCCESS] Handshake established. Encryption tunnel verified. Message transmitted successfully.';
                    formStatus.className = 'form-status-box active-success';
                    
                    // Clear success logs after 8 seconds
                    setTimeout(() => {
                        formStatus.className = 'form-status-box';
                    }, 8000);
                } else {
                    response.json().then(data => {
                        if (Object.hasOwn(data, 'errors')) {
                            formStatus.textContent = `[ERROR] Secure tunnel rejected: ${data.errors.map(err => err.message).join(', ')}`;
                        } else {
                            formStatus.textContent = '[ERROR] Interface reject. System failed to transmit.';
                        }
                        formStatus.className = 'form-status-box active-error';
                    });
                }
            })
            .catch(error => {
                btn.innerHTML = originalHTML;
                btn.disabled = false;
                formStatus.textContent = '[CONNECTION TIMEOUT] Remote server unreachable. Retry handshake.';
                formStatus.className = 'form-status-box active-error';
            });
        });
    }

    // 10. Springy Anchored Smooth Scrolling
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                // Deduct navbar offset height for accurate coordinate target landing
                const navbarHeight = navbar ? navbar.offsetHeight : 70;
                const elementPosition = targetElement.getBoundingClientRect().top + window.scrollY;
                const offsetPosition = elementPosition - navbarHeight;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
});
