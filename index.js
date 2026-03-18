import * as THREE from 'three';
import GUI from 'lil-gui';

// AR Configuration - adjust these values easily!
const AR_CONFIG = {
    // City settings
    cityDistance: 4.0,          // How far cities are from viewer (meters)
    citySpacing: 1.5,           // Distance between cities
    citySize: 0.12,             // Size of city buildings
    cityColor: 0x4a5a6a,        // Bluish-gray color for cities

    // Procedural city settings
    proceduralCities: true,     // true = procedural destructible cities, false = original simple blocks
    cityHealth: 5,              // Hits to destroy (only when proceduralCities = true)
    cityVoxelSize: 0.025,       // Smaller voxels for procedural cities
    cityLength: 40,             // Voxels along X axis
    cityMaxHeight: 12,          // Max building height in voxels
    cityDepth: 4,               // Voxels along Z axis

    // Missile spawn settings
    missileSpawnHeight: 5.0,    // How high missiles spawn above viewer
    missileSpawnDistance: 2.2,  // How far back missiles spawn
    missileSpawnWidth: 4.0,     // Horizontal spread of missile spawns

    // Crosshair settings
    crosshairDistance: 2.1,     // How far crosshair plane is from viewer
    crosshairSize: 0.25,        // Size of crosshair (radius)
    crosshairVoxelSize: 0.04,   // Size of crosshair voxels
    crosshairColor: 0x00ff00,   // Bright green

    // Missile settings
    enemyMissileSpeed: 1.0,     // Speed of incoming missiles
    enemyMissileColor: 0xff0000, // Red
    enemyMissileSize: 0.03,     // Size of enemy missile voxels

    defenseMissileSpeed: 3.5,   // Speed of defense missiles (faster to intercept)
    defenseMissileColor: 0xcce0ff, // light blue
    defenseMissileSize: 0.03,   // Size of defense missile voxels
    defenseLaunchDistance: 2.2, // Where defense missiles launch from (close to viewer)

    // Explosion settings
    explosionRadius: 0.5,       // How big explosions get (X/Y radius)
    explosionDepth: 5.0,        // How far explosions extend in Z direction (depth)
    explosionDuration: 1.0      // How long explosions last
};

// Game State
const gameState = {
    score: 0,
    cities: 6,
    ammo: 30,
    gameStarted: false,
    inVR: false
};

// Scene Setup
const scene = new THREE.Scene();
// Set background for desktop, will be transparent in AR
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.Fog(0x000020, 10, 50);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 0); // Standing height for VR

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true // Required for AR passthrough
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.xr.enabled = true;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 1, 100);
pointLight.position.set(0, 5, 0);
scene.add(pointLight);

// Game Objects
const missiles = [];
const defenseMissiles = [];
const explosions = [];
const cities = [];
const voxels = [];

// Voxel Helper - Creates blocky 3D pixel look
function createVoxel(color, size = 0.05) {
    const geometry = new THREE.BoxGeometry(size, size, size);
    const material = new THREE.MeshLambertMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.3
    });
    return new THREE.Mesh(geometry, material);
}

// Create Living Room Environment
function createLivingRoom() {
    // Floor
    const floorGeometry = new THREE.PlaneGeometry(10, 10);
    const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    scene.add(floor);

    // Walls with voxel texture
    function createVoxelWall(width, height, x, y, z, rotY = 0) {
        const wall = new THREE.Group();
        const voxelSize = 0.2;
        const cols = Math.floor(width / voxelSize);
        const rows = Math.floor(height / voxelSize);

        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                if (Math.random() > 0.3) { // Sparse voxels
                    const voxel = createVoxel(0x1a1a1a + Math.random() * 0x202020, voxelSize * 0.8);
                    voxel.position.set(
                        (i - cols / 2) * voxelSize,
                        j * voxelSize,
                        0
                    );
                    wall.add(voxel);
                }
            }
        }
        wall.position.set(x, y, z);
        wall.rotation.y = rotY;
        return wall;
    }

    scene.add(createVoxelWall(10, 3, 0, 1.5, -5, 0)); // Back wall

    // Couch (voxel style)
    const couchGroup = new THREE.Group();
    for (let x = -0.8; x <= 0.8; x += 0.1) {
        for (let y = 0; y <= 0.4; y += 0.1) {
            for (let z = -0.3; z <= 0.3; z += 0.1) {
                const voxel = createVoxel(0x4a4a6a, 0.08);
                voxel.position.set(x, y, z);
                couchGroup.add(voxel);
            }
        }
    }
    couchGroup.position.set(-2, 0.2, -3);
    scene.add(couchGroup);

    // TV/Monitor Stand
    const tvGroup = new THREE.Group();
    for (let x = -0.5; x <= 0.5; x += 0.08) {
        for (let y = 0; y <= 1.2; y += 0.08) {
            const voxel = createVoxel(y > 0.3 ? 0x111111 : 0x3a3a3a, 0.07);
            voxel.position.set(x, y, 0);
            tvGroup.add(voxel);
        }
    }
    tvGroup.position.set(2.5, 0, -3.5);
    scene.add(tvGroup);

    // Game Screen Area (where game takes place)
    const screenGeometry = new THREE.PlaneGeometry(4, 3);
    const screenMaterial = new THREE.MeshBasicMaterial({
        color: 0x000a1a,
        transparent: true,
        opacity: 0.3
    });
    const screen = new THREE.Mesh(screenGeometry, screenMaterial);
    screen.position.set(0, 2, -4);
    scene.add(screen);
}

// Create Cities (voxel style) - positioned for AR
function createCities() {
    // Clear existing cities
    cities.forEach(city => scene.remove(city.mesh));
    cities.length = 0;

    const spacing = AR_CONFIG.citySpacing;
    const cityPositions = [
        -spacing, -spacing * 0.6, -spacing * 0.2,
        spacing * 0.2, spacing * 0.6, spacing
    ];

    if (!AR_CONFIG.proceduralCities) {
        // Original simple block cities (1-hit kill)
        cityPositions.forEach((x, index) => {
            const cityGroup = new THREE.Group();
            const size = AR_CONFIG.citySize;
            const voxelSize = 0.04;
            for (let bx = -size; bx <= size; bx += voxelSize) {
                for (let by = 0; by <= size * 2.5; by += voxelSize) {
                    for (let bz = -size; bz <= size; bz += voxelSize) {
                        const voxel = createVoxel(AR_CONFIG.cityColor, 0.038);
                        voxel.position.set(bx, by, bz);
                        cityGroup.add(voxel);
                    }
                }
            }
            cityGroup.position.set(x, 0.1, -AR_CONFIG.cityDistance);
            scene.add(cityGroup);
            cities.push({ mesh: cityGroup, alive: true, index });
        });
    } else {
        // Procedural destructible cities
        cityPositions.forEach((x, index) => {
            const cityGroup = new THREE.Group();
            const vs = AR_CONFIG.cityVoxelSize;
            const cityVoxels = [];
            const baseColor = new THREE.Color(AR_CONFIG.cityColor);
            const totalWidth = AR_CONFIG.cityLength;
            const maxH = AR_CONFIG.cityMaxHeight;
            const depth = AR_CONFIG.cityDepth;

            // Accent colors for windows (cyberpunk neon)
            const accentColors = [0x00ffff, 0xff00ff, 0x00ff88];

            // Generate buildings by walking along X
            let xPos = 0;
            while (xPos < totalWidth) {
                const bWidth = 3 + Math.floor(Math.random() * 6); // 3-8 voxels wide
                const bHeight = 3 + Math.floor(Math.random() * (maxH - 3 + 1)); // 3-maxH
                const gap = 1 + Math.floor(Math.random() * 2); // 1-2 voxel gap

                if (xPos + bWidth > totalWidth) break;

                const accentColor = accentColors[Math.floor(Math.random() * accentColors.length)];

                for (let bx = 0; bx < bWidth; bx++) {
                    for (let by = 0; by < bHeight; by++) {
                        for (let bz = 0; bz < depth; bz++) {
                            // Window cutouts: on front/back face, regular grid pattern
                            const isFace = (bz === 0 || bz === depth - 1);
                            const isWindowSlot = isFace && by > 0 && by < bHeight - 1 &&
                                bx > 0 && bx < bWidth - 1 &&
                                by % 2 === 1 && bx % 2 === 1;

                            let color;
                            if (isWindowSlot) {
                                // Lit window - bright accent
                                if (Math.random() > 0.3) {
                                    color = accentColor;
                                } else {
                                    continue; // dark window = skip voxel
                                }
                            } else {
                                // Building wall - slight color variation
                                const variation = 0.85 + Math.random() * 0.3;
                                color = baseColor.clone().multiplyScalar(variation);
                            }

                            const voxel = createVoxel(color, vs * 0.95);
                            if (isWindowSlot) {
                                voxel.material.emissiveIntensity = 0.8;
                            }
                            const px = (xPos + bx - totalWidth / 2) * vs;
                            const py = by * vs;
                            const pz = (bz - depth / 2) * vs;
                            voxel.position.set(px, py, pz);
                            cityGroup.add(voxel);
                            cityVoxels.push(voxel);
                        }
                    }
                }

                xPos += bWidth + gap;
            }

            cityGroup.position.set(x, 0.1, -AR_CONFIG.cityDistance);
            scene.add(cityGroup);
            cities.push({
                mesh: cityGroup,
                alive: true,
                index,
                health: AR_CONFIG.cityHealth,
                voxels: cityVoxels
            });
        });
    }

    gameState.cities = 6;
    updateUI();
}

// Missile Class
class Missile {
    constructor(startPos, targetPos, speed, color, voxelSize, isDefense = false) {
        this.group = new THREE.Group();

        // Create voxel trail with gradient
        for (let i = 0; i < 5; i++) {
            let voxelColor;

            if (isDefense) {
                // Defense missiles: regular, white, then darker shades
                if (i === 0) {
                    voxelColor = color; // Regular green
                } else if (i === 1) {
                    voxelColor = 0xffffff; // White
                } else {
                    // Darker shades from white to dark
                    const brightness = 1.0 - ((i - 1) / 4) * 0.7;
                    voxelColor = new THREE.Color(brightness, brightness, brightness);
                }
            } else {
                // Enemy missiles: brightest first, then darker
                const brightness = 1.0 - (i / 5) * 0.6;
                voxelColor = new THREE.Color(color).multiplyScalar(brightness);
            }

            const voxel = createVoxel(voxelColor, voxelSize);
            voxel.position.z = -i * 0.05;
            this.group.add(voxel);
        }

        this.group.position.copy(startPos);
        this.target = targetPos.clone();
        this.speed = speed;
        this.alive = true;
        this.isDefense = isDefense;
        this.color = color;

        // Calculate direction
        this.direction = new THREE.Vector3().subVectors(targetPos, startPos).normalize();

        // Point toward target
        this.group.lookAt(targetPos);

        scene.add(this.group);
    }

    update(deltaTime) {
        if (!this.alive) return;

        this.group.position.addScaledVector(this.direction, this.speed * deltaTime);

        // Check if reached target
        if (this.group.position.distanceTo(this.target) < 0.1) {
            this.explode();
        }

        // Remove if too far
        if (this.group.position.length() > 50) {
            this.alive = false;
            scene.remove(this.group);
        }
    }

    explode() {
        this.alive = false;
        scene.remove(this.group);
        createExplosion(this.group.position.clone(), this.color);
        playSound('explosion');
    }
}

// Explosion Class
class Explosion {
    constructor(position, color, particleCount = 40, radius = AR_CONFIG.explosionRadius) {
        this.group = new THREE.Group();
        this.particles = [];
        this.maxRadius = radius;
        this.currentRadius = 0;
        this.expandSpeed = 2;
        this.life = AR_CONFIG.explosionDuration;
        this.position = position.clone();

        // Create expanding voxel sphere - uniformly distributed in 3D
        for (let i = 0; i < particleCount; i++) {
            const voxel = createVoxel(color, 0.05);

            // Use Fibonacci sphere for uniform distribution
            const phi = Math.acos(1 - 2 * (i + 0.5) / particleCount);
            const theta = Math.PI * (1 + Math.sqrt(5)) * i;

            voxel.userData = {
                phi,
                theta,
                speed: 0.6 + Math.random() * 1.2
            };
            this.group.add(voxel);
            this.particles.push(voxel);
        }

        this.group.position.copy(position);
        scene.add(this.group);
    }

    update(deltaTime) {
        this.life -= deltaTime * 0.8;
        this.currentRadius += this.expandSpeed * deltaTime;

        this.particles.forEach(particle => {
            const { phi, theta, speed } = particle.userData;
            const r = this.currentRadius * speed;

            // Full 3D spherical expansion using spherical coordinates
            // phi = polar angle (0 to π), theta = azimuthal angle
            particle.position.set(
                r * Math.sin(phi) * Math.cos(theta),  // X
                r * Math.sin(phi) * Math.sin(theta),  // Y
                r * Math.cos(phi)                      // Z (towards/away from viewer)
            );
            particle.material.opacity = Math.max(0, this.life);
        });

        if (this.life <= 0) {
            scene.remove(this.group);
            return false;
        }
        return true;
    }
}

function createExplosion(position, color) {
    const explosion = new Explosion(position, color);
    explosions.push(explosion);
}

// Damage a procedural city at a given impact position
function damageCityAt(city, impactPosition) {
    if (!city.alive) return;

    city.health -= 1;

    // Convert impact position to city-local space
    const localImpact = city.mesh.worldToLocal(impactPosition.clone());
    // Blast radius scaled to city voxel size — destroy a cluster of nearby voxels
    const blastRadius = AR_CONFIG.cityVoxelSize * 5;

    for (let i = city.voxels.length - 1; i >= 0; i--) {
        const voxel = city.voxels[i];
        if (voxel.position.distanceTo(localImpact) < blastRadius) {
            city.mesh.remove(voxel);
            voxel.geometry.dispose();
            voxel.material.dispose();
            city.voxels.splice(i, 1);
        }
    }

    // Spawn a small explosion at impact point
    const explosion = new Explosion(impactPosition.clone(), AR_CONFIG.cityColor, 15, blastRadius * 2);
    explosions.push(explosion);

    if (city.health <= 0 || city.voxels.length === 0) {
        city.alive = false;
        scene.remove(city.mesh);
        gameState.cities--;
        updateUI();
        if (gameState.cities <= 0) gameOver();
    }
}

// Spawn Enemy Missile - adjusted for AR space with vertical drop
function spawnEnemyMissile() {
    if (!gameState.gameStarted) return;

    // Use surface position if placed in AR, otherwise use defaults
    const baseX = surfacePlaced ? surfacePosition.x : 0;
    const baseY = surfacePlaced ? surfacePosition.y : 0;
    const baseZ = surfacePlaced ? surfacePosition.z : -AR_CONFIG.cityDistance;

    const startX = baseX + (Math.random() - 0.5) * AR_CONFIG.missileSpawnWidth;
    const startY = baseY + AR_CONFIG.missileSpawnHeight;
    const startZ = baseZ - AR_CONFIG.missileSpawnDistance; // Spawn behind the cities
    const startPos = new THREE.Vector3(startX, startY, startZ);

    // Target random city or ground
    let targetX, targetY, targetZ;
    if (cities.length > 0 && Math.random() > 0.3) {
        const aliveCities = cities.filter(c => c.alive);
        if (aliveCities.length > 0) {
            const aliveCity = aliveCities[Math.floor(Math.random() * aliveCities.length)];
            targetX = aliveCity.mesh.position.x;
            targetY = aliveCity.mesh.position.y;
            targetZ = aliveCity.mesh.position.z;
        } else {
            targetX = (Math.random() - 0.5) * AR_CONFIG.citySpacing * 2;
            targetY = baseY;
            targetZ = baseZ;
        }
    } else {
        targetX = (Math.random() - 0.5) * AR_CONFIG.citySpacing * 2;
        targetY = baseY;
        targetZ = baseZ;
    }

    const targetPos = new THREE.Vector3(targetX, targetY, targetZ);
    const missile = new Missile(
        startPos,
        targetPos,
        AR_CONFIG.enemyMissileSpeed,
        AR_CONFIG.enemyMissileColor,
        AR_CONFIG.enemyMissileSize,
        false
    );
    missiles.push(missile);

    playSound('enemyMissile');
}

// Fire Defense Missile - from player position in AR
function fireDefenseMissile(targetPos) {
    if (gameState.ammo <= 0 || !gameState.gameStarted) return;

    gameState.ammo--;
    updateUI();

    const startPos = new THREE.Vector3(0, 0.5, -AR_CONFIG.defenseLaunchDistance);
    const missile = new Missile(
        startPos,
        targetPos,
        AR_CONFIG.defenseMissileSpeed,
        AR_CONFIG.defenseMissileColor,
        AR_CONFIG.defenseMissileSize,
        true
    );
    defenseMissiles.push(missile);

    playSound('playerFire');
}

// Collision Detection
function checkCollisions() {
    // Check defense explosions vs enemy missiles
    explosions.forEach(explosion => {
        if (explosion.life < 0.5) return; // Only active explosions

        missiles.forEach(missile => {
            if (!missile.alive || missile.isDefense) return;

            const missilePos = missile.group.position;
            const explPos = explosion.position;

            // Check X/Y distance (sphere)
            const dx = missilePos.x - explPos.x;
            const dy = missilePos.y - explPos.y;
            const xyDistance = Math.sqrt(dx * dx + dy * dy);

            // Check Z distance separately
            const dz = Math.abs(missilePos.z - explPos.z);

            // Hit if within X/Y radius AND within Z depth
            if (xyDistance < explosion.maxRadius && dz < AR_CONFIG.explosionDepth) {
                missile.explode();
                gameState.score += 100;
                updateUI();
            }
        });
    });

    // Check enemy missiles hitting cities
    missiles.forEach(missile => {
        if (!missile.alive || missile.isDefense) return;

        cities.forEach(city => {
            if (!city.alive) return;

            if (!AR_CONFIG.proceduralCities) {
                // Original logic: 1-hit kill using distance to center
                const dist = missile.group.position.distanceTo(city.mesh.position);
                if (dist < 0.3) {
                    missile.explode();
                    city.alive = false;
                    scene.remove(city.mesh);
                    gameState.cities--;
                    updateUI();
                    if (gameState.cities <= 0) gameOver();
                }
            } else {
                // Procedural cities: check against bounding box
                const missilePos = missile.group.position;
                const cityPos = city.mesh.position;
                const vs = AR_CONFIG.cityVoxelSize;
                const halfWidth = (AR_CONFIG.cityLength / 2) * vs;
                const height = AR_CONFIG.cityMaxHeight * vs;
                const halfDepth = (AR_CONFIG.cityDepth / 2) * vs;
                const margin = 0.05; // small hit margin

                const dx = missilePos.x - cityPos.x;
                const dy = missilePos.y - cityPos.y;
                const dz = missilePos.z - cityPos.z;

                if (Math.abs(dx) < halfWidth + margin &&
                    dy > -margin && dy < height + margin &&
                    Math.abs(dz) < halfDepth + margin) {
                    missile.explode();
                    damageCityAt(city, missilePos.clone());
                }
            }
        });
    });
}

// Crosshair/Targeting - positioned for AR
const crosshair = new THREE.Group();
function createCrosshair() {
    const lineLength = AR_CONFIG.crosshairSize;
    const voxelSize = AR_CONFIG.crosshairVoxelSize;

    // Create cross lines - 4 arms
    for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI / 2);
        // Create multiple voxels along each arm for thickness
        for (let dist = lineLength * 0.3; dist <= lineLength; dist += voxelSize * 1.5) {
            const voxel = createVoxel(AR_CONFIG.crosshairColor, voxelSize);
            voxel.position.set(
                Math.cos(angle) * dist,
                Math.sin(angle) * dist,
                0
            );
            crosshair.add(voxel);
        }
    }

    // Add center dot
    const centerDot = createVoxel(AR_CONFIG.crosshairColor, voxelSize * 1.5);
    crosshair.add(centerDot);

    crosshair.position.set(0, 2.0, -AR_CONFIG.crosshairDistance);
    scene.add(crosshair);
}

// Hand Tracking and Controller Setup for VR
let handModels = {};
let controllers = [];

function setupHandTracking() {
    const hand1 = renderer.xr.getHand(0);
    const hand2 = renderer.xr.getHand(1);

    // Simple hand representation
    const handGeometry = new THREE.SphereGeometry(0.05);
    const handMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });

    const handMesh1 = new THREE.Mesh(handGeometry, handMaterial);
    const handMesh2 = new THREE.Mesh(handGeometry, handMaterial);

    hand1.add(handMesh1);
    hand2.add(handMesh2);

    scene.add(hand1);
    scene.add(hand2);

    // Setup controllers
    const controller1 = renderer.xr.getController(0);
    const controller2 = renderer.xr.getController(1);

    controller1.addEventListener('select', onSelectStart);
    controller2.addEventListener('select', onSelectStart);

    scene.add(controller1);
    scene.add(controller2);

    controllers = [controller1, controller2];
    handModels = { hand1, hand2, mesh1: handMesh1, mesh2: handMesh2 };
}

function onSelectStart(event) {
    if (gameState.inVR && !surfacePlaced && reticle.visible) {
        // Place game on surface - use reticle's world position
        reticle.getWorldPosition(surfacePosition);
        surfacePlaced = true;
        reticle.visible = false;

        // Reposition cities on the surface, spread out from the placed position
        const spacing = AR_CONFIG.citySpacing;
        const cityPositions = [
            -spacing, -spacing * 0.6, -spacing * 0.2,
            spacing * 0.2, spacing * 0.6, spacing
        ];

        cities.forEach((cityData, i) => {
            cityData.mesh.position.x = surfacePosition.x + cityPositions[i];
            cityData.mesh.position.y = surfacePosition.y + 0.1;
            cityData.mesh.position.z = surfacePosition.z;
        });

        // Position crosshair relative to surface
        crosshair.position.set(
            surfacePosition.x,
            surfacePosition.y + 1.0,
            surfacePosition.z
        );

        // Update AR UI position relative to surface
        if (arUI) {
            arUI.position.set(
                surfacePosition.x - 1.5,
                surfacePosition.y + 2.5,
                surfacePosition.z
            );
        }

        // Start game
        if (!gameState.gameStarted) {
            startGame();
        }

        debugLog('Game placed at surface position');
    } else if (!gameState.gameStarted) {
        startGame();
        document.getElementById('instructions').style.display = 'none';
    } else {
        fireDefenseMissile(targetPosition);
    }
}

// Input Handling
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let targetPosition = new THREE.Vector3(0, 2, -3.8);

window.addEventListener('mousemove', (event) => {
    if (gameState.inVR) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Raycast to game plane (adjusted for AR)
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), AR_CONFIG.crosshairDistance);
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersection);

    if (intersection) {
        targetPosition.copy(intersection);
        crosshair.position.copy(intersection);
        crosshair.position.z = -AR_CONFIG.crosshairDistance;
    }
});

window.addEventListener('click', (event) => {
    // Only fire missiles if game is started, not in VR, and not clicking UI elements
    if (gameState.gameStarted && !gameState.inVR) {
        // Don't fire if clicking on GUI or buttons
        if (event.target.tagName !== 'BUTTON' && !event.target.closest('.lil-gui')) {
            fireDefenseMissile(targetPosition);
        }
    }
});

// Start game button
document.getElementById('start-game').addEventListener('click', () => {
    if (!gameState.gameStarted) {
        startGame();
        document.getElementById('instructions').style.display = 'none';
        document.getElementById('start-game').style.display = 'none';
    }
});

// VR Input
function handleVRInput() {
    if (!renderer.xr.isPresenting) {
        crosshair.visible = true;
        return;
    }

    let foundTarget = false;

    // Try controllers first
    for (const controller of controllers) {
        if (controller && controller.visible) {
            const controllerPos = new THREE.Vector3();
            controller.getWorldPosition(controllerPos);

            const controllerDir = new THREE.Vector3(0, 0, -1);
            controllerDir.applyQuaternion(controller.quaternion);

            const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), AR_CONFIG.crosshairDistance);
            const intersection = new THREE.Vector3();
            const ray = new THREE.Ray(controllerPos, controllerDir);

            if (ray.intersectPlane(plane, intersection)) {
                crosshair.position.copy(intersection);
                crosshair.position.z = -AR_CONFIG.crosshairDistance;
                targetPosition.copy(intersection);
                crosshair.visible = true;
                foundTarget = true;
                break;
            }
        }
    }

    // If no controller, try hands
    if (!foundTarget) {
        const hand1 = handModels.hand1;

        if (hand1 && hand1.visible) {
            const handPos = new THREE.Vector3();
            hand1.getWorldPosition(handPos);

            // Point from hand position to game area
            const direction = new THREE.Vector3().subVectors(handPos, camera.position).normalize();
            const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), AR_CONFIG.crosshairDistance);
            const intersection = new THREE.Vector3();
            const ray = new THREE.Ray(camera.position, direction);

            if (ray.intersectPlane(plane, intersection)) {
                crosshair.position.copy(intersection);
                crosshair.position.z = -AR_CONFIG.crosshairDistance;
                targetPosition.copy(intersection);
                crosshair.visible = true;
                foundTarget = true;
            }
        }
    }

    // Fallback: follow head gaze
    if (!foundTarget) {
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);

        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), AR_CONFIG.crosshairDistance);
        const intersection = new THREE.Vector3();
        const ray = new THREE.Ray(camera.position, cameraDirection);

        if (ray.intersectPlane(plane, intersection)) {
            crosshair.position.copy(intersection);
            crosshair.position.z = -AR_CONFIG.crosshairDistance;
            targetPosition.copy(intersection);
            crosshair.visible = true;
        }
    }
}

// Sound System (placeholder - will use Web Audio API for arcade sounds)
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    switch(type) {
        case 'playerFire':
            oscillator.frequency.value = 800;
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
            break;
        case 'explosion':
            oscillator.frequency.value = 100;
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
            break;
        case 'enemyMissile':
            oscillator.frequency.value = 1200;
            gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.05);
            break;
    }
}

// 3D UI for AR mode
let arUI = null;

function createARUI() {
    if (arUI) return;

    const group = new THREE.Group();

    // Create canvas for text
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Function to update the canvas
    function updateARUICanvas() {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.font = '24px "Press Start 2P"';
        ctx.fillStyle = '#00ff00';
        ctx.textAlign = 'left';

        ctx.fillText(`SCORE: ${gameState.score}`, 20, 60);
        ctx.fillText(`CITIES: ${gameState.cities}`, 20, 120);
        ctx.fillText(`AMMO: ${gameState.ammo}`, 20, 180);

        texture.needsUpdate = true;
    }

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide
    });
    const geometry = new THREE.PlaneGeometry(1, 0.5);
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(-1.5, 2.5, -3);
    group.add(mesh);

    group.userData.updateCanvas = updateARUICanvas;
    updateARUICanvas();

    arUI = group;
    scene.add(arUI);
}

function updateARUI() {
    if (arUI && arUI.userData.updateCanvas) {
        arUI.userData.updateCanvas();
    }
}

// UI Updates
function updateUI() {
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('cities').textContent = gameState.cities;
    document.getElementById('ammo').textContent = gameState.ammo;

    // Update AR UI if in VR mode
    if (gameState.inVR) {
        updateARUI();
    }
}

// Game Loop
let lastTime = 0;
let missileSpawnTimer = 0;
const missileSpawnInterval = 2.0;

function animate(time) {
    const deltaTime = (time - lastTime) / 1000;
    lastTime = time;

    // Handle AR hit-testing for surface placement
    if (renderer.xr.isPresenting) {
        const session = renderer.xr.getSession();
        const frame = renderer.xr.getFrame();

        if (frame) {
            // Request hit test source if not done yet
            if (!hitTestSourceRequested && session) {
                session.requestReferenceSpace('viewer').then((referenceSpace) => {
                    session.requestHitTestSource({ space: referenceSpace }).then((source) => {
                        hitTestSource = source;
                    });
                });
                hitTestSourceRequested = true;
            }

            // Perform hit test if surface not placed yet
            if (hitTestSource && !surfacePlaced) {
                const hitTestResults = frame.getHitTestResults(hitTestSource);
                if (hitTestResults.length > 0) {
                    const hit = hitTestResults[0];
                    const referenceSpace = renderer.xr.getReferenceSpace();
                    const hitPose = hit.getPose(referenceSpace);

                    if (hitPose) {
                        reticle.visible = true;
                        reticle.matrix.fromArray(hitPose.transform.matrix);
                    }
                }
            }
        }
    }

    if (gameState.gameStarted) {
        // Spawn enemy missiles
        missileSpawnTimer += deltaTime;
        if (missileSpawnTimer > missileSpawnInterval) {
            spawnEnemyMissile();
            missileSpawnTimer = 0;
        }

        // Update missiles
        missiles.forEach((missile, index) => {
            missile.update(deltaTime);
            if (!missile.alive) {
                missiles.splice(index, 1);
            }
        });

        defenseMissiles.forEach((missile, index) => {
            missile.update(deltaTime);
            if (!missile.alive) {
                defenseMissiles.splice(index, 1);
            }
        });

        // Update explosions
        for (let i = explosions.length - 1; i >= 0; i--) {
            if (!explosions[i].update(deltaTime)) {
                explosions.splice(i, 1);
            }
        }

        checkCollisions();
    }

    handleVRInput();

    // Rotate crosshair
    crosshair.rotation.z += deltaTime * 2;

    renderer.render(scene, camera);
}

function startGame() {
    gameState.gameStarted = true;
    gameState.score = 0;
    gameState.cities = 6;
    gameState.ammo = 30;
    updateUI();
}

function gameOver() {
    gameState.gameStarted = false;
    alert('GAME OVER! Score: ' + gameState.score);
    location.reload();
}

// AR Button Setup
const vrButton = document.getElementById('enter-vr');
const debugDiv = document.getElementById('debug');

function debugLog(msg) {
    console.log(msg);
    if (debugDiv) {
        debugDiv.innerHTML += msg + '<br>';
    }
}

let hitTestSource = null;
let hitTestSourceRequested = false;
let surfacePlaced = false;
let surfacePosition = new THREE.Vector3(0, 0, -4);
let reticle = null;

// Create reticle for surface placement
function createReticle() {
    const geometry = new THREE.RingGeometry(0.15, 0.2, 32);
    geometry.rotateX(-Math.PI / 2); // Rotate to lie flat on ground
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
    reticle = new THREE.Mesh(geometry, material);
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);
}

async function startARSession() {
    if (renderer.xr.isPresenting) return;

    debugLog('Starting AR session...');
    try {
        const session = await navigator.xr.requestSession('immersive-ar', {
            requiredFeatures: ['hit-test'],
            optionalFeatures: ['hand-tracking', 'bounded-floor', 'local-floor']
        });

        debugLog('AR session created');

        // Set background to null for AR passthrough
        scene.background = null;

        await renderer.xr.setSession(session);
        gameState.inVR = true;
        surfacePlaced = false;

        // Hide UI elements in AR
        document.getElementById('ui').style.display = 'none';
        document.getElementById('debug').style.display = 'none';
        document.getElementById('instructions').style.display = 'none';
        document.getElementById('start-game').style.display = 'none';

        setupHandTracking();
        createARUI();

        debugLog('AR session started successfully');
        debugLog('Tap a surface to place the game');

        // Listen for session end
        session.addEventListener('end', () => {
            debugLog('AR session ended');
            gameState.inVR = false;
            scene.background = new THREE.Color(0x000000);
            document.getElementById('ui').style.display = 'block';
            surfacePlaced = false;
            hitTestSource = null;
            hitTestSourceRequested = false;
            if (reticle) reticle.visible = false;
            if (arUI) {
                scene.remove(arUI);
                arUI = null;
            }
        });

    } catch(error) {
        debugLog('AR Error: ' + error.message);
        console.error('Failed to start AR session:', error);
        alert('AR Error: ' + error.message);
    }
}

debugLog('Checking WebXR support...');
debugLog('navigator.xr exists: ' + ('xr' in navigator));
debugLog('navigator.gpu exists: ' + ('gpu' in navigator));

// Check WebGPU support
if ('gpu' in navigator) {
    debugLog('WebGPU is available');
} else {
    debugLog('WebGPU not available (not required but recommended)');
}

if ('xr' in navigator) {
    debugLog('Checking immersive-ar support...');
    navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
        debugLog('immersive-ar supported: ' + supported);
        if (supported) {
            vrButton.style.display = 'block';
            vrButton.textContent = 'ENTER AR';
            vrButton.addEventListener('click', startARSession);
            debugLog('AR button shown');
        } else {
            debugLog('AR not supported, button hidden');
            vrButton.style.display = 'none';
        }
    }).catch(err => {
        debugLog('Error checking AR: ' + err.message);
        console.error('Error checking AR support:', err);
    });
} else {
    debugLog('WebXR not available');
    vrButton.style.display = 'none';
}

// Window Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize - Don't create virtual room for AR passthrough
createCities();
createCrosshair();
createReticle();

// Non-VR camera position
camera.position.set(0, 2, 0);

// Setup GUI for AR_CONFIG
const gui = new GUI();
gui.title('AR Config');

// City settings folder
const cityFolder = gui.addFolder('Cities');
cityFolder.add(AR_CONFIG, 'proceduralCities').name('Procedural').onChange(() => {
    createCities();
});
cityFolder.add(AR_CONFIG, 'cityHealth', 1, 20, 1).name('Health');
cityFolder.add(AR_CONFIG, 'cityDistance', 1, 10, 0.1).name('Distance').onChange(() => {
    cities.forEach((cityData, i) => {
        cityData.mesh.position.z = -AR_CONFIG.cityDistance;
    });
});
cityFolder.add(AR_CONFIG, 'citySpacing', 0.5, 3, 0.1).name('Spacing');
cityFolder.add(AR_CONFIG, 'citySize', 0.05, 0.3, 0.01).name('Size');
cityFolder.addColor(AR_CONFIG, 'cityColor').name('Color');

// Missile spawn folder
const spawnFolder = gui.addFolder('Missile Spawns');
spawnFolder.add(AR_CONFIG, 'missileSpawnHeight', 2, 10, 0.5).name('Height');
spawnFolder.add(AR_CONFIG, 'missileSpawnDistance', 2, 10, 0.5).name('Distance');
spawnFolder.add(AR_CONFIG, 'missileSpawnWidth', 2, 8, 0.5).name('Width');

// Crosshair folder
const crosshairFolder = gui.addFolder('Crosshair');
crosshairFolder.add(AR_CONFIG, 'crosshairDistance', 1, 6, 0.1).name('Distance');
crosshairFolder.add(AR_CONFIG, 'crosshairSize', 0.1, 0.5, 0.01).name('Size');
crosshairFolder.add(AR_CONFIG, 'crosshairVoxelSize', 0.01, 0.1, 0.01).name('Voxel Size');
crosshairFolder.addColor(AR_CONFIG, 'crosshairColor').name('Color');

// Missile settings folder
const missileFolder = gui.addFolder('Missiles');
missileFolder.add(AR_CONFIG, 'enemyMissileSpeed', 0.5, 3, 0.1).name('Enemy Speed');
missileFolder.addColor(AR_CONFIG, 'enemyMissileColor').name('Enemy Color');
missileFolder.add(AR_CONFIG, 'enemyMissileSize', 0.01, 0.1, 0.01).name('Enemy Size');
missileFolder.add(AR_CONFIG, 'defenseMissileSpeed', 1, 8, 0.5).name('Defense Speed');
missileFolder.addColor(AR_CONFIG, 'defenseMissileColor').name('Defense Color');
missileFolder.add(AR_CONFIG, 'defenseMissileSize', 0.01, 0.1, 0.01).name('Defense Size');
missileFolder.add(AR_CONFIG, 'defenseLaunchDistance', 0.5, 5, 0.1).name('Launch Distance');

// Explosion folder
const explosionFolder = gui.addFolder('Explosions');
explosionFolder.add(AR_CONFIG, 'explosionRadius', 0.2, 2, 0.1).name('Radius (X/Y)');
explosionFolder.add(AR_CONFIG, 'explosionDepth', 0.5, 5, 0.1).name('Depth (Z)');
explosionFolder.add(AR_CONFIG, 'explosionDuration', 0.5, 3, 0.1).name('Duration');

// Hide GUI in AR mode
const originalStartARSession = startARSession;
window.startARSession = async function() {
    gui.hide();
    return originalStartARSession();
};

renderer.setAnimationLoop(animate);
updateUI();

// Hide loading indicator and show UI when ready
window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('start-game').style.display = 'block';
        document.getElementById('instructions').style.display = 'block';
    }, 500);
});
