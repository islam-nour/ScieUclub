import {
  auth,
  collection,
  db,
  deleteDoc,
  doc,
  onAuthStateChanged,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  signInWithEmailAndPassword,
  signOut,
  updateDoc
} from "./firebase.js";

const PHONE_ALLOWED_PATTERN = /^[0-9\u0660-\u0669\u06f0-\u06f9+\s()-]+$/;
const PHONE_DIGIT_PATTERN = /[0-9\u0660-\u0669\u06f0-\u06f9]/g;

const loginView = document.querySelector("#loginView");
const dashboardView = document.querySelector("#dashboardView");
const loginForm = document.querySelector("#loginForm");
const loginMessage = document.querySelector("#loginMessage");
const adminMessage = document.querySelector("#adminMessage");
const logoutButton = document.querySelector("#logoutButton");
const tableBody = document.querySelector("#registrationsTableBody");
const tableStatus = document.querySelector("#tableStatus");
const totalRegistrations = document.querySelector("#totalRegistrations");
const visibleRegistrations = document.querySelector("#visibleRegistrations");
const childSearch = document.querySelector("#childSearch");
const phoneSearch = document.querySelector("#phoneSearch");
const ageFilter = document.querySelector("#ageFilter");
const exportCsvButton = document.querySelector("#exportCsvButton");
const exportExcelButton = document.querySelector("#exportExcelButton");
const editModal = document.querySelector("#editModal");
const editForm = document.querySelector("#editForm");
const closeModalButton = document.querySelector("#closeModalButton");
const cancelEditButton = document.querySelector("#cancelEditButton");

let registrations = [];
let unsubscribeRegistrations = null;
let currentEditId = null;

function showMessage(target, type, text) {
  target.textContent = text;
  target.className = `form-message ${type}`;
  target.classList.remove("hidden");
}

function clearMessage(target) {
  target.textContent = "";
  target.className = "form-message hidden";
}

function normalize(value) {
  return String(value || "").trim().toLocaleLowerCase("ar");
}

function getPath(source, path) {
  return path.split(".").reduce((current, key) => current?.[key], source);
}

function formatBoolean(value) {
  return value ? "نعم" : "لا";
}

function formatTimestamp(value) {
  if (!value) return "";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return new Intl.DateTimeFormat("ar-DZ", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isValidPhoneNumber(value) {
  const phone = String(value || "").trim();
  const digitCount = (phone.match(PHONE_DIGIT_PATTERN) || []).length;
  return PHONE_ALLOWED_PATTERN.test(phone) && digitCount >= 8 && digitCount <= 15;
}

function validateEditPhoneFields() {
  const phoneFields = editForm.querySelectorAll('input[type="tel"]');
  let firstInvalidInput = null;

  phoneFields.forEach((input) => {
    input.setCustomValidity("");

    if (!isValidPhoneNumber(input.value)) {
      input.setCustomValidity("يرجى إدخال رقم صحيح بدون حروف.");
      firstInvalidInput ??= input;
    }
  });

  if (firstInvalidInput) {
    firstInvalidInput.focus();
    showMessage(adminMessage, "error", "أرقام الهاتف والواتساب يجب أن تحتوي على أرقام فقط بدون حروف.");
    return false;
  }

  return true;
}

function setupEditPhoneGuards() {
  editForm.querySelectorAll('input[type="tel"]').forEach((input) => {
    input.addEventListener("beforeinput", (event) => {
      if (!event.data) return;
      if (!PHONE_ALLOWED_PATTERN.test(event.data)) {
        event.preventDefault();
      }
    });

    input.addEventListener("input", () => {
      input.setCustomValidity("");
      input.value = input.value.replace(/[^0-9\u0660-\u0669\u06f0-\u06f9+\s()-]/g, "");
    });
  });
}

function filteredRegistrations() {
  const childTerm = normalize(childSearch.value);
  const phoneTerm = normalize(phoneSearch.value);
  const selectedAge = ageFilter.value;

  return registrations.filter((registration) => {
    const childName = normalize(`${registration.child?.firstName || ""} ${registration.child?.lastName || ""}`);
    const parentPhone = normalize(registration.parent?.phone || "");
    const age = String(registration.child?.age || "");

    return (
      (!childTerm || childName.includes(childTerm)) &&
      (!phoneTerm || parentPhone.includes(phoneTerm)) &&
      (!selectedAge || age === selectedAge)
    );
  });
}

function updateStats(visibleRows) {
  totalRegistrations.textContent = registrations.length;
  visibleRegistrations.textContent = visibleRows.length;
}

function renderTable() {
  const visibleRows = filteredRegistrations();
  updateStats(visibleRows);

  if (!visibleRows.length) {
    tableBody.innerHTML = "";
    tableStatus.textContent = registrations.length ? "لا توجد نتائج مطابقة" : "لا توجد تسجيلات بعد";
    return;
  }

  tableStatus.textContent = `${visibleRows.length} تسجيل`;
  tableBody.innerHTML = visibleRows
    .map((registration) => {
      const childName = `${registration.child?.firstName || ""} ${registration.child?.lastName || ""}`.trim();
      const parentName = `${registration.parent?.firstName || ""} ${registration.parent?.lastName || ""}`.trim();

      return `
        <tr>
          <td>${escapeHtml(childName)}</td>
          <td>${escapeHtml(registration.child?.age || "")}</td>
          <td>${escapeHtml(registration.child?.gender || "")}</td>
          <td>${escapeHtml(parentName)}</td>
          <td>${escapeHtml(registration.parent?.phone || "")}</td>
          <td>${escapeHtml(formatTimestamp(registration.createdAt))}</td>
          <td>
            <div class="row-actions">
              <button type="button" data-action="print" data-id="${registration.id}" class="table-button">طباعة</button>
              <button type="button" data-action="edit" data-id="${registration.id}" class="table-button">تعديل</button>
              <button type="button" data-action="delete" data-id="${registration.id}" class="table-button danger">حذف</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function subscribeToRegistrations() {
  if (unsubscribeRegistrations) unsubscribeRegistrations();

  const registrationsQuery = query(collection(db, "registrations"), orderBy("createdAt", "desc"));
  unsubscribeRegistrations = onSnapshot(
    registrationsQuery,
    (snapshot) => {
      registrations = snapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data()
      }));
      clearMessage(adminMessage);
      renderTable();
    },
    (error) => {
      console.error(error);
      showMessage(adminMessage, "error", "تعذر تحميل التسجيلات. تحقق من إعدادات Firebase والصلاحيات.");
    }
  );
}

function openEditModal(id) {
  const registration = registrations.find((item) => item.id === id);
  if (!registration) return;

  currentEditId = id;
  editForm.querySelectorAll("[data-edit]").forEach((field) => {
    const value = getPath(registration, field.dataset.edit);
    if (typeof value === "boolean") {
      field.value = String(value);
    } else {
      field.value = value ?? "";
    }
    field.setCustomValidity("");
  });

  editModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeEditModal() {
  currentEditId = null;
  editModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

async function saveEdit(event) {
  event.preventDefault();

  if (!validateEditPhoneFields()) {
    editForm.reportValidity();
    return;
  }

  if (!editForm.checkValidity() || !currentEditId) {
    editForm.reportValidity();
    return;
  }

  const updateData = {};
  editForm.querySelectorAll("[data-edit]").forEach((field) => {
    let value = field.value.trim();
    if (field.dataset.edit === "child.age") value = Number(value);
    if (["health.hasAllergy", "health.hasChronicDisease", "health.takesMedication"].includes(field.dataset.edit)) {
      value = value === "true";
    }
    updateData[field.dataset.edit] = value;
  });

  try {
    await updateDoc(doc(db, "registrations", currentEditId), {
      ...updateData,
      updatedAt: serverTimestamp()
    });
    closeEditModal();
    showMessage(adminMessage, "success", "تم حفظ التعديل بنجاح.");
  } catch (error) {
    console.error(error);
    showMessage(adminMessage, "error", "تعذر حفظ التعديل.");
  }
}

async function deleteRegistration(id) {
  const registration = registrations.find((item) => item.id === id);
  const childName = `${registration?.child?.firstName || ""} ${registration?.child?.lastName || ""}`.trim();
  const confirmed = window.confirm(`هل تريد حذف تسجيل ${childName || "هذا الطفل"}؟`);

  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, "registrations", id));
    showMessage(adminMessage, "success", "تم حذف التسجيل.");
  } catch (error) {
    console.error(error);
    showMessage(adminMessage, "error", "تعذر حذف التسجيل.");
  }
}

function toExportRow(registration) {
  return {
    "اسم الطفل": registration.child?.firstName || "",
    "لقب الطفل": registration.child?.lastName || "",
    "تاريخ الميلاد": registration.child?.birthDate || "",
    "العمر": registration.child?.age || "",
    "الجنس": registration.child?.gender || "",
    "اسم الولي": registration.parent?.firstName || "",
    "لقب الولي": registration.parent?.lastName || "",
    "هاتف الولي": registration.parent?.phone || "",
    "واتساب الولي": registration.parent?.whatsapp || "",
    "البريد الإلكتروني": registration.parent?.email || "",
    "العنوان": registration.parent?.address || "",
    "فصيلة الدم": registration.health?.bloodType || "",
    "حساسية": formatBoolean(registration.health?.hasAllergy),
    "نوع الحساسية": registration.health?.allergyType || "",
    "مرض مزمن": formatBoolean(registration.health?.hasChronicDisease),
    "اسم المرض": registration.health?.chronicDiseaseName || "",
    "أدوية حاليا": formatBoolean(registration.health?.takesMedication),
    "اسم الدواء": registration.health?.medicationName || "",
    "ملاحظات صحية": registration.health?.notes || "",
    "مسؤول الطوارئ": registration.emergency?.name || "",
    "صلة القرابة": registration.emergency?.relationship || "",
    "هاتف الطوارئ": registration.emergency?.phone || "",
    "واتساب الطوارئ": registration.emergency?.whatsapp || "",
    "تاريخ التسجيل": formatTimestamp(registration.createdAt)
  };
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportCsv() {
  const rows = filteredRegistrations().map(toExportRow);
  if (!rows.length) {
    showMessage(adminMessage, "error", "لا توجد بيانات للتصدير.");
    return;
  }

  const headers = Object.keys(rows[0]);
  const csvRows = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => `"${String(row[header] ?? "").replaceAll('"', '""')}"`)
        .join(",")
    )
  ];

  downloadBlob(`\uFEFF${csvRows.join("\n")}`, "scieuclub-registrations.csv", "text/csv;charset=utf-8");
}

function exportExcel() {
  const rows = filteredRegistrations().map(toExportRow);
  if (!rows.length) {
    showMessage(adminMessage, "error", "لا توجد بيانات للتصدير.");
    return;
  }

  if (!window.XLSX) {
    showMessage(adminMessage, "error", "تعذر تحميل مكتبة Excel.");
    return;
  }

  const worksheet = window.XLSX.utils.json_to_sheet(rows);
  const workbook = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(workbook, worksheet, "Registrations");
  window.XLSX.writeFile(workbook, "scieuclub-registrations.xlsx");
}

function printRegistration(id) {
  const registration = registrations.find((item) => item.id === id);
  if (!registration) return;

  const row = toExportRow(registration);
  const rowsHtml = Object.entries(row)
    .map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join("");

  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) {
    showMessage(adminMessage, "error", "تعذر فتح نافذة الطباعة.");
    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8">
        <title>استمارة تسجيل ScieUClub</title>
        <style>
          body { font-family: Arial, sans-serif; color: #172033; padding: 32px; direction: rtl; }
          h1 { color: #0F3D91; margin: 0 0 8px; }
          p { margin: 0 0 24px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #d8dee9; padding: 10px; text-align: right; }
          th { width: 32%; background: #f4f7fb; }
        </style>
      </head>
      <body>
        <h1>ScieUClub Registration System</h1>
        <p>برنامج Fun Learning English 2026</p>
        <table>${rowsHtml}</table>
        <script>window.addEventListener("load", () => window.print());</script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(loginMessage);

  if (!loginForm.checkValidity()) {
    loginForm.reportValidity();
    return;
  }

  const formData = new FormData(loginForm);
  const button = loginForm.querySelector("button");
  button.disabled = true;
  button.textContent = "جاري الدخول...";

  try {
    await signInWithEmailAndPassword(auth, formData.get("email").trim(), formData.get("password"));
  } catch (error) {
    console.error(error);
    showMessage(loginMessage, "error", "بيانات الدخول غير صحيحة أو غير مصرح بها.");
  } finally {
    button.disabled = false;
    button.textContent = "دخول";
  }
});

logoutButton.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginView.classList.add("hidden");
    dashboardView.classList.remove("hidden");
    subscribeToRegistrations();
  } else {
    dashboardView.classList.add("hidden");
    loginView.classList.remove("hidden");
    registrations = [];
    if (unsubscribeRegistrations) unsubscribeRegistrations();
  }
});

[childSearch, phoneSearch, ageFilter].forEach((input) => {
  input.addEventListener("input", renderTable);
});

tableBody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;
  if (action === "edit") openEditModal(id);
  if (action === "delete") deleteRegistration(id);
  if (action === "print") printRegistration(id);
});

editForm.addEventListener("submit", saveEdit);
closeModalButton.addEventListener("click", closeEditModal);
cancelEditButton.addEventListener("click", closeEditModal);
editModal.addEventListener("click", (event) => {
  if (event.target === editModal) closeEditModal();
});

exportCsvButton.addEventListener("click", exportCsv);
exportExcelButton.addEventListener("click", exportExcel);
setupEditPhoneGuards();
