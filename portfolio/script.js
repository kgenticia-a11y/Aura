(function () {
  "use strict";

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) return;

  var cards = document.querySelectorAll(".pillar-card, .work-card");
  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.opacity = "1";
          entry.target.style.transform = "translateY(0)";
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  cards.forEach(function (card) {
    card.style.opacity = "0";
    card.style.transform = "translateY(12px)";
    card.style.transition = "opacity 0.4s ease, transform 0.4s ease";
    observer.observe(card);
  });
})();
