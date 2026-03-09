import * as THREE from "three";

const TEXTURE_SIZE = 512;
const FONT_FAMILY = '"Fredoka", "Trebuchet MS", sans-serif';

const textureCache = new Map();

export function createCharTexture(char) {
  if (textureCache.has(char)) {
    return textureCache.get(char);
  }

  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  const fontSize = TEXTURE_SIZE * 0.65;
  ctx.font = `700 ${fontSize}px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 6;

  ctx.fillStyle = "#ffffff";
  ctx.fillText(char, TEXTURE_SIZE / 2, TEXTURE_SIZE / 2);

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  textureCache.set(char, texture);
  return texture;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const EMOJI_POOL = [
  // Faces
  "😊", "😂", "🥰", "😍", "🤩", "😎", "🥳", "😜", "🤗", "😇",
  "🤭", "😋", "🫣", "🤪", "😸", "🙈",
  // Animals
  "🦄", "🐣", "🐥", "🦋", "🐙", "🐸", "🐰", "🐱", "🐶", "🦊",
  "🐼", "🐨", "🦁", "🐝", "🐞", "🦜",
  // Nature
  "🌈", "🌟", "✨", "🌸", "🌼", "🌺", "🍀", "🌻", "🍄", "🌙",
  // Food
  "🍓", "🍉", "🫐", "🍕", "🍩", "🧁", "🍪", "🍭", "🎂", "🍦",
  // Objects & fun
  "🎈", "🧸", "🚀", "⭐", "💎", "🎵", "🎨", "🎪", "🎠", "🪁",
  "💫", "🫧", "🎀", "🌊", "🔮", "🪄",
  // Hearts
  "❤️", "💜", "💙", "💚", "💛", "🧡", "💖", "💝",
];

export { EMOJI_POOL };

export async function preloadTextures() {
  // Wait for Fredoka font to load before rendering any textures
  try {
    await document.fonts.load('700 64px Fredoka');
  } catch (_) {
    // Fallback font will be used if Fredoka fails
  }

  for (const char of LETTERS + DIGITS) {
    createCharTexture(char);
  }
  for (const emoji of EMOJI_POOL) {
    createCharTexture(emoji);
  }
}
