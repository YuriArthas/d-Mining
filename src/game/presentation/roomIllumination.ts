import type {AuthoredRoom} from '../content/rooms/authoredRoom.ts';

// Room-local static irradiance; lamp descriptors do not create renderer light objects.
export function roomIllumination(room:AuthoredRoom){
  const config=room.render.lighting,contact=config.contact,size=config.resolution;
  const bytes=new Uint8Array(size*size*4);
  const feet=room.lightSolids.filter(s=>s.at[1]-s.half[1]<contact.floorThreshold&&s.half[1]<contact.maxHalfHeight);
  for(let z=0;z<size;z++)for(let x=0;x<size;x++){
    const px=((x+.5)/size-.5)*room.referenceSize[0],pz=((z+.5)/size-.5)*room.referenceSize[2],i=(z*size+x)*4;
    let light=0,occlusion=0;
    for(const l of room.lamps)light+=Math.exp(-((px-l[0])**2+(pz-l[2])**2)/config.horizontalFalloff)*config.lampStrength;
    for(const s of feet){
      const dx=Math.max(0,Math.abs(px-s.at[0])-s.half[0]),dz=Math.max(0,Math.abs(pz-s.at[2])-s.half[2]);
      occlusion=Math.max(occlusion,Math.exp(-(dx*dx+dz*dz)*contact.falloff)*contact.strength);
    }
    bytes[i]=Math.round(Math.min(1,light)*255);bytes[i+1]=Math.round((1-occlusion)*255);bytes[i+3]=255;
  }
  return {bytes,size};
}
