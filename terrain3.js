var width = window.innerWidth,
    height = window.innerHeight;


let colorMapping = (height) => {
    let table = [
        [0.95, new THREE.Color("rgb(255, 255, 255)")],
        [0.8, new THREE.Color("rgb(153, 102, 51)")],
        [0.55, new THREE.Color("rgb(0, 153, 51)")],
        [0.5, new THREE.Color("rgb(255, 204, 0)")],
        [0.3, new THREE.Color("rgb(0, 0, 190)")],
        [0, new THREE.Color("rgb(0, 0, 130)")],
    ]
    return (table.filter((v) => v[0] <= height)[0] || table[table.length - 1])[1]
}

function MapDataRepository(chunkSize = 10) {
    this.maps = []
    this.chunkSize = chunkSize
    this.tileSize = 0.02
    this.fractalNoiseSize = 2
    this.randomSeed = 92
}

MapDataRepository.prototype.normalize = function () {
    let normStats = this.maps.map((mapData) => {
        let map = mapData.map
        var normStats = { min: Number.MAX_VALUE, max: Number.MIN_VALUE }
        for (var i = 0; i < map.length - 1; i++) {
                normStats.min = Math.min(normStats.min, map[i])
                normStats.max = Math.max(normStats.max, map[i])
        }
        return normStats
    }).reduce((acc, normStats) => {
        return { min: Math.min(normStats.min, acc.min), max: Math.max(normStats.max, acc.max) }
    }, { min: Number.MAX_VALUE, max: Number.MIN_VALUE }
    )

    this.maps.forEach((mapData) => {
        mapData.mapNormalized = normalizeHeightMap(mapData.map, normStats.min, normStats.max)
    })
}

function normalizeHeightMap(map, min, max) {
    let minMax = max - min
    return Array.from(Array(map.length), (_, i) => {
        return Math.min(Math.max(0, (map[i] - min) / minMax), 1)
    })
}

MapDataRepository.prototype.generate = function (chunkVector) {
    octaveOffsets = Array.from(Array(this.fractalNoiseSize + 1), (v,k) => {
        return {
            x: (Math.sin(this.fractalNoiseSize*k))*5000 + (chunkVector.x * (this.chunkSize)),
            y: (Math.cos(this.fractalNoiseSize*k))*2000 + (chunkVector.y * (this.chunkSize)),
        }
    })

    let verticiesCount = this.chunkSize + 1
    let heightsMap = Array.from(Array(verticiesCount ** 2), (_, index) => {
        let x = index % verticiesCount
        let y = ~~(index / verticiesCount)

        var height = 0
        for (var i = 1; i <= this.fractalNoiseSize + 1; i++) {
            let sampleFactor = this.tileSize * (1 / i)
            let sampleX = (x + octaveOffsets[i-1].x) * sampleFactor
            let sampleY = (y + octaveOffsets[i-1].y) * sampleFactor
            
            let perlinValue = THREE.ImprovedNoise().noise(sampleX, sampleY, this.randomSeed)
            height += (perlinValue * 2 - 1) * (i / 3)
        }
        return height
    })

    return heightsMap
}

MapDataRepository.prototype.regenerate = function () {
    this.maps.forEach((mapData) => mapData.map = generateHeightMap(mapData.x * mapSize, mapData.y * mapSize))
    this.normalize()
}

MapDataRepository.prototype.chunks = function (chunkVector) {
    var mapData = this.maps.find((mapData) => mapData.pos == chunkVector)
    if (mapData == null) {
        mapData = {}
        mapData.pos = chunkVector
        mapData.map = this.generate(chunkVector)
        this.maps.push(mapData)
    }    
    return mapData
}


function computeGeometry(map, size, heightScaleFactor, lod) {    
    let lodOffset = 2 ** lod
    let verticiesCount = Math.sqrt(map.length)
    let tilesCount = (verticiesCount - 1) / lodOffset
    var geometry = new THREE.PlaneGeometry(size, size, tilesCount, tilesCount);

    let vertIndex = 0
    for (var y=0; y < verticiesCount; y += lodOffset) {
        for (var x=0; x < verticiesCount; x += lodOffset) {
            let mapIndex = y * verticiesCount + x
            geometry.vertices[vertIndex].z = map[mapIndex] * heightScaleFactor
            vertIndex++
        }
    }

    geometry.faces.forEach(f => {
        const a = geometry.vertices[f.a]
        const b = geometry.vertices[f.b]
        const c = geometry.vertices[f.c]
        const avg = (a.z+b.z+c.z) / (3 * heightScaleFactor)
    
        let col = colorMapping(avg)
        f.color.set(col)
    })
    
    geometry.colorsNeedUpdate = true
    geometry.verticesNeedUpdate = true
    geometry.computeVertexNormals()
    
    return geometry
}


var scene = new THREE.Scene();

// scene.add(new THREE.AxesHelper(100));

var camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 3000);
camera.position.set(30, -870, 620);

var renderer = new THREE.WebGLRenderer();
renderer.setSize(width, height);
document.body.appendChild(renderer.domElement);


let pos = new THREE.Vector2(0, 0)
let chunkTilesSize = 64
let maxLod = 4
let mapDataRepository = new MapDataRepository(chunkTilesSize)

let mapChunkSize = chunkTilesSize * 2
let heightScaleFactor = chunkTilesSize * mapDataRepository.tileSize * 100

let mapChunkLimit = maxLod
console.time("generate")
for (var x = -mapChunkLimit; x < mapChunkLimit; x++) {
    for (var y = -mapChunkLimit; y < mapChunkLimit; y++) {
        mapDataRepository.chunks(new THREE.Vector2(x,y))
    }
}
console.timeEnd("generate")

console.time("normalize")
mapDataRepository.normalize()
console.timeEnd("normalize")


var materialWire = new THREE.MeshLambertMaterial({
    wireframe: true,
    vertexColors: THREE.VertexColors,
});
var material = new THREE.MeshLambertMaterial({
    vertexColors: THREE.VertexColors,
});



console.time("geometry")
let zeroPos = new THREE.Vector2(0,0)
mapDataRepository.maps.forEach( mapData => {
    let lod = Math.min(maxLod, Math.max(0, Math.round(mapData.pos.manhattanLength(zeroPos)*0.5)))
    let tx = mapChunkSize * mapData.pos.x
    let ty = -mapChunkSize * mapData.pos.y

    let g = computeGeometry(mapData.mapNormalized, mapChunkSize, heightScaleFactor, lod)
    g.translate(tx, ty, 0)

    scene.add(new THREE.Mesh(g, tx>=0&&ty<=0 ? materialWire : material));
})
console.timeEnd("geometry")

scene.add(new THREE.AmbientLight(0xffffff));

var controls = new THREE.OrbitControls(camera, renderer.domElement);

function render() {
    controls.update();
    requestAnimationFrame(render);
    renderer.render(scene, camera);
}

render();
