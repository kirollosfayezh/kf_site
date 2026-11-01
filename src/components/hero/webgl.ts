/**
 * WebGL program helpers for the hero scene: compile, link, and wait for a
 * background (`KHR_parallel_shader_compile`) link without blocking the main thread.
 */

/**
 * `check` asks for the compile result straight away, which forces the driver
 * to finish compiling on this thread. With `KHR_parallel_shader_compile` the
 * question is deferred to `whenLinked`, and the compile runs in the
 * background instead.
 */
export function compile(gl: WebGLRenderingContext, type: number, src: string, check: boolean): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (check && !gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function program(gl: WebGLRenderingContext, vsSrc: string, fsSrc: string, check: boolean): WebGLProgram | null {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc, check);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc, check);
  if (!vs || !fs) return null;
  const p = gl.createProgram();
  if (!p) return null;
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  // The shaders are owned by the program once linked; flagging them for delete
  // here means they go away with it.
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (check && !gl.getProgramParameter(p, gl.LINK_STATUS)) {
    gl.deleteProgram(p);
    return null;
  }
  return p;
}

/**
 * Calls back once every program has finished linking, with whether they all
 * succeeded.
 *
 * Compiling these two shaders took about a second of main-thread time on an
 * Intel Mac and more on a phone — one long task that lab tools score as
 * blocking and a visitor feels as a stutter. `KHR_parallel_shader_compile`
 * moves the compile to a driver thread; polling `COMPLETION_STATUS_KHR` is
 * the only call that does not force it to finish. Without the extension the
 * programs are already linked and the callback runs at once.
 */
export function whenLinked(gl: WebGLRenderingContext, programs: WebGLProgram[], done: (ok: boolean) => void): () => void {
  const ext = gl.getExtension("KHR_parallel_shader_compile") as { COMPLETION_STATUS_KHR: number } | null;
  const linked = () => done(programs.every((p) => gl.getProgramParameter(p, gl.LINK_STATUS) === true));
  if (!ext) {
    linked();
    return () => {};
  }
  let timer = 0;
  let cancelled = false;
  const poll = () => {
    if (cancelled) return;
    if (programs.every((p) => gl.getProgramParameter(p, ext.COMPLETION_STATUS_KHR) === true)) linked();
    else timer = window.setTimeout(poll, 40);
  };
  poll();
  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}
