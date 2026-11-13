/* Background story: an authorised security engagement told in six acts and
   scrubbed by scroll. Recon -> scan -> analysis -> exploit -> lateral ops ->
   engagement complete.

   Performance notes
   - One fixed canvas, rendered below screen resolution (it sits under a scrim,
     so the softness reads as depth of field) and capped at 24fps (20 on phones).
   - The operator and chair are drawn once into sprites; each frame only blits them.
   - Paused in background tabs; with reduced motion it redraws only on scroll. */
(() => {
    'use strict';

    const canvas = document.getElementById('ops');
    const ctx = canvas && canvas.getContext('2d');
    if (!ctx) return;

    const root = document.documentElement;
    const motionOK = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const phoneQuery = window.matchMedia('(max-width: 767px)');
    const W = 1600; // Scene units; everything below is drawn in this space
    const H = 1000;

    /* ---------- Story ---------- */

    // cam: [x, y, zoom] in scene units. head: [rotation, dx, dy].
    const STAGES = [
        { label: 'RECON', detail: 'mapping target', rgb: [96, 165, 210], light: 0.5, cam: [800, 560, 1.0], head: [0, 0, 0] },
        { label: 'SCAN', detail: 'enumerating hosts', rgb: [61, 220, 151], light: 0.7, cam: [835, 515, 1.16], head: [0.03, 4, 0] },
        { label: 'ANALYSIS', detail: 'triaging findings', rgb: [228, 178, 92], light: 0.75, cam: [640, 470, 1.34], head: [-0.09, -10, 2] },
        { label: 'EXPLOIT', detail: 'validating access', rgb: [232, 106, 106], light: 0.9, cam: [800, 452, 1.6], head: [0, 0, 7] },
        { label: 'LATERAL', detail: 'mapping blast radius', rgb: [86, 196, 226], light: 0.85, cam: [935, 470, 1.24], head: [0.09, 10, 2] },
        { label: 'COMPLETE', detail: 'report delivered', rgb: [61, 220, 151], light: 0.8, cam: [800, 545, 1.04], head: [0, 0, -4] }
    ];

    // Where each act sits on the page (fractional values blend two acts)
    const ANCHORS = [
        ['.hero', 0], ['#about', 1], ['#skills', 2], ['#experience', 3], ['#credentials', 3.5],
        ['#honors', 4], ['#recommendations', 4], ['#writeups', 4.2], ['#projects', 4.5], ['#contact', 5]
    ];

    /* ---------- Helpers ---------- */

    const MONO = '"Geist Mono", ui-monospace, Consolas, monospace';
    const clamp01 = (v) => Math.min(1, Math.max(0, v));
    const mix = (a, b, f) => a + (b - a) * f;
    const mixRGB = (a, b, f) => [mix(a[0], b[0], f), mix(a[1], b[1], f), mix(a[2], b[2], f)];
    const smooth = (f) => f * f * (3 - 2 * f);
    const rgba = (c, a) => `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${Math.max(0, a).toFixed(3)})`;
    const NEUTRAL = [205, 220, 214];

    // Small seeded generator so every screen shows the same "data" on each visit
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
        for (let i = 1; i < 4; i++) ctx.lineTo(q[i][0], q[i][1]);
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

    // Hood seen from behind, drawn around the neck point
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

    // Rim light: the silhouette minus an eroded copy of itself, strongest along the
    // top edge, blurred once. Tinted with the room light at draw time.
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
        sprites.body = renderSprite(BODY_BOX, q, (c) => {
            pathBody(c);
            c.fillStyle = '#0b0d10';
            c.fill();
            // Hoodie seams catch a little light
            c.strokeStyle = 'rgba(255,255,255,0.03)';
            c.lineWidth = 2;
            c.beginPath();
            c.moveTo(690, 640);
            c.quadraticCurveTo(650, 760, 660, 1000);
            c.moveTo(910, 640);
            c.quadraticCurveTo(950, 760, 940, 1000);
            c.stroke();
        });
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

    /* ---------- Monitor content ---------- */

    // Each screen: its outline (quad) plus an affine frame its content is drawn in
    const SCREENS = {
        C: { quad: [[600, 330], [1000, 330], [1000, 592], [600, 592]], o: [600, 330], ax: [1, 0], w: 400, h: 262 },
        L: { quad: [[300, 346], [586, 370], [586, 580], [300, 602]], o: [300, 346], ax: [1, 0.084], w: 286, h: 256 },
        R: { quad: [[1014, 370], [1300, 346], [1300, 602], [1014, 580]], o: [1014, 370], ax: [1, -0.084], w: 286, h: 232 },
        UL: { quad: [[410, 192], [592, 203], [592, 312], [410, 320]], o: [410, 192], ax: [1, 0.06], w: 182, h: 126 },
        UR: { quad: [[1008, 203], [1190, 192], [1190, 320], [1008, 312]], o: [1008, 203], ax: [1, -0.06], w: 182, h: 112 }
    };

    const font = (px) => { ctx.font = `${px}px ${MONO}`; };

    const header = (g, c, title, right) => {
        font(9);
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.fillStyle = rgba(c, 0.9);
        ctx.fillText(title, 10, 8);
        if (right) {
            ctx.textAlign = 'right';
            ctx.fillStyle = rgba(c, 0.5);
            ctx.fillText(right, g.w - 10, 8);
            ctx.textAlign = 'left';
        }
        ctx.fillStyle = rgba(c, 0.16);
        ctx.fillRect(10, 22, g.w - 20, 1);
    };

    const lineColor = (line, c) => {
        if (line.startsWith('[+]') || line.startsWith('$') || line.startsWith('root@')) return rgba(c, 0.95);
        if (line.startsWith('[*]')) return rgba(NEUTRAL, 0.7);
        return rgba(NEUTRAL, 0.48);
    };

    // Endless upward scroll of a list of lines
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
            ctx.fillStyle = lineColor(line, c);
            ctx.fillText(line, 10, top + i * lh - off);
        }
        ctx.restore();
    };

    // Lines typed out one character at a time, looping every `cycle` seconds
    const typed = (g, c, lines, cycle, top, size = 9, lh = 14) => {
        font(size);
        ctx.textBaseline = 'top';
        let budget = ((g.t % cycle) / cycle) * 1.35 * lines.reduce((n, l) => n + l.length, 0);
        let y = top;
        let cursor = null;
        const maxRows = Math.floor((g.h - top) / lh);
        const shown = [];
        for (const line of lines) {
            if (budget <= 0) break;
            const part = line.slice(0, Math.min(line.length, Math.floor(budget)));
            budget -= line.length;
            shown.push(part);
        }
        const start = Math.max(0, shown.length - maxRows);
        for (let i = start; i < shown.length; i++) {
            ctx.fillStyle = lineColor(lines[i], c);
            ctx.fillText(shown[i], 10, y);
            cursor = [10 + ctx.measureText(shown[i]).width + 2, y];
            y += lh;
        }
        if (cursor && Math.floor(g.t * 2.2) % 2 === 0) {
            ctx.fillStyle = rgba(c, 0.9);
            ctx.fillRect(cursor[0], cursor[1], size * 0.6, size + 1);
        }
    };

    const sparkline = (g, c, seed, speed, top, amp = 0.35) => {
        const n = 40;
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
            const x = 10 + (i / n) * (g.w - 20);
            const v = Math.sin(i * 0.55 + g.t * speed + seed) * 0.5 + Math.sin(i * 1.7 + g.t * speed * 1.9 + seed * 3) * 0.3;
            const y = top + (g.h - top) * (0.55 - v * amp);
            if (i) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
        }
        ctx.strokeStyle = rgba(c, 0.85);
        ctx.lineWidth = 1.2;
        ctx.stroke();
    };

    const bars = (g, c, seed, speed, top, count = 14) => {
        const bw = (g.w - 20) / count;
        for (let i = 0; i < count; i++) {
            const v = 0.25 + 0.75 * Math.abs(Math.sin(i * 1.3 + seed + g.t * speed * (0.6 + (i % 3) * 0.2)));
            const bh = (g.h - top - 10) * v;
            ctx.fillStyle = rgba(c, 0.25 + v * 0.5);
            ctx.fillRect(10 + i * bw + 1, g.h - 10 - bh, bw - 3, bh);
        }
    };

    const radar = (g, c, cx, cy, r, speed, blips) => {
        ctx.strokeStyle = rgba(c, 0.25);
        ctx.lineWidth = 1;
        for (let k = 1; k <= 3; k++) {
            ctx.beginPath();
            ctx.arc(cx, cy, (r * k) / 3, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(cx - r, cy);
        ctx.lineTo(cx + r, cy);
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx, cy + r);
        ctx.stroke();
        const a = (g.t * speed) % (Math.PI * 2);
        for (let k = 0; k < 10; k++) {
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, r, a - (k + 1) * 0.06, a - k * 0.06);
            ctx.closePath();
            ctx.fillStyle = rgba(c, 0.22 * (1 - k / 10));
            ctx.fill();
        }
        if (blips) {
            blips.forEach(([ba, bd]) => {
                const age = ((a - ba) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
                const glow = clamp01(1 - age / 3);
                ctx.fillStyle = rgba(c, 0.15 + glow * 0.85);
                ctx.fillRect(cx + Math.cos(ba) * bd * r - 2, cy + Math.sin(ba) * bd * r - 2, 4, 4);
            });
        }
    };

    const progress = (g, c, x, y, w, p, label) => {
        ctx.fillStyle = rgba(c, 0.15);
        ctx.fillRect(x, y, w, 6);
        ctx.fillStyle = rgba(c, 0.85);
        ctx.fillRect(x, y, w * p, 6);
        if (label) {
            font(9);
            ctx.textBaseline = 'top';
            ctx.fillStyle = rgba(NEUTRAL, 0.6);
            ctx.fillText(`${label} ${Math.round(p * 100)}%`, x, y + 11);
        }
    };

    // Fixed node layouts per graph so they never jump between frames
    const makeGraph = (seed, n, links) => {
        const r = seeded(seed);
        const nodes = Array.from({ length: n }, () => [0.06 + r() * 0.88, 0.16 + r() * 0.78]);
        const edges = [];
        nodes.forEach((a, i) => {
            nodes
                .map((b, j) => [j, (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2])
                .filter(([j]) => j !== i)
                .sort((p, q) => p[1] - q[1])
                .slice(0, links)
                .forEach(([j]) => { if (i < j) edges.push([i, j]); });
        });
        // Breadth-first order from node 0: the path the operation follows
        const order = [0];
        const seen = new Set(order);
        for (let k = 0; k < order.length; k++) {
            edges.forEach(([a, b]) => {
                const next = a === order[k] ? b : b === order[k] ? a : -1;
                if (next >= 0 && !seen.has(next)) { seen.add(next); order.push(next); }
            });
        }
        nodes.forEach((_, i) => { if (!seen.has(i)) order.push(i); });
        return { nodes, edges, rank: order.reduce((m, node, i) => { m[node] = i; return m; }, {}) };
    };

    const GRAPH_RECON = makeGraph(11, 12, 2);
    const GRAPH_OPS = makeGraph(29, 34, 3);

    const drawGraph = (g, c, graph, owned, t, packets) => {
        const px = (n) => [n[0] * g.w, n[1] * g.h];
        ctx.lineWidth = 1;
        graph.edges.forEach(([a, b]) => {
            const hot = graph.rank[a] < owned && graph.rank[b] < owned;
            const [x1, y1] = px(graph.nodes[a]);
            const [x2, y2] = px(graph.nodes[b]);
            ctx.strokeStyle = hot ? rgba(c, 0.55) : rgba(NEUTRAL, 0.12);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            if (hot && packets) {
                const f = (t * 0.6 + a * 0.37) % 1;
                ctx.fillStyle = rgba(c, 0.95);
                ctx.fillRect(x1 + (x2 - x1) * f - 1.5, y1 + (y2 - y1) * f - 1.5, 3, 3);
            }
        });
        graph.nodes.forEach((n, i) => {
            const [x, y] = px(n);
            const hot = graph.rank[i] < owned;
            ctx.fillStyle = hot ? rgba(c, 0.95) : rgba(NEUTRAL, 0.35);
            ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
            if (hot) {
                ctx.strokeStyle = rgba(c, 0.3);
                ctx.strokeRect(x - 5, y - 5, 10, 10);
            }
        });
    };

    const hexLines = (() => {
        const r = seeded(7);
        const hex = (n) => n.toString(16).padStart(2, '0');
        return Array.from({ length: 24 }, (_, i) => {
            const bytes = Array.from({ length: 8 }, () => (r() * 256) | 0);
            const ascii = bytes.map(b => (b > 32 && b < 127 ? String.fromCharCode(b) : '.')).join('');
            return `${(i * 8).toString(16).padStart(4, '0')}  ${bytes.map(hex).join(' ')}  ${ascii}`;
        });
    })();

    const TEXT = {
        recon: ['$ whois target.corp', '  registrar: example-registrar', '  created: 2014-03-11', '$ dig +short target.corp', '  10.0.4.12', '  10.0.4.18', '$ subfinder -d target.corp', '  api.target.corp', '  vpn.target.corp', '  dev.target.corp', '  staging.target.corp', '$ scope --verify engagement.yml', '[+] scope: authorised, 254 hosts'],
        nmap: ['$ nmap -sV -T4 10.0.4.0/24', 'Nmap scan report for 10.0.4.12', 'PORT      STATE     SERVICE', '22/tcp    open      ssh  OpenSSH 8.9', '80/tcp    open      http  nginx 1.24', '443/tcp   open      https nginx 1.24', '8080/tcp  open      http  Jetty 9.4', 'Nmap scan report for 10.0.4.18', '3306/tcp  filtered  mysql', '5432/tcp  open      postgresql 14', '6379/tcp  closed    redis', '[+] 23 hosts up, 61 open ports', 'Nmap scan report for 10.0.4.31', '25/tcp    open      smtp  Postfix', '[*] fingerprinting services...'],
        code: ['@app.get("/api/v2/users/{id}")', 'def get_user(id: int, user=Depends(auth)):', '    # TODO: ownership check', '    row = db.users.get(id)', '    return row.to_dict()', '', '@app.post("/api/v2/upload")', 'def upload(f: UploadFile):', '    path = f"/data/{f.filename}"', '    save(path, f.file)'],
        exploit: ['$ python3 poc.py --target api.target.corp', '[*] scope check ............ ok', '[*] requesting /users/1042 (own)', '[*] swapping object id -> 1043', '[*] response: 200 OK (other tenant)', '[+] IDOR confirmed - read-only PoC', '[+] evidence saved: finding-07.png', '$ report add --sev high --id F-07', '[+] finding logged for remediation', 'root@sandbox:~# '],
        http: ['GET /api/v2/users/1043 HTTP/1.1', 'Host: api.target.corp', 'Authorization: Bearer eyJhbGciOi...', '', 'HTTP/1.1 200 OK', 'Content-Type: application/json', '{"id":1043,', ' "email":"j***@target.corp",', ' "tenant":"b7"}'],
        summary: ['$ report --summary', 'hosts in scope ....... 254', 'findings ............. 12', 'critical ............. 1', 'remediated ........... 12/12', 'retest ............... passed', '[+] report delivered'],
        hosts: ['10.0.4.12  web-01', '10.0.4.18  db-01', '10.0.4.21  api-gw', '10.0.4.31  mail', '10.0.4.40  ci-runner', '10.0.4.44  vault', '10.0.4.52  k8s-node', '10.0.4.53  k8s-node', '10.0.4.60  backup']
    };

    const FINDINGS = [['Broken access control', 'CRIT', 0.95], ['IDOR on /users/{id}', 'HIGH', 0.8], ['SSRF in image proxy', 'HIGH', 0.72], ['JWT none-alg accepted', 'HIGH', 0.68], ['Reflected XSS', 'MED', 0.5], ['Verbose errors', 'LOW', 0.25]];

    const CONTENT = [
        // 0 Recon
        {
            C: (g, c) => {
                header(g, c, 'TARGET 10.0.4.0/24', 'AUTHORISED SCOPE');
                drawGraph(g, c, GRAPH_RECON, 1 + Math.floor((g.t * 0.4) % 4), g.t, false);
                const [tx, ty] = [GRAPH_RECON.nodes[0][0] * g.w, GRAPH_RECON.nodes[0][1] * g.h];
                const pulse = (g.t * 0.8) % 1;
                ctx.strokeStyle = rgba(c, 0.8 * (1 - pulse));
                ctx.beginPath();
                ctx.arc(tx, ty, 6 + pulse * 22, 0, Math.PI * 2);
                ctx.stroke();
            },
            L: (g, c) => { header(g, c, 'OSINT'); scrollLines(g, c, TEXT.recon, 0.45, 30); },
            R: (g, c) => { header(g, c, 'SURFACE MAP'); radar(g, c, g.w / 2, g.h / 2 + 12, Math.min(g.w, g.h) * 0.36, 0.5, null); },
            UL: (g, c) => { header(g, c, 'DNS'); sparkline(g, c, 1, 0.4, 30, 0.12); },
            UR: (g, c) => { header(g, c, 'SUBDOMAINS', '4'); bars(g, c, 2, 0.2, 40, 8); }
        },
        // 1 Scan
        {
            C: (g, c) => { header(g, c, 'nmap', 'scanning'); scrollLines(g, c, TEXT.nmap, 1.6, 30, 10, 15); },
            L: (g, c) => {
                header(g, c, 'HOST DISCOVERY');
                radar(g, c, g.w / 2, g.h / 2 + 14, Math.min(g.w, g.h) * 0.38, 1.4, [[0.4, 0.5], [1.3, 0.8], [2.2, 0.3], [3.1, 0.65], [4.2, 0.9], [5.3, 0.45]]);
            },
            R: (g, c) => {
                header(g, c, '10.0.4.0/24', '254');
                const cols = 16;
                const rows = 10;
                const cw = (g.w - 20) / cols;
                const ch = (g.h - 40) / rows;
                const lit = Math.floor((g.t * 18) % (cols * rows + 40));
                const r = seeded(3);
                for (let i = 0; i < cols * rows; i++) {
                    const up = r() > 0.82;
                    const on = i < lit;
                    ctx.fillStyle = on ? (up ? rgba(c, 0.9) : rgba(NEUTRAL, 0.12)) : rgba(NEUTRAL, 0.04);
                    ctx.fillRect(10 + (i % cols) * cw + 1, 32 + Math.floor(i / cols) * ch + 1, cw - 2, ch - 2);
                }
            },
            UL: (g, c) => { header(g, c, 'PPS'); bars(g, c, 5, 2.2, 32, 12); },
            UR: (g, c) => { header(g, c, 'SWEEP'); progress(g, c, 10, 52, g.w - 20, (g.t * 0.08) % 1, 'progress'); }
        },
        // 2 Analysis
        {
            C: (g, c) => {
                header(g, c, 'ARCHITECTURE REVIEW', 'threat model');
                const boxes = [['CDN', 0.08, 0.45], ['LB', 0.27, 0.45], ['API GW', 0.47, 0.45], ['AUTH', 0.68, 0.24], ['USERS API', 0.68, 0.66], ['DB', 0.88, 0.66]];
                const links = [[0, 1], [1, 2], [2, 3], [2, 4], [4, 5], [3, 4]];
                const bw = 62;
                const bh = 28;
                const at = (b) => [b[1] * g.w, b[2] * g.h + 10];
                ctx.lineWidth = 1;
                links.forEach(([a, b], i) => {
                    const [x1, y1] = at(boxes[a]);
                    const [x2, y2] = at(boxes[b]);
                    ctx.strokeStyle = rgba(NEUTRAL, 0.22);
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                    const f = (g.t * 0.5 + i * 0.21) % 1;
                    ctx.fillStyle = rgba(c, 0.8);
                    ctx.fillRect(x1 + (x2 - x1) * f - 1.5, y1 + (y2 - y1) * f - 1.5, 3, 3);
                });
                font(8);
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                boxes.forEach((b, i) => {
                    const [x, y] = at(b);
                    const weak = i === 4;
                    const pulse = weak ? 0.5 + 0.5 * Math.sin(g.t * 4) : 0;
                    ctx.fillStyle = weak ? rgba(c, 0.12 + pulse * 0.15) : 'rgba(10,13,15,0.9)';
                    ctx.fillRect(x - bw / 2, y - bh / 2, bw, bh);
                    ctx.strokeStyle = weak ? rgba(c, 0.6 + pulse * 0.4) : rgba(NEUTRAL, 0.3);
                    ctx.strokeRect(x - bw / 2, y - bh / 2, bw, bh);
                    ctx.fillStyle = weak ? rgba(c, 1) : rgba(NEUTRAL, 0.7);
                    ctx.fillText(b[0], x, y);
                    if (weak) ctx.fillText('IDOR?', x, y + bh / 2 + 10);
                });
                ctx.textAlign = 'left';
            },
            L: (g, c) => {
                header(g, c, 'FINDINGS', '6 open');
                font(9);
                ctx.textBaseline = 'top';
                FINDINGS.forEach(([name, sev, w], i) => {
                    const y = 34 + i * 34;
                    ctx.fillStyle = rgba(NEUTRAL, 0.65);
                    ctx.fillText(name, 10, y);
                    ctx.fillStyle = rgba(c, 0.5 + w * 0.5);
                    ctx.fillText(sev, g.w - 42, y);
                    ctx.fillStyle = rgba(c, 0.12);
                    ctx.fillRect(10, y + 14, g.w - 20, 4);
                    ctx.fillStyle = rgba(c, 0.35 + w * 0.6);
                    ctx.fillRect(10, y + 14, (g.w - 20) * w * (0.92 + 0.08 * Math.sin(g.t * 2 + i)), 4);
                });
            },
            R: (g, c) => {
                header(g, c, 'users.py', 'review');
                font(8.5);
                ctx.textBaseline = 'top';
                TEXT.code.forEach((line, i) => {
                    const y = 32 + i * 18;
                    if (i === 3) {
                        ctx.fillStyle = rgba(c, 0.12 + 0.1 * Math.sin(g.t * 3));
                        ctx.fillRect(4, y - 3, g.w - 8, 16);
                    }
                    ctx.fillStyle = i === 3 ? rgba(c, 1) : rgba(NEUTRAL, line.trim().startsWith('#') ? 0.3 : 0.55);
                    ctx.fillText(line, 10, y);
                });
            },
            UL: (g, c) => {
                header(g, c, 'CVSS');
                const cx = g.w / 2;
                const cy = g.h - 18;
                const r = 46;
                ctx.lineWidth = 6;
                ctx.strokeStyle = rgba(c, 0.15);
                ctx.beginPath();
                ctx.arc(cx, cy, r, Math.PI, 0);
                ctx.stroke();
                ctx.strokeStyle = rgba(c, 0.9);
                ctx.beginPath();
                ctx.arc(cx, cy, r, Math.PI, Math.PI + Math.PI * 0.91);
                ctx.stroke();
                font(14);
                ctx.textAlign = 'center';
                ctx.textBaseline = 'alphabetic';
                ctx.fillStyle = rgba(c, 1);
                ctx.fillText('9.1', cx, cy - 4);
                ctx.textAlign = 'left';
            },
            UR: (g, c) => { header(g, c, 'SEVERITY'); bars(g, c, 9, 0.6, 34, 5); }
        },
        // 3 Exploit (proof of concept in a sandbox)
        {
            C: (g, c) => { header(g, c, 'poc.py', 'sandbox'); typed(g, c, TEXT.exploit, 11, 32, 10, 16); },
            L: (g, c) => { header(g, c, 'MEMORY'); scrollLines(g, c, hexLines, 2.4, 30, 8.5, 12); },
            R: (g, c) => {
                header(g, c, 'REPLAY', '200');
                font(8.5);
                ctx.textBaseline = 'top';
                TEXT.http.forEach((line, i) => {
                    ctx.fillStyle = i === 4 ? rgba(c, 1) : rgba(NEUTRAL, i < 3 ? 0.6 : 0.45);
                    ctx.fillText(line, 10, 32 + i * 18);
                });
            },
            UL: (g, c) => {
                header(g, c, 'IDS');
                const on = Math.floor(g.t * 1.6) % 2 === 0;
                ctx.fillStyle = rgba(c, on ? 0.85 : 0.25);
                ctx.beginPath();
                ctx.arc(g.w / 2, g.h / 2 + 12, 16, 0, Math.PI * 2);
                ctx.fill();
                font(9);
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillStyle = rgba(NEUTRAL, 0.6);
                ctx.fillText('alert raised (expected)', g.w / 2, g.h - 22);
                ctx.textAlign = 'left';
            },
            UR: (g, c) => { header(g, c, 'ACCESS'); progress(g, c, 10, 50, g.w - 20, clamp01((g.t % 11) / 8), 'read-only'); }
        },
        // 4 Lateral movement / blast radius
        {
            C: (g, c) => {
                header(g, c, 'BLAST RADIUS', 'mapping');
                drawGraph(g, c, GRAPH_OPS, 3 + Math.floor((g.t * 1.6) % 32), g.t, true);
            },
            L: (g, c) => {
                header(g, c, 'HOSTS', 'segmented');
                font(9);
                ctx.textBaseline = 'top';
                TEXT.hosts.forEach((line, i) => {
                    const y = 32 + i * 22;
                    const state = (i + Math.floor(g.t * 0.7)) % 4;
                    ctx.fillStyle = rgba(NEUTRAL, 0.55);
                    ctx.fillText(line, 10, y);
                    ctx.fillStyle = state === 0 ? rgba(c, 1) : rgba(c, 0.25);
                    ctx.fillRect(g.w - 20, y + 2, 7, 7);
                });
            },
            R: (g, c) => {
                header(g, c, 'TRAFFIC');
                for (let k = 0; k < 3; k++) sparkline(g, c, k * 2.1, 1.8 + k * 0.4, 30 + k * 60, 0.08);
            },
            UL: (g, c) => { header(g, c, 'PIVOTS'); bars(g, c, 13, 1.4, 32, 10); },
            UR: (g, c) => { header(g, c, 'COVERAGE'); progress(g, c, 10, 50, g.w - 20, 0.4 + 0.5 * ((g.t * 0.05) % 1), 'mapped'); }
        },
        // 5 Engagement complete
        {
            C: (g, c) => {
                const cx = g.w / 2;
                const cy = g.h / 2 - 14;
                const pulse = 0.5 + 0.5 * Math.sin(g.t * 1.4);
                ctx.save();
                ctx.translate(cx, cy);
                ctx.beginPath();
                ctx.moveTo(0, -46);
                ctx.lineTo(38, -32);
                ctx.lineTo(38, 2);
                ctx.quadraticCurveTo(36, 34, 0, 52);
                ctx.quadraticCurveTo(-36, 34, -38, 2);
                ctx.lineTo(-38, -32);
                ctx.closePath();
                ctx.fillStyle = rgba(c, 0.08 + pulse * 0.06);
                ctx.fill();
                ctx.strokeStyle = rgba(c, 0.85);
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(-16, 2);
                ctx.lineTo(-4, 14);
                ctx.lineTo(18, -10);
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.restore();
                font(12);
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillStyle = rgba(c, 1);
                ctx.fillText('ENGAGEMENT COMPLETE', cx, cy + 64);
                font(9);
                ctx.fillStyle = rgba(NEUTRAL, 0.55);
                ctx.fillText('12 findings · 12 remediated · report delivered', cx, cy + 84);
                ctx.textAlign = 'left';
            },
            L: (g, c) => { header(g, c, 'SUMMARY'); typed(g, c, TEXT.summary, 40, 32, 9, 18); },
            R: (g, c) => { header(g, c, 'POSTURE', 'hardened'); sparkline(g, c, 4, 0.3, 30, 0.05); },
            UL: (g, c) => {
                header(g, c, 'STATUS');
                font(16);
                ctx.textBaseline = 'middle';
                ctx.fillStyle = rgba(c, 1);
                ctx.fillText('SECURE', 10, g.h / 2 + 10);
            },
            UR: (g, c) => { header(g, c, 'RETEST'); progress(g, c, 10, 50, g.w - 20, 1, 'passed'); }
        }
    ];

    /* ---------- Room ---------- */

    const dust = (() => {
        const r = seeded(91);
        return Array.from({ length: 42 }, () => ({ x: 380 + r() * 840, y: 140 + r() * 560, s: 0.6 + r() * 1.6, p: r() * 10, v: 0.2 + r() * 0.5 }));
    })();

    const rackLeds = (() => {
        const r = seeded(17);
        return Array.from({ length: 64 }, (_, i) => ({ x: 70 + (i % 4) * 34 + r() * 6, y: 200 + Math.floor(i / 4) * 34, rate: 0.3 + r() * 2.5, amber: r() > 0.85 }));
    })();

    const drawRoom = (light, intensity, t, success) => {
        const wall = ctx.createLinearGradient(0, 0, 0, H);
        wall.addColorStop(0, '#07090b');
        wall.addColorStop(0.7, '#090b0d');
        wall.addColorStop(1, '#050607');
        ctx.fillStyle = wall;
        ctx.fillRect(-1600, -1000, W + 3200, H + 2000);

        // Light thrown on the wall by the monitors
        const glow = ctx.createRadialGradient(800, 420, 40, 800, 420, 780);
        glow.addColorStop(0, rgba(light, 0.3 * intensity));
        glow.addColorStop(0.5, rgba(light, 0.09 * intensity));
        glow.addColorStop(1, rgba(light, 0));
        ctx.fillStyle = glow;
        ctx.fillRect(-200, -300, W + 400, H + 400);

        // Engagement complete: a slow ring of light washes across the room
        if (success > 0) {
            const p = (t * 0.28) % 1;
            const ring = ctx.createRadialGradient(800, 460, p * 900, 800, 460, p * 900 + 70);
            ring.addColorStop(0, rgba(light, 0));
            ring.addColorStop(0.5, rgba(light, 0.12 * success * (1 - p)));
            ring.addColorStop(1, rgba(light, 0));
            ctx.fillStyle = ring;
            ctx.fillRect(-200, -300, W + 400, H + 400);
        }

        // Server rack, left
        ctx.fillStyle = '#08090b';
        ctx.fillRect(48, 170, 170, 600);
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 2;
        ctx.strokeRect(48, 170, 170, 600);
        for (let y = 186; y < 760; y += 34) {
            ctx.fillStyle = 'rgba(255,255,255,0.018)';
            ctx.fillRect(58, y, 150, 26);
        }
        rackLeds.forEach((led, i) => {
            const on = Math.sin(t * led.rate + i * 1.7) > 0.2;
            if (!on) return;
            ctx.fillStyle = led.amber ? 'rgba(242,184,75,0.55)' : 'rgba(61,220,151,0.5)';
            ctx.fillRect(led.x, led.y, 3, 3);
        });

        // Window with blinds, right: cool night light
        ctx.fillStyle = 'rgba(40, 60, 80, 0.12)';
        ctx.fillRect(1390, 160, 180, 400);
        for (let y = 166; y < 556; y += 14) {
            ctx.fillStyle = 'rgba(120, 150, 180, 0.06)';
            ctx.fillRect(1394, y, 172, 5);
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.strokeRect(1390, 160, 180, 400);
    };

    const drawDesk = (light, intensity, t) => {
        // Desk top and front
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
        pool.addColorStop(0, rgba(light, 0.22 * intensity));
        pool.addColorStop(1, rgba(light, 0));
        ctx.fillStyle = pool;
        ctx.fillRect(90, 698, 1420, 74);
        ctx.restore();
        ctx.fillStyle = '#060708';
        ctx.fillRect(90, 772, 1420, 300);
        ctx.fillStyle = rgba(light, 0.05 * intensity);
        ctx.fillRect(90, 772, 1420, 2);

        // Keyboard and mouse catch the screen light
        ctx.fillStyle = rgba(light, 0.07 * intensity);
        ctx.fillRect(690, 712, 220, 18);
        ctx.fillStyle = rgba(light, 0.06 * intensity);
        ctx.fillRect(948, 716, 22, 14);

        // Mug, with steam drifting up
        ctx.fillStyle = '#0d1012';
        ctx.fillRect(1196, 656, 42, 50);
        ctx.strokeStyle = '#0d1012';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(1242, 680, 11, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
        ctx.fillStyle = rgba(light, 0.06 * intensity);
        ctx.fillRect(1196, 656, 3, 50);
        ctx.lineWidth = 1.5;
        for (let k = 0; k < 3; k++) {
            ctx.beginPath();
            for (let i = 0; i <= 20; i++) {
                const y = 650 - i * 4.5;
                const x = 1205 + k * 12 + Math.sin(i * 0.45 + t * 1.6 + k * 2) * (2 + i * 0.35);
                if (i) ctx.lineTo(x, y);
                else ctx.moveTo(x, y);
            }
            ctx.strokeStyle = `rgba(200,210,205,${0.05 - k * 0.012})`;
            ctx.stroke();
        }
    };

    const drawMonitors = (light, intensity, t, s0, s1, f, phone) => {
        // Upper mount bar and stands
        ctx.fillStyle = '#0a0c0e';
        ctx.fillRect(560, 252, 480, 6);
        ctx.fillRect(793, 252, 14, 450);
        [[442, 590, 700], [1158, 590, 700]].forEach(([x, top, bottom]) => ctx.fillRect(x - 6, top, 12, bottom - top));
        ctx.fillStyle = '#0b0e10';
        [[800, 704], [442, 704], [1158, 704]].forEach(([x, y]) => {
            ctx.beginPath();
            ctx.ellipse(x, y, 70, 8, 0, 0, Math.PI * 2);
            ctx.fill();
        });

        const order = phone ? ['L', 'R', 'C'] : ['UL', 'UR', 'L', 'R', 'C'];
        order.forEach(key => {
            const sc = SCREENS[key];
            // Bezel
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
            const g = { w: sc.w, h: sc.h, t };
            if (f < 0.98) {
                ctx.globalAlpha = (1 - f) * (0.85 + 0.15 * intensity);
                CONTENT[s0][key](g, STAGES[s0].rgb);
            }
            if (f > 0.02) {
                ctx.globalAlpha = f * (0.85 + 0.15 * intensity);
                CONTENT[s1][key](g, STAGES[s1].rgb);
            }
            ctx.globalAlpha = 1;
            // Glass sheen and faint scanlines
            const sheen = ctx.createLinearGradient(0, 0, sc.w, sc.h);
            sheen.addColorStop(0, 'rgba(255,255,255,0.045)');
            sheen.addColorStop(0.4, 'rgba(255,255,255,0)');
            ctx.fillStyle = sheen;
            ctx.fillRect(0, 0, sc.w, sc.h);
            ctx.restore();
        });
    };

    const drawDust = (light, intensity, t) => {
        dust.forEach(d => {
            const x = d.x + Math.sin(t * 0.15 * d.v + d.p) * 30;
            const y = ((d.y - t * 6 * d.v) % 560 + 560) % 560 + 140;
            const near = clamp01(1 - Math.hypot(x - 800, y - 460) / 520);
            const a = near * 0.35 * intensity * (0.6 + 0.4 * Math.sin(t * 0.8 + d.p));
            if (a < 0.01) return;
            ctx.fillStyle = rgba(light, a);
            ctx.fillRect(x, y, d.s, d.s);
        });
    };

    /* ---------- Camera, scroll and frame loop ---------- */

    let vw = 0;
    let vh = 0;
    let k = 1; // Canvas pixels per CSS pixel
    let base = 1;
    let phone = false;
    let anchors = [];
    const cam = { x: 800, y: 560, z: 1, ready: false };

    const measure = () => {
        const docH = document.documentElement.scrollHeight;
        anchors = [];
        ANCHORS.forEach(([selector, stage]) => {
            const el = document.querySelector(selector);
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const y = rect.top + window.scrollY + Math.min(rect.height, window.innerHeight) * 0.5;
            anchors.push({ y: Math.min(y, docH - window.innerHeight * 0.5), stage });
        });
        anchors.sort((a, b) => a.y - b.y);
    };

    // Acts hold near their section and blend in between (smoothstep)
    const stageAtScroll = () => {
        if (!anchors.length) return 0;
        const y = window.scrollY + window.innerHeight * 0.5;
        if (y <= anchors[0].y) return anchors[0].stage;
        for (let i = 1; i < anchors.length; i++) {
            const a = anchors[i - 1];
            const b = anchors[i];
            if (y <= b.y) return mix(a.stage, b.stage, smooth(clamp01((y - a.y) / (b.y - a.y || 1))));
        }
        return anchors[anchors.length - 1].stage;
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
        // Phones show the room as a band near the top; larger screens fill the frame
        base = phone ? (vw / W) * 1.7 : Math.max(vw / W, vh / H);
        buildSprites(Math.min(1, base * 1.7 * k * 1.15));
        measure();
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

    // Stage readouts in the status line (desktop) and the floating chip (phones)
    const slOp = document.getElementById('sl-op');
    const chip = document.getElementById('ops-chip');
    const chipLabel = document.getElementById('ops-chip-label');
    let shownStage = -1;
    const updateLabels = (s) => {
        const i = Math.round(s);
        if (chip) chip.classList.toggle('is-on', window.scrollY > window.innerHeight * 0.6);
        if (i === shownStage) return;
        shownStage = i;
        const text = `${String(i + 1).padStart(2, '0')}/06 ${STAGES[i].label} · ${STAGES[i].detail}`;
        if (slOp) slOp.textContent = text;
        if (chipLabel) chipLabel.textContent = text;
        root.style.setProperty('--op-rgb', STAGES[i].rgb.join(', '));
    };

    let last = performance.now();
    const draw = (now) => {
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        const t = motionOK ? now / 1000 : 12;

        const s = stageAtScroll();
        const s0 = Math.min(STAGES.length - 1, Math.floor(s));
        const s1 = Math.min(STAGES.length - 1, s0 + 1);
        const f = s - s0;
        const A = STAGES[s0];
        const B = STAGES[s1];
        updateLabels(s);

        // Camera eases toward the act's framing for a smooth dolly
        const strength = phone ? 0.7 : 1;
        const target = {
            x: mix(A.cam[0], B.cam[0], f),
            y: mix(A.cam[1], B.cam[1], f),
            z: 1 + (mix(A.cam[2], B.cam[2], f) - 1) * strength
        };
        const ease = motionOK && cam.ready ? 1 - Math.exp(-dt * 2.6) : 1;
        cam.x += (target.x - cam.x) * ease;
        cam.y += (target.y - cam.y) * ease;
        cam.z += (target.z - cam.z) * ease;
        cam.ready = true;

        const light = mixRGB(A.rgb, B.rgb, f);
        const flicker = motionOK ? 0.975 + 0.025 * Math.sin(t * 37) * Math.sin(t * 13) : 1;
        const intensity = mix(A.light, B.light, f) * flicker;
        const drift = motionOK ? [Math.sin(t * 0.21) * 5 + Math.sin(t * 0.13) * 3, Math.sin(t * 0.17) * 3] : [0, 0];
        const success = clamp01((s - 4.5) / 0.5);

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#050607';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        applyCam(0.55, drift);
        drawRoom(light, intensity, t, success);

        applyCam(1, drift);
        drawDesk(light, intensity, t);
        drawMonitors(light, intensity, t, s0, s1, f, phone);

        if (!phone) {
            applyCam(1.1, drift);
            drawDust(light, intensity, t);
        }

        // Operator: breathing body, head turning toward the active screen, chair in front
        applyCam(1.3, drift);
        // Seat the operator low in frame so the screens stay readable over the shoulder
        ctx.translate(800, 1050);
        ctx.scale(0.92, 0.92);
        ctx.translate(-800, -1000);
        const breathe = motionOK ? Math.sin(t * 1.25) * 0.006 : 0;
        ctx.save();
        ctx.translate(800, 1000);
        ctx.scale(1, 1 + breathe);
        ctx.translate(-800, -1000);
        ctx.drawImage(sprites.body, BODY_BOX.x, BODY_BOX.y, BODY_BOX.w, BODY_BOX.h);
        drawTinted(sprites.bodyRim, BODY_BOX, light, 0.32 * intensity);
        ctx.restore();

        const rot = mix(A.head[0], B.head[0], f) + (motionOK ? Math.sin(t * 0.7) * 0.012 : 0);
        ctx.save();
        ctx.translate(NECK[0] + mix(A.head[1], B.head[1], f), NECK[1] + mix(A.head[2], B.head[2], f) - breathe * 400);
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

    // Sections change height as content reveals, fonts load and details open
    if ('ResizeObserver' in window) {
        let pending = false;
        new ResizeObserver(() => {
            if (pending) return;
            pending = true;
            requestAnimationFrame(() => { pending = false; measure(); });
        }).observe(document.body);
    }

    if (!motionOK) {
        // Reduced motion: still tells the story, but only redraws when the page scrolls
        let ticking = false;
        window.addEventListener('scroll', () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame((now) => { ticking = false; draw(now); });
        }, { passive: true });
        draw(performance.now());
        return;
    }

    const frameMs = phone ? 50 : 41;
    let lastFrame = 0;
    let frame = 0;
    const loop = (now) => {
        frame = requestAnimationFrame(loop);
        if (now - lastFrame < frameMs) return;
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
