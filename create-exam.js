let questionNumber = 0;

function addQuestionEditor() {
  const list = $("#questionList");
  if (list.children.length >= 50) {
    toast("A test can contain at most 50 questions.", "warn");
    return;
  }
  const index = questionNumber++;
  const item = document.createElement("fieldset");
  item.className = "card question-editor";
  item.dataset.question = "";
  item.innerHTML = `<legend class="font-bold">Question ${list.children.length + 1}</legend>
    <label class="block text-sm font-bold mt-2" for="question-${index}">Question text</label>
    <textarea id="question-${index}" class="input mt-1" rows="2" maxlength="1000" required></textarea>
    <div class="grid sm:grid-cols-2 gap-3 mt-3">
      ${[0, 1, 2, 3].map((option) => `<div><label class="block text-sm font-bold" for="question-${index}-option-${option}">Option ${String.fromCharCode(65 + option)}</label><input id="question-${index}-option-${option}" class="input mt-1" maxlength="300" required></div>`).join("")}
    </div>
    <div class="flex flex-wrap justify-between items-end gap-3 mt-3">
      <div><label class="block text-sm font-bold" for="question-${index}-answer">Correct option</label>
        <select id="question-${index}-answer" class="input mt-1" required>
          <option value="0">A</option><option value="1">B</option><option value="2">C</option><option value="3">D</option>
        </select>
      </div>
      <button class="btn" type="button" data-remove-question>Remove question</button>
    </div>`;
  list.append(item);
  [...list.children].forEach((question, number) => {
    question.querySelector("legend").textContent = `Question ${number + 1}`;
  });
}

$("#sideBtn").onclick = () => {
  $("#side").classList.toggle(innerWidth < 768 ? "open" : "expanded");
};
addQuestionEditor();
$("#addQuestion").addEventListener("click", addQuestionEditor);
$("#questionList").addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove-question]");
  if (!removeButton) return;
  removeButton.closest("[data-question]").remove();
  [...$("#questionList").children].forEach((question, number) => {
    question.querySelector("legend").textContent = `Question ${number + 1}`;
  });
});
$("#createTestForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = $("#testName").value.trim(),
    minutes = Number($("#testDuration").value),
    message = $("#createdTest"),
    questionEditors = [...$("#questionList").querySelectorAll("[data-question]")],
    questions = questionEditors.map((item) => ({
      q: item.querySelector("textarea").value.trim(),
      o: [...item.querySelectorAll('input[id*="-option-"]')].map((option) =>
        option.value.trim(),
      ),
      answer: Number(item.querySelector("select").value),
    })),
    candidateNames = $("#assignedStudents").value
      .split(/\r?\n/)
      .map((candidate) => candidate.trim())
      .filter(Boolean);
  if (
    !name ||
    !Number.isInteger(minutes) ||
    minutes < 1 ||
    minutes > 240 ||
    !questions.length ||
    questions.some(
      (question) =>
        !question.q ||
        question.o.some((option) => !option) ||
        question.answer < 0 ||
        question.answer >= question.o.length,
    ) ||
    !candidateNames.length ||
    candidateNames.some((candidate) => candidate.length > 100) ||
    new Set(candidateNames.map((candidate) => candidate.toLocaleLowerCase()))
      .size !== candidateNames.length
  ) {
    message.textContent =
      "Check the test name, duration, completed questions, and unique student names.";
    message.className = "err mt-3";
    return;
  }
  let test;
  try {
    test = await examCatalog.create(name, minutes, questions, candidateNames);
  } catch (error) {
    message.textContent =
      `The test could not be saved: ${error.message}`;
    message.className = "err mt-3";
    return;
  }
  message.innerHTML = `<p>Created <strong>${escapeHTML(test.name)}</strong> · ${minutes} minutes · ${questions.length} question(s).</p>
    <p class="mt-1">Test ID: <code>${escapeHTML(test.id)}</code></p>
    <p class="font-bold mt-3">Individual invitations</p>
    <ul class="mt-1">${test.assignments
      .map(
        (assignment) =>
          `<li>${escapeHTML(assignment.name)} — access code: <code>${escapeHTML(assignment.accessCode)}</code></li>`,
      )
      .join("")}</ul>`;
  message.className = "mut text-sm mt-3";
  $("#testName").value = "";
  $("#testDuration").value = "30";
  $("#assignedStudents").value = "";
  $("#questionList").replaceChildren();
  questionNumber = 0;
  addQuestionEditor();
});
