let learn_btns = document.getElementsByClassName("learn-btn");
let concepts_btns = document.getElementsByClassName("concepts-btn");
let problems_btns = document.getElementsByClassName("problems-btn");

let bottombar_learn_btn = document.querySelector("#bottombar .learn-btn");
let bottombar_concepts_btn = document.querySelector("#bottombar .concepts-btn");
let bottombar_problems_btn = document.querySelector("#bottombar .problems-btn");

let learn_sect = document.getElementById("learn-section");
let concepts_sect = document.getElementById("concepts-section");
let problems_sect = document.getElementById("problems-section");
let class_overlay = document.getElementById("class-overlay");
let class_overlay_content = document.getElementById("class-overlay-content");
let section_selector_dropdown_trigger = document.getElementById(
  "section-selector-dropdown-trigger",
);
let class_continue = document.getElementById("class-overlay-continue-btn");
let progress_dots_div = document.getElementById("progress-dots");
const average = array => array.reduce((a, b) => a + b) / array.length;

function deepEqual(x, y) {
  const ok = Object.keys, tx = typeof x, ty = typeof y;
  return x && y && tx === 'object' && tx === ty ? (
    ok(x).length === ok(y).length &&
      ok(x).every(key => deepEqual(x[key], y[key]))
  ) : (x === y);
}

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
function setQParam(key, value) {
  let params = new URLSearchParams(window.location.search);
  params.set(key, value);
  let newUrl =
    window.location.origin +
    window.location.pathname +
    "?" +
    params.toString();
  if (history.pushState) {
    window.history.pushState({ path: newUrl }, "", newUrl);

  }
  window.location.href = newUrl;

}

function save() {
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
function loadData() {
  if (user['courses'][course.id]['completed-lessons'] === 0) return;
  concepts_sect.innerHTML = '';
  problems_sect.innerHTML = '';
  let progress = window.localStorage.getItem('courses');
  if (user) progress = user['courses'];
  let id=0;
  if (!Object.keys(progress).includes(course.id)) return;
  for (let lesson in progress[course.id]['completed-lessons']) {
    concepts_sect.innerHTML += `<h2>${lesson}</h2>`;
    let ul = document.createElement('ul');
    concepts_sect.appendChild(ul);
    for (let concept of course.concepts) {
      if (Array.isArray(concept))
        concept = {text: concept[0] || '', background: concept[1] || '', audio: concept[2] || '', display: concept[3] || true};
      ul.innerHTML += `<li>${markdown.toHTML(concept.text)}</li>`;
    }
    if (course.problems[lesson].length > 0) {
      problems_sect.innerHTML += `<h2>${lesson.replaceAll('>', '&gt;').replaceAll('<', '&lt;')}</h2><button id="problems-only-${id}" class="shadow-press">Run problems only.</button>`;
      document.getElementById(`problems-only-${id}`).addEventListener('click', e => runLesson(lesson, false, true));
    }
    id++;
  }
}
if (user)
  loadData();
// Set localstorage
if (course) window.localStorage.setItem("last-course", course.id);
if (window.localStorage.getItem("courses") === null) {
  if (user) 
    window.localStorage.setItem("courses", JSON.stringify(user.courses));
  else if (course) {
    window.localStorage.setItem(
      "courses",
      JSON.stringify([
        (course.id = {
          "completed-lessons": {},
          "course-title": course.titles.course,
        }),
      ]),
    );
  } else window.localStorage.setItem("courses", JSON.stringify([]));
}

if (!course && window.localStorage.getItem("last-course") !== null) {

  setQParam("course_id", window.localStorage.getItem("last-course"));
} else if (
  !course &&
  window.localStorage.getItem("courses") !== null &&
  JSON.parse(window.localStorage.getItem("courses")).length > 0
) {

  setQParam(
    "course_id",
    Object.keys(JSON.parse(window.localStorage.getItem("courses")))[0],
  );
} else if (!course) {

  window.location.href = "/course/new?new";
}
if (course && user) {
  //Update data
  let data = JSON.parse(window.localStorage.getItem("courses"));
  for (let id in data) {
    if (user.courses[id] && Object.keys(user.courses[id]['completed-lessons']).length <= Object.keys(data[id]['completed-lessons']).length)
      save();
  }
}


// Set section button onclicks.
for (let learn_btn of learn_btns) {
  learn_btn.onclick = function () {
    learn_sect.style["z-index"] = 1;
    concepts_sect.style["z-index"] = -1;
    problems_sect.style["z-index"] = -1;
    section_selector_dropdown_trigger.innerHTML = `<img src="/static/img/arrow.svg"/>${course["titles"]["learn"]}`;
    bottombar_concepts_btn.classList.remove("current");
    bottombar_problems_btn.classList.remove("current");
    bottombar_learn_btn.classList.add("current");
  };
}
for (let concepts_btn of concepts_btns) {
  concepts_btn.onclick = function () {
    learn_sect.style["z-index"] = -1;
    concepts_sect.style["z-index"] = 1;
    problems_sect.style["z-index"] = -1;
    section_selector_dropdown_trigger.innerHTML = `<img src="/static/img/arrow.svg"/>${course["titles"]["concepts"]}`;
    bottombar_concepts_btn.classList.add("current");
    bottombar_problems_btn.classList.remove("current");
    bottombar_learn_btn.classList.remove("current");
  };
}
for (let problems_btn of problems_btns) {
  problems_btn.onclick = function () {
    learn_sect.style["z-index"] = -1;
    concepts_sect.style["z-index"] = -1;
    problems_sect.style["z-index"] = 1;
    section_selector_dropdown_trigger.innerHTML = `<img src="/static/img/arrow.svg"/>${course["titles"]["problems"]}`;
    bottombar_concepts_btn.classList.remove("current");
    bottombar_problems_btn.classList.add("current");
    bottombar_learn_btn.classList.remove("current");
  };
}



function checkProblem(problem, answers) {
  if (answers === false) return 0;
  if (!problem["case-sensitive"]) {
    problem.answers = problem.answers.map((ans) => ans.toLowerCase());
    answers = answers.map((ans) => ans.toLowerCase());
  }
  const intersection = problem.answers.filter(value =>
    answers.includes(value)
  );

  if (problem.type === "checkbox") return 100 * intersection.length / problem.answers.length;
  else return +(intersection.length > 0) * 100;
}

function runLesson(lesson, concepts = true, all=false) {
  let problems;
  if (!all)
    problems = course["problems"][lesson].filter(pr => pr.scope === 'required');
  else 
    problems = course["problems"][lesson];
  
  if (concepts)
    runClass(lesson, course["concepts"], problems);
  else runClass(lesson, [], problems, false);
}
function runPersonalized(length=10) {
  let failed_concepts = {};
  //calculate concept averages
  let progress = JSON.parse(window.localStorage.getItem('courses'))[course.id];
  if (user) progress = user['courses'][course.id];
  for (let lesson in course.problems) {
    if (!Object.keys(progress['completed-lessons']).includes(lesson))
      continue;
    let lesson_scores = progress['completed-lessons'][lesson].scores;
    failed_concepts[lesson] = {};
    for (let problem_in in course.problems[lesson]) {
      let problem = course.problems[lesson][problem_in];
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
      failed_concepts[lesson][concept] = failed_concepts[lesson][concept][1]/failed_concepts[lesson][concept][0];
    }
  }
  //Build lesson
  for (let lesson in course.problems) {
    for (let problem of course.problems[lesson]) {
      problem.lesson = lesson;
    }
  }
  let problems = [];
  for (let lesson in failed_concepts) {
    for (let concept in failed_concepts[lesson]) {
      //Find all problems using concept
      if (failed_concepts[lesson][concept] < 100)
        for (let problem of course['problems'][lesson].filter(pr => pr['required-concepts'].includes(concept))) {
          let exists = false;
          for (let added of problems) {
            if (deepEqual(added, problem)) {
              exists = true;
              break;
            }
          }
          if (!exists)
            problems.push(problem);
        }
        
    }
  }
  if (problems.length === 0)
    return alert('Nothing to practice, you seem to be doing great so far.');
  //Sort and apply length limit
  problems.sort((a, b) => {
    let areq = new Set(a["required-concepts"]);
    let breq = new Set(b["required-concepts"]);
    let a_score = 0;
    let b_score = 0;
    for (let c_id of areq) 
      a_score += 50 - failed_concepts[a.lesson][c_id];
    for (let c_id of breq)
      b_score += 50 - failed_concepts[b.lesson][c_id];
    return b-a;
  });
  let idToOriginal = {};
  let new_problems = [];
  let new_concepts = [];
  for (let p of problems.slice(0, length)) {
    let problem = {...p}
    problem['required-concepts'] = [];
    for (let c_id of p['required-concepts']) {
      let exists = false;
      for (let c_id_1 in new_concepts) {
        if (deepEqual(new_concepts[c_id_1], course.concepts[c_id])) {
          exists = c_id_1;
          break;
        }
      }
      if (exists === false) {
        new_concepts.push(course.concepts[c_id]);
        problem['required-concepts'].push(new_concepts.length-1);
      } else 
        problem['required-concepts'].push(exists);
    }
    idToOriginal[new_problems.length] = [problem.lesson, problem.id];
    problem.id = new_problems.length;
    new_problems.push(problem);
  }
  runClass(null, new_concepts, new_problems, true, scores => {
    let courses = JSON.parse(window.localStorage.getItem("courses"));
    //Record the most recent scores if they have a higher average than the user's record.
    if (user)
      courses = user.courses;
    if (!courses[course.id])
      window.localStorage.setItem('courses', JSON.stringify({
        'completed-lessons': {},
        'course-title': course.titles.course
      }));
    for (let id in scores) {
      let original = idToOriginal[id];
      let original_problem = course.problems[original[0]].filter(p => p.id === original[1])[0];
      
      if (!courses[course.id]["completed-lessons"][original_problem.lesson])
        courses[course.id]["completed-lessons"][original_problem.lesson] = {};
      if (scores[id] >= (courses[course.id]["completed-lessons"][original_problem.lesson][original[0]] || 0))
        courses[course.id]["completed-lessons"][original_problem.lesson][original[0]] = scores[id]
    }
    user['courses'] = courses;
    save();
    window.localStorage.setItem('courses', JSON.stringify(courses));
  });
}
function runClass(lesson, concepts, problems, required_enabled = true, onEnd=null) {
  console.log('Running class', concepts);
  class_continue.innerText = "Continue";
  class_overlay.classList.add("active");
  if (concepts.length === 0 && problems.length === 0) {
    class_continue.innerText = "Finish";
    class_continue.onclick = endLesson;
    class_overlay_content.innerHTML = '<h2>This lesson has no content.</h2>'
    return;
  }
  //console.log(problems);
  problems.sort((a, b) => {
    //console.log('sorting')
    let delindex = 0;
    let areq = new Set(a["required-concepts"]);
    let breq = new Set(b["required-concepts"]);
    for (
      let x = 0;
      x <=
      Math.max(
        Math.max(a["required-concepts"]),
        Math.max(b["required-concepts"]),
      );
      x++
    ) {
      if (areq.legnth === 0 && breq.legnth > 0) return -1;
      if (breq.legnth === 0 && areq.length > 0) return 1;
      if (areq.legnth === 0 && breq.legnth === 0) return 0;
      areq.delete(x);
      breq.delete(x);
    }
  }); //SORT NOT WORKING!!
  //console.log(problems);
  progress_dots_div.innerHTML = "";
  let totalitems = 0;
  for (let x = 0; x < problems.length; x++) {
    let dot = document.createElement("div");
    dot.classList.add("dot");
    progress_dots_div.appendChild(dot);
    totalitems++;
    for (let i = 0; i < problems[x]['required-concepts'].length; i++) {
      let dot = document.createElement("div");
      dot.classList.add("dot");
      progress_dots_div.appendChild(dot);
      totalitems++;
    }
  }
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
    if (user)
      courses = user.courses;
    if (!courses[course.id])
      window.localStorage.setItem('courses', JSON.stringify({
        'completed-lessons': {},
        'course-title': course.titles.course
      }))

    if (!courses[course.id]["completed-lessons"][lesson])
      courses[course.id]["completed-lessons"][lesson] = {scores: scores};
    else if (average(Object.values(scores)) >= average(Object.values(courses[course.id]["completed-lessons"][lesson].scores)))
      courses[course.id]["completed-lessons"][lesson].scores = Object.assign(courses[course.id]["completed-lessons"][lesson].scores, scores);

    user['courses'] = courses;

    save();
    window.localStorage.setItem('courses', JSON.stringify(courses));
    let lesson_id = Object.keys(course.problems).indexOf(lesson);
    document.getElementById(`lesson-title-${lesson_id}`).innerText = `${lesson} ✅`;
  }
  function displayConcept(c_id) {
    if (Array.isArray(concepts[c_id]))
      concepts[c_id] = {text: concepts[c_id][0] || '', background: concepts[c_id][1] || '', audio:concepts[c_id][2] || '', display:concepts[c_id][3] || true};
    let audio;
    class_overlay_content.innerHTML = '';
    if (concepts[c_id].text)
      class_overlay_content.innerHTML = `<div style="font-size:1.5rem;">${markdown.toHTML(concepts[c_id].text)}</div>`;
    if (concepts[c_id].background) {
      if (concepts[c_id].background.trim().startsWith('url'))
        class_overlay_content.style['background-image'] = concepts[c_id].background;
      else
        class_overlay_content.style['background'] = concepts[c_id].background;
    }
    if (concepts[c_id].audio) {
      audio = document.createElement('audio');
      audio.controls = true;
      audio.autoplay = true;
      audio.innerHTML = `<source src="${concepts[c_id].audio.replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "'")}">Audio not availiable`;
      class_overlay_content.appendChild(audio);
    }
    given_concepts.push(c_id);
    if (completed < totalitems) {
      class_continue.onclick = function () {
        progress_dots_div.children[completed - 1].classList.add(
          "completed",
        );
        nextItem();
      };
    } else {
      class_continue.innerText = "Finish";
      class_continue.onclick = function () {
        progress_dots_div.children[completed - 1].classList.add(
          "completed",
        );
        endLesson();
      };
    }
  }
  function nextItem() {
    completed++;
    //Only do ones with scope of required. 
    //If they get a problem wrong, look at its required concepts, and give them other problems that use those concepts in personalized practise.
    let problem = problems[problemIndex];
    for (let c_id of problem["required-concepts"]) {
      if (!given_concepts.includes(c_id) && required_enabled && concepts[c_id].display !== false)
        return displayConcept(c_id);
    }
    problemIndex++;
    let getanswer, applycorrect;
    let audio;
    class_overlay_content.innerHTML = '';
    if (problem.data[0])
      class_overlay_content.innerHTML = `<div style="font-size:1.5rem;">${markdown.toHTML(problem.data[0])}</div>`;
    if (problem.data[1]) {
      if (problem.data[1].trim().startsWith('url'))
        class_overlay_content.style['background-image'] = problem.data[1];
      else
        class_overlay_content.style['background'] = problem.data[1];
    }
    if (problem.data[2]) {
      audio = document.createElement('audio');
      audio.controls = true;
      audio.autoplay = true;
      audio.innerHTML = `<source src="${problem.data[2].replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "'")}">Audio not availiable`;
      class_overlay_content.appendChild(audio);
    }

    
    if (problem.type === "text" || problem.type === "number") {
      class_overlay_content.innerHTML += `
      <form id="lesson-form" action="">
        <fieldset id="form-fieldset">
          <input id="answer" type="text"/>
        </fieldset>
      </form>
      `;
      getanswer = () => {
        let value = document.getElementById("answer").value;
        if (problem.type === "number" && isNaN(value)) {
          document.getElementById("lesson-form").submit();
          return null;
        }
        return [value];
      };
      applycorrect = () => {
        let answer = document.getElementById("answer")
        answer.value = problem.answers[0];
      };
    } else if (problem.type === "multiple-choice") {
      class_overlay_content.innerHTML += `<form id="lesson-form" action="" onsubmit="return false;"><fieldset id="form-fieldset"></fieldset></form>`;
      let fieldset = document.getElementById("form-fieldset");
      for (let option_in in problem.options)
        fieldset.innerHTML += `<div class="labelset"><label for="answer-${option_in
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")}">${problem.options[option_in]
          .replaceAll("<", "&lt;")
          .replaceAll(
            ">",
            "&gt;",
          )}</label><input type="radio" name="answer" id="answer-${option_in
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")}" value="${problem.options[option_in]
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "'")}"/></div>`;
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
              el.checked=true;
              break_loop = true;
              break;
            }
            else el.checked=false;
          }
          if (break_loop) break;
        }
      }
    } else if (problem.type === "checkbox") {
      class_overlay_content.innerHTML += `<form id="lesson-form" action="" onsubmit="return false;"><fieldset id="form-fieldset"></fieldset></form>`;
      let fieldset = document.getElementById("form-fieldset");
      for (let option_in in problem.options)
        fieldset.innerHTML += `<div class="labelset"><label for="answer-${option_in
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")}">${problem.options[option_in]
          .replaceAll("<", "&lt;")
          .replaceAll(
            ">",
            "&gt;",
          )}</label><input type="checkbox" id"answer-${option_in
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")}" name="answer" value="${problem.options[option_in]
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "'")}"/></div>`;
      getanswer = () => {
        let answers = [];
        let raw_answers = document.querySelectorAll('input[name=answer]:checked');

        for (let i of raw_answers)
          answers.push(i.value)
        return answers;
        //TODO
      };
      applycorrect = () => {
        let els = document.querySelectorAll('input[name="answer"]');
        for (let el of els)
          for (let ans of problem.answers) {
            if (ans == el.value) el.checked = true;
            else el.checked = true;
          }
      };
    }


    
    let form = document.getElementById("lesson-form");
    class_continue.innerText = "Check";
    
    if (completed < totalitems) {
      class_continue.onclick = function (e) {
        let answer = getanswer();
        applycorrect();
        if (answer === null) return;
        score = checkProblem(problem, answer);
        scores[problem.id] = score;
        if (score > 50)
          progress_dots_div.children[completed - 1].classList.add("completed");
        else progress_dots_div.children[completed - 1].classList.add("failed");
        class_continue.innerText = "Continue";
        document.getElementById("form-fieldset").disabled = true;
        class_continue.onclick = nextItem;
      };
    } else {
      // Last problem
      class_continue.onclick = function (e) {
        let answer = getanswer();
        applycorrect();
        if (answer === null) return false;
        score = checkProblem(problem, answer);
        scores[problem.id] = score;
        if (score > 50)
          progress_dots_div.children[completed - 1].classList.add("completed");
        else progress_dots_div.children[completed - 1].classList.add("failed");
        
        class_continue.innerText = "Finish";
        document.getElementById("form-fieldset").disabled = true;
        class_continue.onclick = () => endLesson();

      };
    }
    form.addEventListener("keydown", (evt) => {
      if (evt.keyCode === 13 && !evt.shiftKey) class_continue.click();
      if (
        problem.type === "number" &&
        (evt.which < 48 || evt.which > 57) &&
        ![8, 37, 39, 190].includes(evt.which) & !evt.ctrlKey & !evt.metaKey
      )
        evt.preventDefault();
    });
    form.addEventListener("keyup", (evt) => {
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
