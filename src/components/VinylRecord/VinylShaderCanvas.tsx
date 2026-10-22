// src/components/VinylRecord/VinylShaderCanvas.tsx
// Raw WebGL2 disc surface renderer. No Three.js/R3F, no independent RAF loop.
// It receives rotation frames from useVinylRotation and draws on demand.

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import type { VinylPressing } from "../../lib/vinyl/pressingEngine";
import {
  createFallbackPalette,
  deriveVinylPressing,
} from "../../lib/vinyl/pressingEngine";
import { bakeVinylTexture } from "../../lib/vinyl/textureBake";
import { VINYL_VERTEX_SHADER } from "../../lib/vinyl/shaders/vinyl.vert";
import { VINYL_FRAGMENT_SHADER } from "../../lib/vinyl/shaders/vinyl.frag";

export interface VinylShaderHandle {
  setRotation: (rotation: number, velocity: number) => void;
  setMouse: (x: number, y: number) => void;
  redraw: () => void;
}

interface VinylShaderCanvasProps {
  artworkDataUrl: string | null;
  size: number;
  onReadyChange?: (ready: boolean) => void;
}

interface GlState {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  vao: WebGLVertexArrayObject | null;
  waxTexture: WebGLTexture | null;
  artworkTexture: WebGLTexture | null;
  pressing: VinylPressing;
  rotation: number;
  velocity: number;
  mouse: [number, number];
  hasArtwork: boolean;
  disposed: boolean;
}

const TEXTURE_SIZE = 640;

export const VinylShaderCanvas = forwardRef<
  VinylShaderHandle,
  VinylShaderCanvasProps
>(function VinylShaderCanvas({ artworkDataUrl, size, onReadyChange }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GlState | null>(null);
  const onReadyRef = useRef(onReadyChange);
  onReadyRef.current = onReadyChange;

  const fallbackPressing = useMemo(
    () =>
      deriveVinylPressing(createFallbackPalette(), "vinyldeck:shader-fallback"),
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      setRotation(rotation: number, velocity: number) {
        const state = stateRef.current;
        if (!state) return;
        state.rotation = rotation;
        state.velocity = velocity;
        draw(state);
      },
      setMouse(x: number, y: number) {
        const state = stateRef.current;
        if (!state) return;
        state.mouse = [x, y];
        draw(state);
      },
      redraw() {
        const state = stateRef.current;
        if (state) draw(state);
      },
    }),
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });

    if (!gl) {
      onReadyRef.current?.(false);
      return;
    }

    let state: GlState | null = null;

    try {
      const program = createProgram(
        gl,
        VINYL_VERTEX_SHADER,
        VINYL_FRAGMENT_SHADER,
      );
      const vao = createQuad(gl, program);
      state = {
        gl,
        program,
        vao,
        waxTexture: null,
        artworkTexture: null,
        pressing: fallbackPressing,
        rotation: 0,
        velocity: 0,
        mouse: [0.5, 0.18],
        hasArtwork: false,
        disposed: false,
      };
      stateRef.current = state;
      resizeCanvas(canvas, gl, size);
      uploadWaxTexture(state, fallbackPressing);
      uploadArtworkTexture(state, artworkDataUrl);
      onReadyRef.current?.(true);
      draw(state);
    } catch (error) {
      console.warn(
        "[VinylDeck] WebGL vinyl renderer failed; falling back to CSS:",
        error,
      );
      cleanupState(state);
      stateRef.current = null;
      onReadyRef.current?.(false);
    }

    function handleContextLost(event: Event) {
      event.preventDefault();
      onReadyRef.current?.(false);
    }

    function handleContextRestored() {
      onReadyRef.current?.(false);
    }

    canvas.addEventListener("webglcontextlost", handleContextLost, false);
    canvas.addEventListener(
      "webglcontextrestored",
      handleContextRestored,
      false,
    );

    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLost, false);
      canvas.removeEventListener(
        "webglcontextrestored",
        handleContextRestored,
        false,
      );
      cleanupState(stateRef.current);
      stateRef.current = null;
      onReadyRef.current?.(false);
    };
    // Initialize WebGL once. Artwork and size updates are handled by dedicated effects.
  }, [fallbackPressing]);

  useEffect(() => {
    const state = stateRef.current;
    const canvas = canvasRef.current;
    if (!state || !canvas) return;
    resizeCanvas(canvas, state.gl, size);
    draw(state);
  }, [size]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    uploadArtworkTexture(state, artworkDataUrl);
    draw(state);
  }, [artworkDataUrl]);

  useEffect(() => {
    function handlePressingEvent(event: Event) {
      const detail = (event as CustomEvent<VinylPressing | null>).detail;
      const state = stateRef.current;
      if (!state) return;
      const nextPressing = detail ?? fallbackPressing;
      state.pressing = nextPressing;
      uploadWaxTexture(state, nextPressing);
      draw(state);
    }

    window.addEventListener("vinyldeck:vinyl-pressing", handlePressingEvent);
    return () =>
      window.removeEventListener(
        "vinyldeck:vinyl-pressing",
        handlePressingEvent,
      );
  }, [fallbackPressing]);

  return (
    <canvas
      ref={canvasRef}
      className="vinyl-shader-canvas"
      width={size}
      height={size}
      aria-hidden="true"
    />
  );
});

function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error("Unable to create WebGL program");
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) ?? "Unknown program link error";
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error(info);
  }

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  return program;
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create WebGL shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) ?? "Unknown shader compile error";
    gl.deleteShader(shader);
    throw new Error(info);
  }
  return shader;
}

function createQuad(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
): WebGLVertexArrayObject | null {
  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();
  const positionLocation = gl.getAttribLocation(program, "aPosition");

  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindVertexArray(null);

  return vao;
}

function resizeCanvas(
  canvas: HTMLCanvasElement,
  gl: WebGL2RenderingContext,
  cssSize: number,
): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const physical = Math.max(128, Math.round(cssSize * dpr));
  if (canvas.width !== physical || canvas.height !== physical) {
    canvas.width = physical;
    canvas.height = physical;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
}

function uploadWaxTexture(state: GlState, pressing: VinylPressing): void {
  const { gl } = state;
  const baked = bakeVinylTexture(pressing, TEXTURE_SIZE);
  state.waxTexture = uploadCanvasTexture(
    gl,
    state.waxTexture,
    baked.canvas,
    gl.TEXTURE0,
  );
}

function uploadArtworkTexture(state: GlState, dataUrl: string | null): void {
  const { gl } = state;
  if (!dataUrl) {
    state.artworkTexture = uploadSolidTexture(
      gl,
      state.artworkTexture,
      [0, 0, 0, 255],
      gl.TEXTURE1,
    );
    state.hasArtwork = false;
    return;
  }

  const image = new Image();
  image.decoding = "async";
  image.onload = () => {
    if (state.disposed) return;
    state.artworkTexture = uploadImageTexture(
      gl,
      state.artworkTexture,
      image,
      gl.TEXTURE1,
    );
    state.hasArtwork = true;
    draw(state);
  };
  image.onerror = () => {
    state.artworkTexture = uploadSolidTexture(
      gl,
      state.artworkTexture,
      [0, 0, 0, 255],
      gl.TEXTURE1,
    );
    state.hasArtwork = false;
    draw(state);
  };
  image.src = dataUrl;
}

function uploadCanvasTexture(
  gl: WebGL2RenderingContext,
  existing: WebGLTexture | null,
  canvas: HTMLCanvasElement,
  unit: number,
): WebGLTexture | null {
  const texture = existing ?? gl.createTexture();
  if (!texture) return null;
  gl.activeTexture(unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  setTextureParams(gl);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}

function uploadImageTexture(
  gl: WebGL2RenderingContext,
  existing: WebGLTexture | null,
  image: HTMLImageElement,
  unit: number,
): WebGLTexture | null {
  const texture = existing ?? gl.createTexture();
  if (!texture) return null;
  gl.activeTexture(unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  setTextureParams(gl);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}

function uploadSolidTexture(
  gl: WebGL2RenderingContext,
  existing: WebGLTexture | null,
  rgba: [number, number, number, number],
  unit: number,
): WebGLTexture | null {
  const texture = existing ?? gl.createTexture();
  if (!texture) return null;
  gl.activeTexture(unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  setTextureParams(gl);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array(rgba),
  );
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}

function setTextureParams(gl: WebGL2RenderingContext): void {
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
}

function draw(state: GlState): void {
  const { gl, program, pressing } = state;
  if (state.disposed || gl.isContextLost()) return;

  gl.useProgram(program);
  gl.bindVertexArray(state.vao);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  bindTextureUniform(gl, program, "uWaxMap", state.waxTexture, 0);
  bindTextureUniform(gl, program, "uArtwork", state.artworkTexture, 1);

  setUniform1f(gl, program, "uTime", performance.now() / 1000);
  setUniform1f(gl, program, "uRotation", state.rotation);
  setUniform1f(gl, program, "uVelocity", state.velocity);
  setUniform2f(gl, program, "uMouse", state.mouse[0], state.mouse[1]);
  setUniform1f(gl, program, "uSeed", (pressing.seedHash % 100000) / 100000);
  setUniform1i(gl, program, "uRecipeId", pressing.material.recipeId);
  setUniform1i(gl, program, "uHasArtwork", state.hasArtwork ? 1 : 0);

  setUniform3f(gl, program, "uPrimary", pressing.colors.primary);
  setUniform3f(gl, program, "uSecondary", pressing.colors.secondary);
  setUniform3f(gl, program, "uAccent", pressing.colors.accent);
  setUniform3f(gl, program, "uDeep", pressing.colors.deep);
  setUniform3f(gl, program, "uHighlight", pressing.colors.highlight);
  setUniform1f(gl, program, "uTranslucency", pressing.material.translucency);
  setUniform1f(gl, program, "uRoughness", pressing.material.roughness);
  setUniform1f(
    gl,
    program,
    "uGrooveIntensity",
    pressing.material.grooveIntensity,
  );
  setUniform1f(gl, program, "uDiffraction", pressing.material.diffraction);
  setUniform1f(gl, program, "uRimAbsorption", pressing.material.rimAbsorption);
  setUniform1f(gl, program, "uAlpha", pressing.material.alpha);
  setUniform1f(gl, program, "uSmokeDensity", pressing.material.smokeDensity);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.bindVertexArray(null);
}

function bindTextureUniform(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
  texture: WebGLTexture | null,
  unit: number,
): void {
  const location = gl.getUniformLocation(program, name);
  if (!location) return;
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(location, unit);
}

function setUniform1f(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
  value: number,
): void {
  const location = gl.getUniformLocation(program, name);
  if (location) gl.uniform1f(location, value);
}

function setUniform1i(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
  value: number,
): void {
  const location = gl.getUniformLocation(program, name);
  if (location) gl.uniform1i(location, value);
}

function setUniform2f(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
  x: number,
  y: number,
): void {
  const location = gl.getUniformLocation(program, name);
  if (location) gl.uniform2f(location, x, y);
}

function setUniform3f(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
  color: { r: number; g: number; b: number },
): void {
  const location = gl.getUniformLocation(program, name);
  if (location)
    gl.uniform3f(location, color.r / 255, color.g / 255, color.b / 255);
}

function cleanupState(state: GlState | null): void {
  if (!state) return;
  state.disposed = true;
  const { gl } = state;
  if (state.waxTexture) gl.deleteTexture(state.waxTexture);
  if (state.artworkTexture) gl.deleteTexture(state.artworkTexture);
  if (state.vao) gl.deleteVertexArray(state.vao);
  gl.deleteProgram(state.program);
}
