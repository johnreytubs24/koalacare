const API_URL = "https://script.google.com/macros/s/AKfycby1dKG2OxtfTuCingj5HSVidHjWDHsEew_cpHaXcj3Lz_AgAMYp2EM3D2Rdi8gd9JbyWg/exec";

let currentStudent = null;
let studentCheckTimer = null;

async function verifyCode() {
  const code = document.getElementById("studentCode").value.trim().toUpperCase();
  const message = document.getElementById("loginMessage");

  if (!code) {
    message.textContent = "Please enter your student code.";
    message.style.color = "red";
    return;
  }

  message.textContent = "Checking code...";
  message.style.color = "#555";

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "verifyCode",
        studentCode: code
      })
    });

    const result = await response.json();

	if (result.success) {
	  currentStudent = result;

	  localStorage.setItem("koalaStudentCode", code);
	  localStorage.setItem("koalaStudentName", result.studentName || "");

	  document.getElementById("loginBox").classList.add("hidden");
	  document.getElementById("reportBox").classList.remove("hidden");

	  document.getElementById("welcomeText").textContent =
		"Welcome to KoalaCare Report System. Please report truthfully, responsibly, and in accordance with our #BeKind values.";
		
		showSubmitForm();
		startStudentAutoCheck();
	} else {
      message.textContent = result.message;
      message.style.color = "red";
    }

  } catch (error) {
    message.textContent = "Connection error. Please try again.";
    message.style.color = "red";
  }
}
async function submitReport() {
  const message = document.getElementById("reportMessage");

  const data = {
    action: "submitReport",
    studentCode: currentStudent?.studentCode || localStorage.getItem("koalaStudentCode"),
    incidentDate: document.getElementById("incidentDate").value,
    incidentTime: document.getElementById("incidentTime").value,
    area: document.getElementById("area").value,
    personInvolved: document.getElementById("personInvolved").value.trim(),
    witnesses: document.getElementById("witnesses").value.trim(),
    category: document.getElementById("category").value,
    urgency: document.getElementById("urgency").value,
    description: document.getElementById("description").value.trim(),
    evidenceLink: document.getElementById("evidenceLink").value.trim()
  };

  if (!data.incidentDate || !data.incidentTime || !data.area || !data.personInvolved || !data.category || !data.description) {
    message.textContent = "Please complete all required fields.";
    message.style.color = "red";
    return;
  }

  message.textContent = "Submitting report...";
  message.style.color = "#555";

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (result.success) {
      message.style.color = "green";
      message.textContent = `Report submitted successfully. Report ID: ${result.reportId}`;
      clearForm();
    } else {
      message.style.color = "red";
      message.textContent = result.message;
    }

  } catch (error) {
    message.style.color = "red";
    message.textContent = "Connection error. Please try again.";
  }
}

function clearForm() {
  document.getElementById("incidentDate").value = "";
  document.getElementById("incidentTime").value = "";
  document.getElementById("area").value = "";
  document.getElementById("personInvolved").value = "";
  document.getElementById("witnesses").value = "";
  document.getElementById("category").value = "";
  document.getElementById("urgency").value = "Normal";
  document.getElementById("description").value = "";
  document.getElementById("evidenceLink").value = "";
}

function logout() {
  currentStudent = null;

  localStorage.removeItem("koalaStudentCode");
  localStorage.removeItem("koalaStudentName");

  document.getElementById("studentCode").value = "";
  document.getElementById("loginMessage").textContent = "";
  document.getElementById("reportMessage").textContent = "";

  document.getElementById("loginBox").classList.remove("hidden");
  document.getElementById("reportBox").classList.add("hidden");
  
  if (studentCheckTimer) {
  clearInterval(studentCheckTimer);
  studentCheckTimer = null;
}
}

window.addEventListener("load", () => {
  const savedCode = localStorage.getItem("koalaStudentCode");

  if (savedCode) {
    currentStudent = {
      studentCode: savedCode
    };

    document.getElementById("loginBox").classList.add("hidden");
    document.getElementById("reportBox").classList.remove("hidden");

    document.getElementById("welcomeText").textContent =
      "Welcome to KoalaCare Report System. Please report truthfully, responsibly, and in accordance with our #BeKind values.";
	  showSubmitForm();
		startStudentAutoCheck();
	  
	  
	  
  }
});

function showSubmitForm() {
  document.getElementById("submitFormBox").classList.remove("hidden");
  document.getElementById("myReportsBox").classList.add("hidden");
}

async function loadMyReports() {
  const code =
    currentStudent?.studentCode ||
    localStorage.getItem("koalaStudentCode");

  const list = document.getElementById("myReportsList");

  document.getElementById("submitFormBox").classList.add("hidden");
  document.getElementById("myReportsBox").classList.remove("hidden");

  if (!code) {
    list.innerHTML = `
      <div class="my-report-card">
        Please login first.
      </div>
    `;
    return;
  }

  list.innerHTML = `
    <div class="my-report-card">
      Loading your reports...
    </div>
  `;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "getMyReports",
        studentCode: code
      })
    });

    const result = await response.json();

    if (result.success) {
      renderMyReports(result.reports);
    } else {
      list.innerHTML = `
        <div class="my-report-card">
          ${result.message}
        </div>
      `;
    }

  } catch (error) {
    list.innerHTML = `
      <div class="my-report-card">
        Connection error. Please try again.
      </div>
    `;
  }
}

function renderMyReports(reports) {
  const list = document.getElementById("myReportsList");

  if (!reports || reports.length === 0) {
    list.innerHTML = `<div class="my-report-card">No reports submitted yet.</div>`;
    updateMyReportsBadge(0);
    return;
  }

  let seenResponses = JSON.parse(
    localStorage.getItem("koalaSeenResponses") || "{}"
  );

  let newResponseCount = 0;

  list.innerHTML = reports.map(report => {
    const hasResponse = report.teacherResponse && report.teacherResponse.trim() !== "";
    const responseKey = report.reportId + "|" + report.teacherResponse;
    const isNewResponse = hasResponse && !seenResponses[responseKey];

    if (isNewResponse) {
      newResponseCount++;
    }

    return `
      <div class="my-report-card">
        <div class="my-report-header">
          <strong>${escapeHTML(report.reportId)}</strong>
          <span class="my-status">${escapeHTML(report.status)}</span>
        </div>

        ${
          isNewResponse
            ? `<span class="new-response">🆕 New Response from Adviser</span>`
            : ""
        }

        <p><strong>Category:</strong> ${escapeHTML(report.category)}</p>
        <p><strong>Area:</strong> ${escapeHTML(report.area)}</p>
        <p><strong>Submitted:</strong> ${formatDateTime(report.timestamp)}</p>

        <div class="teacher-response">
          <strong>Teacher Response:</strong>
          <p>
            ${
              hasResponse
                ? escapeHTML(report.teacherResponse)
                : "Your report has been received. Please wait for your adviser’s response."
            }
          </p>
        </div>
      </div>
    `;
  }).join("");

  updateMyReportsBadge(newResponseCount);

  reports.forEach(report => {
    if (report.teacherResponse && report.teacherResponse.trim() !== "") {
      const key = report.reportId + "|" + report.teacherResponse;
      seenResponses[key] = true;
    }
  });

  localStorage.setItem(
    "koalaSeenResponses",
    JSON.stringify(seenResponses)
  );

  setTimeout(() => {
    updateMyReportsBadge(0);
  }, 1500);
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

function escapeHTML(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function updateMyReportsBadge(count) {
  const badge = document.getElementById("myReportsBadge");

  if (!badge) return;

  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove("hidden");
  } else {
    badge.textContent = "0";
    badge.classList.add("hidden");
  }
}

async function checkMyReportsUpdates() {
  const code = currentStudent?.studentCode || localStorage.getItem("koalaStudentCode");

  if (!code) return;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "getMyReports",
        studentCode: code
      })
    });

    const result = await response.json();

    if (!result.success || !result.reports) return;

    const seenResponses = JSON.parse(
      localStorage.getItem("koalaSeenResponses") || "{}"
    );

    let newCount = 0;

    result.reports.forEach(report => {
      const hasResponse =
        report.teacherResponse &&
        report.teacherResponse.trim() !== "";

      if (hasResponse) {
        const key = report.reportId + "|" + report.teacherResponse;

        if (!seenResponses[key]) {
          newCount++;
        }
      }
    });

    updateMyReportsBadge(newCount);

  } catch (error) {
    console.log("My Reports auto-check failed.");
  }
}

function startStudentAutoCheck() {
  if (studentCheckTimer) {
    clearInterval(studentCheckTimer);
  }

  checkMyReportsUpdates();

  studentCheckTimer = setInterval(() => {
    checkMyReportsUpdates();
  }, 5000);
}