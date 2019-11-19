let barWidth = 10
let barCount = 15
let maxHeight = barWidth * barCount
let minHeight = maxHeight / 3
let moveOffset = 4 * Math.PI / (Math.sqrt(2)*(barCount-1))
let speed = 0.05

function setup() {   
  createCanvas(640, 640, WEBGL);
}

function draw() {              
  background(0);               
  orbitControl()
    
  //translate(-width/4, -height/4);
  
  fill(255)
  
  for (let z = 0; z < barCount; z+=1) {
    for (let x = 0; x < barCount; x+=1) {
      push();

      let d = dist(x, z, barCount/2, barCount/2)

      let h = map(cos((frameCount * speed) + (d * moveOffset)), -1, 1, minHeight, maxHeight)

      translate(x*barWidth - width / 4, -height/4, z *barWidth - height / 4);
      normalMaterial();

      box(barWidth, h, barWidth)

      //rect(x * barWidth, ((maxHeight - h)/2), barWidth, h + minHeight)

      pop();
    }
  }
  
  
}
