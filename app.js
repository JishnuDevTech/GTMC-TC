/* =========================================================
   Leaving Certificate Manager — app.js
   =========================================================
   Requires firebase-config.js to be loaded first with real keys.
*/

(function () {
  "use strict";

  /* ---------- Firebase init ---------- */
  let db = null;
  let firebaseReady = false;

  function initFirebase() {
    const placeholder = !firebaseConfig || firebaseConfig.apiKey === "YOUR_API_KEY";
    if (placeholder) {
      setConnStatus("error", "Add your Firebase keys in firebase-config.js");
      return;
    }
    try {
      firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      firebaseReady = true;
      setConnStatus("ok", "Connected to Firebase");
    } catch (err) {
      console.error(err);
      setConnStatus("error", "Could not connect — check firebase-config.js");
    }
  }

  function setConnStatus(state, label) {
    const el = document.getElementById("connStatus");
    el.className = "conn-status conn-" + state;
    el.textContent = label;
  }

  /* ---------- Collections / doc paths ---------- */
  const CERT_COLLECTION = "certificates";
  const SETTINGS_DOC = "settings/instituteInfo";
  const COUNTER_DOC = "counters/tcCounter";

  /* =========================================================
     NUMBER -> WORDS  (used for "Date of Birth in Words")
     ========================================================= */
  function numberToWords(num) {
    if (num === 0) return "zero";
    const ones = ["", "one", "two", "three", "four", "five", "six", "seven",
      "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen",
      "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
    const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty",
      "seventy", "eighty", "ninety"];

    function chunk(n) {
      let str = "";
      if (n >= 100) {
        str += ones[Math.floor(n / 100)] + " hundred";
        n %= 100;
        if (n > 0) str += " ";
      }
      if (n >= 20) {
        str += tens[Math.floor(n / 10)];
        if (n % 10 > 0) str += " " + ones[n % 10];
      } else if (n > 0) {
        str += ones[n];
      }
      return str;
    }

    let result = "";
    let n = num;
    const thousands = Math.floor(n / 1000);
    n %= 1000;
    if (thousands > 0) {
      result += chunk(thousands) + " thousand";
      if (n > 0) result += " ";
    }
    if (n > 0 || result === "") {
      result += chunk(n);
    }
    return result.trim();
  }

  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  function dobToWords(isoDate) {
    if (!isoDate) return "";
    const [y, m, d] = isoDate.split("-").map(Number);
    if (!y || !m || !d) return "";
    const dayWords = numberToWords(d);
    const monthName = MONTH_NAMES[m - 1];
    const yearWords = numberToWords(y);
    return `${dayWords} ${monthName} ${yearWords}`.toUpperCase();
  }

  /* ---------- Date display helpers ---------- */
  function isoToDMY(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    if (!y || !m || !d) return "";
    return `${d}/${m}/${y}`;
  }

  function todayDMY() {
    const t = new Date();
    const d = String(t.getDate()).padStart(2, "0");
    const m = String(t.getMonth() + 1).padStart(2, "0");
    return `${d}/${m}/${t.getFullYear()}`;
  }

  function parseTcNumeric(str) {
    const m = String(str || "").match(/(\d+)\s*$/);
    return m ? parseInt(m[1], 10) : NaN;
  }

  /* =========================================================
     INSTITUTE SETTINGS
     ========================================================= */
  let instituteSettings = {
    mandalName: "Gramin Shikshan Prasarak Mandal's",
    instituteName: "GRAMIN TECHNICAL & MANAGEMENT CAMPUS",
    address: "Vishnupuri, Nanded - 431 606 (M.S.)",
    place: "Nanded",
    logoUrl: ""
  };

  function applySettingsToUI() {
    document.getElementById("instituteNameTopbar").textContent = instituteSettings.instituteName;
    document.getElementById("s_mandalName").value = instituteSettings.mandalName || "";
    document.getElementById("s_instituteName").value = instituteSettings.instituteName || "";
    document.getElementById("s_address").value = instituteSettings.address || "";
    document.getElementById("s_place").value = instituteSettings.place || "";
    document.getElementById("s_logo").value = instituteSettings.logoUrl || "";
    refreshPreview();
  }

  async function loadSettings() {
    if (!firebaseReady) { applySettingsToUI(); return; }
    try {
      const snap = await db.doc(SETTINGS_DOC).get();
      if (snap.exists) {
        instituteSettings = Object.assign({}, instituteSettings, snap.data());
      }
    } catch (err) {
      console.warn("Could not load settings, using defaults.", err);
    }
    applySettingsToUI();
  }

  async function saveSettings() {
    instituteSettings = {
      mandalName: document.getElementById("s_mandalName").value.trim(),
      instituteName: document.getElementById("s_instituteName").value.trim(),
      address: document.getElementById("s_address").value.trim(),
      place: document.getElementById("s_place").value.trim(),
      logoUrl: document.getElementById("s_logo").value.trim()
    };
    const msg = document.getElementById("settingsMsg");
    if (!firebaseReady) {
      msg.textContent = "Not connected to Firebase — settings are only applied for this session.";
      msg.className = "form-msg err";
      applySettingsToUI();
      return;
    }
    try {
      await db.doc(SETTINGS_DOC).set(instituteSettings, { merge: true });
      msg.textContent = "Settings saved.";
      msg.className = "form-msg ok";
      applySettingsToUI();
    } catch (err) {
      console.error(err);
      msg.textContent = "Could not save settings: " + err.message;
      msg.className = "form-msg err";
    }
  }

  /* =========================================================
     CERTIFICATE RENDERING (shared by preview + print)
     ========================================================= */
  function buildCertificateNode(data) {
    const tpl = document.getElementById("certificateTemplate");
    const node = tpl.content.cloneNode(true);
    const root = document.createElement("div");
    root.appendChild(node);

    const set = (field, value) => {
      const el = root.querySelector(`[data-field="${field}"]`);
      if (el) el.textContent = value || "";
    };

    set("mandalName", instituteSettings.mandalName);
    set("instituteName", instituteSettings.instituteName);
    set("address", instituteSettings.address);
    set("tcNo", data.tcNo);
    set("enrollmentNo", data.enrollmentNo);
    set("eligibilityNo", data.eligibilityNo);
    set("name", data.name);
    set("motherName", data.motherName);
    set("religion", data.religion);
    set("caste", data.caste);
    set("nationality", data.nationality);
    set("placeOfBirth", data.placeOfBirth);
    set("dob", isoToDMY(data.dob));
    set("dobWords", data.dobWords);
    set("lastSchool", data.lastSchool);
    set("dateAdmission", isoToDMY(data.dateAdmission));
    set("progress", data.progress);
    set("dateLeaving", isoToDMY(data.dateLeaving));
    set("yearStudying", data.yearStudying);
    set("reasonLeaving", data.reasonLeaving);
    set("remark", data.remark);
    set("issueDate", todayDMY());
    set("issuePlace", instituteSettings.place);

    const logoImg = root.querySelector(".cert-logo-img");
    const logoPlaceholder = root.querySelector(".cert-logo-placeholder");
    if (instituteSettings.logoUrl) {
      logoImg.src = instituteSettings.logoUrl;
      logoImg.classList.remove("hidden");
      logoPlaceholder.style.display = "none";
    } else {
      logoImg.classList.add("hidden");
      logoPlaceholder.style.display = "";
    }

    return root.firstElementChild;
  }

  function renderInto(containerId, data) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";
    container.appendChild(buildCertificateNode(data));
  }

  function refreshPreview() {
    renderInto("certPreview", collectFormData());
    const hasName = document.getElementById("f_name").value.trim().length > 0;
    document.getElementById("printBtn").disabled = !hasName;
  }

  /* =========================================================
     FORM <-> DATA
     ========================================================= */
  function collectFormData() {
    return {
      tcNo: val("f_tcNo"),
      enrollmentNo: val("f_enrollmentNo"),
      eligibilityNo: val("f_eligibilityNo"),
      name: val("f_name"),
      motherName: val("f_motherName"),
      religion: val("f_religion"),
      caste: val("f_caste"),
      nationality: val("f_nationality"),
      placeOfBirth: val("f_placeOfBirth"),
      dob: val("f_dob"),
      dobWords: val("f_dobWords"),
      lastSchool: val("f_lastSchool"),
      dateAdmission: val("f_dateAdmission"),
      progress: val("f_progress"),
      dateLeaving: val("f_dateLeaving"),
      yearStudying: val("f_yearStudying"),
      reasonLeaving: val("f_reasonLeaving"),
      remark: val("f_remark")
    };
  }

  function val(id) { return document.getElementById(id).value.trim(); }

  function fillForm(data) {
    document.getElementById("f_tcNo").value = data.tcNo || "";
    document.getElementById("f_enrollmentNo").value = data.enrollmentNo || "";
    document.getElementById("f_eligibilityNo").value = data.eligibilityNo || "";
    document.getElementById("f_name").value = data.name || "";
    document.getElementById("f_motherName").value = data.motherName || "";
    document.getElementById("f_religion").value = data.religion || "";
    document.getElementById("f_caste").value = data.caste || "";
    document.getElementById("f_nationality").value = data.nationality || "Indian";
    document.getElementById("f_placeOfBirth").value = data.placeOfBirth || "";
    document.getElementById("f_dob").value = data.dob || "";
    document.getElementById("f_dobWords").value = data.dobWords || "";
    document.getElementById("f_lastSchool").value = data.lastSchool || "";
    document.getElementById("f_dateAdmission").value = data.dateAdmission || "";
    document.getElementById("f_progress").value = data.progress || "";
    document.getElementById("f_dateLeaving").value = data.dateLeaving || "";
    document.getElementById("f_yearStudying").value = data.yearStudying || "";
    document.getElementById("f_reasonLeaving").value = data.reasonLeaving || "";
    document.getElementById("f_remark").value = data.remark || "";
    refreshPreview();
  }

  function clearForm() {
    fillForm({});
    editingId = null;
    document.getElementById("editingBadge").classList.add("hidden");
    document.getElementById("saveBtn").textContent = "Save Certificate";
    suggestNextTcNo();
  }

  /* =========================================================
     TC NUMBER AUTO-INCREMENT
     ========================================================= */
  async function suggestNextTcNo() {
    const hint = document.getElementById("tcNoHint");
    if (!firebaseReady) {
      hint.textContent = "Connect Firebase to auto-suggest the next TC number.";
      return;
    }
    try {
      const snap = await db.doc(COUNTER_DOC).get();
      const current = snap.exists ? (snap.data().current || 0) : 0;
      document.getElementById("f_tcNo").value = current + 1;
      hint.textContent = `Auto-suggested (last used was ${current || "none yet"}). Edit if needed.`;
      refreshPreview();
    } catch (err) {
      console.warn(err);
      hint.textContent = "Could not fetch the next TC number automatically.";
    }
  }

  // Within a transaction: counter becomes max(existing counter, number typed in).
  // This lets you type a custom starting number the first time, then it auto-increments from there.
  async function bumpCounterIfNeeded(tcNoString) {
    const numeric = parseTcNumeric(tcNoString);
    if (Number.isNaN(numeric)) return;
    const ref = db.doc(COUNTER_DOC);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = snap.exists ? (snap.data().current || 0) : 0;
      if (numeric > current) {
        tx.set(ref, { current: numeric }, { merge: true });
      }
    });
  }

  /* =========================================================
     SAVE / EDIT / DELETE CERTIFICATES
     ========================================================= */
  let editingId = null;
  let recordsCache = [];

  async function saveCertificate(e) {
    e.preventDefault();
    const msg = document.getElementById("formMsg");

    if (!firebaseReady) {
      msg.textContent = "Not connected to Firebase — add your keys in firebase-config.js to save.";
      msg.className = "form-msg err";
      return;
    }

    const data = collectFormData();
    if (!data.name) {
      msg.textContent = "Student name is required.";
      msg.className = "form-msg err";
      return;
    }

    const saveBtn = document.getElementById("saveBtn");
    saveBtn.disabled = true;

    try {
      if (editingId) {
        await db.collection(CERT_COLLECTION).doc(editingId).set(
          Object.assign({}, data, {
            tcNoNumeric: parseTcNumeric(data.tcNo) || null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }),
          { merge: true }
        );
        msg.textContent = "Certificate updated.";
      } else {
        await bumpCounterIfNeeded(data.tcNo);
        await db.collection(CERT_COLLECTION).add(
          Object.assign({}, data, {
            tcNoNumeric: parseTcNumeric(data.tcNo) || null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          })
        );
        msg.textContent = "Certificate saved.";
      }
      msg.className = "form-msg ok";
      clearForm();
    } catch (err) {
      console.error(err);
      msg.textContent = "Could not save: " + err.message;
      msg.className = "form-msg err";
    } finally {
      saveBtn.disabled = false;
    }
  }

  function startEdit(id) {
    const record = recordsCache.find((r) => r.id === id);
    if (!record) return;
    editingId = id;
    fillForm(record);
    document.getElementById("editingBadge").classList.remove("hidden");
    document.getElementById("saveBtn").textContent = "Update Certificate";
    document.getElementById("tcNoHint").textContent = "Editing existing record — TC number left as-is.";
    switchTab("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteRecord(id) {
    if (!confirm("Delete this certificate record? This cannot be undone.")) return;
    try {
      await db.collection(CERT_COLLECTION).doc(id).delete();
    } catch (err) {
      alert("Could not delete: " + err.message);
    }
  }

  function printRecord(id) {
    const record = recordsCache.find((r) => r.id === id);
    if (!record) return;
    renderInto("certPrint", record);
    window.print();
  }

  /* =========================================================
     RECORDS TABLE (real-time)
     ========================================================= */
  function listenToRecords() {
    if (!firebaseReady) return;
    db.collection(CERT_COLLECTION).orderBy("createdAt", "desc")
      .onSnapshot((snapshot) => {
        recordsCache = snapshot.docs.map((d) => Object.assign({ id: d.id }, d.data()));
        renderRecordsTable();
      }, (err) => {
        console.error(err);
        document.getElementById("recordsTbody").innerHTML =
          `<tr><td colspan="6" class="empty-row">Could not load records: ${err.message}</td></tr>`;
      });
  }

  function renderRecordsTable() {
    const term = document.getElementById("recordSearch").value.trim().toLowerCase();
    const filtered = !term ? recordsCache : recordsCache.filter((r) =>
      [r.name, r.tcNo, r.enrollmentNo, r.eligibilityNo]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term))
    );

    const tbody = document.getElementById("recordsTbody");
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-row">No records found.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map((r) => `
      <tr>
        <td>${escapeHtml(r.tcNo)}</td>
        <td>${escapeHtml(r.name)}</td>
        <td>${escapeHtml(r.motherName)}</td>
        <td>${escapeHtml(isoToDMY(r.dateLeaving))}</td>
        <td>${escapeHtml(r.lastSchool)}</td>
        <td class="col-actions">
          <button class="btn btn-ghost btn-small" data-action="edit" data-id="${r.id}">Edit</button>
          <button class="btn btn-secondary btn-small" data-action="print" data-id="${r.id}">Print</button>
          <button class="btn btn-danger btn-small" data-action="delete" data-id="${r.id}">Delete</button>
        </td>
      </tr>
    `).join("");
  }

  function escapeHtml(str) {
    if (str === undefined || str === null) return "";
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* =========================================================
     TABS
     ========================================================= */
  function switchTab(name) {
    document.querySelectorAll(".tab-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.tab === name));
    document.querySelectorAll(".tab-panel").forEach((p) =>
      p.classList.toggle("active", p.id === "tab-" + name));
  }

  /* =========================================================
     WIRE UP
     ========================================================= */
  function wireEvents() {
    document.querySelectorAll(".tab-btn").forEach((btn) =>
      btn.addEventListener("click", () => switchTab(btn.dataset.tab)));

    document.getElementById("lcForm").addEventListener("submit", saveCertificate);
    document.getElementById("resetFormBtn").addEventListener("click", clearForm);

    document.getElementById("f_dob").addEventListener("change", (e) => {
      document.getElementById("f_dobWords").value = dobToWords(e.target.value);
      refreshPreview();
    });

    document.getElementById("lcForm").addEventListener("input", refreshPreview);

    document.getElementById("printBtn").addEventListener("click", () => {
      renderInto("certPrint", collectFormData());
      window.print();
    });

    document.getElementById("recordSearch").addEventListener("input", renderRecordsTable);

    document.getElementById("recordsTbody").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.action === "edit") startEdit(id);
      if (btn.dataset.action === "delete") deleteRecord(id);
      if (btn.dataset.action === "print") printRecord(id);
    });

    document.getElementById("saveSettingsBtn").addEventListener("click", saveSettings);
  }

  /* =========================================================
     BOOT
     ========================================================= */
  document.addEventListener("DOMContentLoaded", async () => {
    wireEvents();
    initFirebase();
    await loadSettings();
    refreshPreview();
    suggestNextTcNo();
    listenToRecords();
  });
})();
