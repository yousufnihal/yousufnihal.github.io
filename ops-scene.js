/* Background: an operator at a multi-screen workstation running an authorised
   security engagement. The operation progresses with the page:

   - Centre screen: a network map. Reached systems light up node by node from the
     entry point, data flows along reached links, the frontier pulses. At the end
     the map is complete and shows "MISSION COMPLETED".
   - Left: terminal (recon -> scan -> analysis -> proof of concept -> report).
   - Right: live traffic and a connection log, ending in "ACCESS GRANTED".
   - Upper screens: operation progress and packet rate.

   Kept quiet on purpose: gentle camera drift and push-in only, soft blue to green
   light, all of it under a scrim so the portfolio content stays primary.

   Performance: one fixed canvas rendered below screen resolution, capped at
   20fps (15 on phones), figure drawn once into sprites, paused in background
   tabs, and redrawn only on scroll when reduced motion is requested. */
(() => {
    'use strict';

    const canvas = document.getElementById('ops');
    const ctx = canvas && canvas.getContext('2d');
    if (!ctx) return;

    const motionOK = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const phoneQuery = window.matchMedia('(max-width: 767px)');
    const W = 1600; // Scene units
    const H = 1000;

    const GREEN = [61, 220, 151];
    const BLUE = [110, 168, 255];
    const NEUTRAL = [205, 220, 214];
    const MONO = '"Geist Mono", ui-monospace, Consolas, monospace';

    const clamp01 = (v) => Math.min(1, Math.max(0, v));
    const mix = (a, b, f) => a + (b - a) * f;
    const mixRGB = (a, b, f) => [mix(a[0], b[0], f), mix(a[1], b[1], f), mix(a[2], b[2], f)];
    const smooth = (f) => f * f * (3 - 2 * f);
    const rgba = (c, a) => `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${Math.max(0, a).toFixed(3)})`;

    // Seeded generator so the network and logs are identical on every visit
    const seeded = (seed) => {
        let s = seed >>> 0;
        return () => {
            s = (s + 0x6D2B79F5) >>> 0;
            let t = s;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    };

    const makeCanvas = (w, h) => {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.ceil(w));
        c.height = Math.max(1, Math.ceil(h));
        return c;
    };

    const roundRectPath = (c, x, y, w, h, r) => {
        c.moveTo(x + r, y);
        c.arcTo(x + w, y, x + w, y + h, r);
        c.arcTo(x + w, y + h, x, y + h, r);
        c.arcTo(x, y + h, x, y, r);
        c.arcTo(x, y, x + w, y, r);
        c.closePath();
    };

    const quadPath = (q) => {
        ctx.beginPath();
        ctx.moveTo(q[0][0], q[0][1]);
        for (let i = 1; i < q.length; i++) ctx.lineTo(q[i][0], q[i][1]);
        ctx.closePath();
    };

    const growQuad = (q, by) => {
        const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4;
        const cy = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
        return q.map(([x, y]) => {
            const dx = x - cx;
            const dy = y - cy;
            const len = Math.hypot(dx, dy) || 1;
            return [x + (dx / len) * by, y + (dy / len) * by];
        });
    };

    /* ---------- The operation ---------- */

    const PHASES = ['RECON', 'SCAN', 'ANALYSIS', 'EXPLOIT', 'REPORT'];

    const TERMINAL = [
        ['$ whois target.corp', '  registrar: example-registrar', '$ dig +short target.corp', '  10.0.4.12', '  10.0.4.18', '$ subfinder -d target.corp', '  api.target.corp', '  vpn.target.corp', '  staging.target.corp', '$ scope --verify engagement.yml', '[+] scope: authorised, 254 hosts'],
        ['$ nmap -sV -T4 10.0.4.0/24', 'Nmap scan report for 10.0.4.12', 'PORT      STATE  SERVICE', '22/tcp    open   ssh  OpenSSH 8.9', '443/tcp   open   https nginx 1.24', '8080/tcp  open   http  Jetty 9.4', 'Nmap scan report for 10.0.4.18', '5432/tcp  open   postgresql 14', '[+] 23 hosts up, 61 open ports'],
        ['$ semgrep --config auto api/', '  users.py:4  missing ownership check', '  upload.py:9 path built from filename', '$ burp --replay /api/v2/users/1043', '  HTTP/1.1 200 OK (other tenant)', '[*] candidate: IDOR (high)', '[*] candidate: path traversal (med)', '$ threat-model --update api-gw'],
        ['$ python3 poc.py --target api.target.corp', '[*] scope check ............ ok', '[*] requesting /users/1042 (own)', '[*] swapping object id -> 1043', '[+] IDOR confirmed - read-only PoC', '[+] evidence saved: finding-07.png', '$ pivot --via api-gw --map', '[+] 3 internal segments reachable'],
        ['$ report --summary', '  hosts in scope ....... 254', '  findings ............. 12', '  remediated ........... 12/12', '  retest ............... passed', '[+] report delivered', '[+] mission completed', '$ exit']
    ];

    // Network: clustered segments, each node linked to its nearest neighbours.
    // "rank" is the order in which the operation reaches each node.
    const NETWORK = (() => {
        const r = seeded(29);
        const centres = [[0.2, 0.36], [0.5, 0.3], [0.8, 0.38], [0.32, 0.72], [0.68, 0.72]];
        const nodes = [];
        centres.forEach(([cx, cy], c) => {
            const count = c === 0 ? 6 : 8;
            for (let i = 0; i < count; i++) {
                const a = r() * Math.PI * 2;
                const d = 0.03 + r() * 0.11;
                nodes.push([clamp01(cx + Math.cos(a) * d * 1.2), clamp01(cy + Math.sin(a) * d)]);
            }
        });
        const edges = [];
        const key = new Set();
        nodes.forEach((a, i) => {
            nodes
                .map((b, j) => [j, (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2])
                .filter(([j]) => j !== i)
                .sort((p, q) => p[1] - q[1])
                .slice(0, 2)
                .forEach(([j]) => {
                    const id = i < j ? `${i}-${j}` : `${j}-${i}`;
                    if (!key.has(id)) { key.add(id); edges.push([Math.min(i, j), Math.max(i, j)]); }
                });
        });
        // Bridge each segment to the next so the whole map is connected
        const firstOf = [0, 6, 14, 22, 30];
        [[0, 1], [1, 2], [0, 3], [3, 4], [2, 4]].forEach(([a, b]) => edges.push([firstOf[a] + 1, firstOf[b] + 2]));

        const order = [0];
        const seen = new Set(order);
        for (let k = 0; k < order.length; k++) {
            edges.forEach(([a, b]) => {
                const next = a === order[k] ? b : b === order[k] ? a : -1;
                if (next >= 0 && !seen.has(next)) { seen.add(next); order.push(next); }
            });
        }
        nodes.forEach((_, i) => { if (!seen.has(i)) order.push(i); });
        const rank = [];
        order.forEach((node, i) => { rank[node] = i; });
        return { nodes, edges, rank };
    })();

    const LOG = (() => {
        const r = seeded(5);
        const ports = ['tcp/443', 'tcp/22', 'tcp/5432', 'tcp/8080', 'udp/53', 'tcp/6379'];
        return Array.from({ length: 24 }, () => {
            const a = 10 + ((r() * 60) | 0);
            const b = 10 + ((r() * 60) | 0);
            return `10.0.4.${a} -> 10.0.4.${b}  ${ports[(r() * ports.length) | 0]}`;
        });
    })();

    /* ---------- Screen drawing helpers ---------- */

    const font = (px) => { ctx.font = `${px}px ${MONO}`; };

    const header = (g, c, title, right) => {
        font(9);
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.fillStyle = rgba(c, 0.9);
        ctx.fillText(title, 10, 8);
        if (right) {
            ctx.textAlign = 'right';
            ctx.fillStyle = rgba(NEUTRAL, 0.5);
            ctx.fillText(right, g.w - 10, 8);
            ctx.textAlign = 'left';
        }
        ctx.fillStyle = rgba(c, 0.16);
        ctx.fillRect(10, 22, g.w - 20, 1);
    };

    const scrollLines = (g, c, lines, speed, top, size = 9, lh = 13) => {
        font(size);
        ctx.textBaseline = 'top';
        const rows = Math.ceil((g.h - top) / lh) + 1;
        const pos = g.t * speed;
        const first = Math.floor(pos);
        const off = (pos - first) * lh;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, top, g.w, g.h - top);
        ctx.clip();
        for (let i = 0; i < rows; i++) {
            const line = lines[(first + i) % lines.length];
            const strong = line.startsWith('$') || line.startsWith('[+]');
            ctx.fillStyle = strong ? rgba(c, 0.92) : rgba(NEUTRAL, line.startsWith('[*]') ? 0.62 : 0.45);
            ctx.fillText(line, 10, top + i * lh - off);
        }
        ctx.restore();
    };

    const sparkline = (g, c, seed, speed, top, height, amp) => {
        ctx.beginPath();
        for (let i = 0; i <= 40; i++) {
            const x = 10 + (i / 40) * (g.w - 20);
            const v = Math.sin(i * 0.55 + g.t * speed + seed) * 0.5 + Math.sin(i * 1.7 + g.t * speed * 1.9 + seed * 3) * 0.3;
            const y = top + height * (0.5 - v * amp);
            if (i) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
        }
        ctx.strokeStyle = rgba(c, 0.8);
        ctx.lineWidth = 1.2;
        ctx.stroke();
    };

    const bigLabel = (g, c, text, sub, y, pulse) => {
        ctx.fillStyle = 'rgba(4, 7, 8, 0.82)';
        ctx.fillRect(0, y - 24, g.w, sub ? 50 : 40);
        ctx.fillStyle = rgba(c, 0.18 + pulse * 0.12);
        ctx.fillRect(0, y - 24, g.w, 1);
        ctx.fillRect(0, y + (sub ? 25 : 15), g.w, 1);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        font(g.w > 300 ? 17 : 13);
        ctx.fillStyle = rgba(c, 0.85 + pulse * 0.15);
        ctx.fillText(text, g.w / 2, y - 4);
        if (sub) {
            font(8.5);
            ctx.fillStyle = rgba(NEUTRAL, 0.6);
            ctx.fillText(sub, g.w / 2, y + 14);
        }
        ctx.textAlign = 'left';
    };

    /* ---------- The five screens ---------- */

    const SCREENS = {
        C: { quad: [[600, 330], [1000, 330], [1000, 592], [600, 592]], o: [600, 330], ax: [1, 0], w: 400, h: 262 },
        L: { quad: [[300, 346], [586, 370], [586, 580], [300, 602]], o: [300, 346], ax: [1, 0.084], w: 286, h: 256 },
        R: { quad: [[1014, 370], [1300, 346], [1300, 602], [1014, 580]], o: [1014, 370], ax: [1, -0.084], w: 286, h: 232 },
        UL: { quad: [[410, 192], [592, 203], [592, 312], [410, 320]], o: [410, 192], ax: [1, 0.06], w: 182, h: 126 },
        UR: { quad: [[1008, 203], [1190, 192], [1190, 320], [1008, 312]], o: [1008, 203], ax: [1, -0.06], w: 182, h: 112 }
    };

    const drawNetwork = (g, c, p, done) => {
        const n = NETWORK.nodes.length;
        const reached = 1 + p * (n - 1); // Fractional: the newest node fades in
        const at = (i) => [10 + NETWORK.nodes[i][0] * (g.w - 20), 28 + NETWORK.nodes[i][1] * (g.h - 40)];
        const owned = Math.min(n, Math.floor(reached));
        header(g, c, 'NETWORK MAP  10.0.4.0/24', `${owned}/${n} reached`);

        // Links: faint when unexplored, lit once both ends are reached
        ctx.lineWidth = 1;
        NETWORK.edges.forEach(([a, b]) => {
            const lit = Math.min(clamp01(reached - NETWORK.rank[a]), clamp01(reached - NETWORK.rank[b]));
            const [x1, y1] = at(a);
            const [x2, y2] = at(b);
            ctx.strokeStyle = lit > 0 ? rgba(c, 0.15 + lit * 0.4) : rgba(NEUTRAL, 0.12);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            // Data flowing along reached links, both directions
            if (lit > 0.6) {
                for (let k = 0; k < 2; k++) {
                    const f = (g.t * (0.35 + ((a * 7 + b) % 5) * 0.06) + a * 0.37 + k * 0.5) % 1;
                    const ff = k ? 1 - f : f;
                    ctx.fillStyle = rgba(c, 0.9 * lit);
                    ctx.fillRect(x1 + (x2 - x1) * ff - 1.5, y1 + (y2 - y1) * ff - 1.5, 3, 3);
                }
            }
        });

        // Nodes
        NETWORK.nodes.forEach((_, i) => {
            const [x, y] = at(i);
            const lit = clamp01(reached - NETWORK.rank[i]);
            ctx.fillStyle = lit > 0 ? rgba(c, 0.35 + lit * 0.65) : rgba(NEUTRAL, 0.3);
            ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
            if (lit > 0.9) {
                ctx.strokeStyle = rgba(c, 0.28);
                ctx.strokeRect(x - 5, y - 5, 10, 10);
            }
            // Frontier: the node being reached right now pulses
            if (!done && NETWORK.rank[i] === owned) {
                const pulse = (g.t * 0.9) % 1;
                ctx.strokeStyle = rgba(c, 0.7 * (1 - pulse));
                ctx.beginPath();
                ctx.arc(x, y, 5 + pulse * 18, 0, Math.PI * 2);
                ctx.stroke();
            }
        });

        // Entry point marker
        const [ex, ey] = at(0);
        font(7.5);
        ctx.textBaseline = 'top';
        ctx.fillStyle = rgba(NEUTRAL, 0.5);
        ctx.fillText('entry', ex + 7, ey + 4);
    };

    const drawScreen = (key, g, c, p, phase, phaseF, done) => {
        const pulse = 0.5 + 0.5 * Math.sin(g.t * 1.6);
        if (key === 'C') {
            drawNetwork(g, c, p, done);
            if (done > 0) {
                ctx.globalAlpha *= done;
                bigLabel(g, c, 'MISSION COMPLETED', 'all systems mapped · report delivered', g.h / 2 + 8, pulse);
            }
        } else if (key === 'L') {
            header(g, c, 'zsh', PHASES[phase].toLowerCase());
            const base = ctx.globalAlpha;
            if (phaseF < 0.98) {
                ctx.globalAlpha = base * (1 - phaseF);
                scrollLines(g, c, TERMINAL[phase], 0.6, 30);
            }
            if (phaseF > 0.02 && phase + 1 < TERMINAL.length) {
                ctx.globalAlpha = base * phaseF;
                scrollLines(g, c, TERMINAL[phase + 1], 0.6, 30);
            }
            ctx.globalAlpha = base;
        } else if (key === 'R') {
            header(g, c, 'LIVE TRAFFIC', `${Math.round(120 + p * 680 + Math.sin(g.t * 2) * 20)} pkt/s`);
            for (let k = 0; k < 3; k++) sparkline(g, c, k * 2.1, 1.4 + k * 0.4, 32 + k * 30, 26, 0.18 + p * 0.12);
            scrollLines(g, c, LOG, 1.1, 128, 8, 12);
            if (done > 0) {
                const base = ctx.globalAlpha;
                ctx.globalAlpha = base * done;
                bigLabel(g, c, 'ACCESS GRANTED', null, g.h / 2 + 10, pulse);
                ctx.globalAlpha = base;
            }
        } else if (key === 'UL') {
            header(g, c, 'OPERATION', `${Math.round(p * 100)}%`);
            ctx.fillStyle = rgba(c, 0.15);
            ctx.fillRect(10, 50, g.w - 20, 7);
            ctx.fillStyle = rgba(c, 0.9);
            ctx.fillRect(10, 50, (g.w - 20) * p, 7);
            font(9);
            ctx.textBaseline = 'top';
            ctx.fillStyle = rgba(NEUTRAL, 0.65);
            ctx.fillText(`phase ${phase + 1}/5  ${PHASES[Math.min(PHASES.length - 1, Math.round(phase + phaseF))]}`, 10, 70);
        } else if (key === 'UR') {
            header(g, c, 'PACKETS');
            const count = 12;
            const bw = (g.w - 20) / count;
            for (let i = 0; i < count; i++) {
                const v = 0.2 + (0.4 + p * 0.4) * Math.abs(Math.sin(i * 1.3 + g.t * (0.8 + (i % 3) * 0.3)));
                const bh = (g.h - 44) * v;
                ctx.fillStyle = rgba(c, 0.25 + v * 0.5);
                ctx.fillRect(10 + i * bw + 1, g.h - 10 - bh, bw - 3, bh);
            }
        }
    };

    /* ---------- The operator, drawn once into sprites ---------- */

    const BODY_BOX = { x: 588, y: 560, w: 424, h: 440 };
    const HEAD_BOX = { x: 730, y: 430, w: 140, h: 160 };
    const CHAIR_BOX = { x: 680, y: 548, w: 240, h: 452 };
    const NECK = [800, 575];

    const pathBody = (c) => {
        c.beginPath();
        c.moveTo(752, 572);
        c.bezierCurveTo(720, 580, 682, 590, 658, 606);
        c.bezierCurveTo(628, 626, 610, 664, 603, 712);
        c.bezierCurveTo(597, 752, 604, 790, 616, 820);
        c.lineTo(628, 1000);
        c.lineTo(972, 1000);
        c.lineTo(984, 820);
        c.bezierCurveTo(996, 790, 1003, 752, 997, 712);
        c.bezierCurveTo(990, 664, 972, 626, 942, 606);
        c.bezierCurveTo(918, 590, 880, 580, 848, 572);
        c.closePath();
    };

    const pathHead = (c) => {
        c.beginPath();
        c.moveTo(NECK[0] - 52, NECK[1] + 6);
        c.bezierCurveTo(NECK[0] - 68, NECK[1] - 40, NECK[0] - 66, NECK[1] - 100, NECK[0] - 34, NECK[1] - 124);
        c.bezierCurveTo(NECK[0] - 14, NECK[1] - 140, NECK[0] + 16, NECK[1] - 140, NECK[0] + 36, NECK[1] - 124);
        c.bezierCurveTo(NECK[0] + 66, NECK[1] - 100, NECK[0] + 68, NECK[1] - 40, NECK[0] + 52, NECK[1] + 6);
        c.closePath();
    };

    const pathChair = (c) => {
        c.beginPath();
        roundRectPath(c, 748, 556, 104, 46, 18);
        roundRectPath(c, 688, 612, 224, 420, 46);
    };

    const sprites = {};

    const renderSprite = (box, q, paint) => {
        const cv = makeCanvas(box.w * q, box.h * q);
        const c = cv.getContext('2d');
        c.scale(q, q);
        c.translate(-box.x, -box.y);
        paint(c);
        return cv;
    };

    const renderRim = (box, q, path, depth) => {
        const mask = renderSprite(box, q, (c) => { path(c); c.fillStyle = '#fff'; c.fill(); });
        const w = mask.width;
        const h = mask.height;
        const d = Math.max(1, depth * q);

        const eroded = makeCanvas(w, h);
        const e = eroded.getContext('2d');
        e.drawImage(mask, 0, 0);
        e.globalCompositeOperation = 'destination-in';
        [[d * 0.5, 0], [-d * 0.5, 0], [0, d * 2.6], [0, -d * 0.3]].forEach(([dx, dy]) => e.drawImage(mask, dx, dy));

        const rim = makeCanvas(w, h);
        const r = rim.getContext('2d');
        r.drawImage(mask, 0, 0);
        r.globalCompositeOperation = 'destination-out';
        r.drawImage(eroded, 0, 0);
        r.globalCompositeOperation = 'destination-in';
        const fade = r.createLinearGradient(0, 0, 0, h);
        fade.addColorStop(0, 'rgba(0,0,0,1)');
        fade.addColorStop(0.3, 'rgba(0,0,0,0.35)');
        fade.addColorStop(0.65, 'rgba(0,0,0,0)');
        r.fillStyle = fade;
        r.fillRect(0, 0, w, h);

        const soft = makeCanvas(w, h);
        const s = soft.getContext('2d');
        if ('filter' in s) s.filter = `blur(${Math.max(1, 2.5 * q)}px)`;
        s.drawImage(rim, 0, 0);
        return { sprite: soft, tint: makeCanvas(w, h) };
    };

    const buildSprites = (q) => {
        sprites.body = renderSprite(BODY_BOX, q, (c) => { pathBody(c); c.fillStyle = '#0b0d10'; c.fill(); });
        sprites.head = renderSprite(HEAD_BOX, q, (c) => {
            pathHead(c);
            c.fillStyle = '#0c0e11';
            c.fill();
            c.strokeStyle = 'rgba(255,255,255,0.03)';
            c.lineWidth = 2;
            c.beginPath();
            c.moveTo(NECK[0], NECK[1] - 136);
            c.quadraticCurveTo(NECK[0] + 4, NECK[1] - 60, NECK[0], NECK[1]);
            c.stroke();
        });
        sprites.chair = renderSprite(CHAIR_BOX, q, (c) => {
            pathChair(c);
            const g = c.createLinearGradient(0, 556, 0, 1000);
            g.addColorStop(0, '#0a0c0e');
            g.addColorStop(1, '#040506');
            c.fillStyle = g;
            c.fill();
            c.strokeStyle = 'rgba(255,255,255,0.03)';
            c.lineWidth = 2;
            c.stroke();
        });
        sprites.bodyRim = renderRim(BODY_BOX, q, pathBody, 7);
        sprites.headRim = renderRim(HEAD_BOX, q, pathHead, 6);
    };

    const drawTinted = (rim, box, color, alpha) => {
        const t = rim.tint.getContext('2d');
        t.globalCompositeOperation = 'copy';
        t.drawImage(rim.sprite, 0, 0);
        t.globalCompositeOperation = 'source-in';
        t.fillStyle = rgba(color, 1);
        t.fillRect(0, 0, rim.tint.width, rim.tint.height);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha;
        ctx.drawImage(rim.tint, box.x, box.y, box.w, box.h);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    };

    /* ---------- Room ---------- */

    const rackLeds = (() => {
        const r = seeded(17);
        return Array.from({ length: 48 }, (_, i) => ({ x: 70 + (i % 4) * 34 + r() * 6, y: 220 + Math.floor(i / 4) * 40, rate: 0.3 + r() * 2, blue: r() > 0.8 }));
    })();

    const drawRoom = (light, intensity, t, done) => {
        const wall = ctx.createLinearGradient(0, 0, 0, H);
        wall.addColorStop(0, '#07090b');
        wall.addColorStop(0.7, '#090b0d');
        wall.addColorStop(1, '#050607');
        ctx.fillStyle = wall;
        ctx.fillRect(-1600, -1000, W + 3200, H + 2000);

        const glow = ctx.createRadialGradient(800, 430, 40, 800, 430, 760);
        glow.addColorStop(0, rgba(light, 0.24 * intensity));
        glow.addColorStop(0.5, rgba(light, 0.07 * intensity));
        glow.addColorStop(1, rgba(light, 0));
        ctx.fillStyle = glow;
        ctx.fillRect(-200, -300, W + 400, H + 400);

        // Completion: one soft ring of light washes across the room now and then
        if (done > 0) {
            const p = (t * 0.22) % 1;
            const ring = ctx.createRadialGradient(800, 460, p * 900, 800, 460, p * 900 + 70);
            ring.addColorStop(0, rgba(light, 0));
            ring.addColorStop(0.5, rgba(light, 0.08 * done * (1 - p)));
            ring.addColorStop(1, rgba(light, 0));
            ctx.fillStyle = ring;
            ctx.fillRect(-200, -300, W + 400, H + 400);
        }

        // Server rack with activity lights
        ctx.fillStyle = '#08090b';
        ctx.fillRect(48, 190, 170, 560);
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 2;
        ctx.strokeRect(48, 190, 170, 560);
        rackLeds.forEach((led, i) => {
            if (Math.sin(t * led.rate + i * 1.7) < 0.2) return;
            ctx.fillStyle = led.blue ? rgba(BLUE, 0.5) : rgba(GREEN, 0.45);
            ctx.fillRect(led.x, led.y, 3, 3);
        });

        // Window with blinds: cool night light
        ctx.fillStyle = 'rgba(60, 90, 130, 0.1)';
        ctx.fillRect(1390, 160, 180, 400);
        for (let y = 166; y < 556; y += 14) {
            ctx.fillStyle = 'rgba(130, 165, 210, 0.05)';
            ctx.fillRect(1394, y, 172, 5);
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.strokeRect(1390, 160, 180, 400);
    };

    const drawDesk = (light, intensity, t) => {
        ctx.beginPath();
        ctx.moveTo(170, 698);
        ctx.lineTo(1430, 698);
        ctx.lineTo(1510, 772);
        ctx.lineTo(90, 772);
        ctx.closePath();
        ctx.fillStyle = '#0c0f11';
        ctx.fill();
        ctx.save();
        ctx.clip();
        const pool = ctx.createRadialGradient(800, 700, 20, 800, 700, 640);
        pool.addColorStop(0, rgba(light, 0.2 * intensity));
        pool.addColorStop(1, rgba(light, 0));
        ctx.fillStyle = pool;
        ctx.fillRect(90, 698, 1420, 74);
        ctx.restore();
        ctx.fillStyle = '#060708';
        ctx.fillRect(90, 772, 1420, 300);

        ctx.fillStyle = rgba(light, 0.07 * intensity);
        ctx.fillRect(690, 712, 220, 18);

        // Mug, with steam drifting up
        ctx.fillStyle = '#0d1012';
        ctx.fillRect(1196, 656, 42, 50);
        ctx.strokeStyle = '#0d1012';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(1242, 680, 11, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
        ctx.lineWidth = 1.5;
        for (let k = 0; k < 2; k++) {
            ctx.beginPath();
            for (let i = 0; i <= 18; i++) {
                const y = 650 - i * 4.5;
                const x = 1208 + k * 14 + Math.sin(i * 0.45 + t * 1.2 + k * 2) * (2 + i * 0.35);
                if (i) ctx.lineTo(x, y);
                else ctx.moveTo(x, y);
            }
            ctx.strokeStyle = `rgba(200,210,205,${0.045 - k * 0.012})`;
            ctx.stroke();
        }
    };

    const drawMonitors = (light, intensity, t, p, phase, phaseF, done) => {
        // Mount bar and stands
        ctx.fillStyle = '#0a0c0e';
        ctx.fillRect(560, 252, 480, 6);
        ctx.fillRect(793, 252, 14, 450);
        [442, 1158].forEach(x => ctx.fillRect(x - 6, 590, 12, 110));
        ctx.fillStyle = '#0b0e10';
        [[800, 704], [442, 704], [1158, 704]].forEach(([x, y]) => {
            ctx.beginPath();
            ctx.ellipse(x, y, 70, 8, 0, 0, Math.PI * 2);
            ctx.fill();
        });

        ['UL', 'UR', 'L', 'R', 'C'].forEach(key => {
            const sc = SCREENS[key];
            quadPath(growQuad(sc.quad, 9));
            ctx.fillStyle = '#0a0c0e';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.save();
            quadPath(sc.quad);
            ctx.clip();
            ctx.fillStyle = '#040607';
            ctx.fill();
            ctx.fillStyle = rgba(light, 0.05 * intensity);
            ctx.fill();
            ctx.transform(sc.ax[0], sc.ax[1], 0, 1, sc.o[0], sc.o[1]);
            ctx.globalAlpha = 0.85 + 0.15 * intensity;
            drawScreen(key, { w: sc.w, h: sc.h, t }, light, p, phase, phaseF, done);
            ctx.globalAlpha = 1;
            const sheen = ctx.createLinearGradient(0, 0, sc.w, sc.h);
            sheen.addColorStop(0, 'rgba(255,255,255,0.04)');
            sheen.addColorStop(0.4, 'rgba(255,255,255,0)');
            ctx.fillStyle = sheen;
            ctx.fillRect(0, 0, sc.w, sc.h);
            ctx.restore();
        });
    };

    /* ---------- Camera, scroll and frame loop ---------- */

    let vw = 0;
    let vh = 0;
    let k = 1;
    let base = 1;
    let phone = false;
    const cam = { x: 800, y: 520, z: 1, ready: false };

    const pageProgress = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        return max > 0 ? clamp01(window.scrollY / max) : 0;
    };

    const resize = () => {
        vw = canvas.clientWidth;
        vh = canvas.clientHeight;
        phone = phoneQuery.matches;
        const renderScale = phone ? 0.5 : 0.62;
        const dpr = Math.min(window.devicePixelRatio || 1, phone ? 1 : 1.25);
        canvas.width = Math.max(1, Math.round(vw * dpr * renderScale));
        canvas.height = Math.max(1, Math.round(vh * dpr * renderScale));
        k = canvas.width / vw;
        // Phones show the rig as a band near the top; larger screens fill the frame
        base = phone ? (vw / W) * 1.75 : Math.max(vw / W, vh / H);
        buildSprites(Math.min(1, base * 1.3 * k * 1.15));
    };

    const applyCam = (depth, drift) => {
        const z = 1 + (cam.z - 1) * depth;
        const cx = 800 + (cam.x - 800) * depth;
        const cy = 500 + (cam.y - 500) * depth;
        const s = base * z * k;
        const ax = (phone ? 0.5 : 0.63) * vw + drift[0] * depth;
        const ay = (phone ? 0.3 : 0.5) * vh + drift[1] * depth;
        ctx.setTransform(s, 0, 0, s, ax * k - cx * s, ay * k - cy * s);
    };

    let last = performance.now();
    const draw = (now) => {
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        const t = motionOK ? now / 1000 : 8;

        // Scroll drives the operation. It completes a little before the very end
        // so the finished state is on screen while the contact section is read.
        const p = smooth(clamp01(pageProgress() / 0.9));
        const phasePos = Math.min(PHASES.length - 1, p * (PHASES.length - 1));
        const phase = Math.min(PHASES.length - 1, Math.floor(phasePos));
        const phaseF = clamp01((phasePos - phase - 0.65) / 0.35); // Hold, then crossfade
        const done = clamp01((p - 0.94) / 0.06);

        // Gentle push-in only
        const target = { x: mix(805, 800, p), y: mix(525, 470, p), z: 1 + p * (phone ? 0.08 : 0.2) };
        const ease = motionOK && cam.ready ? 1 - Math.exp(-dt * 2) : 1;
        cam.x += (target.x - cam.x) * ease;
        cam.y += (target.y - cam.y) * ease;
        cam.z += (target.z - cam.z) * ease;
        cam.ready = true;

        const light = mixRGB(BLUE, GREEN, clamp01(p * 1.4));
        const flicker = motionOK ? 0.98 + 0.02 * Math.sin(t * 31) * Math.sin(t * 11) : 1;
        const intensity = mix(0.7, 0.88, p) * flicker;
        const drift = motionOK ? [Math.sin(t * 0.17) * 4, Math.sin(t * 0.13) * 2.5] : [0, 0];

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#050607';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        applyCam(0.6, drift);
        drawRoom(light, intensity, t, done);

        applyCam(1, drift);
        drawDesk(light, intensity, t);
        drawMonitors(light, intensity, t, p, phase, phaseF, done);

        // Operator sits low and a little left so the network map stays visible
        applyCam(1.25, drift);
        ctx.translate(735, 1085);
        ctx.scale(0.9, 0.9);
        ctx.translate(-800, -1000);
        const breathe = motionOK ? Math.sin(t * 1.2) * 0.005 : 0;
        ctx.save();
        ctx.translate(800, 1000);
        ctx.scale(1, 1 + breathe);
        ctx.translate(-800, -1000);
        ctx.drawImage(sprites.body, BODY_BOX.x, BODY_BOX.y, BODY_BOX.w, BODY_BOX.h);
        drawTinted(sprites.bodyRim, BODY_BOX, light, 0.3 * intensity);
        ctx.restore();

        const rot = 0.04 + (motionOK ? Math.sin(t * 0.5) * 0.03 : 0); // Glances across the screens
        ctx.save();
        ctx.translate(NECK[0] + 4, NECK[1] - breathe * 400);
        ctx.rotate(rot);
        ctx.translate(-NECK[0], -NECK[1]);
        ctx.drawImage(sprites.head, HEAD_BOX.x, HEAD_BOX.y, HEAD_BOX.w, HEAD_BOX.h);
        drawTinted(sprites.headRim, HEAD_BOX, light, 0.45 * intensity);
        ctx.restore();

        ctx.drawImage(sprites.chair, CHAIR_BOX.x, CHAIR_BOX.y, CHAIR_BOX.w, CHAIR_BOX.h);
    };

    /* ---------- Start ---------- */

    resize();
    let resizeWidth = window.innerWidth;
    window.addEventListener('resize', () => {
        // Phone address bars resize the viewport while scrolling; rebuild only on width changes
        if (window.innerWidth === resizeWidth) return;
        resizeWidth = window.innerWidth;
        resize();
        if (!motionOK) draw(performance.now());
    }, { passive: true });

    if (!motionOK) {
        // Reduced motion: a still frame that only changes when the page scrolls
        let ticking = false;
        window.addEventListener('scroll', () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame((now) => { ticking = false; draw(now); });
        }, { passive: true });
        draw(performance.now());
        return;
    }

    let lastFrame = 0;
    let frame = 0;
    const loop = (now) => {
        frame = requestAnimationFrame(loop);
        if (now - lastFrame < (phone ? 66 : 50)) return;
        lastFrame = now;
        draw(now);
    };
    const sync = () => {
        cancelAnimationFrame(frame);
        if (!document.hidden) {
            last = performance.now();
            frame = requestAnimationFrame(loop);
        }
    };
    document.addEventListener('visibilitychange', sync);
    sync();
})();
