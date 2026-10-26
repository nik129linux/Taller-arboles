const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const motion = (seconds) => (reduceMotion ? 0 : seconds);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, reduceMotion ? 0 : ms));
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

async function api(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || response.status), { status: response.status, body });
  return body;
}

const send = (url, method, payload) =>
  api(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });

const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

gsap.registerPlugin(ScrollTrigger);

let lenis = null;
if (!reduceMotion && window.Lenis) {
  lenis = new Lenis({ lerp: 0.09 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

document.addEventListener("click", (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link) return;
  event.preventDefault();
  const target = $(link.getAttribute("href"));
  if (lenis) lenis.scrollTo(target, { offset: -80 });
  else target.scrollIntoView();
});

const photoCache = new Map();

function photoUrl(title) {
  if (!photoCache.has(title)) {
    const page = encodeURIComponent(title.replace(/ /g, "_"));
    photoCache.set(
      title,
      api(`https://en.wikipedia.org/api/rest_v1/page/summary/${page}`)
        .then((data) => (data.thumbnail || data.originalimage || {}).source || null)
        .then((src) => (src ? src.replace(/\/\d+px-/, "/800px-") : null))
        .catch(() => null)
    );
  }
  return photoCache.get(title);
}

function loadPhoto(element, title) {
  photoUrl(title).then((src) => {
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      element.style.backgroundImage = `url("${src}")`;
      element.textContent = "";
    };
    img.src = src;
  });
}

function splitWords(element) {
  element.innerHTML = element.innerHTML
    .split(/(<[^>]+>|\s+)/)
    .map((part) => (!part.trim() || part.startsWith("<") ? part : `<span class="word"><span>${part}</span></span>`))
    .join("");
}

function initCursor() {
  if (!finePointer || reduceMotion) return;
  const cursor = $(".cursor");
  const moveX = gsap.quickTo(cursor, "x", { duration: 0.25, ease: "power3" });
  const moveY = gsap.quickTo(cursor, "y", { duration: 0.25, ease: "power3" });
  window.addEventListener("pointermove", (event) => {
    cursor.classList.add("is-visible");
    moveX(event.clientX);
    moveY(event.clientY);
    cursor.classList.toggle("is-big", Boolean(event.target.closest("a, button, .card, .tree-node, input")));
  });
  document.addEventListener("pointerleave", () => cursor.classList.remove("is-visible"));
}

function initMagnetic() {
  if (!finePointer || reduceMotion) return;
  $$(".magnetic").forEach((element) => {
    const moveX = gsap.quickTo(element, "x", { duration: 0.4, ease: "power3" });
    const moveY = gsap.quickTo(element, "y", { duration: 0.4, ease: "power3" });
    element.addEventListener("pointermove", (event) => {
      const box = element.getBoundingClientRect();
      moveX((event.clientX - box.left - box.width / 2) * 0.3);
      moveY((event.clientY - box.top - box.height / 2) * 0.3);
    });
    element.addEventListener("pointerleave", () => {
      moveX(0);
      moveY(0);
    });
  });
}

function initGlow() {
  document.addEventListener("pointermove", (event) => {
    const panel = event.target.closest(".glow");
    if (!panel) return;
    const box = panel.getBoundingClientRect();
    panel.style.setProperty("--mx", `${event.clientX - box.left}px`);
    panel.style.setProperty("--my", `${event.clientY - box.top}px`);
  });
}

function initHero() {
  $$(".hero [data-photo]").forEach((element) => loadPhoto(element, element.dataset.photo));
  const timeline = gsap.timeline({ defaults: { ease: "power4.out" } });
  timeline
    .from(".hero .tag", { y: 20, opacity: 0, duration: motion(0.6) })
    .from(".hero__title .line > span", { yPercent: 110, duration: motion(1.1), stagger: motion(0.12) }, "-=0.3")
    .from(".hero__lead, .hero__actions, .hero__chips", { y: 30, opacity: 0, stagger: motion(0.12), duration: motion(0.8) }, "-=0.7")
    .from(".shot", { clipPath: "inset(100% 0 0 0)", stagger: motion(0.15), duration: motion(1.2) }, 0.2)
    .from(".shot .photo", { scale: 1.4, stagger: motion(0.15), duration: motion(1.6) }, 0.2);

  [[".shot--1", -40], [".shot--2", -110], [".shot--3", -70]].forEach(([selector, distance]) => {
    gsap.to(selector, {
      y: distance,
      ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
    });
  });
}

function initMarquee() {
  const tween = gsap.to(".marquee__track", { xPercent: -50, duration: 28, ease: "none", repeat: -1 });
  if (reduceMotion) {
    tween.pause();
    return;
  }
  ScrollTrigger.create({
    onUpdate: (self) => {
      const boost = gsap.utils.clamp(1, 6, Math.abs(self.getVelocity()) / 300);
      gsap.to(tween, { timeScale: self.direction * boost, duration: 0.2, overwrite: true });
      gsap.to(tween, { timeScale: self.direction, duration: 1.2, delay: 0.2 });
    },
  });
}

function initChrome() {
  gsap.to(".progress span", { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });
}

function initSplitHeadings() {
  $$(".split").forEach((heading) => {
    splitWords(heading);
    gsap.from($$(".word > span", heading), {
      yPercent: 110,
      duration: motion(0.9),
      stagger: motion(0.06),
      ease: "power4.out",
      scrollTrigger: { trigger: heading, start: "top 85%", once: true },
    });
  });
}

function initConcept() {
  const svg = $(".concept__svg");
  const terms = $$(".terms li");
  const strokes = $$(".edges path, .height-mark path, .depth-mark path", svg);
  strokes.forEach((path) => {
    const length = path.getTotalLength();
    gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
  });
  gsap.set($$("circle", svg), { scale: 0, transformOrigin: "50% 50%" });
  gsap.set($$("text", svg), { opacity: 0 });

  const setStep = (step) => terms.forEach((term, i) => term.classList.toggle("is-active", i === step));
  setStep(0);

  const timeline = gsap.timeline({
    defaults: { ease: "power2.out" },
    scrollTrigger: {
      trigger: ".concept",
      start: "top top",
      end: "+=2200",
      scrub: 0.6,
      pin: ".concept__pin",
      onUpdate: (self) => setStep(Math.min(terms.length - 1, Math.floor(self.progress * terms.length))),
    },
  });
  timeline
    .to($(".n-root", svg), { scale: 1, duration: 1 })
    .to($$(".n-inner", svg), { scale: 1, stagger: 0.3, duration: 1 })
    .to($$(".edges path", svg), { strokeDashoffset: 0, stagger: 0.15, duration: 1 })
    .to($$(".n-leaf", svg), { scale: 1, stagger: 0.2, duration: 1 })
    .to($(".degree-mark text", svg), { opacity: 1, duration: 0.8 })
    .to($$(".levels text", svg), { opacity: 1, stagger: 0.2, duration: 0.6 })
    .to($(".depth-mark path", svg), { strokeDashoffset: 0, duration: 0.8 }, "<")
    .to($(".depth-mark text", svg), { opacity: 1, duration: 0.5 })
    .to($(".height-mark path", svg), { strokeDashoffset: 0, duration: 1 })
    .to($(".height-mark text", svg), { opacity: 1, duration: 0.5 });
}

function initReveals() {
  gsap.set(".reveal", { y: 40, opacity: 0 });
  ScrollTrigger.batch(".reveal", {
    start: "top 90%",
    once: true,
    onEnter: (batch) => gsap.to(batch, { y: 0, opacity: 1, stagger: motion(0.1), duration: motion(0.9), ease: "power3.out" }),
  });
}

const rankColor = {
  root: "var(--c-root)",
  order: "var(--c-order)",
  family: "var(--c-family)",
  genus: "var(--c-genus)",
  species: "var(--c-species)",
};
const rankLabel = { root: "Raíz", order: "Orden", family: "Familia", genus: "Género", species: "Especie" };
const state = { species: [], speciesByName: new Map(), taxonomy: null };

function createTaxonomy(data) {
  const svg = d3.select("#taxonomy-svg");
  svg.selectAll("*").remove();
  const margin = { top: 20, right: 150, bottom: 20, left: 150 };
  const nodeGap = 30;
  const levelGap = 150;
  const duration = motion(0.6) * 1000;
  const linkPath = d3.linkHorizontal().x((d) => d.y).y((d) => d.x);
  const root = d3.hierarchy(data);
  root.x0 = 0;
  root.y0 = 0;
  root.descendants().forEach((d) => (d.id = d.ancestors().map((a) => a.data.name).join("/")));

  const linkLayer = svg.append("g");
  const nodeLayer = svg.append("g");
  let hot = new Set();
  let selected = null;

  function update(source) {
    d3.tree().nodeSize([nodeGap, levelGap])(root);
    const nodes = root.descendants();
    const [minX, maxX] = d3.extent(nodes, (d) => d.x);
    const height = maxX - minX + margin.top + margin.bottom;
    const width = (root.height || 1) * levelGap + margin.left + margin.right;
    const offset = `translate(${margin.left},${margin.top - minX})`;
    svg.transition().duration(duration).attr("width", width).attr("height", height);
    linkLayer.transition().duration(duration).attr("transform", offset);
    nodeLayer.transition().duration(duration).attr("transform", offset);

    const node = nodeLayer.selectAll("g.tree-node").data(nodes, (d) => d.id);
    const enter = node.enter().append("g")
      .attr("class", (d) => `tree-node ${d.data.rank}`)
      .attr("transform", `translate(${source.y0},${source.x0})`)
      .attr("opacity", 0)
      .on("click", (event, d) => onClick(d));
    enter.append("circle").attr("r", (d) => (d.data.rank === "root" ? 10 : 7)).style("fill", (d) => rankColor[d.data.rank]);
    enter.append("text")
      .attr("dy", "0.32em")
      .attr("x", (d) => (d.children || d._children ? -12 : 12))
      .attr("text-anchor", (d) => (d.children || d._children ? "end" : "start"))
      .text((d) => d.data.common_name || d.data.name);
    enter.append("title").text((d) => `${rankLabel[d.data.rank]}: ${d.data.name}`);

    const merged = enter.merge(node);
    merged
      .classed("is-collapsed", (d) => Boolean(d._children))
      .classed("is-hot", (d) => hot.has(d.id))
      .classed("is-selected", (d) => d === selected);
    merged.transition().duration(duration).attr("transform", (d) => `translate(${d.y},${d.x})`).attr("opacity", 1);
    node.exit().transition().duration(duration).attr("transform", `translate(${source.y},${source.x})`).attr("opacity", 0).remove();

    const link = linkLayer.selectAll("path.tree-link").data(root.links(), (d) => d.target.id);
    const linkEnter = link.enter().insert("path").attr("class", "tree-link").attr("d", () => {
      const point = { x: source.x0, y: source.y0 };
      return linkPath({ source: point, target: point });
    });
    linkEnter.merge(link)
      .classed("is-hot", (d) => hot.has(d.target.id))
      .transition().duration(duration).attr("d", linkPath);
    link.exit().transition().duration(duration).attr("d", () => {
      const point = { x: source.x, y: source.y };
      return linkPath({ source: point, target: point });
    }).remove();

    nodes.forEach((d) => {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }

  function select(d) {
    selected = d;
    hot = new Set(d.ancestors().map((a) => a.id));
    showNodeInfo(d.data.name);
  }

  function onClick(d) {
    if (d.data.rank !== "species" && d !== selected) {
      select(d);
    } else if (d.children) {
      d._children = d.children;
      d.children = null;
    } else if (d._children) {
      d.children = d._children;
      d._children = null;
    } else {
      select(d);
    }
    update(d);
  }

  update(root);

  return {
    focus(name) {
      const target = root.descendants().find((d) => d.data.name === name);
      if (!target) return;
      select(target);
      update(target);
    },
  };
}

async function showNodeInfo(name) {
  const panel = $("#node-panel");
  const info = await api(`/api/node/${encodeURIComponent(name)}`);
  const species = state.speciesByName.get(name);
  $(".node-panel__name", panel).textContent = species ? species.common_name : info.name;
  $(".node-panel__rank", panel).textContent = species ? `${rankLabel[info.rank]} · ${info.name}` : rankLabel[info.rank];
  const facts = [
    ["Profundidad", info.depth],
    ["Nivel", info.level],
    ["Grado (hijos)", info.degree],
    ["Padre", info.parent || "—"],
    ["Hermanos", info.siblings.length],
    ["Descendientes", info.descendants],
    ["Altura del subárbol", info.subtree_height],
    ["Hojas debajo", info.leaves_below],
    ["¿Es hoja?", info.degree === 0 ? "Sí" : "No"],
  ];
  $(".node-panel__facts", panel).innerHTML = facts.map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(v)}</dd>`).join("");
  $(".node-panel__path", panel).innerHTML = info.path.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  const actions = $(".node-panel__actions", panel);
  actions.innerHTML = "";
  if (species) {
    const button = document.createElement("button");
    button.className = "btn btn--small";
    button.textContent = "Ver ficha";
    button.addEventListener("click", () => openModal(species));
    actions.append(button);
  }
  gsap.fromTo($$(".node-panel__facts > *, .node-panel__path li", panel), { opacity: 0, x: 8 }, { opacity: 1, x: 0, stagger: motion(0.02), duration: motion(0.3) });
}

function renderBST(svgSelector, data, { balance = false } = {}) {
  const svg = d3.select(svgSelector);
  svg.selectAll("*").remove();
  if (!data) {
    svg.attr("width", 300).attr("height", 60);
    svg.append("text").attr("x", 20).attr("y", 35).attr("class", "tree-node").text("Árbol vacío");
    return { byKey: new Map(), reset() {}, mark() {} };
  }
  const root = d3.hierarchy(data, (d) => d.children);
  const available = svg.node().parentNode.clientWidth || 900;
  const width = Math.max(available - 4, root.leaves().length * 72);
  const levelGap = 76;
  d3.tree().size([width - 80, Math.max(1, root.height) * levelGap])(root);
  const height = root.height * levelGap + 70;
  svg.attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);
  const g = svg.append("g").attr("transform", "translate(40,32)");

  const links = g.selectAll("path")
    .data(root.links())
    .join("path")
    .attr("class", (d) => `tree-link${d.target.data.empty ? " is-empty" : ""}`)
    .attr("d", d3.linkVertical().x((d) => d.x).y((d) => d.y));

  const nodes = g.selectAll("g")
    .data(root.descendants())
    .join("g")
    .attr("class", (d) => `tree-node bst-node${d.data.empty ? " is-empty" : ""}`)
    .attr("transform", (d) => `translate(${d.x},${d.y})`);
  nodes.append("circle").attr("r", 9);
  const order = new Map();
  d3.groups(root.descendants().filter((d) => !d.data.empty), (d) => d.depth).forEach(([, level]) => {
    level.sort((a, b) => a.x - b.x).forEach((d, i) => order.set(d, i));
  });
  nodes.append("text")
    .attr("dy", (d) => (order.get(d) % 2 ? "2em" : "-1.2em"))
    .attr("text-anchor", "middle")
    .text((d) => d.data.label || "");
  if (balance) {
    nodes.filter((d) => !d.data.empty).append("text")
      .attr("class", (d) => `balance${Math.abs(d.data.balance) > 0 ? " is-off" : ""}`)
      .attr("dy", "0.35em")
      .attr("x", 14)
      .text((d) => (d.data.balance > 0 ? `+${d.data.balance}` : d.data.balance));
  }

  const byKey = new Map();
  nodes.each(function (d) {
    if (!d.data.empty) byKey.set(d.data.name, { node: d3.select(this), datum: d });
  });
  return {
    byKey,
    reset() {
      nodes.classed("is-visited is-found is-removed is-new is-pivot", false);
      links.classed("is-hot", false);
    },
    mark(key, className) {
      const entry = byKey.get(key);
      if (!entry) return;
      entry.node.classed(className, true);
      links.filter((l) => l.target === entry.datum).classed("is-hot", true);
      if (!reduceMotion) {
        gsap.fromTo(entry.node.select("circle").node(), { attr: { r: 16 } }, { attr: { r: 9 }, duration: 0.5, ease: "back.out(3)" });
      }
    },
  };
}

const views = {};
let bstData = null;

const codeHighlights = {
  "bst.search": () => (line) => /visited\.append|return node, visited/.test(line),
  "bst.insert": () => (line) => /setattr\(node, side|self\.root = BSTNode/.test(line),
  "bst.delete": (result) => {
    const patterns = {
      leaf: /case = "leaf"|parent\.(left|right) = child|self\.root = child/,
      one_child: /case = "leaf" if|child = node\.left or node\.right|parent\.(left|right) = child/,
      two_children: /case = "two_children"|while succ\.left|successor = succ\.key|node\.key, node\.value = succ/,
    };
    return (line) => (patterns[result?.case] || /^$/).test(line);
  },
  "avl.rebalance": () => (line) => /rotations\.append|_rotate_(left|right)/.test(line),
};

function highlightPython(line) {
  return escapeHtml(line).replace(
    /(&quot;.*?&quot;|&#39;.*?&#39;)|\b(def|return|if|elif|else|while|for|in|not|and|or|is|None|True|False|self|class|lambda)\b|\b(\d+)\b|\b([a-z_]+)(?=\()/g,
    (match, str, keyword, number, fn) => {
      if (str) return `<span class="tok-s">${str}</span>`;
      if (keyword) return `<span class="tok-k">${keyword}</span>`;
      if (number) return `<span class="tok-n">${number}</span>`;
      return `<span class="tok-f">${fn}</span>`;
    }
  );
}

async function showCode(name, result) {
  const { code } = await api(`/api/source/${name}`);
  const isHot = (codeHighlights[name] || (() => () => false))(result);
  const lines = code.replace(/\s+$/, "").split("\n");
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  $("#code-title").textContent = `trees/${name.startsWith("avl") ? "avl" : "bst"}.py · ${name.split(".")[1]}()`;
  $("#code-body").innerHTML = lines
    .map((line, i) => `<span class="ln${isHot(line) ? " is-hot" : ""}" data-n="${i + 1}">${highlightPython(line.slice(indent)) || " "}</span>`)
    .join("");
  const first = $("#code-body .is-hot");
  if (first) first.parentElement.parentElement.scrollTop = first.offsetTop - 80;
  gsap.from("#code-body .ln", { opacity: 0, x: -6, stagger: motion(0.01), duration: motion(0.25) });
}

function setResult(html) {
  const out = $("#lab-result");
  out.innerHTML = html;
  gsap.from(out.children, { y: 10, opacity: 0, stagger: motion(0.08), duration: motion(0.35) });
}

async function animatePath(view, keys, finalClass) {
  for (const key of keys) {
    view.mark(key, "is-visited");
    await wait(420);
  }
  if (finalClass && keys.length) view.mark(keys.at(-1), finalClass);
}

function renderTrees(trees) {
  bstData = trees.bst;
  views.lab = renderBST("#bst-svg", trees.bst);
  views.traversal = renderBST("#traversal-svg", trees.bst);
  views.compare = renderBST("#bst-compare-svg", trees.bst);
  views.avl = renderBST("#avl-svg", trees.avl, { balance: true });
  $("#bst-height").textContent = trees.bst_height;
  $("#avl-height").textContent = trees.avl_height;
}

function renderRotations(rotations, fresh = []) {
  const freshSet = new Set(fresh.map((r) => JSON.stringify(r)));
  const names = { LL: "simple a la derecha", RR: "simple a la izquierda", LR: "doble izq-der", RL: "doble der-izq" };
  $("#rotation-count").textContent = rotations.length;
  $("#rotation-list").innerHTML = rotations
    .map((r) => `<li class="${freshSet.has(JSON.stringify(r)) ? "is-new" : ""}"><b>${r.type}</b>${names[r.type]} en «${escapeHtml(r.pivot)}» ${r.op === "delete" ? "al eliminar" : "al insertar"} «${escapeHtml(r.trigger)}»</li>`)
    .join("");
}

async function refreshAll({ rebuildTaxonomy = false, focus = null } = {}) {
  const [species, stats, avl, taxonomy] = await Promise.all([
    api("/api/species"),
    api("/api/stats"),
    api("/api/avl"),
    rebuildTaxonomy ? api("/api/taxonomy") : null,
  ]);
  state.species = species;
  state.speciesByName = new Map(species.map((s) => [s.scientific_name, s]));
  updateStats(stats);
  renderRotations(avl.rotations, avl.fresh);
  if (taxonomy) {
    state.taxonomy = createTaxonomy(taxonomy);
    if (focus) state.taxonomy.focus(focus);
  }
  updateDatalists();
}

function updateDatalists() {
  const unique = (key) => [...new Set(state.species.map((s) => s[key]))].sort();
  $("#orders").innerHTML = unique("order").map((v) => `<option value="${escapeHtml(v)}">`).join("");
  $("#families").innerHTML = unique("family").map((v) => `<option value="${escapeHtml(v)}">`).join("");
}

function initTabs() {
  const sources = { search: "bst.search", insert: "bst.insert", delete: "bst.delete" };
  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach((t) => t.classList.toggle("is-active", t === tab));
      $$(".tab-panel").forEach((p) => p.classList.toggle("is-active", p.dataset.panel === tab.dataset.tab));
      $("#lab-result").innerHTML = "";
      views.lab.reset();
      showCode(sources[tab.dataset.tab]);
    });
  });
}

function initLab() {
  let run = 0;
  const caseText = {
    leaf: ["Hoja", "El nodo no tenía hijos: simplemente se desconecta de su padre."],
    one_child: ["Un hijo", "El único hijo sube y ocupa el lugar del nodo eliminado."],
    two_children: ["Dos hijos", "Se reemplaza por su sucesor inorden (el menor del subárbol derecho) y luego se elimina el sucesor."],
  };

  $$("#search-input, #delete-input").forEach((input) => {
    input.addEventListener("input", async () => {
      if (!input.value.trim()) return;
      const result = await api(`/api/search?q=${encodeURIComponent(input.value)}`);
      $("#suggestions").innerHTML = result.suggestions.map((s) => `<option value="${escapeHtml(s.common_name)}">`).join("");
    });
  });

  $("#search-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const query = $("#search-input").value.trim();
    if (!query) return;
    const current = ++run;
    const result = await api(`/api/search?q=${encodeURIComponent(query)}`);
    views.lab.reset();
    setResult(`<p>Buscando «${escapeHtml(query)}»…</p>`);
    showCode("bst.search");
    await animatePath(views.lab, result.visited, result.found ? "is-found" : null);
    if (current !== run) return;
    if (result.found) {
      setResult(`
        <p class="ok"><strong>¡Encontrado!</strong> ${escapeHtml(result.species.common_name)} (<em>${escapeHtml(result.species.scientific_name)}</em>) · profundidad ${result.comparisons - 1}</p>
        <div class="compare">
          <span class="pill">BST: <b>${result.comparisons}</b> comparaciones</span>
          <span class="pill">Búsqueda lineal: <b>${result.linear_comparisons}</b> comparaciones</span>
        </div>`);
    } else {
      setResult(`<p class="ko"><strong>No está en el árbol.</strong> Se hicieron ${result.comparisons} comparaciones hasta llegar a un hijo vacío.</p>`);
    }
  });

  $("#delete-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const label = $("#delete-input").value.trim();
    if (!label) return;
    ++run;
    views.lab.reset();
    try {
      const result = await send(`/api/bst/${encodeURIComponent(label)}`, "DELETE");
      showCode("bst.delete", result);
      const successorLabel = result.successor && views.lab.byKey.get(result.successor)?.datum.data.label;
      await animatePath(views.lab, result.visited, "is-removed");
      if (result.successor) {
        views.lab.mark(result.successor, "is-pivot");
        await wait(700);
      }
      await wait(400);
      renderTrees(result);
      await refreshAll();
      const [title, text] = caseText[result.case];
      setResult(`
        <div class="case-card"><b>${title}</b><span>Se eliminó «${escapeHtml(result.deleted.common_name)}». ${text}${successorLabel ? ` Sucesor: «${escapeHtml(successorLabel)}».` : ""}</span></div>
        <p class="compare" style="margin-top:.6rem"><span class="pill">BST h=<b>${result.bst_height}</b></span><span class="pill pill--accent">AVL h=<b>${result.avl_height}</b></span><span class="pill">Rotaciones AVL: <b>${result.avl_rotations.length}</b></span></p>`);
      $("#delete-input").value = "";
    } catch (error) {
      await animatePath(views.lab, error.body?.visited || []);
      setResult(`<p class="ko"><strong>No se pudo eliminar:</strong> ${escapeHtml(error.message)}</p>`);
    }
  });

  const example = {
    common_name: "Chiminango",
    scientific_name: "Pithecellobium dulce",
    order: "Fabales",
    family: "Fabaceae",
    genus: "Pithecellobium",
    regions: "Andina, Caribe",
    height_m: 15,
    description: "Árbol de sombra muy común en el Valle del Cauca; sus vainas son comestibles.",
  };
  $("#fill-example").addEventListener("click", () => {
    const form = $("#insert-form");
    Object.entries(example).forEach(([name, value]) => (form.elements[name].value = value));
  });

  $("#insert-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    ++run;
    const payload = Object.fromEntries(new FormData(event.target).entries());
    try {
      const result = await send("/api/species", "POST", payload);
      renderTrees(result);
      showCode(result.rotations.length ? "avl.rebalance" : "bst.insert");
      await refreshAll({ rebuildTaxonomy: true, focus: result.species.scientific_name });
      renderRotations((await api("/api/avl")).rotations, result.rotations);
      addCard(result.species, true);
      await animatePath(views.lab, result.bst_visited, "is-new");
      const rotations = result.rotations.length
        ? result.rotations.map((r) => `<span class="pill pill--accent">${r.type} en «${escapeHtml(r.pivot)}»</span>`).join("")
        : `<span class="pill">El AVL no necesitó rotaciones</span>`;
      setResult(`
        <p class="ok"><strong>Insertado:</strong> ${escapeHtml(result.species.common_name)} · profundidad ${result.bst_visited.length - 1} en el BST</p>
        <p class="compare"><span class="pill">Ruta taxonómica: <b>${result.path.slice(1).map(escapeHtml).join(" → ")}</b></span></p>
        <p class="compare">${rotations}</p>`);
      event.target.reset();
    } catch (error) {
      const missing = error.body?.missing ? ` (${error.body.missing.join(", ")})` : "";
      setResult(`<p class="ko"><strong>No se pudo insertar:</strong> ${escapeHtml(error.message)}${missing}</p>`);
    }
  });

  $("#reset-btn").addEventListener("click", async () => {
    ++run;
    const trees = await send("/api/reset", "POST");
    renderTrees(trees);
    await refreshAll({ rebuildTaxonomy: true });
    renderGallery();
    setResult(`<p class="ok">Los árboles volvieron a su estado original.</p>`);
  });
}

function initTraversals() {
  const sequence = $("#sequence");
  const chips = $$(".chip[data-kind]");
  let run = 0;
  chips.forEach((chip) => {
    chip.addEventListener("click", async () => {
      chips.forEach((c) => c.classList.toggle("is-active", c === chip));
      const current = ++run;
      const { order } = await api(`/api/traversal/${chip.dataset.kind}?tree=bst`);
      const view = views.traversal;
      view.reset();
      sequence.innerHTML = "";
      for (const key of order) {
        if (current !== run) return;
        view.mark(key, "is-visited");
        const item = document.createElement("li");
        item.textContent = view.byKey.get(key)?.datum.data.label || key;
        sequence.append(item);
        gsap.from(item, { scale: 0.4, opacity: 0, duration: motion(0.35), ease: "back.out(2)" });
        await wait(360);
      }
    });
  });
}

const statValue = (path, stats) => path.split(".").reduce((obj, key) => obj?.[key], stats);

function updateStats(stats) {
  $$("[data-stat]").forEach((element) => {
    const value = statValue(element.dataset.stat, stats);
    if (element.dataset.count !== undefined && !element.dataset.done) {
      element.dataset.target = value;
      return;
    }
    element.textContent = value;
  });
}

function initCounters() {
  $$("[data-count]").forEach((element) => {
    ScrollTrigger.create({
      trigger: element,
      start: "top 90%",
      once: true,
      onEnter: () => {
        const counter = { value: 0 };
        gsap.to(counter, {
          value: Number(element.dataset.target || 0),
          duration: motion(1.6),
          ease: "power2.out",
          onUpdate: () => (element.textContent = Math.round(counter.value)),
          onComplete: () => {
            element.dataset.done = "1";
            element.textContent = element.dataset.target;
          },
        });
      },
    });
  });
}

function photoElement(species) {
  const element = document.createElement("div");
  element.className = "photo";
  element.textContent = "🌳";
  if (!species.custom) loadPhoto(element, species.scientific_name);
  return element;
}

async function openModal(species) {
  const modal = $("#modal");
  $(".modal__img", modal).replaceChildren(photoElement(species));
  $(".modal__sci", modal).textContent = species.scientific_name;
  $(".modal__name", modal).textContent = species.common_name;
  $(".modal__desc", modal).textContent = species.description;
  $(".modal__facts", modal).innerHTML = `
    <dt>Familia</dt><dd>${escapeHtml(species.family)}</dd>
    <dt>Altura máx.</dt><dd>${escapeHtml(species.height_m)} m</dd>
    <dt>Regiones</dt><dd>${species.regions.map(escapeHtml).join(", ")}</dd>`;
  const pathList = $(".modal__path", modal);
  pathList.innerHTML = "";
  modal.showModal();
  const trail = await api(`/api/path/${encodeURIComponent(species.scientific_name)}`);
  pathList.innerHTML = trail.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  gsap.from(pathList.children, { x: -10, opacity: 0, stagger: motion(0.08), duration: motion(0.3) });
}

function initModal() {
  const modal = $("#modal");
  $(".modal__close", modal).addEventListener("click", () => modal.close());
  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.close();
  });
}

function addCard(item, isNew = false) {
  const gallery = $("#gallery");
  const card = document.createElement("button");
  card.className = "card";
  card.type = "button";
  const number = String(gallery.children.length + 1).padStart(2, "0");
  const media = document.createElement("div");
  media.className = "card__img";
  media.append(photoElement(item));
  const body = document.createElement("div");
  body.className = "card__body";
  const tags = [item.family, ...item.regions].map((t) => `<span class="tag-pill">${escapeHtml(t)}</span>`);
  if (isNew || item.custom) tags.unshift(`<span class="tag-pill tag-pill--new">Nueva</span>`);
  body.innerHTML = `
    <h3>${escapeHtml(item.common_name)}</h3>
    <p class="sci">${escapeHtml(item.scientific_name)}</p>
    <div class="tags">${tags.join("")}</div>`;
  card.innerHTML = `<span class="card__num">${number}</span>`;
  card.append(media, body);
  card.addEventListener("click", () => openModal(item));
  gallery.append(card);
  if (isNew) ScrollTrigger.refresh();
}

function renderGallery() {
  $("#gallery").innerHTML = "";
  state.species.forEach((item) => addCard(item));
}

function initGalleryMotion() {
  const media = gsap.matchMedia();
  media.add("(min-width: 861px) and (prefers-reduced-motion: no-preference)", () => {
    const gallery = $("#gallery");
    const distance = () => Math.max(0, gallery.scrollWidth - window.innerWidth);
    gsap.to(gallery, {
      x: () => -distance(),
      ease: "none",
      scrollTrigger: {
        trigger: ".gallery-pin",
        start: "top top",
        end: () => `+=${distance()}`,
        pin: true,
        scrub: 0.8,
        invalidateOnRefresh: true,
      },
    });
  });
  media.add("(max-width: 860px)", () => {
    ScrollTrigger.batch(".card", {
      start: "top 92%",
      onEnter: (batch) => gsap.fromTo(batch, { y: 50, opacity: 0 }, { y: 0, opacity: 1, stagger: motion(0.1), duration: motion(0.7) }),
    });
  });
}

async function main() {
  initCursor();
  initMagnetic();
  initGlow();
  initHero();
  initMarquee();
  initChrome();
  initSplitHeadings();
  initConcept();
  initModal();

  const [taxonomy, bst, avl] = await Promise.all([api("/api/taxonomy"), api("/api/bst"), api("/api/avl")]);
  renderTrees({ bst, avl: avl.tree, bst_height: avl.bst_height, avl_height: avl.height });
  await refreshAll();
  state.taxonomy = createTaxonomy(taxonomy);
  renderGallery();
  initTabs();
  initLab();
  initTraversals();
  initCounters();
  initGalleryMotion();
  initReveals();
  showCode("bst.search");
  ScrollTrigger.refresh();
}

main();
