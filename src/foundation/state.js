(() => {
  'use strict';

  window.VAW.define(
    'foundation.state',
    ['foundation.orientation', 'foundation.craft-model', 'foundation.craft-history'],
    (orientation, CraftModel, CraftHistory) => {
      function createInitialState() {
        return {
          mode: 'BUILD',
          selectedBlock: 'Hull',
          orientation: orientation.DEFAULT_ORIENTATION,
          symmetry: 'NONE',
          controlAxis: 'pitch',
          controlSign: 0,
          craft: CraftModel.create(),
          workshop: {
            meshesByKey: new Map(),
            rootMeshes: []
          },
          flight: {
            body: null,
            group: null,
            functionalBlocks: [],
            fuel: 0,
            fuelMax: 0,
            com: new THREE.Vector3(),
            analysis: null,
            thrusterTorqueMax: new THREE.Vector3(),
            gyroCount: 0,
            blockCount: 0,
            dragArea: 0,
            lastLoads: { lift: 0, drag: 0, thrust: 0, impact: 0 },
            outOfFuel: false,
            severeImpact: false,
            integrity: 100,
            maxImpact: 0,
            lowestLocalY: -0.5,
            runtimeMass: 0,
            payloadMass: 0,
            lastImpactAt: -Infinity,
            runtimeParts: [],
            debris: [],
            lostParts: 0,
            leakingFuelRate: 0,
            firstFailure: '',
            structuralFailures: 0,
            initialHealth: 0,
            gyroAuthority: 0,
            payloadLocalPos: null,
            payload: null,
            pendingImpacts: [],
            runtimePartByKey: new Map(),
            metricsDirty: true,
            structuralAccumulator: 0
          },
          camera: {
            target: new THREE.Vector3(0, 0.5, 0),
            yaw: Math.PI * 0.25,
            pitch: Math.PI * 0.33,
            distance: 18,
            defaultTarget: new THREE.Vector3(0, 0.5, 0),
            defaultYaw: Math.PI * 0.25,
            defaultPitch: Math.PI * 0.33,
            defaultDistance: 18
          },
          input: {
            pointerInside: false,
            pointerNDC: new THREE.Vector2(),
            activePointers: new Map(),
            orbitDrag: false,
            dragStartX: 0,
            dragStartY: 0,
            downButton: -1,
            downMoved: false,
            pinchStartDistance: 0,
            pinchStartCameraDistance: 18,
            pinchStartCenterX: 0,
            pinchStartCenterY: 0,
            touchAction: 'place',
            controlActions: new Set()
          },
          history: CraftHistory.create(),
          career: {
            credits: 0,
            selectedContractId: 'hover_license',
            completed: {},
            best: {},
            totalStars: 0
          },
          mission: {
            contractId: null,
            active: false,
            paused: false,
            status: 'IDLE',
            elapsed: 0,
            phase: 0,
            gateIndex: 0,
            holdTime: 0,
            landingHold: 0,
            lastGroundContact: -Infinity,
            maxAltitude: 0,
            maxSpeed: 0,
            maxImpact: 0,
            startFuel: 0,
            result: null,
            markers: [],
            previousPosition: null,
            helpPaused: false
          },
          thrusterPower: 0.7,
          balloonPower: 0.7,
          stabilityAssist: 0.18,
          pilot: { pitch: 0, yaw: 0, roll: 0, stabilize: false },
          uiCollapsed: false,
          contractPanelCollapsed: true,
          statusText: 'DRYDOCK',
          hovered: {
            valid: false,
            kind: null,
            pos: new THREE.Vector3(),
            normal: new THREE.Vector3(0, 1, 0),
            root: null
          }
        };
      }

      return { createInitialState };
    }
  );
})();
