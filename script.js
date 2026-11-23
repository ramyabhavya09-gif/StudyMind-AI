// ==========================================
// STUDYMIND AI
// Smart Study Assistant
// ==========================================

// PDF.js configuration
if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

// Application variables
let studyNotes = "";
let currentResult = "";
let apiKey = "";
let quizData = [];
let quizSubmitted = false;

// ==========================================
// FILE UPLOAD
// ==========================================

const fileInput = document.getElementById("fileInput");

fileInput.addEventListener("change", async function () {

    const file = this.files[0];

    if (!file) return;

    showStatus("Reading your file...");

    document.getElementById("fileName").textContent =
        "📄 " + file.name;

    try {

        if (file.type === "application/pdf" ||
            file.name.toLowerCase().endsWith(".pdf")) {

            studyNotes = await readPDF(file);

        } else if (
            file.type === "text/plain" ||
            file.name.toLowerCase().endsWith(".txt")
        ) {

            studyNotes = await file.text();

        } else {

            throw new Error("Please upload a PDF or TXT file.");

        }

        document.getElementById("notesInput").value = studyNotes;

        showStatus(
            "File successfully loaded! " +
            studyNotes.length +
            " characters extracted."
        );

    } catch (error) {

        showStatus(error.message);

    }

});

// ==========================================
// PDF TEXT EXTRACTION
// ==========================================

async function readPDF(file) {

    if (!window.pdfjsLib) {
        throw new Error("PDF reader library could not load.");
    }

    const arrayBuffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer
    }).promise;

    let extractedText = "";

    for (let pageNumber = 1;
         pageNumber <= pdf.numPages;
         pageNumber++) {

        const page = await pdf.getPage(pageNumber);

        const textContent = await page.getTextContent();

        const pageText = textContent.items
            .map(item => item.str)
            .join(" ");

        extractedText +=
            "\n\n--- Page " + pageNumber + " ---\n" +
            pageText;

    }

    return extractedText.trim();

}

// ==========================================
// PROCESS NOTES
// ==========================================

function processNotes() {

    const pastedText =
        document.getElementById("notesInput").value.trim();

    if (pastedText.length > 0) {
        studyNotes = pastedText;
    }

    if (!studyNotes) {

        showStatus("Please upload a file or paste your notes first.");

        return;

    }

    showStatus(
        "Notes ready! Choose any study tool below."
    );

    document.getElementById("toolsSection").scrollIntoView({
        behavior: "smooth"
    });

}

// ==========================================
// API SETTINGS
// ==========================================

function openApiSettings() {

    document.getElementById("apiModal").style.display = "flex";

    document.getElementById("apiKeyInput").value = "";

}

function closeApiSettings() {

    document.getElementById("apiModal").style.display = "none";

}

function saveApiKey() {

    const enteredKey =
        document.getElementById("apiKeyInput").value.trim();

    if (!enteredKey) {

        alert("Please enter an API key.");

        return;

    }

    apiKey = enteredKey;

    closeApiSettings();

    showStatus("AI connected for this session.");

}

function clearApiKey() {

    apiKey = "";

    document.getElementById("apiKeyInput").value = "";

    closeApiSettings();

    showStatus("API key cleared.");

}

// ==========================================
// GEMINI API
// ==========================================

async function askAI(prompt) {

    if (!apiKey) {

        return demoResponse(prompt);

    }

    const endpoint =
        "https://generativelanguage.googleapis.com/v1beta/models/" +
        "gemini-2.5-flash:generateContent";

    const response = await fetch(endpoint, {

        method: "POST",

        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
        },

        body: JSON.stringify({

            contents: [

                {
                    role: "user",

                    parts: [
                        {
                            text: prompt
                        }
                    ]

                }

            ],

            generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 2500
            }

        })

    });

    const data = await response.json();

    if (!response.ok) {

        throw new Error(
            data.error?.message ||
            "AI request failed. Check your API key."
        );

    }

    const answer =
        data.candidates?.[0]?.content?.parts
            ?.map(part => part.text || "")
            .join("");

    if (!answer) {

        throw new Error("AI returned an empty response.");

    }

    return answer;

}

// ==========================================
// DEMO MODE
// ==========================================

function demoResponse(prompt) {

    const text = studyNotes;

    if (prompt.includes("SUMMARY")) {

        const sentences = text
            .split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => s.length > 20);

        return sentences.slice(0, 5).join(". ") +
            ".\n\nDemo mode: Connect an AI API for intelligent summaries.";

    }

    if (prompt.includes("QUESTIONS")) {

        const sentences = text
            .split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => s.length > 25);

        return sentences
            .slice(0, 8)
            .map((s, i) => (i + 1) + ". Explain: " + s + "?")
            .join("\n\n") +
            "\n\nDemo mode: Connect AI for better questions.";

    }

    if (prompt.includes("FLASHCARDS")) {

        const sentences = text
            .split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => s.length > 25);

        const cards = sentences.slice(0, 8).map(sentence => {

            return {
                question: "What is the main idea of this statement?",
                answer: sentence
            };

        });

        return JSON.stringify(cards);

    }

    if (prompt.includes("QUIZ")) {

        const sentences = text
            .split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => s.length > 25);

        const questions = sentences.slice(0, 5).map(sentence => {

            return {

                question: "Which statement is based on your notes?",

                options: [
                    sentence,
                    "This information is unrelated to the topic.",
                    "None of the concepts are important.",
                    "The topic has no practical application."
                ],

                answer: 0

            };

        });

        return JSON.stringify(questions);

    }

    return "Demo mode is active. Connect AI for intelligent answers.";

}

// ==========================================
// SUMMARY
// ==========================================

async function generateSummary() {

    if (!checkNotes()) return;

    await runAI("SUMMARY", `

You are StudyMind AI, a helpful study assistant.

Create a clear and easy-to-understand summary
of the following study notes.

Use:
- Simple language
- Headings
- Important concepts
- Bullet points
- Definitions where necessary

Do not add information that is not in the notes.

STUDY NOTES:

${studyNotes}

`);

}

// ==========================================
// IMPORTANT QUESTIONS
// ==========================================

async function generateQuestions() {

    if (!checkNotes()) return;

    await runAI("QUESTIONS", `

Generate 10 important study questions
from the following notes.

Include:
- Short-answer questions
- Conceptual questions
- Long-answer questions

Keep questions relevant to the supplied notes.
Do not provide answers.

STUDY NOTES:

${studyNotes}

`);

}

// ==========================================
// FLASHCARDS
// ==========================================

async function generateFlashcards() {

    if (!checkNotes()) return;

    const prompt = `

Create 8 useful flashcards from these notes.

Return ONLY valid JSON.

Format:

[
 {
  "question": "Question here",
  "answer": "Answer here"
 }
]

No markdown code blocks.

STUDY NOTES:

${studyNotes}

`;

    await runAI("FLASHCARDS", prompt);

}

// ==========================================
// QUIZ GENERATOR
// ==========================================

async function generateQuiz() {

    if (!checkNotes()) return;

    const prompt = `

Create 5 multiple-choice questions
from the study notes.

Return ONLY valid JSON.

Format:

[
 {
  "question": "Question here",
  "options": [
    "Option A",
    "Option B",
    "Option C",
    "Option D"
  ],
  "answer": 0
 }
]

The answer field must be the index of the correct option.
Index starts from 0.

No markdown code blocks.

STUDY NOTES:

${studyNotes}

`;

    await runAI("QUIZ", prompt);

}

// ==========================================
// ASK YOUR NOTES
// ==========================================

function openChat() {

    if (!checkNotes()) return;

    displayResult(`

        <h2>💬 Ask Your Notes</h2>

        <p>Ask anything about your uploaded study material.</p>

        <div class="chat-box">

            <input
                type="text"
                id="chatQuestion"
                placeholder="Ask a question..."
            >

            <button onclick="askQuestion()">
                Ask
            </button>

        </div>

        <div id="chatAnswer"></div>

    `);

}

async function askQuestion() {

    const question =
        document.getElementById("chatQuestion").value.trim();

    if (!question) return;

    const answerBox =
        document.getElementById("chatAnswer");

    answerBox.innerHTML = "<p>Thinking...</p>";

    try {

        const answer = await askAI(`

Answer the student's question using
the study notes below.

If the answer is not in the notes,
say that clearly.

Use easy-to-understand language.

STUDY NOTES:

${studyNotes}

STUDENT QUESTION:

${question}

`);

        answerBox.innerHTML =
            `<div class="chat-answer">${escapeHTML(answer)
                .replace(/\n/g, "<br>")}</div>`;

    } catch (error) {

        answerBox.textContent = error.message;

    }

}

// ==========================================
// RUN AI
// ==========================================

async function runAI(type, prompt) {

    showStatus("AI is preparing your study material...");

    displayResult("<p>✨ Generating your content...</p>");

    try {

        const response = await askAI(prompt);

        currentResult = response;

        if (type === "FLASHCARDS") {

            renderFlashcards(response);

        } else if (type === "QUIZ") {

            renderQuiz(response);

        } else {

            displayResult(formatText(response));

        }

        showStatus("Your study material is ready!");

    } catch (error) {

        displayResult(
            `<p class="error">${escapeHTML(error.message)}</p>`
        );

        showStatus("Something went wrong.");

    }

}

// ==========================================
// FLASHCARD DISPLAY
// ==========================================

function renderFlashcards(response) {

    let cards;

    try {

        cards = extractJSON(response);

    } catch {

        displayResult(formatText(response));

        return;

    }

    if (!Array.isArray(cards)) {

        displayResult(formatText(response));

        return;

    }

    let html = "<h2>🗂️ Flashcards</h2>";

    cards.forEach((card, index) => {

        html += `

            <div class="flashcard">

                <h4>Card ${index + 1}</h4>

                <p><strong>Q:</strong>
                ${escapeHTML(card.question)}</p>

                <button onclick="toggleCard(${index})">
                    Show Answer
                </button>

                <div
                    class="flashcard-answer"
                    id="answer-${index}"
                >

                    <strong>Answer:</strong>
                    ${escapeHTML(card.answer)}

                </div>

            </div>

        `;

    });

    displayResult(html);

}

function toggleCard(index) {

    const answer =
        document.getElementById("answer-" + index);

    if (answer.style.display === "block") {

        answer.style.display = "none";

    } else {

        answer.style.display = "block";

    }

}

// ==========================================
// QUIZ DISPLAY
// ==========================================

function renderQuiz(response) {

    try {

        quizData = extractJSON(response);

    } catch {

        displayResult(formatText(response));

        return;

    }

    if (!Array.isArray(quizData)) {

        displayResult(formatText(response));

        return;

    }

    quizSubmitted = false;

    let html = "<h2>🎯 Practice Quiz</h2>";

    quizData.forEach((question, index) => {

        html += `

            <div class="quiz-question">

                <h4>
                    ${index + 1}. ${escapeHTML(question.question)}
                </h4>

        `;

        question.options.forEach((option, optionIndex) => {

            html += `

                <label class="quiz-option">

                    <input
                        type="radio"
                        name="question-${index}"
                        value="${optionIndex}"
                    >

                    ${escapeHTML(option)}

                </label>

            `;

        });

        html += "</div>";

    });

    html += `

        <button class="quiz-submit" onclick="submitQuiz()">
            Submit Quiz
        </button>

        <div id="quizResult" class="quiz-result"></div>

    `;

    displayResult(html);

}

function submitQuiz() {

    if (quizSubmitted) return;

    let score = 0;

    quizData.forEach((question, index) => {

        const selected = document.querySelector(
            `input[name="question-${index}"]:checked`
        );

        if (selected &&
            Number(selected.value) === Number(question.answer)) {

            score++;

        }

    });

    quizSubmitted = true;

    const result = document.getElementById("quizResult");

    result.textContent =
        `Your score: ${score} / ${quizData.length}`;

}

// ==========================================
// TEXT TO SPEECH
// ==========================================

function speakSummary() {

    if (!studyNotes) {

        showStatus("Upload notes before using voice.");

        return;

    }

    if (!window.speechSynthesis) {

        showStatus("Speech is not supported by this browser.");

        return;

    }

    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(studyNotes);

    utterance.rate = 0.95;

    utterance.pitch = 1;

    utterance.lang = "en-US";

    speechSynthesis.speak(utterance);

    showStatus("Reading your notes aloud.");

}

// ==========================================
// DOWNLOAD RESULT
// ==========================================

function downloadResult() {

    if (!currentResult) {

        showStatus("Generate content before downloading.");

        return;

    }

    const blob = new Blob(
        [currentResult],
        { type: "text/plain;charset=utf-8" }
    );

    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);

    link.download = "StudyMind-Study-Notes.txt";

    link.click();

    URL.revokeObjectURL(link.href);

}

// ==========================================
// HELPERS
// ==========================================

function checkNotes() {

    if (!studyNotes) {

        showStatus("Upload or paste your notes first.");

        return false;

    }

    return true;

}

function showStatus(message) {

    document.getElementById("status").textContent = message;

}

function displayResult(html) {

    document.getElementById("result").innerHTML = html;

}

function escapeHTML(text) {

    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}

function formatText(text) {

    return escapeHTML(text)
        .replace(/\n/g, "<br>")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

}

function extractJSON(text) {

    const cleaned = text
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

    return JSON.parse(cleaned);

}

// ==========================================
// CLOSE MODAL WHEN CLICKING OUTSIDE
// ==========================================

window.addEventListener("click", function (event) {

    const modal = document.getElementById("apiModal");

    if (event.target === modal) {

        closeApiSettings();

    }

});
