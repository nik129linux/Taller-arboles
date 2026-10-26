const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const motion = (seconds) => (reduceMotion ? 0 : seconds);
const api = (url) => fetch(url).then((res) => (res.ok ? res.json() : Promise.reject(res.status)));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, reduceMotion ? 0 : ms));

gsap.registerPlugin(ScrollTrigger);

if (!reduceMotion && window.Lenis) {
  const lenis = new Lenis({ lerp: 0.09 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      lenis.scrollTo(link.getAttribute("href"), { offset: -60 });
    });
  });
}

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

function initHero() {
  const media = document.querySelector(".hero__media");
  loadPhoto(media, media.dataset.photo);

  const title = document.querySelector("[data-split]");
  title.innerHTML = title.textContent
    .split(" ")
    .map((word) => `<span class="word">${[...word].map((char) => `<span class="char">${char}</span>`).join("")}</span>`)
    .join(" ");

  gsap.timeline({ defaults: { ease: "power3.out" } })
    .from(".hero .eyebrow", { y: 20, opacity: 0, duration: motion(0.6) })
    .from(".hero__title .char", { yPercent: 110, opacity: 0, rotate: 8, stagger: motion(0.04), duration: motion(0.8) }, "-=0.3")
    .from(".hero__lead, .hero .btn", { y: 30, opacity: 0, stagger: motion(0.15), duration: motion(0.7) }, "-=0.4");

  gsap.to(media, {
    yPercent: 18,
    scale: 1.2,
    ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
  });
  gsap.to(".hero__content", {
    yPercent: -30,
    opacity: 0,
    ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
  });
}

function initChrome() {
  gsap.to(".progress span", {
    scaleX: 1,
    ease: "none",
    scrollTrigger: { start: 0, end: "max", scrub: 0.3 },
  });
  ScrollTrigger.create({
    start: () => window.innerHeight * 0.8,
    end: "max",
    toggleClass: { targets: ".nav", className: "is-solid" },
  });
}

function initConcept() {
  const svg = document.querySelector(".concept__svg");
  const terms = [...document.querySelectorAll(".terms li")];
  const strokes = svg.querySelectorAll(".edges path, .height-mark path");
  strokes.forEach((path) => {
    const length = path.getTotalLength();
    gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
  });
  gsap.set(svg.querySelectorAll("circle"), { scale: 0, transformOrigin: "50% 50%" });
  gsap.set(svg.querySelector(".height-mark text"), { opacity: 0 });

  const setStep = (step) => terms.forEach((term, i) => term.classList.toggle("is-active", i === step));
  setStep(0);

  const timeline = gsap.timeline({
    defaults: { ease: "power2.out" },
    scrollTrigger: {
      trigger: ".concept",
      start: "top top",
      end: "+=1600",
      scrub: 0.6,
      pin: ".concept__pin",
      onUpdate: (self) => setStep(Math.min(4, Math.floor(self.progress * 5))),
    },
  });
  timeline
    .to(svg.querySelector(".n-root"), { scale: 1, duration: 1 })
    .to(svg.querySelectorAll(".n-inner"), { scale: 1, stagger: 0.3, duration: 1 })
    .to(svg.querySelectorAll(".edges path"), { strokeDashoffset: 0, stagger: 0.15, duration: 1 })
    .to(svg.querySelectorAll(".n-leaf"), { scale: 1, stagger: 0.2, duration: 1 })
    .to(svg.querySelector(".height-mark path"), { strokeDashoffset: 0, duration: 1 })
    .to(svg.querySelector(".height-mark text"), { opacity: 1, duration: 0.5 });
}

function initReveals() {
  gsap.set(".reveal", { y: 50, opacity: 0 });
  ScrollTrigger.batch(".reveal", {
    start: "top 88%",
    once: true,
    onEnter: (batch) => gsap.to(batch, { y: 0, opacity: 1, stagger: motion(0.12), duration: motion(0.9), ease: "power3.out" }),
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

function initTaxonomy(data, speciesByName) {
  const svg = d3.select("#taxonomy-svg");
  const margin = { top: 20, right: 190, bottom: 20, left: 170 };
  const nodeGap = 30;
  const levelGap = 190;
  const duration = motion(0.6) * 1000;
  const linkPath = d3.linkHorizontal().x((d) => d.y).y((d) => d.x);
  const root = d3.hierarchy(data);
  root.x0 = 0;
  root.y0 = 0;
  root.descendants().forEach((d) => (d.id = d.ancestors().map((a) => a.data.name).join("/")));

  const linkLayer = svg.append("g");
  const nodeLayer = svg.append("g");
  const out = document.getElementById("path-out");
  let hot = new Set();

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
    merged.classed("is-collapsed", (d) => Boolean(d._children)).classed("is-hot", (d) => hot.has(d.id));
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

  async function onClick(d) {
    if (d.data.rank !== "species") {
      if (d.children) {
        d._children = d.children;
        d.children = null;
      } else if (d._children) {
        d.children = d._children;
        d._children = null;
      }
      update(d);
      return;
    }
    const trail = await api(`/api/path/${encodeURIComponent(d.data.name)}`);
    hot = new Set(d.ancestors().map((a) => a.id));
    update(d);
    const info = speciesByName.get(d.data.name);
    out.innerHTML = `<b>Camino:</b> ${trail.join(" → ")} · profundidad ${trail.length - 1} · `;
    const button = document.createElement("button");
    button.className = "chip";
    button.style.display = "inline-flex";
    button.textContent = "Ver ficha";
    button.addEventListener("click", () => openModal(info));
    out.append(button);
  }

  update(root);
}

function bstLayout(data, width) {
  const root = d3.hierarchy(data, (d) => d.children);
  const levelGap = 78;
  d3.tree().size([width - 80, root.height * levelGap])(root);
  return { root, height: root.height * levelGap + 60 };
}

function renderBST(svgSelector, data) {
  const width = 960;
  const svg = d3.select(svgSelector);
  const { root, height } = bstLayout(data, width);
  svg.attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);
  const g = svg.append("g").attr("transform", "translate(40,30)");

  g.selectAll("path")
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
  nodes.append("text")
    .attr("dy", (d) => (d.depth % 2 ? "1.9em" : "-1.1em"))
    .attr("text-anchor", "middle")
    .text((d) => d.data.label || "");

  const byKey = new Map();
  nodes.each(function (d) {
    if (!d.data.empty) byKey.set(d.data.name, { node: d3.select(this), datum: d });
  });
  const links = g.selectAll("path.tree-link");
  return {
    byKey,
    reset() {
      nodes.classed("is-visited is-found is-hot", false);
      links.classed("is-hot", false);
    },
    mark(key, className) {
      const entry = byKey.get(key);
      if (!entry) return;
      entry.node.classed(className, true);
      links.filter((l) => l.target === entry.datum).classed("is-hot", true);
      if (!reduceMotion) {
        gsap.fromTo(entry.node.select("circle").node(), { attr: { r: 15 } }, { attr: { r: 9 }, duration: 0.5, ease: "back.out(3)" });
      }
    },
  };
}

function initSearch(bstData) {
  const view = renderBST("#bst-svg", bstData);
  const form = document.getElementById("search-form");
  const input = document.getElementById("search-input");
  const list = document.getElementById("suggestions");
  const out = document.getElementById("search-result");
  let run = 0;

  input.addEventListener("input", async () => {
    if (!input.value.trim()) return;
    const result = await api(`/api/search?q=${encodeURIComponent(input.value)}`);
    list.innerHTML = result.suggestions.map((s) => `<option value="${s.common_name}">`).join("");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const query = input.value.trim();
    if (!query) return;
    const current = ++run;
    const result = await api(`/api/search?q=${encodeURIComponent(query)}`);
    view.reset();
    out.innerHTML = `<p>Buscando «${query}»…</p>`;
    for (const key of result.visited) {
      if (current !== run) return;
      view.mark(key, "is-visited");
      await wait(450);
    }
    if (result.found) {
      view.mark(result.visited.at(-1), "is-found");
      out.innerHTML = `
        <p class="ok"><strong>¡Encontrado!</strong> ${result.species.common_name} (<em>${result.species.scientific_name}</em>)</p>
        <div class="compare">
          <span>BST: <strong>${result.comparisons}</strong> comparaciones</span>
          <span>Búsqueda lineal: <strong>${result.linear_comparisons}</strong> comparaciones</span>
        </div>`;
    } else {
      out.innerHTML = `
        <p class="ko"><strong>No está en el árbol.</strong> Se hicieron ${result.comparisons} comparaciones hasta llegar a un hijo vacío.</p>`;
    }
  });
}

function initTraversals(bstData) {
  const view = renderBST("#traversal-svg", bstData);
  const sequence = document.getElementById("sequence");
  const chips = document.querySelectorAll(".chip[data-kind]");
  let run = 0;

  chips.forEach((chip) => {
    chip.addEventListener("click", async () => {
      chips.forEach((c) => c.classList.toggle("is-active", c === chip));
      const current = ++run;
      const { order } = await api(`/api/traversal/${chip.dataset.kind}?tree=bst`);
      view.reset();
      sequence.innerHTML = "";
      for (const key of order) {
        if (current !== run) return;
        view.mark(key, "is-visited");
        const item = document.createElement("li");
        item.textContent = view.byKey.get(key).datum.data.label;
        sequence.append(item);
        gsap.from(item, { scale: 0.4, opacity: 0, duration: motion(0.35), ease: "back.out(2)" });
        await wait(380);
      }
    });
  });
}

function initStats(stats) {
  document.querySelectorAll("[data-stat]").forEach((element) => {
    const value = element.dataset.stat.split(".").reduce((obj, key) => obj[key], stats);
    const counter = { value: 0 };
    ScrollTrigger.create({
      trigger: element,
      start: "top 90%",
      once: true,
      onEnter: () => gsap.to(counter, {
        value,
        duration: motion(1.6),
        ease: "power2.out",
        onUpdate: () => (element.textContent = Math.round(counter.value)),
        onComplete: () => (element.textContent = value),
      }),
    });
  });
}

function photoElement(species) {
  const element = document.createElement("div");
  element.className = "photo";
  element.textContent = "🌳";
  loadPhoto(element, species.scientific_name);
  return element;
}

async function openModal(species) {
  const modal = document.getElementById("modal");
  modal.querySelector(".modal__img").replaceChildren(photoElement(species));
  modal.querySelector(".modal__sci").textContent = species.scientific_name;
  modal.querySelector(".modal__name").textContent = species.common_name;
  modal.querySelector(".modal__desc").textContent = species.description;
  modal.querySelector(".modal__facts").innerHTML = `
    <dt>Familia</dt><dd>${species.family}</dd>
    <dt>Altura máx.</dt><dd>${species.height_m} m</dd>
    <dt>Regiones</dt><dd>${species.regions.join(", ")}</dd>`;
  const pathList = modal.querySelector(".modal__path");
  pathList.innerHTML = "";
  modal.showModal();
  const trail = await api(`/api/path/${encodeURIComponent(species.scientific_name)}`);
  pathList.innerHTML = trail.map((step) => `<li>${step}</li>`).join("");
  gsap.from(pathList.children, { x: -10, opacity: 0, stagger: motion(0.08), duration: motion(0.3) });
}

function initModal() {
  const modal = document.getElementById("modal");
  modal.querySelector(".modal__close").addEventListener("click", () => modal.close());
  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.close();
  });
}

function initGallery(species) {
  const gallery = document.getElementById("gallery");
  species.forEach((item) => {
    const card = document.createElement("button");
    card.className = "card";
    card.type = "button";
    const media = document.createElement("div");
    media.className = "card__img";
    media.append(photoElement(item));
    const body = document.createElement("div");
    body.className = "card__body";
    body.innerHTML = `
      <h3>${item.common_name}</h3>
      <p class="sci">${item.scientific_name}</p>
      <div class="tags">${[item.family, ...item.regions].map((t) => `<span class="tag">${t}</span>`).join("")}</div>`;
    card.append(media, body);
    card.addEventListener("click", () => openModal(item));
    gallery.append(card);
  });

  gsap.set(".card", { y: 60, opacity: 0 });
  ScrollTrigger.batch(".card", {
    start: "top 92%",
    once: true,
    onEnter: (batch) => gsap.to(batch, { y: 0, opacity: 1, stagger: motion(0.1), duration: motion(0.8), ease: "power3.out" }),
  });
}

async function main() {
  initHero();
  initChrome();
  initConcept();
  initReveals();
  initModal();

  const [species, taxonomy, bst, stats] = await Promise.all([
    api("/api/species"),
    api("/api/taxonomy"),
    api("/api/bst"),
    api("/api/stats"),
  ]);
  const speciesByName = new Map(species.map((s) => [s.scientific_name, s]));

  initTaxonomy(taxonomy, speciesByName);
  initSearch(bst);
  initTraversals(bst);
  initStats(stats);
  initGallery(species);
  ScrollTrigger.refresh();
}

main();
