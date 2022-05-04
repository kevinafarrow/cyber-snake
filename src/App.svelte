<script>
  import Snake from "./Snake.svelte";
  import Food from "./Food.svelte";
  import Questionbox from "./Questionbox.svelte";

  let question = "Which is better?";
  let option1 = "bears";
  let option2 = "beets";

  let food1Left = 0;
  let food1Top = 0;
  let food2Left = 0;
  let food2Top = 0;
  let direction = 'right';
  let snakeBodies = [];
  let ms = 100;
  let board = {'width': 1250, 'height': 450};
  let unit = 50;

  //draw the game repeatedly
  setInterval(() => {
    //console.log('speed: ' + ms);
    snakeBodies.pop();
    let { left, top } = snakeBodies[0];
    const directions = {
      'up': {'top': -50, 'left': 0},
      'down': {'top': 50, 'left': 0},
      'left': {'top': 0, 'left': -50},
      'right': {'top': 0, 'left': 50},
      undefined: {'top': 0, 'left': 0}
    }
    top += directions[direction]['top']
    left += directions[direction]['left']
    //console.log('top: ' + top)
    //console.log('left: ' + left)

    const newHead = { left, top };
    snakeBodies = [ newHead, ...snakeBodies];

    // if the snake eats food, create a new food and add a piece to the snake
    if ((isCollide(newHead, { left: food1Left, top: food1Top })) || (isCollide(newHead, { left: food2Left, top: food2Top }))) {
      //poseQuestion();
      moveFood();
      snakeBodies = [...snakeBodies, snakeBodies[snakeBodies.length - 1]];
    }

    if (isGameOver()) {
      alert("Game Over!");
      resetGame();
    }
  }, ms)

  function poseQuestion() {
    
  }

  function isCollide(a, b) {
    return !(
      a.top < b.top ||
      a.top > b.top ||
      a.left < b.left ||
      a.left > b.left
    );
  }

  function moveFood() {
    food1Top = Math.floor(Math.random() * Math.floor(board.height / unit)) * unit;
    food1Left = Math.floor(Math.random() * Math.floor(board.width / unit)) * unit;
    food2Top = Math.floor(Math.random() * Math.floor(board.height / unit)) * unit;
    food2Left = Math.floor(Math.random() * Math.floor(board.width / unit)) * unit;
  }

  function isGameOver() {
    const snakeBodiesNoHead = snakeBodies.slice(1);
    const snakeCollisions = snakeBodiesNoHead.filter(sb => isCollide(sb, snakeBodies[0]));
    if (snakeCollisions.length !== 0) {
      return true;
    }
    const { top, left } = snakeBodies[0];
    if (top >= board.height|| top < 0 || left >= board.width|| left < 0){
      return true;
    }
  }

  function isOpposite(a, b) {
    const opposites = {
      'up': 'down',
      'down': 'up',
      'left': 'right',
      'right': 'left',
      'none': 'asdf'
    }
    //console.log('a: ' + a)
    //console.log('opposite a: ' + opposites[a])
    //console.log('b: ' + b)
    //console.log('opposite b: ' + opposites[b])
    if (opposites[a] == b) {
      return true
    }
  }

  function onKeyDown(e) {
    const newDirection = getDirectionFromKeyCode(e.keyCode);
    console.log(newDirection);
    if (!isOpposite(newDirection, direction)) {
      direction = newDirection;
    }
  }

  function resetGame() {
    moveFood();
    direction = 'right';
    snakeBodies = [
      { left: unit * 2, top: 0 },
      { left: unit * 1, top: 0 },
      { left: unit * 0, top: 0 }
    ]
  }

  function getDirectionFromKeyCode(keyCode) {
    const keyTransform = {
      37: 'left',
      38: 'up',
      39: 'right',
      40: 'down'
    }
    //console.log('keyCode pressed: ' + keyCode)
    //console.log('current direction: ' + direction)
    if ( 36 < keyCode && keyCode < 41) {
      //console.log('new direction: ' + keyTransform[keyCode])
      return keyTransform[keyCode];
    } else {
      //console.log('direction unchanged: ' + direction)
      return direction;
    }
  }
  resetGame();
    //background-image: url("../background.jpg");
</script>


<style>
  main {
    width: 1250px;
    height: 550px;
    border: solid black 1px;
    position: relative;
    margin: 20px auto;
    background-size: contain;
    background-color: #333333;
  }
  h2, h1 {
    text-align: center;
    font-family: 'Roboto Mono', monospace;
  }
</style>

<h1>Cyber Snake</h1>
<Questionbox {question} {option1} {option2}/>
<main>
  <Snake {snakeBodies} {direction}/>
  <Food {food1Left} {food1Top} {food2Left} {food2Top} />
</main>
<h2>Score: {snakeBodies.length - 3}</h2>
<svelte:window on:keydown={onKeyDown} />