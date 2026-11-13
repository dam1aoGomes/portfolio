/* ==========================================================================
   Portfólio — app.js
   Vanilla JS. Carrega Markdown de ./content/, renderiza tudo, cuida de temas
   e efeitos. Nenhum framework, nenhum build.
   ========================================================================== */
(() => {
  "use strict";

  /* ---------------------------------------------------------------- util -- */

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const esc = (str = "") =>
    String(str).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));

  /** Sanitiza HTML gerado pelo marked. Se DOMPurify falhar, cai num escape. */
  function sanitize(html) {
    if (window.DOMPurify && typeof window.DOMPurify.sanitize === "function") {
      return window.DOMPurify.sanitize(html, {
        USE_PROFILES: { html: true },
        ADD_ATTR: ["target", "rel"],
        ALLOWED_URI_REGEXP: /^(?:https?|mailto|tel|#|\.{0,2}\/)/i,
      });
    }
    const div = document.createElement("div");
    div.textContent = html;
    return div.innerHTML.replace(/\n/g, "<br>");
  }

  /** Markdown → HTML seguro. Linhas novas viram <br> (estilo GitHub). */
  function md(text) {
    if (!text) return "";
    if (!window.marked || typeof window.marked.parse !== "function") {
      return `<p>${esc(text)}</p>`;
    }
    const html = window.marked.parse(String(text).trim(), {
      breaks: true,
      gfm: true,
      headerIds: false,
      mangle: false,
    });
    return sanitize(html);
  }

  const slug = (s) =>
    String(s)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "projeto";

  /** Só aceita URLs seguras (http/https/mailto ou caminho relativo). */
  function safeUrl(url) {
    if (!url) return "";
    const u = String(url).trim();
    if (/^(https?:\/\/|mailto:|tel:|\.{0,2}\/)/i.test(u)) return u;
    if (/^[\w.-]+(\/[\w.-]*)*$/.test(u)) return u; // caminho simples
    return "";
  }

  /** Caminhos sempre relativos ao index.html (funciona em /repo/ do Pages). */
  function relativePath(p) {
    if (!p) return "";
    if (/^(https?:\/\/|data:|blob:)/i.test(p)) return p;
    return p.replace(/^\.?\//, "./");
  }

  function githubUser(url) {
    const m = String(url || "").match(/github\.com\/([^/?#]+)/i);
    return m ? m[1] : "";
  }

  function firstName(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    return parts[0] || "";
  }

  function monogram(name) {
    const parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "··";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el && value) el.textContent = value;
  }

  /* --------------------------------------------------------------- fetch -- */

  async function loadText(path) {
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
    return res.text();
  }

  /**
   * Falha amigável: mostra uma mensagem no lugar indicado e retorna null.
   * O motivo mais comum é abrir o index.html direto por file://.
   */
  function showLoadError(target, label) {
    if (!target) return;
    target.innerHTML = `
      <div class="aviso">
        <strong>Não consegui carregar ${esc(label)}.</strong>
        <p>Isso costuma acontecer quando o site é aberto direto do disco
        (<code>file://</code>) — os navegadores bloqueiam o <code>fetch()</code> de
        arquivos locais.</p>
        <p>Rode um servidor local na pasta do projeto e recarregue:</p>
        <p><code>python -m http.server 8000</code> → acesse
        <code>http://localhost:8000</code></p>
        <p class="muted mono">Dica: no GitHub Pages isso funciona sem nenhum ajuste.</p>
      </div>`;
  }

  /* ----------------------------------------------------------- site.md -- */

  /**
   * Frontmatter simples `chave: valor`. Ignora linhas vazias, `#` comentário e
   * cercas `---` opcionais. Chaves em minúsculas.
   */
  function parseSiteMd(text) {
    const data = {};
    String(text)
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .forEach((raw) => {
        const line = raw.trim();
        if (!line || line === "---" || line.startsWith("#")) return;
        const idx = line.indexOf(":");
        if (idx < 1) return;
        const key = line.slice(0, idx).trim().toLowerCase();
        let value = line.slice(idx + 1).trim();
        value = value.replace(/^["']|["']$/g, "");
        if (key) data[key] = value;
      });
    return data;
  }

  const SITE_DEFAULTS = {
    nome: "Seu Nome",
    tagline: "Desenvolvedor de sites, apps e jogos",
    tema: "",
    github: "",
    email: "",
  };

  /* ------------------------------------------------------- projects.md -- */

  const META_RE = /^[-*]\s*([A-Za-z\u00C0-\u00FF0-9 _-]+?)\s*:\s*(.*)$/;

  /**
   * Parser de projects.md.
   * - Cada projeto começa em uma linha `## Titulo` (fora de blocos de código).
   * - Dali até a primeira linha que não seja metadado lê-se `- chave: valor`.
   * - O resto é a descrição em Markdown.
   * Campos ausentes ficam como string vazia; nada quebra.
   */
  function parseProjects(text) {
    const lines = String(text).replace(/^\uFEFF/, "").split(/\r?\n/);
    const projects = [];
    let current = null;
    let inFence = false;
    let readingMeta = true;

    const push = () => {
      if (!current) return;
      const rest = current.body.join("\n").trim();
      if (current.nome || rest) {
        projects.push({
          nome: current.nome,
          tipo: (current.meta.tipo || "").trim(),
          status: (current.meta.status || "").trim(),
          tags: (current.meta.tags || "")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          imagem: (current.meta.imagem || current.meta.image || "").trim(),
          demo: (current.meta.demo || current.meta.site || "").trim(),
          repo: (current.meta.repo || current.meta.codigo || current.meta.source || "").trim(),
          destaque: /^(sim|true|1|yes|s|destaque)$/i.test((current.meta.destaque || "").trim()),
          descricao: rest,
          extra: Object.fromEntries(
            Object.entries(current.meta).filter(
              ([k]) => !["tipo", "status", "tags", "imagem", "image", "demo", "site",
                "repo", "codigo", "source", "destaque"].includes(k)
            )
          ),
        });
      }
      current = null;
    };

    for (const raw of lines) {
      const line = raw;
      // rastreia blocos ``` para não confundir "## " dentro de código
      if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;

      const heading = !inFence && line.match(/^##\s+(.+?)\s*#*\s*$/);

      if (heading) {
        push();
        current = { nome: heading[1].trim(), meta: {}, body: [] };
        readingMeta = true;
        continue;
      }

      if (!current) continue; // conteúdo antes do primeiro "##" é ignorado

      if (readingMeta) {
        if (!line.trim()) continue; // linhas em branco antes dos metadados
        const m = line.match(META_RE);
        if (m) {
          current.meta[m[1].trim().toLowerCase().replace(/\s+/g, " ")] = m[2].trim();
          continue;
        }
        readingMeta = false; // primeira linha de descrição
      }

      current.body.push(line);
    }
    push();

    return projects;
  }

  /* ---------------------------------------------------------- render ----- */

  const TIPO_META = {
    site: { label: "▦ site", icon: "▦" },
    jogo: { label: "◫ jogo", icon: "◫" },
    game: { label: "◫ jogo", icon: "◫" },
    app: { label: ">_ app", icon: "❯" },
    "app mobile": { label: ">_ app", icon: "❯" },
    biblioteca: { label: "[ ] lib", icon: "{}" },
    lib: { label: "[ ] lib", icon: "{}" },
    api: { label: "<> api", icon: "{}" },
    cli: { label: "$ cli", icon: ">" },
    experimento: { label: "~ lab", icon: "~" },
  };

  function tipoInfo(tipo) {
    const key = String(tipo || "").toLowerCase().trim();
    return TIPO_META[key] || { label: tipo ? `· ${tipo}` : "· projeto", icon: "·" };
  }

  function statusInfo(status) {
    const key = String(status || "").toLowerCase().trim();
    if (/online|live|publicado|ativo|pronto/.test(key)) {
      return { cls: "st-online", card: "st-online", text: "✓ online" };
    }
    if (/andamento|dev|progress|wip|beta|constru/.test(key)) {
      return { cls: "st-progress", card: "st-progress", text: "● em andamento" };
    }
    if (/arquivado|archive|pausado|offline|abandonado|velho/.test(key)) {
      return { cls: "st-off", card: "", text: "○ arquivado" };
    }
    return key
      ? { cls: "st-off", card: "", text: `○ ${key}` }
      : { cls: "st-off", card: "", text: "○ sem status" };
  }

  const state = {
    projects: [],
    tipo: "",
    tags: new Set(),
    query: "",
  };

  function cardHTML(p, index) {
    const t = tipoInfo(p.tipo);
    const st = statusInfo(p.status);
    const id = `p-${slug(p.nome)}-${index}`;
    const img = safeUrl(p.imagem);
    const demo = safeUrl(p.demo);
    const repo = safeUrl(p.repo);
    const imgSrc = img ? relativePath(img) : "";
    const alt = `Prévia do projeto ${p.nome}`;

    // tags + metadados extras viram chips monoespaçados
    const tags = [
      ...p.tags,
      ...Object.entries(p.extra || {}).map(([k, v]) => `${k}: ${v}`),
    ];

    return `
    <article class="project card${p.destaque ? " is-featured" : ""}" id="${id}"
      data-tipo="${esc(slug(p.tipo))}" data-tags="${esc(p.tags.map((x) => slug(x)).join(" "))}"
      aria-labelledby="${id}-nome" style="--reveal-delay:${Math.min(index, 6)}">
      <div class="project-inner">
        <header class="project-head">
          <span class="project-icon" aria-hidden="true">${esc(t.icon)}</span>
          <div class="project-title">
            <h3 class="project-name" id="${id}-nome">${esc(p.nome)}</h3>
            <p class="project-path">~/projetos/${esc(slug(p.nome))}</p>
          </div>
          <span class="project-label mono">${esc(t.label)}</span>
        </header>

        ${imgSrc ? `
        <figure class="project-media">
          <img src="${esc(imgSrc)}" alt="${esc(alt)}" loading="lazy" decoding="async"
               onerror="this.closest('.project-media').remove()">
        </figure>` : ""}

        ${p.descricao ? `
        <div class="project-desc">
          <p class="mono" style="font-size:11px;color:var(--fg-dim);margin:0 0 6px">$ cat README.md</p>
          ${md(p.descricao)}
        </div>` : `
        <div class="project-desc"><p class="muted">Sem descrição (ainda).</p></div>`}

        ${tags.length ? `
        <ul class="project-tags" aria-label="Tags do projeto">
          ${tags.map((tag) => `<li class="tag mono" style="list-style:none">${esc(tag)}</li>`).join("")}
        </ul>` : ""}

        <footer class="project-foot">
          ${demo ? `<a class="btn btn-primary" href="${esc(demo)}" target="_blank" rel="noopener noreferrer">demo ↗</a>` : ""}
          ${repo ? `<a class="btn btn-ghost" href="${esc(repo)}" target="_blank" rel="noopener noreferrer">repo ↗</a>` : ""}
          <span class="project-status mono ${st.card}">${esc(st.text)}</span>
        </footer>
      </div>
    </article>`;
  }

  function renderProjects() {
    const grid = $("#projetos-grid");
    if (!grid) return;

    grid.innerHTML = state.projects.map(cardHTML).join("");

    // as tags dos cards também filtram
    $$(".tag", grid).forEach((tagEl) => {
      const text = tagEl.textContent.split(":")[0].trim();
      const key = slug(text);
      const hasTag = state.projects.some((p) =>
        p.tags.some((t) => slug(t) === key)
      );
      if (!hasTag) {
        tagEl.classList.remove("tag");
        tagEl.style.cursor = "default";
        return;
      }
      tagEl.setAttribute("role", "button");
      tagEl.setAttribute("tabindex", "0");
      tagEl.title = `Filtrar por ${text}`;
      const activate = () => {
        state.tags = new Set([key]);
        renderFilterChips();
        applyFilters();
        const chips = $("#chips-tag");
        if (chips) chips.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      };
      tagEl.addEventListener("click", activate);
      tagEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
      });
    });

    observeCards();
    applyTilt();
  }

  /* ----------------------------------------------------------- filtros -- */

  function buildFilterChips() {
    const tipos = new Map();
    const tags = new Map();

    state.projects.forEach((p) => {
      const k = slug(p.tipo || "outro");
      const label = p.tipo || "outro";
      if (!tipos.has(k)) tipos.set(k, { label: tipoInfo(p.tipo).label, n: 0 });
      tipos.get(k).n++;
      p.tags.forEach((tag) => {
        const tk = slug(tag);
        if (!tags.has(tk)) tags.set(tk, { label: tag, n: 0 });
        tags.get(tk).n++;
      });
    });

    state._tipos = tipos;
    state._tags = tags;
    renderFilterChips();
  }

  function renderFilterChips() {
    const tiposEl = $("#chips-tipo");
    const tagsEl = $("#chips-tag");
    if (!tiposEl || !tagsEl || !state._tipos) return;

    const mkChip = (key, label, n, active, attr) =>
      `<button type="button" class="chip" ${attr}="${esc(key)}"
        aria-pressed="${active}" data-key="${esc(key)}">${esc(label)}<span class="chip-count">${n}</span></button>`;

    const nAll = state.projects.length;
    tiposEl.innerHTML =
      mkChip("", "todos", nAll, state.tipo === "", "data-tipo") +
      Array.from(state._tipos.entries())
        .map(([k, v]) => mkChip(k, v.label, v.n, state.tipo === k, "data-tipo"))
        .join("");

    const allTagsActive = state.tags.size === 0;
    tagsEl.innerHTML =
      mkChip("", "todas", nAll, allTagsActive, "data-tag") +
      Array.from(state._tags.entries())
        .map(([k, v]) => mkChip(k, v.label, v.n, state.tags.has(k), "data-tag"))
        .join("");

    $$("[data-tipo]", tiposEl).forEach((btn) => {
      btn.addEventListener("click", () => {
        state.tipo = btn.dataset.tipo;
        renderFilterChips();
        applyFilters();
      });
    });
    $$("[data-tag]", tagsEl).forEach((btn) => {
      btn.addEventListener("click", () => {
        const k = btn.dataset.tag;
        if (!k) state.tags.clear();
        else if (state.tags.has(k)) state.tags.delete(k);
        else state.tags.add(k);
        renderFilterChips();
        applyFilters();
      });
    });
  }

  function applyFilters() {
    const grid = $("#projetos-grid");
    if (!grid) return;
    let visible = 0;

    $$(".project", grid).forEach((el) => {
      const tipo = el.dataset.tipo || "";
      const tags = (el.dataset.tags || "").split(" ").filter(Boolean);
      const okTipo = !state.tipo || tipo === state.tipo;
      const okTags = state.tags.size === 0 || [...state.tags].every((t) => tags.includes(t));
      const show = okTipo && okTags;
      el.hidden = !show;
      if (show) {
        visible++;
        if (!reduceMotion) {
          el.animate(
            [
              { opacity: 0, transform: "translateY(10px) scale(0.985)" },
              { opacity: 1, transform: "none" },
            ],
            { duration: 280, easing: "cubic-bezier(.2,.7,.2,1)" }
          );
        }
      }
    });

    const empty = $("#filter-empty");
    if (empty) {
      const hasFilter = state.tipo || state.tags.size;
      empty.hidden = !(hasFilter && visible === 0);
      if (!empty.hidden) {
        empty.textContent = "// nenhum projeto com esses filtros. limpe para ver tudo.";
      }
    }
  }

  /* ----------------------------------------------------- tilt/spotlight -- */

  function attachPointer(el) {
    if (el._pointerBound || reduceMotion) return;
    el._pointerBound = true;
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      el.style.setProperty("--mx", `${(px * 100).toFixed(2)}%`);
      el.style.setProperty("--my", `${(py * 100).toFixed(2)}%`);
      if (!el._tilt) {
        const rx = (py - 0.5) * -4;
        const ry = (px - 0.5) * 4;
        el.style.transform = `perspective(1100px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-2px)`;
      }
    });
    el.addEventListener("pointerleave", () => {
      el.style.transform = "";
    });
  }

  function applyTilt() {
    $$(".project").forEach(attachPointer);
  }

  function observeCards() {
    const cards = $$(".project");
    if (reduceMotion || !("IntersectionObserver" in window)) {
      cards.forEach((c) => c.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    cards.forEach((c) => {
      c.classList.remove("is-in");
      io.observe(c);
    });
  }

  function observeReveals() {
    const items = $$(".reveal");
    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach((i) => i.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -30px 0px" }
    );
    items.forEach((i) => io.observe(i));
  }

  /* --------------------------------------------------------- hero/term -- */

  function typewriter(el, text, speed = 34) {
    if (reduceMotion) { el.textContent = text; return Promise.resolve(); }
    return new Promise((resolve) => {
      let i = 0;
      el.textContent = "";
      const tick = () => {
        if (i >= text.length) return resolve();
        el.textContent += text[i++];
        setTimeout(tick, speed + Math.random() * 26);
      };
      tick();
    });
  }

  async function bootHero(projects, site) {
    const treeEl = $("#hero-tree");
    const statusEl = $("#hero-status");
    const countEl = $("#hero-count");
    const termEl = $("#hero-terminal");

    const nGames = projects.filter((p) => /jogo|game/i.test(p.tipo)).length;
    const nOnline = projects.filter((p) => statusInfo(p.status).cls === "st-online").length;

    if (treeEl) {
      treeEl.innerHTML = projects.length
        ? projects
            .map(
              (p, i) =>
                `<li class="${i === 0 ? "is-active" : ""}">${esc(slug(p.nome))}/</li>`
            )
            .join("")
        : `<li class="is-loading">vazio</li>`;
    }

    if (statusEl) {
      statusEl.innerHTML = projects.length
        ? projects
            .slice(0, 5)
            .map((p) => {
              const st = statusInfo(p.status);
              return `<li><span>${esc(p.nome)}</span><span class="st ${st.cls}">${esc(st.text)}</span></li>`;
            })
            .join("")
        : `<li><span class="st st-off">nenhum projeto ainda</span></li>`;
    }

    if (countEl) {
      countEl.textContent = `${projects.length} projeto${projects.length === 1 ? "" : "s"} · ${nGames} jogo${nGames === 1 ? "" : "s"}`;
    }

    if (!termEl) return;

    const user = githubUser(site.github) || "usuario";
    const lines = [
      { html: `<span class="t-prompt">${esc(user)}@portfolio</span> <span class="t-path">~</span> $ `, text: "ls projetos/", cls: "t-cmd" },
      { html: "", text: projects.length ? projects.map((p) => slug(p.nome)).join("  ") : "(vazio)", cls: "t-dim" },
      { html: `<span class="t-prompt">${esc(user)}@portfolio</span> <span class="t-path">~</span> $ `, text: `git status --short`, cls: "t-cmd" },
      { html: "", text: `${nOnline} online · ${projects.length - nOnline} em andamento/arquivado`, cls: "t-ok" },
      { html: `<span class="t-prompt">${esc(user)}@portfolio</span> <span class="t-path">~</span> $ `, text: "echo \"bem-vindo(a) 👋\"", cls: "t-cmd" },
    ];

    if (reduceMotion) {
      termEl.innerHTML = `<div class="t-line">${esc(lines.map((l) => l.text).join("\n")).replace(/\n/g, "<br>")}</div>`;
      return;
    }

    termEl.innerHTML = "";
    let current = null;
    for (const line of lines) {
      current = document.createElement("div");
      current.className = `t-line ${line.cls || ""}`;
      current.innerHTML = line.html || "";
      termEl.appendChild(current);
      const span = document.createElement("span");
      current.appendChild(span);
      await typewriter(span, line.text, line.html ? 40 : 14);
      await new Promise((r) => setTimeout(r, 180));
    }
    if (current) {
      const prompt = document.createElement("div");
      prompt.className = "t-line";
      prompt.innerHTML = `<span class="t-prompt">${esc(user)}@portfolio</span> <span class="t-path">~</span> $ <span class="cursor-blink" aria-hidden="true">▌</span>`;
      termEl.appendChild(prompt);
    }
  }

  /* ------------------------------------------------------------ temas -- */

  const TEMAS = [
    { id: "dark", nome: "Escuro", kind: "escuro", sw: ["#0b0d10", "#7dd3fc", "#a78bfa"] },
    { id: "light", nome: "Claro", kind: "claro", sw: ["#f7f8fa", "#0369a1", "#7c3aed"] },
    { id: "dracula", nome: "Dracula", kind: "escuro", sw: ["#282a36", "#ff79c6", "#bd93f9"] },
    { id: "nord", nome: "Nord", kind: "escuro", sw: ["#2e3440", "#88c0d0", "#b48ead"] },
    { id: "gruvbox", nome: "Gruvbox", kind: "escuro", sw: ["#282828", "#fabd2f", "#d3869b"] },
    { id: "solarized", nome: "Solarized", kind: "escuro", sw: ["#002b36", "#2aa198", "#6c71c4"] },
    { id: "tokyo-night", nome: "Tokyo Night", kind: "escuro", sw: ["#1a1b26", "#7aa2f7", "#bb9af7"] },
    { id: "min-dark", nome: "Min Dark", kind: "escuro", sw: ["#0f0f0f", "#d4d4d4", "#6f6f6f"] },
    { id: "min-light", nome: "Min Light", kind: "claro", sw: ["#fafafa", "#141414", "#8a8a8a"] },
  ];
  const TEMA_IDS = new Set(TEMAS.map((t) => t.id));
  const STORAGE_KEY = "portfolio:tema";

  function readSavedTheme() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v && TEMA_IDS.has(v) ? v : "";
    } catch (_) {
      return "";
    }
  }

  function saveTheme(id) {
    try { localStorage.setItem(STORAGE_KEY, id); } catch (_) { /* sem storage, tudo bem */ }
  }

  function isLight(id) { return id === "light" || id === "min-light"; }

  /**
   * Preferência do sistema. Lida via CSS (media query), que é síncrona e sempre
   * atualizada — mais confiável que matchMedia em algumas situações.
   * Retorna "light" ou "dark".
   */
  function systemTheme() {
    try {
      const probe = document.createElement("div");
      probe.id = "__sysprobe";
      probe.setAttribute("aria-hidden", "true");
      probe.style.cssText =
        "position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none;";
      const style = document.createElement("style");
      style.textContent = "@media (prefers-color-scheme: light){#__sysprobe{--sys:light}}";
      probe.appendChild(style);
      document.documentElement.appendChild(probe);
      const val = getComputedStyle(probe).getPropertyValue("--sys").trim();
      probe.remove();
      if (val === "light") return "light";
      if (val === "dark") return "dark";
    } catch (_) {
      /* segue para o fallback */
    }
    try {
      return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    } catch (_) {
      return "dark";
    }
  }

  function applyTheme(id, { save = true } = {}) {
    const tema = TEMA_IDS.has(id) ? id : "dark";
    document.documentElement.setAttribute("data-tema", tema);
    document.documentElement.dataset.tema = tema;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const t = TEMAS.find((x) => x.id === tema);
      if (t) meta.setAttribute("content", t.sw[0]);
    }
    setText("conta-modo", isLight(tema) ? "claro" : "escuro");
    $$(".theme-card").forEach((el) => {
      el.setAttribute("aria-checked", String(el.dataset.tema === tema));
    });
    if (save) saveTheme(tema);
  }

  function buildThemeGrid() {
    const grid = $("#theme-grid");
    if (!grid) return;

    grid.innerHTML = TEMAS.map(
      (t) => `
      <button type="button" class="theme-card" role="radio" aria-checked="false"
        data-tema="${t.id}" title="Tema ${t.nome}">
        <span class="theme-swatches" aria-hidden="true">
          ${t.sw.map((c) => `<i style="background:${c}"></i>`).join("")}
        </span>
        <span class="theme-name">${t.nome}</span>
        <span class="theme-kind">${t.kind}</span>
      </button>`
    ).join("");

    grid.addEventListener("click", (e) => {
      const card = e.target.closest(".theme-card");
      if (!card) return;
      applyTheme(card.dataset.tema);
    });

    // navegação por setas (radiogroup)
    grid.addEventListener("keydown", (e) => {
      if (!["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      const cards = $$(".theme-card", grid);
      const i = cards.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
      const next = cards[(i + dir + cards.length) % cards.length];
      next.focus();
      applyTheme(next.dataset.tema);
    });
  }

  function initTheme() {
    buildThemeGrid();

    const saved = readSavedTheme();
    let initial = saved;

    // site.md decide o padrão, com esta precedência:
    //   1. escolha salva no navegador (localStorage)
    //   2. tema definido em site.md ("auto" = seguir o sistema)
    //   3. preferência do sistema
    const fromSite = state.site && state.site.tema ? String(state.site.tema).trim().toLowerCase() : "";
    const auto = fromSite === "" || ["auto", "sistema", "system", "padrao", "padrão"].includes(fromSite);
    if (!saved) {
      initial = auto ? systemTheme() : (TEMA_IDS.has(fromSite) ? fromSite : systemTheme());
    }

    applyTheme(initial, { save: Boolean(saved) });

    // atalho "T": alterna escuro/claro
    document.addEventListener("keydown", (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "t" || e.key === "T") {
        const atual = document.documentElement.getAttribute("data-tema");
        applyTheme(isLight(atual) ? "dark" : "light");
      }
    });
  }

  /* ------------------------------------------------------- site/bio ---- */

  function applySite(site) {
    const nome = site.nome || SITE_DEFAULTS.nome;
    const tagline = site.tagline || SITE_DEFAULTS.tagline;
    const email = site.email || "";
    const github = site.github || "";

    document.title = `${nome} — portfólio`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", `${nome} — ${tagline}. Projetos, demos e repositórios.`);
    ["og:title", "twitter:title"].forEach((p) => {
      const m = document.querySelector(`meta[property="${p}"], meta[name="${p}"]`);
      if (m) m.setAttribute("content", `${nome} — portfólio`);
    });
    ["og:description", "twitter:description"].forEach((p) => {
      const m = document.querySelector(`meta[property="${p}"], meta[name="${p}"]`);
      if (m) m.setAttribute("content", tagline);
    });

    //setText("hero-nome", firstName(nome).toUpperCase());
    setText("logo-mark", monogram(nome));
    setText("footer-mark", monogram(nome));
    setText("avatar", monogram(nome));
    setText("conta-nome", nome);
    setText("footer-nome", nome);
    setText("footer-tagline", tagline);
    const tagEl = $("#hero-tagline");
    if (tagEl) tagEl.dataset.full = tagline;
    setText("ano", String(new Date().getFullYear()));

    const user = githubUser(github);
    if (user) {
      setText("conta-user", `@${user}`);
    } else if (email) {
      setText("conta-user", email);
    }

    const ghLink = $("#link-github");
    if (ghLink) {
      if (github) {
        ghLink.href = github;
        ghLink.target = "_blank";
        ghLink.rel = "noopener noreferrer";
      } else {
        ghLink.removeAttribute("href");
        ghLink.style.opacity = ".5";
        ghLink.setAttribute("aria-disabled", "true");
      }
    }
    const fGh = $("#footer-github");
    if (fGh && github) { fGh.href = github; fGh.target = "_blank"; fGh.rel = "noopener noreferrer"; }

    const mail = email ? `mailto:${email}` : "";
    ["#link-contato", "#link-contato-mobile"].forEach((sel) => {
      const el = $(sel);
      if (el && mail) el.href = mail;
    });
    const contaEmail = $("#conta-email");
    if (contaEmail && mail) {
      contaEmail.href = mail;
      contaEmail.textContent = "email ↗";
    } else if (contaEmail) {
      contaEmail.remove();
    }
    const fEmail = $("#footer-email");
    if (fEmail) {
      if (mail) { fEmail.href = mail; fEmail.textContent = email; }
      else fEmail.remove();
    }
    const contaGh = $("#conta-github");
    if (contaGh) {
      if (github) {
        contaGh.href = github;
        contaGh.target = "_blank";
        contaGh.rel = "noopener noreferrer";
      } else {
        contaGh.remove();
      }
    }
  }

  async function renderBio() {
    const el = $("#bio");
    if (!el) return;
    try {
      const text = await loadText("./content/bio.md");
      el.innerHTML = md(text);
    } catch (_) {
      el.innerHTML = "";
      showLoadError(el, "a bio (content/bio.md)");
    }
  }

  /* --------------------------------------------------------- efeitos -- */

  function initHeader() {
    const header = $(".header");
    const onScroll = () => {
      if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const btn = $("#btn-menu");
    const nav = $("#nav-mobile");
    if (btn && nav) {
      btn.addEventListener("click", () => {
        const open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!open));
        btn.setAttribute("aria-label", open ? "Abrir menu" : "Fechar menu");
        nav.hidden = open;
        nav.style.display = open ? "" : "flex";
      });
      $$("a", nav).forEach((a) =>
        a.addEventListener("click", () => {
          btn.setAttribute("aria-expanded", "false");
          nav.hidden = true;
          nav.style.display = "";
        })
      );
    }
  }

  function initScrollSpy() {
    const links = $$(".nav a");
    const sections = links
      .map((a) => document.getElementById(a.getAttribute("href").slice(1)))
      .filter(Boolean);
    if (!sections.length || !("IntersectionObserver" in window)) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach((l) =>
            l.classList.toggle("is-active", l.getAttribute("href") === `#${entry.target.id}`)
          );
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach((s) => io.observe(s));
  }

  /* ------------------------------------------------------------ boot --- */

  async function boot() {
    initHeader();
    initScrollSpy();
    observeReveals();

    // ---- site.md ----
    state.site = { ...SITE_DEFAULTS };
    try {
      const text = await loadText("./content/site.md");
      state.site = { ...SITE_DEFAULTS, ...parseSiteMd(text) };
    } catch (_) {
      // usa defaults; o site continua usável
    }
    applySite(state.site);
    initTheme();

    // ---- projects.md ----
    try {
      const text = await loadText("./content/projects.md");
      state.projects = parseProjects(text);
      if (!state.projects.length) {
        const grid = $("#projetos-grid");
        if (grid) {
          grid.innerHTML = `<div class="aviso">
            <strong>Nenhum projeto encontrado.</strong>
            <p>Abra <code>content/projects.md</code> e adicione um bloco começando com
            <code>## Nome do projeto</code> seguido das linhas de metadados.</p>
          </div>`;
        }
        await bootHero([], state.site);
        return;
      }
      buildFilterChips();
      renderProjects();
      applyFilters();
      await bootHero(state.projects, state.site);
    } catch (_) {
      showLoadError($("#projetos-grid"), "os projetos (content/projects.md)");
      const tree = $("#hero-tree");
      if (tree) tree.innerHTML = `<li class="is-loading">indisponível</li>`;
      const st = $("#hero-status");
      if (st) st.innerHTML = `<li><span class="st st-off">--</span></li>`;
      const term = $("#hero-terminal");
      if (term) term.innerHTML = `<div class="t-line t-warn"># erro ao carregar content/projects.md</div>`;
    }

    // ---- bio.md ----
    await renderBio();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();