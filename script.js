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
  { id: 1, title: "midterm exam",       date: "may 12, 2026",   file: "Image/profile.jpeg",   score: 100, image: null },
  { id: 2, title: "quiz 1",             date: "april 28, 2026", file: "quiz1.jpg",  score: 100, image: null },
  { id: 3, title: "computer lab day 1", date: "june 02, 2026",  file: "comlab.png", score: 100, image: null },
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
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const extension = mimeType.split('/')[1] || 'jpg';
    
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
    if (targetDir) {
      // Auto-save to targetDir/Image/
      const imageSubdir = await targetDir.getDirectoryHandle('Image', { create: true });
      handle = await imageSubdir.getFileHandle(filename, { create: true });
    } else {
      // Fallback: user picks file location
      handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'Image files', accept: { [mimeType]: ['.' + extension] } }]
      });
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
    if (err.name !== 'AbortError') {
      console.error('Save failed:', err);
    }
    return null;
  }
}

// ── STEP 2: WAIT FOR THE PAGE TO FULLY LOAD ──────────────────────────────────
// Everything inside here runs only AFTER the page HTML is ready

document.addEventListener("DOMContentLoaded", async function () {

  // If the quiz list div doesn't exist, we're on index.html — stop here
  if (!document.getElementById("quiz-list")) return;

  // Try to get persistent dir handle for Image/ (user grants once)
  try {
    imageDirHandle = await window.showDirectoryPicker();
  } catch (e) {
    console.log('Dir picker cancelled/failed; will use file picker fallback');
  }

  // Prefill date input with today
  const todayDate = new Date().toISOString().split('T')[0];
  document.getElementById('quiz-date').value = todayDate;

  // ── STEP 3: FILE INPUT ───────────────────────────────────────────────────
  // When the user picks an image file, this runs automatically

  var fileInput = document.getElementById("file-input");

  fileInput.addEventListener("change", function () {
    var file = this.files[0]; // grab the file the user picked
    if (!file) return;        // if nothing was picked, stop

    // Show the filename next to the "Choose File" button
    document.getElementById("file-name-display").textContent = file.name;

    // If the quiz title box is empty, auto-fill it using the filename
    // e.g. "quiz1.jpg" becomes "quiz1"
    var titleBox = document.getElementById("quiz-title");
    if (!titleBox.value.trim()) {
      titleBox.value = file.name.replace(/\.[^/.]+$/, "");
    }

    // Save original filename for saving
    selectedOriginalFilename = file.name;

    // Read the image so we can preview it and save it
    var reader = new FileReader();
    reader.onload = function (e) {
      selectedImage = e.target.result; // save the image data

      // Show the preview image on the page
      var preview = document.getElementById("preview-img");
      preview.src = selectedImage;
      preview.style.display = "block";
    };
    reader.readAsDataURL(file); // this triggers the reader.onload above
  });


  // ── STEP 4: ADD BUTTON ───────────────────────────────────────────────────
  // When the user clicks "Add to List", this runs

  document.getElementById("add-btn").addEventListener("click", async function () {

    var titleBox = document.getElementById("quiz-title");
    var scoreBox = document.getElementById("quiz-score");
    var errorMsg = document.getElementById("error-msg");

    var title = titleBox.value.trim(); // .trim() removes extra spaces

    // If the title box is empty, show an error and stop
    if (!title) {
      errorMsg.style.display = "block";
      titleBox.focus();
      return;
    }

    // Hide the error message if it was showing
    errorMsg.style.display = "none";

    // Read the score (optional — blank means null = no score)
    var rawScore = scoreBox.value.trim();
    var score = null;
    if (rawScore !== "") {
      score = parseInt(rawScore, 10); // convert text "95" to number 95
      if (score > 100) score = 100;  // cap at 100
      if (score < 0)   score = 0;    // floor at 0
    }

    // Get custom date or fallback to today formatted like "april 03, 2026"
    var dateInput = document.getElementById('quiz-date');
    var dateStr;
    if (dateInput.value) {
      var quizDate = new Date(dateInput.value + 'T00:00:00');
      if (!isNaN(quizDate.getTime())) {
        dateStr = quizDate.toLocaleDateString("en-US", {
          month: "long",
          day:   "2-digit",
          year:  "numeric",
        }).toLowerCase();
      }
    }
    var today = dateStr || new Date().toLocaleDateString("en-US", {
      month: "long",
      day:   "2-digit",
      year:  "numeric",
    }).toLowerCase();

    // If image selected, auto-save to Image/ before adding
    var fileName = "—";
    var imageForList = null;
    if (selectedImage) {
      const savedPath = await saveImageToFolder(selectedImage, title || 'quiz', imageDirHandle);
      if (savedPath) {
        fileName = savedPath;
        imageForList = null; // Use path for thumbnail instead of base64
      } else {
        imageForList = selectedImage; // Fallback to base64 if save failed
      }
    }

    // Build the new quiz object (one row in the list)
    var newQuiz = {
      id:    Date.now(), // unique number based on current time
      title: title,
      date:  today,
      file:  fileName,
      score: score,
      image: imageForList,
    };

    // Add the new quiz to the FRONT of the list (newest on top)
    quizzes.unshift(newQuiz);

    // Clear all the form fields ready for the next entry
    titleBox.value  = "";
    scoreBox.value  = "";
    document.getElementById('quiz-date').value = "";
    fileInput.value = "";
    document.getElementById("file-name-display").textContent = "No file chosen";
    document.getElementById("preview-img").style.display = "none";
    selectedImage = null;
    selectedOriginalFilename = null;

    // Refresh the list on the page to show the new entry
    renderList();
  });


  // ── STEP 5: SHOW THE LIST ON FIRST LOAD ─────────────────────────────────
  // Load saved quizzes
  loadQuizzes();
  // Draw the quiz list as soon as the page opens
  renderList();

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
      thumb = '<img class="quiz-thumb" src="' + q.file + '" alt="quiz image" onerror="this.style.display=\'none\'"/>';
    } else if (q.image) {
      thumb = '<img class="quiz-thumb" src="' + q.image + '" alt="quiz image"/>';
    }

    // Return one quiz row as an HTML string
    return (
      '<div class="quiz-item">' +
        thumb +
        '<div class="quiz-item-left">' +
          '<div class="quiz-item-title">' + q.title + "</div>" +
          '<div class="quiz-item-meta">' +
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
