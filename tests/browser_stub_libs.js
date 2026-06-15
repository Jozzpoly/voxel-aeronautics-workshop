(() => {
  window.requestAnimationFrame = () => 0;
  class V2 { constructor(x=0,y=0){this.x=x;this.y=y;} }
  class V3 {
    constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
    set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
    setScalar(s){this.x=this.y=this.z=s;return this;}
    clone(){return new V3(this.x,this.y,this.z);}
    copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;}
    add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}
    sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}
    multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this;}
    divideScalar(s){return this.multiplyScalar(1/s);}
    lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z;}
    length(){return Math.sqrt(this.lengthSq());}
    normalize(){const l=this.length()||1;return this.divideScalar(l);}
    dot(v){return this.x*v.x+this.y*v.y+this.z*v.z;}
    cross(v){const x=this.y*v.z-this.z*v.y,y=this.z*v.x-this.x*v.z,z=this.x*v.y-this.y*v.x;this.x=x;this.y=y;this.z=z;return this;}
    round(){this.x=Math.round(this.x);this.y=Math.round(this.y);this.z=Math.round(this.z);return this;}
    lerp(v,a){this.x+=(v.x-this.x)*a;this.y+=(v.y-this.y)*a;this.z+=(v.z-this.z)*a;return this;}
    applyQuaternion(q){const x=this.x,y=this.y,z=this.z,qx=q.x,qy=q.y,qz=q.z,qw=q.w;const ix=qw*x+qy*z-qz*y,iy=qw*y+qz*x-qx*z,iz=qw*z+qx*y-qy*x,iw=-qx*x-qy*y-qz*z;this.x=ix*qw+iw*-qx+iy*-qz-iz*-qy;this.y=iy*qw+iw*-qy+iz*-qx-ix*-qz;this.z=iz*qw+iw*-qz+ix*-qy-iy*-qx;return this;}
  }
  class Q {
    constructor(x=0,y=0,z=0,w=1){this.x=x;this.y=y;this.z=z;this.w=w;}
    set(x,y,z,w){this.x=x;this.y=y;this.z=z;this.w=w;return this;}
    clone(){return new Q(this.x,this.y,this.z,this.w);}
    copy(q){return this.set(q.x,q.y,q.z,q.w);}
    identity(){return this.set(0,0,0,1);}
    normalize(){const l=Math.hypot(this.x,this.y,this.z,this.w)||1;this.x/=l;this.y/=l;this.z/=l;this.w/=l;return this;}
    setFromAxisAngle(a,ang){const h=ang/2,s=Math.sin(h);return this.set(a.x*s,a.y*s,a.z*s,Math.cos(h));}
    setFromUnitVectors(a,b){let r=a.dot(b)+1;if(r<1e-6){if(Math.abs(a.x)>Math.abs(a.z))this.set(-a.y,a.x,0,0);else this.set(0,-a.z,a.y,0);}else{const c=a.clone().cross(b);this.set(c.x,c.y,c.z,r);}return this.normalize();}
    setFromRotationMatrix(m){const e=m.elements,m11=e[0],m12=e[4],m13=e[8],m21=e[1],m22=e[5],m23=e[9],m31=e[2],m32=e[6],m33=e[10],trace=m11+m22+m33;let s;if(trace>0){s=.5/Math.sqrt(trace+1);this.w=.25/s;this.x=(m32-m23)*s;this.y=(m13-m31)*s;this.z=(m21-m12)*s;}else if(m11>m22&&m11>m33){s=2*Math.sqrt(1+m11-m22-m33);this.w=(m32-m23)/s;this.x=.25*s;this.y=(m12+m21)/s;this.z=(m13+m31)/s;}else if(m22>m33){s=2*Math.sqrt(1+m22-m11-m33);this.w=(m13-m31)/s;this.x=(m12+m21)/s;this.y=.25*s;this.z=(m23+m32)/s;}else{s=2*Math.sqrt(1+m33-m11-m22);this.w=(m21-m12)/s;this.x=(m13+m31)/s;this.y=(m23+m32)/s;this.z=.25*s;}return this;}
  }
  class M4 { constructor(){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];} makeBasis(x,y,z){this.elements=[x.x,x.y,x.z,0,y.x,y.y,y.z,0,z.x,z.y,z.z,0,0,0,0,1];return this;} }
  class Color { constructor(v=0){this.v=typeof v==='number'?v:0;} getHex(){return this.v;} setHex(v){this.v=v;return this;} }
  class Obj { constructor(){this.children=[];this.parent=null;this.position=new V3();this.quaternion=new Q();this.scale=new V3(1,1,1);this.rotation={x:0,y:0,z:0};this.userData={};this.visible=true;this.name='';} add(...xs){for(const x of xs){if(x){x.parent=this;this.children.push(x);}}} remove(x){this.children=this.children.filter(c=>c!==x);} traverse(fn){fn(this);for(const c of this.children)c.traverse?c.traverse(fn):fn(c);} }
  class Scene extends Obj {}
  class Group extends Obj {}
  class Geometry { rotateX(){return this;} setAttribute(){return this;} dispose(){} }
  class Material { constructor(o={}){Object.assign(this,o);this.emissive=new Color(o.emissive||0);this.opacity=o.opacity??1;} clone(){const m=new this.constructor({...this});m.emissive=new Color(this.emissive.getHex());return m;} dispose(){} }
  class Mesh extends Obj { constructor(g=new Geometry(),m=new Material()){super();this.geometry=g;this.material=m;} }
  class Points extends Mesh {}
  class Camera extends Obj { constructor(){super();this.aspect=1;} updateProjectionMatrix(){} lookAt(){} }
  class Renderer { constructor(){this.domElement=document.createElement('canvas');this.shadowMap={};} setPixelRatio(){} setSize(){} render(){} }
  class Arrow extends Obj { constructor(){super();} setDirection(v){this.direction=v.clone?v.clone():v;} setLength(){} setColor(){} }
  class Raycaster { setFromCamera(){} intersectObjects(){return [];} }
  class Clock { getDelta(){return 1/60;} }
  window.THREE={
    Vector2:V2,Vector3:V3,Quaternion:Q,Matrix4:M4,Color,
    Scene,FogExp2:class{},PerspectiveCamera:Camera,WebGLRenderer:Renderer,
    AmbientLight:class extends Obj{},HemisphereLight:class extends Obj{},DirectionalLight:class extends Obj{constructor(){super();this.shadow={mapSize:{width:0,height:0},camera:{}};}},
    GridHelper:class extends Obj{},AxesHelper:class extends Obj{},Group,Mesh,Points,ArrowHelper:Arrow,Raycaster,Clock,
    PlaneGeometry:Geometry,BoxGeometry:Geometry,SphereGeometry:Geometry,OctahedronGeometry:Geometry,CylinderGeometry:Geometry,ConeGeometry:Geometry,TorusGeometry:Geometry,
    BufferGeometry:Geometry,BufferAttribute:class{},PointsMaterial:Material,MeshBasicMaterial:Material,MeshStandardMaterial:Material,
    PCFSoftShadowMap:1,
    MathUtils:{degToRad:d=>d*Math.PI/180,radToDeg:r=>r*180/Math.PI,clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}
  };
  class CV3 extends V3 { vadd(v,t=new CV3()){return t.set(this.x+v.x,this.y+v.y,this.z+v.z);} vsub(v,t=new CV3()){return t.set(this.x-v.x,this.y-v.y,this.z-v.z);} scale(k,t=new CV3()){return t.set(this.x*k,this.y*k,this.z*k);} cross(v,t=new CV3()){return t.set(this.y*v.z-this.z*v.y,this.z*v.x-this.x*v.z,this.x*v.y-this.y*v.x);} unit(t=new CV3()){t.copy(this);return t.normalize();} lengthSquared(){return this.lengthSq();} }
  class CQ extends Q { setFromAxisAngle(a,ang){return super.setFromAxisAngle(a,ang);} }
  class Body { constructor(o={}){this.mass=o.mass||0;this.linearDamping=o.linearDamping||0;this.angularDamping=o.angularDamping||0;this.allowSleep=o.allowSleep!==false;this.position=new CV3();this.velocity=new CV3();this.angularVelocity=new CV3();this.force=new CV3();this.torque=new CV3();this.quaternion=new CQ();this.listeners={};this.shapes=[];this.shapeOffsets=[];this.shapeOrientations=[];} addShape(shape,offset=new CV3(),orientation=new CQ()){this.shapes.push(shape);this.shapeOffsets.push(offset);this.shapeOrientations.push(orientation);} removeShape(shape){const i=this.shapes.indexOf(shape);if(i>=0){this.shapes.splice(i,1);this.shapeOffsets.splice(i,1);this.shapeOrientations.splice(i,1);}} updateMassProperties(){} updateBoundingRadius(){} addEventListener(n,f){this.listeners[n]=f;} removeEventListener(n,f){if(this.listeners[n]===f)delete this.listeners[n];} vectorToWorldFrame(v){return new CV3(v.x,v.y,v.z);} vectorToLocalFrame(v){return new CV3(v.x,v.y,v.z);} pointToWorldFrame(v){return new CV3(this.position.x+v.x,this.position.y+v.y,this.position.z+v.z);} applyForce(force){this.force.vadd(force,this.force);} }
  class World { constructor(){this.gravity=new CV3();this.solver={};this.bodies=[];this.steps=[];} addBody(body){this.bodies.push(body);} removeBody(body){this.bodies=this.bodies.filter(entry=>entry!==body);} step(dt){this.steps.push(dt);} }
  window.CANNON={Vec3:CV3,Quaternion:CQ,Body,World,Plane:class{},Box:class{constructor(halfExtents){this.halfExtents=halfExtents;}},NaiveBroadphase:class{},SAPBroadphase:class{constructor(world){this.world=world;}}};
})();
