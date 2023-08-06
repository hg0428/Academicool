const learnBtns = document.getElementsByClassName("learn-btn");
const conceptsBtns = document.getElementsByClassName("concepts-btn");
const problemsBtns = document.getElementsByClassName("problems-btn");
const bottombarLearnBtn = document.querySelector("#bottombar .learn-btn");
const bottombarConceptsBtn = document.querySelector("#bottombar .concepts-btn");
const bottombarProblemsBtn = document.querySelector("#bottombar .problems-btn");
const learnSect = document.getElementById("learn-section");
const conceptsSect = document.getElementById("concepts-section");
const problemsSect = document.getElementById("problems-section");
const classOverlay = document.getElementById("class-overlay");
const classOverlayContent = document.getElementById("class-overlay-content");
const sectionSelectorDropdownTrigger = document.getElementById("section-selector-dropdown-trigger");
const classContinue = document.getElementById("class-overlay-continue-btn");
const progressDotsDiv = document.getElementById("progress-dots");
const average = array => array.reduce((a, b) => a + b) / array.length;

// Helper function for deep object comparison
function deepEqual(x, y) {
  const ok = Object.keys,
    tx = typeof x,
    ty = typeof y;
  return x && y && tx === 'object' && tx === ty ? ok(x).length === ok(y).length && ok(x).every(key => deepEqual(x[key], y[key])) : x === y;
}

// Helper function to set query parameters in the URL
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
function setQueryParam(key, value) {
  let params = new URLSearchParams(window.location.search);
  params.set(key, value);
  let newUrl = window.location.origin + window.location.pathname + "?" + params.toString();
  if (history.pushState) {
    window.history.pushState({
      path: newUrl
    }, "", newUrl);
  }
  window.location.href = newUrl;
}

// Save user data to the server
function saveUserData() {
  if (!user) return;
  let xhr = new XMLHttpRequest();
  let url = "/api/update-user-courses";
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && xhr.status === 200) {
      let data = JSON.parse(xhr.responseText);
      if (!data.error) {
        user['courses'] = data.data;
        window.localStorage.setItem("courses", JSON.stringify(data.data));
      }
    }
  };
  xhr.send(JSON.stringify(user['courses']));
}

// Load data for the current course
function loadData() {
  if (user['courses'][course.id]['completed-lessons'] === 0) return;
  conceptsSect.innerHTML = '';
  problemsSect.innerHTML = '';
  let progress = window.localStorage.getItem('courses');
  if (user) progress = user['courses'];
  let id = 0;
  if (!Object.keys(progress).includes(course.id)) return;
  for (let lesson in progress[course.id]['completed-lessons']) {
    if (!Object.keys(course.data).includes(lesson)) continue;
    conceptsSect.innerHTML += `<h2>${lesson}</h2>`;
    let ul = document.createElement('ul');
    conceptsSect.appendChild(ul);
    for (let concept of course.concepts) {
      if (Array.isArray(concept)) concept = {
        text: concept[0] || '',
        background: concept[1] || '',
        audio: concept[2] || '',
        display: concept[3] || true
      };
      ul.innerHTML += `<li>${markdown.toHTML(concept.text)}</li>`;
    }
    if (course.data[lesson].length > 0) {
      problemsSect.innerHTML += `<h2>${lesson.replaceAll('>', '&gt;').replaceAll('<', '&lt;')}</h2><button id="problems-only-${id}" class="shadow-press">Run problems only.</button>`;
      document.getElementById(`problems-only-${id}`).addEventListener('click', e => runLesson(lesson, false, true));
    }
    id++;
  }
}

// Check if user is logged in and load data for the current course
if (user) loadData();

// Set local storage for courses
if (course) window.localStorage.setItem("last-course", course.id);
if (window.localStorage.getItem("courses") === null) {
  if (user) window.localStorage.setItem("courses", JSON.stringify(user.courses));else if (course) {
    window.localStorage.setItem("courses", JSON.stringify([course.id = {
      "completed-lessons": {},
      "course-title": course.titles.course
    }]));
  } else window.localStorage.setItem("courses", JSON.stringify([]));
}

// Set course ID in query parameters if not present
if (!course && window.localStorage.getItem("last-course") !== null) {
  setQueryParam("course_id", window.localStorage.getItem("last-course"));
} else if (!course && window.localStorage.getItem("courses") !== null && JSON.parse(window.localStorage.getItem("courses")).length > 0) {
  setQueryParam("course_id", Object.keys(JSON.parse(window.localStorage.getItem("courses")))[0]);
} else if (!course) {
  window.location.href = "/course/new?new";
}

// Update data if course and user are present
if (course && user) {
  let data = JSON.parse(window.localStorage.getItem("courses"));
  for (let id in data) {
    if (user.courses[id] && Object.keys(user.courses[id]['completed-lessons']).length <= Object.keys(data[id]['completed-lessons']).length) saveUserData();
  }
}

// Set section button onclicks.
for (let learnBtn of learnBtns) {
  learnBtn.onclick = function () {
    learnSect.style["z-index"] = 1;
    conceptsSect.style["z-index"] = -1;
    problemsSect.style["z-index"] = -1;
    sectionSelectorDropdownTrigger.innerHTML = `<img src="/static/img/arrow.svg"/>${course["titles"]["learn"]}`;
    bottombarConceptsBtn.classList.remove("current");
    bottombarProblemsBtn.classList.remove("current");
    bottombarLearnBtn.classList.add("current");
  };
}
for (let conceptsBtn of conceptsBtns) {
  conceptsBtn.onclick = function () {
    learnSect.style["z-index"] = -1;
    conceptsSect.style["z-index"] = 1;
    problemsSect.style["z-index"] = -1;
    sectionSelectorDropdownTrigger.innerHTML = `<img src="/static/img/arrow.svg"/>${course.titles.concepts}`;
    bottombarConceptsBtn.classList.add("current");
    bottombarProblemsBtn.classList.remove("current");
    bottombarLearnBtn.classList.remove("current");
  };
}
for (let problemsBtn of problemsBtns) {
  problemsBtn.onclick = function () {
    learnSect.style["z-index"] = -1;
    conceptsSect.style["z-index"] = -1;
    problemsSect.style["z-index"] = 1;
    sectionSelectorDropdownTrigger.innerHTML = `<img src="/static/img/arrow.svg"/>${course.titles.problems}`;
    bottombarConceptsBtn.classList.remove("current");
    bottombarProblemsBtn.classList.add("current");
    bottombarLearnBtn.classList.remove("current");
  };
}

// Helper function to check answers for problems
function checkProblem(problem, answers) {
  if (answers === false) return 0;
  if (!problem["case-sensitive"]) {
    problem.answers = problem.answers.map(ans => ans.toLowerCase());
    answers = answers.map(ans => ans.toLowerCase());
  }
  const intersection = problem.answers.filter(value => answers.includes(value));
  if (problem.type === "checkbox") return 100 * intersection.length / problem.answers.length;else return +(intersection.length > 0) * 100;
}

// Helper function to run a lesson
function runLesson(lesson, concepts = true, all = false) {
  let problems;
  if (!all) problems = course.data[lesson].filter(pr => pr.scope === 'required');else problems = course.data[lesson];
  if (concepts) runClass(lesson, course["concepts"], problems);else runClass(lesson, [], problems, false);
}

// Helper function to run personalized practice
function runPersonalized(length = 10) {
  let failed_concepts = {};
  //calculate concept averages
  let progress = JSON.parse(window.localStorage.getItem('courses'))[course.id];
  if (user) progress = user['courses'][course.id];
  for (let lesson in course.data) {
    if (!Object.keys(progress['completed-lessons']).includes(lesson)) continue;
    let lesson_scores = progress['completed-lessons'][lesson].scores;
    failed_concepts[lesson] = {};
    for (let problem_in in course.data[lesson]) {
      let problem = course.data[lesson][problem_in];
      if (Object.keys(lesson_scores).includes(problem_in)) {
        for (let con of problem['required-concepts']) {
          if (!failed_concepts[lesson][con]) failed_concepts[lesson][con] = [0, 0];
          failed_concepts[lesson][con][0]++;
          failed_concepts[lesson][con][1] += lesson_scores[problem_in];
        }
      } else {
        for (let con of problem['required-concepts']) {
          if (!failed_concepts[lesson][con]) failed_concepts[lesson][con] = [0, 0];
          failed_concepts[lesson][con][0]++;
        }
      }
    }
  }
  for (let lesson in failed_concepts) {
    for (let concept in failed_concepts[lesson]) {
      failed_concepts[lesson][concept] = failed_concepts[lesson][concept][1] / failed_concepts[lesson][concept][0];
    }
  }
  //Build lesson
  for (let lesson in course.data) {
    for (let problem of course.data[lesson]) {
      problem.lesson = lesson;
    }
  }
  let problems = [];
  for (let lesson in failed_concepts) {
    for (let concept in failed_concepts[lesson]) {
      //Find all problems using concept
      if (failed_concepts[lesson][concept] < 100) for (let problem of course.data[lesson].filter(pr => pr['required-concepts'].includes(concept))) {
        let exists = false;
        for (let added of problems) {
          if (deepEqual(added, problem)) {
            exists = true;
            break;
          }
        }
        if (!exists) problems.push(problem);
      }
    }
  }
  if (problems.length === 0) return alert('Nothing to practice, you seem to be doing great so far.');
  //Sort and apply length limit
  problems.sort((a, b) => {
    let areq = new Set(a["required-concepts"]);
    let breq = new Set(b["required-concepts"]);
    let a_score = 0;
    let b_score = 0;
    for (let c_id of areq) a_score += 50 - failed_concepts[a.lesson][c_id];
    for (let c_id of breq) b_score += 50 - failed_concepts[b.lesson][c_id];
    return b - a;
  });
  let idToOriginal = {};
  problems = problems.slice(0, length)
  let i = 0;
  for (let p of problems) {
    idToOriginal[i] = [p.lesson, p.id];
    p.id = p.order = i;
    i++;
  }
  runClass(null, course.concepts, problems.slice(0, length), true, scores => {
    let courses = JSON.parse(window.localStorage.getItem("courses"));
    //Record the most recent scores if they have a higher average than the user's record.
    if (user) courses = user.courses;
    if (!courses[course.id]) window.localStorage.setItem('courses', JSON.stringify({
      'completed-lessons': {},
      'course-title': course.titles.course
    }));
    for (let id in scores) {
      let original = idToOriginal[id];
      let original_problem = course.data[original[0]].filter(p => p.id === original[1])[0];
      if (!courses[course.id]["completed-lessons"][original_problem.lesson]) courses[course.id]["completed-lessons"][original_problem.lesson] = {};
      if (scores[id] >= (courses[course.id]["completed-lessons"][original_problem.lesson][original[0]] || 0)) courses[course.id]["completed-lessons"][original_problem.lesson][original[0]] = scores[id];
    }
    user['courses'] = courses;
    save();
    window.localStorage.setItem('courses', JSON.stringify(courses));
  });
}

// Helper function to run class (lesson or concept)
function runClass(lesson, concepts, problems, requiredEnabled = true, onEnd = null) {
  console.log('Running class', concepts);
  classContinue.innerText = "Continue";
  classOverlay.classList.add("active");
  if (concepts.length === 0 && problems.length === 0) {
    classContinue.innerText = "Finish";
    classContinue.onclick = endLesson;
    classOverlayContent.innerHTML = '<h2>This lesson has no content.</h2>';
    return;
  }
  problems.sort((a, b) => (a.order || a.id) - (b.order || b.id));
  progressDotsDiv.innerHTML = "";
  let totalitems = 0;
  let seen_concepts = [];
  for (let x = 0; x < problems.length; x++) {
    let dot = document.createElement("div");
    dot.classList.add("dot");
    progressDotsDiv.appendChild(dot);
    totalitems++;
    for (let i = 0; i < problems[x]['required-concepts'].length; i++) {
      let c_id = problems[x]['required-concepts'][i];
      if (!course.concepts[c_id].display || seen_concepts.includes(c_id)) continue;
      let dot = document.createElement("div");
      dot.classList.add("dot");
      progressDotsDiv.appendChild(dot);
      console.log(course.concepts[c_id]);
      totalitems++;
      seen_concepts.push(c_id);
    }
  }
  console.log(seen_concepts, totalitems, problems.length, concepts.length);
  let given_concepts = [];
  let problemIndex = 0;
  let completed = 0;
  let scores = {};
  function endLesson() {
    document.getElementById("class-overlay").classList.remove("active");
    if (onEnd) onEnd(scores);
    if (!lesson) return;
    courses = JSON.parse(window.localStorage.getItem("courses"));
    //Record the most recent scores if they have a higher average than the user's record.
    if (user) courses = user.courses;
    if (!courses[course.id]) window.localStorage.setItem('courses', JSON.stringify({
      'completed-lessons': {},
      'course-title': course.titles.course
    }));
    if (!courses[course.id]["completed-lessons"][lesson]) courses[course.id]["completed-lessons"][lesson] = {
      scores: scores
    };else if (average(Object.values(scores)) >= average(Object.values(courses[course.id]["completed-lessons"][lesson].scores))) courses[course.id]["completed-lessons"][lesson].scores = Object.assign(courses[course.id]["completed-lessons"][lesson].scores, scores);
    user['courses'] = courses;
    save();
    window.localStorage.setItem('courses', JSON.stringify(courses));
    let lesson_id = Object.keys(course.data).indexOf(lesson);
    document.getElementById(`lesson-title-${lesson_id}`).innerText = `${lesson} ✅`;
  }
  function displayConcept(c_id) {
    if (Array.isArray(concepts[c_id])) concepts[c_id] = {
      text: concepts[c_id][0] || '',
      background: concepts[c_id][1] || '',
      audio: concepts[c_id][2] || '',
      display: concepts[c_id][3] || true
    };
    let audio;
    classOverlayContent.innerHTML = '';
    if (concepts[c_id].text) classOverlayContent.innerHTML = `<div style="font-size:1.5rem;">${markdown.toHTML(concepts[c_id].text)}</div>`;
    if (concepts[c_id].background) {
      if (concepts[c_id].background.trim().startsWith('url')) classOverlayContent.style['background-image'] = concepts[c_id].background;else classOverlayContent.style['background'] = concepts[c_id].background;
    }
    if (concepts[c_id].audio) {
      audio = document.createElement('audio');
      audio.controls = true;
      audio.autoplay = true;
      audio.innerHTML = `<source src="${concepts[c_id].audio.replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "'")}">Audio not availiable`;
      classOverlayContent.appendChild(audio);
    }
    given_concepts.push(c_id);
    if (completed >= totalitems) classContinue.innerText = "Finish";
    classContinue.onclick = function () {
      progressDotsDiv.children[completed - 1].classList.add("completed");
      if (completed < totalitems) nextItem();else endLesson();
    };
  }
  function nextItem() {
    completed++;
    //Only do ones with scope of required. 
    //If they get a problem wrong, look at its required concepts, and give them other problems that use those concepts in personalized practise.
    //Maybe give extra if they get problems with that concept wrong.
    let problem = problems[problemIndex];
    for (let c_id of problem["required-concepts"]) {
      if (!given_concepts.includes(c_id) && requiredEnabled && concepts[c_id].display !== false) return displayConcept(c_id);
    }
    problemIndex++;
    if (problem.type === 'collection') {
      //TODO: Handle collection
      if (completed < totalitems) nextItem();else endLesson();
    }
    let getanswer, applycorrect;
    let audio;
    classOverlayContent.innerHTML = '';
    if (problem.data[0]) classOverlayContent.innerHTML = `<div style="font-size:1.5rem;">${markdown.toHTML(problem.data[0])}</div>`;
    if (problem.data[1]) {
      if (problem.data[1].trim().startsWith('url')) classOverlayContent.style['background-image'] = problem.data[1];else classOverlayContent.style['background'] = problem.data[1];
    }
    if (problem.data[2]) {
      audio = document.createElement('audio');
      audio.controls = true;
      audio.autoplay = true;
      audio.innerHTML = `<source src="${problem.data[2].replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "'")}">Audio not availiable`;
      classOverlayContent.appendChild(audio);
    }
    classOverlayContent.innerHTML += `<form id="lesson-form" action="" onsubmit="return false;"><fieldset id="form-fieldset"></fieldset></form>`;
    let fieldset = document.getElementById("form-fieldset");
    if (problem.type === "text" || problem.type === "number") {
      fieldset.innerHTML += `<input id="answer" type="text" placeholder="Type Here"/>`;
      getanswer = () => {
        let value = document.getElementById("answer").value;
        if (problem.type === "number" && isNaN(value)) {
          document.getElementById("lesson-form").submit();
          return null;
        }
        return [value];
      };
      applycorrect = () => {
        let answer = document.getElementById("answer");
        answer.value = problem.answers[0];
      };
    } else if (problem.type === "multiple-choice") {
      for (let option_in in problem.options) fieldset.innerHTML += `<div class="labelset"><label for="answer-${option_in.replaceAll("<", "&lt;").replaceAll(">", "&gt;")}">${problem.options[option_in].replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</label><input type="radio" name="answer" id="answer-${option_in.replaceAll("<", "&lt;").replaceAll(">", "&gt;")}" value="${problem.options[option_in].replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "'")}"/></div>`;
      getanswer = () => {
        let el = document.querySelector('input[name="answer"]:checked');
        if (!el) return false;
        return [el.value];
      };
      applycorrect = () => {
        let els = document.querySelectorAll('input[name="answer"]');
        let break_loop = false;
        for (let el of els) {
          for (let ans of problem.answers) {
            if (ans == el.value) {
              el.checked = true;
              break_loop = true;
              break;
            } else el.checked = false;
          }
          if (break_loop) break;
        }
      };
    } else if (problem.type === "checkbox") {
      for (let option_in in problem.options) fieldset.innerHTML += `<div class="labelset"><label for="answer-${option_in.replaceAll("<", "&lt;").replaceAll(">", "&gt;")}">${problem.options[option_in].replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</label><input type="checkbox" id"answer-${option_in.replaceAll("<", "&lt;").replaceAll(">", "&gt;")}" name="answer" value="${problem.options[option_in].replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "'")}"/></div>`;
      getanswer = () => {
        let answers = [];
        let raw_answers = document.querySelectorAll('input[name=answer]:checked');
        for (let i of raw_answers) answers.push(i.value);
        return answers;
      };
      applycorrect = () => {
        let els = document.querySelectorAll('input[name="answer"]');
        for (let el of els) for (let ans of problem.answers) {
          if (ans == el.value) el.checked = true;else el.checked = true;
        }
      };
    }
    let form = document.getElementById("lesson-form");
    if (['data'].includes(problem.type)) {
      if (completed < totalitems) classContinue.innerText = "Continue";else classContinue.innerText = "Finish";
    } else classContinue.innerText = "Check";
    let score;
    classContinue.onclick = function (e) {
      if (!['data'].includes(problem.type)) {
        let answer = getanswer();
        applycorrect();
        if (answer === null) return;
        score = checkProblem(problem, answer);
        scores[problem.id] = score;
      } else score = 100;
      if (score > 50) progressDotsDiv.children[completed - 1].classList.add("completed");else progressDotsDiv.children[completed - 1].classList.add("failed");
      document.getElementById("form-fieldset").disabled = true;
      if (completed < totalitems) {
        if (['data'].includes(problem.type)) return nextItem();
        classContinue.innerText = "Continue";
        classContinue.onclick = nextItem;
      } else {
        if (['data'].includes(problem.type)) return endLesson();
        classContinue.innerText = "Finish";
        classContinue.onclick = endLesson;
      }
    };
    form.addEventListener("keydown", evt => {
      //if (evt.keyCode === 13 && !evt.shiftKey) classContinue.click();
      if (problem.type === "number" && (evt.which < 48 || evt.which > 57) && ![8, 37, 39, 190].includes(evt.which) & !evt.ctrlKey & !evt.metaKey) evt.preventDefault();
    });
    form.addEventListener("keyup", evt => {
      if (problem.type === "number") {
        let value = document.getElementById("answer").value;
        if (isNaN(value)) {
          document.getElementById("answer").value = value.replace(/\D/g, "");
        }
      }
    });
    if (audio) audio.play();
  }
  // Present the first problem/concept
  nextItem();
}