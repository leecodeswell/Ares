// Offline renderer for the journey. Draws the colonnade scene (scene.js) at
// full quality along the site's fixed camera path (camera.js), one frame at a
// time, so the site can play the flight as a video instead of rendering it
// live. Built by build.mjs and driven by render.py.
import { VERTEX, FRAGMENT } from "../../src/journey/scene.js";
import { cameraAt } from "../../src/journey/camera.js";
import { colonnade } from "../../src/journey/statues.js";
import skyUrl from "../../src/journey/sky.webp";
import marbleUrl from "../../src/journey/marble.webp";
import auleUrl from "../../src/journey/aule-sdf.png";

const PAPER = [232 / 255, 231 / 255, 221 / 255]; // the showcase colour the flight fades into
const canvas = document.querySelector("canvas");
const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true, antialias: false });

function shader(type, source) {
  const result = gl.createShader(type);
  gl.shaderSource(result, source);
  gl.compileShader(result);
  if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(result));
  return result;
}
const program = gl.createProgram();
gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
gl.attachShader(program, shader(gl.FRAGMENT_SHADER, colonnade(FRAGMENT)));
gl.linkProgram(program);
gl.useProgram(program);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
const position = gl.getAttribLocation(program, "aPosition");
gl.enableVertexAttribArray(position);
gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
const uniform = (name) => gl.getUniformLocation(program, name);

const texture = (unit, url, repeat) =>
  new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
      if (repeat) gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, repeat ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      resolve();
    };
    image.src = url;
  });

window.ready = Promise.all([texture(0, skyUrl, false), texture(1, marbleUrl, true), texture(2, auleUrl, false)]).then(() => {
  gl.uniform1i(uniform("uSky"), 0);
  gl.uniform1i(uniform("uMarble"), 1);
  gl.uniform1i(uniform("uAule"), 2); // the statue's distance atlas
  gl.uniform3f(uniform("uPaper"), ...PAPER);
  gl.uniform1f(uniform("uQuality"), 1);
});

// Tall frames keep at least ~50 degrees across, so phones see the columns.
window.renderAt = (progress, width, height) => {
  canvas.width = width;
  canvas.height = height;
  gl.viewport(0, 0, width, height);
  const camera = cameraAt(progress);
  const degrees = Math.PI / 180;
  const fov = Math.min(75 * degrees, Math.max(camera.fov * degrees, 2 * Math.atan(Math.tan(25 * degrees) / (width / height))));
  gl.uniform2f(uniform("uResolution"), width, height);
  gl.uniform3f(uniform("uCamera"), ...camera.position);
  gl.uniform3f(uniform("uTarget"), ...camera.target);
  gl.uniform1f(uniform("uFov"), fov);
  gl.uniform1f(uniform("uGlow"), camera.glow);
  gl.uniform1f(uniform("uPaperAmount"), camera.paper);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.finish();
};
