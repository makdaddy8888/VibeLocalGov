(function () {
  "use strict";

  const PREFS_KEY = "vibelocalgov-prefs-v1";
  const DRAFT_KEY = "vibelocalgov-draft-v1";
  const SUBMISSIONS_KEY = "vibelocalgov-submissions-v1";
  const TEST_PANEL_KEY = "vibelocalgov-test-panel-open";
  const MAX_SAVED = 30;

  /** Last successful generate: used for copy/download this response. */
  var lastRecord = null;

  const $ = function (id) {
    return document.getElementById(id);
  };

  const TERM_LABELS = {
    lt1: "less than 1 year",
    "1-2": "1–2 years",
    "3-5": "3–5 years",
    "6-10": "6–10 years",
    "11-20": "11–20 years",
    "20plus": "more than 20 years",
  };

  const TIME_LABELS = {
    lt1: "under 1 hour per week",
    "1-3": "1–3 hours per week",
    "3-5": "3–5 hours per week",
    "5-10": "5–10 hours per week",
    "10plus": "10+ hours per week",
    unsure: "unsure or highly variable",
  };

  function isLocalDev() {
    var h = window.location.hostname;
    return h === "127.0.0.1" || h === "localhost" || h === "[::1]";
  }

  function normalizeCouncilKey(s) {
    var t = String(s || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (!t) return "";
    if (t.length > 64) t = t.slice(0, 64);
    if (t.charAt(0) === "-" || t.slice(-1) === "-") return "";
    return t;
  }

  function councilKeyFromEmail(email) {
    var parts = String(email || "").split("@");
    var d = (parts[1] && parts[1].toLowerCase()) || "";
    if (!d) return "unknown-council";
    d = d.replace(/\.gov\.au$/i, "");
    d = d.replace(/[^a-z0-9.]+/g, "");
    d = d.replace(/\./g, "-");
    var n = normalizeCouncilKey(d);
    return n || "council";
  }

  function resolveCouncilKey() {
    var raw = form.elements["council-key"] && form.elements["council-key"].value;
    var fromInput = normalizeCouncilKey(raw);
    if (fromInput) return fromInput;
    return councilKeyFromEmail(form.elements["email"] && form.elements["email"].value);
  }

  const TEST_PRESETS = {
    "customer-service": {
      label: "Customer service",
      data: {
        "full-name": "Alex River (TEST — fictional)",
        email: "alex.river@testdemocouncil.nsw.gov.au",
        "council-key": "demo-bays",
        position: "Customer Service Officer",
        "work-area": "customer-service",
        tenure: "3-5",
        pain:
          "[TEST] Same five rate and waste questions all day; approved answers are split between CRM, intranet PDFs, and a shared mailbox — we re-key the same details after every other call.",
        "time-cost": "5-10",
        benefits:
          "[TEST] One search that returns only council-approved answers with links; less after-call re-entry; fewer wrong dates given to the public.",
        "include-name": false,
      },
    },
    planning: {
      label: "Planning & DA",
      data: {
        "full-name": "Sam Dale (TEST — fictional)",
        email: "sam.dale@testdemocouncil.nsw.gov.au",
        "council-key": "demo-bays",
        position: "Development Assessment Officer",
        "work-area": "planning",
        tenure: "1-2",
        pain:
          "[TEST] Applications arrive incomplete; we write the same RFI on missing DCP checklists, and I copy LEP/DCP references by hand from PDFs for every RFI — groundhog day.",
        "time-cost": "3-5",
        benefits:
          "[TEST] Pre-lodgement checklist for applicants; first-pass RFI with clause references for my review before it goes out; fewer repeat RFIs for basics.",
        "include-name": false,
      },
    },
    finance: {
      label: "Finance & rates",
      data: {
        "full-name": "Jordan Pine (TEST — fictional)",
        email: "jordan.pine@testdemocouncil.nsw.gov.au",
        "council-key": "demo-bays",
        position: "Rates Officer",
        "work-area": "finance",
        tenure: "6-10",
        pain:
          "[TEST] Month-end: reconciling sub-ledgers to the GL and fielding the same “why is my notice different to last year” question from 50+ ratepayers with no single approved script.",
        "time-cost": "5-10",
        benefits:
          "[TEST] Exception queue for variances; draft plain-language email from approved FAQ with finance sign-off; fewer manual spreadsheet bridges.",
        "include-name": false,
      },
    },
  };

  const form = $("vibe-form");
  const emailInput = $("email");
  const emailErr = $("email-err");
  const workArea = $("work-area");
  const outputSection = $("output-section");
  const outputThought = $("output-thought");
  const outputPaste = $("output-paste");
  const copyStatus = $("copy-status");
  const ideasBlock = $("ideas-block");
  const ideasLede = $("ideas-lede");
  const ideasList = $("ideas-list");
  const settingsPanel = $("panel-settings");
  const btnSettings = $("btn-settings-toggle");
  const capturedDl = $("captured-dl");
  const capturedSaved = $("captured-saved");

  function isValidWorkEmail(v) {
    const t = String(v || "")
      .trim()
      .toLowerCase();
    if (t.length < 6) return false;
    const at = t.indexOf("@");
    if (at < 1) return false;
    const dom = t.slice(at + 1);
    if (!dom) return false;
    if (dom.includes("..") || dom.startsWith(".") || dom.endsWith(".")) return false;
    if (!/^[a-z0-9.-]+$/i.test(dom)) return false;
    if (!dom.endsWith(".gov.au")) return false;
    const parts = dom.split(".");
    if (parts.length < 3) return false;
    return true;
  }

  function getResolvedTheme() {
    const t = getPrefs().theme;
    if (t === "light" || t === "dark") return t;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function getPrefs() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) return Object.assign(defaultPrefs(), JSON.parse(raw));
    } catch (e) {
      /* ignore */
    }
    return defaultPrefs();
  }

  function defaultPrefs() {
    return {
      theme: "system",
      accent: "council",
      font: 100,
      contrast: false,
      reduceMotion: false,
    };
  }

  function savePrefs(p) {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(p));
    } catch (e) {
      /* ignore */
    }
  }

  function applyPrefs(p) {
    const root = document.documentElement;
    const resolved = p.theme === "system" ? getResolvedTheme() : p.theme;
    root.setAttribute("data-theme", resolved);
    root.setAttribute("data-accent", p.accent);
    root.dataset.contrast = p.contrast ? "high" : "normal";
    root.dataset.reduceMotion = p.reduceMotion ? "1" : "0";
    const scalePct = p.font != null ? p.font : 100;
    const scale = scalePct / 100;
    root.style.setProperty("--font-scale", String(scale));
    $("font-scale-readout").textContent = scalePct + "%";
    $("font-scale").value = String(scalePct);

    var settings = $("panel-settings");
    (settings || document).querySelectorAll("input[name='theme']").forEach(function (r) {
      r.checked = r.value === p.theme;
    });
    (settings || document).querySelectorAll("input[name='accent']").forEach(function (r) {
      r.checked = r.value === p.accent;
    });
    $("high-contrast").checked = !!p.contrast;
    $("reduce-motion").checked = !!p.reduceMotion;
  }

  function syncSystemTheme() {
    const p = getPrefs();
    if (p.theme === "system") {
      const resolved = getResolvedTheme();
      document.documentElement.setAttribute("data-theme", resolved);
    }
  }

  function onPrefsChange() {
    const p = {
      theme: (document.querySelector("input[name='theme']:checked") || {}).value || "system",
      accent: (document.querySelector("input[name='accent']:checked") || {}).value || "council",
      font: parseInt($("font-scale").value, 10) || 100,
      contrast: $("high-contrast").checked,
      reduceMotion: $("reduce-motion").checked,
    };
    applyPrefs(p);
    savePrefs(p);
  }

  function loadFormDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      Object.keys(d).forEach(function (k) {
        const el = form.elements.namedItem(k);
        if (el && "value" in el) el.value = d[k];
        if (el && el.type === "checkbox") el.checked = d[k] === true || d[k] === "on";
      });
    } catch (e) {
      /* ignore */
    }
  }

  function saveFormDraft() {
    try {
      const d = {
        "full-name": form.elements["full-name"]?.value,
        email: form.elements["email"]?.value,
        position: form.elements["position"]?.value,
        "work-area": form.elements["work-area"]?.value,
        tenure: form.elements["tenure"]?.value,
        pain: form.elements["pain"]?.value,
        "time-cost": form.elements["time-cost"]?.value,
        benefits: form.elements["benefits"]?.value,
        "include-name": form.elements["include-name"]?.checked,
        "council-key": form.elements["council-key"]?.value,
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch (e) {
      /* ignore */
    }
  }

  function showBanner(id, msg) {
    const el = $(id);
    if (!el) return;
    el.textContent = msg;
    el.hidden = !msg;
    if (msg) {
      clearTimeout(el._t);
      el._t = setTimeout(function () {
        el.hidden = true;
        el.textContent = "";
      }, 6000);
    }
  }

  function positionHint(pos) {
    const s = (pos || "").toLowerCase();
    if (!s.trim()) return null;
    if (/ranger|regulatory|compliance|local law|parking|animal/.test(s)) {
      return "Challenges in roles like yours often include triaging complaints, building evidence, patrol coverage, and defensible case records.";
    }
    if (/plan|da\b|assessment|building cert|planner|development/.test(s)) {
      return "Challenges in roles like yours often include incomplete applications, RFI / submission volume, and tracking conditions after consent.";
    }
    if (/customer|reception|contact|service/.test(s)) {
      return "Challenges in roles like yours often include high enquiry load, the same questions asked many ways, and re-keying into multiple systems after contact.";
    }
    if (/asset|work order|engineer|infrastructure|maintenance/.test(s)) {
      return "Challenges in roles like yours often include work orders, inspections, handoff between field and office, and reporting across siloed systems.";
    }
    if (/finance|procurement|ap\b|ar\b|payroll|rates/.test(s)) {
      return "Challenges in roles like yours often include month-end crunch, ratepayer or staff questions that repeat, and exception handling with a clear approval trail.";
    }
    return "Challenges in any council role can include manual handovers, data re-entry, and hard-to-find source policy — your work area (above) refines the examples below.";
  }

  const LEDE_IDEAS_EMPTY =
    "Add your job title and, if you can, primary work area (above) to see example challenges people in similar roles often face. Use them to think about your own pain point in the next section — you do not need to use them word-for-word.";

  function updateIdeas() {
    if (!ideasBlock) return;
    const key = workArea.value;
    const data = window.VIBE_ROLE_IDEAS && key ? window.VIBE_ROLE_IDEAS[key] : null;
    const pos = (form && form.elements && form.elements["position"] && form.elements["position"].value) || "";
    const hint = positionHint(pos);
    if (!data && !hint) {
      ideasLede.textContent = LEDE_IDEAS_EMPTY;
      if (ideasList) {
        ideasList.innerHTML = "";
        ideasList.hidden = true;
      }
      return;
    }
    if (data) {
      const intro =
        (hint ? hint + " " : "") +
        "Here are some example pain areas people in that line of work sometimes explore with low-code tools — to spark your thinking, not to prescribe a solution. Keep people in the loop for decisions that affect residents and staff.";
      ideasLede.textContent = intro;
      if (ideasList) {
        ideasList.innerHTML = "";
        data.ideas.forEach(function (idea) {
          const li = document.createElement("li");
          li.textContent = idea;
          ideasList.appendChild(li);
        });
        ideasList.hidden = false;
      }
    } else {
      ideasLede.textContent =
        hint + " Add a work area (above) for a fuller set of example challenges, or go straight to your own pain in the next section.";
      if (ideasList) {
        ideasList.innerHTML = "";
        ideasList.hidden = true;
      }
    }
  }

  function getFormSnapshot() {
    const name = (form.elements["full-name"].value || "").trim();
    const email = (form.elements["email"].value || "").trim();
    const position = (form.elements["position"].value || "").trim();
    const areaKey = form.elements["work-area"].value;
    const areaData = areaKey && window.VIBE_ROLE_IDEAS ? window.VIBE_ROLE_IDEAS[areaKey] : null;
    const workAreaText = areaData ? areaData.label : "— (not selected)";
    const tenure = form.elements["tenure"].value;
    const pain = (form.elements["pain"].value || "").trim();
    const timeCost = form.elements["time-cost"].value;
    const benefits = (form.elements["benefits"].value || "").trim();
    const includeName = form.elements["include-name"].checked;
    return {
      fullName: name,
      email: email,
      position: position,
      workAreaKey: areaKey || "",
      workAreaLabel: workAreaText,
      tenure: tenure,
      tenureLabel: TERM_LABELS[tenure] || tenure,
      pain: pain,
      timeCost: timeCost,
      timeCostLabel: TIME_LABELS[timeCost] || timeCost,
      benefits: benefits,
      includeNameInPrompt: includeName,
      councilKey: resolveCouncilKey(),
      councilKeyInput: (form.elements["council-key"] && String(form.elements["council-key"].value).trim()) || "",
    };
  }

  function getSubmissions() {
    try {
      const raw = localStorage.getItem(SUBMISSIONS_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function putSubmissions(list) {
    try {
      localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(list));
    } catch (e) {
      /* storage full or disabled */
    }
  }

  function saveSubmissionRecord(record) {
    var list = getSubmissions();
    list.unshift(record);
    if (list.length > MAX_SAVED) {
      list = list.slice(0, MAX_SAVED);
    }
    putSubmissions(list);
  }

  function formatLocalTime(iso) {
    try {
      return new Date(iso).toLocaleString("en-AU", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch (e) {
      return iso;
    }
  }

  function renderCapturedList(snap, savedAtIso) {
    if (!capturedDl) return;
    capturedDl.textContent = "";
    var rows = [
      ["Name", snap.fullName || "—"],
      ["Work email", snap.email || "—"],
      ["Council folder id", snap.councilKey || "—"],
      ["Position", snap.position || "—"],
      ["Primary work area", snap.workAreaLabel || "—"],
      ["Time at council", snap.tenureLabel || "—"],
      ["Pain point / what to fix", snap.pain || "—"],
      ["Time the problem takes", snap.timeCostLabel || "—"],
      ["Expected benefits", snap.benefits || "—"],
      ["Name included in Vibe prompt", snap.includeNameInPrompt ? "Yes" : "No"],
    ];
    rows.forEach(function (row) {
      var dt = document.createElement("dt");
      var dd = document.createElement("dd");
      dt.textContent = row[0];
      dd.textContent = row[1];
      capturedDl.appendChild(dt);
      capturedDl.appendChild(dd);
    });
    if (capturedSaved && savedAtIso) {
      capturedSaved.textContent =
        "Saved in this browser: " + formatLocalTime(savedAtIso) + ". You can copy this summary or download JSON below.";
    } else if (capturedSaved) {
      capturedSaved.textContent = "";
    }
  }

  function buildResponsesPlainText(snap) {
    return [
      "VibeLocalGov — responses summary",
      "Name: " + (snap.fullName || ""),
      "Work email: " + (snap.email || ""),
      "Council folder id: " + (snap.councilKey || ""),
      "Position: " + (snap.position || ""),
      "Primary work area: " + (snap.workAreaLabel || ""),
      "Time at council: " + (snap.tenureLabel || ""),
      "Pain point: " + (snap.pain || ""),
      "Time cost (per week): " + (snap.timeCostLabel || ""),
      "Expected benefits: " + (snap.benefits || ""),
      "Name in Vibe prompt: " + (snap.includeNameInPrompt ? "yes" : "no"),
    ].join("\n");
  }

  function downloadJson(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  function buildFullMarkdownExport(record) {
    var f = record.form;
    var dom = f.email && f.email.indexOf("@") > 0 ? f.email.split("@")[1] : "";
    var thoughts = record.promptThoughts || "";
    var paste = record.vibePromptPaste || record.vibePrompt || "";
    var lines = [
      "# VibeLocalGov — export for your council folder",
      "",
      "There are **two** prompt parts below. For **Vibe** at [vibe.powerapps.com](https://vibe.powerapps.com), use **only** the *Paste into Vibe* section.",
      "",
      "| Field | Value |",
      "| --- | --- |",
      "| Saved (ISO) | " + (record.createdAt || "") + " |",
      "| Form version | " + (record.formVersion || "1") + " |",
      "| Council folder id | " + (f.councilKey || "") + " |",
      "| Work email domain | " + dom + " |",
      "| Position | " + String(f.position || "").replace(/\|/g, "/") + " |",
      "| Primary work area | " + String(f.workAreaLabel || "").replace(/\|/g, "/") + " |",
      "| Time in local govt | " + (f.tenureLabel || "") + " |",
      "| Time cost (pain) | " + (f.timeCostLabel || "") + " |",
      "",
      "## 1. Thought process (read / share — not for the Vibe box)",
      "",
    ];
    lines.push(thoughts);
    lines.push(
      "",
      "---",
      "",
      "## 2. Paste into Vibe only (vibe.powerapps.com)",
      "",
      "Copy from the next line into the Vibe prompt field.",
      ""
    );
    lines.push(paste);
    lines.push(
      "",
      "---",
      "",
      "## Source fields (raw)",
      "",
      "**Pain** — " + (f.pain || ""),
      "",
      "**Benefits** — " + (f.benefits || ""),
      "",
      "*Generated in-browser by VibeLocalGov — not an automated AI call.*",
      ""
    );
    return lines.join("\n");
  }

  function downloadMarkdownFile() {
    if (!lastRecord) {
      showBanner("banner-error", "Generate a prompt first.");
      return;
    }
    var k = (lastRecord.form && lastRecord.form.councilKey) || "export";
    var blob = new Blob([buildFullMarkdownExport(lastRecord)], { type: "text/markdown;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "vibelocalgov-" + k + "-" + (lastRecord.id || "run") + ".md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    if ($("md-save-line")) {
      $("md-save-line").textContent = "Markdown download started. Move it to md/" + k + "/ in the project if you like.";
      $("md-save-line").hidden = false;
    }
  }

  function saveMarkdownToProjectFolder() {
    if (!lastRecord) {
      showBanner("banner-error", "Generate a prompt first.");
      return;
    }
    if (!isLocalDev()) {
      showBanner("banner-error", "Saving into md/ only works on the local dev server. Run `node server.js` and open http://127.0.0.1:3000/ — or use “Download as Markdown” instead.");
      return;
    }
    var k = (lastRecord.form && lastRecord.form.councilKey) || resolveCouncilKey();
    var md = buildFullMarkdownExport(lastRecord);
    var stamp = (lastRecord.createdAt || new Date().toISOString()).replace(/[:.]/g, "-");
    fetch("/api/save-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        councilKey: k,
        markdown: md,
        stamp: stamp,
        fileLabel: "vibe-prompt",
      }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        if (!j || !j.ok) {
          showBanner("banner-error", (j && j.error) || "Save failed");
          return;
        }
        var line = $("md-save-line");
        if (line) {
          line.hidden = false;
          line.textContent = "Wrote " + (j.relativeFile || "file") + " — open that path in this repo in your editor.";
        }
        showBanner("banner-success", "Saved Markdown in your project. Copy the *Paste into Vibe* section into vibe.powerapps.com.");
      })
      .catch(function () {
        showBanner("banner-error", "Could not save. Is `node server.js` running? Use Download as Markdown as a fallback.");
      });
  }

  function applyTestPreset() {
    var sel = $("test-preset");
    var key = sel && sel.value;
    if (!key || !TEST_PRESETS[key]) {
      showBanner("banner-error", "Choose a test scenario first.");
      return;
    }
    if (!confirm("Replace the form with fictional TEST data? Your current draft in this browser will be overwritten.")) {
      return;
    }
    var d = TEST_PRESETS[key].data;
    var map = {
      "full-name": d["full-name"],
      email: d.email,
      "council-key": d["council-key"],
      position: d.position,
      "work-area": d["work-area"],
      tenure: d.tenure,
      pain: d.pain,
      "time-cost": d["time-cost"],
      benefits: d.benefits,
    };
    Object.keys(map).forEach(function (name) {
      var el = form.elements.namedItem(name);
      if (el && "value" in el) el.value = map[name] != null ? map[name] : "";
    });
    if (form.elements["include-name"]) {
      form.elements["include-name"].checked = !!d["include-name"];
    }
    updateIdeas();
    saveFormDraft();
    showBanner("banner-success", "Loaded TEST data. Click “Generate Vibe prompt” to see output and try Save / download.");
  }

  function setTestPanelOpen(open) {
    var body = $("test-tools-body");
    var btn = $("btn-test-toggle");
    if (!body || !btn) return;
    try {
      sessionStorage.setItem(TEST_PANEL_KEY, open ? "1" : "0");
    } catch (e) {
      /* ignore */
    }
    if (open) {
      body.removeAttribute("hidden");
      btn.setAttribute("aria-expanded", "true");
      btn.textContent = "Hide testing tools";
    } else {
      body.setAttribute("hidden", "");
      btn.setAttribute("aria-expanded", "false");
      btn.textContent = "Show testing tools";
    }
  }

  function initTestPanelFromStorage() {
    var o = "1";
    try {
      o = sessionStorage.getItem(TEST_PANEL_KEY);
    } catch (e) {
      /* ignore */
    }
    if (o === "0") {
      setTestPanelOpen(false);
    } else {
      setTestPanelOpen(true);
    }
  }

  function clearEntireForm() {
    if (!confirm("Clear all fields, browser draft, and the generated output? You can start again from scratch.")) {
      return;
    }
    form.reset();
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) {
      /* ignore */
    }
    lastRecord = null;
    if (outputThought) outputThought.value = "";
    if (outputPaste) outputPaste.value = "";
    if (outputSection) outputSection.hidden = true;
    var ms = $("md-save-line");
    if (ms) {
      ms.textContent = "";
      ms.hidden = true;
    }
    updateIdeas();
    emailInput.classList.remove("user-invalid");
    emailErr.textContent = "";
    showBanner("banner-success", "Form and output cleared.");
  }

  function updateOutputLocalHints() {
    var h = $("md-local-hint");
    var b = $("btn-save-md-server");
    if (h) h.hidden = !isLocalDev();
    if (b) {
      b.disabled = false;
      b.title = isLocalDev() ? "Writes under md/<council-id>/ on this computer" : "Start node server.js first";
    }
  }

  function gatherPromptInputs() {
    const name = (form.elements["full-name"].value || "").trim();
    const email = (form.elements["email"].value || "").trim();
    const position = (form.elements["position"].value || "").trim();
    const areaKey = form.elements["work-area"].value;
    const areaData = areaKey && window.VIBE_ROLE_IDEAS ? window.VIBE_ROLE_IDEAS[areaKey] : null;
    const workAreaText = areaData ? areaData.label : "Not specified";
    const tenure = form.elements["tenure"].value;
    const pain = (form.elements["pain"].value || "").trim();
    const timeCost = form.elements["time-cost"].value;
    const benefits = (form.elements["benefits"].value || "").trim();
    const includeName = form.elements["include-name"].checked;
    const ideasLines =
      areaData && areaData.ideas
        ? areaData.ideas.map(function (i, n) {
            return n + 1 + ". " + i;
          })
        : ["1. (No area selected — add your own in the next section.)"];
    return {
      name: name,
      email: email,
      position: position,
      areaKey: areaKey,
      workAreaText: workAreaText,
      tenure: tenure,
      pain: pain,
      timeCost: timeCost,
      benefits: benefits,
      includeName: includeName,
      ideasLines: ideasLines,
    };
  }

  function buildPromptThoughts(ctx) {
    return [
      "# Thought process — do **not** paste this block into Vibe",
      "",
      "This section explains how VibeLocalGov built your request and the Australian local-government context. Share it with your team or keep it for records. The **only** text that belongs in the Vibe prompt box is in part **2** in the app (or the *Paste into Vibe* section in an export).",
      "",
      "## Microsoft Power Platform — why the details matter",
      "",
      "Power Platform brings together **Power Apps** (forms and mobile experiences), **Dataverse** (governed data), and **Power Automate** (workflows) — often with **Microsoft 365 Copilot** to explore connectors. A good pilot keeps **data in your tenant**, uses **role-based access**, and keeps **people in the loop** for any decision that affects residents or staff.",
      "",
      "## My council context (how we framed your request)",
      "",
      ctx.includeName && ctx.name
        ? "- **Name:** " + ctx.name
        : "- **Name:** (withheld — add in your org’s tool if the facilitator needs it.)",
      "- **Council folder id (local files):** " + (resolveCouncilKey() || "(derived from work email)"),
      "- **Work email domain:** " + (ctx.email ? ctx.email.split("@")[1] : "(not given)"),
      "- **Position / title:** " + (ctx.position || "(not given)"),
      "- **Primary work area:** " + ctx.workAreaText,
      "- **Time in local government:** " + (TERM_LABELS[ctx.tenure] || ctx.tenure),
      "",
      "## The problem and impact (as you described it)",
      "",
      ctx.pain,
      "",
      "- **Time this problem costs (roughly, per week):** " + (TIME_LABELS[ctx.timeCost] || ctx.timeCost),
      "",
      "## Outcomes you said you want",
      "",
      ctx.benefits,
      "",
      "## Example challenges for your role (ideas to spark the build)",
      "",
      ...ctx.ideasLines,
      "",
      "## What we are asking Vibe to produce (rationale)",
      "",
      "The lean prompt in part **2** asks for: a tight pilot design using Power Platform; explicit **assumptions** and **out-of-scope** items; **governance** touchpoints (privacy, records, human review); and a starter **backlog** for your IT or digital team. We strip coaching text out of the paste box so Vibe gets a direct instruction, not a tutorial.",
      "",
      "---",
      "Generated in-browser by VibeLocalGov — not an automated AI call.",
    ].join("\n");
  }

  function buildPromptVibeOnly(ctx) {
    const domain = ctx.email && ctx.email.indexOf("@") > 0 ? ctx.email.split("@")[1] : "(work domain not given)";
    return [
      "I work in Australian local government. Use Microsoft Power Platform (Power Apps, Dataverse, Power Automate) in our cloud tenant. Do not rely on or invent personal data about residents; describe processes in generic terms. Australian privacy and records rules apply; human review is required for enforcement outcomes, legal positions, and anything sent to the public.",
      "",
      "Context:",
      "- Work email domain: " + domain,
      "- Position: " + (ctx.position || "—") + " | Primary work area: " + ctx.workAreaText + " | Time in local government: " + (TERM_LABELS[ctx.tenure] || ctx.tenure) + (ctx.includeName && ctx.name ? " | Name on file: " + ctx.name : ""),
      "",
      "Process pain to improve:",
      ctx.pain,
      "",
      "Estimated time this problem takes for our team (per week, rough): " + (TIME_LABELS[ctx.timeCost] || ctx.timeCost) + ".",
      "",
      "If we fix this well, we want: " + ctx.benefits,
      "",
      "What I need from you (Vibe):",
      "1) Propose a small, realistic pilot: main screens or flows, and what would live in Dataverse at a high level.",
      "2) Call out who approves what (human in the loop) for customer-facing or compliance-sensitive steps.",
      "3) List assumptions, risks, dependencies, and what is explicitly out of scope.",
      "4) Note governance points relevant to local government in Australia (e.g. privacy, records, AI use policies) in plain language, not legal advice.",
      "5) If helpful, a short backlog of next steps for our IT or digital and records teams.",
    ].join("\n");
  }

  function validateForm() {
    const errs = [];
    if (!String(form.elements["full-name"].value).trim()) errs.push("Enter your name.");
    const em = String(form.elements["email"].value).trim();
    if (!em) errs.push("Enter your work email address.");
    else if (!isValidWorkEmail(em)) {
      errs.push("Use a valid Australian **government** work email that ends in **.gov.au** (personal inboxes are not accepted).");
    }
    if (!String(form.elements["position"].value).trim()) errs.push("Enter your position or job title.");
    if (!form.elements["tenure"].value) errs.push("Select how long you have been in local government.");
    if (!String(form.elements["pain"].value).trim()) errs.push("Describe the pain point you want to address.");
    if (!form.elements["time-cost"].value) errs.push("Select how much time the problem takes.");
    if (!String(form.elements["benefits"].value).trim()) errs.push("Describe the benefits you would expect.");
    return errs;
  }

  function onSubmit(e) {
    e.preventDefault();
    const errs = validateForm();
    emailInput.classList.remove("user-invalid");
    emailErr.textContent = "";

    if (errs.length) {
      if (!isValidWorkEmail(String(emailInput.value).trim())) {
        emailInput.classList.add("user-invalid");
        if (!String(emailInput.value).trim()) emailErr.textContent = "Work email is required.";
        else emailErr.textContent = "Must be a .gov.au address (e.g. name@council.nsw.gov.au).";
      }
      showBanner("banner-error", errs[0]);
      return;
    }
    showBanner("banner-error", "");
    const ctx = gatherPromptInputs();
    const thoughts = buildPromptThoughts(ctx);
    const paste = buildPromptVibeOnly(ctx);
    const snap = getFormSnapshot();
    const createdAt = new Date().toISOString();
    lastRecord = {
      id: "vlg-" + Date.now(),
      createdAt: createdAt,
      formVersion: "2",
      form: snap,
      promptThoughts: thoughts,
      vibePromptPaste: paste,
      vibePrompt: paste,
    };
    saveSubmissionRecord(lastRecord);
    renderCapturedList(snap, createdAt);
    if (outputThought) outputThought.value = thoughts;
    if (outputPaste) outputPaste.value = paste;
    outputSection.hidden = false;
    showBanner(
      "banner-success",
      "Use part 2 (paste box) in vibe.powerapps.com. Part 1 is for your notes or team. Nothing sent to a server from this page."
    );
    updateOutputLocalHints();
    outputSection.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      if (outputPaste) outputPaste.focus();
    } catch (ex) {
      /* ignore */
    }
  }

  function copyToClipboard(text, el, successMsg) {
    const done = function (msg) {
      if ($("copy-status")) {
        copyStatus.textContent = msg || successMsg;
        setTimeout(function () {
          copyStatus.textContent = "";
        }, 2500);
      }
    };
    if (!text) {
      showBanner("banner-error", "Generate a prompt first.");
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(function () {
          done();
        })
        .catch(function () {
          if (el) {
            el.select();
            document.execCommand("copy");
            done();
          } else {
            showBanner("banner-error", "Could not copy to clipboard.");
          }
        });
    } else {
      if (el) {
        el.select();
        document.execCommand("copy");
        done();
      }
    }
  }

  function copyVibePaste() {
    copyToClipboard(outputPaste && outputPaste.value, outputPaste, "Vibe prompt (paste box) copied.");
  }

  function copyThoughtBlock() {
    copyToClipboard(outputThought && outputThought.value, outputThought, "Thought process copied.");
  }

  function copyResponsesSummary() {
    if (!lastRecord || !lastRecord.form) {
      showBanner("banner-error", "Generate a prompt first to capture responses.");
      return;
    }
    const text = buildResponsesPlainText(lastRecord.form);
    const done = function () {
      copyStatus.textContent = "Responses summary copied.";
      setTimeout(function () {
        copyStatus.textContent = "";
      }, 2500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () {
        showBanner("banner-error", "Could not copy. Select text manually or download JSON.");
      });
    } else {
      showBanner("banner-error", "Clipboard not available. Use Download (JSON) instead.");
    }
  }

  function downloadThisJson() {
    if (!lastRecord) {
      showBanner("banner-error", "Generate a prompt first.");
      return;
    }
    downloadJson("vibelocalgov-" + (lastRecord.id || "export") + ".json", lastRecord);
    copyStatus.textContent = "JSON download started.";
    setTimeout(function () {
      copyStatus.textContent = "";
    }, 2000);
  }

  function downloadAllJson() {
    const all = getSubmissions();
    if (!all.length) {
      showBanner("banner-error", "No saved responses in this browser yet. Generate a prompt first.");
      return;
    }
    downloadJson("vibelocalgov-all-submissions.json", { exportedAt: new Date().toISOString(), count: all.length, submissions: all });
    copyStatus.textContent = "All submissions download started.";
    setTimeout(function () {
      copyStatus.textContent = "";
    }, 2000);
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  function init() {
    applyPrefs(getPrefs());
    loadFormDraft();
    updateIdeas();
    initTestPanelFromStorage();
    updateOutputLocalHints();
    if (getPrefs().theme === "system") {
      try {
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncSystemTheme);
      } catch (e) {
        /* ignore */
      }
    }

    document.querySelectorAll("input[name='theme']").forEach(function (i) {
      i.addEventListener("change", onPrefsChange);
    });
    document.querySelectorAll("input[name='accent']").forEach(function (i) {
      i.addEventListener("change", onPrefsChange);
    });
    $("font-scale").addEventListener("input", onPrefsChange);
    $("high-contrast").addEventListener("change", onPrefsChange);
    $("reduce-motion").addEventListener("change", onPrefsChange);

    if (btnSettings && settingsPanel) {
      btnSettings.addEventListener("click", function () {
        const open = settingsPanel.hasAttribute("hidden");
        if (open) {
          settingsPanel.removeAttribute("hidden");
          btnSettings.setAttribute("aria-expanded", "true");
        } else {
          settingsPanel.setAttribute("hidden", "");
          btnSettings.setAttribute("aria-expanded", "false");
        }
      });
    }

    workArea.addEventListener("change", function () {
      updateIdeas();
      saveFormDraft();
    });
    var posEl = form.elements["position"];
    if (posEl) {
      posEl.addEventListener("input", debounce(updateIdeas, 350));
    }
    form.addEventListener("input", debounce(saveFormDraft, 400));
    form.addEventListener("change", debounce(saveFormDraft, 200));
    form.addEventListener("submit", onSubmit);
    emailInput.addEventListener("input", function () {
      emailErr.textContent = "";
      emailInput.classList.remove("user-invalid");
    });

    $("btn-copy").addEventListener("click", copyVibePaste);
    $("btn-copy-thought")?.addEventListener("click", copyThoughtBlock);
    $("btn-copy-responses")?.addEventListener("click", copyResponsesSummary);
    $("btn-test-toggle")?.addEventListener("click", function () {
      var body = $("test-tools-body");
      var nowOpen = !!(body && !body.hasAttribute("hidden"));
      setTestPanelOpen(!nowOpen);
    });
    $("btn-form-clear")?.addEventListener("click", clearEntireForm);
    $("btn-download-one")?.addEventListener("click", downloadThisJson);
    $("btn-download-all")?.addEventListener("click", downloadAllJson);
    $("btn-test-fill")?.addEventListener("click", applyTestPreset);
    $("btn-download-md")?.addEventListener("click", downloadMarkdownFile);
    $("btn-save-md-server")?.addEventListener("click", saveMarkdownToProjectFolder);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
