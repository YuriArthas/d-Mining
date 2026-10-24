import { BackSide, Color, CubeCamera, HalfFloatType, Mesh, PMREMGenerator, Scene, ShaderMaterial, SphereGeometry, Vector3, WebGLCubeRenderTarget, type WebGLRenderer, type WebGLRenderTarget } from 'three';

export type SkyConfig=Readonly<{
 zenith:string;horizon:string;
 /** Toward the sun (the key light's position); the sky draws its disc there. */
 sunPosition:readonly [number,number,number];
 environmentIntensity:number;
}>;
const SKY_SIZE=128;
// The daytime sky: drawn analytically at viewport resolution, and baked once into a small cube for the
// image-based light. The surface is always in daylight.
export class SurfaceEnvironment {
  private readonly scene:Scene;
  private readonly config:SkyConfig;
  private readonly previous;
  private readonly intensity;
  private readonly background;
  private readonly cube=new WebGLCubeRenderTarget(SKY_SIZE,{type:HalfFloatType});
  private readonly prefilter:Pick<PMREMGenerator,'fromCubemap'|'dispose'>;
  private readonly filtered:WebGLRenderTarget;
  private lightingStrength=1;
  private enabled = false;
  private disposed = false;
  private environmentOverride:number|undefined;
  private prepared:Readonly<{surface:boolean;lightingStrength:number;lightingIntensity:number}>|null=null;
  private submitted:Readonly<{surface:boolean;lightingStrength:number;lightingIntensity:number}>|null=null;
  private submittedFrames=0;
  private readonly dome:Mesh<SphereGeometry,ShaderMaterial>;
  readonly bakeMs: number;
  constructor(renderer: WebGLRenderer, scene: Scene, config:SkyConfig, prefilter:Pick<PMREMGenerator,'fromCubemap'|'dispose'>=new PMREMGenerator(renderer)) {
    this.scene=scene;this.prefilter=prefilter;this.config=config;
    const start = performance.now();
    this.previous = scene.environment; this.intensity = scene.environmentIntensity; this.background = scene.background;
    const material = new ShaderMaterial({
      side: BackSide, depthWrite: false, depthTest:true, toneMapped: false,
      uniforms: { sunDirection:{value:new Vector3(...config.sunPosition).normalize()},zenith:{value:new Color(config.zenith)},horizon:{value:new Color(config.horizon)} },
      vertexShader: `varying vec3 vDirection;
        void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform vec3 zenith;uniform vec3 horizon;uniform vec3 sunDirection;varying vec3 vDirection;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y);}
        float fbm(vec2 p){float v=0.0,a=.55;for(int i=0;i<4;i++){v+=a*noise(p);p=mat2(1.6,1.2,-1.2,1.6)*p+7.3;a*=.48;}return v;}
        void main(){
          vec3 d=normalize(vDirection);float h=max(0.0,d.y);
          vec3 sky=mix(horizon,zenith,pow(h,.45));
          vec2 p=d.xz/max(.16,h)*2.1+vec2(3.2,8.1);
          // Few, white clouds: grey-blue cloud cover dulled the whole sky.
          float cloud=smoothstep(.56,.72,fbm(p*.55))*smoothstep(.18,.4,h);
          vec3 cloudColor=mix(vec3(.80,.89,.97),vec3(1.,.99,.96),smoothstep(.56,.76,fbm(p*.55)));
          sky=mix(sky,cloudColor,cloud*.94);
          float sunDot=max(dot(d,sunDirection),0.);
          sky+=vec3(.20,.16,.09)*pow(sunDot,96.);
          sky=mix(sky,vec3(1.,.96,.80),smoothstep(.9992,.9995,sunDot));
          if(d.y<0.)sky=mix(horizon,vec3(.065,.13,.035),smoothstep(0.,.3,-d.y));
          gl_FragColor=vec4(sky,1.0);
          #include <colorspace_fragment>
        }`,
    });
    const capture = new Scene(), sphere = new Mesh(new SphereGeometry(5,32,16),material);
    sphere.frustumCulled=false; capture.add(sphere);
    new CubeCamera(.1,10,this.cube).update(renderer,capture);
    // Own the CubeUV output explicitly: giving the raw cube to scene.environment would let Three create
    // PMREM targets outside our scope.
    this.filtered=prefilter.fromCubemap(this.cube.texture);
    sphere.geometry.dispose();
    this.dome=new Mesh(new SphereGeometry(3000,32,16),material);
    this.dome.name='surface-sky';this.dome.frustumCulled=false;this.dome.renderOrder=1000; // Last opaque draw: occluded sky fragments fail early depth testing.
    this.dome.onBeforeRender=(_renderer,_scene,camera)=>{this.dome.position.copy(camera.position);this.dome.updateMatrixWorld();};
    this.dome.visible=false;scene.add(this.dome);
    this.bakeMs=performance.now()-start;
  }
  private applyEnvironment(){
    if(this.lightingStrength===0){this.scene.environment=null;this.scene.environmentIntensity=0;return;}
    this.scene.environment=this.filtered.texture;
    this.scene.environmentIntensity=(this.environmentOverride??this.config.environmentIntensity)*this.lightingStrength;
  }
  /** Verification only: image-based light strength (undefined keeps the config). */
  setEnvironmentOverride(intensity:number|undefined){
    if(this.disposed)throw new Error('SurfaceEnvironment has been disposed');
    this.environmentOverride=intensity;
    if(this.enabled)this.applyEnvironment();
  }
  // Sky visibility and material lighting are independent. Deep in the first
  // shaft the opening may still reveal the sky, while its IBL contribution is zero.
  setLightingStrength(value:number){
    if(this.disposed)throw new Error('SurfaceEnvironment has been disposed');
    if(!Number.isFinite(value))throw new Error('Environment lighting strength must be finite');
    const strength=Math.max(0,Math.min(1,value));
    if(this.lightingStrength===strength)return false;
    this.lightingStrength=strength;
    if(this.enabled)this.applyEnvironment();
    return true;
  }
  setEnabled(enabled: boolean) {
    if(this.disposed)throw new Error('SurfaceEnvironment has been disposed');
    this.enabled=enabled;this.dome.visible=enabled;
    if(enabled){this.scene.background=null;this.applyEnvironment();}
    else{this.scene.environment=this.previous;this.scene.environmentIntensity=this.intensity;}
  }
  // The runtime calls this only after its render gate admits a frame, before drawing any world geometry.
  prepareDraw(){
    if(this.disposed)throw new Error('SurfaceEnvironment has been disposed');
    this.prepared={surface:this.enabled,lightingStrength:this.enabled?this.lightingStrength:0,lightingIntensity:this.enabled?this.scene.environmentIntensity:0};
  }
  // Called only after the owning submission gate reports success. Diagnostics
  // keep the actually submitted state separate from newer simulation values.
  markSubmitted(){
    if(this.disposed)throw new Error('SurfaceEnvironment has been disposed');
    if(!this.prepared)throw new Error('No environment frame was prepared');
    this.submitted=this.prepared;this.prepared=null;this.submittedFrames++;
  }
  get active(){return this.enabled;}
  diagnostics(){return {version:'pinewind-day-v1',environmentLightingStrength:this.enabled?this.lightingStrength:0,environmentLightingIntensity:this.enabled?this.scene.environmentIntensity:0,environmentLightingActive:this.enabled&&this.lightingStrength>0,submittedSurface:this.submitted?.surface??null,submittedEnvironmentLightingStrength:this.submitted?.lightingStrength??null,submittedEnvironmentLightingIntensity:this.submitted?.lightingIntensity??null,submittedFrames:this.submittedFrames,visibleSky:'analytic-shader',skyDepthTest:this.dome.material.depthTest,skyRenderOrder:this.dome.renderOrder,cubeSize:SKY_SIZE,bakeMs:this.bakeMs};}
  dispose(){
    if(this.disposed)return;this.disposed=true;
    this.prepared=null;
    this.scene.background=this.background;this.scene.environment=this.previous;this.scene.environmentIntensity=this.intensity;
    this.filtered.dispose();this.prefilter.dispose();this.cube.dispose();
    this.dome.removeFromParent();this.dome.geometry.dispose();this.dome.material.dispose();
  }
}
