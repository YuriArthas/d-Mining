import {BufferGeometry,Float32BufferAttribute,DataTexture,RGBAFormat,NoColorSpace,NearestFilter,LinearFilter,LinearMipmapLinearFilter,InstancedMesh,MeshStandardMaterial,MeshBasicMaterial,Color,Matrix4,Euler,Quaternion,Vector3,Vector2,Vector4,type Group} from 'three';
import {roomIllumination} from './roomIllumination.ts';
import type {AuthoredRoom} from '../content/rooms/authoredRoom.ts';

// Generic Blender-kit renderer. It does not know layer IDs, depth, portals or sales.
export function addAuthoredRoom(group:Group,room:AuthoredRoom){
  const {kit,render}=room;
  const atlas=new DataTexture(Uint8Array.from(atob(kit.texture.data),c=>c.charCodeAt(0)),kit.texture.size,kit.texture.size,RGBAFormat);
  atlas.colorSpace=NoColorSpace;atlas.magFilter=NearestFilter;atlas.minFilter=LinearMipmapLinearFilter;atlas.generateMipmaps=true;atlas.needsUpdate=true;
  const {size,bytes}=roomIllumination(room);
  const illumination=new DataTexture(bytes,size,size,RGBAFormat);illumination.minFilter=illumination.magFilter=LinearFilter;illumination.needsUpdate=true;
  const geometries=new Map<string,BufferGeometry>();
  for(const [id,m] of Object.entries(kit.meshes)){
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(m.positions,3));g.setAttribute('normal',new Float32BufferAttribute(m.normals,3));g.setAttribute('uv',new Float32BufferAttribute(m.uv,2));g.setIndex(m.indices);geometries.set(id,g);
  }
  const transform=new Matrix4().makeScale(...room.scale);transform.setPosition(...room.origin);
  const batches=new Map<string,typeof room.instances[number][]>();
  for(const p of room.instances){const key=p.mesh+':'+p.material;const b=batches.get(key)??[];b.push(p);batches.set(key,b);}
  for(const [key,instances] of batches){
    const style=room.materials[instances[0].material];
    const material=style.glow?new MeshBasicMaterial({color:new Color(style.color).multiplyScalar(render.surface.glowIntensity),toneMapped:false}):new MeshStandardMaterial({color:style.color,map:atlas,roughness:render.surface.roughness,metalness:render.surface.metalness,envMapIntensity:render.surface.envMapIntensity});
    if(material instanceof MeshStandardMaterial){
      material.onBeforeCompile=shader=>{
        shader.uniforms.roomIllumination={value:illumination};
        shader.uniforms.roomOrigin={value:new Vector2(room.origin[0],room.origin[2])};
        shader.uniforms.roomScale={value:new Vector3(...room.scale)};
        const {atlas,lighting:l}=render;
        const cellWidth=kit.texture.size/atlas.columns,cellHeight=kit.texture.size/atlas.rows;
        shader.uniforms.roomTileOrigin={value:new Vector2((style.tile%atlas.columns)/atlas.columns,Math.floor(style.tile/atlas.columns)/atlas.rows)};
        shader.uniforms.roomTileSize={value:new Vector2((cellWidth-2*atlas.gutter)/kit.texture.size,(cellHeight-2*atlas.gutter)/kit.texture.size)};
        shader.uniforms.roomGutter={value:atlas.gutter/kit.texture.size};
        shader.uniforms.roomRepeat={value:atlas.repeat};
        shader.uniforms.roomExtent={value:new Vector2(room.referenceSize[0],room.referenceSize[2])};
        shader.uniforms.roomCeiling={value:new Vector4(l.ceiling.bottomBrightness,l.ceiling.topBrightness,l.ceiling.from,l.ceiling.to)};
        shader.uniforms.roomContactFade={value:new Vector2(l.contact.fadeFrom,l.contact.fadeTo)};
        shader.uniforms.roomLampColor={value:new Vector3(...l.color as [number,number,number])};
        shader.uniforms.roomLampHeight={value:l.height};
        shader.uniforms.roomLampFalloff={value:l.verticalFalloff};
        shader.vertexShader='varying vec3 authoredPosition; varying vec3 authoredNormal;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
          authoredPosition=(instanceMatrix*vec4(transformed,1.)).xyz;
          authoredNormal=normalize(mat3(instanceMatrix)*normal);`);
        shader.fragmentShader=`varying vec3 authoredPosition; varying vec3 authoredNormal;
          uniform sampler2D roomIllumination; uniform vec2 roomOrigin; uniform vec3 roomScale;
          uniform vec2 roomTileOrigin; uniform vec2 roomTileSize; uniform float roomGutter; uniform float roomRepeat;
          uniform vec2 roomExtent; uniform vec4 roomCeiling; uniform vec2 roomContactFade;
          uniform vec3 roomLampColor; uniform float roomLampHeight; uniform float roomLampFalloff;
        `+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
          vec3 p=authoredPosition;vec3 n=abs(authoredNormal);
          vec2 face=n.y>max(n.x,n.z)?p.xz:n.x>n.z?p.zy:p.xy;
          vec2 repeatUV=face*roomRepeat;
          vec2 tileUV=fract(repeatUV)*roomTileSize+roomGutter+roomTileOrigin;
          diffuseColor.rgb*=textureGrad(map,tileUV,dFdx(repeatUV)*roomTileSize,dFdy(repeatUV)*roomTileSize).rgb;
        `);
        shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
          vec2 lightUV=(authoredPosition.xz-roomOrigin)/roomScale.xz/roomExtent+.5;
          vec2 lightField=texture2D(roomIllumination,clamp(lightUV,0.,1.)).rg;
          float roomY=authoredPosition.y/roomScale.y;
          float ceilingFade=mix(roomCeiling.x,roomCeiling.y,smoothstep(roomCeiling.z,roomCeiling.w,roomY));
          outgoingLight*=ceilingFade*mix(lightField.g,1.,smoothstep(roomContactFade.x,roomContactFade.y,roomY));
          outgoingLight+=diffuseColor.rgb*roomLampColor*lightField.r*exp(-abs(roomY-roomLampHeight)*roomLampFalloff);
          #include <opaque_fragment>`);
      };
      material.customProgramCacheKey=()=>'authored-room-v2';
    }
    const mesh=new InstancedMesh(geometries.get(instances[0].mesh)!,material,instances.length);mesh.name=kit.id+':'+key;
    instances.forEach((p,i)=>{
      const matrix=new Matrix4().compose(new Vector3(...p.at as [number,number,number]),new Quaternion().setFromEuler(new Euler(...p.rotation as [number,number,number])),new Vector3(...p.scale as [number,number,number]));
      if(!p.fixed)matrix.premultiply(transform);
      mesh.setMatrixAt(i,matrix);
    });
    mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=false;mesh.receiveShadow=false;mesh.computeBoundingBox();mesh.computeBoundingSphere();group.add(mesh);
  }
  // The shared light field lives in custom uniforms, outside material.map ownership.
  group.userData.disposeSurfaceNoise=()=>illumination.dispose();
  group.userData.authoredRoom={id:kit.id,instances:room.instances.length,batches:batches.size,textureSize:kit.texture.size,lightFieldSize:size,realTimeShadows:false};
}
