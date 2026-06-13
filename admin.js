const notificationSound = new Audio(
  "https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
);

const ADMIN_PIN = "0524";

const API_URL =
  "https://script.google.com/macros/s/AKfycby1dKG2OxtfTuCingj5HSVidHjWDHsEew_cpHaXcj3Lz_AgAMYp2EM3D2Rdi8gd9JbyWg/exec";

let allReports = [];
let previousReportCount = 0;
let dashboardTimer = null;

window.onload = function () {
  const loggedIn = localStorage.getItem("koalacareAdminLoggedIn");

  if (loggedIn === "true") {
    showDashboard();
  }
};

async function loadReports() {
  const container = document.getElementById("reportsContainer");

  if (!container) return;

  if (allReports.length === 0) {
    container.innerHTML = `<div class="no-reports">Loading reports...</div>`;
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "getReports"
      })
    });

    const result = await response.json();

    if (result.success) {
      const currentCount = result.reports.length;

      if (
        previousReportCount > 0 &&
        currentCount > previousReportCount
      ) {
        showNotification(currentCount - previousReportCount);
      }

      previousReportCount = currentCount;
      allReports = result.reports;

      updateStats();
      renderReports();
    } else {
      container.innerHTML = `<div class="no-reports">Unable to load reports.</div>`;
    }
  } catch (error) {
    container.innerHTML = `<div class="no-reports">Connection error. Please try again.</div>`;
  }
}

function updateStats() {
  document.getElementById("totalReports").textContent = allReports.length;

  document.getElementById("newReports").textContent =
    allReports.filter(report => report.status === "New").length;

  document.getElementById("urgentReports").textContent =
    allReports.filter(report => report.urgency === "Urgent").length;
}

function renderReports() {
  const container = document.getElementById("reportsContainer");

  const searchText = document.getElementById("searchBox").value.toLowerCase();
  const statusFilter = document.getElementById("statusFilter").value;
  const categoryFilter = document.getElementById("categoryFilter").value;
  const sortFilter = document.getElementById("sortFilter")?.value || "newest";

  let filteredReports = allReports.filter(report => {
    const matchesSearch =
      String(report.personInvolved).toLowerCase().includes(searchText) ||
      String(report.reporterName).toLowerCase().includes(searchText) ||
      String(report.reportId).toLowerCase().includes(searchText) ||
      String(report.area).toLowerCase().includes(searchText) ||
      String(report.category).toLowerCase().includes(searchText) ||
      String(report.urgency).toLowerCase().includes(searchText) ||
      String(report.status).toLowerCase().includes(searchText) ||
      String(report.description).toLowerCase().includes(searchText);

    const matchesStatus =
      statusFilter
        ? report.status === statusFilter
        : report.status !== "Archived";

    const matchesCategory =
      !categoryFilter || report.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  filteredReports.sort((a, b) => {
    if (sortFilter === "newest") {
      return getTimeValue(b.timestamp) - getTimeValue(a.timestamp);
    }

    if (sortFilter === "oldest") {
      return getTimeValue(a.timestamp) - getTimeValue(b.timestamp);
    }

    if (sortFilter === "urgency") {
      return (
        getUrgencyRank(a.urgency) - getUrgencyRank(b.urgency) ||
        getTimeValue(b.timestamp) - getTimeValue(a.timestamp)
      );
    }

    if (sortFilter === "status") {
      return (
        getStatusRank(a.status) - getStatusRank(b.status) ||
        getTimeValue(b.timestamp) - getTimeValue(a.timestamp)
      );
    }

    if (sortFilter === "needsResponse") {
      return (
        Number(hasAdviserNotes(a)) - Number(hasAdviserNotes(b)) ||
        getTimeValue(b.timestamp) - getTimeValue(a.timestamp)
      );
    }

    if (sortFilter === "category") {
      return (
        String(a.category).localeCompare(String(b.category)) ||
        getTimeValue(b.timestamp) - getTimeValue(a.timestamp)
      );
    }

    if (sortFilter === "area") {
      return (
        String(a.area).localeCompare(String(b.area)) ||
        getTimeValue(b.timestamp) - getTimeValue(a.timestamp)
      );
    }

    return 0;
  });

  if (filteredReports.length === 0) {
    container.innerHTML = `<div class="no-reports">No reports found.</div>`;
    return;
  }

  container.innerHTML = filteredReports.map(report => {
    return `
      <div class="report-card" onclick="openReportModal('${escapeHTML(report.reportId)}')">
        <div class="report-header">
          <div>
            <div class="report-id">${escapeHTML(report.reportId)}</div>
            <small>${formatDateTime(report.timestamp)}</small>
          </div>

          <div>
            ${
              report.status === "New"
                ? `<span class="new-badge">🟡 NEW</span>`
                : ""
            }
            <span class="status ${getStatusClass(report.status)}">
              ${escapeHTML(report.status)}
            </span>
          </div>
        </div>

        <div class="report-grid">
          <div>
            <div class="label">Reporter</div>
            <div class="value">${escapeHTML(report.reporterName)}</div>
          </div>

          <div>
            <div class="label">Category</div>
            <div class="value">${getCategoryLabel(report.category)}</div>
          </div>

          <div>
            <div class="label">Area</div>
            <div class="value">${escapeHTML(report.area)}</div>
          </div>

          <div>
            <div class="label">Urgency</div>
            <div class="value ${getUrgencyClass(report.urgency)}">
              ${escapeHTML(report.urgency)}
            </div>
          </div>
        </div>

        <div class="description">
          <div class="label">Report Details</div>
          <p>${escapeHTML(report.description).slice(0, 120)}...</p>
        </div>

        ${
          !hasAdviserNotes(report)
            ? `<div class="click-hint">⚠️ Needs adviser response</div>`
            : `<div class="click-hint">👆 Click to view full report</div>`
        }
      </div>
    `;
  }).join("");
}

function openReportModal(reportId) {
  const report = allReports.find(item => item.reportId === reportId);

  if (!report) return;

  const modal = document.getElementById("reportModal");
  const modalBody = document.getElementById("modalBody");

  if (!modal || !modalBody) return;

  modalBody.innerHTML = `
    <div class="modal-banner">
      ${getCategoryLabel(report.category)}
    </div>

    <div class="modal-report-head">
      <h2 class="modal-title">🐨 ${escapeHTML(report.reportId)}</h2>
      <p class="modal-tagline">
        Report with kindness. Act with fairness.
      </p>
    </div>

    <div class="modal-grid">
      <div class="modal-info-card status-card">
        <div class="label">Status</div>
        <div class="value">
          <span class="status ${getStatusClass(report.status)}">
            ${escapeHTML(report.status)}
          </span>
        </div>
      </div>

      <div class="modal-info-card">
        <div class="label">Urgency</div>
        <div class="value ${getUrgencyClass(report.urgency)}">
          ${escapeHTML(report.urgency)}
        </div>
      </div>

      <div class="modal-info-card">
        <div class="label">Submitted</div>
        <div class="value">${formatDateTime(report.timestamp)}</div>
      </div>

      <div class="modal-info-card">
        <div class="label">Reporter</div>
        <div class="value">${escapeHTML(report.reporterName)}</div>
      </div>

      <div class="modal-info-card">
        <div class="label">Student Code</div>
        <div class="value">${escapeHTML(report.studentCode)}</div>
      </div>

      <div class="modal-info-card">
        <div class="label">Incident Date</div>
        <div class="value">${formatDate(report.incidentDate)}</div>
      </div>

      <div class="modal-info-card">
        <div class="label">Incident Time</div>
        <div class="value">${formatTime(report.incidentTime)}</div>
      </div>

      <div class="modal-info-card">
        <div class="label">Area</div>
        <div class="value">${escapeHTML(report.area)}</div>
      </div>
    </div>

    <div class="modal-section">
      <div class="label">Person/s Involved</div>
      <p>${escapeHTML(report.personInvolved)}</p>
    </div>

    <div class="modal-section">
      <div class="label">Witness/es</div>
      <p>${escapeHTML(report.witnesses || "None")}</p>
    </div>

    <div class="modal-section">
      <div class="label">Report Details</div>
      <p>${escapeHTML(report.description)}</p>
    </div>

    ${
      report.evidenceLink
        ? `<div class="modal-section">
            <div class="label">Evidence Link</div>
            <a href="${escapeHTML(report.evidenceLink)}" target="_blank">Open Evidence</a>
          </div>`
        : ""
    }

    <div class="admin-controls">
      <div class="label">Update Status</div>
      <select id="modal-status-${escapeHTML(report.reportId)}">
        <option ${report.status === "New" ? "selected" : ""}>New</option>
        <option ${report.status === "Under Review" ? "selected" : ""}>Under Review</option>
        <option ${report.status === "Resolved" ? "selected" : ""}>Resolved</option>
        <option ${report.status === "Archived" ? "selected" : ""}>Archived</option>
      </select>

      <div class="label">Adviser Notes</div>
      <textarea
        id="modal-notes-${escapeHTML(report.reportId)}"
        rows="4"
        placeholder="Add adviser notes..."
      >${escapeHTML(report.adviserNotes || "")}</textarea>

      <button id="modal-save-${escapeHTML(report.reportId)}" onclick="saveModalUpdate('${escapeHTML(report.reportId)}')">
        💾 Save Changes
      </button>
    </div>
  `;

  modal.classList.add("active");
}

function closeReportModal() {
  const modal = document.getElementById("reportModal");
  if (modal) modal.classList.remove("active");
}

async function saveModalUpdate(reportId) {
  const statusInput = document.getElementById(`modal-status-${reportId}`);
  const notesInput = document.getElementById(`modal-notes-${reportId}`);
  const saveButton = document.getElementById(`modal-save-${reportId}`);

  if (!statusInput || !notesInput) return;

  const status = statusInput.value;
  const adviserNotes = notesInput.value.trim();

  if (saveButton) {
    saveButton.textContent = "Saving...";
    saveButton.disabled = true;
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "updateReport",
        reportId: reportId,
        status: status,
        adviserNotes: adviserNotes
      })
    });

    const result = await response.json();

    if (result.success) {
      if (saveButton) {
        saveButton.textContent = "✅ Saved!";
        saveButton.style.background = "#2e7d32";
      }

      setTimeout(() => {
        closeReportModal();
        loadReports();
      }, 800);
    } else {
      alert(result.message);

      if (saveButton) {
        saveButton.textContent = "💾 Save Changes";
        saveButton.disabled = false;
      }
    }
  } catch (error) {
    alert("Connection error. Please try again.");

    if (saveButton) {
      saveButton.textContent = "💾 Save Changes";
      saveButton.disabled = false;
    }
  }
}

function getStatusClass(status) {
  if (status === "New") return "status-new";
  if (status === "Under Review") return "status-review";
  if (status === "Resolved") return "status-resolved";
  if (status === "Archived") return "status-archived";
  return "";
}

function getUrgencyClass(urgency) {
  if (urgency === "Normal") return "urgency-normal";
  if (urgency === "Important") return "urgency-important";
  if (urgency === "Urgent") return "urgency-urgent";
  return "";
}

function getCategoryLabel(category) {
  if (category === "Kindness Report") {
    return "💛 Kindness Report";
  }

  if (category === "Lost and Found") {
    return "🚨 Lost and Found";
  }

  return "🚨 " + escapeHTML(category);
}

function getTimeValue(value) {
  const date = new Date(value);
  return isNaN(date) ? 0 : date.getTime();
}

function getUrgencyRank(urgency) {
  if (urgency === "Urgent") return 1;
  if (urgency === "Important") return 2;
  if (urgency === "Normal") return 3;
  return 4;
}

function getStatusRank(status) {
  if (status === "New") return 1;
  if (status === "Under Review") return 2;
  if (status === "Resolved") return 3;
  if (status === "Archived") return 4;
  return 5;
}

function hasAdviserNotes(report) {
  return String(report.adviserNotes || "").trim().length > 0;
}

function formatDateTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (isNaN(date)) return value;

  return date.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (isNaN(date)) return value;

  return date.toLocaleDateString("en-PH", {
    dateStyle: "medium"
  });
}

function formatTime(value) {
  if (!value) return "";

  if (typeof value === "string" && value.includes("T")) {
    const date = new Date(value);

    if (!isNaN(date)) {
      return date.toLocaleTimeString("en-PH", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      });
    }
  }

  if (typeof value === "string" && value.includes(":")) {
    const parts = value.split(":");

    if (parts.length >= 2) {
      let hour = Number(parts[0]);
      const minute = parts[1];
      const ampm = hour >= 12 ? "PM" : "AM";

      hour = hour % 12;
      if (hour === 0) hour = 12;

      return `${hour}:${minute} ${ampm}`;
    }
  }

  return value;
}

function escapeHTML(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showNotification(count) {
  const badge = document.getElementById("notificationBadge");

  if (!badge) return;

  badge.classList.remove("hidden");

  notificationSound.play().catch(() => {});

  badge.innerHTML =
    `🔔 ${count} New Report${count > 1 ? "s" : ""} Received`;

  setTimeout(() => {
    badge.classList.add("hidden");
  }, 10000);
}

function loginAdmin() {
  const pin = document.getElementById("adminPin").value.trim();
  const message = document.getElementById("pinMessage");

  if (pin === ADMIN_PIN) {
    localStorage.setItem("koalacareAdminLoggedIn", "true");
    showDashboard();
  } else {
    message.textContent = "Incorrect Admin PIN.";
    message.style.color = "red";
  }
}

function showDashboard() {
  document.getElementById("pinScreen").classList.add("hidden");
  document.getElementById("adminDashboard").classList.remove("hidden");

  loadReports();

  if (dashboardTimer) {
    clearInterval(dashboardTimer);
  }

  dashboardTimer = setInterval(loadReports, 35000);
}

/* Keep this for older dashboard controls, kahit modal na ang main editor */
async function saveReportUpdate(reportId) {
  const statusInput = document.getElementById(`status-${reportId}`);
  const notesInput = document.getElementById(`notes-${reportId}`);

  if (!statusInput || !notesInput) return;

  const status = statusInput.value;
  const adviserNotes = notesInput.value.trim();

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "updateReport",
        reportId: reportId,
        status: status,
        adviserNotes: adviserNotes
      })
    });

    const result = await response.json();

    if (result.success) {
      alert("Report updated successfully.");
      loadReports();
    } else {
      alert(result.message);
    }
  } catch (error) {
    alert("Connection error. Please try again.");
  }
}

/* Close modal when tapping outside */
document.addEventListener("click", event => {
  const modal = document.getElementById("reportModal");

  if (!modal || !modal.classList.contains("active")) return;

  if (event.target === modal) {
    closeReportModal();
  }
});

/* Close modal using ESC */
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeReportModal();
  }
});