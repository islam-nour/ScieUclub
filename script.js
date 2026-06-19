import { addDoc, collection, db, serverTimestamp } from "./firebase.js";

const WHATSAPP_NUMBER = "0659959504";
const PROGRAM_START_DATE = new Date("2026-07-04T00:00:00");
const PHONE_ALLOWED_PATTERN = /^[0-9\u0660-\u0669\u06f0-\u06f9+\s()-]+$/;
const PHONE_DIGIT_PATTERN = /[0-9\u0660-\u0669\u06f0-\u06f9]/g;

const form = document.querySelector("#registrationForm");
const formMessage = document.querySelector("#formMessage");
const successPage = document.querySelector("#successPage");
const whatsappButton = document.querySelector(".whatsapp-float");
const birthDateInput = form.elements.birthDate;
const ageInput = form.elements.age;
const phoneInputs = form.querySelectorAll('input[type="tel"]');

const conditionalRules = [
  { radioName: "hasAllergy", fieldId: "allergyTypeField", inputName: "allergyType" },
  { radioName: "hasChronicDisease", fieldId: "chronicDiseaseField", inputName: "chronicDiseaseName" },
  { radioName: "takesMedication", fieldId: "medicationField", inputName: "medicationName" }
];

function getRadioValue(name) {
  return form.querySelector(`input[name="${name}"]:checked`)?.value || "";
}

function showMessage(type, text) {
  formMessage.textContent = text;
  formMessage.className = `form-message ${type}`;
  formMessage.classList.remove("hidden");
  formMessage.scrollIntoView({ behavior: "smooth", block: "center" });
}

function clearMessage() {
  formMessage.className = "form-message hidden";
  formMessage.textContent = "";
}

function setButtonLoading(isLoading) {
  const button = form.querySelector(".submit-button");
  button.disabled = isLoading;
  button.textContent = isLoading ? "جاري الإرسال..." : "إرسال التسجيل";
}

function calculateAgeAtProgramStart(dateValue) {
  if (!dateValue) return "";
  const birthDate = new Date(`${dateValue}T00:00:00`);
  let age = PROGRAM_START_DATE.getFullYear() - birthDate.getFullYear();
  const monthDiff = PROGRAM_START_DATE.getMonth() - birthDate.getMonth();
  const dayDiff = PROGRAM_START_DATE.getDate() - birthDate.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age;
}

function isValidPhoneNumber(value) {
  const phone = value.trim();
  const digitCount = (phone.match(PHONE_DIGIT_PATTERN) || []).length;
  return PHONE_ALLOWED_PATTERN.test(phone) && digitCount >= 8 && digitCount <= 15;
}

function validatePhoneFields() {
  let firstInvalidInput = null;

  phoneInputs.forEach((input) => {
    input.setCustomValidity("");

    if (!isValidPhoneNumber(input.value)) {
      input.setCustomValidity("يرجى إدخال رقم صحيح بدون حروف.");
      firstInvalidInput ??= input;
    }
  });

  if (firstInvalidInput) {
    showMessage("error", "أرقام الهاتف والواتساب يجب أن تحتوي على أرقام فقط بدون حروف.");
    firstInvalidInput.focus();
    return false;
  }

  return true;
}

function setupPhoneGuards() {
  phoneInputs.forEach((input) => {
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

function updateConditionalFields() {
  conditionalRules.forEach(({ radioName, fieldId, inputName }) => {
    const field = document.querySelector(`#${fieldId}`);
    const input = form.elements[inputName];
    const shouldShow = getRadioValue(radioName) === "yes";

    field.classList.toggle("hidden", !shouldShow);
    input.required = shouldShow;
    if (!shouldShow) input.value = "";
  });
}

function validateRegistration() {
  clearMessage();

  if (!validatePhoneFields()) {
    form.reportValidity();
    return false;
  }

  if (!form.checkValidity()) {
    form.reportValidity();
    showMessage("error", "يرجى ملء جميع الحقول المطلوبة بشكل صحيح.");
    return false;
  }

  const age = Number(ageInput.value);
  if (Number.isNaN(age) || age < 6 || age > 13) {
    showMessage("error", "العمر المقبول للبرنامج هو من 6 إلى 13 سنة.");
    ageInput.focus();
    return false;
  }

  const calculatedAge = Number(calculateAgeAtProgramStart(birthDateInput.value));
  if (!Number.isNaN(calculatedAge) && calculatedAge !== age) {
    ageInput.value = calculatedAge;
  }

  return true;
}

function buildRegistrationPayload() {
  const data = new FormData(form);
  const hasAllergy = data.get("hasAllergy") === "yes";
  const hasChronicDisease = data.get("hasChronicDisease") === "yes";
  const takesMedication = data.get("takesMedication") === "yes";

  return {
    program: {
      name: "Fun Learning English 2026",
      startDate: "2026-07-04",
      endDate: "2026-07-30"
    },
    parent: {
      firstName: data.get("parentFirstName").trim(),
      lastName: data.get("parentLastName").trim(),
      phone: data.get("parentPhone").trim(),
      whatsapp: data.get("parentWhatsapp").trim(),
      email: data.get("parentEmail").trim(),
      address: data.get("parentAddress").trim()
    },
    child: {
      firstName: data.get("childFirstName").trim(),
      lastName: data.get("childLastName").trim(),
      birthDate: data.get("birthDate"),
      age: Number(data.get("age")),
      gender: data.get("gender")
    },
    health: {
      bloodType: data.get("bloodType"),
      hasAllergy,
      allergyType: hasAllergy ? data.get("allergyType").trim() : "",
      hasChronicDisease,
      chronicDiseaseName: hasChronicDisease ? data.get("chronicDiseaseName").trim() : "",
      takesMedication,
      medicationName: takesMedication ? data.get("medicationName").trim() : "",
      notes: data.get("healthNotes").trim()
    },
    consent: data.get("consent") === "on",
    source: "qr-registration-website",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
}

function setupWhatsappButton() {
  const message = encodeURIComponent("السلام عليكم، أريد معلومات حول برنامج Fun Learning English 2026.");
  const cleanNumber = WHATSAPP_NUMBER.replace(/\D/g, "");

  if (cleanNumber) {
    whatsappButton.href = `https://wa.me/${cleanNumber}?text=${message}`;
    whatsappButton.target = "_blank";
    whatsappButton.rel = "noopener";
    return;
  }

  whatsappButton.addEventListener("click", (event) => {
    event.preventDefault();
    showMessage("error", "يرجى إضافة رقم واتساب الصحيح داخل ملف script.js.");
  });
}

conditionalRules.forEach(({ radioName }) => {
  form.querySelectorAll(`input[name="${radioName}"]`).forEach((radio) => {
    radio.addEventListener("change", updateConditionalFields);
  });
});

birthDateInput.addEventListener("change", () => {
  const calculatedAge = calculateAgeAtProgramStart(birthDateInput.value);
  if (calculatedAge !== "") ageInput.value = calculatedAge;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!validateRegistration()) return;

  setButtonLoading(true);

  try {
    await addDoc(collection(db, "registrations"), buildRegistrationPayload());
    form.reset();
    updateConditionalFields();
    clearMessage();
    form.classList.add("hidden");
    successPage.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    console.error(error);
    showMessage("error", "تعذر إرسال التسجيل حاليا. يرجى المحاولة مرة أخرى.");
  } finally {
    setButtonLoading(false);
  }
});

setupPhoneGuards();
updateConditionalFields();
setupWhatsappButton();
