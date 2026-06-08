import { apiFetch, buildApiUrl, getApiBaseUrl } from "./apiConfig.js";

const familySelect = document.getElementById("familySelect");
const familyNameInput = document.getElementById("familyName");
const imageGrid = document.getElementById("imageGrid");
const uploadImageInput = document.getElementById("uploadImageInput");
const selectedImagePreviewContainer = document.getElementById("selectedImagePreviewContainer");
const selectedImagePreview = document.getElementById("selectedImagePreview");

const messageForm = document.getElementById("messageForm");
const submitBtn = document.getElementById("submitBtn");
const statusBox = document.getElementById("status");

const postTypeInput = document.getElementById("postType");
const donationTypeInput = document.getElementById("donationType");
const donationDateInput = document.getElementById("donationDate");
const mainPersonNameGroup = document.getElementById("mainPersonNameGroup");
const mainPersonNameInput = document.getElementById("mainPersonName");
const occasionTextGroup = document.getElementById("occasionTextGroup");
const occasionTextInput = document.getElementById("occasionText");
const countGroup = document.getElementById("countGroup");
const countTextInput = document.getElementById("countText");
const locationInput = document.getElementById("location");
const customMessageInput = document.getElementById("customMessage");
const fullMessageGroup = document.getElementById("fullMessageGroup");
const fullMessageInput = document.getElementById("fullMessage");
const messageEditor = document.getElementById("messageEditor");
const whatsappRenderedPreview = document.getElementById("whatsappRenderedPreview");

const donorsContainer = document.getElementById("donorsContainer");
const addDonorBtn = document.getElementById("addDonorBtn");

const messageBuilder = window.DonationMessageBuilder;

if (!messageBuilder || typeof messageBuilder.generateMessage !== "function") {
  throw new Error("DonationMessageBuilder is not available in the frontend context");
}

let selectedFolderId = "";
let selectedDriveImageUrl = "";
let selectedDriveFileId = "";
let uploadedImageUrl = "";
let selectedImageUrl = "";
let activeImageLoadRequestId = 0;
let latestFormattedMessage = "";

const driveFamiliesById = new Map();
const IMAGE_FALLBACK_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 480 320'%3E%3Crect width='480' height='320' fill='%23e7edf5'/%3E%3Cg fill='none' stroke='%2391a3b8' stroke-width='14' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M56 240 168 136l84 76 52-48 120 76'/%3E%3Ccircle cx='164' cy='96' r='32'/%3E%3C/g%3E%3C/svg%3E";

const familyNameHindiMap = {
  "Sharma Family": "शर्मा परिवार",
  "Jain Family": "जैन परिवार",
  "Bhandari Family": "भंडारी परिवार",
  "Gupta Family": "गुप्ता परिवार",
};

function showStatus(message, type) {
  statusBox.textContent = message;
  statusBox.className = `status ${type}`;
}

function setDefaultDonationDate() {
  donationDateInput.value = new Date().toISOString().slice(0, 10);
}

function isMainPersonRequired(postType) {
  return postType === "Birthday" || postType === "Punyatithi" || postType === "Anniversary" || postType === "Janmajayanti";
}

function shouldEnableCountField(postType) {
  return postType === "Birthday" || postType === "Anniversary" || postType === "Punyatithi" || postType === "Janmajayanti";
}

function updateCountPlaceholder(postType) {
  const countField = document.getElementById("count") || countTextInput;
  if (!countField) {
    return;
  }

  switch (postType) {
    case "Birthday":
      countField.placeholder = "जैसे: 5वां जन्मदिन";
      break;
    case "Anniversary":
      countField.placeholder = "जैसे: 5वीं सालगिरह";
      break;
    case "Punyatithi":
      countField.placeholder = "जैसे: 5वीं पुण्यतिथि";
      break;
    default:
      countField.placeholder = "";
  }
}

function createDonorItem(donor = {}) {
  const item = document.createElement("div");
  item.className = "donor-item";
  item.innerHTML = `
    <label>
      Name
      <input type="text" class="input-lg donor-name" placeholder="Donor name" value="${donor.name || ""}" required>
    </label>
    <label>
      Relation
      <input type="text" class="input-lg donor-relation" placeholder="Optional" value="${donor.relation || ""}">
    </label>
    <button type="button" class="btn-secondary remove-donor-btn">Remove</button>
  `;
  return item;
}

function updateDonorPlaceholders() {
  const donorItems = donorsContainer.querySelectorAll(".donor-item");
  donorItems.forEach((item, index) => {
    const nameInput = item.querySelector(".donor-name");
    if (nameInput) {
      nameInput.placeholder = `Donor ${index + 1} name`;
    }
  });
}

function addDonor(donor = {}) {
  donorsContainer.appendChild(createDonorItem(donor));
  updateDonorPlaceholders();
  updatePreview();
  updateSubmitState();
}

function removeDonor(button) {
  const donorItems = donorsContainer.querySelectorAll(".donor-item");
  if (donorItems.length <= 1) {
    alert("At least one donor is required");
    return;
  }

  const donorItem = button.closest(".donor-item");
  if (!donorItem) {
    return;
  }

  donorItem.classList.add("removing");
  setTimeout(() => {
    donorItem.remove();
    updateDonorPlaceholders();
    updatePreview();
    updateSubmitState();
  }, 200);
}

function getDonors() {
  const donorItems = donorsContainer.querySelectorAll(".donor-item");
  return Array.from(donorItems)
    .map((item) => ({
      name: item.querySelector(".donor-name")?.value.trim() || "",
      relation: item.querySelector(".donor-relation")?.value.trim() || "",
    }))
    .filter((donor) => donor.name);
}

function togglePostTypeFields() {
  const postType = postTypeInput.value;
  const isOtherOccasion = postType === "Other Occasion";
  const isCustomTemplate = postType === "Custom Template";
  const needsMainPerson = isMainPersonRequired(postType);
  const canUseCount = shouldEnableCountField(postType);

  occasionTextGroup.style.display = isOtherOccasion ? "block" : "none";
  fullMessageGroup.style.display = isCustomTemplate ? "block" : "none";
  mainPersonNameGroup.style.display = needsMainPerson ? "block" : "none";
  if (countGroup) {
    countGroup.style.display = canUseCount ? "block" : "none";
  }

  countTextInput.disabled = !canUseCount;
  if (!canUseCount) {
    countTextInput.value = "";
  }
  updateCountPlaceholder(postType);

  if (!isOtherOccasion) {
    occasionTextInput.value = "";
  }

  if (!isCustomTemplate) {
    fullMessageInput.value = "";
  }

  if (!needsMainPerson) {
    mainPersonNameInput.value = "";
  }
}

function getFormData() {
  const postType = postTypeInput.value;

  return {
    donationDate: donationDateInput.value,
    postType,
    donationType: donationTypeInput.value.trim(),
    donors: getDonors(),
    mainPersonName: mainPersonNameInput.value.trim(),
    familyName: familyNameInput.value.trim(),
    occasion: postType === "Other Occasion" ? occasionTextInput.value.trim() : "",
    count: countTextInput.value.trim(),
    location: locationInput.value.trim(),
    customMessage: customMessageInput.value.trim(),
    imageUrl: selectedImageUrl,
    fullMessage: postType === "Custom Template" ? fullMessageInput.value.trim() : "",
  };
}

function attachFormattedMessage(formData) {
  const enriched = { ...formData };
  enriched.formattedMessage = messageBuilder.generateMessage(enriched);
  latestFormattedMessage = enriched.formattedMessage;
  return enriched;
}

// ── Preview system ───────────────────────────────────────────────────────────
// messageEditor  : <textarea> — raw WhatsApp markdown, single source of truth
// whatsappRenderedPreview : <div> — visual-only rendered bubble, never read back

// Convert WhatsApp markdown to safe HTML for the rendered preview.
// ONLY used for display. Never touches the textarea value.
function renderMarkdown(text) {
  if (!text) return '<span class="wa-placeholder">Preview will appear here...</span>';

  // 1. Escape HTML special chars to prevent injection.
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 2. Apply WhatsApp markdown — order matters (bold before italic).
  const rendered = escaped
    .replace(/\*([^*\n]+)\*/g, "<strong>$1</strong>")   // *bold*
    .replace(/_([^_\n]+)_/g, "<em>$1</em>")             // _italic_
    .replace(/\n/g, "<br>");                             // line breaks

  return rendered;
}

function syncRenderedPreview() {
  whatsappRenderedPreview.innerHTML = renderMarkdown(messageEditor.value);
}

function updatePreview() {
  const formData = attachFormattedMessage(getFormData());
  messageEditor.value = formData.formattedMessage || "";
  syncRenderedPreview();
}

// Returns the raw markdown from the editor — sent verbatim to WhatsApp.
function getPreviewText() {
  return messageEditor.value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

// Live sync: re-render bubble whenever user types in the editor.
messageEditor.addEventListener("input", () => {
  syncRenderedPreview();
});

// Bold button: wrap/unwrap selected text in the editor with * markers.
document.getElementById("tbBold").addEventListener("mousedown", (e) => {
  e.preventDefault(); // keep editor focused
  const ta    = messageEditor;
  const start = ta.selectionStart;
  const end   = ta.selectionEnd;
  if (start === end) return;

  const before   = ta.value.slice(0, start);
  const selected = ta.value.slice(start, end);
  const after    = ta.value.slice(end);

  let newText, newStart, newEnd;

  if (selected.startsWith("*") && selected.endsWith("*") && selected.length > 2) {
    const inner = selected.slice(1, -1);
    newText  = before + inner + after;
    newStart = start;
    newEnd   = start + inner.length;
  } else {
    const wrapped = `*${selected}*`;
    newText  = before + wrapped + after;
    newStart = start;
    newEnd   = start + wrapped.length;
  }

  ta.value = newText;
  ta.setSelectionRange(newStart, newEnd);
  ta.focus();
  syncRenderedPreview();
});

function formatDateToISO(dateStr) {
  if (!dateStr) return null;

  // Handle already ISO format
  if (dateStr.includes("-") && dateStr.length === 10) {
    return dateStr;
  }

  const months = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };

  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;

  const [day, monthStr, year] = parts;

  const month = months[monthStr];
  if (!month) return null;

  return `${year}-${month}-${day.padStart(2, "0")}`;
}

function validateForm(showAlert = false) {
  const formData = getFormData();

  if (!formData.donationDate) {
    if (showAlert) {
      alert("Donation date is required");
    }
    return false;
  }

  if (!formData.postType) {
    if (showAlert) {
      alert("Post type is required");
    }
    return false;
  }

  if (formData.donors.length < 1) {
    if (showAlert) {
      alert("At least one donor is required");
    }
    return false;
  }

  if (!formData.familyName) {
    if (showAlert) {
      alert("Family name is required");
    }
    return false;
  }

  if (!formData.donationType) {
    if (showAlert) {
      alert("Donation type is required");
    }
    return false;
  }

  if (isMainPersonRequired(formData.postType) && !formData.mainPersonName) {
    if (showAlert) {
      alert("Main person name is required for the selected post type");
    }
    return false;
  }

  if (formData.postType === "Other Occasion" && !formData.occasion) {
    if (showAlert) {
      alert("Occasion is required for Other Occasion");
    }
    return false;
  }

  if (formData.postType === "Custom Template" && !formData.fullMessage) {
    if (showAlert) {
      alert("Full message is required in Custom Template mode");
    }
    return false;
  }

  if (!formData.imageUrl) {
    if (showAlert) {
      alert("Please select or upload an image");
    }
    return false;
  }

  return true;
}

function updateSubmitState() {
  submitBtn.disabled = !validateForm(false);
}

function toMultipartFormData(formData, file) {
  const multipartData = new FormData();
  multipartData.append("donationDate", formData.donationDate || "");
  multipartData.append("formattedMessage", formData.formattedMessage || "");
  multipartData.append("postType", formData.postType || "");
  multipartData.append("donationType", formData.donationType || "");
  multipartData.append("donors", JSON.stringify(formData.donors || []));
  multipartData.append("mainPersonName", formData.mainPersonName || "");
  multipartData.append("familyName", formData.familyName || "");
  multipartData.append("occasion", formData.occasion || "");
  multipartData.append("count", formData.count || "");
  multipartData.append("location", formData.location || "");
  multipartData.append("customMessage", formData.customMessage || "");
  multipartData.append("fullMessage", formData.fullMessage || "");
  multipartData.append("image", file);
  return multipartData;
}

function syncSelectedImagePreview() {
  if (!selectedImageUrl) {
    // Show a clear empty state instead of leaving the previous image visible
    try {
      selectedImagePreview.removeAttribute("src");
    } catch (e) {
      /* ignore */
    }

    if (selectedImagePreviewContainer) {
      selectedImagePreviewContainer.replaceChildren();
      const hint = document.createElement("p");
      hint.className = "hint preview-hint";
      hint.textContent = "No image selected";
      selectedImagePreviewContainer.appendChild(hint);
      selectedImagePreviewContainer.style.display = "block";
      selectedImagePreviewContainer.style.opacity = "1";
    }

    return;
  }

  selectedImagePreview.src = selectedImageUrl;
  selectedImagePreview.alt = "Selected image";
  selectedImagePreview.loading = "lazy";
  selectedImagePreview.onerror = () => {
    selectedImagePreview.src = IMAGE_FALLBACK_PLACEHOLDER;
    console.error("[preview] failed to load selected image", {
      fileId: selectedDriveFileId || null,
      src: selectedImageUrl,
    });
  };
  selectedImagePreviewContainer.style.display = "block";
  requestAnimationFrame(() => {
    selectedImagePreviewContainer.style.opacity = "1";
  });
}

function applyImageSelection() {
  selectedImageUrl = uploadedImageUrl || selectedDriveImageUrl || "";
  syncSelectedImagePreview();
  updatePreview();
  updateSubmitState();
}

function renderImageGridMessage(message) {
  imageGrid.replaceChildren();
  const text = document.createElement("p");
  text.className = "hint";
  text.textContent = message;
  imageGrid.appendChild(text);
}

function logFamilySelectDiagnostics() {
  return;
}

async function loadFamilies() {
  familySelect.disabled = true;
  familySelect.innerHTML = '<option value="">Loading...</option>';
  showStatus("Loading families...", "");

  try {
    // Debug: log which backend base URL we're using
    console.log("[loadFamilies] getApiBaseUrl:", getApiBaseUrl());

    const response = await apiFetch("/drive/folders");
    console.log("[loadFamilies] raw fetch response:", response);

    const data = await response.json();
    console.log("[loadFamilies] parsed JSON:", data);
    const rawFolders = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.folders)
        ? data.folders
        : null;

    console.log("[loadFamilies] rawFolders:", rawFolders);

    if (!rawFolders) {
      throw new Error("Invalid folders response format");
    }

    const folders = rawFolders
      .map((folder) => ({
        id: typeof folder?.id === "string" ? folder.id.trim() : "",
        name: typeof folder?.name === "string" ? folder.name.trim() : "",
      }))
      .filter((folder) => folder.id && folder.name);

    // Debug: state before render
    console.log("[loadFamilies] driveFamiliesById before clear:", Array.from(driveFamiliesById.entries()));
    driveFamiliesById.clear();
    familySelect.innerHTML = '<option value="">Select family...</option>';

    folders
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((folder) => {
        driveFamiliesById.set(folder.id, folder.name);
        const option = document.createElement("option");
        option.value = folder.id;
        option.textContent = folder.name;
        familySelect.appendChild(option);
      });
    logFamilySelectDiagnostics();

    if (driveFamiliesById.size === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No families found";
      option.disabled = true;
      familySelect.appendChild(option);
    }
    showStatus("", "");
  } catch (error) {
    familySelect.innerHTML = '<option value="">Select family...</option>';

    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Unable to load families";
    option.disabled = true;
    familySelect.appendChild(option);

    const message = error?.message?.includes("Backend not reachable")
      ? error.message
      : "Unable to load families";
    showStatus(message, "error");
    console.error("Failed to load families:", error);
    logFamilySelectDiagnostics();
  } finally {
    familySelect.disabled = false;
  }
}

function logImageGridDiagnostics() {
  return;
}

function renderImageSkeletons(count = 6) {
  const safeCount = Math.max(2, Math.min(12, Number(count) || 6));
  imageGrid.replaceChildren();

  const fragment = document.createDocumentFragment();
  for (let index = 0; index < safeCount; index += 1) {
    const skeleton = document.createElement("div");
    skeleton.className = "image-item-skeleton";
    skeleton.setAttribute("aria-hidden", "true");
    fragment.appendChild(skeleton);
  }

  imageGrid.appendChild(fragment);
}

async function loadImages(folderId) {
  const requestId = ++activeImageLoadRequestId;
  selectedDriveImageUrl = "";
  selectedDriveFileId = "";
  imageGrid.replaceChildren();

  if (!folderId) {
    applyImageSelection();
    return;
  }

  console.log("[loadImages] selected folderId:", folderId);
  const apiBase = getApiBaseUrl();
  console.log("[loadImages] apiBase:", apiBase);
  console.time("loadImages");

  showStatus("Loading images...", "");
  renderImageSkeletons(6);

  try {
    const apiPath = `/drive/files/${encodeURIComponent(folderId)}`;
    console.log("[loadImages] calling API:", apiPath);
    const response = await apiFetch(apiPath);

    console.log("[loadImages] raw fetch response:", response);
    const data = await response.json();
    console.log("[loadImages] parsed JSON:", data);

    const files = Array.isArray(data?.data) ? data.data : [];
    if (files.length === 0 || !files.some((file) => file?.id)) {
      console.warn("[images] No image files found for folder", folderId);
    }

    // Prefer thumbnailLink from the backend when available to reduce payload size.
    const images = files
      .filter((file) => file?.id)
      .map((file) => {
        const rel = buildApiUrl(`/drive/image/${file.id}`);
        // Use thumbnailLink returned by backend if present, otherwise fall back
        // to proxied backend image endpoint.
        const imageUrlFromDrive = file.thumbnailLink || null;
        const imageUrl = imageUrlFromDrive || (apiBase ? `${apiBase}${rel}` : rel);
        console.log("[loadImages] generated image URL:", imageUrl, "(thumbnailLink present:", Boolean(file.thumbnailLink), ")");
        return {
          id: file.id,
          fileId: file.id,
          url: imageUrl,
          fallbackUrl: "",
        };
      })
      .filter((image) => image.url);

    // Perform parallel HEAD requests to measure availability and timing without
    // blocking rendering. Use Promise.allSettled so failures don't reject.
    // Fire parallel checks for availability/timing but don't await them —
    // allow rendering to proceed while diagnostics continue in background.
    Promise.allSettled(
      images.map((img) =>
        fetch(img.url, { method: "GET" })
          .then((resp) => console.log("[loadImages] image fetch status", img.url, resp.status, resp.ok))
          .catch((err) => console.error("[loadImages] image fetch failed for", img.url, err.message || err)),
      ),
    );

    if (requestId !== activeImageLoadRequestId) {
      return;
    }

    renderImages(images);
    showStatus("", "");
    console.timeEnd("loadImages");
    requestAnimationFrame(() => {
      logImageGridDiagnostics();
    });
  } catch (error) {
    if (requestId !== activeImageLoadRequestId) {
      return;
    }

    renderImageGridMessage("Unable to load images");
    const message = error?.message?.includes("Backend not reachable")
      ? error.message
      : "Failed to load images. Please try again.";
    showStatus(message, "error");
    console.error("Failed to load images from Google Drive:", error);
    logImageGridDiagnostics();
  }
}

function renderImages(images) {
  imageGrid.replaceChildren();

  if (images.length === 0) {
    renderImageGridMessage("No images found");
    showStatus("No images found for this family folder.", "error");
    applyImageSelection();
    return;
  }

  showStatus("", "");

  const fragment = document.createDocumentFragment();

  images.forEach((image) => {
    const item = document.createElement("div");
    item.className = "image-card";

    const img = document.createElement("img");
    const imageUrl = image.url;
    console.log("[renderImages] rendering image url:", imageUrl, "fileId:", image.fileId);
    img.src = imageUrl;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.dataset.loadedUrl = imageUrl;
    img.dataset.fallbackUrl = image.fallbackUrl;
    img.dataset.fallbackTried = "0";

    img.addEventListener("load", () => {
      img.dataset.loadedUrl = img.currentSrc || img.src;
      console.log("[renderImages] image loaded:", img.dataset.loadedUrl);
    });

    img.onerror = () => {
      console.error("Image failed:", imageUrl);
      if (img.dataset.fallbackTried === "0" && image.fallbackUrl) {
        img.dataset.fallbackTried = "1";
        img.src = image.fallbackUrl;
        img.dataset.loadedUrl = image.fallbackUrl;
        console.warn("[renderImages] thumbnail w1000 failed; switched to w500", {
          id: image.id,
          fileId: image.fileId || null,
          fallbackUrl: image.fallbackUrl,
        });
        return;
      }

      img.src = IMAGE_FALLBACK_PLACEHOLDER;
      img.dataset.loadedUrl = imageUrl;
      item.classList.add("fallback");
      console.error("[renderImages] image failed to load", {
        id: image.id,
        fileId: image.fileId || null,
        fullResolutionUrl: imageUrl,
        hint: "Check Google Drive sharing visibility and file availability",
      });
    };

    item.replaceChildren(img);

    item.addEventListener("click", () => {
      document.querySelectorAll(".image-card").forEach((el) => {
        el.classList.remove("selected");
      });

      item.classList.add("selected");
      selectedDriveImageUrl = img.dataset.loadedUrl || image.url;
      selectedDriveFileId = image.fileId || "";
      applyImageSelection();
    });

    fragment.appendChild(item);
  });

  imageGrid.appendChild(fragment);
  applyImageSelection();
}

function handleUploadImageChange(event) {
  const file = event.target.files?.[0];

  if (!file) {
    uploadedImageUrl = "";
    applyImageSelection();
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    uploadedImageUrl = typeof reader.result === "string" ? reader.result : "";
    document.querySelectorAll(".image-card").forEach((item) => {
      item.classList.remove("selected");
    });
    applyImageSelection();
  };
  reader.readAsDataURL(file);
}

function resetFormToInitialState() {
  // Reset select and internal selection state
  try {
    if (familySelect) {
      // leave the loaded family options intact, but reset selection to placeholder
      try {
        familySelect.selectedIndex = 0;
      } catch (e) {
        // fallback: set value to empty string
        familySelect.value = "";
      }
    }

    selectedFolderId = "";
    selectedDriveImageUrl = "";
    selectedDriveFileId = "";
    uploadedImageUrl = "";
    selectedImageUrl = "";
    latestFormattedMessage = "";
    activeImageLoadRequestId = 0;

    // Clear image grid and remove any selection classes
    imageGrid.replaceChildren();
    document.querySelectorAll(".image-card.selected").forEach((el) => el.classList.remove("selected"));

    // Clear selected image preview area and any cached image data
    if (selectedImagePreview) {
      try {
        selectedImagePreview.removeAttribute("src");
        selectedImagePreview.src = "";
      } catch (e) {
        // ignore
      }
    }
    if (selectedImagePreviewContainer) {
      selectedImagePreviewContainer.replaceChildren();
      const hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent = "No image selected";
      selectedImagePreviewContainer.appendChild(hint);
      selectedImagePreviewContainer.style.display = "block";
      selectedImagePreviewContainer.style.opacity = "1";
    }

    // Reset file input
    if (uploadImageInput) {
      try {
        uploadImageInput.value = "";
      } catch (e) {
        // some browsers may throw when clearing files programmatically
        const clone = uploadImageInput.cloneNode(true);
        uploadImageInput.parentNode.replaceChild(clone, uploadImageInput);
      }
    }

    // Reset form fields
    if (postTypeInput) postTypeInput.selectedIndex = 0;
    if (donationTypeInput) donationTypeInput.value = "";
    setDefaultDonationDate();
    if (mainPersonNameInput) mainPersonNameInput.value = "";
    if (occasionTextInput) occasionTextInput.value = "";
    if (countTextInput) countTextInput.value = "";
    if (locationInput) locationInput.value = "";
    if (customMessageInput) customMessageInput.value = "";
    if (fullMessageInput) fullMessageInput.value = "";
    if (familyNameInput) familyNameInput.value = "";

    // Reset donors to single empty donor
    donorsContainer.replaceChildren();
    addDonor();

    // Reset preview/editor
    if (messageEditor) messageEditor.value = "";
    syncRenderedPreview();

    // Ensure any image-related UI is updated to reflect cleared state
    try {
      applyImageSelection();
    } catch (e) {
      console.error("applyImageSelection failed during reset:", e);
    }

    // Reset submit button state
    updateSubmitState();
    showStatus("", "");
    // Scroll to top so the user sees the cleared form
    try {
      window.scrollTo(0, 0);
    } catch (e) {
      /* ignore in non-browser contexts */
    }
  } catch (err) {
    console.error("resetFormToInitialState failed:", err);
  }
}

familySelect.addEventListener("change", (event) => {
  selectedFolderId = event.target.value;
  const selectedFamilyName = driveFamiliesById.get(selectedFolderId) || "";

  familyNameInput.value = familyNameHindiMap[selectedFamilyName] || selectedFamilyName;
  loadImages(selectedFolderId);
  updatePreview();
  updateSubmitState();
});

addDonorBtn.addEventListener("click", () => {
  addDonor();
});

donorsContainer.addEventListener("click", (event) => {
  const removeButton = event.target.closest(".remove-donor-btn");
  if (removeButton) {
    removeDonor(removeButton);
  }
});

uploadImageInput.addEventListener("change", handleUploadImageChange);

postTypeInput.addEventListener("change", () => {
  togglePostTypeFields();
  updatePreview();
  updateSubmitState();
});

messageForm.addEventListener("input", (event) => {
  // Don't regenerate when the user is editing the markdown editor itself.
  if (event.target === messageEditor) return;
  updatePreview();
  updateSubmitState();
});

messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!validateForm(true)) {
    updateSubmitState();
    return;
  }

  if (!selectedDriveFileId) {
    alert("Please select an image");
    return;
  }

  // Read the editor content BEFORE touching anything.
  // Do NOT call updatePreview() here — it would overwrite the user's edits.
  const generatedMessage = getPreviewText();

  if (!generatedMessage || !generatedMessage.trim()) {
    showStatus("Formatted message is required", "error");
    alert("Required fields are missing");
    return;
  }

  const formData = getFormData();

  const inputDataObject = {
    postType: formData.postType,
    donationType: formData.donationType,
    donationDate: formData.donationDate,
    mainPersonName: formData.mainPersonName,
    count: formData.count,
    donors: formData.donors,
    familyName: formData.familyName,
    location: formData.location,
    customMessage: formData.customMessage,
  };

  const formattedDate = formatDateToISO(formData.donationDate);
  if (!formattedDate) {
    alert("Invalid date format");
    return;
  }

  const payload = {
    fileId: selectedDriveFileId,
    message: generatedMessage,
    inputData: inputDataObject,
    scheduledDate: formattedDate,
  };

  showStatus("Scheduling message...", "");

  try {
    const response = await apiFetch("/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // Parse response — handle cases where body may be empty or malformed
    let result = {};
    try {
      result = await response.json();
    } catch {
      // Response was 200 but body wasn't valid JSON (e.g. tunnel truncation).
      // Treat as success since the HTTP status was OK.
      console.warn("[submit] Response body could not be parsed as JSON, but status was OK");
    }

    if (result.success === false) {
      throw new Error(result.message || "Server returned failure");
    }

    alert("Message scheduled successfully");
    showStatus("Message scheduled successfully", "success");

    // Reset the form to initial state after a successful schedule
    try {
      resetFormToInitialState();
    } catch (e) {
      console.error("Failed to reset form after successful submit:", e);
    }
  } catch (err) {
    console.error("[submit] Request failed:", err);
    const message = err?.message?.includes("Backend not reachable")
      ? err.message
      : err?.message || "Failed to schedule message. Please try again.";
    alert(`Error: ${message}`);
    showStatus(message, "error");
  }
});

function initialize() {
  addDonor();
  setDefaultDonationDate();
  togglePostTypeFields();
  updatePreview();
  updateSubmitState();
  loadFamilies();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize, { once: true });
} else {
  initialize();
}
