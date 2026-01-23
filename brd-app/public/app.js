const chat = document.getElementById('chatMessages');
const form = document.getElementById('inputForm');
const promptInput = document.getElementById('promptInput');
const themeToggle = document.getElementById('themeToggle');
const downloadBtn = document.getElementById('downloadBtn');
const docNormal = document.getElementById('docNormal');
const docDiff = document.getElementById('docDiff');
const engineStatus = document.getElementById('engineStatus');
const sessionStatus = document.getElementById('sessionStatus');
const versionTabs = document.getElementById('versionTabs');
const checklist = document.getElementById('checklist');
const versionTag = document.getElementById('versionTag');
const sidebarToggle = document.getElementById('sidebar-toggle');
const questionsForm = document.getElementById('questionsForm');
const applyAnswersBtn = document.getElementById('applyAnswersBtn');

const API_BASE_URL = (() => {
  try {
    const fromWindow = window?.BRD_APP_CONFIG?.apiBaseUrl;
    if (typeof fromWindow === 'string' && fromWindow.trim()) return fromWindow.trim().replace(/\/$/, '');
  } catch {
    // ignore
  }
  try {
    const fromStorage = localStorage.getItem('apiBaseUrl');
    if (typeof fromStorage === 'string' && fromStorage.trim()) return fromStorage.trim().replace(/\/$/, '');
  } catch {
    // ignore
  }
  return '';
})();

let lastDocText = '';
let currentDocText = '';
let versions = [];
let activeVersionId = null;
let pendingQuestions = [];

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function looksLikeMarkdownDoc(text) {
  if (!text) return false;
  if (text.includes('\n# ') || text.startsWith('# ')) return true;
  if (text.includes('\n## ')) return true;
  if (text.toLowerCase().includes('business requirement document')) return true;
  if (/^\s*##?\s*\d+\./m.test(text)) return true;
  return false;
}

function tryExtractJson(text) {
  const raw = (text || '').trim();
  if (!raw) return null;

  // Handle fenced JSON: ```json { ... } ```
  const fenced = raw.match(/```json\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1].trim() : raw;

  // Some models accidentally add leading/trailing chatter; try to isolate the first JSON object.
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  const maybe = firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace ? candidate.slice(firstBrace, lastBrace + 1) : candidate;

  try {
    const parsed = JSON.parse(maybe);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeQuestions(q) {
  if (!q) return [];
  if (Array.isArray(q)) {
    return q
      .map((item, idx) => {
        if (typeof item === 'string') return { id: `q${idx + 1}`, question: item, required: true };
        if (item && typeof item === 'object') {
          return {
            id: String(item.id || `q${idx + 1}`),
            question: String(item.question || item.text || '').trim(),
            context: item.context ? String(item.context) : '',
            required: item.required !== false,
            type: item.type ? String(item.type) : 'text',
            options: Array.isArray(item.options) ? item.options.map(String) : [],
            answer: item.answer != null ? String(item.answer) : '',
          };
        }
        return null;
      })
      .filter((x) => x && x.question);
  }
  return [];
}

function renderQuestions(questions) {
  if (!questionsForm || !applyAnswersBtn) return;
  pendingQuestions = normalizeQuestions(questions);

  if (!pendingQuestions.length) {
    questionsForm.innerHTML = '<div class="text-xs text-slate-500">No open questions.</div>';
    applyAnswersBtn.classList.add('hidden');
    applyAnswersBtn.classList.remove('flex');
    return;
  }

  const blocks = pendingQuestions
    .slice(0, 12)
    .map((q) => {
      const label = escapeHtml(q.question);
      const help = q.context ? `<div class="text-[11px] text-slate-500 mt-1">${escapeHtml(q.context)}</div>` : '';
      const value = escapeHtml(q.answer || '');
      const requiredMark = q.required ? '<span class="text-red-500">*</span>' : '';
      return `
        <div class="space-y-1">
          <label class="text-xs font-semibold text-slate-700 dark:text-slate-300" for="${escapeHtml(q.id)}">${label} ${requiredMark}</label>
          <textarea
            id="${escapeHtml(q.id)}"
            data-question-id="${escapeHtml(q.id)}"
            rows="2"
            class="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ring-primary/20"
            placeholder="Type your answer…"
          >${value}</textarea>
          ${help}
        </div>
      `.trim();
    });

  questionsForm.innerHTML = blocks.join('');
  applyAnswersBtn.classList.remove('hidden');
  applyAnswersBtn.classList.add('flex');
}

function loadVersions() {
  try {
    const raw = localStorage.getItem('brd_versions');
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) versions = parsed;
  } catch {
    versions = [];
  }
}

function saveVersions() {
  try {
    localStorage.setItem('brd_versions', JSON.stringify(versions.slice(0, 50)));
  } catch {
    // ignore
  }
}

function nowIsoShort() {
  const d = new Date();
  return d.toISOString().replace('T', ' ').slice(0, 16);
}

function extractTitle(markdown) {
  const m = (markdown || '').match(/^\s*#\s+(.+)\s*$/m);
  return (m?.[1] || 'BRD').trim().slice(0, 48);
}

function nextVersionLabel() {
  const latest = versions[0]?.versionLabel;
  const m = typeof latest === 'string' ? latest.match(/^v(\d+)\.(\d+)/i) : null;
  if (!m) return 'v0.1';
  const major = Number(m[1] || 0);
  const minor = Number(m[2] || 0);
  return `v${major}.${minor + 1}`;
}

function addVersionSnapshot(content, { source = 'agent', versionLabel: forcedVersionLabel } = {}) {
  const title = extractTitle(content);
  const existing = versions.find((v) => v.content === content);
  if (existing) {
    activeVersionId = existing.id;
    return;
  }

  const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const versionLabel = (forcedVersionLabel && String(forcedVersionLabel).trim()) || nextVersionLabel();
  const snapshot = {
    id,
    title,
    versionLabel,
    updatedAt: nowIsoShort(),
    source,
    content,
  };

  versions.unshift(snapshot);
  activeVersionId = id;
  saveVersions();
  renderVersionTabs();
  if (versionTag) versionTag.textContent = versionLabel;
}

function setActiveVersion(id) {
  const v = versions.find((x) => x.id === id);
  if (!v) return;
  activeVersionId = v.id;
  lastDocText = currentDocText;
  currentDocText = v.content;
  renderDoc(currentDocText);
  renderVersionTabs();
  if (versionTag) versionTag.textContent = v.versionLabel || 'v0.1';
}

function renderVersionTabs() {
  if (!versionTabs) return;
  if (!versions.length) {
    versionTabs.innerHTML = '<span class="text-xs text-slate-500">No versions yet</span>';
    return;
  }

  const chips = versions.slice(0, 8).map((v) => {
    const active = v.id === activeVersionId;
    const cls = active
      ? 'bg-primary text-white border-primary'
      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700';
    return `
      <button
        type="button"
        data-version-id="${v.id}"
        class="px-2.5 py-1.5 rounded-full text-xs font-medium border ${cls} whitespace-nowrap"
        title="${escapeHtml(v.title)} • ${escapeHtml(v.updatedAt)}"
      >
        ${escapeHtml(v.versionLabel)}
      </button>
    `.trim();
  });

  versionTabs.innerHTML = `<div class="flex gap-2 items-center">${chips.join('')}</div>`;
  versionTabs.querySelectorAll('[data-version-id]').forEach((btn) => {
    btn.addEventListener('click', () => setActiveVersion(btn.getAttribute('data-version-id')));
  });
}

function sectionContent(markdown, headerRegex) {
  const lines = (markdown || '').replace(/\r\n/g, '\n').split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headerRegex.test(lines[i])) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return null;
  const content = [];
  for (let i = start; i < lines.length; i++) {
    if (/^\s*##\s+/.test(lines[i]) || /^\s*#\s+/.test(lines[i])) break;
    content.push(lines[i]);
  }
  return content.join('\n').trim();
}

function ragStatus(text) {
  if (text == null) return 'red';
  const cleaned = text.replace(/\*\*TBD\*\*/gi, '').trim();
  if (!cleaned) return 'red';
  if (cleaned.length < 120) return 'amber';
  return 'green';
}

function renderChecklist(markdown) {
  if (!checklist) return;
  if (!markdown || !markdown.trim()) {
    checklist.innerHTML = '<span class="text-xs text-slate-500">No checklist yet</span>';
    return;
  }

  const items = [
    { key: 'Exec', label: 'Exec Summary', re: /^\s*##\s+1\.?\s*Executive Summary\b|^\s*##\s+Executive Summary\b/im },
    { key: 'Problem', label: 'Problem', re: /^\s*##\s+2\.?\s*Problem Statement\b|^\s*##\s+Problem Statement\b/im },
    { key: 'AsIs', label: 'Current State', re: /^\s*##\s+3\.?\s*Current State\b|^\s*##\s+Current State\b/im },
    { key: 'ToBe', label: 'Outcomes', re: /^\s*##\s+4\.?\s*Goals?\b|^\s*##\s+Goals?\b/im },
    { key: 'Stake', label: 'Stakeholders', re: /^\s*##\s+5\.?\s*Stakeholders\b|^\s*##\s+Stakeholders\b/im },
    { key: 'Scope', label: 'Scope', re: /^\s*##\s+6\.?\s*Scope\b|^\s*##\s+Scope\b/im },
    { key: 'Req', label: 'Reqs', re: /^\s*##\s+8\.?\s*Business Requirements\b|^\s*##\s+Business Requirements\b/im },
    { key: 'NFR', label: 'NFRs', re: /^\s*##\s+9\.?\s*Non-Functional\b|^\s*##\s+Non-Functional\b/im },
    { key: 'Metrics', label: 'Metrics', re: /^\s*##\s+10\.?\s*Success Metrics\b|^\s*##\s+Success Metrics\b/im },
    { key: 'Risks', label: 'Risks', re: /^\s*##\s+11\.?\s*Risks\b|^\s*##\s+Risks\b/im },
  ];

  const chips = items
    .map((it) => {
      const content = sectionContent(markdown, it.re);
      const status = ragStatus(content);
      const cls =
        status === 'green'
          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200 border-green-200 dark:border-green-900'
          : status === 'amber'
            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 border-amber-200 dark:border-amber-900'
            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200 border-red-200 dark:border-red-900';
      return `
        <span class="px-2.5 py-1.5 rounded-full text-xs font-semibold border ${cls} whitespace-nowrap" title="${escapeHtml(it.label)}">
          ${escapeHtml(it.key)}
        </span>
      `.trim();
    })
    .join('');

  checklist.innerHTML = `<div class="flex gap-2 items-center">${chips}</div>`;
}

function markdownToHtml(markdown) {
  const lines = (markdown || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let inCode = false;
  let codeLang = '';
  let listType = null; // 'ul' | 'ol'

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw ?? '';

    if (line.trim().startsWith('```')) {
      if (!inCode) {
        closeList();
        inCode = true;
        codeLang = line.trim().slice(3).trim();
        out.push(`<pre><code data-lang="${escapeHtml(codeLang)}">`);
      } else {
        inCode = false;
        out.push(`</code></pre>`);
        codeLang = '';
      }
      continue;
    }

    if (inCode) {
      out.push(escapeHtml(line));
      continue;
    }

    if (/^\s*---\s*$/.test(line)) {
      closeList();
      out.push('<hr />');
      continue;
    }

    const h1 = line.match(/^\s*#\s+(.*)$/);
    if (h1) {
      closeList();
      out.push(`<h1>${escapeHtml(h1[1].trim())}</h1>`);
      continue;
    }
    const h2 = line.match(/^\s*##\s+(.*)$/);
    if (h2) {
      closeList();
      out.push(`<h2>${escapeHtml(h2[1].trim())}</h2>`);
      continue;
    }
    const h3 = line.match(/^\s*###\s+(.*)$/);
    if (h3) {
      closeList();
      out.push(`<h3>${escapeHtml(h3[1].trim())}</h3>`);
      continue;
    }

    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    if (ul) {
      if (listType !== 'ul') {
        closeList();
        listType = 'ul';
        out.push('<ul>');
      }
      out.push(`<li>${escapeHtml(ul[1])}</li>`);
      continue;
    }

    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) {
      if (listType !== 'ol') {
        closeList();
        listType = 'ol';
        out.push('<ol>');
      }
      out.push(`<li>${escapeHtml(ol[1])}</li>`);
      continue;
    }

    if (line.trim().length === 0) {
      closeList();
      out.push('');
      continue;
    }

    closeList();
    out.push(`<p>${escapeHtml(line.trim())}</p>`);
  }

  closeList();
  if (inCode) {
    out.push(`</code></pre>`);
  }
  return out.join('\n');
}

function appendBubble({ role, text, isTyping = false }) {
  const wrap = document.createElement('div');
  wrap.className = `flex gap-4 ${role === 'user' ? 'flex-row-reverse' : ''}`;

  const icon = document.createElement('div');
  icon.className =
    role === 'user'
      ? 'w-8 h-8 rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0'
      : 'w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0';
  icon.innerHTML =
    role === 'user'
      ? '<span class="material-symbols-outlined text-lg">person</span>'
      : '<span class="material-symbols-outlined text-lg">smart_toy</span>';

  const bubble = document.createElement('div');
  bubble.className =
    role === 'user'
      ? 'max-w-[85%] bg-primary text-white p-4 rounded-2xl rounded-tr-none shadow-sm'
      : 'bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none max-w-[85%]';

  if (isTyping) {
    bubble.innerHTML = `
      <div class="flex gap-1" aria-label="thinking">
        <span class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
        <span class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
        <span class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
      </div>
    `;
  } else {
    const p = document.createElement('p');
    p.className = 'text-sm leading-relaxed whitespace-pre-wrap';
    p.textContent = text;
    bubble.appendChild(p);
  }

  wrap.appendChild(icon);
  wrap.appendChild(bubble);
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
  return { wrap, bubble };
}

function setStatus(meta) {
  if (!meta) return;
  const { sessionId, lastSelectedAgent, bundledCliAvailable, bundledCliPath } = meta;

  if (typeof bundledCliAvailable === 'boolean') {
    engineStatus.textContent = bundledCliAvailable ? 'AI Engine Online' : 'AI Engine (missing copilot)';
  }

  if (sessionId) {
    sessionStatus.textContent = `Session: ${sessionId}${lastSelectedAgent ? ` • Agent: ${lastSelectedAgent}` : ''}`;
  } else {
    sessionStatus.textContent = `Session: -${bundledCliPath ? ` • copilot: ${bundledCliPath}` : ''}`;
  }
}

function renderDoc(text) {
  if (!text) {
    docNormal.innerHTML = '<p class="text-sm text-slate-500">No document yet. Ask the agent to generate a BRD.</p>';
    docDiff.innerHTML = '<p class="text-sm text-slate-500">Diff view will appear after updates.</p>';
    return;
  }

  docNormal.innerHTML = markdownToHtml(text);

  if (!lastDocText || lastDocText === text) {
    docDiff.innerHTML = '<p class="text-sm text-slate-500">No changes to diff yet.</p>';
    return;
  }
  docDiff.innerHTML = buildSimpleDiffHtml(lastDocText, text);

  renderChecklist(text);
}

function agentSummaryText({ brdMarkdown, questions, mode, versionLabel } = {}) {
  const qCount = Array.isArray(questions) ? questions.length : 0;
  if (brdMarkdown && String(brdMarkdown).trim()) {
    return `BRD updated${versionLabel ? ` (${versionLabel})` : ''}. ${qCount ? `Open questions: ${qCount}.` : 'No open questions.'}`;
  }
  if (qCount) {
    return `I need ${qCount} answers to complete the BRD. Fill them in on the right, then click “Apply Answers”.`;
  }
  return mode ? `Response received (${mode}).` : 'Response received.';
}

function buildSimpleDiffHtml(oldText, newText) {
  const oldLines = oldText.split(/\r?\n/);
  const newLines = newText.split(/\r?\n/);
  const oldSet = new Set(oldLines.filter((l) => l.trim().length > 0));
  const newSet = new Set(newLines.filter((l) => l.trim().length > 0));

  const added = [];
  for (const line of newLines) {
    if (line.trim().length === 0) {
      added.push('');
      continue;
    }
    if (!oldSet.has(line)) {
      added.push(`<span class="diff-added">${escapeHtml(line)}</span>`);
    } else {
      added.push(escapeHtml(line));
    }
  }

  const removedLines = oldLines.filter((l) => l.trim().length > 0 && !newSet.has(l));
  const removedHtml =
    removedLines.length === 0
      ? '<p class="text-sm text-slate-500">No removed lines detected.</p>'
      : `<pre class="text-sm whitespace-pre-wrap">${removedLines
          .slice(0, 200)
          .map((l) => `<span class="diff-removed">${escapeHtml(l)}</span>`)
          .join('\n')}</pre>`;

  return `
    <div class="space-y-4">
      <div>
        <h2 class="text-base font-semibold">Current (highlighted additions)</h2>
        <pre class="text-sm whitespace-pre-wrap">${added.join('\n')}</pre>
      </div>
      <div>
        <h2 class="text-base font-semibold">Removed (best-effort)</h2>
        ${removedHtml}
      </div>
    </div>
  `.trim();
}

async function sendMessage(text) {
  const normalized = text.trim();
  const isAsk = normalized.toLowerCase().startsWith('/ask ');
  const userText = isAsk ? normalized.slice(5) : normalized;

  const isUpdate = !isAsk && currentDocText && currentDocText.trim().length > 0;

  const jsonContract = [
    'Return STRICT JSON only (no markdown fences, no commentary).',
    'JSON schema:',
    '{',
    '  "mode": "questions" | "brd",',
    '  "versionLabel": "v0.1" (optional),',
    '  "changelog": ["..." ] (optional),',
    '  "brdMarkdown": "..." (string; full BRD markdown when available),',
    '  "questions": [',
    '    {"id":"q1","question":"...","context":"...","required":true}',
    '  ]',
    '}',
    'Rules:',
    '- If you are still gathering requirements, set mode="questions" and return questions (brdMarkdown may be empty or a skeleton).',
    '- If you can generate/update the BRD, set mode="brd" and return brdMarkdown as the full document using the BRD Template (Strict).',
  ].join('\n');

  const effectivePrompt = isUpdate
    ? [
        jsonContract,
        '',
        'Update the BRD below using the new information.',
        'Keep the BRD Template (Strict) section headings unchanged.',
        'Increment the version and include a short changelog at the top of the document control section.',
        '',
        'BRD (current):',
        '```markdown',
        currentDocText,
        '```',
        '',
        'New information from user:',
        userText,
      ].join('\n')
    : !isAsk
      ? [
          jsonContract,
          '',
          'Create a BRD using the BRD Template (Strict).',
          'Include **TBD** for unknowns and ask questions for missing information.',
          '',
          'Initiative context:',
          userText,
        ].join('\n')
      : userText;

  appendBubble({ role: 'user', text: userText });
  const typing = appendBubble({ role: 'agent', text: '...', isTyping: true });

  try {
    const res = await fetch(`${API_BASE_URL}/api/message`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: effectivePrompt }),
    });

    const json = await res.json();
    setStatus(json.meta);

    if (json.reply) {
      typing.bubble.innerHTML = '';

      const payload = tryExtractJson(json.reply);
      const brdMarkdown = payload?.brdMarkdown != null ? String(payload.brdMarkdown) : '';
      const questions = normalizeQuestions(payload?.questions);
      const mode = payload?.mode ? String(payload.mode) : null;
      const versionLabel = payload?.versionLabel ? String(payload.versionLabel) : null;

      const p = document.createElement('p');
      p.className = 'text-sm leading-relaxed whitespace-pre-wrap';

      if (payload && (brdMarkdown || questions.length || mode)) {
        p.textContent = agentSummaryText({ brdMarkdown, questions, mode, versionLabel });
        typing.bubble.appendChild(p);

        renderQuestions(questions);

        if (brdMarkdown && looksLikeMarkdownDoc(brdMarkdown)) {
          lastDocText = currentDocText;
          currentDocText = brdMarkdown;
          renderDoc(currentDocText);
          addVersionSnapshot(currentDocText, { source: 'agent', versionLabel });
        }
      } else {
        // Fallback: render raw text and keep legacy behavior.
        p.textContent = json.reply;
        typing.bubble.appendChild(p);

        if (looksLikeMarkdownDoc(json.reply)) {
          renderQuestions([]);
          lastDocText = currentDocText;
          currentDocText = json.reply;
          renderDoc(currentDocText);
          addVersionSnapshot(currentDocText, { source: 'agent' });
        }
      }
    } else if (json.error) {
      typing.bubble.innerHTML = '';
      const p = document.createElement('p');
      p.className = 'text-sm leading-relaxed whitespace-pre-wrap text-red-600 dark:text-red-400';
      p.textContent = `Error: ${json.error}`;
      typing.bubble.appendChild(p);
    } else {
      typing.bubble.innerHTML = '';
      const p = document.createElement('p');
      p.className = 'text-sm leading-relaxed whitespace-pre-wrap';
      p.textContent = 'No reply';
      typing.bubble.appendChild(p);
    }
  } catch (err) {
    typing.bubble.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'text-sm leading-relaxed whitespace-pre-wrap text-red-600 dark:text-red-400';
    p.textContent = `Request failed: ${err.message}`;
    typing.bubble.appendChild(p);
  }
}

function wireButtons() {
  try {
    if (sidebarToggle && window.matchMedia && window.matchMedia('(max-width: 1023px)').matches) {
      sidebarToggle.checked = true;
    }
  } catch {
    // ignore
  }

  themeToggle?.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
  });

  document.querySelectorAll('[data-quick]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-quick');
      const prompt =
        mode === 'gather'
          ? 'Gather business requirements first. Ask me the key business questions you need to create a BRD.'
          : mode === 'brief'
            ? 'Create a BRD Brief for this initiative and list TBDs and open questions. Keep it business-first (no deep technical design yet).'
            : 'Generate a full BRD in Markdown using the BRD Template (Strict). Include examples in each section and mark unknowns as **TBD**.';
      promptInput.value = promptInput.value.trim() ? `${prompt}\n\n${promptInput.value}` : prompt;
      promptInput.focus();
    });
  });

  document.querySelectorAll('[data-template]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const t = btn.getAttribute('data-template');
      const prompt =
        t === 'ecommerce'
          ? 'I want to build an e-commerce app. Help me gather business requirements, then generate a BRD using the BRD Template (Strict).'
          : t === 'fintech'
            ? 'I want to build a fintech platform. Help me gather business requirements, then generate a BRD using the BRD Template (Strict).'
            : 'I want to build a SaaS portal. Help me gather business requirements, then generate a BRD using the BRD Template (Strict).';
      promptInput.value = prompt;
      promptInput.focus();
    });
  });

  document.getElementById('newProject')?.addEventListener('click', () => {
    chat.innerHTML = '';
    lastDocText = '';
    currentDocText = '';
    versions = [];
    activeVersionId = null;
    saveVersions();
    renderVersionTabs();
    renderDoc('');
    renderQuestions([]);
    sessionStatus.textContent = 'Session: -';
    if (versionTag) versionTag.textContent = 'v0.1';
  });

  downloadBtn?.addEventListener('click', () => {
    const text = currentDocText || '';
    if (!text.trim()) return;
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'brd.md';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}

applyAnswersBtn?.addEventListener('click', async () => {
  if (!pendingQuestions.length) return;
  const answers = [];
  questionsForm?.querySelectorAll('[data-question-id]')?.forEach((el) => {
    const id = el.getAttribute('data-question-id');
    const value = (el.value || '').trim();
    if (id) answers.push({ id, answer: value });
  });

  const missingRequired = pendingQuestions.some((q) => q.required && !answers.find((a) => a.id === q.id && a.answer));
  if (missingRequired) {
    appendBubble({
      role: 'agent',
      text: 'Some required answers are missing. Please fill all questions marked *.',
    });
    return;
  }

  const merged = pendingQuestions.map((q) => {
    const a = answers.find((x) => x.id === q.id)?.answer || '';
    return `- ${q.question}\n  Answer: ${a || '**TBD**'}`;
  });

  const msg = ['Answers to open questions:', ...merged].join('\n');
  await sendMessage(msg);
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = promptInput.value.trim();
  if (!text) return;
  promptInput.value = '';
  await sendMessage(text);
});

loadVersions();
renderVersionTabs();
if (versions.length) {
  setActiveVersion(versions[0].id);
} else {
  renderDoc('');
}

renderQuestions([]);

wireButtons();

appendBubble({
  role: 'agent',
  text:
    'Share your initiative in 2–5 sentences (who it’s for, what problem, desired outcome). I’ll ask business questions first, then generate a BRD Brief or full BRD.\n\nTip: once a BRD exists, your next messages update it automatically. Use “/ask …” to ask questions without updating the document.',
});
