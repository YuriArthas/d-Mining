import { BackSide, Color, CubeCamera, HalfFloatType, Mesh, Scene, ShaderMaterial, SphereGeometry, Vector3, WebGLCubeRenderTarget, type WebGLRenderer } from 'three';

export const SUN_DIRECTION = new Vector3(-36, 48, 26).normalize();
// A single authored atmosphere is captured once into the visible skybox AND the
// diffuse/specular environment. Clouds never become an unrelated studio reflection.
export class SurfaceEnvironment {
  private readonly previous;
  private readonly intensity;
  private readonly background;
  private readonly cube = new WebGLCubeRenderTarget(128, { type: HalfFloatType });
  private readonly target;
  private enabled = false;
  readonly bakeMs: number;
  constructor(renderer: WebGLRenderer, private readonly scene: Scene) {
    const start = performance.now();
    this.previous = scene.environment; this.intensity = scene.environmentIntensity; this.background = scene.background;
    const material = new ShaderMaterial({
      side: BackSide, depthWrite: false, toneMapped: false,
      uniforms: { sunDirection: { value: SUN_DIRECTION }, zenith: { value: new Color('#3d9ee9') }, horizon: { value: new Color('#b9e9ff') } },
      vertexShader: `varying vec3 vDirection;
        void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform vec3 sunDirection;uniform vec3 zenith;uniform vec3 horizon;varying vec3 vDirection;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y);}
        float fbm(vec2 p){float v=0.0,a=.55;for(int i=0;i<5;i++){v+=a*noise(p);p=mat2(1.6,1.2,-1.2,1.6)*p+7.3;a*=.48;}return v;}
        void main(){
          vec3 d=normalize(vDirection);float h=max(0.0,d.y);
          vec3 sky=mix(horizon,zenith,pow(h,.42));
          float sun=max(dot(d,sunDirection),0.0);
          sky+=vec3(.32,.22,.10)*pow(sun,18.0);
          sky+=vec3(3.0,2.6,1.8)*smoothstep(.9991,.99975,sun);
          // Project two noise scales onto a high cloud deck. Round, sunlit tops
          // and a cool underside give the clouds volume without a grey veil.
          vec2 p=d.xz/max(.10,h)*1.4+vec2(8.3,2.8);
          float broad=fbm(p*.72),detail=fbm(p*2.8);
          float density=broad*.83+detail*.17;
          float cloud=smoothstep(.49,.66,density)*smoothstep(.045,.24,h);
          float rim=clamp((fbm((p-sunDirection.xz*.16)*.72)-broad)*9.0+.6,0.0,1.0);
          vec3 cloudColor=mix(vec3(.53,.70,.91),vec3(1.5,1.47,1.33),rim);
          sky=mix(sky,cloudColor,cloud);
          // The ground hemisphere contributes a subdued green bounce to IBL.
          if(d.y<0.0)sky=mix(horizon,vec3(.085,.14,.045),smoothstep(0.0,.28,-d.y));
          gl_FragColor=vec4(sky,1.0);
        }`,
    });
    const capture = new Scene(), sphere = new Mesh(new SphereGeometry(5,32,16),material);
    sphere.frustumCulled=false; capture.add(sphere);
    const camera = new CubeCamera(.1,10,this.cube);
    camera.update(renderer,capture);
    // Rough painted surfaces do not need a second filtered cube allocation.
    this.target=this.cube;
    sphere.geometry.dispose();material.dispose();
    this.bakeMs=performance.now()-start;
  }
  setEnabled(enabled: boolean) {
    this.enabled=enabled;
    this.scene.background=enabled?this.cube.texture:this.scene.background;
    this.scene.environment=enabled?this.target.texture:this.previous;
    this.scene.environmentIntensity=enabled?.55:this.intensity;
  }
  get active(){return this.enabled;}
  diagnostics(){return {version:'camp-daylight-v1',cubeSize:128,sharedSkyLighting:true,bakeMs:this.bakeMs};}
  dispose(){this.scene.background=this.background;this.scene.environment=this.previous;this.scene.environmentIntensity=this.intensity;this.cube.dispose();}
}
