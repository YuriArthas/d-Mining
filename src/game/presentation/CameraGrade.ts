import {
  BufferGeometry, Float32BufferAttribute, FramebufferTexture, Mesh,
  NoBlending, NoColorSpace, OrthographicCamera, RawShaderMaterial, Scene,
  Vector2, Vector3, Vector4, type Camera, type WebGLRenderer,
} from 'three';
import type { CameraLook } from '../content/cameraLook.ts';

// Copy the resolved display framebuffer, then draw one full-screen triangle.
// This preserves per-material toneMapped=false, MSAA and the existing first-frame
// shader variants. Texture bytes are already sRGB encoded: do NOT decode/encode again.
export class CameraGrade {
  private texture = new FramebufferTexture(1, 1);
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly geometry = new BufferGeometry();
  private readonly material: RawShaderMaterial;
  private readonly size = new Vector2();
  private readonly origin = new Vector2(0, 0);
  private readonly viewport = new Vector4();
  private readonly scissor = new Vector4();
  private disposed = false;
  private enabled = false;
  private frames = 0;
  private cpuMs = 0;
  private allocations = 0;

  constructor() {
    this.texture.colorSpace = NoColorSpace;
    this.geometry.setAttribute('position', new Float32BufferAttribute([-1,-1,0, 3,-1,0, -1,3,0], 3));
    this.material = new RawShaderMaterial({
      name: 'camera-stylized-grade-v1', depthTest: false, depthWrite: false,
      blending: NoBlending, toneMapped: false,
      uniforms: {
        frame: { value: this.texture }, contrast: { value: 0 },
        saturation: { value: 1 }, greenSaturation: { value: 1 }, tintStrength: { value: 0 },
        shadowTint: { value: new Vector3(1,1,1) }, highlightTint: { value: new Vector3(1,1,1) },
      },
      vertexShader: `precision highp float;
        attribute vec3 position; varying vec2 uv;
        void main(){ uv=position.xy*.5+.5; gl_Position=vec4(position,1.); }`,
      fragmentShader: `precision highp float;
        uniform sampler2D frame; varying vec2 uv;
        uniform float contrast, saturation, greenSaturation, tintStrength;
        uniform vec3 shadowTint, highlightTint;
        void main(){
          vec4 sampleColor=texture2D(frame,uv);
          vec3 c=sampleColor.rgb;
          float l=dot(c,vec3(.2126,.7152,.0722));
          // Bounded S curve keeps black and white endpoints; no hard posterization.
          float shaped=l+contrast*(l-.5)*l*(1.-l);
          c*=shaped/max(l,.00001);
          float green=smoothstep(.025,.22,c.g-max(c.r,c.b));
          c=mix(vec3(shaped),c,mix(saturation,greenSaturation,green));
          float shadows=1.-smoothstep(.06,.58,l);
          float highlights=smoothstep(.48,.94,l);
          c*=mix(vec3(1.),shadowTint,shadows*tintStrength);
          c*=mix(vec3(1.),highlightTint,highlights*tintStrength);
          // Softly contain color excursions without clipping individual channels.
          float peak=max(c.r,max(c.g,c.b));
          if(peak>.96)c*= (.96+.04*(1.-exp(-(peak-.96)/.04)))/peak;
          gl_FragColor=vec4(max(c,vec3(0.)),sampleColor.a);
        }`,
    });
    const mesh = new Mesh(this.geometry, this.material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  private resize(renderer: WebGLRenderer) {
    renderer.getDrawingBufferSize(this.size);
    const width = Math.max(1, this.size.x), height = Math.max(1, this.size.y);
    if (this.texture.image.width === width && this.texture.image.height === height) return;
    this.texture.dispose();
    this.texture = new FramebufferTexture(width, height);
    this.texture.colorSpace = NoColorSpace;
    this.material.uniforms.frame.value = this.texture;
    this.allocations++;
  }

  async prepare(renderer: WebGLRenderer, signal: AbortSignal) {
    signal.throwIfAborted();
    await renderer.compileAsync(this.scene, this.camera);
    signal.throwIfAborted();
  }

  draw(renderer: WebGLRenderer, scene: Scene, camera: Camera, enabled: boolean, look: CameraLook) {
    if (this.disposed) throw Error('CameraGrade disposed');
    renderer.render(scene, camera);
    this.enabled = enabled;
    this.cpuMs = 0;
    if (!enabled) return;
    if (renderer.getRenderTarget() !== null) throw Error('CameraGrade requires the display framebuffer');
    const start = performance.now();
    this.resize(renderer);
    const u = this.material.uniforms;
    u.contrast.value = look.contrast; u.saturation.value = look.saturation;
    u.greenSaturation.value = look.greenSaturation; u.tintStrength.value = look.tintStrength;
    u.shadowTint.value.set(...look.shadowTint); u.highlightTint.value.set(...look.highlightTint);
    renderer.copyFramebufferToTexture(this.texture, this.origin);
    const autoClear = renderer.autoClear;
    renderer.getViewport(this.viewport); renderer.getScissor(this.scissor);
    const scissorTest = renderer.getScissorTest();
    try {
      renderer.autoClear = false;
      renderer.setScissorTest(false);
      renderer.render(this.scene, this.camera);
      this.frames++;
    } finally {
      renderer.autoClear = autoClear;
      renderer.setViewport(this.viewport); renderer.setScissor(this.scissor);
      renderer.setScissorTest(scissorTest);
      this.cpuMs = performance.now() - start;
    }
  }

  diagnostics() {
    const { width, height } = this.texture.image;
    return {
      version: 'camera-stylized-grade-v1', enabled: this.enabled, frames: this.frames,
      cpuMs: this.cpuMs, width, height, estimatedColorBytes: width*height*4,
      allocations: this.allocations, extraDrawCalls: this.enabled ? 1 : 0,
      framebufferCopies: this.enabled ? 1 : 0, extraSceneRenders: 0,
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.texture.dispose(); this.geometry.dispose(); this.material.dispose(); this.scene.clear();
  }
}
