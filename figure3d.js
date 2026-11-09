// BENDITO STUDIO – 3D-Figur und Szenen für die Drehpläne. Benötigt three.min.js (r128).
// Posen: walkHood, walk, sit, press, dead, pullLow, pullUp. Szenen kommen aus data.js (scene: {...}).
(function(){
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const M={
  hood:new THREE.MeshStandardMaterial({color:0x2b2e35,roughness:.92}),
  hoodIn:new THREE.MeshStandardMaterial({color:0x050506,roughness:1}),
  pants:new THREE.MeshStandardMaterial({color:0x1c1e23,roughness:.95}),
  skin:new THREE.MeshStandardMaterial({color:0x8d6c57,roughness:.7}),
  shoe:new THREE.MeshStandardMaterial({color:0x121316,roughness:.6}),
  sole:new THREE.MeshStandardMaterial({color:0xcfcac2,roughness:.8}),
  pad:new THREE.MeshStandardMaterial({color:0x2c2f36,roughness:.7}),
  steel:new THREE.MeshStandardMaterial({color:0x9aa0a8,roughness:.35,metalness:.8}),
  dark:new THREE.MeshStandardMaterial({color:0x3c4048,roughness:.6,metalness:.4}),
  floor:new THREE.MeshStandardMaterial({color:0x24262b,roughness:.85}),
  wall:new THREE.MeshStandardMaterial({color:0x1b1d22,roughness:.95}),
  bag:new THREE.MeshStandardMaterial({color:0x202329,roughness:.9}),
  lampE:new THREE.MeshStandardMaterial({color:0xffd79a,emissive:0xffc070,emissiveIntensity:2.2}),
  phone:new THREE.MeshStandardMaterial({color:0x79b4e0,emissive:0x2a5a80,roughness:.4}),
  cone:new THREE.MeshBasicMaterial({color:0x79b4e0,transparent:true,opacity:.14,side:THREE.DoubleSide,depthWrite:false}),
};
const Y=V(0,1,0);
function shade(m){m.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});return m}
// organic segment: lathe profile along a->b. prof = [[t,r],...]
function seg(a,b,prof,mat){
  const d=b.clone().sub(a),L=d.length();
  const pts=prof.map(([t,r])=>new THREE.Vector2(r,t*L));
  const geo=new THREE.LatheGeometry(pts,22);
  const m=new THREE.Mesh(geo,mat);
  m.position.copy(a);m.quaternion.setFromUnitVectors(Y,d.normalize());
  return m;
}
const P={
  upperArm:[[0,0],[.0001,.058],[.15,.062],[.45,.056],[.85,.045],[1,.0001]],
  foreArm:[[0,0],[.0001,.045],[.2,.05],[.6,.04],[.95,.032],[1,0]],
  thigh:[[0,0],[.0001,.09],[.15,.092],[.55,.078],[.9,.058],[1,0]],
  shin:[[0,0],[.0001,.058],[.25,.062],[.55,.05],[.9,.04],[1,0]],
};
function joint(p,r,mat){const s=new THREE.Mesh(new THREE.SphereGeometry(r,20,14),mat);s.position.copy(p);return s}
function torso(j){
  const g=new THREE.Group();
  const pel=j.pelvis,neck=j.neck,L=neck.distanceTo(pel);
  // hoodie profile: hips -> waist -> chest -> shoulders -> neck
  const prof=[[0,.0001],[0,.17],[.12,.175],[.35,.165],[.62,.19],[.8,.2],[.92,.17],[1,.08],[1.01,.0001]];
  const geo=new THREE.LatheGeometry(prof.map(([t,r])=>new THREE.Vector2(r,t*L)),28);
  const body=new THREE.Mesh(geo,M.hood);body.scale.set(1,1,.62);
  // shoulder caps
  const capL=joint(V(0,0,0),.075,M.hood),capR=capL.clone();
  // basis
  const y=neck.clone().sub(pel).normalize();
  let x=j.shL.clone().sub(j.shR);x.sub(y.clone().multiplyScalar(x.dot(y))).normalize();
  const z=new THREE.Vector3().crossVectors(x,y).normalize();
  // lathe's local X (radius) maps to shoulder axis, local Z to depth
  const inner=new THREE.Group();inner.add(body);
  // hem band
  const hem=new THREE.Mesh(new THREE.TorusGeometry(.168,.018,8,28),M.hood);hem.rotation.x=Math.PI/2;hem.scale.set(1,.62,1);hem.position.y=.02;inner.add(hem);
  // pocket seam
  const mat4=new THREE.Matrix4().makeBasis(x,y,z.clone().negate());
  inner.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,new THREE.Vector3().crossVectors(x,y)));
  inner.position.copy(pel);
  g.add(inner);
  capL.position.copy(j.shL);capR.position.copy(j.shR);g.add(capL,capR);
  return g;
}
function hood(j){
  const g=new THREE.Group();
  const shell=new THREE.Mesh(new THREE.SphereGeometry(.125,28,20),M.hood);shell.scale.set(1,1.12,1.08);
  const peak=new THREE.Mesh(new THREE.ConeGeometry(.05,.08,12),M.hood);peak.position.set(0,.13,-.02);peak.rotation.x=-.5;
  const open=new THREE.Mesh(new THREE.SphereGeometry(.088,20,14),M.hoodIn);open.scale.set(.85,1.05,.5);open.position.set(0,-.01,.1);
  const neckM=new THREE.Mesh(new THREE.CylinderGeometry(.06,.075,.12,16),M.hood);neckM.position.y=-.13;
  g.add(shell,peak,open,neckM);
  g.position.copy(j.head);
  // face direction (local +Z) toward j.face
  const f=j.face.clone();f.y=0;f.normalize();
  g.rotation.y=Math.atan2(f.x,f.z);
  g.rotation.x=j.headDown||0;
  return g;
}
function hand(p,dir){const h=new THREE.Mesh(new THREE.SphereGeometry(.05,16,12),M.skin);h.scale.set(.75,1.25,.6);h.position.copy(p);if(dir){h.quaternion.setFromUnitVectors(Y,dir.clone().normalize())}return h}
function shoe(an,face){
  const g=new THREE.Group();
  const u=new THREE.Mesh(new THREE.SphereGeometry(.07,18,12),M.shoe);u.scale.set(.75,.62,1.55);u.position.set(0,.03,.05);
  const s=new THREE.Mesh(new THREE.BoxGeometry(.1,.022,.27),M.sole);s.position.set(0,-.005,.05);
  g.add(u,s);g.position.set(an.x,Math.max(an.y-.04,.015),an.z);
  const f=face.clone();f.y=0;f.normalize();g.rotation.y=Math.atan2(f.x,f.z);
  return g;
}
// pose: joints in metres, figure facing +X; mirror side: L = +z
function personOld(pose,opts={}){
  const j={};for(const k in pose)j[k]=pose[k].clone?pose[k].clone():pose[k];
  const g=new THREE.Group();
  const face=j.face||V(1,0,0);j.face=face;
  ['L','R'].forEach(s=>{
    g.add(seg(j['hip'+s],j['kn'+s],P.thigh,M.pants),joint(j['kn'+s],.056,M.pants));
    g.add(seg(j['kn'+s],j['an'+s],P.shin,M.pants));
    g.add(shoe(j['an'+s],j['foot'+s]||face));
    g.add(seg(j['sh'+s],j['el'+s],P.upperArm,M.hood),joint(j['el'+s],.046,M.hood));
    g.add(seg(j['el'+s],j['wr'+s],P.foreArm,M.hood));
    const cuff=new THREE.Mesh(new THREE.TorusGeometry(.036,.012,8,16),M.hood);cuff.position.copy(j['wr'+s]);cuff.quaternion.setFromUnitVectors(V(0,0,1),j['wr'+s].clone().sub(j['el'+s]).normalize());g.add(cuff);
    const hd=j['wr'+s].clone().sub(j['el'+s]).normalize();
    g.add(hand(j['wr'+s].clone().add(hd.clone().multiplyScalar(.07)),hd));
  });
  g.add(joint(j.pelvis,.15,M.pants));
  g.children[g.children.length-1].scale.set(1.05,.7,.75);
  g.add(torso(j));g.add(hood(j));
  if(opts.bag){const b=new THREE.Mesh(new THREE.BoxGeometry(.32,.22,.18),M.bag);b.position.copy(j.pelvis).add(V(-.05,0,-.22));g.add(b);
    g.add(seg(b.position.clone().add(V(0,.1,0)),j.shL.clone().add(V(0,.02,-.04)),[[0,0],[.0001,.012],[1,.012],[1,0]],M.bag));}
  return shade(g);
}

// ---- realistische Figur: rigged 3D-Körper (Mixamo Y Bot, Fallback xbot.glb), Gelenke werden auf die Pose ausgerichtet
let BASE=null;
const BODY=new THREE.MeshPhysicalMaterial({color:0xe9e9ec,roughness:.32,metalness:0,clearcoat:.6,clearcoatRoughness:.25,skinning:true});
const JOINTS=new THREE.MeshPhysicalMaterial({color:0xa9adb5,roughness:.4,metalness:.1,clearcoat:.4,skinning:true});
const ready=new Promise(res=>{
  const glb=()=>{if(!THREE.GLTFLoader){res(false);return}new THREE.GLTFLoader().load('xbot.glb',g=>{BASE=g.scene;res(true)},null,()=>res(false))};
  if(!THREE.FBXLoader){glb();return}
  new THREE.FBXLoader().load('ybot.fbx',o=>{o.scale.setScalar(.01);o.animations=[];BASE=o;res(true)},null,glb);
});
const _q=new THREE.Quaternion(),_q2=new THREE.Quaternion(),_a=new THREE.Vector3(),_b=new THREE.Vector3();
function wp(o){return o.getWorldPosition(new THREE.Vector3())}
function setWorldQuat(bone,qw){
  bone.parent.getWorldQuaternion(_q2);_q2.invert();
  bone.quaternion.copy(_q2.multiply(qw));bone.updateMatrixWorld(true);
}
function aim(bone,child,dir){
  bone.updateMatrixWorld(true);
  const cur=wp(child).sub(wp(bone)).normalize();
  const q=new THREE.Quaternion().setFromUnitVectors(cur,dir.clone().normalize());
  setWorldQuat(bone,q.multiply(bone.getWorldQuaternion(new THREE.Quaternion())));
}
function basis(lat,up){
  const y=up.clone().normalize();const x=lat.clone().sub(y.clone().multiplyScalar(lat.dot(y))).normalize();
  const z=new THREE.Vector3().crossVectors(x,y);return new THREE.Matrix4().makeBasis(x,y,z);
}
function person(pose,opts={}){
  if(!BASE)return personOld(pose,opts);
  const j={};for(const k in pose)j[k]=pose[k].clone?pose[k].clone():pose[k];
  const face=(j.face||V(1,0,0)).clone();face.y=0;face.normalize();
  const root=THREE.SkeletonUtils.clone(BASE);
  const g=new THREE.Group();g.add(root);g.updateMatrixWorld(true);
  const B=n=>root.getObjectByName('mixamorig'+n);
  root.traverse(o=>{if(o.isMesh){o.material=o.name.includes('Joints')?JOINTS:BODY;o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false}});
  // Athletischer: breitere Brust/Schultern, kräftigere Arme und Beine, schmalere Hüfte
  const W={Hips:[.92,.92],Spine:[1.06,1.02],Spine1:[1.2,1.12],Spine2:[1.34,1.2],Neck:[1.3,1.3],Head:[1,1],LeftShoulder:[1.2,1.2],RightShoulder:[1.2,1.2],
    LeftArm:[1.42,1.42],RightArm:[1.42,1.42],LeftForeArm:[1.28,1.28],RightForeArm:[1.28,1.28],LeftHand:[1.08,1.08],RightHand:[1.08,1.08],
    LeftUpLeg:[1.08,1.1],RightUpLeg:[1.08,1.1],LeftLeg:[1.2,1.2],RightLeg:[1.2,1.2],LeftFoot:[1,1],RightFoot:[1,1]};
  for(const n in W){const b=B(n),pw=W[b.parent.name.replace('mixamorig','')]||[1,1];b.scale.set(W[n][0]/pw[0],1,W[n][1]/pw[1])}
  g.updateMatrixWorld(true);
  // Becken: ganze Ausrichtung (seitlich + oben). Figur schaut nach +X, ihr links = -Z, darum L(+z) -> Right
  const hips=B('Hips');
  const bLat=wp(B('LeftUpLeg')).sub(wp(B('RightUpLeg'))),bUp=wp(B('Spine2')).sub(wp(hips));
  const tLat=j.hipR.clone().sub(j.hipL),tUp=j.neck.clone().sub(j.pelvis);
  const rot=basis(tLat,tUp).multiply(basis(bLat,bUp).invert());
  const qr=new THREE.Quaternion().setFromRotationMatrix(rot);
  setWorldQuat(hips,qr.multiply(hips.getWorldQuaternion(new THREE.Quaternion())));
  const up=tUp.clone();
  aim(B('Spine'),B('Spine1'),up);aim(B('Spine1'),B('Spine2'),up);aim(B('Spine2'),B('Neck'),up);
  const hd=j.head.clone().sub(j.neck);
  aim(B('Neck'),B('Head'),hd);
  const hdir=hd.clone().normalize();if(j.headDown){hdir.lerp(face.clone().add(V(0,-.6,0)),Math.min(j.headDown,1)*.5).normalize()}
  aim(B('Head'),B('HeadTop_End'),hdir);
  [['L','Right'],['R','Left']].forEach(([s,m])=>{
    const fa=j['wr'+s].clone().sub(j['el'+s]);
    aim(B(m+'Arm'),B(m+'ForeArm'),j['el'+s].clone().sub(j['sh'+s]));
    aim(B(m+'ForeArm'),B(m+'Hand'),fa);
    aim(B(m+'Hand'),B(m+'HandMiddle1'),fa);
    aim(B(m+'UpLeg'),B(m+'Leg'),j['kn'+s].clone().sub(j['hip'+s]));
    aim(B(m+'Leg'),B(m+'Foot'),j['an'+s].clone().sub(j['kn'+s]));
    const ff=(j['foot'+s]||face).clone();ff.y=0;ff.normalize();
    aim(B(m+'Foot'),B(m+'ToeBase'),ff.multiplyScalar(.1).add(V(0,-.075,0)));
  });
  // Position: Becken auf Pose, dann auf den Boden stellen
  g.updateMatrixWorld(true);
  const hp=wp(hips);root.position.x+=j.pelvis.x-hp.x;root.position.z+=j.pelvis.z-hp.z;root.position.y+=j.pelvis.y-hp.y;
  g.updateMatrixWorld(true);
  let minY=Infinity;['LeftFoot','RightFoot','LeftToe_End','RightToe_End','LeftToeBase','RightToeBase'].forEach(n=>{minY=Math.min(minY,wp(B(n)).y)});
  root.position.y+=0.035-minY;
  g.updateMatrixWorld(true);
  if(opts.bag){const b=new THREE.Mesh(new THREE.BoxGeometry(.32,.22,.18),M.bag);b.position.copy(wp(hips)).add(V(-.2,.02,.14));g.add(b);
    g.add(seg(b.position.clone().add(V(0,.1,0)),wp(B('RightShoulder')).add(V(0,.03,-.04)),[[0,0],[.0001,.012],[1,.012],[1,0]],M.bag));}
  return shade(g);
}
const POSES={
 walkHood:{pelvis:V(0,.95,0),neck:V(.03,1.44,0),head:V(.06,1.6,0),shL:V(.02,1.4,.19),shR:V(.02,1.4,-.19),
   elL:V(.14,1.6,.26),wrL:V(.04,1.74,.11),elR:V(.12,1.6,-.26),wrR:V(.03,1.74,-.11),
   hipL:V(0,.92,.1),knL:V(.17,.53,.11),anL:V(.16,.1,.11),hipR:V(0,.92,-.1),knR:V(-.1,.52,-.1),anR:V(-.27,.14,-.1)},
 walk:{pelvis:V(0,.95,0),neck:V(.03,1.44,0),head:V(.06,1.6,0),shL:V(.02,1.4,.19),shR:V(.02,1.4,-.19),
   elL:V(-.1,1.16,.22),wrL:V(-.16,.92,.2),elR:V(.12,1.15,-.22),wrR:V(.22,.93,-.18),
   hipL:V(0,.92,.1),knL:V(.17,.53,.11),anL:V(.16,.1,.11),hipR:V(0,.92,-.1),knR:V(-.1,.52,-.1),anR:V(-.27,.14,-.1)},
 sit:{pelvis:V(0,.55,0),neck:V(.26,1.0,0),head:V(.36,1.08,0),headDown:.6,shL:V(.24,.98,.19),shR:V(.24,.98,-.19),
   elL:V(.47,.62,.16),wrL:V(.42,.9,.06),elR:V(.47,.62,-.16),wrR:V(.42,.9,-.06),
   hipL:V(0,.52,.1),knL:V(.48,.55,.13),anL:V(.5,.09,.15),hipR:V(0,.52,-.1),knR:V(.48,.55,-.13),anR:V(.5,.09,-.15)},
 pullLow:{face:V(1,0,0),pelvis:V(0,.56,0),neck:V(-.04,1.06,0),head:V(-.02,1.22,0),shL:V(-.04,1.02,.2),shR:V(-.04,1.02,-.2),
   elL:V(-.1,.82,.34),wrL:V(.02,1.1,.32),elR:V(-.1,.82,-.34),wrR:V(.02,1.1,-.32),
   hipL:V(.02,.53,.1),knL:V(.46,.56,.14),anL:V(.5,.09,.16),hipR:V(.02,.53,-.1),knR:V(.46,.56,-.14),anR:V(.5,.09,-.16)},
 pullUp:{face:V(1,0,0),pelvis:V(0,.56,0),neck:V(-.03,1.06,0),head:V(-.01,1.22,0),shL:V(-.03,1.03,.2),shR:V(-.03,1.03,-.2),
   elL:V(.02,1.34,.3),wrL:V(.07,1.62,.33),elR:V(.02,1.34,-.3),wrR:V(.07,1.62,-.33),
   hipL:V(.02,.53,.1),knL:V(.46,.56,.14),anL:V(.5,.09,.16),hipR:V(.02,.53,-.1),knR:V(.46,.56,-.14),anR:V(.5,.09,-.16)},
 press:{face:V(1,0,0),pelvis:V(0,.56,0),neck:V(0,1.07,0),head:V(.02,1.23,0),shL:V(0,1.04,.2),shR:V(0,1.04,-.2),
   elL:V(0,1.3,.36),wrL:V(.02,1.56,.27),elR:V(0,1.3,-.36),wrR:V(.02,1.56,-.27),
   hipL:V(.02,.53,.1),knL:V(.46,.56,.16),anL:V(.5,.09,.2),hipR:V(.02,.53,-.1),knR:V(.46,.56,-.16),anR:V(.5,.09,-.2)},
 dead:{face:V(1,0,0),pelvis:V(-.24,.82,0),neck:V(.14,1.26,0),head:V(.27,1.37,0),shL:V(.12,1.22,.2),shR:V(.12,1.22,-.2),
   elL:V(.14,.98,.23),wrL:V(.15,.73,.23),elR:V(.14,.98,-.23),wrR:V(.15,.73,-.23),
   hipL:V(-.22,.8,.1),knL:V(.13,.46,.14),anL:V(0,.09,.15),hipR:V(-.22,.8,-.1),knR:V(.13,.46,-.14),anR:V(0,.09,-.15)},
};
// ---- props
function box(w,h,d,mat,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);return shade(m)}
function bench(x,z,rotY=0){const g=new THREE.Group();
  const pad=new THREE.Mesh(new THREE.BoxGeometry(1.2,.08,.3),M.pad);pad.position.y=.45;g.add(pad);
  g.add(box(.06,.4,.06,M.dark,-.45,.22,0),box(.06,.4,.06,M.dark,.45,.22,0),box(.06,.04,.5,M.dark,-.45,.02,0),box(.06,.04,.5,M.dark,.45,.02,0));
  g.position.set(x,0,z);g.rotation.y=rotY;return shade(g)}
function dumbbell(p){const g=new THREE.Group();const h=new THREE.Mesh(new THREE.CylinderGeometry(.016,.016,.2,10),M.steel);h.rotation.x=Math.PI/2;g.add(h);
  [-.09,.09].forEach(z=>{const w=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.06,6),M.dark);w.rotation.x=Math.PI/2;w.position.z=z;g.add(w)});g.position.copy(p);return shade(g)}
function barbell(x,y){const g=new THREE.Group();const b=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,2.0,12),M.steel);b.rotation.x=Math.PI/2;g.add(b);
  [-.62,.62].forEach(z=>{const w=new THREE.Mesh(new THREE.CylinderGeometry(.225,.225,.06,32),M.dark);w.rotation.x=Math.PI/2;w.position.z=z;g.add(w)});g.position.set(x,y,0);return shade(g)}
function latMachine(){const g=new THREE.Group();
  g.add(box(.08,2.3,.08,M.dark,1.0,1.15,.45),box(.08,2.3,.08,M.dark,1.0,1.15,-.45),box(.08,.08,1.0,M.dark,1.0,2.3,0),box(.5,.08,.08,M.dark,.75,2.3,0));
  g.add(box(.36,.06,.4,M.pad,.02,.48,0),box(.06,.48,.06,M.dark,.05,.24,0),box(.12,.12,.5,M.pad,.48,.68,0));
  for(let i=0;i<10;i++)g.add(box(.1,.04,.3,M.steel,1.0,.25+i*.06,0));
  return shade(g)}
function bar(y,x){const b=new THREE.Mesh(new THREE.CylinderGeometry(.016,.016,1.2,12),M.steel);b.rotation.x=Math.PI/2;b.position.set(x,y,0);
  const c=new THREE.Mesh(new THREE.CylinderGeometry(.004,.004,2.3-y,6),M.dark);c.position.set(x,y+(2.3-y)/2,0);
  const g=new THREE.Group();g.add(b,c);return shade(g)}
function lampAt(scene,x,y,z,int=2.4){const l=new THREE.Mesh(new THREE.BoxGeometry(.6,.03,.12),M.lampE);l.position.set(x,y,z);scene.add(l);
  const s=new THREE.SpotLight(0xffc27a,int,9,Math.PI/3,.6,1.4);s.position.set(x,y-.05,z);s.target.position.set(x,0,z);s.castShadow=true;s.shadow.mapSize.set(1024,1024);scene.add(s,s.target);}
function room(scene,opts={}){
  const f=new THREE.Mesh(new THREE.PlaneGeometry(14,14),opts.street?new THREE.MeshStandardMaterial({color:0x15171b,roughness:.9}):M.floor);f.rotation.x=-Math.PI/2;f.receiveShadow=true;scene.add(f);
  const w=new THREE.Mesh(new THREE.PlaneGeometry(14,5),opts.street?new THREE.MeshStandardMaterial({color:0x17191e,roughness:1}):M.wall);w.position.set(0,2.5,opts.wallZ??-1.6);w.receiveShadow=true;scene.add(w);
  scene.add(new THREE.HemisphereLight(0x6f86a8,0x0b0b0d,opts.street?.18:.32));
}
// ---- clip scenes: returns {scene, cam:{pos,look,fov}}
const SC={
 c1(){const s=new THREE.Scene();room(s,{wallZ:-1.4});lampAt(s,.9,2.8,-.4);s.add(bench(.95,0));
   const p=person(POSES.walkHood);p.position.set(-.25,0,0);s.add(p);return{scene:s,cam:{pos:V(-1.9,.5,2.5),look:V(.35,.85,0),fov:62}}},
 c1e(){const s=new THREE.Scene();room(s,{wallZ:-1.4});lampAt(s,.9,2.8,-.4);s.add(bench(.95,0));
   const p=person(POSES.sit);p.rotation.y=Math.PI/2;p.position.set(.8,0,.02);s.add(p);return{scene:s,cam:{pos:V(-1.9,.5,2.5),look:V(.35,.85,0),fov:62}}},
 c5(){const s=new THREE.Scene();room(s,{wallZ:-1.4});lampAt(s,.9,2.8,-.4);s.add(bench(.95,0));
   const p=person(POSES.walk);p.position.set(1.55,0,.25);s.add(p);return{scene:s,cam:{pos:V(-1.9,.5,2.5),look:V(.35,.85,0),fov:62}}},
 c2(){const s=new THREE.Scene();room(s,{wallZ:-2.2});s.add(bench(-.3,0));lampAt(s,.9,2.9,-.7,2.8);
   const p=person(POSES.press);s.add(p);s.add(dumbbell(V(.03,1.63,.25)),dumbbell(V(.03,1.63,-.25)));const fl=new THREE.PointLight(0xffd2a0,2.2,5,1.3);fl.position.set(-.8,1.4,.9);s.add(fl);return{scene:s,cam:{pos:V(-1.7,.22,.35),look:V(0,1.15,0),fov:72}}},
 c3(){const s=new THREE.Scene();room(s,{wallZ:-2.2});s.add(barbell(.15,.66));lampAt(s,.2,2.9,0,3.2);
   const p=person(POSES.dead);s.add(p);return{scene:s,cam:{pos:V(-1.5,.35,2.3),look:V(0,.85,0),fov:60}}},
 c4(){const s=new THREE.Scene();room(s,{street:true,wallZ:-1.2});
   const door=new THREE.Mesh(new THREE.PlaneGeometry(1,2.1),new THREE.MeshStandardMaterial({color:0x3a2e1c,emissive:0x40280c,emissiveIntensity:.6}));door.position.set(-2.2,1.05,-1.19);s.add(door);
   lampAt(s,-2.2,2.4,-1.0,2.2);
   const p=person(POSES.walk,{bag:true});p.rotation.y=Math.PI;p.position.set(-.4,0,0);s.add(p);return{scene:s,cam:{pos:V(1.3,.4,1.9),look:V(-.9,.95,-.3),fov:100}}},
};
// ---- side view scene: phone at x=0 height h, tilt; figure at dist
function sideScene(h,tilt,dist,poseName,fig){
  const s=new THREE.Scene();
  s.add(new THREE.HemisphereLight(0x8aa0c0,0x111114,.55));
  const d=new THREE.DirectionalLight(0xffc98a,1.1);d.position.set(2,4,3);s.add(d);
  const r=new THREE.DirectionalLight(0x9ab8ff,.4);r.position.set(-3,2,-2);s.add(r);
  const grd=new THREE.Mesh(new THREE.BoxGeometry(6,.01,1),new THREE.MeshStandardMaterial({color:0x2a2d33}));grd.position.set(dist/2,-.005,0);s.add(grd);
  const ph=new THREE.Mesh(new THREE.BoxGeometry(.04,.16,.08),M.phone);ph.position.set(0,h,0);ph.rotation.z=-THREE.MathUtils.degToRad(tilt)+0;s.add(ph);
  // view cone (2D wedge in xy plane)
  const a=THREE.MathUtils.degToRad(tilt),sp=THREE.MathUtils.degToRad(fig.fovHalf||24),L=3.2;
  const sh=new THREE.Shape();sh.moveTo(0,0);sh.lineTo(L*Math.cos(a-sp),L*Math.sin(a-sp));sh.lineTo(L*Math.cos(a+sp),L*Math.sin(a+sp));sh.lineTo(0,0);
  const cone=new THREE.Mesh(new THREE.ShapeGeometry(sh),M.cone);cone.position.set(0,h,.2);s.add(cone);
  const p=person(POSES[poseName],fig.bag?{bag:true}:{});
  if(fig.flip)p.rotation.y=Math.PI;
  if(fig.rotY!==undefined)p.rotation.y=fig.rotY;
  p.position.set(dist+(fig.dx||0),0,0);s.add(p);
  if(fig.prop==='bench')s.add(bench(dist+.45,0));
  if(fig.prop==='benchUnder'){s.add(bench(dist-.3,0));const w=POSES[poseName];s.add(dumbbell(V(dist+.03,1.63,.25)))}
  if(fig.prop==='barbell')s.add(barbell(dist+.15,.66));
  if(fig.prop==='lat'){const m=latMachine();m.position.x=dist;s.add(m);s.add((()=>{const b=bar(fig.barY||1.12,dist+.04);return b})())}
  return s;
}

// ---- generische Szene aus data.js
// def = {room:'gym'|'street', wallZ, lamp:[x,y,z,stärke], door:true,
//        props:[{t:'bench',x,z,rot}|{t:'barbell',x,y}|{t:'dumbbell',p:[x,y,z]}|{t:'lat'}],
//        person:{pose,x,z,rot,bag}, cam:{pos:[x,y,z],look:[x,y,z],fov}}
function build(def){
  const s=new THREE.Scene();const street=def.room==='street';
  room(s,{street,wallZ:def.wallZ??-1.6});
  if(def.door){const door=new THREE.Mesh(new THREE.PlaneGeometry(1,2.1),new THREE.MeshStandardMaterial({color:0x3a2e1c,emissive:0x40280c,emissiveIntensity:.6}));door.position.set(def.door[0]??-2.2,1.05,(def.wallZ??-1.2)+.01);s.add(door)}
  if(def.lamp)lampAt(s,...def.lamp);
  (def.props||[]).forEach(p=>{
    if(p.t==='bench')s.add(bench(p.x||0,p.z||0,p.rot||0));
    if(p.t==='barbell')s.add(barbell(p.x||0,p.y??.66));
    if(p.t==='dumbbell')s.add(dumbbell(V(...p.p)));
    if(p.t==='lat')s.add(latMachine());
    if(p.t==='fill'){const l=new THREE.PointLight(0xffd2a0,p.i||2,5,1.3);l.position.set(...p.p);s.add(l)}
  });
  if(def.person){const q=def.person;const p=person(POSES[q.pose],q.bag?{bag:true}:{});p.rotation.y=(q.rot||0)*Math.PI/180;p.position.set(q.x||0,0,q.z||0);s.add(p)}
  const c=def.cam;return{scene:s,cam:{pos:V(...c.pos),look:V(...c.look),fov:c.fov||62}};
}
window.Figure3D={THREE_OK:true,ready,person,SC,build,sideScene,V,POSES};

})();
