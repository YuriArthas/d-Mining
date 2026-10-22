import { BackSide, Color, CubeCamera, HalfFloatType, Mesh, PMREMGenerator, Scene, ShaderMaterial, SphereGeometry, Vector3, WebGLCubeRenderTarget, type WebGLRenderer, type WebGLRenderTarget } from 'three';
import type {SurfaceTime} from '../world/SceneLighting.ts';

export type SkyConfig=Readonly<{
 dayZenith:string;dayHorizon:string;nightZenith:string;nightHorizon:string;
 lighting:Readonly<Record<SurfaceTime,Readonly<{moonPosition:readonly [number,number,number];environmentIntensity:number}>>>;
}>;
const SKY_SIZE=128;
// Retain both authored skies; visible sky and image-based lighting interpolate together.
// Endpoints are baked once; only transitions blend the two small lighting cubes.
export class SurfaceEnvironment {
  private readonly renderer:WebGLRenderer;
  private readonly scene:Scene;
  private readonly config:SkyConfig;
  private readonly moonDirection:Vector3;
  private readonly previous;
  private readonly intensity;
  private readonly background;
  private readonly cubes={day:new WebGLCubeRenderTarget(SKY_SIZE,{type:HalfFloatType}),night:new WebGLCubeRenderTarget(SKY_SIZE,{type:HalfFloatType})};
  private time:SurfaceTime='night';
  private daylight=0;
  private lightingStrength=1;
  private bakedDaylight=-1;
  private environmentUpdates=0;
  private readonly blendedCube=new WebGLCubeRenderTarget(SKY_SIZE,{type:HalfFloatType});
  private readonly blendScene=new Scene();
  private readonly blendCamera=new CubeCamera(.1,10,this.blendedCube);
  private readonly blendDome:Mesh<SphereGeometry,ShaderMaterial>;
  private readonly prefilter:Pick<PMREMGenerator,'fromCubemap'|'dispose'>;
  private readonly filtered:Readonly<Record<SurfaceTime,WebGLRenderTarget>>;
  private readonly filteredBlend:WebGLRenderTarget;
  private enabled = false;
  private disposed = false;
  private prepared:Readonly<{daylight:number;surface:boolean;lightingStrength:number;lightingIntensity:number}>|null=null;
  private submitted:Readonly<{daylight:number;surface:boolean;lightingStrength:number;lightingIntensity:number}>|null=null;
  private submittedFrames=0;
  private readonly dome:Mesh<SphereGeometry,ShaderMaterial>;
  readonly bakeMs: number;
  constructor(renderer: WebGLRenderer, scene: Scene, config:SkyConfig, prefilter:Pick<PMREMGenerator,'fromCubemap'|'dispose'>=new PMREMGenerator(renderer)) {
    this.renderer=renderer;this.scene=scene;
    this.prefilter=prefilter;
    this.config=config;this.moonDirection=new Vector3(...config.lighting.night.moonPosition).normalize();
    const start = performance.now();
    this.previous = scene.environment; this.intensity = scene.environmentIntensity; this.background = scene.background;
    const material = new ShaderMaterial({
      side: BackSide, depthWrite: false, depthTest:true, toneMapped: false,
      uniforms: { daytime:{value:0},sunDirection:{value:new Vector3(...config.lighting.day.moonPosition).normalize()},dayZenith:{value:new Color(config.dayZenith)},dayHorizon:{value:new Color(config.dayHorizon)},moonDirection: { value: this.moonDirection }, zenith: { value: new Color(config.nightZenith) }, horizon: { value: new Color(config.nightHorizon) } },
      vertexShader: `varying vec3 vDirection;
        void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform float daytime;uniform vec3 dayZenith;uniform vec3 dayHorizon;uniform vec3 moonDirection;uniform vec3 sunDirection;uniform vec3 zenith;uniform vec3 horizon;varying vec3 vDirection;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y);}
        float fbm(vec2 p){float v=0.0,a=.55;for(int i=0;i<4;i++){v+=a*noise(p);p=mat2(1.6,1.2,-1.2,1.6)*p+7.3;a*=.48;}return v;}
        void main(){
          vec3 d=normalize(vDirection);float h=max(0.0,d.y);
          vec3 daySky=vec3(0.),nightSky=vec3(0.);
          if(daytime>0.){
            vec3 sky;
            sky=mix(dayHorizon,dayZenith,pow(h,.45));
            vec2 p=d.xz/max(.16,h)*2.1+vec2(3.2,8.1);
            float cloud=smoothstep(.48,.67,fbm(p*.55))*smoothstep(.18,.4,h);
            vec3 cloudColor=mix(vec3(.65,.78,.89),vec3(.97,.97,.91),smoothstep(.48,.72,fbm(p*.55)));
            sky=mix(sky,cloudColor,cloud*.94);
            float sunDot=max(dot(d,sunDirection),0.);
            sky+=vec3(.20,.16,.09)*pow(sunDot,96.);
            sky=mix(sky,vec3(1.,.96,.80),smoothstep(.9992,.9995,sunDot));
            if(d.y<0.)sky=mix(dayHorizon,vec3(.065,.13,.035),smoothstep(0.,.3,-d.y));
            daySky=sky;
          }
          if(daytime<1.){
          vec3 sky=mix(horizon,zenith,pow(h,.42));
          // Sparse soft stars; footprint-aware filtering keeps the cube stable.
          vec2 starUV=vec2(atan(d.z,d.x)/6.2831853+.5,asin(clamp(d.y,-1.,1.))/3.14159265+.5)*vec2(540.,270.);
          vec2 cell=floor(starUV),f=fract(starUV);
          vec2 center=.2+.6*vec2(hash(cell+12.3),hash(cell+45.7));
          float radius=mix(.065,.12,hash(cell+71.));
          float aa=max(length(fwidth(starUV))*.35,.025);
          float star=(1.-smoothstep(radius-aa,radius+aa,length(f-center)))*step(.988,hash(cell))*smoothstep(.05,.25,h);
          sky+=mix(vec3(.48,.67,1.),vec3(1.,.88,.62),hash(cell+9.))*star*.85;
          float moonDot=max(dot(d,moonDirection),0.);
          sky+=vec3(.045,.075,.13)*pow(moonDot,12.)+vec3(.19,.27,.40)*pow(moonDot,160.);
          float moon=smoothstep(.99905,.99935,moonDot);
          // A small textured ivory moon, with a cool halo, aligned to moonlight.
          float crater=noise(d.xz*220.)*.08;
          sky=mix(sky,vec3(.9,.92,.84)-crater,moon);
          vec2 p=d.xz/max(.13,h)*1.4+vec2(8.3,2.8);
          float broad=fbm(p*.72),detail=fbm(p*2.8);
          float cloud=smoothstep(.52,.72,broad*.85+detail*.15)*smoothstep(.04,.22,h)*.6;
          vec3 cloudColor=mix(vec3(.058,.082,.145),vec3(.22,.29,.40),pow(moonDot,6.));
          cloudColor+=vec3(.10,.13,.18)*pow(moonDot,12.)*(1.-smoothstep(.54,.65,broad));
          sky=mix(sky,cloudColor,cloud);
          if(d.y<0.)sky=mix(horizon,vec3(.009,.017,.028),smoothstep(0.,.28,-d.y));
          nightSky=sky;
          }
          gl_FragColor=vec4(mix(nightSky,daySky,daytime),1.0);
          #include <colorspace_fragment>
        }`,
    });
    const capture = new Scene(), sphere = new Mesh(new SphereGeometry(5,32,16),material);
    sphere.frustumCulled=false; capture.add(sphere);
    for(const time of ['night','day'] as const){
      material.uniforms.daytime.value=time==='day'?1:0;
      new CubeCamera(.1,10,this.cubes[time]).update(renderer,capture);
    }
    // Own the CubeUV outputs explicitly. Giving raw render-target cubes to
    // scene.environment would let Three create PMREM targets outside our scope.
    this.filtered={night:prefilter.fromCubemap(this.cubes.night.texture),day:prefilter.fromCubemap(this.cubes.day.texture)};
    this.filteredBlend=prefilter.fromCubemap(this.cubes.night.texture);
    material.uniforms.daytime.value=0;
    sphere.geometry.dispose();
    this.blendDome=new Mesh(new SphereGeometry(5,16,8),new ShaderMaterial({
      side:BackSide,depthWrite:false,toneMapped:false,
      uniforms:{dayMap:{value:this.cubes.day.texture},nightMap:{value:this.cubes.night.texture},daytime:{value:0}},
      vertexShader:`varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`uniform samplerCube dayMap;uniform samplerCube nightMap;uniform float daytime;varying vec3 vDirection;
        void main(){vec3 direction=normalize(vDirection);gl_FragColor=mix(textureCube(nightMap,direction),textureCube(dayMap,direction),daytime);}`,
    }));
    this.blendDome.frustumCulled=false;this.blendScene.add(this.blendDome);
    // Draw the visible sky analytically at viewport resolution: tiny stars and
    // the moon are not enlarged texels from the small lighting capture.
    this.dome=new Mesh(new SphereGeometry(3000,32,16),material);
    this.dome.name='surface-sky';this.dome.frustumCulled=false;this.dome.renderOrder=1000; // Last opaque draw: occluded sky fragments fail early depth testing.
    this.dome.onBeforeRender=(_renderer,_scene,camera)=>{this.dome.position.copy(camera.position);this.dome.updateMatrixWorld();};
    this.dome.visible=false;scene.add(this.dome);
    this.bakeMs=performance.now()-start;
  }
  setTime(time:SurfaceTime){return this.setDaylight(time==='day'?1:0);}
  setDaylight(value:number){
    if(this.disposed)throw new Error('SurfaceEnvironment has been disposed');
    const daylight=Math.max(0,Math.min(1,value));
    if(this.daylight===daylight)return false;
    this.daylight=daylight;this.time=daylight>=.5?'day':'night';
    this.dome.material.uniforms.daytime.value=daylight;
    if(this.enabled)this.applyEnvironment();
    return true;
  }
  private applyEnvironment(){
    if(this.lightingStrength===0){
      this.scene.environment=null;this.scene.environmentIntensity=0;return;
    }
    if(this.daylight>0&&this.daylight<1){
      this.scene.environment=this.filteredBlend.texture;
    }else this.scene.environment=this.filtered[this.daylight===1?'day':'night'].texture;
    const {day,night}=this.config.lighting;
    this.scene.environmentIntensity=(night.environmentIntensity+(day.environmentIntensity-night.environmentIntensity)*this.daylight)*this.lightingStrength;
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
  // The runtime calls this only after its render gate admits a frame, before
  // drawing any world geometry or reflections. Logic frames only replace the
  // latest daylight value; skipped submissions must never enqueue GPU work.
  prepareDraw(){
    if(this.disposed)throw new Error('SurfaceEnvironment has been disposed');
    if(this.enabled&&this.lightingStrength>0&&this.daylight>0&&this.daylight<1&&this.bakedDaylight!==this.daylight){
      this.blendDome.material.uniforms.daytime.value=this.daylight;
      this.blendCamera.update(this.renderer,this.blendScene);
      this.prefilter.fromCubemap(this.blendedCube.texture,this.filteredBlend);
      this.bakedDaylight=this.daylight;
      this.environmentUpdates++;
    }
    this.prepared={daylight:this.daylight,surface:this.enabled,lightingStrength:this.enabled?this.lightingStrength:0,lightingIntensity:this.enabled?this.scene.environmentIntensity:0};
  }
  // Called only after the owning submission gate reports success. Diagnostics
  // keep the actually submitted state separate from newer simulation values.
  markSubmitted(){
    if(this.disposed)throw new Error('SurfaceEnvironment has been disposed');
    if(!this.prepared)throw new Error('No environment frame was prepared');
    this.submitted=this.prepared;this.prepared=null;this.submittedFrames++;
  }
  get active(){return this.enabled;}
  diagnostics(){return {version:'camp-day-night-v2',time:this.time,daylightBlend:this.daylight,environmentLightingStrength:this.enabled?this.lightingStrength:0,environmentLightingIntensity:this.enabled?this.scene.environmentIntensity:0,environmentLightingActive:this.enabled&&this.lightingStrength>0,environmentUpdates:this.environmentUpdates,submittedDaylightBlend:this.submitted?.daylight??null,submittedSurface:this.submitted?.surface??null,submittedEnvironmentLightingStrength:this.submitted?.lightingStrength??null,submittedEnvironmentLightingIntensity:this.submitted?.lightingIntensity??null,submittedFrames:this.submittedFrames,nightVersion:'silver-moon-v12',retainedModes:['day','night'],visibleSky:'analytic-shader',skyDepthTest:this.dome.material.depthTest,skyRenderOrder:this.dome.renderOrder,cubeSize:SKY_SIZE,sharedSkyLighting:true,moonDirection:this.moonDirection.toArray(),bakeMs:this.bakeMs};}
  dispose(){
    if(this.disposed)return;this.disposed=true;
    this.prepared=null;
    this.scene.background=this.background;this.scene.environment=this.previous;this.scene.environmentIntensity=this.intensity;
    this.filtered.day.dispose();this.filtered.night.dispose();this.filteredBlend.dispose();this.prefilter.dispose();
    this.cubes.day.dispose();this.cubes.night.dispose();this.blendedCube.dispose();
    this.blendDome.geometry.dispose();this.blendDome.material.dispose();this.blendScene.clear();
    this.dome.removeFromParent();this.dome.geometry.dispose();this.dome.material.dispose();
  }
}
