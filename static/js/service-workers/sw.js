//https://www.freecodecamp.org/news/how-to-make-your-app-work-offline-with-the-power-of-javascript-685d968bcfbb/

//https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
//THIS IS AN EXAMPLE FROM MDN
const addResourcesToCache = async (resources) => {
  const cache = await caches.open("v1");
  await cache.addAll(resources);
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    addResourcesToCache([
      "/",
      "/course",
      "/course/new",
      "/static/img/arrow.svg",
      "/static/img/default-profile.png",
      "/static/img/hamburger.png",
      "/static/css/all.css",
      "/static/css/course-page.css",
      "/static/css/dropdown.css",
      "/static/css/homepage.css",
      "/static/js/dropdown.js",
      "/static/js/tilt.min.js",
      "/static/js/service-workers/register.js",
      "/begin"
    ]),
  );
});
