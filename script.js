(function () {
  const EMOJI_POOL = [
    "🌈",
    "✨",
    "🫧",
    "🎈",
    "🧸",
    "🦄",
    "🚀",
    "🍓",
    "🌼",
    "🐣",
    "🍉",
    "🌟",
    "🦋",
    "🫐",
    "🐥",
  ];

  const COLOR_CLASSES = [
    "sprite--coral",
    "sprite--sky",
    "sprite--sun",
    "sprite--mint",
    "sprite--grape",
    "sprite--bubble",
  ];

  const TREATMENT_CLASSES = [
    "sprite--solid",
    "sprite--glow",
    "sprite--shadow",
    "sprite--outline",
  ];

  const CONFIG = {
    maxSprites: 18,
    spriteLifetimeMs: 2200,
    introDurationMs: 280,
    exitStartRatio: 0.42,
    minFontSize: 72,
    maxFontSize: 180,
    stagePadding: 48,
    confettiCount: 26,
    maxSpin: 32,
  };

  const state = {
    started: false,
    isFullscreen: false,
    activeSprites: [],
    nextId: 1,
    clockMs: 0,
    frameHandle: 0,
    lastFrameTime: 0,
    hasTyped: false,
  };

  const app = document.getElementById("app");
  const stage = document.getElementById("stage");
  const startOverlay = document.getElementById("start-overlay");
  const startFullscreenButton = document.getElementById("start-fullscreen");
  const startWindowedButton = document.getElementById("start-windowed");
  const fullscreenToggle = document.getElementById("fullscreen-toggle");
  const stageHint = document.getElementById("stage-hint");
  const confettiLayer = document.getElementById("confetti-layer");

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function randomInt(min, max) {
    return Math.floor(randomBetween(min, max + 1));
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function pickRandom(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function createConfetti() {
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < CONFIG.confettiCount; index += 1) {
      const piece = document.createElement("span");
      const size = randomBetween(10, 22);
      const radius = Math.random() > 0.55 ? "999px" : "28%";
      const alpha = randomBetween(48, 88).toFixed(0);

      piece.className = "confetti-piece";
      piece.style.setProperty("--top", randomBetween(4, 96).toFixed(2));
      piece.style.setProperty("--left", randomBetween(2, 98).toFixed(2));
      piece.style.setProperty("--size", size.toFixed(2));
      piece.style.setProperty("--shape-radius", radius);
      piece.style.setProperty("--hue", randomInt(5, 355));
      piece.style.setProperty("--alpha", alpha);
      piece.style.setProperty("--rotation", randomBetween(-25, 25).toFixed(2));
      piece.style.setProperty("--duration", randomBetween(7, 16).toFixed(2));
      piece.style.setProperty("--delay", randomBetween(0, 12).toFixed(2));
      fragment.appendChild(piece);
    }

    confettiLayer.appendChild(fragment);
  }

  function getViewportSize() {
    return {
      width: stage.clientWidth || window.innerWidth,
      height: stage.clientHeight || window.innerHeight,
    };
  }

  function getRandomPosition(size) {
    const { width, height } = getViewportSize();
    const padding = Math.min(CONFIG.stagePadding, Math.min(width, height) * 0.14);
    const halfWidth = size * 0.45;
    const halfHeight = size * 0.5;
    const minX = padding + halfWidth;
    const maxX = width - padding - halfWidth;
    const minY = padding + halfHeight;
    const maxY = height - padding - halfHeight;

    return {
      x: maxX > minX ? randomBetween(minX, maxX) : width / 2,
      y: maxY > minY ? randomBetween(minY, maxY) : height / 2,
    };
  }

  function classifyKey(key) {
    if (key === " ") {
      return {
        content: pickRandom(EMOJI_POOL),
        kind: "emoji",
      };
    }

    if (/^[a-z0-9]$/i.test(key)) {
      return {
        content: key,
        kind: "literal",
      };
    }

    if (key.length === 1) {
      return {
        content: pickRandom(EMOJI_POOL),
        kind: "emoji",
      };
    }

    return null;
  }

  function syncFullscreenState() {
    const doc = document;
    state.isFullscreen = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
    fullscreenToggle.textContent = state.isFullscreen ? "Exit Full Screen" : "Go Full Screen";
  }

  async function enterFullscreen() {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      syncFullscreenState();
      return true;
    }

    const target = app;

    try {
      if (target.requestFullscreen) {
        await target.requestFullscreen();
      } else if (target.webkitRequestFullscreen) {
        target.webkitRequestFullscreen();
      } else {
        return false;
      }
      syncFullscreenState();
      return true;
    } catch (_error) {
      syncFullscreenState();
      return false;
    }
  }

  async function exitFullscreen() {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    } catch (_error) {
      // Ignore and keep the UI usable in windowed mode.
    }
    syncFullscreenState();
  }

  async function toggleFullscreen() {
    if (state.isFullscreen) {
      await exitFullscreen();
      return;
    }

    await enterFullscreen();
  }

  function removeSprite(sprite) {
    const spriteIndex = state.activeSprites.findIndex((item) => item.id === sprite.id);

    if (spriteIndex >= 0) {
      state.activeSprites.splice(spriteIndex, 1);
    }

    if (sprite.element && sprite.element.parentNode) {
      sprite.element.parentNode.removeChild(sprite.element);
    }
  }

  function easeOutBack(value) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2);
  }

  function renderSprite(sprite) {
    const age = state.clockMs - sprite.createdAt;
    const ageRatio = clamp(age / sprite.lifetimeMs, 0, 1);
    const introRatio = clamp(age / CONFIG.introDurationMs, 0, 1);
    const exitRatio = clamp(
      (ageRatio - CONFIG.exitStartRatio) / (1 - CONFIG.exitStartRatio),
      0,
      1,
    );
    const loopRatio = age / 1000;
    const pulse = 1 + Math.sin(loopRatio * sprite.pulseSpeed) * sprite.pulseAmount * (1 - exitRatio * 0.55);
    const bobX = Math.sin(loopRatio * sprite.wobbleSpeed + sprite.phase) * sprite.wobbleX;
    const bobY = Math.cos(loopRatio * sprite.floatSpeed + sprite.phase) * sprite.wobbleY;
    const scale =
      (age < CONFIG.introDurationMs ? easeOutBack(introRatio) : 1 - exitRatio * 0.12) * pulse;
    const opacity = 1 - Math.pow(exitRatio, prefersReducedMotion() ? 1.3 : 1.8);
    const xOffset = bobX + sprite.driftX * exitRatio;
    const yOffset = bobY + sprite.driftY * exitRatio;
    const rotate =
      sprite.rotation +
      sprite.spin * exitRatio +
      Math.sin(loopRatio * sprite.wobbleSpeed + sprite.phase) * sprite.wobbleRotate;

    sprite.element.style.left = `${sprite.x}px`;
    sprite.element.style.top = `${sprite.y}px`;
    sprite.element.style.opacity = opacity.toFixed(3);
    sprite.element.style.transform =
      `translate(-50%, -50%) translate(${xOffset.toFixed(2)}px, ${yOffset.toFixed(2)}px) ` +
      `rotate(${rotate.toFixed(2)}deg) skew(${sprite.skewX.toFixed(2)}deg, ${sprite.skewY.toFixed(2)}deg) ` +
      `scale(${scale.toFixed(3)})`;
  }

  function stepSprites() {
    const expired = [];

    for (const sprite of state.activeSprites) {
      if (state.clockMs - sprite.createdAt >= sprite.lifetimeMs) {
        expired.push(sprite);
        continue;
      }
      renderSprite(sprite);
    }

    expired.forEach(removeSprite);
  }

  function advanceClock(ms) {
    if (!Number.isFinite(ms) || ms <= 0) {
      return;
    }

    state.clockMs += ms;
    stepSprites();
  }

  function animationFrame(now) {
    if (!state.lastFrameTime) {
      state.lastFrameTime = now;
    }

    const delta = Math.min(now - state.lastFrameTime, 64);
    state.lastFrameTime = now;
    advanceClock(delta);
    state.frameHandle = window.requestAnimationFrame(animationFrame);
  }

  function ensureLoop() {
    if (!state.frameHandle) {
      state.frameHandle = window.requestAnimationFrame(animationFrame);
    }
  }

  function hideStageHint() {
    if (!state.hasTyped) {
      state.hasTyped = true;
      stageHint.classList.add("is-hidden");
      window.setTimeout(function () {
        stageHint.hidden = true;
      }, 260);
    }
  }

  function spawnSprite(content, kind) {
    const fontSize = randomBetween(CONFIG.minFontSize, CONFIG.maxFontSize);
    const position = getRandomPosition(fontSize);
    const reduceMotion = prefersReducedMotion();
    const sprite = {
      id: state.nextId,
      content,
      kind,
      x: position.x,
      y: position.y,
      size: fontSize,
      rotation: randomBetween(-14, 14),
      spin: randomBetween(-CONFIG.maxSpin, CONFIG.maxSpin),
      driftX: reduceMotion ? randomBetween(-8, 8) : randomBetween(-44, 44),
      driftY: reduceMotion ? randomBetween(-18, -4) : randomBetween(-92, -22),
      wobbleX: reduceMotion ? randomBetween(1, 4) : randomBetween(4, 14),
      wobbleY: reduceMotion ? randomBetween(1, 6) : randomBetween(8, 20),
      wobbleRotate: reduceMotion ? randomBetween(0.4, 1.4) : randomBetween(1.2, 4.5),
      wobbleSpeed: randomBetween(2.2, 4.8),
      floatSpeed: randomBetween(1.4, 3.1),
      pulseSpeed: randomBetween(2.6, 5.2),
      pulseAmount: reduceMotion ? randomBetween(0.006, 0.012) : randomBetween(0.015, 0.045),
      skewX: randomBetween(-4, 4),
      skewY: randomBetween(-2, 2),
      phase: randomBetween(0, Math.PI * 2),
      weight: Math.random() > 0.55 ? "700" : "600",
      letterSpacing: kind === "literal" && content.length === 1 ? `${randomBetween(-0.06, 0.04).toFixed(3)}em` : "0",
      colorClass: pickRandom(COLOR_CLASSES),
      treatmentClass: pickRandom(TREATMENT_CLASSES),
      createdAt: state.clockMs,
      lifetimeMs: CONFIG.spriteLifetimeMs,
      element: document.createElement("span"),
    };

    sprite.element.className = `sprite ${sprite.colorClass} ${sprite.treatmentClass}`;
    sprite.element.textContent = sprite.content;
    sprite.element.style.fontSize = `${sprite.size}px`;
    sprite.element.style.fontWeight = sprite.weight;
    sprite.element.style.letterSpacing = sprite.letterSpacing;
    sprite.element.setAttribute("role", "presentation");

    stage.appendChild(sprite.element);
    state.activeSprites.push(sprite);
    state.nextId += 1;

    while (state.activeSprites.length > CONFIG.maxSprites) {
      removeSprite(state.activeSprites[0]);
    }

    renderSprite(sprite);
    hideStageHint();
  }

  function handleKeyDown(event) {
    if (!state.started) {
      return;
    }

    if (
      event.key === "Escape" ||
      event.key === "Shift" ||
      event.key === "Control" ||
      event.key === "Alt" ||
      event.key === "Meta" ||
      event.key === "CapsLock" ||
      event.key === "Tab" ||
      event.key === "ArrowUp" ||
      event.key === "ArrowDown" ||
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight" ||
      event.key === "Dead"
    ) {
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const keyInfo = classifyKey(event.key);

    if (!keyInfo) {
      return;
    }

    spawnSprite(keyInfo.content, keyInfo.kind);
  }

  function startApp(options) {
    if (state.started) {
      return;
    }

    state.started = true;
    startOverlay.classList.add("is-hidden");
    fullscreenToggle.hidden = false;
    syncFullscreenState();
    ensureLoop();

    if (options && options.preferFullscreen) {
      enterFullscreen();
    }
  }

  function buildTextState() {
    const viewport = getViewportSize();
    return JSON.stringify({
      started: state.started,
      isFullscreen: state.isFullscreen,
      spriteCount: state.activeSprites.length,
      stage: {
        width: viewport.width,
        height: viewport.height,
        origin: "top-left; x increases right; y increases down",
      },
      sprites: state.activeSprites.map((sprite) => ({
        id: sprite.id,
        content: sprite.content,
        kind: sprite.kind,
        x: Number(sprite.x.toFixed(1)),
        y: Number(sprite.y.toFixed(1)),
        size: Number(sprite.size.toFixed(1)),
        rotation: Number(sprite.rotation.toFixed(1)),
        colorClass: sprite.colorClass,
        treatmentClass: sprite.treatmentClass,
        remainingMs: Math.max(0, Math.round(sprite.lifetimeMs - (state.clockMs - sprite.createdAt))),
      })),
    });
  }

  function advanceTime(ms) {
    advanceClock(ms);
    state.lastFrameTime = performance.now();
  }

  startFullscreenButton.addEventListener("click", function () {
    startApp({ preferFullscreen: true });
  });

  startWindowedButton.addEventListener("click", function () {
    startApp({ preferFullscreen: false });
  });

  fullscreenToggle.addEventListener("click", function () {
    toggleFullscreen();
  });

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("fullscreenchange", syncFullscreenState);
  window.addEventListener("webkitfullscreenchange", syncFullscreenState);
  window.addEventListener("resize", function () {
    stepSprites();
  });

  createConfetti();
  syncFullscreenState();

  window.render_game_to_text = buildTextState;
  window.advanceTime = advanceTime;
})();
