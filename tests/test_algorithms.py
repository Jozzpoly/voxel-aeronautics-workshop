import math, json
AXES=[(1,0,0),(0,1,0),(-1,0,0),(0,-1,0),(0,0,1),(0,0,-1)]
def dot(a,b): return sum(x*y for x,y in zip(a,b))
def cross(a,b): return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def add(a,b): return tuple(x+y for x,y in zip(a,b))
def sub(a,b): return tuple(x-y for x,y in zip(a,b))
def scale(a,k): return tuple(x*k for x in a)
def length(a): return math.sqrt(dot(a,a))
def norm(a):
 l=length(a); return scale(a,1/l) if l else (0,0,0)
BASES=[]
for f in AXES:
 for u in AXES:
  if abs(dot(f,u))>1e-9: continue
  BASES.append((f,u,cross(f,u)))
assert len(BASES)==24
assert len(set(BASES))==24
for f,u,sp in BASES:
 assert abs(dot(f,u))<1e-9 and abs(dot(f,sp))<1e-9 and abs(dot(u,sp))<1e-9
 assert cross(f,u)==sp

def find(f,u):
 scores=[2*dot(b[0],f)+dot(b[1],u) for b in BASES]
 return max(range(24),key=scores.__getitem__)
def mirror(i,mx,mz):
 f=list(BASES[i][0]);u=list(BASES[i][1])
 if mx:f[0]*=-1;u[0]*=-1
 if mz:f[2]*=-1;u[2]*=-1
 return find(tuple(f),tuple(u))
def rotate90(v,axis,sign=1):
 # cardinal Rodrigues at +/-90
 a=axis
 c=0;s=sign
 av=dot(a,v)
 axv=cross(a,v)
 return tuple(round(v[i]*c+axv[i]*s+a[i]*av*(1-c)) for i in range(3))
def roll(i,sign=1):
 f,u,_=BASES[i]
 return find(f,rotate90(u,f,sign))
for i in range(24):
 j=i
 for _ in range(4):j=roll(j,1)
 assert j==i
 assert mirror(mirror(i,True,False),True,False)==i
 assert mirror(mirror(i,False,True),False,True)==i
# expected wing mirror
base=find((1,0,0),(0,1,0))
mir=mirror(base,True,False)
assert BASES[mir][0]==(-1,0,0) and BASES[mir][1]==(0,1,0)

# Mixer tests inspired by game formula
GAIN=.94
def command(torque,pilot,base,maxv):
 score=0;active=0
 for comp,key in [(0,'roll'),(1,'yaw'),(2,'pitch')]:
  p=pilot.get(key,0)
  if abs(p)>1e-4 and maxv[comp]>1e-4:
   score += p*torque[comp]/maxv[comp];active+=1
 if active>1: score/=math.sqrt(active)
 score=max(-1,min(1,score));head=(1-base) if score>=0 else base
 return max(0,min(1,base+score*head*GAIN))
# symmetric roll-producing thrusters
trs=[(10,0,0),(-10,0,0)]
maxv=(10,0,0)
for base_power in [0,.2,.7,1]:
 plus=[command(t,{'roll':1},base_power,maxv) for t in trs]
 minus=[command(t,{'roll':-1},base_power,maxv) for t in trs]
 tplus=sum(t[0]*c for t,c in zip(trs,plus))
 tminus=sum(t[0]*c for t,c in zip(trs,minus))
 assert tplus>0 and tminus<0, (base_power,plus,minus,tplus,tminus)

# Wing estimate: +X chord/+Y normal creates up lift at +X cruise; vertical chord does not.
RHO=1.12;V=(12,0,0);AREA=1.;BASE=.30;SLOPE=3.25

def wing_up(f,u):
 chord=dot(V,f);normal=dot(V,u);eff=abs(chord)
 if eff<.25:return 0
 aoa=math.atan2(-normal,eff+.15)
 cl=max(-1.45,min(1.6,BASE+aoa*SLOPE))
 q=.5*RHO*eff*eff
 vel=norm(V); proj=sub(u,scale(vel,dot(u,vel)));ld=norm(proj)
 return ld[1]*q*AREA*cl
assert wing_up((1,0,0),(0,1,0))>0
assert wing_up((0,1,0),(1,0,0))==0

# Connectivity validator order-independent
blocks={(0,0,0),(1,0,0),(2,0,0),(-1,0,0),(-2,0,0),(0,1,0)}
seen={(0,0,0)};q=[(0,0,0)]
for pos in q:
 for d in AXES:
  n=add(pos,d)
  if n in blocks and n not in seen:seen.add(n);q.append(n)
assert seen==blocks
print(json.dumps({'orientation_bases':len(BASES),'roll_cycle':'ok','mirror_involution':'ok','mixer_bidirectional':'ok','wing_orientation':'ok','connectivity':'ok'},indent=2))


# Configurable control-surface auto sign: mirrored surfaces should select opposite signs
# when their moment arms are mirrored across Z for roll control.
def torque(r, force): return cross(r, force)
left = torque((0,0,-2),(0,1,0))[0]
right = torque((0,0,2),(0,1,0))[0]
assert left == -right and left != 0

# Connectivity after a failed bridge: everything beyond the bridge must be detached.
parts={(0,0,0),(1,0,0),(2,0,0),(3,0,0),(2,1,0)}
parts.remove((1,0,0))
seen={(0,0,0)};q=[(0,0,0)]
for pos in q:
 for d in AXES:
  n=add(pos,d)
  if n in parts and n not in seen:seen.add(n);q.append(n)
assert seen == {(0,0,0)}
assert parts-seen == {(2,0,0),(3,0,0),(2,1,0)}

# Leak rises as tank health drops.
def leak(health): return .22*max(0,(.82-health)/.82)
assert leak(1)==0 and 0 < leak(.5) < leak(.1)
print(json.dumps({'control_surface_mirror':'ok','cascade_detachment':'ok','leak_curve':'ok'},indent=2))
