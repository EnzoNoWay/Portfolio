// ============================================================


// ── INDEX.HTML: PAGE SWITCHER ─────────────────────────────────────────────────

function showPage(name) {
  document.querySelectorAll(".page").forEach(function(p) {
    p.classList.remove("active");
  });
  document.querySelectorAll(".nav-links a").forEach(function(a) {
    a.classList.remove("active");
  });
  document.getElementById("page-" + name).classList.add("active");
  document.getElementById("nav-" + name).classList.add("active");
}


// ── TAKENQUIZ.HTML: QUIZ LIST ─────────────────────────────────────────────────

// ── STEP 1: THE QUIZ LIST ─────────────────────────────────────────────────────
// This array holds all the quizzes while the page is open.
// These 3 are the default entries shown on first load.

var quizzes = [
  { id: 1, title: "Quiz 2",       date: "Februaru 24, 2026",   file: "Image/Quiz 2.jpg",   score: 17, image: null },
  { id: 2, title: "Quiz 3",             date: "March 10, 2026", file: "Image/Quiz 3.jpg",  score: 10, image: null },
  { id: 3, title: "Computer 1", date: "March 06, 2026",  file: "Image/Comlab 1.jpg", score: 75, image: null },
];

// Holds the image the user picked (as base64 data), or null if none chosen
var selectedImage = null;
var selectedOriginalFilename = null; // Track original filename for saving


/**
 * Save base64 image to ./Image/ folder using File System Access API
 * targetDir: optional directory handle (e.g. from showDirectoryPicker), or null for file picker
 * Returns filename if successful, null if cancelled/error
 */
let imageDirHandle = null; // Persistent dir handle across calls

async function saveImageToFolder(base64Data, suggestedName, targetDir = null) {
  try {
    // Decode base64
    const base64Header = base64Data.split(',')[0];
    const mimeMatch = base64Header.match(/data:([^;]+)/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
    const extension = mimeType.split('/')[1] || 'png';
    
    // Unique filename
    // Use original filename if available, else suggested with timestamp
    let filename;
    if (window.selectedOriginalFilename) {
      filename = window.selectedOriginalFilename;
    } else {
      const timestamp = Date.now();
      filename = suggestedName ? 
        `${suggestedName.replace(/[^a-z0-9]/gi, '_')}_${timestamp}.${extension}` : 
        `quiz_${timestamp}.${extension}`;
    }

    let handle;
    if ('showDirectoryPicker' in window && targetDir) {
      // Auto-save to targetDir/Image/
      const imageSubdir = await targetDir.getDirectoryHandle('Image', { create: true });
      handle = await imageSubdir.getFileHandle(filename, { create: true });
    } else if ('showSaveFilePicker' in window) {
      // Fallback: user picks file location
      handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'Image files', accept: { [mimeType]: ['.' + extension] } }]
      });
    } else {
      // Legacy fallback: create download link
      const a = document.createElement('a');
      a.href = base64Data;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return filename;
    }

    // Base64 to Blob
    const byteString = atob(base64Data.split(',')[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeType });

    // Write file
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();

    const fullPath = targetDir ? `Image/${filename}` : filename;
    console.log(`Image saved: ./${fullPath}`);
    return fullPath;
  } catch (err) {
    console.log('Save failed, using base64 fallback:', err);
    return 'base64-fallback';
  }
}

// ── STEP 2: WAIT FOR THE PAGE TO FULLY LOAD ──────────────────────────────────
// Everything inside here runs only AFTER the page HTML is ready

document.addEventListener("DOMContentLoaded", async function () {

  // Common upload setup (for both upload.html and takenquiz.html)
  const hasUploadForm = document.querySelector(".file-input");
  const hasQuizList = document.getElementById("quiz-list");  


  if (hasUploadForm) {
    // Try to get persistent dir handle for Image/
    try {
      imageDirHandle = await window.showDirectoryPicker();
    } catch (e) {
      console.log('Dir picker cancelled/failed; will use file picker fallback');
    }

    // Prefill date inputs
    document.querySelectorAll('.quiz-date').forEach(input => {
      input.value = new Date().toISOString().split('T')[0];
    });

    // Handler for all file inputs
    document.querySelectorAll('.file-input').forEach(fileInput => {
      fileInput.addEventListener("change", function () {
        const file = this.files[0];
        if (!file) return;

        const card = this.closest('.upload-card');
        const fileNameEl = card.querySelector('.file-name');
        fileNameEl.textContent = file.name;

        const titleBox = card.querySelector('.quiz-title');
        if (!titleBox.value.trim()) {
          titleBox.value = file.name.replace(/\.[^/.]+$/, "");
        }

        window.selectedOriginalFilename = file.name;

        const reader = new FileReader();
        reader.onload = function (e) {
          window.selectedImage = e.target.result;
          const preview = card.querySelector('.preview-img');
          preview.src = window.selectedImage;
          preview.style.display = "block";
        };
        reader.readAsDataURL(file);
      });
    });

    // Handler for all add buttons
    document.querySelectorAll('.add-btn').forEach(addBtn => {
      addBtn.addEventListener("click", async function () {
        const card = this.closest('.upload-card');
        const titleBox = card.querySelector('.quiz-title');
        const scoreBox = card.querySelector('.quiz-score');
        const errorMsg = card.querySelector('.error-msg');
        const fileInput = card.querySelector('.file-input');
        const previewImg = card.querySelector('.preview-img');
        const dateInput = card.querySelector('.quiz-date');
        const type = card.dataset.type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());

        let title = titleBox.value.trim();
        if (!title) {
          errorMsg.style.display = "block";
          titleBox.focus();
          return;
        }
        errorMsg.style.display = "none";

        let score = null;
        const rawScore = scoreBox.value.trim();
        if (rawScore !== "") {
          score = parseInt(rawScore, 10);
          score = Math.max(0, Math.min(100, score));
        }

        let dateStr;
        if (dateInput.value) {
          const quizDate = new Date(dateInput.value + 'T00:00:00');
          if (!isNaN(quizDate.getTime())) {
            dateStr = quizDate.toLocaleDateString("en-US", { month: "long", day: "2-digit", year: "numeric" }).toLowerCase();
          }
        }
        const today = dateStr || new Date().toLocaleDateString("en-US", { month: "long", day: "2-digit", year: "numeric" }).toLowerCase();

        let fileName = "—";
        let imageForList = null;
        if (window.selectedImage) {
          const savedPath = await saveImageToFolder(window.selectedImage, title || type.toLowerCase(), imageDirHandle);
          if (savedPath) {
            fileName = savedPath;
          } else {
            imageForList = window.selectedImage;
          }
        }

        const newQuiz = {
          id: Date.now(),
          title,
          type,
          date: today,
          file: fileName,
          score,
          image: imageForList,
        };

        // Load existing quizzes if any
        loadQuizzes();
        quizzes.unshift(newQuiz);
        try {
          localStorage.setItem('quizzes', JSON.stringify(quizzes.slice(0,50))); // Limit to 50 to avoid quota
        } catch (e) {
          console.warn('localStorage quota exceeded, trimming old quizzes');
          quizzes = quizzes.slice(-50); // Keep last 50
          localStorage.setItem('quizzes', JSON.stringify(quizzes));
        }

        // Clear form
        titleBox.value = "";
        scoreBox.value = "";
        dateInput.value = "";
        fileInput.value = "";
        card.querySelector('.file-name').textContent = "No file chosen";
        previewImg.style.display = "none";
        window.selectedImage = null;
        window.selectedOriginalFilename = null;

        // Render if list exists
        if (hasQuizList) renderList();
      });
    });
  }


  // Quiz list setup (only if present)
  if (hasQuizList) {
    loadQuizzes();
    renderList();
  }

});


// ── STEP 6: DELETE A QUIZ ─────────────────────────────────────────────────────


function deleteQuiz(id) {
  // Keep every quiz EXCEPT the one with the matching id
  quizzes = quizzes.filter(function (q) {
    return q.id !== id;
  });

  // Refresh the list so the deleted entry disappears
  renderList();
}


// ── STEP 7: PICK A COLOUR FOR THE SCORE BADGE ────────────────────────────────


function badgeClass(score) {
  return ""; 
}


// ── VIEW IMAGE MODAL ──────────────────────────────────────────────────────────

function viewImage(imgSrc, title) {
  // Create modal overlay
  var modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    cursor: pointer;
  `;
  
  // Image
  var img = document.createElement('img');
  img.src = imgSrc;
  img.style.cssText = `
    max-width: 90vw; max-height: 90vh;
    object-fit: contain;
    border-radius: 8px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  `;
  img.alt = title;
  
  // Title bar
  var titleBar = document.createElement('div');
  titleBar.style.cssText = `
    position: absolute;
    top: 20px; left: 20px; right: 20px;
    background: rgba(255,255,255,0.1);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    padding: 12px 20px;
    color: white;
    font-family: sans-serif;
    font-weight: 600;
    font-size: 1.1rem;
    text-shadow: 0 1px 3px rgba(0,0,0,0.5);
  `;
  titleBar.textContent = title;
  
  modal.appendChild(titleBar);
  modal.appendChild(img);
  modal.onclick = function() { document.body.removeChild(modal); };
  
  document.body.appendChild(modal);
  img.onclick = function(e) { e.stopPropagation(); }; // Prevent closing on img click
}

// ── STEP 8: DRAW / REFRESH THE QUIZ LIST ─────────────────────────────────────


function renderList() {
  var list    = document.getElementById("quiz-list");
  var counter = document.getElementById("quiz-count");

  
  var total = quizzes.length;
  counter.textContent = total + " quiz" + (total !== 1 ? "zes" : "") + " total";

  
  localStorage.setItem('quizzes', JSON.stringify(quizzes));

  
  if (total === 0) {
    list.innerHTML = '<div class="empty-state">No quizzes yet. Upload one above!</div>';
    return;
  }

  // Build the HTML for every quiz and join them together into one string
  list.innerHTML = quizzes.map(function (q) {

    var cls   = badgeClass(q.score);                     // colour class
    var label = q.score !== null ? q.score : "—";  // score text

    // Build thumbnail: prefer path if available, else base64
    var thumb = "";
    if (q.file && q.file !== "—" && !q.file.startsWith('data:')) {
      thumb = '<img class="quiz-thumb" src="' + q.file + '" alt="' + q.title + '" onclick="viewImage(\'' + q.file + '\',\'' + q.title + '\')" onerror="this.style.display=\'none\'"/>';
    } else if (q.image) {
      thumb = '<img class="quiz-thumb" src="' + q.image + '" alt="' + q.title + '" onclick="viewImage(\'' + q.image + '\',\'' + q.title + '\')"/>';
    }

    // Return one quiz row as an HTML string
    return (
      '<div class="quiz-item">' +
        thumb +
        '<div class="quiz-item-left">' +
          '<div class="quiz-item-title">' + q.title + "</div>" +
          '<div class="quiz-item-meta">' +
            "<span>" + (q.type || 'Quiz') + "</span>" +
            "<span>" + q.date + "</span>" +
            "<span>" + q.file + "</span>" +
          "</div>" +

        "</div>" +
        '<div class="quiz-item-right">' +
          '<div class="score-badge ' + cls + '">' + label + "</div>" +
          '<button class="delete-btn" onclick="deleteQuiz(' + q.id + ')">✕ remove</button>' +
        "</div>" +
      "</div>"
    );

  }).join(""); // glue all the rows together into one big string
}

function loadQuizzes() {
  const saved = localStorage.getItem('quizzes');
  if (saved) {
    quizzes = JSON.parse(saved);
  }
}
