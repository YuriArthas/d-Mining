import { BackSide, Color, CubeCamera, HalfFloatType, Mesh, Scene, ShaderMaterial, SphereGeometry, Vector3, WebGLCubeRenderTarget, type WebGLRenderer } from 'three';
import {SURFACE_NIGHT} from '../world/SceneLighting.ts';

export const MOON_DIRECTION=new Vector3(...SURFACE_NIGHT.moonPosition).normalize();
const SKY_SIZE=128;
// Capture one authored night sky for BOTH background and material lighting.
// No external panoramic image downloads; the static capture is released on exit.
export class SurfaceEnvironment {
  private readonly previous;
  private readonly intensity;
  private readonly background;
  private readonly cube = new WebGLCubeRenderTarget(SKY_SIZE, { type: HalfFloatType });
  private enabled = false;
  private readonly dome:Mesh<SphereGeometry,ShaderMaterial>;
  readonly bakeMs: number;
  constructor(renderer: WebGLRenderer, private readonly scene: Scene) {
    const start = performance.now();
    this.previous = scene.environment; this.intensity = scene.environmentIntensity; this.background = scene.background;
    const material = new ShaderMaterial({
      side: BackSide, depthWrite: false, depthTest:false, toneMapped: false,
      uniforms: { moonDirection: { value: MOON_DIRECTION }, zenith: { value: new Color('#0b1233') }, horizon: { value: new Color('#344b7b') } },
      vertexShader: `varying vec3 vDirection;
        void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform vec3 moonDirection;uniform vec3 zenith;uniform vec3 horizon;varying vec3 vDirection;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y);}
        float fbm(vec2 p){float v=0.0,a=.55;for(int i=0;i<4;i++){v+=a*noise(p);p=mat2(1.6,1.2,-1.2,1.6)*p+7.3;a*=.48;}return v;}
        void main(){
          vec3 d=normalize(vDirection);float h=max(0.0,d.y);
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
          sky+=vec3(.14,.22,.42)*pow(moonDot,110.);
          float moon=smoothstep(.99905,.99935,moonDot);
          // A small textured ivory moon, with a cool halo, aligned to moonlight.
          float crater=noise(d.xz*220.)*.08;
          sky=mix(sky,vec3(.9,.92,.84)-crater,moon);
          vec2 p=d.xz/max(.13,h)*1.4+vec2(8.3,2.8);
          float broad=fbm(p*.72),detail=fbm(p*2.8);
          float cloud=smoothstep(.52,.72,broad*.85+detail*.15)*smoothstep(.04,.22,h)*.6;
          vec3 cloudColor=mix(vec3(.019,.029,.066),vec3(.065,.09,.15),pow(moonDot,8.));
          sky=mix(sky,cloudColor,cloud);
          if(d.y<0.)sky=mix(horizon,vec3(.009,.017,.028),smoothstep(0.,.28,-d.y));
          gl_FragColor=vec4(sky,1.0);
          #include <colorspace_fragment>
        }`,
    });
    const capture = new Scene(), sphere = new Mesh(new SphereGeometry(5,32,16),material);
    sphere.frustumCulled=false; capture.add(sphere);
    const camera = new CubeCamera(.1,10,this.cube);
    camera.update(renderer,capture);
    sphere.geometry.dispose();
    // Draw the visible sky analytically at viewport resolution: tiny stars and
    // the moon are not enlarged texels from the small lighting capture.
    this.dome=new Mesh(new SphereGeometry(3000,32,16),material);
    this.dome.name='moonlit-sky';this.dome.frustumCulled=false;this.dome.renderOrder=-1000;
    this.dome.onBeforeRender=(_renderer,_scene,camera)=>{this.dome.position.copy(camera.position);this.dome.updateMatrixWorld();};
    this.dome.visible=false;scene.add(this.dome);
    this.bakeMs=performance.now()-start;
  }
  setEnabled(enabled: boolean) {
    this.enabled=enabled;this.dome.visible=enabled;
    this.scene.background=enabled?null:this.scene.background;
    this.scene.environment=enabled?this.cube.texture:this.previous;
    this.scene.environmentIntensity=enabled?SURFACE_NIGHT.environmentIntensity:this.intensity;
  }
  get active(){return this.enabled;}
  diagnostics(){return {version:'camp-moonlit-v2',visibleSky:'analytic-shader',cubeSize:SKY_SIZE,sharedSkyLighting:true,moonDirection:MOON_DIRECTION.toArray(),bakeMs:this.bakeMs};}
  dispose(){this.scene.background=this.background;this.scene.environment=this.previous;this.scene.environmentIntensity=this.intensity;this.cube.dispose();this.dome.removeFromParent();this.dome.geometry.dispose();this.dome.material.dispose();}
}
