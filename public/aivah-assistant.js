(() => {
  const TOOLS = [
    {
      type: "function",
      name: "get_ui_state",
      description:
        "Read the live page: actions, fields, tables, lists, cards, tabs, accordions, steps/wizards, timelines, carousels, hero, stats, widgets, overlays, pages, and media. Call before claiming what is on screen or before acting.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      type: "function",
      name: "click",
      description:
        "Click any visible control by name: buttons, links, tabs, accordion headers, menu items, options, switches, steppers, carousel controls, comboboxes. Prefer role=tab for in-page tabs, role=switch for toggles. For host character vs model, use names like Host 1 / character vs Host 1 model. Never ask the user to click.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Visible label of the control" },
          role: {
            type: "string",
            enum: [
              "button",
              "tab",
              "link",
              "menuitem",
              "option",
              "checkbox",
              "switch",
              "radio",
              "slider",
              "treeitem",
            ],
          },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "fill",
      description:
        "Fill a field by label. Use Host 1 / character for character selects, Host 1 model / Host 1 voice for comboboxes. Does not submit.",
      parameters: {
        type: "object",
        properties: { field: { type: "string" }, value: { type: "string" } },
        required: ["field", "value"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "hover",
      description: "Hover a control to open CSS menus.",
      parameters: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "press_key",
      description: "Send a key: enter, escape, tab, space, arrows.",
      parameters: {
        type: "object",
        properties: { key: { type: "string" } },
        required: ["key"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "navigate",
      description:
        "Open another page. Prefer an absolute path when known, otherwise the visible link or page name.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Absolute path such as /pricing or /settings" },
          name: { type: "string", description: "Visible nav label or page name" },
          target: { type: "string", description: "Path or page name if path/name are not used" },
        },
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "scroll",
      description:
        "Scroll a page, list, dropdown, or horizontal carousel/slider. Use left/right for carousels.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Optional control or section to scroll into view / within",
          },
          direction: {
            type: "string",
            enum: ["up", "down", "left", "right", "top", "bottom"],
          },
          amount: { type: "string", enum: ["page", "small"] },
        },
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "media",
      description:
        "Control native audio/video (play, pause, mute, seek). Browser playbars cannot be clicked.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: [
              "play",
              "pause",
              "toggle",
              "mute",
              "unmute",
              "seek",
              "seek_to",
              "skip_back",
              "skip_forward",
              "restart",
              "volume",
              "fullscreen",
            ],
          },
          name: { type: "string" },
          seconds: { type: "number" },
          percent: { type: "number" },
          volume: { type: "number" },
        },
        required: ["action"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "close",
      description: "Close the open dialog or menu.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  ];

  const hostTools = new Map();
  const recipes = new Map();
  let mounted = false;

  function normalize(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  const STOP = new Set([
    "the",
    "a",
    "an",
    "to",
    "go",
    "open",
    "click",
    "please",
    "page",
    "tab",
    "tabs",
    "link",
    "button",
    "menu",
    "show",
    "me",
    "on",
    "in",
    "and",
    "for",
    "move",
    "switch",
    "section",
    "panel",
    "view",
    "into",
    "onto",
    "change",
    "select",
    "choose",
    "goto",
    "activate",
    "disable",
    "enable",
    "toggle",
  ]);

  function tokens(value) {
    return normalize(value)
      .replace(/[^a-z0-9/]+/g, " ")
      .split(/\s+/)
      .filter((word) => word && !STOP.has(word));
  }

  function stem(word) {
    const w = String(word || "");
    if (w.length <= 3) return w;
    if (w.endsWith("ies") && w.length > 4) return `${w.slice(0, -3)}y`;
    if (/(ches|shes|sses|zzes|xes|zes)$/.test(w)) return w.slice(0, -2);
    if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
    return w;
  }

  function matchScore(hay, needle) {
    const label = normalize(hay);
    const want = normalize(needle);
    if (!label || !want) return 0;
    if (label === want) return 120;
    const labelPath = label.startsWith("/") ? label.split("?")[0] : "";
    const wantPath = want.startsWith("/") ? want.split("?")[0] : `/${want.replace(/^\/+/, "")}`;
    if (labelPath && (labelPath === want || labelPath === wantPath)) return 115;
    if (want.startsWith(label + " ") || want === label) {
      return label.length >= 3 ? 95 : 0;
    }
    if (label.startsWith(want + " ") || label.endsWith(" " + want) || label.includes(" " + want + " ")) {
      return 90;
    }
    const wantTokens = tokens(want);
    const labelTokens = tokens(label);
    if (!wantTokens.length || !labelTokens.length) return 0;
    if (wantTokens.join(" ") === labelTokens.join(" ")) return 100;
    if (wantTokens.every((word) => labelTokens.includes(word))) return 80;
    const wantStem = wantTokens.map(stem);
    const labelStem = labelTokens.map(stem);
    if (wantStem.every((word) => labelStem.includes(word))) return 78;
    const shared = wantTokens.filter((word) => labelTokens.includes(word));
    if (shared.length && shared.length === labelTokens.length && labelTokens.length >= 2) {
      return 70;
    }
    const sharedStem = wantStem.filter((word) => labelStem.includes(word));
    if (sharedStem.length >= 2 && sharedStem.length === wantStem.length) return 72;
    return 0;
  }

  function present(el) {
    if (!(el instanceof HTMLElement) || el.hidden) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function blocked(el) {
    return Boolean(el.closest("[inert]"));
  }

  function nearbyLabel(el) {
    if (!(el instanceof HTMLElement)) return "";
    let prev = el.previousElementSibling;
    while (prev) {
      if (
        prev.matches("label, [data-slot='label']") ||
        prev.tagName === "LABEL"
      ) {
        return cellText(prev);
      }
      const nested = prev.querySelector?.("label, [data-slot='label']");
      if (nested) return cellText(nested);
      prev = prev.previousElementSibling;
    }
    const parent = el.parentElement;
    if (parent) {
      const lab = parent.querySelector(
        ":scope > label, :scope > [data-slot='label']",
      );
      if (lab) return cellText(lab);
      const wrapping = parent.querySelector("label, [data-slot='label']");
      if (wrapping && parent.contains(wrapping) && !wrapping.contains(el)) {
        return cellText(wrapping);
      }
    }
    const card = el.closest(
      "[data-slot='card'], article, li, [role='group'], [role='listitem']",
    );
    if (card) {
      const title = card.querySelector(
        "h1, h2, h3, h4, [data-slot='card-title'], .font-semibold",
      );
      if (title && !title.contains(el)) return shortText(title, 80);
    }
    return "";
  }

  function controlKind(el) {
    if (!(el instanceof HTMLElement)) return "control";
    const role = el.getAttribute("role") || "";
    if (role === "tab") return "tab";
    if (role === "switch") return "switch";
    if (role === "combobox") return "combobox";
    if (role === "checkbox") return "checkbox";
    if (el instanceof HTMLSelectElement) return "select";
    if (el instanceof HTMLAnchorElement || role === "link") return "link";
    if (el.tagName === "BUTTON" || role === "button") return "button";
    if (el.tagName === "SUMMARY") return "button";
    return "control";
  }

  function nameOf(el) {
    if (!(el instanceof HTMLElement)) return "";
    const visible = visibleLabel(el);
    const labelledBy = el.getAttribute("aria-labelledby");
    const labelled = labelledBy
      ? labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent || "")
          .join(" ")
      : "";
    const explicit = (
      el.getAttribute("aria-label") ||
      labelled ||
      el.getAttribute("title") ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim();
    const placeholder = (el.placeholder || "").replace(/\s+/g, " ").trim();
    const near = nearbyLabel(el);
    const kind = controlKind(el);

    if (kind === "switch") {
      const on =
        el.getAttribute("aria-checked") === "true" ||
        el.getAttribute("data-state") === "checked";
      const base = visible || explicit || near;
      return base ? `${base} switch ${on ? "on" : "off"}` : `switch ${on ? "on" : "off"}`;
    }
    if (kind === "select") {
      const opt0 = el.options?.[0]?.text || "";
      const hint = /character/i.test(opt0) ? "character" : /model/i.test(opt0) ? "model" : "";
      return [near || explicit || visible, hint, placeholder].filter(Boolean).join(" ").trim() || visible;
    }
    if (kind === "combobox") {
      const hint = /model/i.test(`${near} ${visible} ${placeholder}`)
        ? "model"
        : /voice/i.test(`${near} ${visible} ${placeholder}`)
          ? "voice"
          : "";
      return [near || explicit, hint, visible || placeholder].filter(Boolean).join(" ").trim();
    }
    // Prefer what is painted on screen over aria-only names.
    if (visible) return visible;
    if (explicit) return explicit;
    if (near) return near;
    return placeholder;
  }

  function hrefOf(el) {
    const href = el.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return "";
    try {
      const url = new URL(href, location.origin);
      if (url.origin !== location.origin) return "";
      return `${url.pathname}${url.search}` || url.pathname;
    } catch {
      return href.startsWith("/") ? href : "";
    }
  }

  function allAppLinks() {
    return [...document.querySelectorAll("a[href]")].filter((el) => {
      if (el.closest("[data-aivah-assistant]")) return false;
      const path = hrefOf(el);
      return path && !path.startsWith("/api") && path !== "/";
    });
  }

  function pageCatalog() {
    const seen = new Map();
    for (const el of allAppLinks()) {
      const path = hrefOf(el);
      const label = nameOf(el) || path;
      if (path && !seen.has(path)) seen.set(path, label);
    }
    return [...seen.entries()].map(([path, label]) => `${label} (${path})`);
  }

  function pickLink(nameOrPath) {
    const raw = String(nameOrPath || "").trim();
    if (!raw) return null;
    const ranked = allAppLinks()
      .map((node) => {
        const path = hrefOf(node);
        const label = nameOf(node);
        const score = Math.max(
          matchScore(path, raw),
          matchScore(label, raw),
          matchScore(`${label} ${path}`, raw),
        );
        return { node, path, score: present(node) ? score + 10 : score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);
    return ranked[0] || null;
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function openPath(path) {
    const url = String(path || "").trim();
    if (!url) return { ok: false, message: "Missing path." };
    const next = url.startsWith("/") ? url : `/${url}`;
    if (typeof window.__AIVAH_NAVIGATE === "function") {
      window.__AIVAH_NAVIGATE(next);
    } else {
      return { ok: false, message: `Cannot open ${next} from this page.` };
    }
    const dest = next.split("?")[0];
    for (let i = 0; i < 8; i += 1) {
      await wait(120);
      if (location.pathname === dest || location.pathname.startsWith(`${dest}/`)) {
        return { ok: true, message: `Opened ${location.pathname}. ${snapshot()}` };
      }
    }
    return { ok: true, message: `Opened ${next}. Now at ${location.pathname}. ${snapshot()}` };
  }

  async function navigateTo(args) {
    const rawPath = typeof args.path === "string" ? args.path.trim() : "";
    const rawName = typeof args.name === "string" ? args.name.trim() : "";
    const rawTarget = typeof args.target === "string" ? args.target.trim() : "";
    const target = rawPath || rawName || rawTarget;
    if (!target) {
      return { ok: false, message: `Say which page to open. Pages: ${pageCatalog().join("; ") || "none"}` };
    }

    // Strong on-page control match beats routing away (tabs, filters, toggles).
    const onPage = pickControl(target);
    if (onPage.el && !(onPage.el instanceof HTMLAnchorElement) && !onPage.el.closest("nav a[href]")) {
      const label = nameOf(onPage.el);
      if (matchScore(label, target) >= 90) {
        press(onPage.el);
        return { ok: true, message: `Clicked ${label}. ${snapshot()}` };
      }
    }

    let path = "";
    if (/^https?:/i.test(rawPath || rawTarget)) {
      try {
        const url = new URL(rawPath || rawTarget);
        if (url.origin === location.origin) path = `${url.pathname}${url.search}`;
      } catch {
        path = "";
      }
    } else if ((rawPath || rawTarget).startsWith("/")) {
      path = rawPath || rawTarget;
    }
    const link = pickLink(path || target);
    if (!path && link && link.score >= 80) path = link.path;
    if (path) return openPath(path);
    return {
      ok: false,
      message: `No page matches "${target}". Pages: ${pageCatalog().join("; ") || "none"}`,
    };
  }

  function overlayRoot() {
    const nodes = [
      ...document.querySelectorAll(
        "[role='dialog'], [role='alertdialog'], [data-slot='dialog-content'], [data-slot='sheet-content'], [data-slot='alert-dialog-content'], dialog[open]",
      ),
    ].filter((el) => {
      if (!present(el) || blocked(el) || inAssistant(el)) return false;
      const state = el.getAttribute("data-state");
      if (state === "closed" || state === "hide") return false;
      if (el.getAttribute("aria-hidden") === "true") return false;
      return true;
    });
    return nodes[nodes.length - 1] || null;
  }

  function selectorFor(role) {
    if (role === "tab") return "[role='tab'], [data-slot='tabs-trigger']";
    if (role === "link") return "a, [role='link']";
    if (role === "option") return "[role='option'], option";
    if (role === "menuitem") return "[role='menuitem']";
    if (role === "checkbox") return "input[type='checkbox'], [role='checkbox']";
    if (role === "switch") return "[role='switch'], input[type='checkbox'][role='switch']";
    if (role === "radio") return "input[type='radio'], [role='radio']";
    if (role === "slider") return "input[type='range'], [role='slider']";
    if (role === "treeitem") return "[role='treeitem']";
    return [
      "a",
      "button",
      "summary",
      "select",
      "textarea",
      "input:not([type='hidden'])",
      "[role='button']",
      "[role='link']",
      "[role='tab']",
      "[data-slot='tabs-trigger']",
      "[role='menuitem']",
      "[role='option']",
      "[role='checkbox']",
      "[role='switch']",
      "[role='radio']",
      "[role='slider']",
      "[role='treeitem']",
      "[aria-expanded]",
      "[aria-haspopup]",
      "[tabindex]:not([tabindex='-1'])",
    ].join(", ");
  }

  function controls(root, role) {
    const scope = root || document;
    return [...scope.querySelectorAll(selectorFor(role))].filter(
      (el) => present(el) && !blocked(el) && !inAssistant(el),
    );
  }

  function visibleLabel(el) {
    if (!(el instanceof HTMLElement)) return "";
    try {
      const clone = el.cloneNode(true);
      if (clone instanceof HTMLElement) {
        clone
          .querySelectorAll("svg, [aria-hidden='true'], .sr-only")
          .forEach((node) => node.remove());
        const text = cellText(clone);
        if (text) return text;
      }
    } catch {
      // fall through
    }
    return cellText(el);
  }

  function pickControl(name, role) {
    const needle = normalize(name);
    const overlay = overlayRoot();
    const wantRole = normalize(role || "");
    const pool = [
      ...(overlay ? controls(overlay, role) : []),
      // When a dialog/sheet is open, search it first; still allow page tabs/controls as fallback.
      ...controls(null, role),
    ].filter((node, index, list) => list.indexOf(node) === index);

    const ranked = pool
      .map((node) => {
        const kind = controlKind(node);
        const visible = visibleLabel(node);
        const label = nameOf(node);
        let score = Math.max(
          matchScore(visible, needle),
          matchScore(label, needle),
          matchScore(nearbyLabel(node), needle),
          matchScore(hrefOf(node), needle),
        );
        if (!score) return { node, score: 0, kind };

        if (!(node instanceof HTMLAnchorElement) && !node.closest("a[href]")) {
          score += 25;
        }
        if (overlay && overlay.contains(node)) score += 55;
        if (wantRole && (kind === wantRole || (wantRole === "tab" && kind === "tab"))) {
          score += 40;
        }
        if (kind === "tab" || node.matches?.("[data-slot='tabs-trigger']")) score += 40;
        if (/\b(tab|tabs)\b/.test(normalize(name)) && kind === "tab") score += 30;
        if (
          /\b(switch|toggle|enable|disable)\b/.test(needle) &&
          kind === "switch"
        ) {
          score += 40;
        }
        if (/\bcharacter\b/.test(needle) && kind === "select") score += 45;
        if (/\bcharacter\b/.test(needle) && kind === "combobox") score -= 40;
        if (/\bmodel\b/.test(needle) && kind === "combobox") score += 40;
        if (/\bmodel\b/.test(needle) && kind === "select") score -= 25;
        if (/\bvoice\b/.test(needle) && kind === "combobox") score += 35;
        if (node.closest("nav, [data-slot='sidebar'], aside")) score -= 35;
        if (node.closest("main, [role='main'], [data-slot='tabs'], [data-slot='tabs-list']")) {
          score += 20;
        }
        return { node, score, kind };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    // Prefer in-page tabs when the request looks like a tab label.
    const bestTab = ranked.find(
      (item) => item.kind === "tab" || item.node.matches?.("[data-slot='tabs-trigger']"),
    );
    if (bestTab && (!wantRole || wantRole === "tab" || wantRole === "button")) {
      const best = ranked[0];
      if (!best || bestTab.score >= best.score - 25) {
        return { overlay, el: bestTab.node, pool };
      }
    }

    // Prefer controls inside an open dialog/sheet.
    if (overlay) {
      const inOverlay = ranked.find((item) => overlay.contains(item.node));
      if (inOverlay) return { overlay, el: inOverlay.node, pool };
    }

    return { overlay, el: ranked[0]?.node, pool };
  }

  function cellText(el) {
    return String(el?.innerText || el?.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function shortText(el, max = 120) {
    return cellText(el).slice(0, max);
  }

  function listingRoot() {
    return overlayRoot() || document;
  }

  function inAssistant(el) {
    return Boolean(el?.closest?.("[data-aivah-assistant]"));
  }

  function describeTable(table) {
    const headers = [...table.querySelectorAll("thead th, thead td, [role='columnheader']")]
      .map(cellText)
      .filter(Boolean);
    let rows = [...table.querySelectorAll("tbody tr, [role='row']")].filter(
      (row) => present(row) && !row.closest("thead"),
    );
    if (!rows.length) {
      rows = [...table.querySelectorAll("tr")].filter(present);
      if (headers.length && rows.length) rows = rows.slice(1);
    }
    const lines = rows.slice(0, 12).map((row) => {
      const cells = [
        ...row.querySelectorAll("th, td, [role='gridcell'], [role='cell']"),
      ]
        .map(cellText)
        .filter(Boolean);
      return cells.join(" | ");
    }).filter(Boolean);
    if (!headers.length && !lines.length) return "";
    const title =
      table.getAttribute("aria-label") ||
      table.querySelector("caption")?.textContent?.trim() ||
      "Table";
    const head = headers.length ? `columns: ${headers.join(" | ")}` : "columns: (none)";
    const body = lines.length
      ? `rows: ${lines.map((line, i) => `${i + 1}) ${line}`).join(" / ")}`
      : "rows: none";
    const more = rows.length > lines.length ? ` (+${rows.length - lines.length} more)` : "";
    return `${title} — ${head}; ${body}${more}`;
  }

  function describeList(list) {
    if (list.closest("nav") || inAssistant(list)) return "";
    const items = [
      ...list.querySelectorAll(":scope > li, :scope > [role='listitem']"),
    ]
      .filter(present)
      .map((el) => cellText(el).slice(0, 140))
      .filter(Boolean)
      .slice(0, 16);
    if (items.length < 2) return "";
    const title = list.getAttribute("aria-label") || "List";
    const more =
      list.querySelectorAll(":scope > li, :scope > [role='listitem']").length >
      items.length
        ? "…"
        : "";
    return `${title}: ${items.join("; ")}${more}`;
  }

  function describeCards(root) {
    const items = [
      ...root.querySelectorAll(
        "[role='link'][aria-label], article, [role='article'], [role='listitem']",
      ),
    ]
      .filter(
        (el) =>
          present(el) &&
          !inAssistant(el) &&
          !el.closest("nav, table, thead") &&
          !el.closest("ul, ol, [role='list']"),
      )
      .map((el) => {
        const label = el.getAttribute("aria-label") || "";
        const text = cellText(el).slice(0, 160);
        if (label && text && !normalize(text).includes(normalize(label))) {
          return `${label}: ${text}`;
        }
        return text || label;
      })
      .filter(Boolean)
      .slice(0, 16);
    if (items.length < 2) return "";
    return `Cards: ${items.map((line, i) => `${i + 1}) ${line}`).join(" / ")}`;
  }

  function describeTabs(root) {
    return [...root.querySelectorAll("[role='tablist']")]
      .filter((el) => present(el) && !inAssistant(el))
      .slice(0, 4)
      .map((list) => {
        const tabs = [...list.querySelectorAll("[role='tab']")].filter(present);
        if (!tabs.length) return "";
        const labels = tabs.map((tab) => {
          const on =
            tab.getAttribute("aria-selected") === "true" ||
            tab.getAttribute("data-state") === "active";
          return `${on ? "*" : ""}${nameOf(tab) || shortText(tab, 40)}`;
        });
        const selected =
          tabs.find(
            (tab) =>
              tab.getAttribute("aria-selected") === "true" ||
              tab.getAttribute("data-state") === "active",
          ) || tabs[0];
        const panelId = selected?.getAttribute("aria-controls");
        const panel = panelId ? document.getElementById(panelId) : null;
        const panelText =
          panel && present(panel) ? `; panel: ${shortText(panel, 160)}` : "";
        return `Tabs [${labels.join(" | ")}]${panelText}`;
      })
      .filter(Boolean);
  }

  function describeAccordions(root) {
    const items = [];
    for (const details of [...root.querySelectorAll("details")].filter(present)) {
      if (inAssistant(details)) continue;
      const summary = details.querySelector(":scope > summary");
      items.push(
        `${details.open ? "open" : "closed"}: ${nameOf(summary) || shortText(summary, 80) || "section"}`,
      );
    }
    for (const btn of [
      ...root.querySelectorAll(
        "button[aria-expanded], [role='button'][aria-expanded], h2[aria-expanded], h3[aria-expanded], [data-state][aria-expanded]",
      ),
    ].filter(present)) {
      if (inAssistant(btn) || btn.closest("details") || btn.closest("[role='tablist']")) {
        continue;
      }
      const open = btn.getAttribute("aria-expanded") === "true";
      const label = nameOf(btn);
      if (!label) continue;
      items.push(`${open ? "open" : "closed"}: ${label}`);
    }
    if (!items.length) return [];
    return [`Accordions: ${items.slice(0, 14).join("; ")}`];
  }

  function describeSteps(root) {
    const parts = [];
    const current = [...root.querySelectorAll('[aria-current="step"]')]
      .filter((el) => present(el) && !inAssistant(el))
      .map((el) => nameOf(el) || shortText(el, 60))
      .filter(Boolean);
    if (current.length) parts.push(`current step: ${current.join(", ")}`);

    const steppers = [
      ...root.querySelectorAll(
        "[aria-label*='step' i], [aria-label*='wizard' i], [aria-label*='progress' i]",
      ),
    ].filter((el) => present(el) && !inAssistant(el) && !el.matches("progress, [role='progressbar']"));
    for (const stepper of steppers.slice(0, 3)) {
      const steps = [
        ...stepper.querySelectorAll(
          "li, [role='listitem'], button, [role='button'], [aria-current], [data-state]",
        ),
      ]
        .filter(present)
        .map((el) => {
          const on =
            el.getAttribute("aria-current") === "step" ||
            el.getAttribute("data-state") === "active" ||
            el.getAttribute("aria-selected") === "true";
          const label = nameOf(el) || shortText(el, 40);
          return label ? `${on ? "*" : ""}${label}` : "";
        })
        .filter(Boolean)
        .slice(0, 10);
      if (steps.length >= 2) {
        parts.push(
          `${nameOf(stepper) || "Wizard"} [${steps.join(" > ")}]`,
        );
      }
    }

    const bars = [...root.querySelectorAll("[role='progressbar'], progress")]
      .filter((el) => present(el) && !inAssistant(el))
      .slice(0, 6)
      .map((el) => {
        const label = nameOf(el) || "Progress";
        const now = el.getAttribute("aria-valuenow") ?? el.value ?? "?";
        const max = el.getAttribute("aria-valuemax") ?? el.max ?? 100;
        const text = el.getAttribute("aria-valuetext");
        return text ? `${label}: ${text}` : `${label}: ${now}/${max}`;
      });
    if (bars.length) parts.push(bars.join("; "));
    if (!parts.length) return [];
    return [`Steps/wizards: ${parts.join(" | ")}`];
  }

  function describeTimelines(root) {
    return [...root.querySelectorAll("ol, ul, [role='list'], section")]
      .filter((el) => {
        if (!present(el) || inAssistant(el) || el.closest("nav")) return false;
        return el.querySelectorAll(":scope time, :scope [datetime]").length >= 2;
      })
      .slice(0, 3)
      .map((el) => {
        const events = [
          ...el.querySelectorAll(":scope > li, :scope > [role='listitem'], :scope > article, :scope > div"),
        ]
          .filter(present)
          .slice(0, 8)
          .map((item) => {
            const timeEl = item.querySelector("time, [datetime]");
            const when = timeEl
              ? timeEl.getAttribute("datetime") || shortText(timeEl, 40)
              : "";
            const body = shortText(item, 100);
            return when ? `${when} — ${body}` : body;
          })
          .filter(Boolean);
        if (events.length < 2) return "";
        return `Timeline: ${events.join(" / ")}`;
      })
      .filter(Boolean);
  }

  function describeCarousels(root) {
    const regions = [
      ...root.querySelectorAll(
        '[aria-roledescription="carousel"], [data-slot="carousel"], [role="region"][aria-label*="carousel" i], [role="region"][aria-label*="slider" i], [role="region"][aria-label*="gallery" i]',
      ),
    ].filter((el) => present(el) && !inAssistant(el));

    const fromScroll = [...root.querySelectorAll("div, section, ul")]
      .filter((el) => {
        if (!present(el) || inAssistant(el) || regions.includes(el)) return false;
        const style = getComputedStyle(el);
        const canScroll =
          el.scrollWidth > el.clientWidth + 40 &&
          (style.overflowX === "auto" ||
            style.overflowX === "scroll" ||
            style.scrollSnapType.includes("x"));
        return canScroll;
      })
      .slice(0, 3);

    return [...regions, ...fromScroll]
      .slice(0, 4)
      .map((region) => {
        const slides = [
          ...region.querySelectorAll(
            '[aria-roledescription="slide"], [role="group"], [data-slot="carousel-item"]',
          ),
        ].filter(present);
        const visible =
          slides.find((slide) => slide.getAttribute("aria-hidden") !== "true") ||
          slides[0];
        const controls = [...region.querySelectorAll("button, [role='button'], a")]
          .filter(present)
          .map((el) => nameOf(el))
          .filter(Boolean)
          .slice(0, 8);
        const title = nameOf(region) || region.getAttribute("aria-label") || "Carousel";
        const showing = visible ? shortText(visible, 100) : shortText(region, 100);
        const count = slides.length ? `${slides.length} slides; ` : "";
        const ctrl = controls.length ? `; controls: ${controls.join(", ")}` : "";
        return `Carousel "${title}": ${count}showing: ${showing}${ctrl}`;
      })
      .filter(Boolean);
  }

  function describeHero(root) {
    const main = root.querySelector("main") || root.body || root;
    const h1 = [...main.querySelectorAll("h1")].find(
      (el) => present(el) && !inAssistant(el),
    );
    if (!h1) return [];
    const rect = h1.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight * 1.2) return [];
    const section =
      h1.closest("section, header, [role='banner'], [data-slot='hero']") ||
      h1.parentElement;
    const support = [...(section || main).querySelectorAll("p")]
      .find((el) => present(el) && shortText(el, 20).length > 12);
    const ctas = [...(section || main).querySelectorAll("a, button, [role='button']")]
      .filter((el) => present(el) && !inAssistant(el))
      .map((el) => nameOf(el))
      .filter(Boolean)
      .slice(0, 4);
    return [
      `Hero: ${shortText(h1, 90)}${
        support ? ` — ${shortText(support, 110)}` : ""
      }${ctas.length ? `; CTAs: ${ctas.join(", ")}` : ""}`,
    ];
  }

  function describeStats(root) {
    const parts = [];
    for (const dl of [...root.querySelectorAll("dl")].filter(
      (el) => present(el) && !inAssistant(el),
    ).slice(0, 4)) {
      const pairs = [];
      const kids = [...dl.children];
      for (let i = 0; i < kids.length; i += 1) {
        if (kids[i].tagName !== "DT") continue;
        const dt = shortText(kids[i], 40);
        const dd =
          kids[i + 1]?.tagName === "DD" ? shortText(kids[i + 1], 40) : "";
        if (dt || dd) pairs.push(`${dt}: ${dd}`);
      }
      if (pairs.length) parts.push(pairs.slice(0, 8).join("; "));
    }

    for (const meter of [
      ...root.querySelectorAll("meter, [role='meter']"),
    ].filter((el) => present(el) && !inAssistant(el)).slice(0, 6)) {
      const label = nameOf(meter) || "Metric";
      const now = meter.getAttribute("aria-valuenow") ?? meter.value ?? "?";
      const text = meter.getAttribute("aria-valuetext");
      parts.push(text ? `${label}: ${text}` : `${label}: ${now}`);
    }

    for (const el of [
      ...root.querySelectorAll("[data-stat], [data-metric], [aria-label*='stat' i], [aria-label*='metric' i]"),
    ].filter((node) => present(node) && !inAssistant(node)).slice(0, 8)) {
      const text = shortText(el, 48);
      if (text) parts.push(text);
    }

    if (!parts.length) return [];
    return [`Stats/metrics: ${parts.join(" | ")}`];
  }

  function describeWidgets(root) {
    return [
      ...root.querySelectorAll(
        "main [role='region'][aria-label], main section[aria-label], [role='group'][aria-label], [data-slot='card'][aria-label]",
      ),
    ]
      .filter((el) => present(el) && !inAssistant(el))
      .slice(0, 6)
      .map((region) => {
        const title = nameOf(region) || shortText(region.querySelector("h2, h3, h4"), 50);
        const charts = region.querySelectorAll(
          "canvas, svg[role='img'], img[alt], [role='img']",
        ).length;
        const progress = [...region.querySelectorAll("[role='progressbar'], progress")]
          .filter(present)
          .map((el) => nameOf(el) || "progress")
          .slice(0, 3);
        const body = shortText(region, 120);
        return `Widget "${title || "panel"}": ${body}${
          charts ? `; charts: ${charts}` : ""
        }${progress.length ? `; progress: ${progress.join(", ")}` : ""}`;
      })
      .filter(Boolean);
  }

  function describePageCards(root) {
    const main = root.querySelector("main") || root;
    return [...main.querySelectorAll("a[href]")]
      .filter((el) => present(el) && !inAssistant(el) && hrefOf(el))
      .slice(0, 14)
      .map((el) => {
        const path = hrefOf(el);
        const title =
          shortText(
            el.querySelector("h1, h2, h3, h4, [data-slot='card-title']"),
            60,
          ) || nameOf(el).slice(0, 60);
        const desc = shortText(el.querySelector("p"), 90);
        return desc ? `${title} (${path}): ${desc}` : `${title} (${path})`;
      })
      .filter(Boolean);
  }

  function describeSwitches(root) {
    return [...root.querySelectorAll("[role='switch']")]
      .filter((el) => present(el) && !inAssistant(el))
      .slice(0, 16)
      .map((el) => nameOf(el))
      .filter(Boolean);
  }

  function describeFields(root) {
    const scope = root;
    const fields = [
      ...scope.querySelectorAll(
        "input:not([type='hidden']):not([type='button']):not([type='submit']), textarea, select, [role='combobox']",
      ),
    ]
      .filter((el) => present(el) && !inAssistant(el))
      .slice(0, 20)
      .map((el) => {
        const kind = controlKind(el);
        const label = nameOf(el) || el.name || el.placeholder || "field";
        return `${label} [${kind}]`;
      });
    return fields;
  }

  function describeStructures() {
    const root = listingRoot();
    const tables = [
      ...root.querySelectorAll("table, [role='table'], [role='grid']"),
    ]
      .filter((el) => present(el) && !inAssistant(el))
      .map(describeTable)
      .filter(Boolean)
      .slice(0, 4);
    const lists = [...root.querySelectorAll("ul, ol, [role='list']")]
      .filter((el) => present(el) && !inAssistant(el))
      .map(describeList)
      .filter(Boolean)
      .slice(0, 4);
    const pageCards = describePageCards(root);
    const switches = describeSwitches(root);
    const parts = [
      tables.length ? `Tables: ${tables.join(" || ")}` : "",
      lists.length ? `Lists: ${lists.join(" || ")}` : "",
      describeCards(root),
      pageCards.length ? `Page cards: ${pageCards.join(" / ")}` : "",
      switches.length ? `Switches: ${switches.join("; ")}` : "",
      ...describeTabs(root),
      ...describeAccordions(root),
      ...describeSteps(root),
      ...describeTimelines(root),
      ...describeCarousels(root),
      ...describeHero(root),
      ...describeStats(root),
      ...describeWidgets(root),
    ].filter(Boolean);
    return parts.join(". ");
  }

  function describeOverlay(overlay) {
    if (!overlay) return "";
    const title = shortText(
      overlay.querySelector(
        "h1, h2, h3, [data-slot='dialog-title'], [data-slot='sheet-title'], [data-slot='alert-dialog-title']",
      ),
      120,
    );
    const body = shortText(
      overlay.querySelector(
        "p, [data-slot='dialog-description'], [data-slot='sheet-description'], [data-slot='alert-dialog-description']",
      ),
      180,
    );
    const actions = controls(overlay)
      .map((el) => visibleLabel(el) || nameOf(el))
      .filter(Boolean)
      .slice(0, 16);
    return [
      "Open dialog/sheet (visible on screen).",
      title ? `Title: ${title}.` : "",
      body ? `Text: ${body}.` : "",
      actions.length ? `Dialog actions: ${actions.join("; ")}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  function snapshot() {
    const overlay = overlayRoot();
    const scope = overlay || document.querySelector("main") || document.body || document;
    const actions = controls(overlay)
      .map((el) => visibleLabel(el) || nameOf(el))
      .filter(Boolean)
      .slice(0, overlay ? 40 : 28);
    const fields = describeFields(scope);
    const media = [...(overlay || document).querySelectorAll("audio, video")]
      .map((el, i) => describeMedia(el, i))
      .join(" ");
    const pages = pageCatalog();
    const structures = describeStructures();
    if (overlay) {
      return [
        describeOverlay(overlay),
        `URL ${location.pathname}.`,
        structures,
        media ? `Media: ${media}` : "",
      ]
        .filter(Boolean)
        .join(" ");
    }
    return [
      `URL ${location.pathname}. Visible actions: ${actions.join("; ") || "none"}.`,
      `Pages: ${pages.join("; ") || "none"}.`,
      `Fields: ${fields.join("; ") || "none"}.`,
      structures,
      media ? `Media: ${media}` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  async function settle(ms = 280) {
    await wait(ms);
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }

  function describeMedia(el, index) {
    const kind = el instanceof HTMLVideoElement ? "Video" : "Audio";
    const title =
      el.getAttribute("aria-label") ||
      el.closest("[role='dialog']")?.querySelector("h1, h2, h3")?.textContent?.trim() ||
      `${kind} ${index + 1}`;
    const dur = Number.isFinite(el.duration) ? Math.floor(el.duration) : 0;
    const cur = Math.floor(el.currentTime || 0);
    const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    return `${kind} "${title}": ${el.paused ? "paused" : "playing"} at ${fmt(cur)} / ${dur ? fmt(dur) : "loading"}. Native controls: play, pause, mute, seek.`;
  }

  function pickMedia(name) {
    const overlay = overlayRoot();
    const items = [...(overlay || document).querySelectorAll("audio, video")];
    if (!items.length) return null;
    if (!name) return items[0];
    const needle = normalize(name);
    return (
      items.find((el, i) => normalize(describeMedia(el, i)).includes(needle)) ||
      items[0]
    );
  }

  async function controlMedia(args) {
    const media = pickMedia(args.name);
    if (!media) return { ok: false, message: "No audio or video player is on this page." };
    const action = normalize(args.action || "toggle");
    const duration = Number.isFinite(media.duration) ? media.duration : 0;
    try {
      if (action === "play" || action === "start" || action === "resume") await media.play();
      else if (action === "pause" || action === "stop") media.pause();
      else if (action === "toggle") {
        if (media.paused) await media.play();
        else media.pause();
      } else if (action === "mute") media.muted = true;
      else if (action === "unmute") media.muted = false;
      else if (action === "restart" || action === "replay") {
        media.currentTime = 0;
        await media.play();
      } else if (action === "seek") {
        media.currentTime = Math.max(
          0,
          media.currentTime + (Number(args.seconds) || 10),
        );
      } else if (action === "seek_to" || action === "jump") {
        if (args.percent != null) {
          media.currentTime = (duration * Number(args.percent)) / 100;
        } else media.currentTime = Number(args.seconds) || 0;
      } else if (action === "skip_back" || action === "rewind") {
        media.currentTime = Math.max(0, media.currentTime - (Number(args.seconds) || 10));
      } else if (action === "skip_forward" || action === "forward") {
        media.currentTime = media.currentTime + (Number(args.seconds) || 10);
      } else if (action === "volume") {
        const next = Number(args.volume);
        media.volume = next > 1 ? Math.min(1, next / 100) : Math.min(1, Math.max(0, next));
      } else if (action === "fullscreen" && media.requestFullscreen) {
        await media.requestFullscreen();
      } else {
        return { ok: false, message: `Unknown media action ${args.action}` };
      }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Media failed" };
    }
    return { ok: true, message: describeMedia(media, 0) };
  }

  function fillByLabel(field, value) {
    const needle = normalize(field);
    const overlay = overlayRoot();
    const scope = overlay || document;
    const inputs = [
      ...scope.querySelectorAll(
        "input:not([type='hidden']):not([type='button']):not([type='submit']), textarea, select, [contenteditable='true'], [role='combobox']",
      ),
    ].filter((el) => present(el) && !inAssistant(el));

    const ranked = inputs
      .map((el) => {
        const kind = controlKind(el);
        const hay = normalize(
          `${nameOf(el)} ${nearbyLabel(el)} ${el.name || ""} ${el.id || ""} ${el.placeholder || ""}`,
        );
        let score = matchScore(hay, needle);
        if (!score && hay.includes(needle)) score = 60;
        if (!score) return { el, score: 0 };
        if (/\bcharacter\b/.test(needle) && kind === "select") score += 45;
        if (/\bcharacter\b/.test(needle) && kind === "combobox") score -= 40;
        if (/\bmodel\b/.test(needle) && kind === "combobox") score += 40;
        if (/\bmodel\b/.test(needle) && kind === "select") score -= 25;
        if (/\bvoice\b/.test(needle) && kind === "combobox") score += 35;
        if (/\bhost\s*1\b/.test(needle) && /\bhost\s*1\b/.test(hay)) score += 20;
        if (/\bhost\s*2\b/.test(needle) && /\bhost\s*2\b/.test(hay)) score += 20;
        return { el, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    const match = ranked[0]?.el;
    if (!match) return { ok: false, message: `No field labeled "${field}". ${snapshot()}` };

    // Comboboxes are opened via click; option picking is a follow-up click.
    if (controlKind(match) === "combobox") {
      press(match);
      return {
        ok: true,
        message: `Opened ${nameOf(match)}. Now click the option "${value}". ${snapshot()}`,
      };
    }

    match.focus();
    if (match instanceof HTMLSelectElement) {
      const option = [...match.options].find(
        (item) =>
          matchScore(item.text, value) >= 70 ||
          normalize(item.text) === normalize(value) ||
          item.value === value,
      );
      if (!option) {
        return {
          ok: false,
          message: `No option "${value}" in ${nameOf(match)}. Options: ${[...match.options]
            .map((item) => item.text)
            .filter(Boolean)
            .slice(0, 12)
            .join("; ")}`,
        };
      }
      match.value = option.value;
    } else if (match.isContentEditable) match.textContent = value;
    else {
      const proto = Object.getOwnPropertyDescriptor(
        match instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype,
        "value",
      );
      proto?.set?.call(match, value);
    }
    match.dispatchEvent(new Event("input", { bubbles: true }));
    match.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true, message: `Filled ${nameOf(match) || field}.` };
  }

  function press(el) {
    if (!(el instanceof HTMLElement)) return;
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    const opts = { bubbles: true, cancelable: true, view: window };
    try {
      el.focus({ preventScroll: true });
    } catch {
      // ignore
    }
    el.dispatchEvent(new PointerEvent("pointerdown", { ...opts, pointerId: 1, pointerType: "mouse" }));
    el.dispatchEvent(new MouseEvent("mousedown", opts));
    el.dispatchEvent(new PointerEvent("pointerup", { ...opts, pointerId: 1, pointerType: "mouse" }));
    el.dispatchEvent(new MouseEvent("mouseup", opts));
    el.click();
  }

  async function runTool(name, args = {}) {
    const extra = hostTools.get(name);
    if (extra) return extra.execute(args);
    if (name === "get_ui_state") {
      return { ok: true, message: snapshot() };
    }
    if (name === "click") {
      const requested = String(args.name || "");
      // Prefer on-page controls before nav links.
      const picked = pickControl(requested, args.role);
      if (picked.el && !(picked.el instanceof HTMLAnchorElement) && !picked.el.closest("nav a[href]")) {
        const label = visibleLabel(picked.el) || nameOf(picked.el);
        press(picked.el);
        await settle(320);
        return {
          ok: true,
          message: `Clicked ${label}. ${snapshot()}`,
        };
      }
      const link = pickLink(requested);
      if (link && link.score >= 80) {
        return navigateTo({ path: link.path, name: requested });
      }
      if (!picked.el) {
        const action = normalize(requested);
        if (/^(play|pause|mute|unmute|restart)$/.test(action)) {
          return controlMedia({ action });
        }
        return {
          ok: false,
          message: `No control named "${requested}" yet. Scroll, open a tab/accordion/menu, or navigate, then click again using a Visible actions / Tabs / Dialog actions label. Do not ask the user to click. ${snapshot()}`,
        };
      }
      const anchor =
        picked.el instanceof HTMLAnchorElement
          ? picked.el
          : picked.el.closest("a[href]");
      const path = anchor ? hrefOf(anchor) : "";
      if (path) return navigateTo({ path, name: requested });
      const label = visibleLabel(picked.el) || nameOf(picked.el);
      press(picked.el);
      await settle(320);
      return { ok: true, message: `Clicked ${label}. ${snapshot()}` };
    }
    if (name === "fill") return fillByLabel(String(args.field || ""), String(args.value ?? ""));
    if (name === "hover") {
      const picked = pickControl(String(args.name || ""));
      if (!picked.el) {
        return {
          ok: false,
          message: `No control named "${args.name}". ${snapshot()}`,
        };
      }
      picked.el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      picked.el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      return { ok: true, message: `Hovered ${nameOf(picked.el)}. ${snapshot()}` };
    }
    if (name === "press_key") {
      const map = {
        enter: "Enter",
        escape: "Escape",
        esc: "Escape",
        tab: "Tab",
        space: " ",
        up: "ArrowUp",
        down: "ArrowDown",
        left: "ArrowLeft",
        right: "ArrowRight",
      };
      const key = map[normalize(args.key)] || String(args.key || "Enter");
      const target = document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
      target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      target.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true }));
      return { ok: true, message: `Pressed ${key}. ${snapshot()}` };
    }
    if (name === "navigate") return navigateTo(args);
    if (name === "scroll") {
      const dir = normalize(args.direction || "");
      const findScroller = (preferHorizontal) => {
        if (args.name) {
          const picked = pickControl(String(args.name));
          if (picked.el) {
            const nested = [
              picked.el,
              ...picked.el.querySelectorAll("div, ul, ol, section, [role='region']"),
            ].find((el) => {
              if (!(el instanceof HTMLElement) || !present(el)) return false;
              return preferHorizontal
                ? el.scrollWidth > el.clientWidth + 24
                : el.scrollHeight > el.clientHeight + 24;
            });
            if (nested) return nested;
            const ancestor = picked.el.closest("div, section, [role='region'], ul, ol");
            if (ancestor instanceof HTMLElement) return ancestor;
            if (!preferHorizontal) return picked.el;
          }
        }
        if (preferHorizontal) {
          const scope = overlayRoot() || document;
          return (
            [...scope.querySelectorAll("div, ul, ol, section, [role='region']")].find((el) => {
              if (!present(el) || inAssistant(el)) return false;
              const style = getComputedStyle(el);
              return (
                el.scrollWidth > el.clientWidth + 40 &&
                (style.overflowX === "auto" ||
                  style.overflowX === "scroll" ||
                  String(style.scrollSnapType || "").includes("x"))
              );
            }) || null
          );
        }
        return document.scrollingElement || document.documentElement;
      };

      if (args.name && !dir) {
        const picked = pickControl(String(args.name));
        if (!picked.el) {
          return { ok: false, message: `No item named "${args.name}". ${snapshot()}` };
        }
        picked.el.scrollIntoView({ block: "nearest", inline: "nearest" });
        return { ok: true, message: `Scrolled to ${nameOf(picked.el)}. ${snapshot()}` };
      }

      if (dir === "left" || dir === "right") {
        const box =
          findScroller(true) || document.scrollingElement || document.documentElement;
        const dx = Math.max(
          80,
          (box.clientWidth || window.innerWidth) * (args.amount === "small" ? 0.35 : 0.8),
        );
        box.scrollBy({ left: dir === "left" ? -dx : dx });
        return { ok: true, message: `Scrolled ${dir}. ${snapshot()}` };
      }

      const box = findScroller(false);
      const dy = Math.max(
        80,
        (box.clientHeight || window.innerHeight) * (args.amount === "small" ? 0.35 : 0.8),
      );
      if (dir === "up") box.scrollBy({ top: -dy });
      else if (dir === "top") box.scrollTo({ top: 0 });
      else if (dir === "bottom") box.scrollTo({ top: box.scrollHeight });
      else box.scrollBy({ top: dy });
      return { ok: true, message: `Scrolled ${dir || "down"}. ${snapshot()}` };
    }
    if (name === "media") return controlMedia(args);
    if (name === "close") {
      const overlay = overlayRoot();
      const close = controls(overlay).find((el) => {
        const label = normalize(nameOf(el));
        return label === "close" || label === "cancel" || label.startsWith("close ");
      });
      if (close) {
        close.click();
        return { ok: true, message: "Closed overlay." };
      }
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return { ok: true, message: "Sent escape." };
    }
    if (name === "remember_recipe") {
      recipes.set(normalize(args.name), String(args.steps || ""));
      return { ok: true, message: `Saved session recipe "${args.name}".` };
    }
    if (name === "forget_recipe") {
      recipes.delete(normalize(args.name));
      return { ok: true, message: `Forgot recipe "${args.name}".` };
    }
    if (name === "run_recipe") {
      const steps = recipes.get(normalize(args.name));
      if (!steps) return { ok: false, message: `No recipe named "${args.name}".` };
      return { ok: true, message: `Recipe "${args.name}": ${steps}` };
    }
    return { ok: false, message: `Unknown action ${name}` };
  }

  function mintField(data, field) {
    if (!data || typeof data !== "object") return null;
    const direct = data[field];
    if (typeof direct === "string" && direct.trim()) return direct.trim();
    const nested = data.results?.[field];
    if (typeof nested === "string" && nested.trim()) return nested.trim();
    return null;
  }

  const PCM_RATE = 24000;
  const GEMINI_INPUT_RATE = 16000;

  function floatTo16BitPCM(float32Array) {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }
    return new Uint8Array(buffer);
  }

  function downsampleToRate(float32Array, fromRate, toRate) {
    if (fromRate === toRate) return float32Array;
    const ratio = fromRate / toRate;
    const length = Math.max(1, Math.round(float32Array.length / ratio));
    const result = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
      result[i] = float32Array[Math.min(float32Array.length - 1, Math.floor(i * ratio))] || 0;
    }
    return result;
  }

  function bytesToBase64(bytes) {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function connectRealtime(options) {
    const session = {
      provider: null,
      peer: null,
      stream: null,
      audio: null,
      channel: null,
      channelBound: null,
      ws: null,
      audioContext: null,
      processor: null,
      source: null,
      playSources: [],
      playQueue: [],
      playing: false,
      muted: true,
      grokSessionReady: false,
      geminiSessionReady: false,
      liveReady: false,
      grokSyncTimer: null,
      geminiSetupFallbackTimer: null,
      geminiOutboundQueue: [],
      micStarted: false,
      model: "",
      voice: "",
      tools: TOOLS.slice(),
      systemInstructions: "",
      agentTranscript: "",
      realtimeWsUrl: null,
      wsTicket: null,
      hadAudioOutput: false,
      nextPlayTime: 0,
    };
    const handled = new Set();

    function transportReady() {
      if (session.provider === "grok-realtime" || session.provider === "gemini-live") {
        return session.ws?.readyState === WebSocket.OPEN;
      }
      return session.channel?.readyState === "open";
    }

    function sendWs(payload) {
      if (session.ws?.readyState === WebSocket.OPEN) {
        session.ws.send(JSON.stringify(payload));
      }
    }

    function isOpenAiWebrtc() {
      return (
        session.provider === "openai-realtime" ||
        session.provider === "openai-live"
      );
    }

    function isOpenAiLive() {
      return (
        session.provider === "openai-live" ||
        /^gpt-live(\b|-)/i.test(String(session.model || ""))
      );
    }

    function send(event) {
      if (session.provider === "grok-realtime" || session.provider === "gemini-live") {
        sendWs(event);
        return;
      }
      if (session.channel?.readyState === "open") {
        session.channel.send(JSON.stringify(event));
      }
    }

    function instructionBlock() {
      return [
        session.systemInstructions,
        `Current pathname: ${location.pathname}.`,
        snapshot(),
      ].join("\n");
    }

    function geminiModelResource(model) {
      const trimmed = String(model || "").trim();
      if (!trimmed) return "";
      return trimmed.startsWith("models/") ? trimmed : `models/${trimmed}`;
    }

    function flushGeminiOutbound() {
      if (!session.geminiSessionReady) return;
      while (session.geminiOutboundQueue.length) {
        sendWs(session.geminiOutboundQueue.shift());
      }
    }

    function sendGemini(payload) {
      const isAudio = Boolean(payload?.realtimeInput?.audio);
      if (!session.geminiSessionReady) {
        if (!isAudio) session.geminiOutboundQueue.push(payload);
        return;
      }
      sendWs(payload);
    }

    function geminiSchema(schema) {
      if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
        return { type: "object", properties: {} };
      }
      const next = { ...schema };
      delete next.additionalProperties;
      if (next.type === "object" && next.properties && typeof next.properties === "object") {
        const properties = {};
        for (const [key, value] of Object.entries(next.properties)) {
          properties[key] = geminiSchema(value);
        }
        next.properties = properties;
      }
      if (Array.isArray(next.enum)) {
        next.enum = next.enum.map((value) => String(value));
      }
      return next;
    }

    function geminiFunctionDeclarations() {
      return session.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: geminiSchema(tool.parameters),
      }));
    }

    function geminiSetup() {
      const setup = {
        model: geminiModelResource(session.model),
        generationConfig: {
          responseModalities: ["AUDIO"],
          ...(session.voice
            ? {
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: session.voice },
                  },
                },
              }
            : {}),
        },
        outputAudioTranscription: {},
        realtimeInputConfig: {
          automaticActivityDetection: { disabled: false },
        },
      };
      const declarations = geminiFunctionDeclarations();
      if (declarations.length) {
        setup.tools = [{ functionDeclarations: declarations }];
      }
      sendWs({ setup });
    }

    function sync() {
      if (session.provider === "gemini-live") {
        return;
      }
      if (session.provider === "grok-realtime") {
        send({
          type: "session.update",
          session: {
            voice: session.voice || "eve",
            instructions: instructionBlock(),
            turn_detection: { type: "server_vad" },
            tools: session.tools,
            audio: {
              input: { format: { type: "audio/pcm", rate: PCM_RATE } },
              output: { format: { type: "audio/pcm", rate: PCM_RATE } },
            },
          },
        });
        return;
      }
      if (isOpenAiLive()) {
        if (!session.liveReady) return;
        send({
          type: "session.update",
          session: {
            delegation: {
              type: "responses",
              responses: {
                instructions: instructionBlock(),
                tools: session.tools,
                tool_choice: "auto",
              },
            },
          },
        });
        return;
      }
      send({
        type: "session.update",
        session: {
          type: "realtime",
          instructions: instructionBlock(),
          tools: session.tools,
          tool_choice: "auto",
        },
      });
    }

    function collectCalls(event) {
      const items = [];
      const push = (item, fallback = {}) => {
        if (!item) return;
        const call_id = item.call_id || fallback.call_id;
        const name = item.name || fallback.name;
        const args =
          item.arguments ??
          item.input ??
          fallback.arguments ??
          fallback.input;
        if (!call_id || !name) return;
        items.push({
          call_id,
          name,
          arguments: typeof args === "string" ? args : JSON.stringify(args || {}),
        });
      };
      if (event.type === "response.function_call_arguments.done") {
        push({
          call_id: event.call_id,
          name: event.name,
          arguments: event.arguments,
        });
      }
      if (event.type === "response.output_item.done" && event.item?.type === "function_call") {
        push(event.item, event);
      }
      if (event.item?.type === "function_call") push(event.item);
      if (Array.isArray(event.response?.output)) {
        event.response.output.forEach((item) => {
          if (item?.type === "function_call") push(item);
        });
      }
      return items;
    }

    function markGrokReady() {
      if (session.grokSessionReady) return;
      session.grokSessionReady = true;
      if (session.grokSyncTimer) {
        clearTimeout(session.grokSyncTimer);
        session.grokSyncTimer = null;
      }
      if (!session.muted) {
        void ensureMicStream()
          .then(() => {
            resumeAudio();
            startMicCapture();
          })
          .catch(() => undefined);
      }
    }

    function markGeminiReady() {
      if (session.geminiSessionReady) return;
      session.geminiSessionReady = true;
      if (session.geminiSetupFallbackTimer) {
        clearTimeout(session.geminiSetupFallbackTimer);
        session.geminiSetupFallbackTimer = null;
      }
      flushGeminiOutbound();
      if (!session.muted) {
        void ensureMicStream()
          .then(() => {
            resumeAudio();
            startMicCapture();
          })
          .catch(() => undefined);
      }
      options.onGeminiReady?.();
    }

    function handleGeminiMessage(event) {
      try {
        window.__AIVAH_EVENTS = window.__AIVAH_EVENTS || [];
        window.__AIVAH_EVENTS.push({
          provider: "gemini-live",
          event: event.error ? { error: event.error } : {
            setupComplete: event.setupComplete != null,
            turnComplete: Boolean(event.serverContent?.turnComplete),
            toolCall: Boolean(event.toolCall?.functionCalls?.length),
          },
          at: Date.now(),
        });
        if (window.__AIVAH_EVENTS.length > 80) window.__AIVAH_EVENTS.shift();
      } catch {
        // ignore debug failures
      }
      if (event.error) {
        console.warn("Aivah Assistant Gemini error", event.error);
        options.onAgentText?.(
          typeof event.error === "string"
            ? event.error
            : event.error?.message || "Gemini session error",
          { clearAfterMs: 4000 },
        );
      }
      if (event.setupComplete != null) {
        markGeminiReady();
      }
      if (event.toolCall?.functionCalls?.length) {
        event.toolCall.functionCalls.forEach((call) => {
          if (!call?.id || !call?.name || handled.has(call.id)) return;
          handled.add(call.id);
          let parsed = {};
          try {
            parsed =
              typeof call.args === "string"
                ? JSON.parse(call.args || "{}")
                : call.args || {};
          } catch {
            parsed = {};
          }
          void runTool(call.name, parsed).then((result) => {
            sendGemini({
              toolResponse: {
                functionResponses: [
                  {
                    id: call.id,
                    name: call.name,
                    response: { result },
                  },
                ],
              },
            });
          });
        });
      }
      const serverContent = event.serverContent;
      if (serverContent?.interrupted) {
        resetPlayback();
      }
      if (typeof serverContent?.outputTranscription?.text === "string") {
        const snippet = serverContent.outputTranscription.text;
        if (snippet) {
          session.agentTranscript = `${session.agentTranscript || ""}${snippet}`;
          options.onAgentText?.(session.agentTranscript);
        }
      }
      const parts = serverContent?.modelTurn?.parts;
      if (Array.isArray(parts)) {
        parts.forEach((part) => {
          const inline = part?.inlineData;
          if (inline?.mimeType?.includes("audio") && inline.data) {
            session.hadAudioOutput = true;
            playPcmBase64(inline.data, parsePcmSampleRate(inline.mimeType, PCM_RATE));
          }
        });
      }
      if (serverContent?.turnComplete) {
        if (session.agentTranscript) {
          options.onAgentText?.(session.agentTranscript, { clearAfterMs: 2500 });
        } else {
          options.onAgentText?.("", { clearAfterMs: 0 });
        }
        session.agentTranscript = "";
        session.hadAudioOutput = false;
      }
    }

    function handleServerEvent(event) {
      if (event?.type === "response.event" && event.event && typeof event.event === "object") {
        handleServerEvent(event.event);
        return;
      }
      try {
        window.__AIVAH_EVENTS = window.__AIVAH_EVENTS || [];
        window.__AIVAH_EVENTS.push({
          type: event.type,
          name: event.name || event.item?.name || null,
          call_id: event.call_id || event.item?.call_id || null,
          arguments:
            event.arguments ||
            event.item?.arguments ||
            (Array.isArray(event.response?.output)
              ? event.response.output.find((i) => i?.type === "function_call")?.arguments
              : null) ||
            null,
          error: event.error || null,
          at: Date.now(),
        });
        if (window.__AIVAH_EVENTS.length > 80) window.__AIVAH_EVENTS.shift();
      } catch {
        // ignore debug failures
      }
      if (event.type === "error") {
        console.warn("Aivah Assistant session error", event.error || event);
        return;
      }
      if (event.type === "conversation.created") {
        if (session.provider === "grok-realtime" && !session.grokSessionReady) {
          sync();
        }
      }
      if (event.type === "session.updated") {
        if (session.provider === "grok-realtime") {
          markGrokReady();
        }
      }
      if (event.type === "session.started" && isOpenAiLive()) {
        session.liveReady = true;
        sync();
      }
      if (event.type === "session.output_transcript.delta") {
        const delta = event.delta || "";
        if (typeof delta === "string" && delta) {
          session.agentTranscript = `${session.agentTranscript || ""}${delta}`;
          options.onAgentText?.(session.agentTranscript);
        }
      }
      if (event.type === "response.created") {
        session.agentTranscript = "";
        session.hadAudioOutput = false;
        options.onAgentText?.("");
      }
      if (
        event.type === "response.output_audio_transcript.delta" ||
        event.type === "response.audio_transcript.delta" ||
        event.type === "response.output_text.delta"
      ) {
        const delta = event.delta || event.text || "";
        if (typeof delta === "string" && delta) {
          session.agentTranscript = `${session.agentTranscript || ""}${delta}`;
          options.onAgentText?.(session.agentTranscript);
        }
      }
      if (event.type === "response.output_audio_transcript.done") {
        const transcript =
          typeof event.transcript === "string"
            ? event.transcript
            : session.agentTranscript;
        if (transcript) {
          session.agentTranscript = transcript;
          options.onAgentText?.(transcript, { clearAfterMs: 2500 });
        }
      }
      if (event.type === "response.done") {
        const outputs = Array.isArray(event.response?.output) ? event.response.output : [];
        const textPart = outputs.find((item) => item?.type === "message" || item?.type === "output_text");
        const text =
          session.agentTranscript ||
          (typeof textPart?.content?.[0]?.text === "string"
            ? textPart.content[0].text
            : typeof textPart?.text === "string"
              ? textPart.text
              : session.hadAudioOutput
                ? "Assistant responded (audio)"
                : "");
        if (text) options.onAgentText?.(text, { clearAfterMs: 2500 });
        else options.onAgentText?.("", { clearAfterMs: 2500 });
        session.agentTranscript = "";
        session.hadAudioOutput = false;
      }
      if (event.type === "response.output_audio.delta") {
        session.hadAudioOutput = true;
        const chunk = event.delta || event.audio;
        if (typeof chunk === "string") playPcmBase64(chunk);
        return;
      }
      collectCalls(event).forEach((item) => {
        if (handled.has(item.call_id)) return;
        // Wait for real args when the model streams an empty done first.
        if (
          (!item.arguments || item.arguments === "{}") &&
          event.type !== "response.output_item.done" &&
          event.type !== "response.done"
        ) {
          return;
        }
        handled.add(item.call_id);
        let parsed = {};
        try {
          parsed = JSON.parse(item.arguments || "{}");
        } catch {
          parsed = {};
        }
        // Some models put a bare string into name/path incorrectly; normalize.
        if (typeof parsed === "string") parsed = { name: parsed, path: parsed };
        void runTool(item.name, parsed).then((result) => {
          try {
            window.__AIVAH_TOOL_LOG = window.__AIVAH_TOOL_LOG || [];
            window.__AIVAH_TOOL_LOG.push({
              name: item.name,
              args: parsed,
              ok: Boolean(result?.ok),
              message: String(result?.message || "").slice(0, 200),
              path: location.pathname,
              at: Date.now(),
            });
            if (window.__AIVAH_TOOL_LOG.length > 40) window.__AIVAH_TOOL_LOG.shift();
          } catch {
            // ignore
          }
          if (isOpenAiLive()) {
            send({
              type: "response.item.create",
              item: {
                type: "function_call_output",
                call_id: item.call_id,
                output: JSON.stringify(result),
              },
            });
          } else {
            send({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: item.call_id,
                output: JSON.stringify(result),
              },
            });
          }
          send({ type: "response.create" });
        });
      });
    }

    function onChannelMessage(message) {
      let event;
      try {
        event = JSON.parse(message.data);
      } catch {
        return;
      }
      handleServerEvent(event);
    }

    function parsePcmSampleRate(mimeType, fallback = PCM_RATE) {
      const match = String(mimeType || "").match(/rate=(\d+)/i);
      const rate = match ? Number(match[1]) : fallback;
      return Number.isFinite(rate) && rate > 0 ? rate : fallback;
    }

    function resetPlayback() {
      session.playQueue = [];
      session.playing = false;
      session.nextPlayTime = 0;
      for (const source of session.playSources) {
        try {
          source.stop();
        } catch {
          // ignore
        }
      }
      session.playSources = [];
    }

    function ensureAudioContext() {
      if (session.audioContext) return session.audioContext;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      session.audioContext = new Ctx();
      session.playQueue = [];
      session.playing = false;
      session.playSources = [];
      return session.audioContext;
    }

    function schedulePcmFloats(floats, sampleRate = PCM_RATE) {
      const ctx = ensureAudioContext();
      void ctx.resume().catch(() => undefined);
      const buffer = ctx.createBuffer(1, floats.length, sampleRate);
      buffer.copyToChannel(floats, 0);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      const startAt = Math.max(ctx.currentTime, session.nextPlayTime || 0);
      try {
        source.start(startAt);
        session.nextPlayTime = startAt + buffer.duration;
        session.playSources.push(source);
        source.onended = () => {
          const index = session.playSources.indexOf(source);
          if (index >= 0) session.playSources.splice(index, 1);
        };
      } catch {
        // ignore scheduling failures
      }
    }

    function playNextChunk() {
      const ctx = session.audioContext;
      if (!ctx || !session.playQueue.length) {
        session.playing = false;
        return;
      }
      session.playing = true;
      const floats = session.playQueue.shift();
      const buffer = ctx.createBuffer(1, floats.length, PCM_RATE);
      buffer.copyToChannel(floats, 0);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      session.playSources = [source];
      source.onended = () => {
        if (session.playSources[0] === source) session.playSources = [];
        playNextChunk();
      };
      try {
        source.start();
      } catch {
        session.playing = false;
      }
    }

    function playPcmBase64(base64, sampleRate = PCM_RATE) {
      try {
        const bytes = base64ToBytes(base64);
        const sampleCount = Math.floor(bytes.length / 2);
        if (!sampleCount) return;
        const view = new DataView(bytes.buffer, bytes.byteOffset, sampleCount * 2);
        const floats = new Float32Array(sampleCount);
        for (let i = 0; i < sampleCount; i += 1) {
          floats[i] = view.getInt16(i * 2, true) / 0x8000;
        }
        schedulePcmFloats(floats, sampleRate);
      } catch (error) {
        console.warn("Aivah Assistant audio playback failed", error);
      }
    }

    function resumeAudio() {
      const ctx = ensureAudioContext();
      void ctx.resume().catch(() => undefined);
    }

    async function ensureMicStream() {
      if (session.stream) return session.stream;
      session.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      session.stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
      return session.stream;
    }

    function startMicCapture() {
      if (session.micStarted) return;
      if (!session.stream) return;
      session.micStarted = true;
      const ctx = ensureAudioContext();
      resumeAudio();
      session.source = ctx.createMediaStreamSource(session.stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      session.processor = processor;
      processor.onaudioprocess = (event) => {
        if (session.muted) return;
        if (session.provider === "grok-realtime" || session.provider === "gemini-live") {
          if (session.ws?.readyState !== WebSocket.OPEN) return;
          if (session.provider === "gemini-live" && !session.geminiSessionReady) return;
        }
        const input = event.inputBuffer.getChannelData(0);
        const down = downsampleToRate(
          input,
          ctx.sampleRate,
          session.provider === "gemini-live" ? GEMINI_INPUT_RATE : PCM_RATE,
        );
        const pcm = floatTo16BitPCM(down);
        if (session.provider === "gemini-live") {
          sendGemini({
            realtimeInput: {
              audio: {
                mimeType: `audio/pcm;rate=${GEMINI_INPUT_RATE}`,
                data: bytesToBase64(pcm),
              },
            },
          });
          return;
        }
        send({
          type: "input_audio_buffer.append",
          audio: bytesToBase64(pcm),
        });
      };
      const silent = ctx.createGain();
      silent.gain.value = 0;
      session.source.connect(processor);
      processor.connect(silent);
      silent.connect(ctx.destination);
    }

    function bindChannel(channel) {
      if (!channel || session.channelBound === channel) return;
      session.channel = channel;
      session.channelBound = channel;
      channel.addEventListener("message", onChannelMessage);
      const startSync = () => {
        if (isOpenAiLive() && !session.liveReady) return;
        sync();
      };
      if (channel.readyState === "open") startSync();
      else channel.addEventListener("open", startSync, { once: true });
    }

    function waitForIce(peer) {
      if (!peer || peer.iceGatheringState === "complete") return Promise.resolve();
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          peer.removeEventListener("icegatheringstatechange", onState);
          resolve();
        }, 8000);
        function onState() {
          if (peer.iceGatheringState !== "complete") return;
          clearTimeout(timer);
          peer.removeEventListener("icegatheringstatechange", onState);
          resolve();
        }
        peer.addEventListener("icegatheringstatechange", onState);
      });
    }

    function parseWsJsonMessage(data) {
      let text = "";
      if (typeof data === "string") {
        text = data;
      } else if (data instanceof ArrayBuffer) {
        text = new TextDecoder().decode(data);
      } else if (ArrayBuffer.isView(data)) {
        text = new TextDecoder().decode(data.buffer, data.byteOffset, data.byteLength);
      } else if (data && typeof data.text === "function") {
        return data.text().then((value) => {
          try {
            return JSON.parse(value);
          } catch {
            return null;
          }
        });
      } else {
        return null;
      }
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    }

    function handleWsMessage(data, handler) {
      const parsed = parseWsJsonMessage(data);
      if (parsed && typeof parsed.then === "function") {
        void parsed.then((event) => {
          if (event) handler(event);
        });
        return;
      }
      if (parsed) handler(parsed);
    }

    function connectRealtimeWs(sessionId, wsTicket, label) {
      if (!sessionId) {
        return Promise.reject(new Error("Realtime session id was missing."));
      }
      if (!session.realtimeWsUrl) {
        return Promise.reject(new Error("Realtime WebSocket URL was missing."));
      }
      if (!wsTicket) {
        return Promise.reject(new Error("Realtime ws ticket was missing."));
      }
      return new Promise((resolve, reject) => {
        const wsUrl = new URL(session.realtimeWsUrl);
        wsUrl.searchParams.set("sessionId", sessionId);
        wsUrl.searchParams.set("wsTicket", wsTicket);
        const ws = new WebSocket(wsUrl.toString());
        ws.binaryType = "arraybuffer";
        session.ws = ws;
        let opened = false;
        const timer = setTimeout(() => {
          if (!opened) {
            ws.close();
            reject(new Error(`${label} connection timed out.`));
          }
        }, 15000);
        ws.onopen = () => {
          opened = true;
          clearTimeout(timer);
          resolve();
        };
        ws.onerror = () => {
          clearTimeout(timer);
          if (!opened) reject(new Error(`${label} WebSocket failed.`));
        };
        ws.onclose = () => {
          clearTimeout(timer);
        };
      });
    }

    function connectGrok(sessionId, wsTicket) {
      return connectRealtimeWs(sessionId, wsTicket, "Grok Realtime").then(() => {
        sync();
        session.grokSyncTimer = setTimeout(() => {
          if (!session.grokSessionReady && session.ws?.readyState === WebSocket.OPEN) {
            console.warn(
              "Aivah Assistant: Grok session.updated not received; allowing microphone input.",
            );
            markGrokReady();
          }
        }, 3000);
        session.ws.onmessage = (message) => {
          handleWsMessage(message.data, handleServerEvent);
        };
      });
    }

    function connectGemini(sessionId, wsTicket) {
      return connectRealtimeWs(sessionId, wsTicket, "Gemini Live").then(() => {
        geminiSetup();
        session.geminiSetupFallbackTimer = setTimeout(() => {
          if (!session.geminiSessionReady && session.ws?.readyState === WebSocket.OPEN) {
            console.warn("Aivah Assistant: Gemini setupComplete not received; allowing queued input.");
            markGeminiReady();
          }
        }, 8000);
        session.ws.onmessage = (message) => {
          handleWsMessage(message.data, handleGeminiMessage);
        };
        session.ws.onclose = (closeEvent) => {
          if (!session.geminiSessionReady) {
            options.onSessionIssue?.(
              closeEvent.reason || "Gemini connection closed before setup completed.",
            );
          }
        };
        session.ws.onerror = () => {
          options.onSessionIssue?.("Gemini connection error.");
        };
      });
    }

    async function connectOpenAi(sessionId) {
      if (!sessionId) {
        throw new Error("Realtime session id was missing.");
      }
      session.peer = new RTCPeerConnection();
      session.audio = document.createElement("audio");
      session.audio.autoplay = true;
      session.audio.setAttribute("playsinline", "true");
      document.body.appendChild(session.audio);
      session.peer.ontrack = (event) => {
        session.audio.srcObject = event.streams[0];
        void session.audio.play().catch(() => undefined);
      };
      session.stream.getTracks().forEach((track) => session.peer.addTrack(track, session.stream));
      bindChannel(session.peer.createDataChannel("oai-events"));
      session.peer.addEventListener("datachannel", (event) => bindChannel(event.channel));
      const offer = await session.peer.createOffer();
      await session.peer.setLocalDescription(offer);
      if (isOpenAiLive()) await waitForIce(session.peer);
      const localSdp = session.peer.localDescription?.sdp || offer.sdp;
      const sdpResponse = await fetch(options.sessionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, sdp: localSdp }),
      });
      const sdpPayload = await sdpResponse.json().catch(() => ({}));
      if (!sdpResponse.ok) {
        throw new Error(sdpPayload.error || "Realtime WebRTC connection failed.");
      }
      const answerSdp =
        typeof sdpPayload.sdp === "string" ? sdpPayload.sdp : null;
      if (!answerSdp) throw new Error("Realtime SDP answer was missing.");
      if (!session.peer || session.peer.signalingState === "closed") return;
      await session.peer.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      });
    }

    async function loadAssistantConfig(configUrl) {
      if (!configUrl) return {};
      try {
        const response = await fetch(configUrl, { cache: "no-store" });
        if (!response.ok) return {};
        const data = await response.json();
        return data && typeof data === "object" && !Array.isArray(data) ? data : {};
      } catch {
        return {};
      }
    }

    async function start() {
      session.muted = true;
      const cfg = await loadAssistantConfig(options.configUrl);
      const tokenResponse = await fetch(options.sessionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pathname: location.pathname,
          uiView: snapshot(),
          provider: cfg.provider,
          model: cfg.model,
          voice: cfg.voice,
        }),
      });
      const tokenData = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok) {
        throw new Error(tokenData.error || "Unable to start AI Assistant.");
      }
      const provider = tokenData.provider;
      if (!provider) throw new Error("Realtime provider was missing from mint response.");
      session.provider = provider;
      session.model = tokenData.model || mintField(tokenData, "model") || "";
      const systemInstructions = mintField(tokenData, "systemInstructions");
      if (!systemInstructions) {
        throw new Error("Realtime systemInstructions were missing from mint response.");
      }
      session.systemInstructions = systemInstructions;
      session.voice = tokenData.voice || cfg.voice || "";
      if (provider === "grok-realtime" && !session.voice) session.voice = "eve";
      if (provider === "openai-live" && !session.voice) session.voice = "quartz";
      if (provider === "openai-realtime" && !session.voice) session.voice = "marin";
      session.realtimeWsUrl = mintField(tokenData, "realtimeWsUrl");
      session.tools = TOOLS.slice();

      if (provider === "grok-realtime") {
        const sessionId = mintField(tokenData, "sessionId");
        const wsTicket = mintField(tokenData, "wsTicket");
        if (!sessionId) throw new Error("Realtime session id was missing.");
        await ensureMicStream();
        await connectGrok(sessionId, wsTicket);
        return;
      }
      if (provider === "gemini-live") {
        const sessionId = mintField(tokenData, "sessionId");
        const wsTicket = mintField(tokenData, "wsTicket");
        if (!sessionId) throw new Error("Realtime session id was missing.");
        if (!session.model) throw new Error("Realtime model was missing.");
        await ensureMicStream();
        await connectGemini(sessionId, wsTicket);
        return;
      }
      if (isOpenAiWebrtc()) {
        await ensureMicStream();
        const sessionId = mintField(tokenData, "sessionId");
        if (!sessionId) throw new Error("Realtime session id was missing.");
        await connectOpenAi(sessionId);
        return;
      }
      throw new Error(`${provider} is not available in this widget yet.`);
    }

    function stop() {
      resetPlayback();
      try {
        session.processor?.disconnect();
      } catch {
        // ignore
      }
      try {
        session.source?.disconnect();
      } catch {
        // ignore
      }
      session.processor = null;
      session.source = null;
      session.micStarted = false;
      session.grokSessionReady = false;
      session.geminiSessionReady = false;
      if (isOpenAiLive() && session.channel?.readyState === "open") {
        try {
          session.channel.send(JSON.stringify({ type: "session.close" }));
        } catch {
          // ignore
        }
      }
      session.liveReady = false;
      session.geminiOutboundQueue = [];
      if (session.grokSyncTimer) {
        clearTimeout(session.grokSyncTimer);
        session.grokSyncTimer = null;
      }
      if (session.geminiSetupFallbackTimer) {
        clearTimeout(session.geminiSetupFallbackTimer);
        session.geminiSetupFallbackTimer = null;
      }
      if (session.audioContext) {
        void session.audioContext.close().catch(() => undefined);
        session.audioContext = null;
      }
      if (session.ws) {
        try {
          session.ws.close();
        } catch {
          // ignore
        }
        session.ws = null;
      }
      session.channel?.close();
      session.peer?.close();
      session.stream?.getTracks().forEach((track) => track.stop());
      session.audio?.remove();
    }

    function setMuted(muted) {
      session.muted = Boolean(muted);
      session.stream?.getAudioTracks().forEach((track) => {
        track.enabled = !session.muted;
      });
      if (session.muted) return;
      if (session.provider === "grok-realtime" || session.provider === "gemini-live") {
        void ensureMicStream()
          .then(() => {
            resumeAudio();
            startMicCapture();
          })
          .catch((error) => {
            console.warn("Aivah Assistant microphone unavailable", error);
            options.onAgentText?.("Microphone unavailable. You can still type messages.", {
              clearAfterMs: 3500,
            });
          });
      }
    }

    function sendText(text) {
      const message = String(text || "").trim();
      if (!message || !transportReady()) return false;
      if (session.provider === "gemini-live") {
        sendGemini({
          clientContent: {
            turns: [{ role: "user", parts: [{ text: message }] }],
            turnComplete: true,
          },
        });
        return true;
      }
      sync();
      if (isOpenAiLive()) {
        send({
          type: "response.item.create",
          item: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: message }],
          },
        });
        send({ type: "response.create" });
        return true;
      }
      send({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: message }],
        },
      });
      send({ type: "response.create" });
      return true;
    }

    return { start, stop, setMuted, sync, sendText };
  }

  const ICONS = {
    phone:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.68 2.34a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.74-1.25a2 2 0 0 1 2.11-.45c.74.32 1.53.55 2.34.68A2 2 0 0 1 22 16.92z"/></svg>',
    hang:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
    micOff:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2"/><path d="M19 10v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
    min: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  };

  const WIDGET_CSS = `
    :host, * { box-sizing: border-box; font-family: system-ui, sans-serif; }
    button { color: inherit; pointer-events: auto; }
    svg { width: 22px; height: 22px; display: block; }
    .fab {
      pointer-events: auto;
      width: 72px; height: 72px; border: 1px solid rgba(255,255,255,.14); border-radius: 999px; cursor: grab;
      display: grid; place-items: center; background: #18181b; color: #f4f4f5;
      box-shadow: 0 10px 28px rgba(0,0,0,.28), 0 0 0 1px rgba(0,0,0,.06);
      touch-action: none;
      user-select: none;
    }
    .fab:active { cursor: grabbing; }
    .fab svg { width: 28px; height: 28px; pointer-events: none; }
    .panel {
      pointer-events: auto;
      width: 300px; height: 380px; border-radius: 28px; background: #fff;
      box-shadow: 0 16px 50px rgba(0,0,0,.16); display: flex; flex-direction: column;
      overflow: hidden;
      touch-action: none;
    }
    .panel input, .panel form { pointer-events: auto; }
    .bar { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px 0; cursor: grab; touch-action: none; user-select: none; }
    .bar p, .hint { margin: 0; font-size: 12px; color: #71717a; }
    .min { border: 0; background: transparent; cursor: pointer; color: #71717a; width: 36px; height: 36px; display: grid; place-items: center; border-radius: 999px; }
    .body { flex: 1; display: grid; place-items: center; text-align: center; padding: 0 20px; gap: 12px; }
    .orb {
      width: 84px; height: 84px; border-radius: 999px; display: grid; place-items: center;
      background: #18181b;
      color: #f4f4f5;
      box-shadow: 0 8px 24px rgba(0,0,0,.18);
    }
    .orb svg { width: 32px; height: 32px; }
    .live .orb { box-shadow: 0 0 0 2px rgba(24,24,27,.2), 0 8px 24px rgba(0,0,0,.18); }
    .actions { display: flex; justify-content: center; gap: 16px; padding-bottom: 12px; }
    .round { width: 44px; height: 44px; border: 0; border-radius: 999px; cursor: pointer; display: grid; place-items: center; }
    .hang { background: #f43f5e; color: #fff; }
    .mute { background: #f4f4f5; color: #18181b; }
    .start { border: 0; border-radius: 999px; width: 48px; height: 48px; background: #18181b; color: #fff; cursor: pointer; display: grid; place-items: center; }
    .composer {
      display: flex; gap: 8px; align-items: center; padding: 0 14px 14px;
    }
    .composer input {
      flex: 1; min-width: 0; height: 40px; border: 1px solid #e4e4e7; border-radius: 999px;
      padding: 0 14px; font-size: 13px; color: #18181b; background: #fafafa; outline: none;
    }
    .composer input:focus { border-color: #a1a1aa; background: #fff; }
    .composer input:disabled { opacity: 0.55; }
    .composer button {
      width: 40px; height: 40px; border: 0; border-radius: 999px; cursor: pointer;
      display: grid; place-items: center; background: #18181b; color: #fff; flex-shrink: 0;
    }
    .composer button:disabled { opacity: 0.45; cursor: default; }
    .composer button svg { width: 16px; height: 16px; }
    .agent-line {
      margin: 0 14px 8px; padding: 8px 10px; border-radius: 10px; background: #f4f4f5;
      font-size: 12px; line-height: 1.35; color: #3f3f46; min-height: 34px;
      max-height: 72px; overflow-x: hidden; overflow-y: auto;
      text-align: left; direction: ltr; unicode-bidi: isolate;
    }
    .agent-line[hidden] { display: none; }
    .agent-line-text {
      display: block; width: 100%; text-align: left; direction: ltr;
      white-space: pre-wrap; word-break: break-word;
    }
  `;

  function mount(options = {}) {
    if (mounted) return window.AivahAssistant;
    mounted = true;
    const sessionUrl = options.sessionUrl || "/api/realtime/ai-assistant";
    const configUrl = options.configUrl || "/aivah-assistant/assistant.json";
    const POS_KEY = "aivah-assistant-fab-pos";
    const host = document.createElement("div");
    host.setAttribute("data-aivah-assistant", "");
    host.style.cssText = [
      "position:fixed",
      "z-index:2147483646",
      "width:auto",
      "height:auto",
      "margin:0",
      "padding:0",
      "border:0",
      "background:transparent",
      "display:block",
      "pointer-events:none",
      "inset:auto",
    ].join(";");
    document.documentElement.appendChild(host);
    const root = host.attachShadow({ mode: "open" });

    let expanded = false;
    let status = "idle";
    let muted = true;
    let realtime = null;
    let draft = "";
    let agentLineText = "";
    let agentLineTimer = null;

    function setAgentLine(text, opts = {}) {
      agentLineText = String(text || "");
      if (agentLineTimer) clearTimeout(agentLineTimer);
      agentLineTimer = null;
      const line = root.querySelector(".agent-line");
      const span = root.querySelector(".agent-line-text");
      if (line && span && expanded) {
        span.textContent = agentLineText;
        line.hidden = !agentLineText;
        line.title = agentLineText;
        line.scrollTop = line.scrollHeight;
      } else {
        render();
      }
      if (opts.clearAfterMs) {
        agentLineTimer = setTimeout(() => {
          agentLineText = "";
          render();
        }, opts.clearAfterMs);
      }
    }

    function defaultPos(width, height) {
      return {
        left: Math.max(16, window.innerWidth - width - 16),
        top: Math.max(16, window.innerHeight - height - 16),
      };
    }

    function savePos() {
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(pos));
      } catch {
        // ignore
      }
    }

    // Always start bottom-right (before connect and after hang-up).
    let pos = defaultPos(72, 72);

    function clampPos(next, width, height) {
      const maxLeft = Math.max(8, window.innerWidth - width - 8);
      const maxTop = Math.max(8, window.innerHeight - height - 8);
      return {
        left: Math.min(maxLeft, Math.max(8, next.left)),
        top: Math.min(maxTop, Math.max(8, next.top)),
      };
    }

    function applyPos() {
      const width = expanded ? 300 : 72;
      const height = expanded ? 380 : 72;
      if (!pos) pos = defaultPos(width, height);
      pos = clampPos(pos, width, height);
      host.style.left = `${Math.round(pos.left)}px`;
      host.style.top = `${Math.round(pos.top)}px`;
      host.style.right = "auto";
      host.style.bottom = "auto";
    }

    function bindDrag(handle, opts = {}) {
      if (!(handle instanceof HTMLElement)) return;
      let dragging = false;
      let moved = false;
      let startX = 0;
      let startY = 0;
      let originLeft = 0;
      let originTop = 0;

      const onPointerDown = (event) => {
        if (event.button != null && event.button !== 0) return;
        if (opts.ignore?.(event)) return;
        dragging = true;
        moved = false;
        startX = event.clientX;
        startY = event.clientY;
        const width = expanded ? 300 : 72;
        const height = expanded ? 380 : 72;
        if (!pos) pos = defaultPos(width, height);
        originLeft = pos.left;
        originTop = pos.top;
        handle.setPointerCapture?.(event.pointerId);
        event.preventDefault();
      };

      const onPointerMove = (event) => {
        if (!dragging) return;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        if (!moved && dx * dx + dy * dy < 25) return;
        moved = true;
        const width = expanded ? 300 : 72;
        const height = expanded ? 380 : 72;
        pos = clampPos(
          { left: originLeft + dx, top: originTop + dy },
          width,
          height,
        );
        applyPos();
      };

      const onPointerUp = (event) => {
        if (!dragging) return;
        dragging = false;
        try {
          handle.releasePointerCapture?.(event.pointerId);
        } catch {
          // ignore
        }
        if (moved) {
          savePos();
          handle.dataset.aivahDragged = "1";
          setTimeout(() => {
            delete handle.dataset.aivahDragged;
          }, 0);
        }
      };

      handle.addEventListener("pointerdown", onPointerDown);
      handle.addEventListener("pointermove", onPointerMove);
      handle.addEventListener("pointerup", onPointerUp);
      handle.addEventListener("pointercancel", onPointerUp);
    }

    function sendTypedMessage(text) {
      const message = String(text || draft || "").trim();
      if (!message || status !== "connected" || !realtime?.sendText) return false;
      const sent = realtime.sendText(message);
      if (sent) draft = "";
      return sent;
    }

    function render(focusComposer = false) {
      if (!expanded) {
        root.innerHTML = `<style>${WIDGET_CSS}</style>
          <button class="fab" type="button" aria-label="Open AI Assistant">${ICONS.phone}</button>`;
        const fab = root.querySelector(".fab");
        bindDrag(fab);
        fab.onclick = (event) => {
          if (fab.dataset.aivahDragged === "1") {
            event.preventDefault();
            return;
          }
          expanded = true;
          applyPos();
          render(true);
          if (status === "idle" || status === "error") void connect();
        };
        applyPos();
        return;
      }
      const live = status === "connecting" || status === "connected";
      const ready = status === "connected";
      const orbIcon =
        status === "connecting"
          ? ICONS.phone
          : muted
            ? ICONS.micOff
            : ICONS.mic;
      root.innerHTML = `<style>${WIDGET_CSS}</style>
        <div class="panel${live ? " live" : ""}">
          <div class="bar"><p>${statusLabel()}</p><button type="button" class="min" aria-label="Minimize">${ICONS.min}</button></div>
          <div class="body"><div class="orb">${orbIcon}</div><p class="hint">${statusLabel()}</p></div>
          ${agentLineText ? `<p class="agent-line" title="${agentLineText.replace(/"/g, "&quot;")}"><span class="agent-line-text">${agentLineText.replace(/</g, "&lt;")}</span></p>` : ""}
          <div class="actions">${
            live
              ? `<button class="round hang" type="button" aria-label="Hang up">${ICONS.hang}</button>
                 <button class="round mute" type="button" aria-label="${muted ? "Unmute" : "Mute"}">${muted ? ICONS.micOff : ICONS.mic}</button>`
              : `<button class="start" type="button" aria-label="${status === "error" ? "Retry" : "Start"}">${ICONS.phone}</button>`
          }</div>
          <form class="composer">
            <input type="text" name="message" placeholder="${ready ? "Type a test message…" : "Connect to type…"}" value="${draft.replace(/"/g, "&quot;")}" ${ready ? "" : "disabled"} autocomplete="off" />
            <button type="submit" aria-label="Send" ${ready ? "" : "disabled"}>${ICONS.send}</button>
          </form>
        </div>`;
      const bar = root.querySelector(".bar");
      bindDrag(bar, {
        ignore: (event) => Boolean(event.target?.closest?.("button")),
      });
      root.querySelector(".min").onclick = () => {
        expanded = false;
        applyPos();
        render();
      };
      const hang = root.querySelector(".hang");
      if (hang) {
        hang.onclick = () => {
          realtime?.stop();
          realtime = null;
          status = "idle";
          muted = true;
          draft = "";
          expanded = false;
          pos = defaultPos(72, 72);
          savePos();
          applyPos();
          render();
        };
      }
      const mute = root.querySelector(".mute");
      if (mute) {
        mute.onclick = () => {
          muted = !muted;
          realtime?.setMuted(muted);
          render(true);
        };
      }
      const start = root.querySelector(".start");
      if (start) start.onclick = () => void connect();
      const form = root.querySelector(".composer");
      const input = root.querySelector('input[name="message"]');
      if (input) {
        input.oninput = () => {
          draft = input.value;
        };
      }
      if (form) {
        form.onsubmit = (event) => {
          event.preventDefault();
          const text = (input?.value || draft).trim();
          if (!sendTypedMessage(text)) return;
          render(true);
        };
      }
      if (input) {
        input.onkeydown = (event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            const text = (input.value || draft).trim();
            if (!text) return;
            if (!sendTypedMessage(text)) return;
            render(true);
          }
        };
      }
      if (focusComposer && input && !input.disabled) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
      applyPos();
    }

    function statusLabel() {
      if (status === "connecting") return "Connecting…";
      if (status === "connected") return muted ? "Microphone muted" : "Connected";
      if (status === "error") return "Retry";
      return "Call";
    }

    async function connect() {
      if (status === "connecting" || status === "connected") return;
      status = "connecting";
      render();
      try {
        realtime = connectRealtime({
          sessionUrl,
          configUrl,
          onAgentText: (text, opts) => setAgentLine(text, opts),
          onGeminiReady: () => {
            if (status === "connected") render(true);
          },
          onSessionIssue: (message) => {
            if (status !== "connected" && status !== "connecting") return;
            status = "error";
            setAgentLine(String(message || "Connection lost."), { clearAfterMs: 5000 });
            render();
          },
        });
        await realtime.start();
        realtime.setMuted(true);
        muted = true;
        status = "connected";
        render(true);
      } catch (error) {
        realtime?.stop();
        realtime = null;
        status = "error";
        render();
        console.error(error);
      }
    }

    window.addEventListener("resize", () => applyPos());
    applyPos();
    render();
    window.AivahAssistant = Object.assign(window.AivahAssistant || {}, {
      sendText: (text) => sendTypedMessage(text),
    });
    return window.AivahAssistant;
  }

  window.AivahAssistant = Object.assign(window.AivahAssistant || {}, {
    mount,
    tools: TOOLS,
    registerTool(tool) {
      if (!tool?.schema?.name || typeof tool.execute !== "function") return;
      hostTools.set(tool.schema.name, tool);
    },
    unregisterTool(name) {
      hostTools.delete(name);
    },
    execute: runTool,
    sendText(text) {
      return false;
    },
  });

  const tag =
    document.currentScript instanceof HTMLScriptElement
      ? document.currentScript
      : document.querySelector("script[src*='aivah-assistant']");
  const sessionUrl = tag?.getAttribute("data-session");
  const configUrl = tag?.getAttribute("data-config") || "/aivah-assistant/assistant.json";
  if (sessionUrl && tag.getAttribute("data-auto") !== "false") {
    const boot = () => mount({ sessionUrl, configUrl });
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
      boot();
    }
  }
})();
